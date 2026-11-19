<?php
/**
 * Reworkzone Stalls Operations System - Authenticated PIN Change
 * 
 * Allows Master Admin to change the 6-digit PIN securely.
 * Requires active master session, CSRF token, and verification of current PIN.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth-helper.php';

header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    reworkzone_json_response(['success' => false, 'error' => 'Method not allowed'], 405);
}

$pdo = reworkzone_get_db();

// 1. Require Master authentication
$sessionUser = reworkzone_require_master_auth($pdo);

// 2. Enforce CSRF protection
reworkzone_verify_csrf();

// 3. Parse request
$raw = file_get_contents('php://input');
$body = json_decode($raw, true) ?: $_POST;

$currentPin = trim($body['current_pin'] ?? '');
$newPin     = trim($body['new_pin'] ?? '');

// 4. Validate inputs
if (!preg_match('/^\d{6}$/', $currentPin) || !preg_match('/^\d{6}$/', $newPin)) {
    reworkzone_json_response([
        'success' => false,
        'error'   => 'Both current PIN and new PIN must be exactly 6 numeric digits.'
    ], 400);
}

if ($currentPin === $newPin) {
    reworkzone_json_response([
        'success' => false,
        'error'   => 'New PIN must be different from current PIN.'
    ], 400);
}

if (preg_match('/^(\d)\1{5}$/', $newPin) || in_array($newPin, ['123456', '654321', '012345'])) {
    reworkzone_json_response([
        'success' => false,
        'error'   => 'New PIN is too simple. Please choose a non-sequential 6-digit PIN.'
    ], 400);
}

// 5. Retrieve current account hash
$stmt = $pdo->prepare("SELECT id, pin_hash FROM auth_accounts WHERE id = :id AND role = 'master' AND is_active = 1");
$stmt->execute([':id' => $sessionUser['account_id']]);
$account = $stmt->fetch();

if (!$account || !password_verify($currentPin, $account['pin_hash'])) {
    reworkzone_json_response([
        'success' => false,
        'error'   => 'Current PIN is incorrect.'
    ], 401);
}

// 6. Hash new PIN and update
$newHash = password_hash($newPin, PASSWORD_BCRYPT, ['cost' => 12]);
$update = $pdo->prepare("UPDATE auth_accounts SET pin_hash = :hash WHERE id = :id");
$update->execute([':hash' => $newHash, ':id' => $account['id']]);

// 7. Log activity
$logStmt = $pdo->prepare("
    INSERT INTO activity_logs (id, booth_id, action_type, actor_label, description)
    VALUES (:id, NULL, 'pin_changed', 'Master Admin', 'Master 6-digit security PIN was updated.')
");
$logStmt->execute([':id' => bin2hex(random_bytes(16))]);

reworkzone_json_response([
    'success' => true,
    'message' => 'Master security PIN updated successfully.'
]);
