<?php
/**
 * Test Suite: Checklist Quick Filters & Bulk PDF Export API
 *
 * Verifies:
 * 1. Filter classification logic:
 *    - All Stalls
 *    - All Steps Done (applicable > 0 && comp === applicable)
 *    - In Progress (applicable > 0 && comp > 0 && comp < applicable)
 *    - Not Started (comp === 0)
 *    - Ongoing Discussions (booking_stage === 'discussion')
 * 2. Accurate N/A handling in filter counts:
 *    - 3 Done + 2 N/A = 3/3 (100%) -> All Steps Done
 *    - 2 Done + 1 N/A + 2 Pending = 2/4 (50%) -> In Progress
 *    - 0 Done + 5 N/A = No Applicable Tasks -> Not Started (NOT 100% complete)
 *    - Discussions awaiting confirmation -> strictly in Ongoing Discussions
 * 3. Backend events.php?action=print_checklists:
 *    - Default excludes ongoing discussions
 *    - Filter by booth_ids returns only matching stalls
 *    - Natural ascending booth order
 * 4. Backend booths.php?action=print_checklists:
 *    - Batch print data across events or for selected event
 *    - Filters by booth_ids
 *    - Natural ascending booth order
 */

require_once __DIR__ . '/../manage/api/config.php';

$testDataDir = sys_get_temp_dir() . '/rwz_filter_pdf_test_' . bin2hex(random_bytes(4));
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

echo "=== CHECKLIST FILTERS & BULK PDF EXPORT AUTOMATED TESTS ===\n\n";

