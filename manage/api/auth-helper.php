<?php
/**
 * Reworkzone Stalls Operations System - Authentication & Security Helper
 * 
 * Handles secure session cookies, rate-limiting lockout against brute-force,
 * CSRF tokens, and API authentication middleware.
 */

require_once __DIR__ . '/config.php';

/**
 * Start or resume secure session with hardened cookie flags
 */
function reworkzone_start_session() {
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    if (headers_sent()) {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            @session_start();
        }
        return;
    }

    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');

    session_set_cookie_params([
        'lifetime' => 86400 * 7, // 7 days
        'path'     => '/',
        'domain'   => '',
        'secure'   => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);

    session_name('RZ_MANAGE_SESSID');
    session_start();
}

/**
 * Extract sanitized client IP address
 */
function reworkzone_get_client_ip() {
    if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        return $_SERVER['HTTP_CF_CONNECTING_IP'];
    }
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $parts = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        return trim($parts[0]);
    }
    return $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
}

/**
 * Check if the client IP is currently rate-limited
 * Returns array: ['locked' => bool, 'retry_after' => int, 'attempts' => int]
 */
function reworkzone_check_rate_limit(PDO $pdo, $ip) {
    $stmt = $pdo->prepare("SELECT failed_attempts, locked_until FROM auth_lockouts WHERE ip_address = :ip");
    $stmt->execute([':ip' => $ip]);
    $record = $stmt->fetch();

    if (!$record) {
        return ['locked' => false, 'retry_after' => 0, 'attempts' => 0];
    }

    if (!empty($record['locked_until'])) {
        $lockedUntilTs = strtotime($record['locked_until']);
        $nowTs = time();

        if ($lockedUntilTs > $nowTs) {
            return [
                'locked'      => true,
                'retry_after' => $lockedUntilTs - $nowTs,
                'attempts'    => (int)$record['failed_attempts'],
            ];
        } else {
            // Lockout period expired; reset attempt counter
            $resetStmt = $pdo->prepare("UPDATE auth_lockouts SET failed_attempts = 0, locked_until = NULL WHERE ip_address = :ip");
            $resetStmt->execute([':ip' => $ip]);
            return ['locked' => false, 'retry_after' => 0, 'attempts' => 0];
        }
    }

    return ['locked' => false, 'retry_after' => 0, 'attempts' => (int)$record['failed_attempts']];
}

/**
 * Record a failed authentication attempt and apply lockout after 5 failures
 */
function reworkzone_record_failed_attempt(PDO $pdo, $ip) {
    $now = date('Y-m-d H:i:s');
    $stmt = $pdo->prepare("SELECT failed_attempts FROM auth_lockouts WHERE ip_address = :ip");
    $stmt->execute([':ip' => $ip]);
    $currentAttempts = $stmt->fetchColumn();

    if ($currentAttempts === false) {
        $attempts = 1;
        $insert = $pdo->prepare("INSERT INTO auth_lockouts (ip_address, failed_attempts, last_attempt_at) VALUES (:ip, :attempts, :now)");
        $insert->execute([':ip' => $ip, ':attempts' => $attempts, ':now' => $now]);
    } else {
        $attempts = (int)$currentAttempts + 1;
        $lockedUntil = null;
        if ($attempts >= 5) {
            $lockedUntil = date('Y-m-d H:i:s', time() + 900); // 15-minute lockout
        }

        $update = $pdo->prepare("UPDATE auth_lockouts SET failed_attempts = :attempts, locked_until = :locked, last_attempt_at = :now WHERE ip_address = :ip");
        $update->execute([
            ':attempts' => $attempts,
            ':locked'   => $lockedUntil,
            ':now'      => $now,
            ':ip'       => $ip
        ]);
    }

    return $attempts;
}

/**
 * Clear failed attempt counter on successful login
 */
function reworkzone_clear_failed_attempts(PDO $pdo, $ip) {
    $stmt = $pdo->prepare("DELETE FROM auth_lockouts WHERE ip_address = :ip");
    $stmt->execute([':ip' => $ip]);
}

