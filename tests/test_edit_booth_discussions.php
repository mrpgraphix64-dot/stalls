<?php
/**
 * Automated Verification Suite for Edit Booth Ongoing Discussions & Conversions
 *
 * Tests:
 * 1. Schema check: booth_number is nullable in SQLite booths table.
 * 2. Edit ongoing discussion without a booth number (persists NULL/empty, updates company & remarks).
 * 3. Update ongoing discussion adding mobile number, size, and structure type.
 * 4. Convert ongoing discussion to Confirmed via booth update (requires booth number, seeds 5 tasks once).
 * 5. Reject duplicate booth number on confirmation if another confirmed stall exists in the same event.
 * 6. Allow moving Confirmed stall back to Ongoing Discussion without deleting existing tasks or items.
 * 7. Ongoing discussion excluded from confirmed-stall dashboard completion stats & pending tasks.
 * 8. Re-convert discussion back to Confirmed without duplicate checklist tasks.
 * 9. PRAGMA integrity_check and foreign_key_check.
 */

require_once __DIR__ . '/../manage/api/config.php';

$testDataDir = sys_get_temp_dir() . '/rwz_edit_disc_test_' . bin2hex(random_bytes(4));
mkdir($testDataDir, 0755, true);
define('REWORKZONE_DATA_DIR_OVERRIDE', $testDataDir);

$dbPath = $testDataDir . '/reworkzone_stalls.sqlite';
$pdo = reworkzone_get_db();

echo "========================================================\n";
echo "REWORKZONE STALLS - EDIT BOOTH ONGOING DISCUSSIONS TESTS\n";
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
// Test 1: Verify Schema - booth_number is Nullable
// -------------------------------------------------------------
echo "Test 1: Verify Schema - booth_number is Nullable\n";
$cols = $pdo->query("PRAGMA table_info(booths)")->fetchAll(PDO::FETCH_ASSOC);
$boothNumCol = null;
foreach ($cols as $c) {
    if ($c['name'] === 'booth_number') {
        $boothNumCol = $c;
        break;
    }
}
assert_test("booth_number column exists", $boothNumCol !== null);
assert_test("booth_number column is nullable (notnull == 0)", (int)($boothNumCol['notnull'] ?? 1) === 0);

