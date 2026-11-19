<?php
/**
 * Reworkzone Stalls Operations System - Activity Logs API
 *
 * Provides audit trail logs for events, stalls, drive links,
 * production items, checklists, and expenses.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth-helper.php';

// Authenticate session
$auth = reworkzone_require_auth();
$pdo = reworkzone_get_db();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    reworkzone_json_response(['success' => false, 'error' => 'Method not allowed.'], 405);
}

$boothId = trim($_GET['booth_id'] ?? '');
$limit = min(max((int)($_GET['limit'] ?? 50), 1), 200);

if (!empty($boothId)) {
    $stmt = $pdo->prepare("
        SELECT id, booth_id, action_type, actor_label, description, created_at
        FROM activity_logs
        WHERE booth_id = :booth_id
        ORDER BY created_at DESC
        LIMIT :limit
    ");
    $stmt->bindValue(':booth_id', $boothId, PDO::PARAM_STR);
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();
} else {
    $stmt = $pdo->prepare("
        SELECT id, booth_id, action_type, actor_label, description, created_at
        FROM activity_logs
        ORDER BY created_at DESC
        LIMIT :limit
    ");
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();
}

$logs = $stmt->fetchAll();

reworkzone_json_response([
    'success' => true,
    'count'   => count($logs),
    'logs'    => $logs,
]);
