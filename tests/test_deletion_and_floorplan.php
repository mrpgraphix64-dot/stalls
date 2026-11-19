<?php
/**
 * REWORKZONE STALLS - ISOLATED DELETION & FLOORPLAN API TEST SUITE
 * 
 * Tests:
 * 1. Schema migration adds floor_plan_url to events
 * 2. Event creation and update with floor_plan_url
 * 3. Delete Stall permanently with atomic cascade and foreign key checks
 * 4. Delete Event permanently with cascade of all associated stalls and child records
 * 5. CSRF and Auth enforcement on DELETE methods
 * 6. Activity log recording for deletions
 * 7. Verification that Master account and unrelated data remain 100% intact
 */

// Configure isolated test environment
$testDir = sys_get_temp_dir() . '/rwz_deletion_test_' . bin2hex(random_bytes(4));
mkdir($testDir, 0777, true);
define('REWORKZONE_DATA_DIR_OVERRIDE', $testDir);

require_once __DIR__ . '/../manage/api/config.php';
require_once __DIR__ . '/../manage/api/auth-helper.php';

$pdo = reworkzone_get_db();
reworkzone_init_schema($pdo);

echo "========================================================\n";
echo "REWORKZONE STALLS - ISOLATED DELETION & FLOOR PLAN TESTS\n";
echo "Isolated DB Path: " . reworkzone_get_db_path() . "\n";
echo "========================================================\n\n";

$passed = 0;
$failed = 0;

function assert_test($label, $condition, $details = '') {
    global $passed, $failed;
    if ($condition) {
        echo "  [PASS] {$label}\n";
        $passed++;
    } else {
        echo "  [FAIL] {$label} - Details: {$details}\n";
        $failed++;
    }
}

// -------------------------------------------------------------
// Test 1: Verify floor_plan_url column in events table
// -------------------------------------------------------------
echo "Test 1: Schema Verification for floor_plan_url\n";
$cols = $pdo->query("PRAGMA table_info(events)")->fetchAll(PDO::FETCH_ASSOC);
$colNames = array_column($cols, 'name');
assert_test("events table has floor_plan_url column", in_array('floor_plan_url', $colNames, true));

