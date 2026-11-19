<?php
/**
 * Reworkzone Stalls Operations System - First-Run Master PIN Setup Status
 * 
 * Secure one-time initialization gate.
 * Web-based initialization is completely disabled for security.
 * Initialization MUST be executed directly on the server via CLI:
 *   php manage/init-cli.php --pin=XXXXXX
 * 
 * Permanently locks once a Master account exists.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth-helper.php';

header('Content-Type: application/json; charset=UTF-8');

$pdo = reworkzone_get_db();

// 1. Check if database is already initialized
$countStmt = $pdo->query("SELECT COUNT(*) FROM auth_accounts");
$accountCount = (int)$countStmt->fetchColumn();

if ($accountCount > 0) {
    // Permanently locked. Never allow setup once an account exists.
    reworkzone_json_response([
        'success'        => false,
        'is_initialized' => true,
        'error'          => 'Setup is permanently locked. The management system has already been initialized.'
    ], 403);
}

// 2. Reject all POST requests over the web
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    reworkzone_json_response([
        'success'        => false,
        'is_initialized' => false,
        'error'          => 'Web-based setup is disabled for security. Initial Master account must be created via server CLI: php manage/init-cli.php --pin=XXXXXX'
    ], 403);
}

// 3. GET request: Report uninitialized status and provide CLI instructions
reworkzone_json_response([
    'success'        => true,
    'is_initialized' => false,
    'message'        => 'System uninitialized. First-run Master PIN must be configured via server CLI: php manage/init-cli.php --pin=XXXXXX'
]);
