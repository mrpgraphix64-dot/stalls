<?php
/**
 * Test Suite: Quick Print & Production Status in Booth List
 */
require_once __DIR__ . '/../manage/api/config.php';

$pdo = reworkzone_get_db();

echo "=== TEST SUITE: QUICK PRINT & PRODUCTION STATUS ===\n\n";
$passed = 0;
$failed = 0;

function assert_true($cond, $msg) {
    global $passed, $failed;
    if ($cond) {
        echo "  [PASS] $msg\n";
        $passed++;
    } else {
        echo "  [FAIL] $msg\n";
        $failed++;
    }
}

// 1. Create a dedicated test event
$eventId = 'evt_test_qws_' . bin2hex(random_bytes(4));
$stmt = $pdo->prepare("INSERT INTO events (id, name, venue, city, start_date, end_date, status) VALUES (?, ?, ?, ?, '2027-01-01', '2027-01-03', 'upcoming')");
$stmt->execute([$eventId, 'Quick Work Status Test Expo', 'Expo Centre', 'Mumbai']);
assert_true(true, "Created test event $eventId");

// Helper to create booth + default tasks
function create_test_booth($pdo, $eventId, $boothNum, $clientName, $stage = 'confirmed', $printState = 'pending', $prodState = 'pending') {
    $bId = 'bth_' . bin2hex(random_bytes(6));
    $stmt = $pdo->prepare("INSERT INTO booths (id, event_id, booth_number, client_name, booking_stage, status) VALUES (?, ?, ?, ?, ?, 'active')");
    $stmt->execute([$bId, $eventId, $boothNum, $clientName, $stage]);

    if ($stage === 'confirmed') {
        // Print task
        $pComp = $printState === 'done' ? 1 : 0;
        $pStatus = $printState === 'done' ? 'completed' : ($printState === 'na' ? 'not_applicable' : 'pending');
        $pdo->prepare("INSERT INTO booth_tasks (id, booth_id, phase, task_name, is_completed, status) VALUES (?, ?, 'Print Files', 'Print Files', ?, ?)")
            ->execute(['tsk_' . bin2hex(random_bytes(4)), $bId, $pComp, $pStatus]);

        // Prod task
        $prComp = $prodState === 'done' ? 1 : 0;
        $prStatus = $prodState === 'done' ? 'completed' : ($prodState === 'na' ? 'not_applicable' : 'pending');
        $pdo->prepare("INSERT INTO booth_tasks (id, booth_id, phase, task_name, is_completed, status) VALUES (?, ?, 'Production', 'Production', ?, ?)")
            ->execute(['tsk_' . bin2hex(random_bytes(4)), $bId, $prComp, $prStatus]);
    }
    return $bId;
}

// 2. Seed all status combinations
$b1 = create_test_booth($pdo, $eventId, 'Q-01', 'Done Done Co', 'confirmed', 'done', 'done');
$b2 = create_test_booth($pdo, $eventId, 'Q-02', 'Done Pending Co', 'confirmed', 'done', 'pending');
$b3 = create_test_booth($pdo, $eventId, 'Q-03', 'Pending Done Co', 'confirmed', 'pending', 'done');
$b4 = create_test_booth($pdo, $eventId, 'Q-04', 'Both Pending Co', 'confirmed', 'pending', 'pending');
$b5 = create_test_booth($pdo, $eventId, 'Q-05', 'Print NA Prod Done Co', 'confirmed', 'na', 'done');
$b6 = create_test_booth($pdo, $eventId, 'Q-06', 'Print Done Prod NA Co', 'confirmed', 'done', 'na');
$b7 = create_test_booth($pdo, $eventId, 'Q-07', 'Both NA Co', 'confirmed', 'na', 'na');
$b8 = create_test_booth($pdo, $eventId, 'Q-99', 'Discussion Co', 'discussion', 'pending', 'pending');

