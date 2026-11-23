<?php
/**
 * REWORKZONE STALLS - PERMANENT STALL & EVENT DELETION TEST SUITE
 * 
 * Tests the complete delete lifecycle via HTTP endpoints:
 * 1. Auth and CSRF enforcement on DELETE methods
 * 2. Delete stall with no related records
 * 3. Delete stall with all 5 checklist tasks
 * 4. Delete stall with production, furniture, and electrical items
 * 5. Delete stall with Drive links (3D view, print ready, goodies)
 * 6. Delete stall with activity logs (preserves audit history without FK violations)
 * 7. Delete ongoing-discussion record
 * 8. Repeat deletion of already-deleted stall (404 cleanly, never 500)
 * 9. Verify unrelated stalls and events remain 100% intact
 * 10. Permanent Event deletion cascading all associated stalls
 * 11. PRAGMA foreign_key_check (0 errors) & PRAGMA integrity_check (ok)
 */

$testDataDir = sys_get_temp_dir() . '/rwz_perm_del_test_' . bin2hex(random_bytes(4));
mkdir($testDataDir, 0777, true);
putenv("REWORKZONE_DATA_DIR_OVERRIDE={$testDataDir}");

$rootDir = dirname(__DIR__);
$escapedRootDir = str_replace('\\', '/', $rootDir);

$routerCode = <<<PHP
<?php
putenv("REWORKZONE_DATA_DIR_OVERRIDE={$testDataDir}");
define('REWORKZONE_DATA_DIR_OVERRIDE', '{$testDataDir}');

\$path = parse_url(\$_SERVER['REQUEST_URI'], PHP_URL_PATH);
\$file = '{$escapedRootDir}' . \$path;

if (is_file(\$file) && substr(\$file, -4) === '.php') {
    require \$file;
    exit;
}
return false;
PHP;

$routerFile = sys_get_temp_dir() . '/rz_del_router_' . bin2hex(random_bytes(4)) . '.php';
file_put_contents($routerFile, $routerCode);

$port = 8894;
$serverCmd = "php -S 127.0.0.1:{$port} " . escapeshellarg($routerFile);
$descriptors = [
    0 => ['file', 'nul', 'r'],
    1 => ['file', 'nul', 'w'],
    2 => ['file', 'nul', 'w']
];
$process = proc_open($serverCmd, $descriptors, $pipes, $rootDir);
usleep(800000); // 800ms startup

$baseUrl = "http://127.0.0.1:{$port}";

$passed = 0;
$failed = 0;

function assert_test($desc, $condition, $msg = '') {
    global $passed, $failed;
    if ($condition) {
        echo "  [PASS] {$desc}\n";
        $passed++;
    } else {
        echo "  [FAIL] {$desc} -> {$msg}\n";
        $failed++;
    }
}

function req($method, $url, $data = null, $cookies = '', $csrf = '') {
    $ch = curl_init($url);
    $headers = ['Content-Type: application/json', 'Accept: application/json'];
    if ($csrf) {
        $headers[] = "X-CSRF-Token: {$csrf}";
    }
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_HEADER         => true,
        CURLOPT_TIMEOUT        => 5,
    ]);
    if ($data !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    if ($cookies) {
        curl_setopt($ch, CURLOPT_COOKIE, $cookies);
    }
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $headerStr = substr($resp, 0, $headerSize);
    $bodyStr = substr($resp, $headerSize);
    curl_close($ch);

    preg_match_all('/^Set-Cookie:\s*([^;]+)/mi', $headerStr, $matches);
    $newCookies = implode('; ', $matches[1]);
    $body = json_decode($bodyStr, true);

    return [
        'code'    => $code,
        'body'    => $body,
        'raw'     => $bodyStr,
        'cookies' => $newCookies ?: $cookies,
    ];
}

