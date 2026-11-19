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

    // 4. Booths in production
    $boothsInProduction = (int)$pdo->query("SELECT COUNT(*) FROM booths WHERE status IN ('in_production', 'production', 'approved')")->fetchColumn();

    // 5. Pending tasks (for active non-archived booths)
    $pendingTasks = (int)$pdo->query("
        SELECT COUNT(*)
        FROM booth_tasks t
        INNER JOIN booths b ON t.booth_id = b.id
        WHERE t.is_completed = 0 AND b.status != 'archived'
    ")->fetchColumn();

    // 6. Recent booths (5 most recently created/updated with event information)
    $recentStmt = $pdo->query("
        SELECT 
            b.id, b.booth_number, b.client_name, b.stand_size, b.status, b.main_drive_folder_url, b.created_at,
            e.id AS event_id, e.name AS event_name, e.city AS event_city, e.setup_date, e.start_date
        FROM booths b
        LEFT JOIN events e ON b.event_id = e.id
        WHERE b.status != 'archived'
        ORDER BY b.created_at DESC
        LIMIT 5
    ");
    $recentBooths = $recentStmt->fetchAll();

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
            'booths_in_production'  => $boothsInProduction,
            'pending_tasks'         => $pendingTasks,
            'recent_booths'         => $recentBooths,
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
