<?php
/**
 * Real HTTP Integration & Security Test Suite for Step 2
 * 
 * Tests authentication, lockout, CSRF, cookie flags, session regeneration,
 * and data preservation over real HTTP requests against PHP local server.
 */

$testDataDir = sys_get_temp_dir() . '/rz_http_test_' . bin2hex(random_bytes(6));
mkdir($testDataDir, 0755, true);

$rootDir = str_replace('\\', '/', dirname(__DIR__));
$escapedRootDir = addslashes($rootDir);
$escapedTestDir = addslashes($testDataDir);
$routerCode = <<<PHP
<?php
define('REWORKZONE_DATA_DIR_OVERRIDE', '{$escapedTestDir}');
\$path = parse_url(\$_SERVER['REQUEST_URI'], PHP_URL_PATH);
\$file = '{$escapedRootDir}' . \$path;

if (is_file(\$file) && substr(\$file, -4) === '.php') {
    require \$file;
    exit;
}
if (preg_match('#^/manage/api/([^/]+)/?$#', \$path, \$m)) {
    \$apiFile = '{$escapedRootDir}/manage/api/' . \$m[1] . '.php';
    if (file_exists(\$apiFile)) {
        require \$apiFile;
        exit;
    }
}
return false;
PHP;

$routerFile = sys_get_temp_dir() . '/rz_test_router.php';
file_put_contents($routerFile, $routerCode);

$port = 8899;
$serverCmd = "php -S 127.0.0.1:{$port} " . escapeshellarg($routerFile);

// Start local PHP web server with NUL descriptors on Windows
$descriptors = [
    0 => ['file', 'nul', 'r'],
    1 => ['file', 'nul', 'w'],
    2 => ['file', 'nul', 'w']
];
$serverProcess = proc_open($serverCmd, $descriptors, $pipes, dirname(__DIR__));
usleep(800000); // 800ms startup delay

$baseUrl = "http://127.0.0.1:{$port}";
$passed = 0;
$failed = 0;

function assert_http($desc, $cond) {
    global $passed, $failed;
    if ($cond) {
        echo "  [PASS] {$desc}\n";
        $passed++;
    } else {
        echo "  [FAIL] {$desc}\n";
        $failed++;
    }
}

function http_req($method, $url, $data = null, $cookies = [], $headers = []) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

    $allHeaders = array_merge(['Accept: application/json'], $headers);
    if ($data !== null) {
        $json = is_string($data) ? $data : json_encode($data);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
        $allHeaders[] = 'Content-Type: application/json';
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $allHeaders);

    if (!empty($cookies)) {
        $cookieStr = '';
        foreach ($cookies as $k => $v) {
            $cookieStr .= "{$k}={$v}; ";
        }
        curl_setopt($ch, CURLOPT_COOKIE, rtrim($cookieStr, '; '));
    }

    $response = curl_exec($ch);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $headerText = substr($response, 0, $headerSize);
    $bodyText   = substr($response, $headerSize);
    $jsonBody   = json_decode($bodyText, true);

    // Extract cookies
    $newCookies = [];
    if (preg_match_all('/Set-Cookie:\s*([^=]+)=([^;]+)/i', $headerText, $matches)) {
        for ($i = 0; $i < count($matches[1]); $i++) {
            $newCookies[$matches[1][$i]] = $matches[2][$i];
        }
    }

    return [
        'code'    => $httpCode,
        'headers' => $headerText,
        'body'    => $jsonBody,
        'raw_body'=> $bodyText,
        'cookies' => $newCookies
    ];
}

echo "========================================================\n";
echo "REWORKZONE STALLS - REAL HTTP SECURITY TEST SUITE\n";
echo "Local Server URL: {$baseUrl}\n";
echo "========================================================\n\n";