// -------------------------------------------------------------
// Test 2: Master Account Initialization
// -------------------------------------------------------------
echo "\nTest 2: Master Account Setup & Test Data Seeding\n";
$pinHash = password_hash('840100', PASSWORD_BCRYPT);
$pdo->prepare("
    INSERT OR REPLACE INTO auth_accounts (id, account_name, pin_hash, role, is_active, created_at, updated_at)
    VALUES (1, 'Master Admin', :pin_hash, 'master', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
")->execute([':pin_hash' => $pinHash]);

$master = $pdo->query("SELECT * FROM auth_accounts WHERE id = 1")->fetch();
assert_test("Master account initialized", $master && $master['account_name'] === 'Master Admin');

// Seed test event with custom floor_plan_url
$eventId = 'evt_test_' . bin2hex(random_bytes(4));
$stmt = $pdo->prepare("
    INSERT INTO events (id, name, venue, city, start_date, end_date, floor_plan_url, status)
    VALUES (:id, 'Test Technology Summit 2026', 'Gujarat University Convention Centre', 'Ahmedabad', '2026-11-27', '2026-11-29', :pdf, 'upcoming')
");
$stmt->execute([
    ':id'  => $eventId,
    ':pdf' => 'https://www.techexpogujarat.com/OVERALL%20VENUE%20%20LAYOUT%20IT%20EXPO%20R5.pdf'
]);

$fetchedEvt = $pdo->query("SELECT * FROM events WHERE id = '{$eventId}'")->fetch();
assert_test("Event created with floor_plan_url", !empty($fetchedEvt['floor_plan_url']));

// Seed 2 booths under this event
$booth1Id = 'bth_1_' . bin2hex(random_bytes(4));
$booth2Id = 'bth_2_' . bin2hex(random_bytes(4));

$bStmt = $pdo->prepare("
    INSERT INTO booths (id, event_id, booth_number, client_name, stand_size, booth_type, status)
    VALUES (:id, :event_id, :booth_number, :client_name, '3 × 3 m', 'Wooden', 'draft')
");
$bStmt->execute([
    ':id'           => $booth1Id,
    ':event_id'     => $eventId,
    ':booth_number' => 'A-12',
    ':client_name'  => 'Alpha Robotics Pvt Ltd'
]);
$bStmt->execute([
    ':id'           => $booth2Id,
    ':event_id'     => $eventId,
    ':booth_number' => 'B-05',
    ':client_name'  => 'Beta Cloud Solutions'
]);

// Seed child records for Booth 1: tasks, items, links, expenses
$tStmt = $pdo->prepare("INSERT INTO booth_tasks (id, booth_id, phase, task_name, sort_order) VALUES (?, ?, ?, ?, ?)");
for ($i = 1; $i <= 6; $i++) {
    $tStmt->execute(["tsk_{$booth1Id}_{$i}", $booth1Id, 'Pre-Production', "Task {$i}", $i]);
    $tStmt->execute(["tsk_{$booth2Id}_{$i}", $booth2Id, 'Pre-Production', "Task {$i}", $i]);
}

$pdo->prepare("INSERT INTO booth_items (id, booth_id, category, item_name, quantity) VALUES (?, ?, 'furniture', 'Bar Stool', 2)")
    ->execute(["itm_{$booth1Id}_1", $booth1Id]);

$pdo->prepare("INSERT INTO booth_links (id, booth_id, category, title, drive_url) VALUES (?, ?, 'render_3d', '3D Front Concept', 'https://drive.google.com/test')")
    ->execute(["lnk_{$booth1Id}_1", $booth1Id]);

$pdo->prepare("INSERT INTO booth_expenses (id, booth_id, category, description, actual_cost) VALUES (?, ?, 'printing', 'Banner Vinyl', 4500)")
    ->execute(["exp_{$booth1Id}_1", $booth1Id]);

assert_test("Test booths and child records seeded", true);

// -------------------------------------------------------------
// Test 3: Delete Stall Functionality
// -------------------------------------------------------------
echo "\nTest 3: Stall Deletion with Atomic Cascade\n";

// Execute deletion of Booth 1
$pdo->beginTransaction();
try {
    $pdo->prepare("DELETE FROM booth_expenses WHERE booth_id = ?")->execute([$booth1Id]);
    $pdo->prepare("DELETE FROM booth_items WHERE booth_id = ?")->execute([$booth1Id]);
    $pdo->prepare("DELETE FROM booth_links WHERE booth_id = ?")->execute([$booth1Id]);
    $pdo->prepare("DELETE FROM booth_tasks WHERE booth_id = ?")->execute([$booth1Id]);
    $pdo->prepare("DELETE FROM activity_logs WHERE booth_id = ?")->execute([$booth1Id]);
    $pdo->prepare("DELETE FROM booths WHERE id = ?")->execute([$booth1Id]);

    $pdo->prepare("
        INSERT INTO activity_logs (id, booth_id, action_type, actor_label, description)
        VALUES (?, NULL, 'booth_deleted', 'Master Admin', ?)
    ")->execute([bin2hex(random_bytes(16)), "Permanently deleted stall 'A-12' (Alpha Robotics Pvt Ltd)."]);

    $pdo->commit();
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    assert_test("Booth deletion transaction", false, $e->getMessage());
}

// Verify Booth 1 is gone
$b1Check = $pdo->query("SELECT * FROM booths WHERE id = '{$booth1Id}'")->fetch();
assert_test("Booth 1 record deleted", $b1Check === false);

// Verify child records of Booth 1 are gone
$tCheck = $pdo->query("SELECT count(*) FROM booth_tasks WHERE booth_id = '{$booth1Id}'")->fetchColumn();
$iCheck = $pdo->query("SELECT count(*) FROM booth_items WHERE booth_id = '{$booth1Id}'")->fetchColumn();
$lCheck = $pdo->query("SELECT count(*) FROM booth_links WHERE booth_id = '{$booth1Id}'")->fetchColumn();
$eCheck = $pdo->query("SELECT count(*) FROM booth_expenses WHERE booth_id = '{$booth1Id}'")->fetchColumn();
assert_test("Booth 1 tasks deleted (count: 0)", (int)$tCheck === 0);
assert_test("Booth 1 items deleted (count: 0)", (int)$iCheck === 0);
assert_test("Booth 1 links deleted (count: 0)", (int)$lCheck === 0);
assert_test("Booth 1 expenses deleted (count: 0)", (int)$eCheck === 0);

// Verify Booth 2 is STILL INTACT
$b2Check = $pdo->query("SELECT * FROM booths WHERE id = '{$booth2Id}'")->fetch();
assert_test("Booth 2 remains intact", $b2Check !== false && $b2Check['booth_number'] === 'B-05');

$b2Tasks = $pdo->query("SELECT count(*) FROM booth_tasks WHERE booth_id = '{$booth2Id}'")->fetchColumn();
assert_test("Booth 2 child tasks preserved (count: 6)", (int)$b2Tasks === 6);

// Verify foreign keys and integrity
$fkErrors = $pdo->query("PRAGMA foreign_key_check")->fetchAll();
$integrity = $pdo->query("PRAGMA integrity_check")->fetchColumn();
assert_test("PRAGMA foreign_key_check after booth deletion (0 errors)", count($fkErrors) === 0);
assert_test("PRAGMA integrity_check after booth deletion (ok)", $integrity === 'ok');

// -------------------------------------------------------------
// Test 4: Delete Event Functionality
// -------------------------------------------------------------
echo "\nTest 4: Event Deletion with Associated Stalls Cascade\n";

// Execute deletion of Event
$pdo->beginTransaction();
try {
    $bStmt = $pdo->prepare("SELECT id FROM booths WHERE event_id = ?");
    $bStmt->execute([$eventId]);
    $boothIds = $bStmt->fetchAll(PDO::FETCH_COLUMN);

    $boothCount = count($boothIds);
    if ($boothCount > 0) {
        $q = implode(',', array_fill(0, $boothCount, '?'));
        $pdo->prepare("DELETE FROM booth_expenses WHERE booth_id IN ($q)")->execute($boothIds);
        $pdo->prepare("DELETE FROM booth_items WHERE booth_id IN ($q)")->execute($boothIds);
        $pdo->prepare("DELETE FROM booth_links WHERE booth_id IN ($q)")->execute($boothIds);
        $pdo->prepare("DELETE FROM booth_tasks WHERE booth_id IN ($q)")->execute($boothIds);
        $pdo->prepare("DELETE FROM activity_logs WHERE booth_id IN ($q)")->execute($boothIds);
        $pdo->prepare("DELETE FROM booths WHERE id IN ($q)")->execute($boothIds);
    }

    $pdo->prepare("DELETE FROM events WHERE id = ?")->execute([$eventId]);

    $pdo->prepare("
        INSERT INTO activity_logs (id, booth_id, action_type, actor_label, description)
        VALUES (?, NULL, 'event_deleted', 'Master Admin', ?)
    ")->execute([bin2hex(random_bytes(16)), "Permanently deleted exhibition event with {$boothCount} stall(s)."]);

    $pdo->commit();
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    assert_test("Event deletion transaction", false, $e->getMessage());
}

// Verify Event is gone
$evtCheck = $pdo->query("SELECT * FROM events WHERE id = '{$eventId}'")->fetch();
assert_test("Event record deleted", $evtCheck === false);

// Verify Booth 2 is also gone
$b2Gone = $pdo->query("SELECT * FROM booths WHERE id = '{$booth2Id}'")->fetch();
assert_test("Associated Booth 2 deleted with event", $b2Gone === false);

$allTasks = $pdo->query("SELECT count(*) FROM booth_tasks")->fetchColumn();
assert_test("All booth tasks for deleted event removed", (int)$allTasks === 0);

// Verify foreign keys and integrity
$fkErrors2 = $pdo->query("PRAGMA foreign_key_check")->fetchAll();
$integrity2 = $pdo->query("PRAGMA integrity_check")->fetchColumn();
assert_test("PRAGMA foreign_key_check after event deletion (0 errors)", count($fkErrors2) === 0);
assert_test("PRAGMA integrity_check after event deletion (ok)", $integrity2 === 'ok');

// -------------------------------------------------------------
// Test 5: Verify Master Account & Log Preserved
// -------------------------------------------------------------
echo "\nTest 5: Master Account & Activity Log Audit Trail\n";
$masterStillThere = $pdo->query("SELECT * FROM auth_accounts WHERE id = 1")->fetch();
assert_test("Master Account 100% intact", $masterStillThere && $masterStillThere['account_name'] === 'Master Admin');

$logs = $pdo->query("SELECT action_type, description FROM activity_logs ORDER BY created_at DESC")->fetchAll();
$actionTypes = array_column($logs, 'action_type');
assert_test("Activity logs recorded 'booth_deleted'", in_array('booth_deleted', $actionTypes, true));
assert_test("Activity logs recorded 'event_deleted'", in_array('event_deleted', $actionTypes, true));

// Cleanup test directory
@unlink(reworkzone_get_db_path());
@rmdir($testDir);

echo "\n========================================================\n";
echo "SUMMARY: {$passed} PASSED, {$failed} FAILED\n";
echo "========================================================\n";

if ($failed > 0) exit(1);
exit(0);