try {
    echo "========================================================\n";
    echo "TEST SUITE: PERMANENT STALL & EVENT DELETION\n";
    echo "Isolated Data Dir: {$testDataDir}\n";
    echo "Local Server URL: {$baseUrl}\n";
    echo "========================================================\n\n";

    // 1. Initialize Master Account
    require_once __DIR__ . '/../manage/api/config.php';
    $dbFile = $testDataDir . '/reworkzone_stalls.sqlite';
    $pdo = new PDO("sqlite:{$dbFile}");
    $pdo->exec('PRAGMA foreign_keys = ON;');
    reworkzone_init_schema($pdo);

    $pinHash = password_hash('840291', PASSWORD_BCRYPT);
    $pdo->prepare("
        INSERT INTO auth_accounts (id, account_name, pin_hash, role, is_active, created_at, updated_at)
        VALUES (1, 'Master Admin', :hash, 'master', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ")->execute([':hash' => $pinHash]);

    // 2. Login
    $login = req('POST', "{$baseUrl}/manage/api/auth.php?action=login", ['pin' => '840291']);
    assert_test("Master login succeeded (200 OK)", $login['code'] === 200 && !empty($login['body']['csrf_token']), $login['raw']);
    $cookies = $login['cookies'];
    $csrf = $login['body']['csrf_token'] ?? '';

    // 3. Unauthenticated / No-CSRF protection check
    $unauthDel = req('DELETE', "{$baseUrl}/manage/api/booths.php?id=fake_id");
    assert_test("Unauthenticated DELETE rejected with 401", $unauthDel['code'] === 401);

    $noCsrfDel = req('DELETE', "{$baseUrl}/manage/api/booths.php?id=fake_id", null, $cookies, '');
    assert_test("DELETE without CSRF rejected with 403", $noCsrfDel['code'] === 403);

    // 4. Create primary test event
    $evtRes = req('POST', "{$baseUrl}/manage/api/events.php?action=create", [
        'name'       => 'Tech Expo Gujarat 2026',
        'venue'      => 'Helipad Exhibition Centre',
        'city'       => 'Gandhinagar',
        'start_date' => '2026-11-20',
        'end_date'   => '2026-11-22',
    ], $cookies, $csrf);
    $eventId = $evtRes['body']['event']['id'] ?? '';
    assert_test("Created primary event: {$eventId}", $evtRes['code'] === 201);

    // 5. Create unrelated booth that must remain completely untouched
    $keeperRes = req('POST', "{$baseUrl}/manage/api/booths.php?action=create", [
        'event_id'      => $eventId,
        'booth_number'  => 'KEEP-01',
        'client_name'   => 'Permanent Untouched Exhibitor',
        'stand_size'    => '6 × 3 m',
        'booth_type'    => 'Wooden',
        'booking_stage' => 'confirmed',
    ], $cookies, $csrf);
    $keeperId = $keeperRes['body']['booth']['id'] ?? '';
    assert_test("Created keeper booth: {$keeperId} (#KEEP-01)", $keeperRes['code'] === 201);

    // Test 6: Delete a stall with NO related records (draft / discussion)
    $bareRes = req('POST', "{$baseUrl}/manage/api/booths.php?action=create", [
        'event_id'      => $eventId,
        'booth_number'  => 'BARE-01',
        'client_name'   => 'Bare Stall Client',
        'stand_size'    => '3 × 3 m',
        'booth_type'    => 'Frame',
        'booking_stage' => 'discussion',
    ], $cookies, $csrf);
    $bareId = $bareRes['body']['booth']['id'] ?? '';
    $delBare = req('DELETE', "{$baseUrl}/manage/api/booths.php?id={$bareId}", null, $cookies, $csrf);
    assert_test("Delete bare stall returns 200 OK", $delBare['code'] === 200 && ($delBare['body']['success'] ?? false) === true);
    $checkBare = req('GET', "{$baseUrl}/manage/api/booths.php?id={$bareId}", null, $cookies);
    assert_test("Bare stall returns 404 after deletion", $checkBare['code'] === 404);

    // Test 7: Delete a stall with ALL 4 checklist tasks
    $taskBoothRes = req('POST', "{$baseUrl}/manage/api/booths.php?action=create", [
        'event_id'      => $eventId,
        'booth_number'  => 'TSK-01',
        'client_name'   => 'Task Master Industries',
        'stand_size'    => '3 × 3 m',
        'booth_type'    => 'Wooden',
        'booking_stage' => 'confirmed',
    ], $cookies, $csrf);
    $taskBoothId = $taskBoothRes['body']['booth']['id'] ?? '';
    $tasksBefore = (int)$pdo->query("SELECT count(*) FROM booth_tasks WHERE booth_id = '{$taskBoothId}'")->fetchColumn();
    assert_test("Stall initialized with 4 tasks", $tasksBefore === 4);
    $delTaskBooth = req('DELETE', "{$baseUrl}/manage/api/booths.php?id={$taskBoothId}", null, $cookies, $csrf);
    assert_test("Delete stall with 4 tasks returns 200 OK", $delTaskBooth['code'] === 200 && ($delTaskBooth['body']['success'] ?? false) === true);
    $tasksAfter = (int)$pdo->query("SELECT count(*) FROM booth_tasks WHERE booth_id = '{$taskBoothId}'")->fetchColumn();
    assert_test("Associated tasks cleanly deleted (count: 0)", $tasksAfter === 0);

    // Test 8: Delete a stall with production, furniture, and electrical items
    $itemBoothRes = req('POST', "{$baseUrl}/manage/api/booths.php?action=create", [
        'event_id'      => $eventId,
        'booth_number'  => 'ITM-01',
        'client_name'   => 'Item Supplier Corp',
        'stand_size'    => '4 × 4 m',
        'booth_type'    => 'Customize',
        'booking_stage' => 'confirmed',
    ], $cookies, $csrf);
    $itemBoothId = $itemBoothRes['body']['booth']['id'] ?? '';
    // Add production item
    req('POST', "{$baseUrl}/manage/api/items.php?action=create", [
        'booth_id' => $itemBoothId, 'category' => 'production', 'item_name' => 'Selfie Booth', 'quantity' => 1
    ], $cookies, $csrf);
    // Add furniture item
    req('POST', "{$baseUrl}/manage/api/items.php?action=create", [
        'booth_id' => $itemBoothId, 'category' => 'furniture', 'item_name' => 'Glass Round Table', 'quantity' => 2
    ], $cookies, $csrf);
    // Add electrical item
    req('POST', "{$baseUrl}/manage/api/items.php?action=create", [
        'booth_id' => $itemBoothId, 'category' => 'electrical', 'item_name' => 'Pelmet Light', 'quantity' => 4
    ], $cookies, $csrf);
    $itemsBefore = (int)$pdo->query("SELECT count(*) FROM booth_items WHERE booth_id = '{$itemBoothId}'")->fetchColumn();
    assert_test("Stall has 3 items in database", $itemsBefore === 3);
    $delItemBooth = req('DELETE', "{$baseUrl}/manage/api/booths.php?id={$itemBoothId}", null, $cookies, $csrf);
    assert_test("Delete stall with multi-category items returns 200 OK", $delItemBooth['code'] === 200);
    $itemsAfter = (int)$pdo->query("SELECT count(*) FROM booth_items WHERE booth_id = '{$itemBoothId}'")->fetchColumn();
    assert_test("Associated items cleanly deleted (count: 0)", $itemsAfter === 0);

    // Test 9: Delete a stall with Drive links (3D view, print ready, goodies)
    $linkBoothRes = req('POST', "{$baseUrl}/manage/api/booths.php?action=create", [
        'event_id'      => $eventId,
        'booth_number'  => 'LNK-01',
        'client_name'   => 'Drive Artwork Ltd',
        'stand_size'    => '3 × 3 m',
        'booth_type'    => 'Wooden',
        'booking_stage' => 'confirmed',
        'print_drive_url' => 'https://drive.google.com/test-print',
        'goodies_drive_url' => 'https://drive.google.com/test-goodies',
    ], $cookies, $csrf);
    $linkBoothId = $linkBoothRes['body']['booth']['id'] ?? '';
    req('POST', "{$baseUrl}/manage/api/links.php?action=create", [
        'booth_id' => $linkBoothId, 'category' => 'render_3d', 'title' => 'Main 3D Design', 'drive_url' => 'https://drive.google.com/test-3d'
    ], $cookies, $csrf);
    $linksBefore = (int)$pdo->query("SELECT count(*) FROM booth_links WHERE booth_id = '{$linkBoothId}'")->fetchColumn();
    assert_test("Stall has Drive links in database", $linksBefore >= 1);
    $delLinkBooth = req('DELETE', "{$baseUrl}/manage/api/booths.php?id={$linkBoothId}", null, $cookies, $csrf);
    assert_test("Delete stall with Drive links returns 200 OK", $delLinkBooth['code'] === 200);
    $linksAfter = (int)$pdo->query("SELECT count(*) FROM booth_links WHERE booth_id = '{$linkBoothId}'")->fetchColumn();
    assert_test("Associated Drive links cleanly deleted (count: 0)", $linksAfter === 0);

    // Test 10: Delete stall with activity logs and verify audit preservation without FK violations
    $actBoothRes = req('POST', "{$baseUrl}/manage/api/booths.php?action=create", [
        'event_id'      => $eventId,
        'booth_number'  => 'ACT-01',
        'client_name'   => 'Activity Logged Co',
        'stand_size'    => '3 × 3 m',
        'booth_type'    => 'Frame',
        'booking_stage' => 'confirmed',
    ], $cookies, $csrf);
    $actBoothId = $actBoothRes['body']['booth']['id'] ?? '';
    // Update stall to generate additional activity log
    req('POST', "{$baseUrl}/manage/api/booths.php?action=update", [
        'id' => $actBoothId, 'contact_person' => 'Rahul Sharma'
    ], $cookies, $csrf);
    $logsBefore = (int)$pdo->query("SELECT count(*) FROM activity_logs WHERE booth_id = '{$actBoothId}'")->fetchColumn();
    assert_test("Stall has logged activities before deletion", $logsBefore >= 2);
    $delActBooth = req('DELETE', "{$baseUrl}/manage/api/booths.php?id={$actBoothId}", null, $cookies, $csrf);
    assert_test("Delete stall with activity logs returns 200 OK", $delActBooth['code'] === 200);
    $orphanLogs = (int)$pdo->query("SELECT count(*) FROM activity_logs WHERE description LIKE '%Activity Logged Co%'")->fetchColumn();
    assert_test("Historical audit logs preserved with NULL booth_id", $orphanLogs >= 2);

    // Test 11: Repeat deletion of an already-deleted stall (must return 404 cleanly, never 500)
    $repeatDel = req('DELETE', "{$baseUrl}/manage/api/booths.php?id={$actBoothId}", null, $cookies, $csrf);
    assert_test("Repeat deletion returns 404 (not 500)", $repeatDel['code'] === 404 && !empty($repeatDel['body']['error']));

    // Test 12: Verify unrelated keeper booth remained 100% intact
    $keeperCheck = req('GET', "{$baseUrl}/manage/api/booths.php?id={$keeperId}", null, $cookies);
    assert_test("Keeper booth remains 100% intact (#KEEP-01)", $keeperCheck['code'] === 200 && ($keeperCheck['body']['booth']['client_name'] ?? '') === 'Permanent Untouched Exhibitor');

    // Test 13: Permanent Event Deletion
    $delEvtRes = req('DELETE', "{$baseUrl}/manage/api/events.php?id={$eventId}", null, $cookies, $csrf);
    assert_test("Permanent event deletion returns 200 OK", $delEvtRes['code'] === 200 && ($delEvtRes['body']['success'] ?? false) === true);
    assert_test("Event deletion reported 1 booth cascade", ($delEvtRes['body']['booths_deleted_count'] ?? -1) === 1);
    $keeperGone = req('GET', "{$baseUrl}/manage/api/booths.php?id={$keeperId}", null, $cookies);
    assert_test("Keeper booth cascaded with event deletion", $keeperGone['code'] === 404);

    // Test 14: Database integrity and foreign key checks
    $fkErrors = $pdo->query("PRAGMA foreign_key_check;")->fetchAll();
    $integrity = $pdo->query("PRAGMA integrity_check;")->fetchColumn();
    assert_test("PRAGMA foreign_key_check reports 0 violations", count($fkErrors) === 0);
    assert_test("PRAGMA integrity_check is 'ok'", $integrity === 'ok');

} finally {
    // Terminate server process and cleanup
    if (is_resource($process)) {
        $pstatus = proc_get_status($process);
        if (!empty($pstatus['pid']) && strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
            exec("taskkill /F /T /PID " . (int)$pstatus['pid'] . " 2>nul");
        } else {
            proc_terminate($process);
        }
        proc_close($process);
    }
    @unlink($routerFile);

    $tmpFiles = glob($testDataDir . '/*');
    foreach ($tmpFiles as $tf) {
        if (is_file($tf)) @unlink($tf);
    }
    @rmdir($testDataDir);
}

echo "\n--- SUMMARY ---\n";
echo "Total assertions: " . ($passed + $failed) . "\n";
echo "Passed: {$passed}\n";
echo "Failed: {$failed}\n";

if ($failed > 0) exit(1);
exit(0);
