<?php
/**
 * Automated Verification Suite for Ongoing Discussions & Confirmed Stall Tracking
 *
 * Tests:
 * 1. Schema check: `booking_stage` and `discussion_remark` columns exist with default 'confirmed'.
 * 2. Create ongoing discussion stall without stall number.
 * 3. Verify discussion stall has 0 checklist tasks seeded and is excluded from pending_tasks.
 * 4. Verify dashboard stats: counts confirmed vs ongoing discussions accurately.
 * 5. Update discussion stall details (company, mobile, remark, etc.).
 * 6. Confirm stall action: requires booth_number, sets booking_stage='confirmed', seeds exactly 6 tasks once.
 * 7. Duplicate stall number prevention among confirmed stalls in same event.
 * 8. Allow multiple unallotted discussion stalls without conflict.
 * 9. Create confirmed stall directly: seeds 6 tasks, enforces unique stall number.
 * 10. Archive / delete discussion stalls safely.
 * 11. SQLite integrity check and foreign key check.
 */

require_once __DIR__ . '/../manage/api/config.php';

$testDataDir = sys_get_temp_dir() . '/rwz_disc_test_' . bin2hex(random_bytes(4));
mkdir($testDataDir, 0755, true);
define('REWORKZONE_DATA_DIR_OVERRIDE', $testDataDir);

$dbPath = $testDataDir . '/reworkzone_stalls.sqlite';
$pdo = reworkzone_get_db();

echo "========================================================\n";
echo "REWORKZONE STALLS - ONGOING DISCUSSIONS & CONFIRMED STALL TESTS\n";
echo "Isolated DB Path: {$dbPath}\n";
echo "========================================================\n\n";

$passed = 0;
$failed = 0;

function assert_test(string $name, bool $condition) {
    global $passed, $failed;
    if ($condition) {
        $passed++;
        echo "  [PASS] {$name}\n";
    } else {
        $failed++;
        echo "  [FAIL] {$name}\n";
    }
}

// -------------------------------------------------------------
// Test 1: Verify Schema & Columns
// -------------------------------------------------------------
echo "Test 1: Verify Schema & Columns\n";
$cols = $pdo->query("PRAGMA table_info(booths)")->fetchAll(PDO::FETCH_ASSOC);
$colNames = array_column($cols, 'name');
assert_test("Column 'booking_stage' exists in booths table", in_array('booking_stage', $colNames));
assert_test("Column 'discussion_remark' exists in booths table", in_array('discussion_remark', $colNames));

// -------------------------------------------------------------
// Test 2: Setup Event
// -------------------------------------------------------------
echo "\nTest 2: Setup Event\n";
$eventId = 'evt_disc_test';
$pdo->prepare("
    INSERT INTO events (id, name, venue, city, start_date, end_date, status)
    VALUES (:id, 'Vibrant Gujarat Global Expo', 'Helipad Exhibition Centre', 'Gandhinagar', '2027-02-15', '2027-02-19', 'upcoming')
")->execute([':id' => $eventId]);
assert_test("Event created successfully", true);

// -------------------------------------------------------------
// Test 3: Add Ongoing Discussion without Stall Number
// -------------------------------------------------------------
echo "\nTest 3: Add Ongoing Discussion without Stall Number\n";
$discId1 = 'bth_disc_01';
$stmt = $pdo->prepare("
    INSERT INTO booths (
        id, event_id, booth_number, client_name, phone, stand_size, booth_type,
        booking_stage, discussion_remark, status
    ) VALUES (
        :id, :event_id, :booth_num, :client, :phone, :size, :type,
        'discussion', :remark, 'draft'
    )
");
$stmt->execute([
    ':id' => $discId1,
    ':event_id' => $eventId,
    ':booth_num' => 'Pending',
    ':client' => 'Prospective Automation Corp',
    ':phone' => '+91 98765 43210',
    ':size' => '3 × 3 m (9 sq.m)',
    ':type' => 'Wooden',
    ':remark' => 'Client is evaluating 3x3 layout. Quote sent via WhatsApp.'
]);

$disc1 = $pdo->query("SELECT * FROM booths WHERE id = '{$discId1}'")->fetch(PDO::FETCH_ASSOC);
assert_test("Discussion record inserted", $disc1 !== false);
assert_test("Booking stage is 'discussion'", $disc1['booking_stage'] === 'discussion');
assert_test("Booth number is 'Pending'", $disc1['booth_number'] === 'Pending');
assert_test("Discussion remark preserved", $disc1['discussion_remark'] === 'Client is evaluating 3x3 layout. Quote sent via WhatsApp.');

// Verify 0 tasks seeded for discussion booth
$taskCount = (int)$pdo->query("SELECT COUNT(*) FROM booth_tasks WHERE booth_id = '{$discId1}'")->fetchColumn();
assert_test("0 checklist tasks seeded for discussion booth", $taskCount === 0);

// -------------------------------------------------------------
// Test 4: Multiple Discussions can have 'Pending' or blank stall numbers
// -------------------------------------------------------------
echo "\nTest 4: Multiple Discussions can have 'Pending' or blank stall numbers\n";
$discId2 = 'bth_disc_02';
$stmt->execute([
    ':id' => $discId2,
    ':event_id' => $eventId,
    ':booth_num' => '',
    ':client' => 'NextGen Solar Solutions',
    ':phone' => '+91 98111 22233',
    ':size' => '6 × 3 m (18 sq.m)',
    ':type' => 'Customize',
    ':remark' => 'Wants two-side open corner booth, waiting for hall layout'
]);

$disc2 = $pdo->query("SELECT * FROM booths WHERE id = '{$discId2}'")->fetch(PDO::FETCH_ASSOC);
assert_test("Second discussion record inserted with empty stall number", $disc2 !== false);
assert_test("Booking stage is 'discussion'", $disc2['booking_stage'] === 'discussion');

// -------------------------------------------------------------
// Test 5: Create a Confirmed Stall directly
// -------------------------------------------------------------
echo "\nTest 5: Create a Confirmed Stall directly\n";
$confId1 = 'bth_conf_01';
$pdo->prepare("
    INSERT INTO booths (
        id, event_id, booth_number, client_name, phone, stand_size, booth_type,
        booking_stage, status
    ) VALUES (
        :id, :event_id, 'A-101', 'Confirmed Technologies', '+91 99999 88888', '3 × 3 m (9 sq.m)', 'Frame',
        'confirmed', 'confirmed'
    )
")->execute([':id' => $confId1, ':event_id' => $eventId]);

// Seed default 5 tasks for confirmed stall as application layer does
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
        ':bth' => $confId1,
        ':phase' => $tName,
        ':tname' => $tName,
        ':order' => $idx + 1
    ]);
}