/**
 * Strict authentication middleware for all management API endpoints.
 * Returns account array if valid; dies with HTTP 401 if unauthorized.
 */
function reworkzone_require_master_auth(PDO $pdo = null) {
    reworkzone_start_session();

    if (empty($_SESSION['manage_authenticated']) || empty($_SESSION['manage_role'])) {
        reworkzone_json_response([
            'success' => false,
            'error'   => 'Authentication required. Please enter your 6-digit PIN.'
        ], 401);
    }

    // Verify session age (max 7 days inactivity)
    $loginTime = $_SESSION['manage_login_time'] ?? 0;
    if (time() - $loginTime > (86400 * 7)) {
        $_SESSION = [];
        @session_destroy();
        reworkzone_json_response([
            'success' => false,
            'error'   => 'Session expired. Please enter your 6-digit PIN again.'
        ], 401);
    }

    // Must have master role in V1
    if ($_SESSION['manage_role'] !== 'master') {
        reworkzone_json_response([
            'success' => false,
            'error'   => 'Access denied: Master role privileges required.'
        ], 403);
    }

    // Update session timestamp on active use
    $_SESSION['manage_last_activity'] = time();

    return [
        'account_id'   => $_SESSION['manage_account_id'] ?? 1,
        'account_name' => $_SESSION['manage_account_name'] ?? 'Master Admin',
        'role'         => $_SESSION['manage_role'],
    ];
}

/**
 * Alias for reworkzone_require_master_auth
 */
function reworkzone_require_auth(PDO $pdo = null) {
    return reworkzone_require_master_auth($pdo);
}

/**
 * Retrieve or generate CSRF token stored in active session
 */
function reworkzone_get_csrf_token() {
    reworkzone_start_session();
    if (empty($_SESSION['rz_csrf_token'])) {
        $_SESSION['rz_csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['rz_csrf_token'];
}

/**
 * Enforce CSRF token verification on state-changing API endpoints
 */
function reworkzone_verify_csrf() {
    reworkzone_start_session();

    $token = null;
    if (!empty($_SERVER['HTTP_X_CSRF_TOKEN'])) {
        $token = $_SERVER['HTTP_X_CSRF_TOKEN'];
    } elseif (!empty($_POST['csrf_token'])) {
        $token = $_POST['csrf_token'];
    } else {
        $raw = @file_get_contents('php://input');
        if ($raw) {
            $parsed = @json_decode($raw, true);
            if (is_array($parsed) && !empty($parsed['csrf_token'])) {
                $token = $parsed['csrf_token'];
            }
        }
    }

    $sessionToken = $_SESSION['rz_csrf_token'] ?? '';
    if (empty($sessionToken) || empty($token) || !hash_equals($sessionToken, (string)$token)) {
        reworkzone_json_response([
            'success' => false,
            'error'   => 'Invalid or missing CSRF token. Please refresh and try again.'
        ], 403);
    }

    return true;
}

/**
 * Enforce CSRF token verification (alias to support both require and verify naming)
 */
function reworkzone_require_csrf() {
    return reworkzone_verify_csrf();
}

/**
 * Record an audit trail action to activity_logs
 */
function reworkzone_log_activity(PDO $pdo, ?string $boothId, string $actionType, string $description, string $actorLabel = 'Master Admin') {
    try {
        $id = 'act_' . bin2hex(random_bytes(6));
        $stmt = $pdo->prepare("
            INSERT INTO activity_logs (id, booth_id, action_type, actor_label, description, created_at)
            VALUES (:id, :booth_id, :action_type, :actor_label, :description, CURRENT_TIMESTAMP)
        ");
        $stmt->execute([
            ':id'          => $id,
            ':booth_id'    => $boothId,
            ':action_type' => $actionType,
            ':actor_label' => $actorLabel,
            ':description' => $description,
        ]);
        return $id;
    } catch (Exception $e) {
        error_log('Failed to log activity: ' . $e->getMessage());
        return null;
    }
}
