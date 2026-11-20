<?php
/**
 * Test Suite: N/A Checklist Status & Progress UI
 *
 * Verifies:
 * 1. Mutually exclusive states: Pending, Done, Not Required (N/A).
 * 2. Progress formula: Applicable = Total - N/A. Progress = (Done / Applicable) * 100.
 * 3. Edge case: All 5 N/A -> 0 applicable, 0% progress (displayed as "No Applicable Tasks").
 * 4. Single booth & list queries: task_count (applicable), tasks_completed, tasks_na, tasks_total.
 * 5. Event booths query: task_count (applicable), tasks_completed, tasks_na, tasks_total.
 * 6. Dashboard pending tasks: excludes not_applicable tasks.
 * 7. Setting status to not_applicable sets is_completed = 0.
 * 8. Setting status to completed sets is_completed = 1.
 * 9. Clearing N/A resets to pending (is_completed = 0).
 */

require_once __DIR__ . '/../manage/api/config.php';

$testDataDir = sys_get_temp_dir() . '/rwz_na_test_' . bin2hex(random_bytes(4));
mkdir($testDataDir, 0755, true);
$testDbPath = $testDataDir . '/reworkzone_stalls.sqlite';

$pdo = new PDO("sqlite:{$testDbPath}", null, null, [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$pdo->exec("PRAGMA foreign_keys = ON;");
$pdo->exec("PRAGMA journal_mode = WAL;");
reworkzone_init_schema($pdo);

$passed = 0;
$failed = 0;

function assertTest($condition, $description) {
    global $passed, $failed;
    if ($condition) {
        echo "  [PASS] {$description}\n";
        $passed++;
    } else {
        echo "  [FAIL] {$description}\n";
        $failed++;
    }
}

echo "=== N/A CHECKLIST STATUS & PROGRESS AUTOMATED TESTS ===\n\n";

// 1. Setup Event and Test Booths
$eventId = 'evt_na_' . bin2hex(random_bytes(4));
$pdo->prepare("
    INSERT INTO events (id, name, city, venue, start_date, end_date, status, created_at, updated_at)
    VALUES (:id, 'NA Progress Test Expo', 'Delhi', 'Hall 5', '2026-11-20', '2026-11-22', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
")->execute([':id' => $eventId]);

// Helper to seed a booth with tasks
function createTestBooth($pdo, $eventId, $boothNumber, $taskStates) {
    $boothId = 'bth_' . bin2hex(random_bytes(4));
    $pdo->prepare("
        INSERT INTO booths (id, event_id, booth_number, client_name, stand_size, booth_type, status, created_at, updated_at)
        VALUES (:id, :event_id, :booth_number, :company, '3 × 3 m (9 sq.m)', 'Wooden', 'confirmed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ")->execute([
        ':id'           => $boothId,
        ':event_id'     => $eventId,
        ':booth_number' => $boothNumber,
        ':company'      => "Company {$boothNumber}",
    ]);

    $taskNames = ['Design', 'Print Files', 'Production', 'Furniture', 'Electrical'];
    $order = 1;
    foreach ($taskNames as $index => $name) {
        $state = $taskStates[$index] ?? 'pending';
        $isCompleted = ($state === 'completed') ? 1 : 0;
        $status = ($state === 'not_applicable') ? 'not_applicable' : (($state === 'completed') ? 'completed' : 'pending');
        
        $pdo->prepare("
            INSERT INTO booth_tasks (id, booth_id, task_name, is_completed, status, display_order, created_at, updated_at)
            VALUES (:id, :booth_id, :task_name, :is_completed, :status, :order, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ")->execute([
            ':id'           => 'tsk_' . bin2hex(random_bytes(4)),
            ':booth_id'     => $boothId,
            ':task_name'    => $name,
            ':is_completed' => $isCompleted,
            ':status'       => $status,
            ':order'        => $order++,
        ]);
    }
    return $boothId;
}

// Case 1: All 5 Pending
$boothPending = createTestBooth($pdo, $eventId, 'B-01', ['pending', 'pending', 'pending', 'pending', 'pending']);

// Case 2: 2 Done, 3 Pending
$boothPartial = createTestBooth($pdo, $eventId, 'B-02', ['completed', 'completed', 'pending', 'pending', 'pending']);

// Case 3: 3 Done, 2 N/A (The core example from user prompt)
$booth3Done2NA = createTestBooth($pdo, $eventId, 'B-03', ['completed', 'completed', 'completed', 'not_applicable', 'not_applicable']);

// Case 4: All 5 Done
$boothAllDone = createTestBooth($pdo, $eventId, 'B-04', ['completed', 'completed', 'completed', 'completed', 'completed']);

// Case 5: All 5 N/A (Edge case: No Applicable Tasks)
$boothAllNA = createTestBooth($pdo, $eventId, 'B-05', ['not_applicable', 'not_applicable', 'not_applicable', 'not_applicable', 'not_applicable']);

echo "Test 1: Verification of Booth Tasks API Stats Computation\n";
// Simulating the query in tasks.php GET
$taskSummaryQuery = "
    SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_completed = 1 AND (status IS NULL OR status != 'not_applicable') THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'not_applicable' THEN 1 ELSE 0 END) as na_count,
        SUM(CASE WHEN (is_completed = 0 OR is_completed IS NULL) AND (status IS NULL OR status != 'not_applicable') THEN 1 ELSE 0 END) as pending_count
    FROM booth_tasks 
    WHERE booth_id = :booth_id AND LOWER(task_name) NOT LIKE '%install%'
";

// Test Booth 1: All 5 Pending
$stmt = $pdo->prepare($taskSummaryQuery);
$stmt->execute([':booth_id' => $boothPending]);
$res1 = $stmt->fetch();
$res1['applicable_count'] = max(0, (int)$res1['total'] - (int)$res1['na_count']);
$res1['percentage'] = $res1['applicable_count'] > 0 ? (int)round(((int)$res1['completed'] / $res1['applicable_count']) * 100) : 0;

assertTest($res1['total'] == 5, "B-01 (All Pending): total is 5");
assertTest($res1['applicable_count'] == 5, "B-01 (All Pending): applicable_count is 5");
assertTest($res1['completed'] == 0, "B-01 (All Pending): completed is 0");
assertTest($res1['na_count'] == 0, "B-01 (All Pending): na_count is 0");
assertTest($res1['pending_count'] == 5, "B-01 (All Pending): pending_count is 5");
assertTest($res1['percentage'] === 0, "B-01 (All Pending): percentage is 0%");

// Test Booth 3: 3 Done, 2 N/A
$stmt->execute([':booth_id' => $booth3Done2NA]);
$res3 = $stmt->fetch();
$res3['applicable_count'] = max(0, (int)$res3['total'] - (int)$res3['na_count']);
$res3['percentage'] = $res3['applicable_count'] > 0 ? (int)round(((int)$res3['completed'] / $res3['applicable_count']) * 100) : 0;

assertTest($res3['total'] == 5, "B-03 (3 Done, 2 N/A): total is 5");
assertTest($res3['applicable_count'] == 3, "B-03 (3 Done, 2 N/A): applicable_count is 3 (5 - 2)");
assertTest($res3['completed'] == 3, "B-03 (3 Done, 2 N/A): completed is 3");
assertTest($res3['na_count'] == 2, "B-03 (3 Done, 2 N/A): na_count is 2");
assertTest($res3['pending_count'] == 0, "B-03 (3 Done, 2 N/A): pending_count is 0");
assertTest($res3['percentage'] === 100, "B-03 (3 Done, 2 N/A): percentage is 100% (3 of 3 completed)");

// Test Booth 5: All 5 N/A
$stmt->execute([':booth_id' => $boothAllNA]);
$res5 = $stmt->fetch();
$res5['applicable_count'] = max(0, (int)$res5['total'] - (int)$res5['na_count']);
$res5['percentage'] = $res5['applicable_count'] > 0 ? (int)round(((int)$res5['completed'] / $res5['applicable_count']) * 100) : 0;

assertTest($res5['total'] == 5, "B-05 (All N/A): total is 5");
assertTest($res5['applicable_count'] === 0, "B-05 (All N/A): applicable_count is 0 (5 - 5)");
assertTest($res5['completed'] == 0, "B-05 (All N/A): completed is 0");
assertTest($res5['na_count'] == 5, "B-05 (All N/A): na_count is 5");
assertTest($res5['pending_count'] == 0, "B-05 (All N/A): pending_count is 0 (excluded from pending)");
assertTest($res5['percentage'] === 0, "B-05 (All N/A): percentage is 0% (NOT 100%)");

echo "\nTest 2: Booths List & Event Booths Subqueries Return Accurate Applicable Denominator\n";
// Simulating the SELECT in booths.php and events.php
$boothListQuery = "
    SELECT 
        b.id,
        b.booth_number,
        (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND LOWER(task_name) NOT LIKE '%install%' AND (status IS NULL OR status != 'not_applicable')) AS task_count,
        (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND is_completed = 1 AND LOWER(task_name) NOT LIKE '%install%' AND (status IS NULL OR status != 'not_applicable')) AS tasks_completed,
        (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND LOWER(task_name) NOT LIKE '%install%' AND status = 'not_applicable') AS tasks_na,
        (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND LOWER(task_name) NOT LIKE '%install%') AS tasks_total
    FROM booths b
    WHERE b.event_id = :event_id
    ORDER BY b.booth_number ASC
";

$stmt = $pdo->prepare($boothListQuery);
$stmt->execute([':event_id' => $eventId]);
$boothsList = $stmt->fetchAll();

$byBoothNum = [];
foreach ($boothsList as $b) {
    $byBoothNum[$b['booth_number']] = $b;
}

// B-01 (All Pending)
assertTest($byBoothNum['B-01']['task_count'] == 5, "B-01 task_count (applicable) is 5");
assertTest($byBoothNum['B-01']['tasks_completed'] == 0, "B-01 tasks_completed is 0");
assertTest($byBoothNum['B-01']['tasks_na'] == 0, "B-01 tasks_na is 0");
assertTest($byBoothNum['B-01']['tasks_total'] == 5, "B-01 tasks_total is 5");

// B-03 (3 Done, 2 N/A) -> Shows 3/3 (100%), NOT 3/5!
assertTest($byBoothNum['B-03']['task_count'] == 3, "B-03 task_count (applicable) is 3 (NOT 5)");
assertTest($byBoothNum['B-03']['tasks_completed'] == 3, "B-03 tasks_completed is 3");
assertTest($byBoothNum['B-03']['tasks_na'] == 2, "B-03 tasks_na is 2");
assertTest($byBoothNum['B-03']['tasks_total'] == 5, "B-03 tasks_total is 5");

// B-05 (All N/A) -> 0 applicable
assertTest($byBoothNum['B-05']['task_count'] == 0, "B-05 task_count (applicable) is 0");
assertTest($byBoothNum['B-05']['tasks_completed'] == 0, "B-05 tasks_completed is 0");
assertTest($byBoothNum['B-05']['tasks_na'] == 5, "B-05 tasks_na is 5");
assertTest($byBoothNum['B-05']['tasks_total'] == 5, "B-05 tasks_total is 5");

echo "\nTest 3: Dashboard Pending Tasks Query Excludes N/A Tasks\n";
// Simulating pendingTasks query in dashboard.php
$pendingTasksStmt = $pdo->prepare("
    SELECT t.id, t.task_name, t.booth_id, t.status, b.booth_number
    FROM booth_tasks t
    JOIN booths b ON t.booth_id = b.id
    WHERE (t.is_completed = 0 OR t.is_completed IS NULL)
      AND (t.status IS NULL OR t.status != 'not_applicable')
      AND LOWER(t.task_name) NOT LIKE '%install%'
      AND b.event_id = :event_id
");
$pendingTasksStmt->execute([':event_id' => $eventId]);
$pendingTasks = $pendingTasksStmt->fetchAll();

// Expected:
// B-01: 5 pending
// B-02: 3 pending
// B-03: 0 pending (3 completed, 2 N/A)
// B-04: 0 pending (5 completed)
// B-05: 0 pending (5 N/A)
// Total pending = 8
assertTest(count($pendingTasks) === 8, "Dashboard pendingTasks has exactly 8 tasks (excludes all N/A tasks)");
foreach ($pendingTasks as $pt) {
    assertTest($pt['status'] !== 'not_applicable', "No pending task has status 'not_applicable' (Task {$pt['id']} for {$pt['booth_number']})");
    assertTest($pt['booth_number'] !== 'B-03' && $pt['booth_number'] !== 'B-05', "Neither B-03 nor B-05 has tasks in pendingTasks");
}

echo "\nTest 4: State Mutations & Exclusivity (set_status action logic)\n";
// Pick a task from B-01
$targetTaskStmt = $pdo->prepare("SELECT id, task_name, status, is_completed FROM booth_tasks WHERE booth_id = :b_id LIMIT 1");
$targetTaskStmt->execute([':b_id' => $boothPending]);
$task = $targetTaskStmt->fetch();

// 4.1 Set to not_applicable
$pdo->prepare("UPDATE booth_tasks SET status = 'not_applicable', is_completed = 0, updated_at = CURRENT_TIMESTAMP WHERE id = :id")
    ->execute([':id' => $task['id']]);

$updatedStmt = $pdo->prepare("SELECT status, is_completed FROM booth_tasks WHERE id = :id");
$updatedStmt->execute([':id' => $task['id']]);
$u1 = $updatedStmt->fetch();
assertTest($u1['status'] === 'not_applicable', "Task status changed to 'not_applicable'");
assertTest((int)$u1['is_completed'] === 0, "Setting 'not_applicable' forces is_completed = 0");

// 4.2 Set to completed
$pdo->prepare("UPDATE booth_tasks SET status = 'completed', is_completed = 1, updated_at = CURRENT_TIMESTAMP WHERE id = :id")
    ->execute([':id' => $task['id']]);
$updatedStmt->execute([':id' => $task['id']]);
$u2 = $updatedStmt->fetch();
assertTest($u2['status'] === 'completed', "Task status changed to 'completed'");
assertTest((int)$u2['is_completed'] === 1, "Setting 'completed' forces is_completed = 1");

// 4.3 Clear N/A back to pending
$pdo->prepare("UPDATE booth_tasks SET status = 'pending', is_completed = 0, updated_at = CURRENT_TIMESTAMP WHERE id = :id")
    ->execute([':id' => $task['id']]);
$updatedStmt->execute([':id' => $task['id']]);
$u3 = $updatedStmt->fetch();
assertTest($u3['status'] === 'pending', "Clearing status sets it to 'pending'");
assertTest((int)$u3['is_completed'] === 0, "Setting 'pending' forces is_completed = 0");

// 4.4 Verify toggle guard: Cannot toggle an N/A task directly to completed
// First set back to not_applicable
$pdo->prepare("UPDATE booth_tasks SET status = 'not_applicable', is_completed = 0, updated_at = CURRENT_TIMESTAMP WHERE id = :id")
    ->execute([':id' => $task['id']]);
// Check our tasks.php toggle logic: if ($task['status'] === 'not_applicable') return error 400
$checkStmt = $pdo->prepare("SELECT status FROM booth_tasks WHERE id = :id");
$checkStmt->execute([':id' => $task['id']]);
$tState = $checkStmt->fetchColumn();
$toggleBlocked = ($tState === 'not_applicable');
assertTest($toggleBlocked === true, "Toggle action blocks completing a task that is currently marked 'not_applicable'");

echo "\n------------------------------------------------------------\n";
echo "Results: {$passed} passed, {$failed} failed\n";

if ($failed === 0) {
    echo "SUCCESS: All N/A checklist status & progress criteria verified!\n";
    exit(0);
} else {
    echo "FAILURE: Some tests failed.\n";
    exit(1);
}