// 3. Test Event Booths Query (used by EventDetailView)
$stmt = $pdo->prepare("
    SELECT 
        b.booth_number,
        b.client_name,
        b.booking_stage,
        (SELECT CASE 
            WHEN status IN ('not_applicable', 'na') THEN 'na' 
            WHEN is_completed = 1 OR status = 'completed' THEN 'done' 
            ELSE 'pending' 
         END 
         FROM booth_tasks 
         WHERE booth_id = b.id AND (LOWER(phase) LIKE '%print%' OR LOWER(task_name) LIKE '%print%') 
         LIMIT 1
        ) AS print_status,
        (SELECT CASE 
            WHEN status IN ('not_applicable', 'na') THEN 'na' 
            WHEN is_completed = 1 OR status = 'completed' THEN 'done' 
            ELSE 'pending' 
         END 
         FROM booth_tasks 
         WHERE booth_id = b.id AND (LOWER(phase) LIKE '%production%' OR LOWER(task_name) LIKE '%production%') 
         LIMIT 1
        ) AS prod_status
    FROM booths b
    WHERE b.event_id = ? AND b.status != 'archived'
    ORDER BY b.booth_number ASC
");
$stmt->execute([$eventId]);
$booths = $stmt->fetchAll(PDO::FETCH_ASSOC);

assert_true(count($booths) === 8, "Retrieved all 8 test booths");

$map = [];
foreach ($booths as $b) {
    $map[$b['booth_number']] = $b;
}

assert_true($map['Q-01']['print_status'] === 'done' && $map['Q-01']['prod_status'] === 'done', "Q-01 has Done / Done");
assert_true($map['Q-02']['print_status'] === 'done' && $map['Q-02']['prod_status'] === 'pending', "Q-02 has Done / Pending");
assert_true($map['Q-03']['print_status'] === 'pending' && $map['Q-03']['prod_status'] === 'done', "Q-03 has Pending / Done");
assert_true($map['Q-04']['print_status'] === 'pending' && $map['Q-04']['prod_status'] === 'pending', "Q-04 has Pending / Pending");
assert_true($map['Q-05']['print_status'] === 'na' && $map['Q-05']['prod_status'] === 'done', "Q-05 has N/A / Done");
assert_true($map['Q-06']['print_status'] === 'done' && $map['Q-06']['prod_status'] === 'na', "Q-06 has Done / N/A");
assert_true($map['Q-07']['print_status'] === 'na' && $map['Q-07']['prod_status'] === 'na', "Q-07 has N/A / N/A");
assert_true($map['Q-99']['booking_stage'] === 'discussion', "Q-99 is marked discussion");

// 4. Test Single Booth Query (used by BoothDetailView)
$sStmt = $pdo->prepare("
    SELECT 
        b.*,
        (SELECT CASE 
            WHEN status IN ('not_applicable', 'na') THEN 'na' 
            WHEN is_completed = 1 OR status = 'completed' THEN 'done' 
            ELSE 'pending' 
         END 
         FROM booth_tasks 
         WHERE booth_id = b.id AND (LOWER(phase) LIKE '%print%' OR LOWER(task_name) LIKE '%print%') 
         LIMIT 1
        ) AS print_status,
        (SELECT CASE 
            WHEN status IN ('not_applicable', 'na') THEN 'na' 
            WHEN is_completed = 1 OR status = 'completed' THEN 'done' 
            ELSE 'pending' 
         END 
         FROM booth_tasks 
         WHERE booth_id = b.id AND (LOWER(phase) LIKE '%production%' OR LOWER(task_name) LIKE '%production%') 
         LIMIT 1
        ) AS prod_status
    FROM booths b
    WHERE b.id = ?
");
$sStmt->execute([$b1]);
$single = $sStmt->fetch(PDO::FETCH_ASSOC);
assert_true($single['print_status'] === 'done' && $single['prod_status'] === 'done', "Single booth query returns print_status and prod_status");

// Cleanup
$pdo->prepare("DELETE FROM booth_tasks WHERE booth_id IN (SELECT id FROM booths WHERE event_id = ?)")->execute([$eventId]);
$pdo->prepare("DELETE FROM booths WHERE event_id = ?")->execute([$eventId]);
$pdo->prepare("DELETE FROM events WHERE id = ?")->execute([$eventId]);
assert_true(true, "Cleaned up test event and booths");

echo "\n--- SUMMARY ---\n";
echo "Total assertions: " . ($passed + $failed) . "\n";
echo "Passed: $passed\n";
echo "Failed: $failed\n";

if ($failed > 0) {
    exit(1);
}
echo "\n[SUCCESS] Quick Print & Production Status backend test suite passed!\n";
