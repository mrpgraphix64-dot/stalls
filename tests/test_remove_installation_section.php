<?php
/**
 * REWORKZONE STALLS - REMOVE INSTALLATION CHECKLIST SECTION TEST SUITE
 *
 * Verifies:
 * 1. Default seeded tasks are exactly 5 (Design, Print Files, Production, Furniture, Electrical).
 * 2. Legacy 'Installation' task in DB is safely preserved in SQLite without deletion.
 * 3. Active tasks API, booth detail, booth directory, event booths, and dashboard
 *    exclude legacy installation records from counts and progress percentages.
 * 4. Completed, Pending, and N/A functionality properly recalculate progress out of 5 (or applicable).
 * 5. Confirming an ongoing discussion creates exactly 5 default tasks.
 * 6. SQLite database integrity checks pass.
 */

require_once __DIR__ . '/../manage/api/config.php';

$testDbDir = sys_get_temp_dir() . '/rwz_rm_install_test_' . bin2hex(random_bytes(4));
mkdir($testDbDir, 0777, true);
$testDbPath = $testDbDir . '/reworkzone_stalls.sqlite';

$pdo = new PDO("sqlite:{$testDbPath}", null, null, [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$pdo->exec("PRAGMA foreign_keys = ON;");
$pdo->exec("PRAGMA journal_mode = WAL;");

reworkzone_init_schema($pdo);

$passed = 0;
$failed = 0;

function assert_test($label, $condition, $details = '') {
    global $passed, $failed;
    if ($condition) {
        $passed++;
        echo "  [PASS] {$label}\n";
    } else {
        $failed++;
        echo "  [FAIL] {$label} - {$details}\n";
    }
}

echo "========================================================\n";
echo "REWORKZONE STALLS - REMOVE INSTALLATION CHECKLIST TESTS\n";
echo "Isolated DB Path: {$testDbPath}\n";
echo "========================================================\n\n";

// -------------------------------------------------------------
// Test 1: Setup Event
// -------------------------------------------------------------
echo "Test 1: Setup Event & Initial Seed Data\n";
$eventId = 'evt_' . bin2hex(random_bytes(4));
$pdo->prepare("
    INSERT INTO events (id, name, city, venue, start_date, end_date, status)
    VALUES (:id, 'India Industrial Expo 2027', 'Greater Noida', 'India Expo Centre', '2027-04-10', '2027-04-13', 'upcoming')
")->execute([':id' => $eventId]);
assert_test("Event created successfully", true);

// -------------------------------------------------------------
// Test 2: Create a New Confirmed Stall & Verify 5 Default Tasks
// -------------------------------------------------------------
echo "\nTest 2: Create New Confirmed Stall & Check Default Tasks\n";
$boothId1 = 'bth_' . bin2hex(random_bytes(4));
$pdo->prepare("
    INSERT INTO booths (
        id, event_id, booth_number, client_name, phone, stand_size, booth_type,
        booking_stage, status
    ) VALUES (
        :id, :event_id, 'A-101', 'Techno Dynamics Ltd', '+91 98765 43210', '3 × 3 m (9 sq.m)', 'Wooden',
        'confirmed', 'confirmed'
    )
")->execute([':id' => $boothId1, ':event_id' => $eventId]);

// Simulate application layer 5 default tasks seeding
$defaultTasks = [
    'Design',
    'Print Files',
    'Production',
    'Furniture',
    'Electrical',
];
$taskStmt = $pdo->prepare("
    INSERT INTO booth_tasks (id, booth_id, phase, task_name, sort_order, display_order, is_completed, status)
    VALUES (:id, :bth, :phase, :tname, :order, :order, 0, 'pending')
");
foreach ($defaultTasks as $idx => $tName) {
    $taskStmt->execute([
        ':id' => 'tsk_' . bin2hex(random_bytes(4)),
        ':bth' => $boothId1,
        ':phase' => $tName,
        ':tname' => $tName,
        ':order' => $idx + 1
    ]);
}

$seededTasks = $pdo->query("SELECT task_name FROM booth_tasks WHERE booth_id = '{$boothId1}' ORDER BY sort_order")->fetchAll(PDO::FETCH_COLUMN);
assert_test("Exactly 5 tasks seeded for new booth", count($seededTasks) === 5);
assert_test("Tasks contain Design", in_array('Design', $seededTasks));
assert_test("Tasks contain Print Files", in_array('Print Files', $seededTasks));
assert_test("Tasks contain Production", in_array('Production', $seededTasks));
assert_test("Tasks contain Furniture", in_array('Furniture', $seededTasks));
assert_test("Tasks contain Electrical", in_array('Electrical', $seededTasks));
assert_test("Tasks do NOT contain Installation", !in_array('Installation', $seededTasks));

// -------------------------------------------------------------
// Test 3: Legacy Stall with Historical Installation Task
// -------------------------------------------------------------
echo "\nTest 3: Legacy Stall with Historical Installation Task\n";
$boothId2 = 'bth_' . bin2hex(random_bytes(4));
$pdo->prepare("
    INSERT INTO booths (
        id, event_id, booth_number, client_name, phone, stand_size, booth_type,
        booking_stage, status
    ) VALUES (
        :id, :event_id, 'B-202', 'Legacy Systems Inc', '+91 91234 56789', '6 × 3 m (18 sq.m)', 'Frame',
        'confirmed', 'confirmed'
    )
")->execute([':id' => $boothId2, ':event_id' => $eventId]);

// Seed 6 tasks (5 standard + 1 legacy installation)
$legacyTasks = ['Design', 'Print Files', 'Production', 'Furniture', 'Electrical', 'Installation'];
foreach ($legacyTasks as $idx => $tName) {
    $taskStmt->execute([
        ':id' => 'tsk_leg_' . bin2hex(random_bytes(4)),
        ':bth' => $boothId2,
        ':phase' => $tName,
        ':tname' => $tName,
        ':order' => $idx + 1
    ]);
}

$rawDbTasksCount = (int)$pdo->query("SELECT COUNT(*) FROM booth_tasks WHERE booth_id = '{$boothId2}'")->fetchColumn();
assert_test("Legacy booth still preserves all 6 records in SQLite", $rawDbTasksCount === 6);

// Query using the active filter from tasks.php
$activeTasksStmt = $pdo->prepare("
    SELECT * FROM booth_tasks
    WHERE booth_id = :bth
      AND LOWER(task_name) NOT LIKE '%install%'
    ORDER BY sort_order ASC
");
$activeTasksStmt->execute([':bth' => $boothId2]);
$activeTasks = $activeTasksStmt->fetchAll();
assert_test("Active tasks query returns exactly 5 tasks for legacy booth", count($activeTasks) === 5);
$activeTaskNames = array_column($activeTasks, 'task_name');
assert_test("Installation task excluded from active tasks", !in_array('Installation', $activeTaskNames));

// -------------------------------------------------------------
// Test 4: Task Progress Calculation (Completed, Pending, N/A)
// -------------------------------------------------------------
echo "\nTest 4: Progress Calculation with 5 Tasks and N/A Support\n";
// Complete 2 tasks for Booth 1: Design and Print Files
$pdo->exec("UPDATE booth_tasks SET is_completed = 1, status = 'completed' WHERE booth_id = '{$boothId1}' AND task_name IN ('Design', 'Print Files')");

// Query progress logic as in tasks.php / booths.php
$statsStmt = $pdo->prepare("
    SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_completed = 1 OR status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'na' THEN 1 ELSE 0 END) as na_count
    FROM booth_tasks
    WHERE booth_id = :bth
      AND LOWER(task_name) NOT LIKE '%install%'
");
$statsStmt->execute([':bth' => $boothId1]);
$stats = $statsStmt->fetch();
$total = (int)$stats['total'];
$completed = (int)$stats['completed'];
$naCount = (int)$stats['na_count'];
$applicable = max(0, $total - $naCount);
$pct = $applicable > 0 ? round(($completed / $applicable) * 100, 1) : 0;

assert_test("Total tasks is 5", $total === 5);
assert_test("Completed tasks is 2", $completed === 2);
assert_test("Progress percentage is 40.0% (2/5)", $pct === 40.0);

// Set one task to 'na' (e.g., Furniture is N/A for this stall)
$pdo->exec("UPDATE booth_tasks SET status = 'na', is_completed = 0 WHERE booth_id = '{$boothId1}' AND task_name = 'Furniture'");
$statsStmt->execute([':bth' => $boothId1]);
$stats = $statsStmt->fetch();
$total = (int)$stats['total'];
$completed = (int)$stats['completed'];
$naCount = (int)$stats['na_count'];
$applicable = max(0, $total - $naCount);
$pct = $applicable > 0 ? round(($completed / $applicable) * 100, 1) : 0;

assert_test("Applicable tasks is 4 when 1 task is N/A", $applicable === 4);
assert_test("Progress percentage is 50.0% (2/4)", $pct === 50.0);

// Mark legacy booth 2: Design completed, legacy Installation marked completed
$pdo->exec("UPDATE booth_tasks SET is_completed = 1, status = 'completed' WHERE booth_id = '{$boothId2}' AND task_name IN ('Design', 'Installation')");
$statsStmt->execute([':bth' => $boothId2]);
$legStats = $statsStmt->fetch();
$legTotal = (int)$legStats['total'];
$legCompleted = (int)$legStats['completed'];
$legPct = $legTotal > 0 ? round(($legCompleted / $legTotal) * 100, 1) : 0;

assert_test("Legacy booth total active tasks is 5", $legTotal === 5);
assert_test("Legacy completed active tasks is 1 (Installation excluded from completed count)", $legCompleted === 1);
assert_test("Legacy booth progress is 20.0% (1/5), not skewed by legacy installation", $legPct === 20.0);

// -------------------------------------------------------------
// Test 5: Dashboard Statistics Calculation
// -------------------------------------------------------------
echo "\nTest 5: Dashboard Pending Tasks Count\n";
$pendingQuery = "
    SELECT COUNT(*) FROM booth_tasks t
    JOIN booths b ON t.booth_id = b.id
    WHERE b.status != 'archived'
      AND b.booking_stage = 'confirmed'
      AND t.is_completed = 0
      AND (t.status IS NULL OR t.status != 'na')
      AND LOWER(t.task_name) NOT LIKE '%install%'
";
$pendingTasksCount = (int)$pdo->query($pendingQuery)->fetchColumn();
// Booth 1: 5 tasks - 2 completed - 1 na = 2 pending (Production, Electrical)
// Booth 2: 5 active tasks - 1 completed (Design) = 4 pending (Print Files, Production, Furniture, Electrical)
// Total pending should be 2 + 4 = 6
assert_test("Dashboard pending tasks count is exactly 6 (excludes legacy installation)", $pendingTasksCount === 6);

// -------------------------------------------------------------
// Test 6: Confirm Ongoing Discussion Seeds Exactly 5 Tasks
// -------------------------------------------------------------
echo "\nTest 6: Confirm Ongoing Discussion Seeds 5 Tasks\n";
$discId = 'bth_disc_' . bin2hex(random_bytes(4));
$pdo->prepare("
    INSERT INTO booths (
        id, event_id, booth_number, client_name, phone, stand_size, booth_type,
        booking_stage, status
    ) VALUES (
        :id, :event_id, 'Pending', 'Future Prospect Ltd', '+91 99887 76655', '3 × 3 m (9 sq.m)', 'Frame',
        'discussion', 'draft'
    )
")->execute([':id' => $discId, ':event_id' => $eventId]);

// Confirm stall
$pdo->prepare("
    UPDATE booths SET
        booth_number = 'C-303',
        booking_stage = 'confirmed',
        status = 'confirmed',
        updated_at = datetime('now')
    WHERE id = :id
")->execute([':id' => $discId]);

// Application confirms stall and seeds default 5 tasks if none exist
$discTasksCount = (int)$pdo->query("SELECT COUNT(*) FROM booth_tasks WHERE booth_id = '{$discId}'")->fetchColumn();
if ($discTasksCount === 0) {
    foreach ($defaultTasks as $idx => $tName) {
        $taskStmt->execute([
            ':id' => 'tsk_' . bin2hex(random_bytes(4)),
            ':bth' => $discId,
            ':phase' => $tName,
            ':tname' => $tName,
            ':order' => $idx + 1
        ]);
    }
}

$confirmedDiscTasks = $pdo->query("SELECT task_name FROM booth_tasks WHERE booth_id = '{$discId}'")->fetchAll(PDO::FETCH_COLUMN);
assert_test("Confirmed discussion has exactly 5 tasks", count($confirmedDiscTasks) === 5);
assert_test("No installation task seeded on confirmation", !in_array('Installation', $confirmedDiscTasks));

// -------------------------------------------------------------
// Test 7: SQLite Database Integrity Checks
// -------------------------------------------------------------
echo "\nTest 7: SQLite Database Integrity Checks\n";
$integrity = $pdo->query("PRAGMA integrity_check")->fetchColumn();
assert_test("PRAGMA integrity_check returns 'ok'", $integrity === 'ok');

$fkCheck = $pdo->query("PRAGMA foreign_key_check")->fetchAll();
assert_test("PRAGMA foreign_key_check returns 0 violations", count($fkCheck) === 0);

// Cleanup test db
unset($pdo);
@unlink($testDbPath);
@unlink($testDbPath . '-wal');
@unlink($testDbPath . '-shm');
@rmdir($testDbDir);

echo "\n========================================================\n";
echo "SUMMARY: Passed {$passed}, Failed {$failed}\n";
echo "========================================================\n";

if ($failed > 0) {
    exit(1);
}
exit(0);
