<?php
/**
 * Automated Verification Suite for Step 3 Backend APIs
 * 
 * Tests Dashboard, Events, and Booths endpoints over real HTTP:
 * - Auth enforcement
 * - CSRF verification
 * - Validation errors
 * - Relational queries (event-to-booth)
 * - Search & filter capabilities
 * - Safe archiving (non-destructive)
 * - Live real-time dashboard statistics
 */

$testDataDir = sys_get_temp_dir() . '/rz_step3_test_' . bin2hex(random_bytes(6));
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

$routerFile = sys_get_temp_dir() . '/rz_test_router_step3.php';
file_put_contents($routerFile, $routerCode);

$port = 8898;
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

function assert_step3($desc, $cond) {
    global $passed, $failed;
    if ($cond) {
        echo "  [PASS] {$desc}\n";
        $passed++;
    } else {
        echo "  [FAIL] {$desc}\n";
        $failed++;
    }
}

function http_step3($method, $url, $data = null, $cookies = [], $headers = []) {
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
echo "REWORKZONE STALLS - STEP 3 BACKEND API TEST SUITE\n";
echo "Local Server URL: {$baseUrl}\n";
echo "========================================================\n\n";

try {
    // ---------------------------------------------------------
    // TEST 1: Unauthenticated API Access Protection
    // ---------------------------------------------------------
    echo "Test 1: Unauthenticated API Access Protection\n";
    $unauthDash = http_step3('GET', "{$baseUrl}/manage/api/dashboard.php");
    assert_step3("GET /manage/api/dashboard.php unauthenticated returns 401", $unauthDash['code'] === 401);

    $unauthEvents = http_step3('GET', "{$baseUrl}/manage/api/events.php");
    assert_step3("GET /manage/api/events.php unauthenticated returns 401", $unauthEvents['code'] === 401);

    $unauthBooths = http_step3('GET', "{$baseUrl}/manage/api/booths.php");
    assert_step3("GET /manage/api/booths.php unauthenticated returns 401", $unauthBooths['code'] === 401);

    echo "\n";

    // ---------------------------------------------------------
    // TEST 2: Initialize & Authenticate Master Session
    // ---------------------------------------------------------
    echo "Test 2: Master Account Initialization & Login\n";
    $testPin = '652819';
    $envPrefix = stripos(PHP_OS, 'WIN') === 0 ? "set REWORKZONE_DATA_DIR_OVERRIDE={$testDataDir}&& " : "REWORKZONE_DATA_DIR_OVERRIDE={$testDataDir} ";
    exec($envPrefix . "php manage/init-cli.php --pin={$testPin} 2>&1", $cliOut, $cliCode);
    assert_step3("Master account initialized via CLI", $cliCode === 0);

    $loginRes = http_step3('POST', "{$baseUrl}/manage/api/auth.php?action=login", ['pin' => $testPin]);
    assert_step3("Login succeeded (200 OK)", $loginRes['code'] === 200 && $loginRes['body']['success'] === true);
    $authCookie = $loginRes['cookies']['RZ_MANAGE_SESSID'] ?? '';
    $csrfToken  = $loginRes['body']['csrf_token'] ?? '';
    assert_step3("Session cookie and CSRF token obtained", !empty($authCookie) && !empty($csrfToken));

    $cookies = ['RZ_MANAGE_SESSID' => $authCookie];
    $authHeaders = ['X-CSRF-Token: ' . $csrfToken];

    echo "\n";

    // ---------------------------------------------------------
    // TEST 3: Event Management CRUD & CSRF
    // ---------------------------------------------------------
    echo "Test 3: Event Management (Create, List, Read, Update, Archive)\n";

    // Reject POST without CSRF
    $noCsrfEvent = http_step3('POST', "{$baseUrl}/manage/api/events.php", [
        'name' => 'Auto Expo 2027', 'venue' => 'Pragati Maidan', 'city' => 'New Delhi',
        'start_date' => '2027-02-10', 'end_date' => '2027-02-14'
    ], $cookies);
    assert_step3("Event creation without CSRF rejected (403)", $noCsrfEvent['code'] === 403);

    // Reject invalid inputs (empty name)
    $badEvent = http_step3('POST', "{$baseUrl}/manage/api/events.php", [
        'name' => ' ', 'venue' => 'Pragati Maidan', 'city' => 'New Delhi',
        'start_date' => '2027-02-10', 'end_date' => '2027-02-14'
    ], $cookies, $authHeaders);
    assert_step3("Event creation with invalid name rejected (400)", $badEvent['code'] === 400);

    // Reject invalid dates (end_date < start_date)
    $badDatesEvent = http_step3('POST', "{$baseUrl}/manage/api/events.php", [
        'name' => 'Invalid Dates Expo', 'venue' => 'Pragati Maidan', 'city' => 'New Delhi',
        'start_date' => '2027-02-15', 'end_date' => '2027-02-10'
    ], $cookies, $authHeaders);
    assert_step3("Event creation with end_date earlier than start_date rejected (400)", $badDatesEvent['code'] === 400);

    // Create Event with ONLY required fields (simplified UI form)
    $createEvtSimple = http_step3('POST', "{$baseUrl}/manage/api/events.php", [
        'name'       => 'Simplified Expo 2027',
        'venue'      => 'Pragati Maidan',
        'city'       => 'New Delhi',
        'start_date' => '2027-04-10',
        'end_date'   => '2027-04-14'
    ], $cookies, $authHeaders);
    assert_step3("Event created with only required fields (201)", $createEvtSimple['code'] === 201);
    assert_step3("New event automatically assigned status 'upcoming'", ($createEvtSimple['body']['event']['status'] ?? '') === 'upcoming');
    assert_step3("New event setup_date is null (no fabricated date)", array_key_exists('setup_date', $createEvtSimple['body']['event'] ?? []) && $createEvtSimple['body']['event']['setup_date'] === null);
    assert_step3("New event dismantling_date is null (no fabricated date)", array_key_exists('dismantling_date', $createEvtSimple['body']['event'] ?? []) && $createEvtSimple['body']['event']['dismantling_date'] === null);

    // Create Event 1 (Upcoming)
    $createEvt1 = http_step3('POST', "{$baseUrl}/manage/api/events.php", [
        'name'              => 'Bharat Mobility Expo 2027',
        'venue'             => 'Bharat Mandapam',
        'city'              => 'New Delhi',
        'start_date'        => '2027-01-15',
        'end_date'          => '2027-01-19',
        'setup_date'        => '2027-01-13',
        'dismantling_date'  => '2027-01-20',
        'status'            => 'upcoming',
        'notes'             => 'Premier automotive exhibition.'
    ], $cookies, $authHeaders);
    assert_step3("Event 1 created successfully (201)", $createEvt1['code'] === 201 && !empty($createEvt1['body']['event']['id']));
    $evt1Id = $createEvt1['body']['event']['id'] ?? '';

    // Create Event 2 (Live)
    $createEvt2 = http_step3('POST', "{$baseUrl}/manage/api/events.php", [
        'name'              => 'Elecrama 2027',
        'venue'             => 'India Expo Mart',
        'city'              => 'Greater Noida',
        'start_date'        => '2027-03-01',
        'end_date'          => '2027-03-05',
        'setup_date'        => '2027-02-27',
        'dismantling_date'  => '2027-03-06',
        'status'            => 'live',
        'notes'             => 'Electrical industry expo.'
    ], $cookies, $authHeaders);
    assert_step3("Event 2 created successfully (201)", $createEvt2['code'] === 201);
    $evt2Id = $createEvt2['body']['event']['id'] ?? '';

    // List Events
    $listEvents = http_step3('GET', "{$baseUrl}/manage/api/events.php", null, $cookies);
    assert_step3("GET /manage/api/events.php returns all 3 events", $listEvents['code'] === 200 && count($listEvents['body']['events']) === 3);

    // Search Events by City
    $searchEvents = http_step3('GET', "{$baseUrl}/manage/api/events.php?search=Noida", null, $cookies);
    assert_step3("Search events by 'Noida' filters accurately", count($searchEvents['body']['events']) === 1 && $searchEvents['body']['events'][0]['id'] === $evt2Id);

    // Read Single Event
    $readEvent1 = http_step3('GET', "{$baseUrl}/manage/api/events.php?id={$evt1Id}", null, $cookies);
    assert_step3("GET single event returns details with booths array", $readEvent1['code'] === 200 && isset($readEvent1['body']['event']['booths']));

    // Update Event 1
    $updateEvt1 = http_step3('POST', "{$baseUrl}/manage/api/events.php?action=update", [
        'id'    => $evt1Id,
        'name'  => 'Bharat Mobility Global Expo 2027',
        'venue' => 'Bharat Mandapam & Yashobhoomi',
        'city'  => 'New Delhi',
        'start_date' => '2027-01-15',
        'end_date'   => '2027-01-19',
        'status'     => 'upcoming'
    ], $cookies, $authHeaders);
    assert_step3("Update event succeeds", $updateEvt1['code'] === 200 && $updateEvt1['body']['event']['name'] === 'Bharat Mobility Global Expo 2027');
    assert_step3("Update preserves existing setup_date when omitted", ($updateEvt1['body']['event']['setup_date'] ?? '') === '2027-01-13');

    // Update simple event adding optional setup_date
    $simpleEvtId = $createEvtSimple['body']['event']['id'] ?? '';
    $updateSimple = http_step3('POST', "{$baseUrl}/manage/api/events.php?action=update", [
        'id'         => $simpleEvtId,
        'setup_date' => '2027-04-08'
    ], $cookies, $authHeaders);
    assert_step3("Update event adding optional setup_date succeeds", $updateSimple['code'] === 200 && ($updateSimple['body']['event']['setup_date'] ?? '') === '2027-04-08');

    echo "\n";

    // ---------------------------------------------------------
    // TEST 4: Booth Management CRUD & Relational Integrity
    // ---------------------------------------------------------
    echo "Test 4: Booth Management (Create, Google Drive Link, List, Filter, Update)\n";

    // Create Booth under non-existent event -> MUST FAIL (400)
    $badBoothEvt = http_step3('POST', "{$baseUrl}/manage/api/booths.php", [
        'event_id'     => 'evt_nonexistent',
        'booth_number' => 'A-01',
        'client_name'  => 'Tata Motors'
    ], $cookies, $authHeaders);
    assert_step3("Booth with invalid event_id rejected (400)", $badBoothEvt['code'] === 400);

    // Create Booth with invalid Drive URL -> MUST FAIL (400)
    $badBoothUrl = http_step3('POST', "{$baseUrl}/manage/api/booths.php", [
        'event_id'              => $evt1Id,
        'booth_number'          => 'A-01',
        'client_name'           => 'Tata Motors',
        'main_drive_folder_url' => 'not-a-valid-url'
    ], $cookies, $authHeaders);
    assert_step3("Booth with malformed Google Drive URL rejected (400)", $badBoothUrl['code'] === 400);

    // Create Booth 1 under Event 1
    $createBth1 = http_step3('POST', "{$baseUrl}/manage/api/booths.php", [
        'event_id'              => $evt1Id,
        'booth_number'          => 'Hall 2 - B01',
        'client_name'           => 'Tata Motors EV',
        'contact_person'        => 'Rajesh Sharma',
        'phone'                 => '+91 98765 43210',
        'email'                 => 'rajesh@tatamotors.com',
        'stand_size'            => '12x8m (96 sqm)',
        'booth_type'            => 'Custom Stall',
        'budget'                => 450000,
        'quoted_amount'         => 600000,
        'main_drive_folder_url' => 'https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ',
        'status'                => 'in_production',
        'notes'                 => 'Requires 3-side open island structure with LED video wall.'
    ], $cookies, $authHeaders);
    assert_step3("Booth 1 created successfully with Google Drive URL (201)", $createBth1['code'] === 201 && !empty($createBth1['body']['booth']['id']));
    $bth1Id = $createBth1['body']['booth']['id'] ?? '';

    // Create Booth 2 under Event 1
    $createBth2 = http_step3('POST', "{$baseUrl}/manage/api/booths.php", [
        'event_id'              => $evt1Id,
        'booth_number'          => 'Hall 2 - B04',
        'client_name'           => 'Mahindra Electric',
        'stand_size'            => '6x6m (36 sqm)',
        'status'                => 'draft'
    ], $cookies, $authHeaders);
    assert_step3("Booth 2 created under Event 1", $createBth2['code'] === 201);
    $bth2Id = $createBth2['body']['booth']['id'] ?? '';

    // Create Booth 3 under Event 2
    $createBth3 = http_step3('POST', "{$baseUrl}/manage/api/booths.php", [
        'event_id'              => $evt2Id,
        'booth_number'          => 'Hall 5 - E12',
        'client_name'           => 'Schneider Electric',
        'stand_size'            => '9x6m (54 sqm)',
        'status'                => 'in_production'
    ], $cookies, $authHeaders);
    assert_step3("Booth 3 created under Event 2", $createBth3['code'] === 201);
    $bth3Id = $createBth3['body']['booth']['id'] ?? '';

    // Verify Event 1 now reflects booth_count = 2
    $event1Updated = http_step3('GET', "{$baseUrl}/manage/api/events.php?id={$evt1Id}", null, $cookies);
    assert_step3("Event 1 reflects 2 child booths", (int)$event1Updated['body']['event']['booth_count'] === 2 && count($event1Updated['body']['event']['booths']) === 2);

    // List Booths filtered by Event 1
    $event1Booths = http_step3('GET', "{$baseUrl}/manage/api/booths.php?event_id={$evt1Id}", null, $cookies);
    assert_step3("Filtering booths by event_id={$evt1Id} returns 2 booths", count($event1Booths['body']['booths']) === 2);

    // List Booths filtered by Status = in_production
    $prodBooths = http_step3('GET', "{$baseUrl}/manage/api/booths.php?status=in_production", null, $cookies);
    assert_step3("Filtering booths by status=in_production returns 2 booths across events", count($prodBooths['body']['booths']) === 2);

    // Search Booths by Client Name
    $searchBooths = http_step3('GET', "{$baseUrl}/manage/api/booths.php?search=Mahindra", null, $cookies);
    assert_step3("Search booths by 'Mahindra' matches 1 booth", count($searchBooths['body']['booths']) === 1 && $searchBooths['body']['booths'][0]['id'] === $bth2Id);

    // Read Single Booth: verify joined event data
    $singleBooth = http_step3('GET', "{$baseUrl}/manage/api/booths.php?id={$bth1Id}", null, $cookies);
    assert_step3("Single booth detail includes joined event name", $singleBooth['body']['booth']['event_name'] === 'Bharat Mobility Global Expo 2027');
    assert_step3("Single booth includes Main Google Drive URL", $singleBooth['body']['booth']['main_drive_folder_url'] === 'https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ');

    // Update Booth 1
    $updateBth1 = http_step3('POST', "{$baseUrl}/manage/api/booths.php?action=update", [
        'id'            => $bth1Id,
        'client_name'   => 'Tata Motors Commercial Vehicles',
        'stand_size'    => '14x8m (112 sqm)',
        'status'        => 'approved'
    ], $cookies, $authHeaders);
    assert_step3("Update booth details succeeds", $updateBth1['code'] === 200 && $updateBth1['body']['booth']['client_name'] === 'Tata Motors Commercial Vehicles');

    echo "\n";

    // ---------------------------------------------------------
    // TEST 5: Real-Time Live Dashboard Statistics
    // ---------------------------------------------------------
    echo "Test 5: Live Dashboard Aggregations (Real SQLite Data)\n";
    $dashRes = http_step3('GET', "{$baseUrl}/manage/api/dashboard.php", null, $cookies);
    assert_step3("GET /manage/api/dashboard.php returns 200 OK", $dashRes['code'] === 200);

    $stats = $dashRes['body']['data'] ?? [];
    assert_step3("total_events equals 3", ($stats['total_events'] ?? null) === 3);
    assert_step3("active_events equals 3", ($stats['active_events'] ?? null) === 3);
    assert_step3("total_booths equals 3", ($stats['total_booths'] ?? null) === 3);
    // booths in production includes in_production (1) + approved (1) = 2
    assert_step3("booths_in_production equals 2", ($stats['booths_in_production'] ?? null) === 2);
    assert_step3("recent_booths list contains 3 entries with event details", count($stats['recent_booths'] ?? []) === 3);
    assert_step3("upcoming_events list contains 3 events with booth counts", count($stats['upcoming_events'] ?? []) === 3);

    echo "\n";

    // ---------------------------------------------------------
    // TEST 6: Safe Archiving (Non-Destructive)
    // ---------------------------------------------------------
    echo "Test 6: Safe Archiving (Non-Destructive Database Persistence)\n";

    // Archive Booth 2
    $archiveBth = http_step3('POST', "{$baseUrl}/manage/api/booths.php?action=archive", ['id' => $bth2Id], $cookies, $authHeaders);
    assert_step3("Archive booth returns success", $archiveBth['code'] === 200 && $archiveBth['body']['success'] === true);

    // Verify row still exists in DB with status = 'archived'
    $dbFile = $testDataDir . '/reworkzone_stalls.sqlite';
    $db = new PDO("sqlite:{$dbFile}");
    $archivedStatus = $db->query("SELECT status FROM booths WHERE id='{$bth2Id}'")->fetchColumn();
    assert_step3("Archived booth persisted in database with status='archived'", $archivedStatus === 'archived');

    // Default booth listing excludes archived booths
    $activeBoothsList = http_step3('GET', "{$baseUrl}/manage/api/booths.php", null, $cookies);
    assert_step3("Default booth listing now excludes archived booth (2 remaining)", count($activeBoothsList['body']['booths']) === 2);

    // Dashboard total_booths now reflects active count (2)
    $dashAfterArchive = http_step3('GET', "{$baseUrl}/manage/api/dashboard.php", null, $cookies);
    assert_step3("Dashboard reflects updated active booth count (2)", $dashAfterArchive['body']['data']['total_booths'] === 2);

    echo "\n";

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
    $tmpFiles = glob($testDataDir . '/*');
    foreach ($tmpFiles as $tf) {
        if (is_file($tf)) @unlink($tf);
    }
    @rmdir($testDataDir);
}

echo "========================================================\n";
echo "STEP 3 TEST SUITE SUMMARY: {$passed} PASSED, {$failed} FAILED\n";
echo "========================================================\n";

if ($failed === 0) {
    echo "STATUS: ALL STEP 3 BACKEND API CHECKS PASSED.\n";
    exit(0);
} else {
    echo "STATUS: STEP 3 BACKEND API VERIFICATION FAILED.\n";
    exit(1);
}