try {
    // ---------------------------------------------------------
    // TEST 1: Uninitialized Status & Web Setup Lockout
    // ---------------------------------------------------------
    echo "Test 1: Web Setup Restrictions & CLI Initialization\n";

    $res1 = http_req('GET', "{$baseUrl}/manage/api/setup.php");
    assert_http("GET /manage/api/setup.php reports uninitialized", $res1['code'] === 200 && $res1['body']['is_initialized'] === false);

    // Attempting web POST to setup must be rejected with 403
    $resPostSetup = http_req('POST', "{$baseUrl}/manage/api/setup.php", ['pin' => '840192']);
    assert_http("POST /manage/api/setup.php rejected with 403 (Web setup disabled)", $resPostSetup['code'] === 403);

    // Execute CLI setup tool with temporary data dir
    putenv("REWORKZONE_DATA_DIR_OVERRIDE={$testDataDir}");
    $initialPin = '840192';
    $envPrefix = stripos(PHP_OS, 'WIN') === 0 ? "set REWORKZONE_DATA_DIR_OVERRIDE={$testDataDir}&& " : "REWORKZONE_DATA_DIR_OVERRIDE={$testDataDir} ";
    exec($envPrefix . "php manage/init-cli.php --pin={$initialPin} 2>&1", $cliOut, $cliCode);
    assert_http("CLI initialization succeeded (exit 0)", $cliCode === 0);

    // Concurrent / Second CLI initialization attempt must fail
    exec($envPrefix . "php manage/init-cli.php --pin=999999 2>&1", $cliOut2, $cliCode2);
    assert_http("Second CLI initialization rejected (exit 1)", $cliCode2 === 1);

    // Web setup endpoint must now report permanently locked
    $resPostLocked = http_req('GET', "{$baseUrl}/manage/api/setup.php");
    assert_http("Setup endpoint is now permanently locked (403)", $resPostLocked['code'] === 403 && $resPostLocked['body']['is_initialized'] === true);

    echo "\n";

    // ---------------------------------------------------------
    // TEST 2: Status & Rate Limiting Over Real HTTP
    // ---------------------------------------------------------
    echo "Test 2: Status Endpoint & Brute-Force Rate Limiting\n";

    $resStatus = http_req('GET', "{$baseUrl}/manage/api/auth.php?action=status");
    assert_http("GET status reports is_initialized=true", $resStatus['code'] === 200 && $resStatus['body']['is_initialized'] === true);
    assert_http("GET status reports authenticated=false", $resStatus['body']['authenticated'] === false);
    assert_http("GET status issues CSRF token", !empty($resStatus['body']['csrf_token']));

    // Send 4 wrong PINs
    for ($i = 1; $i <= 4; $i++) {
        $resWrong = http_req('POST', "{$baseUrl}/manage/api/auth.php?action=login", ['pin' => '000000']);
        assert_http("Attempt {$i} with wrong PIN returns 401 Unauthorized", $resWrong['code'] === 401);
    }

    // 5th wrong attempt must trigger 429 Too Many Requests
    $res5th = http_req('POST', "{$baseUrl}/manage/api/auth.php?action=login", ['pin' => '000000']);
    assert_http("5th failed attempt triggers HTTP 429 Too Many Requests", $res5th['code'] === 429 && $res5th['body']['locked'] === true);

    // While locked, even correct PIN must be rejected with 429
    $resLockedValid = http_req('POST', "{$baseUrl}/manage/api/auth.php?action=login", ['pin' => $initialPin]);
    assert_http("While locked out, even valid PIN returns 429", $resLockedValid['code'] === 429);

    // Reset lockout in DB for remaining tests
    $dbFile = $testDataDir . '/reworkzone_stalls.sqlite';
    $db = new PDO("sqlite:{$dbFile}");
    $db->exec("DELETE FROM auth_lockouts;");

    echo "\n";

    // ---------------------------------------------------------
    // TEST 3: Login, Session Fixation & Cookie Flags
    // ---------------------------------------------------------
    echo "Test 3: Authentication, Session Regeneration & Cookie Flags\n";

    // Establish pre-session cookie
    $preSession = http_req('GET', "{$baseUrl}/manage/api/auth.php?action=status");
    $preCookie = $preSession['cookies']['RZ_MANAGE_SESSID'] ?? '';

    // Login with correct PIN
    $resLogin = http_req('POST', "{$baseUrl}/manage/api/auth.php?action=login", ['pin' => $initialPin], ['RZ_MANAGE_SESSID' => $preCookie]);
    assert_http("Login with correct PIN returns 200 OK", $resLogin['code'] === 200 && $resLogin['body']['success'] === true);
    assert_http("Login issues Master role", $resLogin['body']['role'] === 'master');

    // Verify session regeneration (Fixation Protection)
    $authCookie = $resLogin['cookies']['RZ_MANAGE_SESSID'] ?? '';
    assert_http("Session ID regenerated upon login (Session Fixation protected)", !empty($authCookie) && $authCookie !== $preCookie);

    // Verify Cookie Flags in headers
    assert_http("Cookie header contains HttpOnly", stripos($resLogin['headers'], 'HttpOnly') !== false);
    assert_http("Cookie header contains SameSite=Lax", stripos($resLogin['headers'], 'SameSite=Lax') !== false);

    $csrfToken = $resLogin['body']['csrf_token'] ?? '';
    assert_http("Login response includes fresh CSRF token", !empty($csrfToken));

    echo "\n";

    // ---------------------------------------------------------
    // TEST 4: CSRF & Authenticated PIN Change
    // ---------------------------------------------------------
    echo "Test 4: CSRF Protection & Authenticated PIN Change\n";

    // Seed test event to verify data preservation
    $db->exec("INSERT INTO events (id, name, venue, city, start_date, end_date, setup_date, dismantling_date) VALUES ('evt_demo', 'Auto Expo', 'Pragati Maidan', 'Delhi', '2026-11-01', '2026-11-05', '2026-10-31', '2026-11-06');");
    $db->exec("INSERT INTO booths (id, event_id, booth_number, client_name, main_drive_folder_url) VALUES ('bth_demo', 'evt_demo', 'B01', 'Tesla Motors', 'https://drive.google.com/folder/123');");

    // Attempt PIN change without CSRF token -> MUST FAIL with 403
    $resNoCsrf = http_req('POST', "{$baseUrl}/manage/api/change-pin.php", [
        'current_pin' => $initialPin,
        'new_pin'     => '918273'
    ], ['RZ_MANAGE_SESSID' => $authCookie]);
    assert_http("change-pin without CSRF token rejected with 403 Forbidden", $resNoCsrf['code'] === 403);

    // Attempt PIN change with wrong current PIN -> MUST FAIL with 401
    $resWrongCurrent = http_req('POST', "{$baseUrl}/manage/api/change-pin.php", [
        'current_pin' => '000000',
        'new_pin'     => '918273'
    ], ['RZ_MANAGE_SESSID' => $authCookie], ['X-CSRF-Token: ' . $csrfToken]);
    assert_http("change-pin with wrong current PIN rejected with 401", $resWrongCurrent['code'] === 401);

    // Valid PIN change with CSRF token and valid current PIN
    $newPin = '918273';
    $resValidChange = http_req('POST', "{$baseUrl}/manage/api/change-pin.php", [
        'current_pin' => $initialPin,
        'new_pin'     => $newPin
    ], ['RZ_MANAGE_SESSID' => $authCookie], ['X-CSRF-Token: ' . $csrfToken]);
    assert_http("Valid PIN change returns 200 OK", $resValidChange['code'] === 200 && $resValidChange['body']['success'] === true);

    // Verify existing event & booth data were NOT modified or dropped by PIN change
    $eventCount = (int)$db->query("SELECT COUNT(*) FROM events WHERE id='evt_demo'")->fetchColumn();
    $boothDrive = $db->query("SELECT main_drive_folder_url FROM booths WHERE id='bth_demo'")->fetchColumn();
    assert_http("Event records 100% preserved after PIN change", $eventCount === 1);
    assert_http("Booth Google Drive links 100% preserved after PIN change", $boothDrive === 'https://drive.google.com/folder/123');

    // Verify old PIN no longer works for new login
    $resOldLogin = http_req('POST', "{$baseUrl}/manage/api/auth.php?action=login", ['pin' => $initialPin]);
    assert_http("Old PIN {$initialPin} rejected after change", $resOldLogin['code'] === 401);

    // Verify new PIN logs in successfully
    $resNewLogin = http_req('POST', "{$baseUrl}/manage/api/auth.php?action=login", ['pin' => $newPin]);
    assert_http("New PIN {$newPin} logs in successfully (200 OK)", $resNewLogin['code'] === 200);

    echo "\n";

    // ---------------------------------------------------------
    // TEST 5: Logout & Post-Logout Authorization Check
    // ---------------------------------------------------------
    echo "Test 5: Logout Invalidation & Post-Logout Protection\n";

    $activeCookie = $resNewLogin['cookies']['RZ_MANAGE_SESSID'] ?? '';
    $newCsrf = $resNewLogin['body']['csrf_token'] ?? '';

    // Execute logout
    $resLogout = http_req('POST', "{$baseUrl}/manage/api/auth.php?action=logout", null, ['RZ_MANAGE_SESSID' => $activeCookie]);
    assert_http("Logout returns 200 OK", $resLogout['code'] === 200);

    // Verify that attempting change-pin using logged out session is rejected with 401
    $resPostLogout = http_req('POST', "{$baseUrl}/manage/api/change-pin.php", [
        'current_pin' => $newPin,
        'new_pin'     => '102938'
    ], ['RZ_MANAGE_SESSID' => $activeCookie], ['X-CSRF-Token: ' . $newCsrf]);
    assert_http("Request using logged-out session rejected with 401 Unauthorized", $resPostLogout['code'] === 401);

    echo "\n";

} finally {
    // Terminate local test server process
    if (is_resource($serverProcess)) {
        $pstatus = proc_get_status($serverProcess);
        if (!empty($pstatus['pid']) && strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
            exec("taskkill /F /T /PID " . (int)$pstatus['pid'] . " 2>nul");
        } else {
            proc_terminate($serverProcess);
        }
        proc_close($serverProcess);
    }
    @unlink($routerFile);
    // Cleanup temporary test data directory
    $tmpFiles = glob($testDataDir . '/*');
    foreach ($tmpFiles as $tf) {
        if (is_file($tf)) @unlink($tf);
    }
    @rmdir($testDataDir);
}

echo "========================================================\n";
echo "HTTP TEST SUITE SUMMARY: {$passed} PASSED, {$failed} FAILED\n";
echo "========================================================\n";

if ($failed === 0) {
    echo "STATUS: ALL STEP 2 HTTP SECURITY CHECKS PASSED.\n";
    exit(0);
} else {
    echo "STATUS: HTTP VERIFICATION FAILED.\n";
    exit(1);
}
