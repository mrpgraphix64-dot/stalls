<?php
/**
 * Reworkzone Stalls Operations System - Dashboard API Endpoint
 * 
 * Provides live aggregate KPIs and recent activity metrics.
 * Strictly requires Master authentication.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth-helper.php';

header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    reworkzone_json_response(['success' => false, 'error' => 'Method not allowed'], 405);
}

$pdo = reworkzone_get_db();
$sessionUser = reworkzone_require_master_auth($pdo);

try {
    // 1. Total events (excluding archived)
    $totalEvents = (int)$pdo->query("SELECT COUNT(*) FROM events WHERE status != 'archived'")->fetchColumn();

    // 2. Active events (upcoming, in_progress, live)
    $activeEvents = (int)$pdo->query("SELECT COUNT(*) FROM events WHERE status IN ('upcoming', 'in_progress', 'live')")->fetchColumn();

    // 3. Confirmed Stalls (all confirmed non-archived booths)
    $confirmedStalls = (int)$pdo->query("
        SELECT COUNT(*) 
        FROM booths 
        WHERE status != 'archived' 
          AND (booking_stage = 'confirmed' OR booking_stage IS NULL OR booking_stage = '')
    ")->fetchColumn();

    // 4. Ongoing Discussions (unconfirmed non-archived booth discussions)
    $ongoingDiscussions = (int)$pdo->query("
        SELECT COUNT(*) 
        FROM booths 
        WHERE status != 'archived' 
          AND booking_stage = 'discussion'
    ")->fetchColumn();

    // Task progress mapping per booth
    $progressStmt = $pdo->query("
        SELECT 
            t.booth_id,
            COUNT(t.id) as total_tasks,
            SUM(CASE WHEN t.status IS NULL OR t.status != 'not_applicable' THEN 1 ELSE 0 END) as applicable_tasks,
            SUM(CASE WHEN (t.is_completed = 1 OR t.status = 'completed') AND (t.status IS NULL OR t.status != 'not_applicable') THEN 1 ELSE 0 END) as completed_tasks,
            SUM(CASE WHEN t.status = 'not_applicable' THEN 1 ELSE 0 END) as na_tasks
        FROM booth_tasks t
        INNER JOIN booths b ON t.booth_id = b.id
        WHERE b.status != 'archived' AND LOWER(t.task_name) NOT LIKE '%install%' AND LOWER(t.task_name) != 'design' AND LOWER(t.task_name) != 'design approved'
        GROUP BY t.booth_id
    ");
    $progressMap = [];
    while ($pRow = $progressStmt->fetch()) {
        $app = (int)$pRow['applicable_tasks'];
        $comp = (int)$pRow['completed_tasks'];
        $na = (int)$pRow['na_tasks'];
        $pct = $app > 0 ? round(($comp / $app) * 100, 1) : 0.0;
        $progressMap[$pRow['booth_id']] = [
            'total'      => (int)$pRow['total_tasks'],
            'applicable' => $app,
            'completed'  => $comp,
            'na'         => $na,
            'percentage' => $pct,
        ];
    }

    // 5. Compute In Progress & Completed subsets for Confirmed Stalls
    // Completed: Confirmed booths whose applicable checklist requirements are complete (applicable > 0)
    // In Progress: Confirmed booths with some checklist work underway but not fully completed
    $confirmedBoothsList = $pdo->query("
        SELECT id, status 
        FROM booths 
        WHERE status != 'archived' 
          AND (booking_stage = 'confirmed' OR booking_stage IS NULL OR booking_stage = '')
    ")->fetchAll(PDO::FETCH_ASSOC);

    $completedCount = 0;
    $inProgressCount = 0;

    foreach ($confirmedBoothsList as $cb) {
        $pr = $progressMap[$cb['id']] ?? null;
        $app = $pr ? $pr['applicable'] : 0;
        $comp = $pr ? $pr['completed'] : 0;
        $st = $cb['status'] ?? 'draft';

        $isComplete = ($app > 0 && $comp >= $app) || in_array($st, ['completed', 'installed', 'handover'], true);
        if ($isComplete) {
            $completedCount++;
        } elseif (($app > 0 && $comp > 0) || in_array($st, ['in_production', 'production', 'approved', 'design'], true)) {
            $inProgressCount++;
        }
    }

    // 6. Pending tasks (for active non-archived CONFIRMED booths only; ongoing discussions, N/A tasks and legacy installation excluded)
    $pendingTasks = (int)$pdo->query("
        SELECT COUNT(*)
        FROM booth_tasks t
        INNER JOIN booths b ON t.booth_id = b.id
        WHERE (t.is_completed = 0 AND (t.status IS NULL OR t.status = 'pending')) 
          AND (t.status IS NULL OR t.status != 'not_applicable')
          AND b.status != 'archived'
          AND (b.booking_stage = 'confirmed' OR b.booking_stage IS NULL OR b.booking_stage = '')
          AND LOWER(t.task_name) NOT LIKE '%install%' AND LOWER(t.task_name) != 'design' AND LOWER(t.task_name) != 'design approved'
    ")->fetchColumn();

    // 7. Recent booths / All active managed stalls for operations table
    $boothsStmt = $pdo->query("
        SELECT 
            b.id, b.event_id, b.booth_number, b.client_name, b.phone, b.stand_size, b.booth_type, b.booking_stage, b.discussion_remark, b.status, b.main_drive_folder_url, b.created_at, b.updated_at,
            e.name AS event_name, e.city AS event_city, e.setup_date, e.start_date
        FROM booths b
        LEFT JOIN events e ON b.event_id = e.id
        WHERE b.status != 'archived'
        ORDER BY b.created_at DESC
    ");
    $allManagedBooths = $boothsStmt->fetchAll();
    foreach ($allManagedBooths as &$mb) {
        $pr = $progressMap[$mb['id']] ?? ['total' => 0, 'applicable' => 0, 'completed' => 0, 'percentage' => 0.0];
        $mb['progress'] = $pr;
    }
    unset($mb);

    $recentBooths = array_slice($allManagedBooths, 0, 5);

    // 7. Upcoming events (5 upcoming/live events with booth count)
    $upcomingStmt = $pdo->query("
        SELECT 
            e.id, e.name, e.venue, e.city, e.start_date, e.end_date, e.setup_date, e.status,
            COUNT(b.id) AS booth_count
        FROM events e
        LEFT JOIN booths b ON e.id = b.event_id AND b.status != 'archived'
        WHERE e.status != 'archived'
        GROUP BY e.id
        ORDER BY e.start_date ASC
        LIMIT 5
    ");
    $upcomingEvents = $upcomingStmt->fetchAll();

    reworkzone_json_response([
        'success' => true,
        'data'    => [
            'confirmed_stalls'      => $confirmedStalls,
            'ongoing_discussions'   => $ongoingDiscussions,
            'in_progress'           => $inProgressCount,
            'completed'             => $completedCount,
            'total_events'          => $totalEvents,
            'active_events'         => $activeEvents,
            'total_booths'          => $confirmedStalls,
            'completed_checklists'  => $completedCount,
            'booths_in_production'  => $inProgressCount,
            'work_in_progress'      => $inProgressCount,
            'ready_completed'       => $completedCount,
            'pending_tasks'         => $pendingTasks,
            'recent_booths'         => $recentBooths,
            'all_booths'            => $allManagedBooths,
            'upcoming_events'       => $upcomingEvents,
        ]
    ]);

} catch (Exception $e) {
    error_log('Dashboard error: ' . $e->getMessage());
    reworkzone_json_response([
        'success' => false,
        'error'   => 'Failed to load dashboard data.'
    ], 500);
}