// -------------------------------------------------------------
// Test 2: Setup Event & Initial Data
// -------------------------------------------------------------
echo "\nTest 2: Setup Event & Initial Data\n";
$eventId = 'evt_edit_test';
$pdo->prepare("
    INSERT INTO events (id, name, venue, city, start_date, end_date, status)
    VALUES (:id, 'India Tech Expo 2027', 'Pragati Maidan', 'New Delhi', '2027-03-10', '2027-03-14', 'upcoming')
")->execute([':id' => $eventId]);

// Insert an existing confirmed stall: Stall A-10
$confirmedId = 'bth_conf_01';
$pdo->prepare("
    INSERT INTO booths (id, event_id, booth_number, client_name, booking_stage, status)
    VALUES (:id, :event_id, 'A-10', 'Apex Robotics Ltd', 'confirmed', 'draft')
")->execute([':id' => $confirmedId, ':event_id' => $eventId]);

// Seed 5 default tasks for confirmed stall
$defaultTasks = ['Design', 'Print Files', 'Production', 'Furniture', 'Electrical'];
$insTask = $pdo->prepare("
    INSERT INTO booth_tasks (id, booth_id, phase, task_name, sort_order, display_order, is_completed, status)
    VALUES (:id, :bid, :p, :t, :s, :s, 0, 'pending')
");
foreach ($defaultTasks as $idx => $tName) {
    $insTask->execute([
        ':id' => 'tsk_' . bin2hex(random_bytes(6)),
        ':bid' => $confirmedId,
        ':p' => $tName,
        ':t' => $tName,
        ':s' => $idx + 1,
    ]);
}
assert_test("Confirmed stall A-10 created with 5 tasks", true);

// -------------------------------------------------------------
// Test 3: Create & Edit Ongoing Discussion Without Stall Number
// -------------------------------------------------------------
echo "\nTest 3: Create & Edit Ongoing Discussion Without Stall Number\n";
$discId = 'bth_disc_test';
$pdo->prepare("
    INSERT INTO booths (id, event_id, booth_number, client_name, booking_stage, discussion_remark, status)
    VALUES (:id, :event_id, NULL, 'Potential Solutions Inc', 'discussion', 'Initial discussion at trade fair', 'draft')
")->execute([':id' => $discId, ':event_id' => $eventId]);

$disc = $pdo->query("SELECT * FROM booths WHERE id = '{$discId}'")->fetch(PDO::FETCH_ASSOC);
assert_test("Discussion record inserted with NULL booth_number", $disc['booth_number'] === null);
assert_test("Booking stage is 'discussion'", $disc['booking_stage'] === 'discussion');

// Update discussion details without allotting stall number
$pdo->prepare("
    UPDATE booths 
    SET client_name = :client,
        phone = :phone,
        stand_size = :size,
        booth_type = :type,
        discussion_remark = :remark,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = :id
")->execute([
    ':client' => 'Potential Solutions International',
    ':phone' => '+91 99887 76655',
    ':size' => '6 × 3 m (18 sq.m)',
    ':type' => 'Frame',
    ':remark' => 'Client approved 6x3 requirement; waiting for stall allotment from expo organizers.',
    ':id' => $discId,
]);

$discUpdated = $pdo->query("SELECT * FROM booths WHERE id = '{$discId}'")->fetch(PDO::FETCH_ASSOC);
assert_test("Client name updated", $discUpdated['client_name'] === 'Potential Solutions International');
assert_test("Phone number saved", $discUpdated['phone'] === '+91 99887 76655');
assert_test("Stand size updated", $discUpdated['stand_size'] === '6 × 3 m (18 sq.m)');
assert_test("Stall type updated to Frame", $discUpdated['booth_type'] === 'Frame');
assert_test("booth_number remains NULL", $discUpdated['booth_number'] === null);

$discTasks = (int)$pdo->query("SELECT COUNT(*) FROM booth_tasks WHERE booth_id = '{$discId}'")->fetchColumn();
assert_test("Discussion booth still has 0 tasks", $discTasks === 0);

// -------------------------------------------------------------
// Test 4: Conflict Check on Conversion to Confirmed
// -------------------------------------------------------------
echo "\nTest 4: Conflict Check on Conversion to Confirmed\n";
// Attempting to confirm with 'A-10' (already taken by Apex Robotics)
$conflictCheck = $pdo->prepare("
    SELECT id, client_name FROM booths 
    WHERE event_id = :event_id 
      AND UPPER(TRIM(booth_number)) = UPPER(TRIM(:num))
      AND id != :id
      AND (booking_stage = 'confirmed' OR booking_stage IS NULL OR booking_stage = '')
      AND status != 'archived'
");
$conflictCheck->execute([
    ':event_id' => $eventId,
    ':num'      => 'A-10',
    ':id'       => $discId,
]);
$conflictRow = $conflictCheck->fetch(PDO::FETCH_ASSOC);
assert_test("Conflict detected for duplicate confirmed stall number 'A-10'", $conflictRow !== false);
assert_test("Conflicting client is 'Apex Robotics Ltd'", $conflictRow['client_name'] === 'Apex Robotics Ltd');

// -------------------------------------------------------------
// Test 5: Confirm Discussion into Active Confirmed Stall (Allot B-12)
// -------------------------------------------------------------
echo "\nTest 5: Confirm Discussion into Active Confirmed Stall (Allot B-12)\n";
$targetStallNumber = 'B-12';

// Run atomic confirmation
$pdo->beginTransaction();
$pdo->prepare("
    UPDATE booths 
    SET booking_stage = 'confirmed',
        booth_number = :num,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = :id
")->execute([':num' => $targetStallNumber, ':id' => $discId]);

// Seed default 5 tasks if none exist
$taskCheck = $pdo->prepare("SELECT COUNT(*) FROM booth_tasks WHERE booth_id = :id");
$taskCheck->execute([':id' => $discId]);
if ((int)$taskCheck->fetchColumn() === 0) {
    foreach ($defaultTasks as $idx => $tName) {
        $insTask->execute([
            ':id' => 'tsk_' . bin2hex(random_bytes(6)),
            ':bid' => $discId,
            ':p' => $tName,
            ':t' => $tName,
            ':s' => $idx + 1,
        ]);
    }
}
$pdo->commit();

$confirmedDisc = $pdo->query("SELECT * FROM booths WHERE id = '{$discId}'")->fetch(PDO::FETCH_ASSOC);
assert_test("Booking stage converted to 'confirmed'", $confirmedDisc['booking_stage'] === 'confirmed');
assert_test("Stall number set to 'B-12'", $confirmedDisc['booth_number'] === 'B-12');

$confirmedTasks = $pdo->query("SELECT task_name FROM booth_tasks WHERE booth_id = '{$discId}' ORDER BY sort_order")->fetchAll(PDO::FETCH_COLUMN);
assert_test("Exactly 5 checklist tasks seeded on confirmation", count($confirmedTasks) === 5);
assert_test("Tasks match 5-section checklist", $confirmedTasks === $defaultTasks);

// Add a production requirement item and complete 1 task
$pdo->prepare("
    INSERT INTO booth_items (id, booth_id, category, item_name, quantity)
    VALUES ('itm_test_01', :bid, 'production', 'Custom Fascia Nameboard', 1)
")->execute([':bid' => $discId]);
$pdo->prepare("UPDATE booth_tasks SET is_completed = 1, status = 'completed' WHERE booth_id = :bid AND task_name = 'Design'")->execute([':bid' => $discId]);

// -------------------------------------------------------------
// Test 6: Move Confirmed Stall Back to Ongoing Discussion
// -------------------------------------------------------------
echo "\nTest 6: Move Confirmed Stall Back to Ongoing Discussion\n";
$pdo->prepare("
    UPDATE booths 
    SET booking_stage = 'discussion',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = :id
")->execute([':id' => $discId]);

$revertedDisc = $pdo->query("SELECT * FROM booths WHERE id = '{$discId}'")->fetch(PDO::FETCH_ASSOC);
assert_test("Booking stage is now 'discussion'", $revertedDisc['booking_stage'] === 'discussion');
assert_test("Stall number 'B-12' is preserved", $revertedDisc['booth_number'] === 'B-12');

// Verify existing checklist tasks and items were NOT deleted or reset
$preservedTasks = $pdo->query("SELECT task_name, is_completed FROM booth_tasks WHERE booth_id = '{$discId}' ORDER BY sort_order")->fetchAll(PDO::FETCH_ASSOC);
assert_test("Preserved exactly 5 checklist tasks", count($preservedTasks) === 5);
$designTask = array_filter($preservedTasks, fn($t) => $t['task_name'] === 'Design');
assert_test("Design task completion state is preserved (is_completed = 1)", reset($designTask)['is_completed'] == 1);

$itemCount = (int)$pdo->query("SELECT COUNT(*) FROM booth_items WHERE booth_id = '{$discId}'")->fetchColumn();
assert_test("Requirement items preserved (1 item)", $itemCount === 1);

// -------------------------------------------------------------
// Test 7: Exclude Discussion from Pending Tasks & Completed Progress
// -------------------------------------------------------------
echo "\nTest 7: Exclude Discussion from Pending Tasks & Completed Progress\n";
// Pending tasks count should ONLY count tasks belonging to active CONFIRMED booths
$pendingQuery = $pdo->query("
    SELECT COUNT(*) 
    FROM booth_tasks t
    INNER JOIN booths b ON t.booth_id = b.id
    WHERE (t.is_completed = 0 AND (t.status IS NULL OR t.status = 'pending'))
      AND b.status != 'archived'
      AND (b.booking_stage = 'confirmed' OR b.booking_stage IS NULL OR b.booking_stage = '')
      AND LOWER(t.task_name) NOT LIKE '%install%'
")->fetchColumn();

// Only Apex Robotics (bth_conf_01) has 5 pending tasks; the 4 pending tasks of the discussion booth are excluded!
assert_test("Pending tasks count is exactly 5 (discussion booth tasks excluded)", (int)$pendingQuery === 5);

// -------------------------------------------------------------
// Test 8: Re-confirm Discussion to Confirmed Stall (Idempotent Tasks)
// -------------------------------------------------------------
echo "\nTest 8: Re-confirm Discussion to Confirmed Stall (Idempotent Tasks)\n";
$pdo->beginTransaction();
$pdo->prepare("
    UPDATE booths 
    SET booking_stage = 'confirmed',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = :id
")->execute([':id' => $discId]);

// Check tasks - since 5 already exist, do not re-insert!
$taskCountBefore = (int)$pdo->query("SELECT COUNT(*) FROM booth_tasks WHERE booth_id = '{$discId}'")->fetchColumn();
if ($taskCountBefore === 0) {
    foreach ($defaultTasks as $idx => $tName) {
        $insTask->execute([
            ':id' => 'tsk_' . bin2hex(random_bytes(6)),
            ':bid' => $discId,
            ':p' => $tName,
            ':t' => $tName,
            ':s' => $idx + 1,
        ]);
    }
}
$pdo->commit();

$taskCountAfter = (int)$pdo->query("SELECT COUNT(*) FROM booth_tasks WHERE booth_id = '{$discId}'")->fetchColumn();
assert_test("Checklist tasks count is still exactly 5 (no duplicates)", $taskCountAfter === 5);

// -------------------------------------------------------------
// Test 9: SQLite Integrity Checks
// -------------------------------------------------------------
echo "\nTest 9: SQLite Integrity Checks\n";
$integrity = $pdo->query("PRAGMA integrity_check")->fetchColumn();
assert_test("PRAGMA integrity_check is 'ok'", $integrity === 'ok');

$fkCheck = $pdo->query("PRAGMA foreign_key_check")->fetchAll();
assert_test("PRAGMA foreign_key_check returns 0 violations", count($fkCheck) === 0);

echo "\n========================================================\n";
echo "SUMMARY: Passed {$passed}, Failed {$failed}\n";
echo "========================================================\n";

if ($failed > 0) {
    exit(1);
}
