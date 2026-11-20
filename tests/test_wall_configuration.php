<?php
/**
 * REWORKZONE STALLS - BOOTH WALL CONFIGURATION AUTOMATED TEST SUITE
 *
 * Verifies:
 * 1. Schema check: `wall_configuration` column exists in booths table.
 * 2. Default state for existing / newly created booths without explicit wall configuration is NULL.
 * 3. Saving each of the 3 configurations:
 *    - '3 Sides' (Back Wall + Left Wall + Right Wall)
 *    - '2 Sides' with sub-options: 'Back + Left' and 'Back + Right'
 *    - 'Back Wall Only'
 * 4. Changing configurations anytime and clearing back to unset.
 * 5. Non-interference:
 *    - Does NOT confuse or overwrite Stall Type (booth_type: Wooden / Frame / Customize).
 *    - Production checklist tasks and 5-section checklist completion remain 100% independent.
 * 6. Print Checklists batch and single booth data extraction includes `wall_configuration`.
 * 7. SQLite database integrity and foreign key checks pass.
 */

require_once __DIR__ . '/../manage/api/config.php';

$testDataDir = sys_get_temp_dir() . '/rwz_wall_test_' . bin2hex(random_bytes(4));
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
echo "REWORKZONE STALLS - BOOTH WALL CONFIGURATION TESTS\n";
echo "Isolated DB Path: {$testDbPath}\n";
echo "========================================================\n\n";

// -------------------------------------------------------------
// Test 1: Verify Schema & Column
// -------------------------------------------------------------
echo "Test 1: Verify Schema & Column\n";
$cols = $pdo->query("PRAGMA table_info(booths)")->fetchAll();
$colNames = array_column($cols, 'name');
assert_test("Column 'wall_configuration' exists in booths table", in_array('wall_configuration', $colNames, true));

