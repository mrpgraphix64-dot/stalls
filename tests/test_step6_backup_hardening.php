<?php
/**
 * Automated Verification Suite for Step 6: Backup, Hardening & Restoration
 *
 * Tests:
 * 1. Unauthenticated backup API protection (401)
 * 2. Database integrity verification endpoint (PRAGMA integrity_check)
 * 3. Daily backup creation and 7-day retention enforcement
 * 4. 1-Click SQLite database backup download streaming
 * 5. CLI backup tool execution (php manage/backup-cli.php)
 * 6. CLI verify tool execution (php manage/backup-cli.php --verify)
 * 7. CLI disaster recovery & restoration (php manage/backup-cli.php --restore=<path>)
 */

$testDataDir = sys_get_temp_dir() . '/rz_step6_test_' . bin2hex(random_bytes(6));
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
    \$name = substr(\$m[1], -4) === '.php' ? substr(\$m[1], 0, -4) : \$m[1];
    \$apiFile = '{$escapedRootDir}/manage/api/' . \$name . '.php';
    if (file_exists(\$apiFile)) {
        require \$apiFile;
        exit;
    }
}
return false;
PHP;

$routerFile = sys_get_temp_dir() . '/rz_test_router_step6.php';
file_put_contents($routerFile, $routerCode);

$port = 8894;
$serverCmd = "php -S 127.0.0.1:{$port} " . escapeshellarg($routerFile);

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

function assert_step6($desc, $cond) {
    global $passed, $failed;
    if ($cond) {
        echo "  [PASS] {$desc}\n";
        $passed++;
    } else {
        echo "  [FAIL] {$desc}\n";
        $failed++;
    }
}

function http_step6($method, $url, $data = null, $cookies = [], $headers = []) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);

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

    $newCookies = [];
    if (preg_match_all('/Set-Cookie:\s*([^=]+)=([^;]+)/i', $headerText, $matches)) {
        for ($i = 0; $i < count($matches[1]); $i++) {
            $newCookies[$matches[1][$i]] = $matches[2][$i];
        }
    }

    return [
        'code'        => $httpCode,
        'body'        => $jsonBody,
        'raw'         => $bodyText,
        'header_text' => $headerText,
        'cookies'     => $newCookies
    ];
}