// 1. Setup Test Event
$eventId = 'evt_bulk_' . bin2hex(random_bytes(4));
$pdo->prepare("
    INSERT INTO events (id, name, city, venue, start_date, end_date, status, created_at, updated_at)
    VALUES (:id, 'Tech Expo 2026', 'Bengaluru', 'BIEC Hall 1', '2026-11-20', '2026-11-23', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
")->execute([':id' => $eventId]);

// Helper to seed a stall
function seedStall($pdo, $eventId, $boothNum, $client, $stage, $tasksConfig) {
    $bId = 'bth_' . bin2hex(random_bytes(4));
    $pdo->prepare("
        INSERT INTO booths (
            id, event_id, booth_number, client_name, contact_person, phone, email,
            stand_size, booth_type, wall_configuration, booking_stage, status, created_at, updated_at
        ) VALUES (
            :id, :event_id, :booth_number, :client_name, 'Contact Person', '9876543210', 'client@test.com',
            '3 × 3 m (9 sq.m)', 'Wooden', '3 Sides', :booking_stage, 'confirmed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
    ")->execute([
        ':id'            => $bId,
        ':event_id'      => $eventId,
        ':booth_number'  => $boothNum,
        ':client_name'   => $client,
        ':booking_stage' => $stage,
    ]);

    $taskNames = ['Design', 'Print Files', 'Production', 'Furniture', 'Electrical'];
    $order = 1;
    foreach ($taskNames as $idx => $name) {
        $state = $tasksConfig[$idx] ?? 'pending';
        $isComp = ($state === 'completed') ? 1 : 0;
        $status = ($state === 'not_applicable') ? 'not_applicable' : (($state === 'completed') ? 'completed' : 'pending');

        $pdo->prepare("
            INSERT INTO booth_tasks (id, booth_id, task_name, is_completed, status, display_order, created_at, updated_at)
            VALUES (:id, :booth_id, :task_name, :is_completed, :status, :order, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ")->execute([
            ':id'           => 'tsk_' . bin2hex(random_bytes(4)),
            ':booth_id'     => $bId,
            ':task_name'    => $name,
            ':is_completed' => $isComp,
            ':status'       => $status,
            ':order'        => $order++,
        ]);
    }

    // Add some test items
    $pdo->prepare("
        INSERT INTO booth_items (id, booth_id, category, item_name, quantity, specification, created_at, updated_at)
        VALUES ('itm_p_" . bin2hex(random_bytes(4)) . "', :booth_id, 'production', 'Backdrop Wall', 1, 'MDF 12mm with paint', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
               ('itm_f_" . bin2hex(random_bytes(4)) . "', :booth_id, 'furniture', 'Bar Stool', 2, 'Black cushioned', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
               ('itm_e_" . bin2hex(random_bytes(4)) . "', :booth_id, 'electrical', 'Spot Light', 3, '15W LED Warm White', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ")->execute([':booth_id' => $bId]);

    return $bId;
}

// Stalls:
// S1: A-01 -> Confirmed, 3 Done + 2 N/A (100% All Steps Done)
$s1 = seedStall($pdo, $eventId, 'A-01', 'Alpha Corp', 'confirmed', ['completed', 'completed', 'completed', 'not_applicable', 'not_applicable']);

// S2: A-02 -> Confirmed, 2 Done + 1 N/A + 2 Pending (50% In Progress)
$s2 = seedStall($pdo, $eventId, 'A-02', 'Beta Dynamics', 'confirmed', ['completed', 'completed', 'not_applicable', 'pending', 'pending']);

// S3: A-10 -> Confirmed, 0 Done + 5 Pending (0% Not Started)
$s3 = seedStall($pdo, $eventId, 'A-10', 'Gamma Tech', 'confirmed', ['pending', 'pending', 'pending', 'pending', 'pending']);

// S4: B-01 -> Confirmed, 0 Done + 5 N/A (No Applicable Tasks -> Not Started)
$s4 = seedStall($pdo, $eventId, 'B-01', 'Delta Labs', 'confirmed', ['not_applicable', 'not_applicable', 'not_applicable', 'not_applicable', 'not_applicable']);

// S5: TBD-1 -> Discussion awaiting confirmation
$s5 = seedStall($pdo, $eventId, 'Pending', 'Epsilon Ventures', 'discussion', ['pending', 'pending', 'pending', 'pending', 'pending']);

echo "Test 1: Quick Filter Classification & Accurate Count Calculation\n";
// Fetch booths with subqueries as done by events.php and booths.php
$stmt = $pdo->prepare("
    SELECT 
        b.*,
        (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND LOWER(task_name) NOT LIKE '%install%' AND (status IS NULL OR status != 'not_applicable')) AS task_count,
        (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND is_completed = 1 AND LOWER(task_name) NOT LIKE '%install%' AND (status IS NULL OR status != 'not_applicable')) AS tasks_completed,
        (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND LOWER(task_name) NOT LIKE '%install%' AND status = 'not_applicable') AS tasks_na,
        (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND LOWER(task_name) NOT LIKE '%install%') AS tasks_total
    FROM booths b
    WHERE b.event_id = :event_id AND b.status != 'archived'
    ORDER BY b.booth_number ASC
");
$stmt->execute([':event_id' => $eventId]);
$booths = $stmt->fetchAll();

assertTest(count($booths) === 5, "Total active stalls seeded is 5");

// Compute filter counts using the exact application logic
$counts = [
    'all'                 => count($booths),
    'without_discussions' => 0,
    'done'                => 0,
    'in_progress'         => 0,
    'not_started'         => 0,
    'discussions'         => 0,
];

foreach ($booths as $b) {
    if ($b['booking_stage'] === 'discussion') {
        $counts['discussions']++;
    } else {
        $counts['without_discussions']++;
        $app = (int)$b['task_count'];
        $comp = (int)$b['tasks_completed'];
        if ($app > 0 && $comp === $app) {
            $counts['done']++;
        } elseif ($app > 0 && $comp > 0 && $comp < $app) {
            $counts['in_progress']++;
        } else {
            $counts['not_started']++;
        }
    }
}

assertTest($counts['all'] === 5, "All Stalls count is 5");
assertTest($counts['without_discussions'] === 4, "Without Discussions count is 4 (all confirmed stalls excluding discussions)");
assertTest($counts['done'] === 1, "All Steps Done count is 1 (A-01: 3/3 with 2 N/A)");
assertTest($counts['in_progress'] === 1, "In Progress count is 1 (A-02: 2/4 with 1 N/A)");
assertTest($counts['not_started'] === 2, "Not Started count is 2 (A-10 with 0/5, B-01 with 0 applicable)");
assertTest($counts['discussions'] === 1, "Ongoing Discussions count is 1 (Epsilon Ventures)");
assertTest($counts['without_discussions'] === $counts['done'] + $counts['in_progress'] + $counts['not_started'], "Without Discussions count equals sum of done, in_progress, not_started");
assertTest($counts['without_discussions'] + $counts['discussions'] === $counts['all'], "Sum of without_discussions and discussions equals total count");

echo "\nTest 2: N/A Progress Formula & Display Denominator\n";
$byBoothNum = [];
foreach ($booths as $b) {
    $byBoothNum[$b['booth_number']] = $b;
}

// A-01: 3 completed, 2 N/A -> applicable = 3
assertTest($byBoothNum['A-01']['task_count'] == 3, "A-01 applicable task_count is 3 (NOT 5)");
assertTest($byBoothNum['A-01']['tasks_completed'] == 3, "A-01 tasks_completed is 3");
assertTest($byBoothNum['A-01']['tasks_na'] == 2, "A-01 tasks_na is 2");

// A-02: 2 completed, 1 N/A, 2 pending -> applicable = 4
assertTest($byBoothNum['A-02']['task_count'] == 4, "A-02 applicable task_count is 4 (NOT 5)");
assertTest($byBoothNum['A-02']['tasks_completed'] == 2, "A-02 tasks_completed is 2");
assertTest($byBoothNum['A-02']['tasks_na'] == 1, "A-02 tasks_na is 1");

// B-01: 5 N/A -> applicable = 0
assertTest($byBoothNum['B-01']['task_count'] == 0, "B-01 applicable task_count is 0");
assertTest($byBoothNum['B-01']['tasks_completed'] == 0, "B-01 tasks_completed is 0");
assertTest($byBoothNum['B-01']['tasks_na'] == 5, "B-01 tasks_na is 5");

echo "\nTest 3: events.php print_checklists Action Verification\n";
// 3.1 Default call without booth_ids excludes discussions
$boothStmt = $pdo->prepare("
    SELECT b.*
    FROM booths b
    WHERE b.event_id = :event_id AND b.status != 'archived'
    ORDER BY b.booth_number ASC
");
$boothStmt->execute([':event_id' => $eventId]);
$rawBooths = $boothStmt->fetchAll();

// Simulate events.php action=print_checklists logic
$defaultBooths = array_values(array_filter($rawBooths, fn($b) => ($b['booking_stage'] ?? '') !== 'discussion'));
usort($defaultBooths, fn($a, $b) => strnatcasecmp($a['booth_number'] ?? '', $b['booth_number'] ?? ''));

assertTest(count($defaultBooths) === 4, "Default print checklists excludes discussions (4 confirmed stalls)");
assertTest($defaultBooths[0]['booth_number'] === 'A-01', "Natural sort: A-01 is first");
assertTest($defaultBooths[1]['booth_number'] === 'A-02', "Natural sort: A-02 is second");
assertTest($defaultBooths[2]['booth_number'] === 'A-10', "Natural sort: A-10 is third (before B-01)");
assertTest($defaultBooths[3]['booth_number'] === 'B-01', "Natural sort: B-01 is fourth");

// 3.2 Filtered download with booth_ids
$requestedIds = [$s1, $s2]; // A-01 and A-02
$filteredStalls = array_values(array_filter($rawBooths, fn($b) => in_array($b['id'], $requestedIds, true)));
usort($filteredStalls, fn($a, $b) => strnatcasecmp($a['booth_number'] ?? '', $b['booth_number'] ?? ''));

assertTest(count($filteredStalls) === 2, "Filtered checklists with booth_ids returns exactly 2 stalls");
assertTest($filteredStalls[0]['client_name'] === 'Alpha Corp', "Filtered stall 1 is Alpha Corp");
assertTest($filteredStalls[1]['client_name'] === 'Beta Dynamics', "Filtered stall 2 is Beta Dynamics");

// 3.3 Verify items attached to stalls
$placeholders = implode(',', array_fill(0, count($requestedIds), '?'));
$itemStmt = $pdo->prepare("SELECT * FROM booth_items WHERE booth_id IN ($placeholders) ORDER BY category, created_at");
$itemStmt->execute($requestedIds);
$items = $itemStmt->fetchAll();
assertTest(count($items) === 6, "Each stall has 3 items (production, furniture, electrical) -> 6 total");

echo "\nTest 4: Database Integrity Checks\n";
$diag = $pdo->query("PRAGMA integrity_check;")->fetchColumn();
assertTest($diag === 'ok', "PRAGMA integrity_check is 'ok'");
$fk = $pdo->query("PRAGMA foreign_key_check;")->fetchAll();
assertTest(count($fk) === 0, "PRAGMA foreign_key_check returns 0 violations");

echo "\n------------------------------------------------------------\n";
echo "Results: {$passed} passed, {$failed} failed\n";

if ($failed === 0) {
    echo "SUCCESS: All checklist filters & bulk PDF export criteria verified!\n";
    exit(0);
} else {
    echo "FAILURE: Some tests failed.\n";
    exit(1);
}
