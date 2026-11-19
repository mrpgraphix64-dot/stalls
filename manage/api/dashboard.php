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

    // 3. Total booths (excluding archived)
    $totalBooths = (int)$pdo->query("SELECT COUNT(*) FROM booths WHERE status != 'archived'")->fetchColumn();

    // 4. Booths in production / Work in progress
    $boothsInProduction = (int)$pdo->query("SELECT COUNT(*) FROM booths WHERE status IN ('in_production', 'production', 'approved')")->fetchColumn();
    $workInProgress = (int)$pdo->query("SELECT COUNT(*) FROM booths WHERE status IN ('draft', 'approved', 'in_production', 'production')")->fetchColumn();
    $readyCompleted = (int)$pdo->query("SELECT COUNT(*) FROM booths WHERE status IN ('installed', 'completed', 'handover')")->fetchColumn();

    // 5. Pending tasks (for active non-archived booths)
    $pendingTasks = (int)$pdo->query("
        SELECT COUNT(*)
        FROM booth_tasks t
        INNER JOIN booths b ON t.booth_id = b.id
        WHERE (t.is_completed = 0 AND (t.status IS NULL OR t.status = 'pending')) AND b.status != 'archived'
    ")->fetchColumn();

    // Task progress mapping per booth
    $progressStmt = $pdo->query("
        SELECT 
            booth_id,
            COUNT(*) as total_tasks,
            SUM(CASE WHEN status != 'not_applicable' THEN 1 ELSE 0 END) as applicable_tasks,
            SUM(CASE WHEN is_completed = 1 OR status = 'completed' THEN 1 ELSE 0 END) as completed_tasks
        FROM booth_tasks
        GROUP BY booth_id
    ");
    $progressMap = [];
    $completedChecklists = 0;
    while ($pRow = $progressStmt->fetch()) {
        $app = (int)$pRow['applicable_tasks'];
        $comp = (int)$pRow['completed_tasks'];
        $pct = $app > 0 ? round(($comp / $app) * 100, 1) : 0.0;
        if ($app > 0 && $comp >= $app) {
            $completedChecklists++;
        }
        $progressMap[$pRow['booth_id']] = [
            'total'      => (int)$pRow['total_tasks'],
            'applicable' => $app,
            'completed'  => $comp,
            'percentage' => $pct,
        ];
    }

    // 6. Recent booths / All active managed stalls for operations table
    $boothsStmt = $pdo->query("
        SELECT 
            b.id, b.event_id, b.booth_number, b.client_name, b.stand_size, b.booth_type, b.status, b.main_drive_folder_url, b.created_at, b.updated_at,
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
            'total_events'          => $totalEvents,
            'active_events'         => $activeEvents,
            'total_booths'          => $totalBooths,
            'completed_checklists'  => $completedChecklists,
            'booths_in_production'  => $boothsInProduction,
            'work_in_progress'      => $workInProgress,
            'ready_completed'       => $readyCompleted,
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
