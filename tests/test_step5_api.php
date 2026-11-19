<?php
/**
 * Automated Verification Suite for Step 5 Backend APIs
 * 
 * Tests:
 * 1. Unauthenticated API access protection (401)
 * 2. 10-step default checklist auto-seeding & idempotency
 * 3. Task completion toggle, timestamping, and progress calculation
 * 4. Custom task creation, update, and deletion
 * 5. Costing & Expenses CRUD, nonnegative validation, and variance calculations
 * 6. Server-side activity logging
 */

$testDataDir = sys_get_temp_dir() . '/rz_step5_test_' . bin2hex(random_bytes(6));
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

$routerFile = sys_get_temp_dir() . '/rz_test_router_step5.php';
file_put_contents($routerFile, $routerCode);

$port = 8895;
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

function assert_step5($desc, $cond) {
    global $passed, $failed;
    if ($cond) {
        echo "  [PASS] {$desc}\n";
        $passed++;
    } else {
        echo "  [FAIL] {$desc}\n";
        $failed++;
    }
}

function http_step5($method, $url, $data = null, $cookies = [], $headers = []) {
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
        'code'    => $httpCode,
        'body'    => $jsonBody,
        'raw'     => $bodyText,
        'cookies' => $newCookies
    ];
}

try {
    echo "========================================================\n";
    echo "REWORKZONE STALLS - STEP 5 BACKEND API TEST SUITE\n";
    echo "Local Server URL: {$baseUrl}\n";
    echo "========================================================\n\n";

    // ---------------------------------------------------------
    // TEST 1: Unauthenticated Protection
    // ---------------------------------------------------------
    echo "Test 1: Unauthenticated API Access Protection\n";
    $unauthTasks = http_step5('GET', "{$baseUrl}/manage/api/tasks.php?booth_id=dummy");
    assert_step5("GET /manage/api/tasks.php unauthenticated returns 401", $unauthTasks['code'] === 401);

    $unauthExpenses = http_step5('GET', "{$baseUrl}/manage/api/expenses.php?booth_id=dummy");
    assert_step5("GET /manage/api/expenses.php unauthenticated returns 401", $unauthExpenses['code'] === 401);

    $unauthLogs = http_step5('GET', "{$baseUrl}/manage/api/logs.php");
    assert_step5("GET /manage/api/logs.php unauthenticated returns 401", $unauthLogs['code'] === 401);

    echo "\n";

    // ---------------------------------------------------------
    // TEST 2: Initialize Master Session & Seed Event + Booth
    // ---------------------------------------------------------
    echo "Test 2: Master Account Initialization & Seed Setup\n";
    $testPin = '771829';
    $envPrefix = stripos(PHP_OS, 'WIN') === 0 ? "set REWORKZONE_DATA_DIR_OVERRIDE={$testDataDir}&& " : "REWORKZONE_DATA_DIR_OVERRIDE={$testDataDir} ";
    exec($envPrefix . "php manage/init-cli.php --pin={$testPin} 2>&1", $cliOut, $cliCode);
    assert_step5("Master account initialized via CLI", $cliCode === 0);

    $loginRes = http_step5('POST', "{$baseUrl}/manage/api/auth.php?action=login", ['pin' => $testPin]);
    $authCookie = $loginRes['cookies']['RZ_MANAGE_SESSID'] ?? '';
    $csrfToken  = $loginRes['body']['csrf_token'] ?? '';
    $cookies = ['RZ_MANAGE_SESSID' => $authCookie];
    $authHeaders = ['X-CSRF-Token: ' . $csrfToken];

    // Seed Event & Booth
    $createEvt = http_step5('POST', "{$baseUrl}/manage/api/events.php?action=create", [
        'name' => 'Plastindia Expo 2026', 'venue' => 'Pragati Maidan', 'city' => 'New Delhi',
        'start_date' => '2026-12-05', 'end_date' => '2026-12-09'
    ], $cookies, $authHeaders);
    $evtId = $createEvt['body']['event']['id'] ?? '';

    $createBth = http_step5('POST', "{$baseUrl}/manage/api/booths.php?action=create", [
        'event_id'              => $evtId,
        'booth_number'          => 'Hall 12 Stall D-05',
        'client_name'           => 'Supreme Polymers Ltd',
        'main_drive_folder_url' => 'https://drive.google.com/drive/folders/sample-folder-step5'
    ], $cookies, $authHeaders);
    $bthId = $createBth['body']['booth']['id'] ?? '';
    assert_step5("Seed Event & Booth created successfully", !empty($bthId));

    echo "\n";

    // ---------------------------------------------------------
    // TEST 3: Checklist & Tasks Management
    // ---------------------------------------------------------
    echo "Test 3: 6-Step Default Checklist Auto-Seeding & Task Actions\n";
    $tasksRes = http_step5('GET', "{$baseUrl}/manage/api/tasks.php?booth_id={$bthId}", null, $cookies);
    assert_step5("GET /manage/api/tasks.php returns 200 OK", $tasksRes['code'] === 200);
    assert_step5("Initial task list auto-seeded exactly 6 default tasks", ($tasksRes['body']['total'] ?? 0) === 6);
    assert_step5("Initial completed count is 0", ($tasksRes['body']['completed'] ?? 0) === 0);
    assert_step5("Initial progress percentage is 0.0%", ($tasksRes['body']['percentage'] ?? -1) == 0);

    $tasks = $tasksRes['body']['tasks'] ?? [];
    $firstTask = $tasks[0] ?? [];
    $firstTaskId = $firstTask['id'] ?? '';
    assert_step5("Task 1 name is 'Design'", ($firstTask['task_name'] ?? '') === 'Design');

    // Idempotency check: repeated GET must NOT create duplicate tasks
    $tasksRes2 = http_step5('GET', "{$baseUrl}/manage/api/tasks.php?booth_id={$bthId}", null, $cookies);
    assert_step5("Repeated GET is idempotent; task count remains 6", ($tasksRes2['body']['total'] ?? 0) === 6);

    // Toggle completion without CSRF
    $unauthToggle = http_step5('POST', "{$baseUrl}/manage/api/tasks.php?action=toggle", ['id' => $firstTaskId], $cookies);
    assert_step5("Task toggle without valid CSRF rejected with 403", $unauthToggle['code'] === 403);

    // Toggle completion with CSRF
    $toggleRes = http_step5('POST', "{$baseUrl}/manage/api/tasks.php?action=toggle", ['id' => $firstTaskId], $cookies, $authHeaders);
    assert_step5("Task completion toggle returns 200 OK", $toggleRes['code'] === 200);
    assert_step5("Task 1 marked completed (is_completed = 1)", ($toggleRes['body']['task']['is_completed'] ?? 0) === 1);
    assert_step5("Task completion timestamp recorded", !empty($toggleRes['body']['task']['completed_at']));
    assert_step5("Total completed tasks equals 1", ($toggleRes['body']['completed'] ?? 0) === 1);
    assert_step5("Progress percentage recalculated to 16.7%", round($toggleRes['body']['percentage'] ?? 0, 1) == 16.7);

    // Create Custom Task
    $createTaskRes = http_step5('POST', "{$baseUrl}/manage/api/tasks.php?action=create", [
        'booth_id'   => $bthId,
        'task_name'  => 'Client VIP pass clearance',
        'phase'      => 'Site Execution',
        'notes'      => 'Collect from organizer hall office',
    ], $cookies, $authHeaders);
    assert_step5("Custom task created with HTTP 201", $createTaskRes['code'] === 201);
    $customTaskId = $createTaskRes['body']['task']['id'] ?? '';

    // Check refreshed total
    $tasksRes3 = http_step5('GET', "{$baseUrl}/manage/api/tasks.php?booth_id={$bthId}", null, $cookies);
    assert_step5("Total tasks increased to 7", ($tasksRes3['body']['total'] ?? 0) === 7);

    // Update Custom Task
    $updateTaskRes = http_step5('POST', "{$baseUrl}/manage/api/tasks.php?action=update", [
        'id'        => $customTaskId,
        'task_name' => 'Client VIP pass clearance (Urgent)',
        'notes'     => 'Badges ready at Gate 4',
    ], $cookies, $authHeaders);
    assert_step5("Update custom task succeeds", $updateTaskRes['code'] === 200);
    assert_step5("Updated name persisted", ($updateTaskRes['body']['task']['task_name'] ?? '') === 'Client VIP pass clearance (Urgent)');

    // Delete Custom Task
    $delTaskRes = http_step5('POST', "{$baseUrl}/manage/api/tasks.php?action=delete", ['id' => $customTaskId], $cookies, $authHeaders);
    assert_step5("Delete custom task returns 200 OK", $delTaskRes['code'] === 200);

    $tasksRes4 = http_step5('GET', "{$baseUrl}/manage/api/tasks.php?booth_id={$bthId}", null, $cookies);
    assert_step5("Total tasks reverted to 6 after deletion", ($tasksRes4['body']['total'] ?? 0) === 6);

    echo "\n";

    // ---------------------------------------------------------
    // TEST 4: Costing & Expenses Management
    // ---------------------------------------------------------
    echo "Test 4: Booth Costing & Expenses Management\n";
    $badCost1 = http_step5('POST', "{$baseUrl}/manage/api/expenses.php?action=create", [
        'booth_id'       => $bthId,
        'category'       => 'printing',
        'description'    => 'Backlit Graphic Panel',
        'estimated_cost' => -500,
    ], $cookies, $authHeaders);
    assert_step5("Negative estimated_cost rejected with 400 Bad Request", $badCost1['code'] === 400);

    $badCost2 = http_step5('POST', "{$baseUrl}/manage/api/expenses.php?action=create", [
        'booth_id'       => $bthId,
        'category'       => 'printing',
        'description'    => 'Backlit Graphic Panel',
        'estimated_cost' => 'invalid_string',
    ], $cookies, $authHeaders);
    assert_step5("Non-numeric cost string rejected with 400 Bad Request", $badCost2['code'] === 400);

    // Create printing expense
    $exp1Res = http_step5('POST', "{$baseUrl}/manage/api/expenses.php?action=create", [
        'booth_id'       => $bthId,
        'category'       => 'printing',
        'description'    => 'Fabric Lightbox Prints (3x)',
        'estimated_cost' => 15000,
        'actual_cost'    => 14200,
        'vendor_name'    => 'Apex Printworks',
        'payment_status' => 'paid',
        'notes'          => 'Printed on UV backlit textile',
    ], $cookies, $authHeaders);
    assert_step5("Printing expense created with HTTP 201", $exp1Res['code'] === 201);
    $exp1Id = $exp1Res['body']['expense']['id'] ?? '';

    // Create structure expense
    $exp2Res = http_step5('POST', "{$baseUrl}/manage/api/expenses.php?action=create", [
        'booth_id'       => $bthId,
        'category'       => 'structure',
        'description'    => 'Wooden Platform & Arch Fabrication',
        'estimated_cost' => 60000,
        'actual_cost'    => 63500,
        'vendor_name'    => 'Rathod Workshop',
        'payment_status' => 'partial',
        'notes'          => '50% advance given',
    ], $cookies, $authHeaders);
    assert_step5("Structure expense created with HTTP 201", $exp2Res['code'] === 201);
    $exp2Id = $exp2Res['body']['expense']['id'] ?? '';

    // Fetch expenses summary
    $expSummary = http_step5('GET', "{$baseUrl}/manage/api/expenses.php?booth_id={$bthId}", null, $cookies);
    assert_step5("GET /manage/api/expenses.php returns 200 OK", $expSummary['code'] === 200);
    assert_step5("Returns 2 expense line items", ($expSummary['body']['expense_count'] ?? 0) === 2);
    assert_step5("Total estimated cost correctly equals 75000.00", ($expSummary['body']['total_estimated'] ?? 0) == 75000);
    assert_step5("Total actual cost correctly equals 77700.00", ($expSummary['body']['total_actual'] ?? 0) == 77700);
    assert_step5("Variance correctly equals +2700.00 (actual - estimated)", ($expSummary['body']['variance'] ?? 0) == 2700);

    // Update expense
    $upExp = http_step5('POST', "{$baseUrl}/manage/api/expenses.php?action=update", [
        'id'             => $exp1Id,
        'description'    => 'Fabric Lightbox Prints (3x High-Res)',
        'estimated_cost' => 15000,
        'actual_cost'    => 14000,
        'payment_status' => 'paid',
    ], $cookies, $authHeaders);
    assert_step5("Update expense succeeds with 200 OK", $upExp['code'] === 200);

    // Delete expense
    $delExp = http_step5('POST', "{$baseUrl}/manage/api/expenses.php?action=delete", ['id' => $exp2Id], $cookies, $authHeaders);
    assert_step5("Delete expense returns 200 OK", $delExp['code'] === 200);

    $expSummary2 = http_step5('GET', "{$baseUrl}/manage/api/expenses.php?booth_id={$bthId}", null, $cookies);
    assert_step5("Expense items count decreased to 1", ($expSummary2['body']['expense_count'] ?? 0) === 1);
    assert_step5("Total actual cost updated to 14000.00", ($expSummary2['body']['total_actual'] ?? 0) == 14000);

    echo "\n";

    // ---------------------------------------------------------
    // TEST 5: Activity Logging Audit Trail
    // ---------------------------------------------------------
    echo "Test 5: Activity Logging Audit Trail\n";
    $logsRes = http_step5('GET', "{$baseUrl}/manage/api/logs.php?booth_id={$bthId}", null, $cookies);
    assert_step5("GET /manage/api/logs.php returns 200 OK", $logsRes['code'] === 200);
    assert_step5("Activity logs contain entries for booth actions", ($logsRes['body']['count'] ?? 0) > 0);

    $logs = $logsRes['body']['logs'] ?? [];
    $actions = array_column($logs, 'action_type');
    assert_step5("Logs contain 'task_completed' action", in_array('task_completed', $actions));
    assert_step5("Logs contain 'expense_created' action", in_array('expense_created', $actions));

} finally {
    if (is_resource($serverProcess)) {
        proc_terminate($serverProcess);
    }
    @unlink($routerFile);
    array_map('unlink', glob("{$testDataDir}/*"));
    @rmdir($testDataDir);
}

echo "\n========================================================\n";
echo "STEP 5 TEST SUITE SUMMARY: {$passed} PASSED, {$failed} FAILED\n";
echo "========================================================\n";

if ($failed === 0) {
    echo "STATUS: ALL STEP 5 BACKEND API CHECKS PASSED.\n";
    exit(0);
} else {
    echo "STATUS: {$failed} TESTS FAILED.\n";
    exit(1);
}