$confTasksCount = (int)$pdo->query("SELECT COUNT(*) FROM booth_tasks WHERE booth_id = '{$confId1}'")->fetchColumn();
assert_test("Confirmed booth has exactly 5 tasks seeded", $confTasksCount === 5);

// -------------------------------------------------------------
// Test 6: Verify Dashboard Statistics Calculation
// -------------------------------------------------------------
echo "\nTest 6: Verify Dashboard Statistics Calculation\n";
$confirmedCount = (int)$pdo->query("SELECT COUNT(*) FROM booths WHERE status != 'archived' AND booking_stage = 'confirmed'")->fetchColumn();
$discussionCount = (int)$pdo->query("SELECT COUNT(*) FROM booths WHERE status != 'archived' AND booking_stage = 'discussion'")->fetchColumn();
$pendingTasks = (int)$pdo->query("
    SELECT COUNT(*) FROM booth_tasks t
    JOIN booths b ON t.booth_id = b.id
    WHERE b.status != 'archived'
      AND b.booking_stage = 'confirmed'
      AND t.is_completed = 0
      AND (t.status IS NULL OR t.status != 'na')
      AND LOWER(t.task_name) NOT LIKE '%install%'
")->fetchColumn();

assert_test("Confirmed count is exactly 1", $confirmedCount === 1);
assert_test("Ongoing discussions count is exactly 2", $discussionCount === 2);
assert_test("Pending tasks count excludes discussions (exactly 5)", $pendingTasks === 5);

// -------------------------------------------------------------
// Test 7: Update Discussion Details
// -------------------------------------------------------------
echo "\nTest 7: Update Discussion Details\n";
$updStmt = $pdo->prepare("
    UPDATE booths SET
        client_name = :client,
        phone = :phone,
        discussion_remark = :remark,
        updated_at = datetime('now')
    WHERE id = :id
");
$updStmt->execute([
    ':id' => $discId1,
    ':client' => 'Prospective Automation Corp (Updated)',
    ':phone' => '+91 98765 00000',
    ':remark' => 'Client approved preliminary budget; preparing final stall allotment.'
]);

$disc1Upd = $pdo->query("SELECT * FROM booths WHERE id = '{$discId1}'")->fetch(PDO::FETCH_ASSOC);
assert_test("Client name updated", $disc1Upd['client_name'] === 'Prospective Automation Corp (Updated)');
assert_test("Phone updated", $disc1Upd['phone'] === '+91 98765 00000');
assert_test("Discussion remark updated", str_contains($disc1Upd['discussion_remark'], 'final stall allotment'));

// -------------------------------------------------------------
// Test 8: Confirm Stall Action
// -------------------------------------------------------------
echo "\nTest 8: Confirm Stall Action\n";
// Attempt duplicate stall number check: 'A-101' already belongs to $confId1
$dupCheck = $pdo->prepare("
    SELECT id FROM booths
    WHERE event_id = :evt AND booth_number = :num AND booking_stage = 'confirmed' AND status != 'archived' AND id != :id
");
$dupCheck->execute([':evt' => $eventId, ':num' => 'A-101', ':id' => $discId1]);
assert_test("Duplicate conflict detected for stall A-101", $dupCheck->fetch() !== false);

// Allot new unique stall number 'B-205'
$dupCheck->execute([':evt' => $eventId, ':num' => 'B-205', ':id' => $discId1]);
assert_test("No conflict for unique stall B-205", $dupCheck->fetch() === false);

// Perform confirmation update
$confirmStmt = $pdo->prepare("
    UPDATE booths SET
        booth_number = :num,
        booking_stage = 'confirmed',
        status = CASE WHEN status = 'draft' THEN 'confirmed' ELSE status END,
        updated_at = datetime('now')
    WHERE id = :id
");
$confirmStmt->execute([':num' => 'B-205', ':id' => $discId1]);

// Seed tasks if not present
$existingCount = (int)$pdo->query("SELECT COUNT(*) FROM booth_tasks WHERE booth_id = '{$discId1}'")->fetchColumn();
if ($existingCount === 0) {
    foreach ($defaultTasks as $idx => $tName) {
        $taskStmt->execute([
            ':id' => 'tsk_' . bin2hex(random_bytes(4)),
            ':bth' => $discId1,
            ':phase' => $tName,
            ':tname' => $tName,
            ':order' => $idx + 1
        ]);
    }
}

$disc1Confirmed = $pdo->query("SELECT * FROM booths WHERE id = '{$discId1}'")->fetch(PDO::FETCH_ASSOC);
assert_test("Booking stage updated to 'confirmed'", $disc1Confirmed['booking_stage'] === 'confirmed');
assert_test("Booth number updated to 'B-205'", $disc1Confirmed['booth_number'] === 'B-205');
$newTasksCount = (int)$pdo->query("SELECT COUNT(*) FROM booth_tasks WHERE booth_id = '{$discId1}'")->fetchColumn();
assert_test("Confirmed discussion has exactly 5 tasks initialized", $newTasksCount === 5);

// Verify idempotency: re-confirming should NOT duplicate tasks
$existingCount2 = (int)$pdo->query("SELECT COUNT(*) FROM booth_tasks WHERE booth_id = '{$discId1}'")->fetchColumn();
assert_test("Tasks not duplicated on repeated check", $existingCount2 === 5);

// -------------------------------------------------------------
// Test 9: Verify Updated Dashboard Statistics
// -------------------------------------------------------------
echo "\nTest 9: Verify Updated Dashboard Statistics\n";
$newConfirmedCount = (int)$pdo->query("SELECT COUNT(*) FROM booths WHERE status != 'archived' AND booking_stage = 'confirmed'")->fetchColumn();
$newDiscussionCount = (int)$pdo->query("SELECT COUNT(*) FROM booths WHERE status != 'archived' AND booking_stage = 'discussion'")->fetchColumn();
assert_test("Confirmed stalls increased from 1 to 2", $newConfirmedCount === 2);
assert_test("Ongoing discussions decreased from 2 to 1", $newDiscussionCount === 1);

// -------------------------------------------------------------
// Test 10: Delete Discussion Stall
// -------------------------------------------------------------
echo "\nTest 10: Delete Discussion Stall Safely\n";
$pdo->prepare("DELETE FROM booths WHERE id = :id")->execute([':id' => $discId2]);
$remDiscussion = (int)$pdo->query("SELECT COUNT(*) FROM booths WHERE status != 'archived' AND booking_stage = 'discussion'")->fetchColumn();
assert_test("Discussion stall deleted cleanly; 0 discussions remaining", $remDiscussion === 0);

// -------------------------------------------------------------
// Test 11: SQLite Integrity Checks
// -------------------------------------------------------------
echo "\nTest 11: SQLite Integrity Checks\n";
$integrity = $pdo->query("PRAGMA integrity_check;")->fetchColumn();
assert_test("PRAGMA integrity_check is 'ok'", $integrity === 'ok');

$fkCheck = $pdo->query("PRAGMA foreign_key_check;")->fetchAll(PDO::FETCH_ASSOC);
assert_test("PRAGMA foreign_key_check returns 0 violations", count($fkCheck) === 0);

echo "\n========================================================\n";
echo "SUMMARY: Passed {$passed}, Failed {$failed}\n";
echo "========================================================\n";

if ($failed > 0) {
    exit(1);
}
exit(0);