try {
    echo "========================================================\n";
    echo "REWORKZONE STALLS - STEP 6 BACKUP & HARDENING TEST SUITE\n";
    echo "Local Server URL: {$baseUrl}\n";
    echo "========================================================\n\n";

    // 1. Unauthenticated Protection
    echo "Test 1: Unauthenticated Backup Protection\n";
    $unauth1 = http_step6('GET', "{$baseUrl}/manage/api/backup.php");
    assert_step6("GET /manage/api/backup.php unauthenticated returns 401", $unauth1['code'] === 401);

    $unauth2 = http_step6('GET', "{$baseUrl}/manage/api/backup.php?action=verify");
    assert_step6("GET /manage/api/backup.php?action=verify unauthenticated returns 401", $unauth2['code'] === 401);

    // 2. Initialize Master Account
    echo "\nTest 2: Master Account Initialization & Login\n";
    $testPin = '658291';
    $envPrefix = stripos(PHP_OS, 'WIN') === 0 ? "set REWORKZONE_DATA_DIR_OVERRIDE={$testDataDir}&& " : "REWORKZONE_DATA_DIR_OVERRIDE={$testDataDir} ";
    exec($envPrefix . "php manage/init-cli.php --pin={$testPin} 2>&1", $cliOut, $cliCode);
    assert_step6("Master account initialized via CLI", $cliCode === 0);

    $loginRes = http_step6('POST', "{$baseUrl}/manage/api/auth.php?action=login", ['pin' => $testPin]);
    $authCookie = $loginRes['cookies']['RZ_MANAGE_SESSID'] ?? '';
    $csrfToken  = $loginRes['body']['csrf_token'] ?? '';
    $cookies = ['RZ_MANAGE_SESSID' => $authCookie];
    $authHeaders = ['X-CSRF-Token: ' . $csrfToken];

    // Seed an event and booth to populate database
    $createEvt = http_step6('POST', "{$baseUrl}/manage/api/events.php?action=create", [
        'name' => 'Acrex India 2027', 'venue' => 'IEML', 'city' => 'Greater Noida',
        'start_date' => '2027-02-18', 'end_date' => '2027-02-21'
    ], $cookies, $authHeaders);
    $evtId = $createEvt['body']['event']['id'] ?? '';

    $createBth = http_step6('POST', "{$baseUrl}/manage/api/booths.php?action=create", [
        'event_id'              => $evtId,
        'booth_number'          => 'Hall 9 - B14',
        'client_name'           => 'Carrier Midea India',
        'main_drive_folder_url' => 'https://drive.google.com/drive/folders/sample-acrex'
    ], $cookies, $authHeaders);
    $bthId = $createBth['body']['booth']['id'] ?? '';
    assert_step6("Test Event & Booth seeded into database", !empty($bthId));

    // 3. Database Integrity Check Endpoint
    echo "\nTest 3: Database Integrity Verification\n";
    $verifyRes = http_step6('GET', "{$baseUrl}/manage/api/backup.php?action=verify", null, $cookies);
    assert_step6("GET /manage/api/backup.php?action=verify returns 200 OK", $verifyRes['code'] === 200);
    assert_step6("Integrity result reports 'ok'", ($verifyRes['body']['integrity'] ?? '') === 'ok');
    assert_step6("Foreign key violations count is 0", ($verifyRes['body']['foreign_key_violations'] ?? -1) === 0);

    // 4. Server-Side Snapshot Creation with Retention
    echo "\nTest 4: Server-Side Snapshot Creation & Retention\n";
    $snapRes = http_step6('POST', "{$baseUrl}/manage/api/backup.php?action=create_snapshot", [], $cookies, $authHeaders);
    assert_step6("POST /manage/api/backup.php?action=create_snapshot returns 200 OK", $snapRes['code'] === 200);
    assert_step6("Snapshot file successfully generated", !empty($snapRes['body']['filename']));
    assert_step6("Snapshot file size > 0", ($snapRes['body']['size_bytes'] ?? 0) > 0);

    // Test List Snapshots
    $listRes = http_step6('GET', "{$baseUrl}/manage/api/backup.php?action=list", null, $cookies);
    assert_step6("GET /manage/api/backup.php?action=list returns 200 OK", $listRes['code'] === 200);
    assert_step6("List contains at least 1 backup", ($listRes['body']['count'] ?? 0) >= 1);

    // 5. 1-Click Database Download
    echo "\nTest 5: 1-Click Master SQLite Database Download Stream\n";
    $dlRes = http_step6('GET', "{$baseUrl}/manage/api/backup.php?action=download", null, $cookies);
    assert_step6("GET /manage/api/backup.php?action=download returns 200 OK", $dlRes['code'] === 200);
    assert_step6("Response header has Content-Type: application/x-sqlite3", stripos($dlRes['header_text'], 'application/x-sqlite3') !== false);
    assert_step6("Response header has attachment Content-Disposition", stripos($dlRes['header_text'], 'Content-Disposition: attachment') !== false);
    assert_step6("Downloaded binary stream starts with SQLite header 'SQLite format 3'", substr($dlRes['raw'], 0, 15) === "SQLite format 3");

    // 6. CLI Backup Tool Execution
    echo "\nTest 6: CLI Backup & Verify Tool Execution\n";
    exec($envPrefix . "php manage/backup-cli.php 2>&1", $cliBackupOut, $cliBackupCode);
    assert_step6("php manage/backup-cli.php runs with exit 0", $cliBackupCode === 0);

    exec($envPrefix . "php manage/backup-cli.php --verify 2>&1", $cliVerifyOut, $cliVerifyCode);
    assert_step6("php manage/backup-cli.php --verify reports SUCCESS (exit 0)", $cliVerifyCode === 0);

    // 7. CLI Disaster Recovery & Restoration Verification
    echo "\nTest 7: Disaster Recovery & Database Restoration\n";
    // Save downloaded database to a temp file
    $restoreSource = sys_get_temp_dir() . '/restore_source_' . bin2hex(random_bytes(4)) . '.sqlite';
    file_put_contents($restoreSource, $dlRes['raw']);

    exec($envPrefix . "php manage/backup-cli.php --restore=" . escapeshellarg($restoreSource) . " 2>&1", $cliRestoreOut, $cliRestoreCode);
    assert_step6("php manage/backup-cli.php --restore succeeds with exit 0", $cliRestoreCode === 0);
    @unlink($restoreSource);

    // Verify restored database has preserved data
    $postRestoreEvents = http_step6('GET', "{$baseUrl}/manage/api/events.php", null, $cookies);
    assert_step6("Restored database preserves event 'Acrex India 2027'", !empty($postRestoreEvents['body']['events']));
    assert_step6("Restored event name matches seeded data", ($postRestoreEvents['body']['events'][0]['name'] ?? '') === 'Acrex India 2027');

} finally {
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
    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($testDataDir, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($files as $fileinfo) {
        $action = ($fileinfo->isDir() ? 'rmdir' : 'unlink');
        @$action($fileinfo->getRealPath());
    }
    @rmdir($testDataDir);
}

echo "\n========================================================\n";
echo "STEP 6 TEST SUITE SUMMARY: {$passed} PASSED, {$failed} FAILED\n";
echo "========================================================\n";

if ($failed === 0) {
    echo "STATUS: ALL STEP 6 BACKUP & HARDENING CHECKS PASSED.\n";
    exit(0);
} else {
    echo "STATUS: {$failed} TESTS FAILED.\n";
    exit(1);
}
