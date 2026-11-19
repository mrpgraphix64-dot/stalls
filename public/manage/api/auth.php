<?php
/**
 * Reworkzone Stalls Operations System - Authentication Endpoint
 * 
 * Handles login with rate-limiting, status check, and logout.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth-helper.php';

reworkzone_start_session();

$pdo = reworkzone_get_db();
$ip  = reworkzone_get_client_ip();
$action = $_GET['action'] ?? ($_SERVER['REQUEST_METHOD'] === 'GET' ? 'status' : 'login');

// 1. STATUS CHECK
if ($action === 'status' || ($_SERVER['REQUEST_METHOD'] === 'GET' && empty($_GET['action']))) {
    $count = (int)$pdo->query("SELECT COUNT(*) FROM auth_accounts WHERE is_active = 1")->fetchColumn();
    $isInitialized = $count > 0;

    $isAuthenticated = !empty($_SESSION['manage_authenticated']) && ($_SESSION['manage_role'] === 'master');
    
    // Check if session expired (7 days)
    if ($isAuthenticated && (time() - ($_SESSION['manage_login_time'] ?? 0) > (86400 * 7))) {
        $_SESSION = [];
        @session_destroy();
        $isAuthenticated = false;
    }

    $rateStatus = reworkzone_check_rate_limit($pdo, $ip);

    reworkzone_json_response([
        'success'        => true,
        'is_initialized' => $isInitialized,
        'authenticated'  => $isAuthenticated,
        'role'           => $isAuthenticated ? ($_SESSION['manage_role'] ?? null) : null,
        'account_name'   => $isAuthenticated ? ($_SESSION['manage_account_name'] ?? null) : null,
        'csrf_token'     => reworkzone_get_csrf_token(),
        'rate_limited'   => $rateStatus['locked'],
        'retry_after'    => $rateStatus['retry_after'],
    ]);
}

// 2. LOGIN
if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    // Check rate limit first
    $rateStatus = reworkzone_check_rate_limit($pdo, $ip);
    if ($rateStatus['locked']) {
        reworkzone_json_response([
            'success'     => false,
            'locked'      => true,
            'retry_after' => $rateStatus['retry_after'],
            'error'       => 'Too many incorrect attempts. Account access is temporarily locked. Try again in ' . ceil($rateStatus['retry_after'] / 60) . ' minutes.'
        ], 429);
    }

    $raw = file_get_contents('php://input');
    $body = json_decode($raw, true) ?: $_POST;
    $pin = trim($body['pin'] ?? '');

    if (!preg_match('/^\d{6}$/', $pin)) {
        reworkzone_record_failed_attempt($pdo, $ip);
        reworkzone_json_response([
            'success' => false,
            'error'   => 'Please enter a valid 6-digit numeric PIN.'
        ], 400);
    }

    // Retrieve active Master account
    $stmt = $pdo->prepare("SELECT id, account_name, pin_hash, role FROM auth_accounts WHERE is_active = 1 AND role = 'master' LIMIT 1");
    $stmt->execute();
    $account = $stmt->fetch();

    if (!$account) {
        reworkzone_json_response([
            'success'        => false,
            'is_initialized' => false,
            'error'          => 'Management system has not been initialized yet. Please run CLI setup.'
        ], 400);
    }

    // Verify PIN hash using constant-time comparison in password_verify
    if (!password_verify($pin, $account['pin_hash'])) {
        $attempts = reworkzone_record_failed_attempt($pdo, $ip);
        $remaining = max(0, 5 - $attempts);

        if ($remaining === 0) {
            reworkzone_json_response([
                'success'     => false,
                'locked'      => true,
                'retry_after' => 900,
                'error'       => 'Incorrect PIN. Maximum attempts exceeded. Access locked for 15 minutes.'
            ], 429);
        }

        reworkzone_json_response([
            'success'   => false,
            'remaining' => $remaining,
            'error'     => "Incorrect PIN. {$remaining} attempt" . ($remaining === 1 ? '' : 's') . " remaining."
        ], 401);
    }

    // Verification SUCCESS: Clear failed attempts
    reworkzone_clear_failed_attempts($pdo, $ip);

    // Update last login timestamp
    $now = date('Y-m-d H:i:s');
    $update = $pdo->prepare("UPDATE auth_accounts SET last_login_at = :now WHERE id = :id");
    $update->execute([':now' => $now, ':id' => $account['id']]);

    // Regenerate session ID to prevent session fixation attacks
    session_regenerate_id(true);

    // Set authenticated session
    $_SESSION['manage_authenticated'] = true;
    $_SESSION['manage_account_id']    = $account['id'];
    $_SESSION['manage_account_name']  = $account['account_name'];
    $_SESSION['manage_role']          = $account['role'];
    $_SESSION['manage_login_time']     = time();
    $_SESSION['manage_last_activity'] = time();

    reworkzone_json_response([
        'success'      => true,
        'message'      => 'Authentication successful.',
        'account_name' => $account['account_name'],
        'role'         => $account['role'],
        'csrf_token'   => reworkzone_get_csrf_token(),
    ]);
}

// 3. LOGOUT
if ($action === 'logout') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params['path'],
            $params['domain'],
            $params['secure'],
            $params['httponly']
        );
    }
    @session_destroy();

    reworkzone_json_response([
        'success' => true,
        'message' => 'Logged out successfully.'
    ]);
}

reworkzone_json_response(['success' => false, 'error' => 'Invalid action.'], 400);
