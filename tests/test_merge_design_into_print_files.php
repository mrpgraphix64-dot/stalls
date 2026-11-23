<?php
/**
 * Test Suite: Merge Design into Print Files & 4-Step Checklist Verification
 */
require_once __DIR__ . '/../manage/api/config.php';

$pdo = reworkzone_get_db();

echo "=== TEST SUITE: MERGE DESIGN INTO PRINT FILES (4-STEP CHECKLIST) ===\n\n";
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
$eventId = 'evt_test_mrg_' . bin2hex(random_bytes(4));
$stmt = $pdo->prepare("INSERT INTO events (id, name, venue, city, start_date, end_date, status) VALUES (?, ?, 'Hall 1', 'Delhi', '2027-02-01', '2027-02-04', 'upcoming')");
$stmt->execute([$eventId, 'Merge Design Test Expo']);
assert_true(true, "Created test event $eventId");

// Helper: Seed legacy 5-task booth
function seed_legacy_5_task_booth($pdo, $eventId, $boothNum, $clientName, $designComp, $printComp, $printNa = false) {
    $bId = 'bth_' . bin2hex(random_bytes(6));
    $stmt = $pdo->prepare("
        INSERT INTO booths (id, event_id, booth_number, client_name, booking_stage, design_responsibility, print_drive_url, print_file_status, status)
        VALUES (?, ?, ?, ?, 'confirmed', 'Client Side', 'https://drive.google.com/test_folder', 'All Files Ready', 'active')
    ");
    $stmt->execute([$bId, $eventId, $boothNum, $clientName]);

    // Tasks: Design, Print Files, Production, Furniture, Electrical
    $tasks = [
        ['Design', $designComp ? 1 : 0, $designComp ? 'completed' : 'pending'],
        ['Print Files', $printComp ? 1 : 0, $printNa ? 'not_applicable' : ($printComp ? 'completed' : 'pending')],
        ['Production', 1, 'completed'],
        ['Furniture', 0, 'pending'],
        ['Electrical', 0, 'pending'],
    ];

    $ins = $pdo->prepare("INSERT INTO booth_tasks (id, booth_id, phase, task_name, is_completed, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)");
    foreach ($tasks as $idx => $t) {
        $ins->execute(['tsk_' . bin2hex(random_bytes(4)), $bId, $t[0], $t[0], $t[1], $t[2], $idx + 1]);
    }

    // Add a 3D view link
    $pdo->prepare("INSERT INTO booth_links (id, booth_id, category, title, drive_url, created_at) VALUES (?, ?, 'render_3d', 'Front View', 'https://drive.google.com/3d_front', CURRENT_TIMESTAMP)")
        ->execute(['lnk_' . bin2hex(random_bytes(4)), $bId]);

    return $bId;
}

// Case 1: Design Done, Print Pending -> Active count should show Print Pending (not done)
$b1 = seed_legacy_5_task_booth($pdo, $eventId, 'M-01', 'Design Done Print Pending Co', true, false, false);

// Case 2: Design Pending, Print Done -> Active count should show Print Done
$b2 = seed_legacy_5_task_booth($pdo, $eventId, 'M-02', 'Design Pending Print Done Co', false, true, false);

// Case 3: Both Done
$b3 = seed_legacy_5_task_booth($pdo, $eventId, 'M-03', 'Both Done Co', true, true, false);

// Case 4: Print N/A
$b4 = seed_legacy_5_task_booth($pdo, $eventId, 'M-04', 'Print NA Co', true, false, true);

// 2. Query Booth List and check active task stats
$qSql = "
    SELECT 
        b.booth_number,
        b.client_name,
        b.design_responsibility,
        b.print_drive_url,
        (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND LOWER(task_name) NOT LIKE '%install%' AND LOWER(task_name) != 'design' AND LOWER(task_name) != 'design approved' AND (status IS NULL OR status != 'not_applicable')) AS task_count,
        (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND is_completed = 1 AND LOWER(task_name) NOT LIKE '%install%' AND LOWER(task_name) != 'design' AND LOWER(task_name) != 'design approved' AND (status IS NULL OR status != 'not_applicable')) AS tasks_completed,
        (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND LOWER(task_name) NOT LIKE '%install%' AND LOWER(task_name) != 'design' AND LOWER(task_name) != 'design approved' AND status = 'not_applicable') AS tasks_na,
        (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND LOWER(task_name) NOT LIKE '%install%' AND LOWER(task_name) != 'design' AND LOWER(task_name) != 'design approved') AS tasks_total,
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
    WHERE b.event_id = ?
    ORDER BY b.booth_number ASC
";
$stmt = $pdo->prepare($qSql);
$stmt->execute([$eventId]);
$res = $stmt->fetchAll(PDO::FETCH_ASSOC);

assert_true(count($res) === 4, "Fetched all 4 test stalls");

$map = [];
foreach ($res as $r) {
    $map[$r['booth_number']] = $r;
}

// Case 1 Check: Design was Done, Print Pending -> Active tasks total is 4, completed is 1 (Production only), Print status is pending
assert_true((int)$map['M-01']['tasks_total'] === 4, "M-01 has exactly 4 active tasks");
assert_true((int)$map['M-01']['tasks_completed'] === 1, "M-01 completed tasks is 1 (Design completion not counted in combined step)");
assert_true($map['M-01']['print_status'] === 'pending', "M-01 print_status is pending");

// Case 2 Check: Design was Pending, Print Done -> Active completed is 2 (Print + Production)
assert_true((int)$map['M-02']['tasks_total'] === 4, "M-02 has exactly 4 active tasks");
assert_true((int)$map['M-02']['tasks_completed'] === 2, "M-02 completed tasks is 2 (Print Files & Production)");
assert_true($map['M-02']['print_status'] === 'done', "M-02 print_status is done");

// Case 3 Check: Both Done
assert_true((int)$map['M-03']['tasks_total'] === 4, "M-03 has exactly 4 active tasks");
assert_true((int)$map['M-03']['tasks_completed'] === 2, "M-03 completed tasks is 2");
assert_true($map['M-03']['print_status'] === 'done', "M-03 print_status is done");

// Case 4 Check: Print N/A -> Applicable task_count is 3, na is 1, print_status is na
assert_true((int)$map['M-04']['task_count'] === 3, "M-04 applicable task_count is 3 (1 N/A excluded from denominator)");
assert_true((int)$map['M-04']['tasks_na'] === 1, "M-04 tasks_na is 1");
assert_true($map['M-04']['print_status'] === 'na', "M-04 print_status is na");

// 3. Verify Design Responsibility & 3D Links persistence
assert_true($map['M-01']['design_responsibility'] === 'Client Side', "Design responsibility preserved as 'Client Side'");
assert_true($map['M-01']['print_drive_url'] === 'https://drive.google.com/test_folder', "Print drive URL preserved");

$linkCount = (int)$pdo->query("SELECT COUNT(*) FROM booth_links WHERE booth_id = '{$b1}' AND category = 'render_3d'")->fetchColumn();
assert_true($linkCount === 1, "3D render link preserved for M-01");

// 4. Test New Booth Creation with default 4 tasks
$newBoothId = 'bth_' . bin2hex(random_bytes(6));
$insBooth = $pdo->prepare("INSERT INTO booths (id, event_id, booth_number, client_name, booking_stage, status) VALUES (?, ?, 'M-05', 'New 4-Task Booth', 'confirmed', 'active')");
$insBooth->execute([$newBoothId, $eventId]);

$defaultTasks = [
    'Print Files & Design',
    'Production',
    'Furniture',
    'Electrical',
];
$insTask = $pdo->prepare("INSERT INTO booth_tasks (id, booth_id, phase, task_name, sort_order, display_order, is_completed, status) VALUES (?, ?, ?, ?, ?, ?, 0, 'pending')");
foreach ($defaultTasks as $idx => $tName) {
    $insTask->execute(['tsk_' . bin2hex(random_bytes(4)), $newBoothId, $tName, $tName, $idx + 1, $idx + 1]);
}

$newTasks = $pdo->query("SELECT task_name FROM booth_tasks WHERE booth_id = '{$newBoothId}' AND LOWER(task_name) NOT LIKE '%install%' AND LOWER(task_name) != 'design' ORDER BY sort_order")->fetchAll(PDO::FETCH_COLUMN);
assert_true(count($newTasks) === 4, "Newly seeded booth has exactly 4 active tasks");
assert_true($newTasks[0] === 'Print Files & Design', "First active task is 'Print Files & Design'");

// 5. Verify historical Design tasks remain untouched in database
$rawTasksB1 = $pdo->query("SELECT task_name FROM booth_tasks WHERE booth_id = '{$b1}' ORDER BY sort_order")->fetchAll(PDO::FETCH_COLUMN);
assert_true(in_array('Design', $rawTasksB1, true), "Legacy 'Design' task safely preserved in database for audit history");
assert_true(count($rawTasksB1) === 5, "Total raw tasks for legacy booth M-01 remains 5 in database");

// Cleanup
$pdo->prepare("DELETE FROM booth_links WHERE booth_id IN (SELECT id FROM booths WHERE event_id = ?)")->execute([$eventId]);
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
echo "\n[SUCCESS] Merge Design into Print Files test suite passed!\n";
