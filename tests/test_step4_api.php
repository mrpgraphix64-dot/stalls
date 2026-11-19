<?php
/**
 * Automated Verification Suite for Step 4 Backend APIs
 * 
 * Tests booth_links and booth_items endpoints:
 * - Link CRUD & categorization
 * - Strict approval safety & automatic invalidation upon Drive URL change
 * - Server-side Drive URL validation
 * - Item CRUD (Furniture, Electrical, Production, Print)
 * - Quantity validation & readiness toggle
 * - Missing booth references & unauthenticated blocks
 * - CSRF verification
 */

$testDataDir = sys_get_temp_dir() . '/rz_step4_test_' . bin2hex(random_bytes(6));
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

$routerFile = sys_get_temp_dir() . '/rz_test_router_step4.php';
file_put_contents($routerFile, $routerCode);

$port = 8897;
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

function assert_step4($desc, $cond) {
    global $passed, $failed;
    if ($cond) {
        echo "  [PASS] {$desc}\n";
        $passed++;
    } else {
        echo "  [FAIL] {$desc}\n";
        $failed++;
    }
}

function http_step4($method, $url, $data = null, $cookies = [], $headers = []) {
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
echo "REWORKZONE STALLS - STEP 4 BACKEND API TEST SUITE\n";
echo "Local Server URL: {$baseUrl}\n";
echo "========================================================\n\n";

try {
    // ---------------------------------------------------------
    // TEST 1: Unauthenticated API Access Protection
    // ---------------------------------------------------------
    echo "Test 1: Unauthenticated API Access Protection\n";
    $unauthLinks = http_step4('GET', "{$baseUrl}/manage/api/links.php?booth_id=test");
    assert_step4("GET /manage/api/links.php unauthenticated returns 401", $unauthLinks['code'] === 401);

    $unauthItems = http_step4('GET', "{$baseUrl}/manage/api/items.php?booth_id=test");
    assert_step4("GET /manage/api/items.php unauthenticated returns 401", $unauthItems['code'] === 401);

    echo "\n";

    // ---------------------------------------------------------
    // TEST 2: Initialize Master Session & Seed Event + Booth
    // ---------------------------------------------------------
    echo "Test 2: Master Account Initialization & Seed Setup\n";
    $testPin = '519284';
    $envPrefix = stripos(PHP_OS, 'WIN') === 0 ? "set REWORKZONE_DATA_DIR_OVERRIDE={$testDataDir}&& " : "REWORKZONE_DATA_DIR_OVERRIDE={$testDataDir} ";
    exec($envPrefix . "php manage/init-cli.php --pin={$testPin} 2>&1", $cliOut, $cliCode);
    assert_step4("Master account initialized via CLI", $cliCode === 0);

    $loginRes = http_step4('POST', "{$baseUrl}/manage/api/auth.php?action=login", ['pin' => $testPin]);
    $authCookie = $loginRes['cookies']['RZ_MANAGE_SESSID'] ?? '';
    $csrfToken  = $loginRes['body']['csrf_token'] ?? '';
    $cookies = ['RZ_MANAGE_SESSID' => $authCookie];
    $authHeaders = ['X-CSRF-Token: ' . $csrfToken];

    // Seed Event & Booth
    $createEvt = http_step4('POST', "{$baseUrl}/manage/api/events.php", [
        'name' => 'Auto Tech Expo 2027', 'venue' => 'BIEC', 'city' => 'Bengaluru',
        'start_date' => '2027-04-10', 'end_date' => '2027-04-14'
    ], $cookies, $authHeaders);
    $evtId = $createEvt['body']['event']['id'] ?? '';

    $createBth = http_step4('POST', "{$baseUrl}/manage/api/booths.php", [
        'event_id'              => $evtId,
        'booth_number'          => 'Hall 1 - A02',
        'client_name'           => 'Bosch Mobility',
        'main_drive_folder_url' => 'https://drive.google.com/drive/folders/sample-folder-123'
    ], $cookies, $authHeaders);
    $bthId = $createBth['body']['booth']['id'] ?? '';
    assert_step4("Seed Event & Booth created successfully", !empty($bthId));

    echo "\n";

    // ---------------------------------------------------------
    // TEST 3: Google Drive Links API & Approval Safety Rules
    // ---------------------------------------------------------
    echo "Test 3: Google Drive Links Management & Approval Safety\n";

    // Reject creation without CSRF
    $noCsrfLink = http_step4('POST', "{$baseUrl}/manage/api/links.php", [
        'booth_id' => $bthId, 'title' => '3D Render Final Angle', 'drive_url' => 'https://drive.google.com/file/d/abc'
    ], $cookies);
    assert_step4("Link creation without CSRF rejected with 403", $noCsrfLink['code'] === 403);

    // Reject creation with malformed URL
    $badUrlLink = http_step4('POST', "{$baseUrl}/manage/api/links.php", [
        'booth_id' => $bthId, 'title' => 'Working CDR', 'drive_url' => 'not-a-valid-url'
    ], $cookies, $authHeaders);
    assert_step4("Link creation with invalid URL rejected with 400", $badUrlLink['code'] === 400);

    // Reject creation for non-existent booth
    $badBoothLink = http_step4('POST', "{$baseUrl}/manage/api/links.php", [
        'booth_id' => 'bth_nonexistent', 'title' => 'Working CDR', 'drive_url' => 'https://drive.google.com/file/d/abc'
    ], $cookies, $authHeaders);
    assert_step4("Link creation for non-existent booth rejected with 400", $badBoothLink['code'] === 400);

    // Create 3D Render Link (MUST default to Draft: is_final = 0, approved_at = null)
    $createLnk1 = http_step4('POST', "{$baseUrl}/manage/api/links.php", [
        'booth_id'  => $bthId,
        'category'  => 'render_3d',
        'title'     => 'Isometric 3D Cutaway Render',
        'drive_url' => 'https://drive.google.com/file/d/render-123',
        'version'   => 'v1.0',
        'notes'     => 'Initial high-res 3ds Max render.'
    ], $cookies, $authHeaders);
    assert_step4("3D Render link created with HTTP 201", $createLnk1['code'] === 201);
    $lnk1 = $createLnk1['body']['link'] ?? [];
    $lnk1Id = $lnk1['id'] ?? '';
    assert_step4("New link strictly defaults to Draft (is_final = 0)", (int)$lnk1['is_final'] === 0);
    assert_step4("New link has approved_at = NULL", empty($lnk1['approved_at']));

    // Create Print-Ready Artwork Link
    $createLnk2 = http_step4('POST', "{$baseUrl}/manage/api/links.php", [
        'booth_id'  => $bthId,
        'category'  => 'print_ready',
        'title'     => 'Fascia Backlit Logo Artwork PDF',
        'drive_url' => 'https://drive.google.com/file/d/fascia-pdf-456',
        'version'   => 'v1.0'
    ], $cookies, $authHeaders);
    $lnk2Id = $createLnk2['body']['link']['id'] ?? '';
    assert_step4("Print-Ready link created", $createLnk2['code'] === 201);

    // List links for booth
    $listLinks = http_step4('GET', "{$baseUrl}/manage/api/links.php?booth_id={$bthId}", null, $cookies);
    assert_step4("GET links for booth returns 2 links", count($listLinks['body']['links']) === 2);

    // Filter links by category = 'render_3d'
    $filterRenders = http_step4('GET', "{$baseUrl}/manage/api/links.php?booth_id={$bthId}&category=render_3d", null, $cookies);
    assert_step4("Filtering links by category=render_3d returns 1 link", count($filterRenders['body']['links']) === 1 && $filterRenders['body']['links'][0]['id'] === $lnk1Id);

    // APPROVE Link 1 (Explicit User Action)
    $approveRes = http_step4('POST', "{$baseUrl}/manage/api/links.php?action=approve", ['id' => $lnk1Id], $cookies, $authHeaders);
    assert_step4("Explicit link approval succeeds (200 OK)", $approveRes['code'] === 200);
    $approvedLnk = $approveRes['body']['link'] ?? [];
    assert_step4("Approved link has is_final = 1", (int)$approvedLnk['is_final'] === 1);
    assert_step4("Approved link has approved_at timestamp recorded", !empty($approvedLnk['approved_at']));

    // APPROVAL SAFETY TEST: Update Title only -> Approval MUST be preserved
    $updateTitleOnly = http_step4('POST', "{$baseUrl}/manage/api/links.php?action=update", [
        'id'        => $lnk1Id,
        'title'     => 'Isometric 3D Cutaway Render (Client Approved)',
        'drive_url' => 'https://drive.google.com/file/d/render-123',
    ], $cookies, $authHeaders);
    assert_step4("Title update preserves approval status (is_final = 1)", (int)$updateTitleOnly['body']['link']['is_final'] === 1);

    // APPROVAL SAFETY TEST: Changing Drive URL MUST AUTOMATICALLY INVALIDATE APPROVAL
    $updateUrl = http_step4('POST', "{$baseUrl}/manage/api/links.php?action=update", [
        'id'        => $lnk1Id,
        'title'     => 'Isometric 3D Cutaway Render (Revised)',
        'drive_url' => 'https://drive.google.com/file/d/render-123-revised-v2', // NEW URL
        'version'   => 'v2.0'
    ], $cookies, $authHeaders);
    $revisedLnk = $updateUrl['body']['link'] ?? [];
    assert_step4("Drive URL change automatically resets is_final to 0", (int)$revisedLnk['is_final'] === 0);
    assert_step4("Drive URL change clears approved_at to NULL", empty($revisedLnk['approved_at']));

    // Test Unapprove action
    $approveAgain = http_step4('POST', "{$baseUrl}/manage/api/links.php?action=approve", ['id' => $lnk1Id], $cookies, $authHeaders);
    assert_step4("Re-approved successfully", (int)$approveAgain['body']['link']['is_final'] === 1);
    $unapproveRes = http_step4('POST', "{$baseUrl}/manage/api/links.php?action=unapprove", ['id' => $lnk1Id], $cookies, $authHeaders);
    assert_step4("Unapprove action resets is_final to 0 and clears approved_at", (int)$unapproveRes['body']['link']['is_final'] === 0 && empty($unapproveRes['body']['link']['approved_at']));

    // Delete Link 2
    $deleteLnk2 = http_step4('POST', "{$baseUrl}/manage/api/links.php?action=delete", ['id' => $lnk2Id], $cookies, $authHeaders);
    assert_step4("Delete link returns success", $deleteLnk2['code'] === 200);
    $listAfterDel = http_step4('GET', "{$baseUrl}/manage/api/links.php?booth_id={$bthId}", null, $cookies);
    assert_step4("Link 2 removed from database (1 link remaining)", count($listAfterDel['body']['links']) === 1);

    echo "\n";

    // ---------------------------------------------------------
    // TEST 4: Booth Items API (Furniture, Electrical, Production, Print)
    // ---------------------------------------------------------
    echo "Test 4: Booth Operational Items Management (Furniture, Electrical, Production, Print)\n";

    // Reject creation with quantity < 1
    $badQtyItem = http_step4('POST', "{$baseUrl}/manage/api/items.php", [
        'booth_id'  => $bthId, 'category' => 'furniture', 'item_name' => 'Bar Stool', 'quantity' => 0
    ], $cookies, $authHeaders);
    assert_step4("Item with quantity < 1 rejected with 400", $badQtyItem['code'] === 400);

    // Create Furniture Item
    $createFurn = http_step4('POST', "{$baseUrl}/manage/api/items.php", [
        'booth_id'      => $bthId,
        'category'      => 'furniture',
        'item_name'     => 'White Leather Bar Stool',
        'quantity'      => 4,
        'unit'          => 'nos',
        'specification' => 'Chrome base, adjustable height',
        'vendor_name'   => 'City Furniture Rentals',
        'unit_cost'     => 1200,
        'total_cost'    => 4800,
        'notes'         => 'For discussion counter'
    ], $cookies, $authHeaders);
    assert_step4("Furniture item created with HTTP 201", $createFurn['code'] === 201);
    $furnId = $createFurn['body']['item']['id'] ?? '';

    // Create Electrical Item
    $createElec = http_step4('POST', "{$baseUrl}/manage/api/items.php", [
        'booth_id'      => $bthId,
        'category'      => 'electrical',
        'item_name'     => '50W LED Warm White Track Spotlight',
        'quantity'      => 8,
        'unit'          => 'nos',
        'specification' => 'Track mountable, 4000K warm white',
        'vendor_name'   => 'ElectroSpark Solutions',
        'is_delivered'  => 0,
        'is_installed'  => 0
    ], $cookies, $authHeaders);
    assert_step4("Electrical item created with HTTP 201", $createElec['code'] === 201);
    $elecId = $createElec['body']['item']['id'] ?? '';

    // Create Production / Fabrication Item
    $createProd = http_step4('POST', "{$baseUrl}/manage/api/items.php", [
        'booth_id'      => $bthId,
        'category'      => 'production',
        'item_name'     => 'Main Branding Fascia (Wood + Paint Finish)',
        'quantity'      => 1,
        'unit'          => 'sets',
        'specification' => '12m x 1m pine wood frame with PU matte finish',
        'vendor_name'   => 'In-House Workshop',
        'is_delivered'  => 1,
        'is_installed'  => 0
    ], $cookies, $authHeaders);
    assert_step4("Production item created with HTTP 201", $createProd['code'] === 201);
    $prodId = $createProd['body']['item']['id'] ?? '';

    // Create Print Item
    $createPrint = http_step4('POST', "{$baseUrl}/manage/api/items.php", [
        'booth_id'      => $bthId,
        'category'      => 'print',
        'item_name'     => 'Side Wall Branding Graphic',
        'quantity'      => 2,
        'unit'          => 'sqm',
        'specification' => 'Backlit Star flex high-res print',
        'vendor_name'   => 'Grafix Print Hub'
    ], $cookies, $authHeaders);
    assert_step4("Print item created with HTTP 201", $createPrint['code'] === 201);
    $printId = $createPrint['body']['item']['id'] ?? '';

    // List all items for booth
    $allItems = http_step4('GET', "{$baseUrl}/manage/api/items.php?booth_id={$bthId}", null, $cookies);
    assert_step4("GET all items returns 4 items", count($allItems['body']['items']) === 4);

    // Filter items by category = 'furniture'
    $furnOnly = http_step4('GET', "{$baseUrl}/manage/api/items.php?booth_id={$bthId}&category=furniture", null, $cookies);
    assert_step4("Filtering items by category=furniture returns 1 item", count($furnOnly['body']['items']) === 1 && $furnOnly['body']['items'][0]['id'] === $furnId);

    // 1-Click Toggle Status (e.g. mark electrical lights installed)
    $toggleInstalled = http_step4('POST', "{$baseUrl}/manage/api/items.php?action=toggle_status", [
        'id'    => $elecId,
        'field' => 'is_installed'
    ], $cookies, $authHeaders);
    assert_step4("Toggle status sets is_installed to 1", (int)$toggleInstalled['body']['item']['is_installed'] === 1);

    // Update Furniture Item (change quantity)
    $updateFurn = http_step4('POST', "{$baseUrl}/manage/api/items.php?action=update", [
        'id'        => $furnId,
        'item_name' => 'White Leather Bar Stool (Premium)',
        'quantity'  => 6,
        'unit'      => 'nos',
        'total_cost'=> 7200
    ], $cookies, $authHeaders);
    assert_step4("Update furniture item quantity to 6 succeeds", (int)$updateFurn['body']['item']['quantity'] === 6);

    // Delete Print Item
    $deletePrint = http_step4('POST', "{$baseUrl}/manage/api/items.php?action=delete", ['id' => $printId], $cookies, $authHeaders);
    assert_step4("Delete print item returns success", $deletePrint['code'] === 200);

    $itemsAfterDel = http_step4('GET', "{$baseUrl}/manage/api/items.php?booth_id={$bthId}", null, $cookies);
    assert_step4("Items count decreased to 3 in database", count($itemsAfterDel['body']['items']) === 3);

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
echo "STEP 4 TEST SUITE SUMMARY: {$passed} PASSED, {$failed} FAILED\n";
echo "========================================================\n";

if ($failed === 0) {
    echo "STATUS: ALL STEP 4 BACKEND API CHECKS PASSED.\n";
    exit(0);
} else {
    echo "STATUS: STEP 4 BACKEND API VERIFICATION FAILED.\n";
    exit(1);
}