// -------------------------------------------------------------
// Test 2: Setup Event & Seed Test Stalls
// -------------------------------------------------------------
echo "\nTest 2: Setup Event & Test Stalls\n";
$eventId = 'evt_' . bin2hex(random_bytes(4));
$pdo->prepare("
    INSERT INTO events (id, name, city, venue, start_date, end_date, status)
    VALUES (:id, 'India Tech Expo 2027', 'Bengaluru', 'BIEC', '2027-05-15', '2027-05-18', 'upcoming')
")->execute([':id' => $eventId]);

$boothId1 = 'bth_' . bin2hex(random_bytes(4));
$pdo->prepare("
    INSERT INTO booths (
        id, event_id, booth_number, client_name, phone, stand_size, booth_type,
        booking_stage, status
    ) VALUES (
        :id, :event_id, 'A-101', 'Alpha Robotics Pvt Ltd', '+91 98765 11111', '3 × 3 m (9 sq.m)', 'Wooden',
        'confirmed', 'confirmed'
    )
")->execute([':id' => $boothId1, ':event_id' => $eventId]);

$b1 = $pdo->query("SELECT * FROM booths WHERE id = '{$boothId1}'")->fetch();
assert_test("Existing booth has wall_configuration NULL by default", $b1['wall_configuration'] === null);
assert_test("Stall Type is preserved as 'Wooden'", $b1['booth_type'] === 'Wooden');

// -------------------------------------------------------------
// Test 3: Save '3 Sides' Wall Configuration
// -------------------------------------------------------------
echo "\nTest 3: Save '3 Sides' Configuration\n";
$updStmt = $pdo->prepare("UPDATE booths SET wall_configuration = :cfg, updated_at = datetime('now') WHERE id = :id");
$updStmt->execute([':cfg' => '3 Sides', ':id' => $boothId1]);

$b1Updated = $pdo->query("SELECT wall_configuration, booth_type FROM booths WHERE id = '{$boothId1}'")->fetch();
assert_test("Booth wall_configuration is '3 Sides'", $b1Updated['wall_configuration'] === '3 Sides');
assert_test("Stall Type remains 'Wooden' (no confusion)", $b1Updated['booth_type'] === 'Wooden');

// -------------------------------------------------------------
// Test 4: Save 2 Sides with Sub-selector ('Back + Left' & 'Back + Right')
// -------------------------------------------------------------
echo "\nTest 4: Save 2 Sides with Sub-selector Options\n";
// Save Back + Left
$updStmt->execute([':cfg' => 'Back + Left', ':id' => $boothId1]);
$b1Left = $pdo->query("SELECT wall_configuration FROM booths WHERE id = '{$boothId1}'")->fetch();
assert_test("Booth wall_configuration updated to 'Back + Left'", $b1Left['wall_configuration'] === 'Back + Left');

// Switch to Back + Right
$updStmt->execute([':cfg' => 'Back + Right', ':id' => $boothId1]);
$b1Right = $pdo->query("SELECT wall_configuration FROM booths WHERE id = '{$boothId1}'")->fetch();
assert_test("Booth wall_configuration updated to 'Back + Right'", $b1Right['wall_configuration'] === 'Back + Right');

// -------------------------------------------------------------
// Test 5: Save 'Back Wall Only' Configuration
// -------------------------------------------------------------
echo "\nTest 5: Save 'Back Wall Only' Configuration\n";
$updStmt->execute([':cfg' => 'Back Wall Only', ':id' => $boothId1]);
$b1BackOnly = $pdo->query("SELECT wall_configuration FROM booths WHERE id = '{$boothId1}'")->fetch();
assert_test("Booth wall_configuration updated to 'Back Wall Only'", $b1BackOnly['wall_configuration'] === 'Back Wall Only');

// -------------------------------------------------------------
// Test 6: Clear Wall Configuration (Reset to Unset)
// -------------------------------------------------------------
echo "\nTest 6: Clear Wall Configuration (Reset to Unset)\n";
$updStmt->execute([':cfg' => null, ':id' => $boothId1]);
$b1Cleared = $pdo->query("SELECT wall_configuration FROM booths WHERE id = '{$boothId1}'")->fetch();
assert_test("Booth wall_configuration successfully cleared to NULL", $b1Cleared['wall_configuration'] === null);

// -------------------------------------------------------------
// Test 7: Non-Interference with Checklist Completion & Tasks
// -------------------------------------------------------------
echo "\nTest 7: Independence from Checklist & Tasks\n";
// Set wall config back to 'Back + Left'
$updStmt->execute([':cfg' => 'Back + Left', ':id' => $boothId1]);

// Seed 5 default checklist tasks
$defaultTasks = ['Design', 'Print Files', 'Production', 'Furniture', 'Electrical'];
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

// Mark Production task as completed
$pdo->exec("UPDATE booth_tasks SET is_completed = 1, status = 'completed' WHERE booth_id = '{$boothId1}' AND task_name = 'Production'");

$prodTask = $pdo->query("SELECT * FROM booth_tasks WHERE booth_id = '{$boothId1}' AND task_name = 'Production'")->fetch();
assert_test("Production task is completed", (int)$prodTask['is_completed'] === 1 && $prodTask['status'] === 'completed');

// Update wall configuration again
$updStmt->execute([':cfg' => '3 Sides', ':id' => $boothId1]);
$prodTaskAfter = $pdo->query("SELECT * FROM booth_tasks WHERE booth_id = '{$boothId1}' AND task_name = 'Production'")->fetch();
assert_test("Production task completion remains intact after wall config update", (int)$prodTaskAfter['is_completed'] === 1);

// -------------------------------------------------------------
// Test 8: Verify Print Checklists Batch & Single Query
// -------------------------------------------------------------
echo "\nTest 8: Verify Printed Checklists Extraction\n";
// Create second booth with 'Back Wall Only'
$boothId2 = 'bth_' . bin2hex(random_bytes(4));
$pdo->prepare("
    INSERT INTO booths (
        id, event_id, booth_number, client_name, phone, stand_size, booth_type,
        booking_stage, status, wall_configuration
    ) VALUES (
        :id, :event_id, 'B-202', 'Beta Systems', '+91 99999 22222', '6 × 3 m (18 sq.m)', 'Frame',
        'confirmed', 'confirmed', 'Back Wall Only'
    )
")->execute([':id' => $boothId2, ':event_id' => $eventId]);

$printBooths = $pdo->query("SELECT id, booth_number, client_name, booth_type, wall_configuration FROM booths WHERE event_id = '{$eventId}' ORDER BY booth_number ASC")->fetchAll();
assert_test("Bulk print query extracts wall_configuration for both stalls", count($printBooths) === 2);
assert_test("Stall A-101 has wall_configuration '3 Sides'", $printBooths[0]['wall_configuration'] === '3 Sides');
assert_test("Stall B-202 has wall_configuration 'Back Wall Only'", $printBooths[1]['wall_configuration'] === 'Back Wall Only');

// -------------------------------------------------------------
// Test 9: SQLite Integrity Checks
// -------------------------------------------------------------
echo "\nTest 9: SQLite Integrity Checks\n";
$integrity = $pdo->query("PRAGMA integrity_check")->fetchColumn();
assert_test("PRAGMA integrity_check is 'ok'", $integrity === 'ok');

$fkCheck = $pdo->query("PRAGMA foreign_key_check")->fetchAll();
assert_test("PRAGMA foreign_key_check returns 0 violations", count($fkCheck) === 0);

// Cleanup test db
unset($pdo);
@unlink($testDbPath);
@unlink($testDbPath . '-wal');
@unlink($testDbPath . '-shm');
@rmdir($testDataDir);

echo "\n========================================================\n";
echo "SUMMARY: Passed {$passed}, Failed {$failed}\n";
echo "========================================================\n";

if ($failed > 0) {
    exit(1);
}
exit(0);
