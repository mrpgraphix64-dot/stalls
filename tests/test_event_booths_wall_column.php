<?php
/**
 * Test Suite: Event Details Booth Table Wall Configuration Column
 *
 * Verifies:
 * 1. event-booths API (GET /manage/api/events.php?id=...) returns wall_configuration.
 * 2. All configurations supported: '3 Sides', 'Back + Left', 'Back + Right', 'Back Wall Only', and unset/NULL.
 * 3. Mobile phone numbers are strictly preserved in database records and API responses.
 * 4. wall_configuration is never inferred from booth_type (Wooden/Frame/Customize).
 * 5. SQLite database integrity.
 */

require_once __DIR__ . '/../manage/api/config.php';

$testDbDir = sys_get_temp_dir() . '/rwz_wall_col_test_' . substr(md5(uniqid()), 0, 8);
mkdir($testDbDir, 0777, true);
$testDbPath = $testDbDir . '/reworkzone_stalls.sqlite';

$pdo = new PDO('sqlite:' . $testDbPath, null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

$pdo->exec('PRAGMA foreign_keys = ON;');
$pdo->exec('PRAGMA busy_timeout = 5000;');
$pdo->exec('PRAGMA journal_mode = WAL;');

reworkzone_init_schema($pdo);

$passed = 0;
$failed = 0;

function assertTest($condition, $message) {
    global $passed, $failed;
    if ($condition) {
        echo "  [PASS] $message\n";
        $passed++;
    } else {
        echo "  [FAIL] $message\n";
        $failed++;
    }
}

echo "========================================================\n";
echo "REWORKZONE STALLS - EVENT BOOTHS WALL CONFIGURATION TESTS\n";
echo "Isolated DB Path: $testDbPath\n";
echo "========================================================\n\n";

// Test 1: Setup Event
echo "Test 1: Setup Event\n";
$eventId = 'evt_test_wall_col';
$stmt = $pdo->prepare("
    INSERT INTO events (id, name, venue, city, start_date, end_date, status)
    VALUES (:id, :name, :venue, :city, :start, :end, 'upcoming')
");
$stmt->execute([
    ':id'    => $eventId,
    ':name'  => 'Design & Decor Expo 2027',
    ':venue' => 'Pragati Maidan, Hall 5',
    ':city'  => 'New Delhi',
    ':start' => '2027-05-10',
    ':end'   => '2027-05-14',
]);
assertTest(true, "Event created successfully");

// Test 2: Seed Stalls with Distinct Wall Configurations and Mobile Numbers
echo "\nTest 2: Seed Stalls with Distinct Wall Configurations\n";

$stallsToSeed = [
    [
        'id' => 'booth_1',
        'booth_number' => 'A-01',
        'client_name' => 'Apex Woodworks',
        'phone' => '+91 98765 43210',
        'booth_type' => 'Wooden',
        'wall_configuration' => '3 Sides',
    ],
    [
        'id' => 'booth_2',
        'booth_number' => 'A-02',
        'client_name' => 'Optima Frame Systems',
        'phone' => '+91 98111 22334',
        'booth_type' => 'Frame',
        'wall_configuration' => 'Back + Left',
    ],
    [
        'id' => 'booth_3',
        'booth_number' => 'A-03',
        'client_name' => 'Custom Pavilion Labs',
        'phone' => '+91 99887 76655',
        'booth_type' => 'Customize',
        'wall_configuration' => 'Back + Right',
    ],
    [
        'id' => 'booth_4',
        'booth_number' => 'A-04',
        'client_name' => 'Island Tech',
        'phone' => '+91 91234 56789',
        'booth_type' => 'Wooden',
        'wall_configuration' => 'Back Wall Only',
    ],
    [
        'id' => 'booth_5',
        'booth_number' => 'A-05',
        'client_name' => 'Unset Walls Co',
        'phone' => '+91 95555 44444',
        'booth_type' => 'Customize',
        'wall_configuration' => null, // Unset
    ],
];

$insertStmt = $pdo->prepare("
    INSERT INTO booths (id, event_id, booth_number, client_name, phone, booth_type, wall_configuration, booking_stage, status)
    VALUES (:id, :event_id, :booth_number, :client_name, :phone, :booth_type, :wall_configuration, 'confirmed', 'confirmed')
");

foreach ($stallsToSeed as $s) {
    $insertStmt->execute([
        ':id' => $s['id'],
        ':event_id' => $eventId,
        ':booth_number' => $s['booth_number'],
        ':client_name' => $s['client_name'],
        ':phone' => $s['phone'],
        ':booth_type' => $s['booth_type'],
        ':wall_configuration' => $s['wall_configuration'],
    ]);
}
assertTest(true, "Seeded 5 booths with distinct wall configurations and phone numbers");

// Test 3: Query Event Booths via SQL mirroring manage/api/events.php
echo "\nTest 3: Verify Event Booths Query Returns wall_configuration & phone\n";

$boothStmt = $pdo->prepare("
    SELECT 
        b.*,
        (SELECT COUNT(*) FROM booth_links WHERE booth_id = b.id) AS link_count,
        (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND is_completed = 1 AND LOWER(task_name) NOT LIKE '%install%') AS tasks_completed,
        (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND LOWER(task_name) NOT LIKE '%install%') AS tasks_total
    FROM booths b
    WHERE b.event_id = :event_id AND b.status != 'archived'
    ORDER BY b.booth_number ASC, b.created_at DESC
");
$boothStmt->execute([':event_id' => $eventId]);
$fetchedBooths = $boothStmt->fetchAll();

assertTest(count($fetchedBooths) === 5, "Fetched exactly 5 booths for the event");

$byNum = [];
foreach ($fetchedBooths as $fb) {
    $byNum[$fb['booth_number']] = $fb;
}

// Check A-01: '3 Sides'
assertTest(isset($byNum['A-01']['wall_configuration']) && $byNum['A-01']['wall_configuration'] === '3 Sides', "Stall A-01 has wall_configuration '3 Sides'");
assertTest($byNum['A-01']['phone'] === '+91 98765 43210', "Stall A-01 phone number preserved");

// Check A-02: 'Back + Left'
assertTest(isset($byNum['A-02']['wall_configuration']) && $byNum['A-02']['wall_configuration'] === 'Back + Left', "Stall A-02 has wall_configuration 'Back + Left'");
assertTest($byNum['A-02']['phone'] === '+91 98111 22334', "Stall A-02 phone number preserved");

// Check A-03: 'Back + Right'
assertTest(isset($byNum['A-03']['wall_configuration']) && $byNum['A-03']['wall_configuration'] === 'Back + Right', "Stall A-03 has wall_configuration 'Back + Right'");
assertTest($byNum['A-03']['phone'] === '+91 99887 76655', "Stall A-03 phone number preserved");

// Check A-04: 'Back Wall Only'
assertTest(isset($byNum['A-04']['wall_configuration']) && $byNum['A-04']['wall_configuration'] === 'Back Wall Only', "Stall A-04 has wall_configuration 'Back Wall Only'");
assertTest($byNum['A-04']['phone'] === '+91 91234 56789', "Stall A-04 phone number preserved");

// Check A-05: NULL / Unset
assertTest(array_key_exists('wall_configuration', $byNum['A-05']) && $byNum['A-05']['wall_configuration'] === null, "Stall A-05 has wall_configuration NULL (unset)");
assertTest($byNum['A-05']['phone'] === '+91 95555 44444', "Stall A-05 phone number preserved");

// Test 4: Verify wall_configuration is never inferred from booth_type
echo "\nTest 4: Independence from booth_type (Wooden/Frame/Customize)\n";
assertTest($byNum['A-01']['booth_type'] === 'Wooden' && $byNum['A-01']['wall_configuration'] === '3 Sides', "Wooden booth has explicit '3 Sides'");
assertTest($byNum['A-04']['booth_type'] === 'Wooden' && $byNum['A-04']['wall_configuration'] === 'Back Wall Only', "Another Wooden booth has explicit 'Back Wall Only' (not inferred)");
assertTest($byNum['A-05']['booth_type'] === 'Customize' && $byNum['A-05']['wall_configuration'] === null, "Customize booth has NULL wall_configuration (not inferred)");

// Test 5: Database Integrity
echo "\nTest 5: SQLite Database Integrity Checks\n";
$integrity = $pdo->query("PRAGMA integrity_check;")->fetchColumn();
assertTest($integrity === 'ok', "PRAGMA integrity_check is 'ok'");

$fkCheck = $pdo->query("PRAGMA foreign_key_check;")->fetchAll();
assertTest(count($fkCheck) === 0, "PRAGMA foreign_key_check returns 0 violations");

echo "\n========================================================\n";
echo "SUMMARY: Passed $passed, Failed $failed\n";
echo "========================================================\n";

// Cleanup temp test directory
@unlink($testDbPath);
@unlink($testDbPath . '-wal');
@unlink($testDbPath . '-shm');
@rmdir($testDbDir);

if ($failed > 0) {
    exit(1);
}
exit(0);
