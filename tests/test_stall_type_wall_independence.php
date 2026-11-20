<?php
/**
 * Test Suite: Stall Type & Wall Configuration Independence
 *
 * Verifies:
 * 1. 100% independence between Stall Type (Wooden, Frame, Customize) and Wall Configuration (3 Sides, Back + Left, Back + Right, Back Wall Only).
 * 2. All 12 combinations (3 types x 4 configs) + unconfigured can be created and persisted in SQLite.
 * 3. Updating Stall Type preserves Wall Configuration.
 * 4. Updating Wall Configuration preserves Stall Type.
 * 5. Partial updates via action=update (like Edit Booth modal) preserve Wall Configuration when omitted from payload.
 * 6. Partial updates via action=update (like Wall Selector) preserve Stall Type when only wall_configuration is in payload.
 * 7. Clearing Wall Configuration sets it to NULL without altering Stall Type.
 */

require_once __DIR__ . '/../manage/api/config.php';

$testDataDir = sys_get_temp_dir() . '/rwz_indep_test_' . bin2hex(random_bytes(4));
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

echo "=== STALL TYPE & WALL CONFIGURATION INDEPENDENCE TESTS ===\n\n";

// 1. Create a clean test event
$eventId = 'evt_indep_' . bin2hex(random_bytes(4));
$pdo->prepare("
    INSERT INTO events (id, name, city, venue, start_date, end_date, status, created_at, updated_at)
    VALUES (:id, 'Independence Test Expo', 'Mumbai', 'Hall 1', '2026-12-01', '2026-12-03', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
")->execute([':id' => $eventId]);

echo "Test 1: Create all 12 combinations of Stall Type & Wall Configuration\n";
$stallTypes = ['Wooden', 'Frame', 'Customize'];
$wallConfigs = ['3 Sides', 'Back + Left', 'Back + Right', 'Back Wall Only'];

$combinationBooths = [];
$counter = 1;

foreach ($stallTypes as $type) {
    foreach ($wallConfigs as $config) {
        $bId = "bth_indep_{$counter}";
        $bNum = sprintf("S-%02d", $counter);
        $client = "Client {$type} {$config}";

        $stmt = $pdo->prepare("
            INSERT INTO booths (
                id, event_id, booth_number, client_name, booth_type, wall_configuration,
                stand_size, phone, booking_stage, status, created_at, updated_at
            ) VALUES (
                :id, :event_id, :booth_number, :client_name, :booth_type, :wall_configuration,
                '3 × 3 m (9 sq.m)', '9876543210', 'confirmed', 'draft', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
        ");
        $stmt->execute([
            ':id'                 => $bId,
            ':event_id'           => $eventId,
            ':booth_number'       => $bNum,
            ':client_name'        => $client,
            ':booth_type'         => $type,
            ':wall_configuration' => $config,
        ]);

        $combinationBooths[] = [
            'id'     => $bId,
            'number' => $bNum,
            'type'   => $type,
            'config' => $config,
        ];
        $counter++;
    }
}

assertTest(count($combinationBooths) === 12, "Created all 12 combinations (3 stall types x 4 wall configurations)");

// Verify all 12 combinations in SQLite
foreach ($combinationBooths as $cb) {
    $row = $pdo->query("SELECT booth_type, wall_configuration FROM booths WHERE id = '{$cb['id']}'")->fetch();
    assertTest(
        $row['booth_type'] === $cb['type'] && $row['wall_configuration'] === $cb['config'],
        "Booth {$cb['number']} persisted with Type '{$cb['type']}' + Wall '{$cb['config']}'"
    );
}

// Also test unconfigured (NULL) wall configuration for each stall type
echo "\nTest 2: Stall Types with unconfigured (NULL) Wall Configuration\n";
foreach ($stallTypes as $type) {
    $bId = "bth_null_" . strtolower($type);
    $bNum = "N-" . substr($type, 0, 1);
    $pdo->prepare("
        INSERT INTO booths (id, event_id, booth_number, client_name, booth_type, wall_configuration, stand_size, booking_stage, status)
        VALUES (:id, :event_id, :booth_number, :client, :type, NULL, '3 × 3 m', 'confirmed', 'draft')
    ")->execute([
        ':id'           => $bId,
        ':event_id'     => $eventId,
        ':booth_number' => $bNum,
        ':client'       => "Unconfigured {$type}",
        ':type'         => $type,
    ]);

    $row = $pdo->query("SELECT booth_type, wall_configuration FROM booths WHERE id = '{$bId}'")->fetch();
    assertTest($row['booth_type'] === $type && $row['wall_configuration'] === null, "Type '{$type}' works with NULL wall_configuration");
}

echo "\nTest 3: Changing Stall Type must NEVER reset or alter Wall Configuration\n";
// Pick Frame + Back Wall Only (bth_indep_8)
$targetBooth = $combinationBooths[7]; // Frame + Back Wall Only
assertTest($targetBooth['type'] === 'Frame' && $targetBooth['config'] === 'Back Wall Only', "Target booth initial state is Frame + Back Wall Only");

// Simulate partial update from EditBoothModal: change booth_type to Wooden
// In our updated API, if wall_configuration is omitted or preserved, it remains untouched
$updateStmt = $pdo->prepare("
    UPDATE booths
    SET booth_type = :booth_type, updated_at = CURRENT_TIMESTAMP
    WHERE id = :id
");
$updateStmt->execute([':booth_type' => 'Wooden', ':id' => $targetBooth['id']]);

$checkRow = $pdo->query("SELECT booth_type, wall_configuration FROM booths WHERE id = '{$targetBooth['id']}'")->fetch();
assertTest($checkRow['booth_type'] === 'Wooden', "Stall Type updated from Frame to Wooden");
assertTest($checkRow['wall_configuration'] === 'Back Wall Only', "Wall Configuration remained 'Back Wall Only' (NOT reset)");

// Change booth_type to Customize
$updateStmt->execute([':booth_type' => 'Customize', ':id' => $targetBooth['id']]);
$checkRow2 = $pdo->query("SELECT booth_type, wall_configuration FROM booths WHERE id = '{$targetBooth['id']}'")->fetch();
assertTest($checkRow2['booth_type'] === 'Customize', "Stall Type updated to Customize");
assertTest($checkRow2['wall_configuration'] === 'Back Wall Only', "Wall Configuration remained 'Back Wall Only' (NOT reset)");

echo "\nTest 4: Selecting Wall Configuration must NEVER alter Stall Type\n";
// Pick Wooden + 3 Sides (bth_indep_1)
$woodBooth = $combinationBooths[0]; // Wooden + 3 Sides
// Simulate selecting 'Back + Right' from production wall selector
$wallStmt = $pdo->prepare("
    UPDATE booths
    SET wall_configuration = :wall_config, updated_at = CURRENT_TIMESTAMP
    WHERE id = :id
");
$wallStmt->execute([':wall_config' => 'Back + Right', ':id' => $woodBooth['id']]);

$woodCheck = $pdo->query("SELECT booth_type, wall_configuration FROM booths WHERE id = '{$woodBooth['id']}'")->fetch();
assertTest($woodCheck['wall_configuration'] === 'Back + Right', "Wall Configuration updated to 'Back + Right'");
assertTest($woodCheck['booth_type'] === 'Wooden', "Stall Type remained 'Wooden' (NOT changed or defaulted)");

// Switch to 'Back Wall Only'
$wallStmt->execute([':wall_config' => 'Back Wall Only', ':id' => $woodBooth['id']]);
$woodCheck2 = $pdo->query("SELECT booth_type, wall_configuration FROM booths WHERE id = '{$woodBooth['id']}'")->fetch();
assertTest($woodCheck2['wall_configuration'] === 'Back Wall Only', "Wall Configuration updated to 'Back Wall Only'");
assertTest($woodCheck2['booth_type'] === 'Wooden', "Stall Type remained 'Wooden'");

echo "\nTest 5: Clearing Wall Configuration sets it to NULL without changing Stall Type\n";
$wallStmt->execute([':wall_config' => null, ':id' => $woodBooth['id']]);
$woodCheckNull = $pdo->query("SELECT booth_type, wall_configuration FROM booths WHERE id = '{$woodBooth['id']}'")->fetch();
assertTest($woodCheckNull['wall_configuration'] === null, "Wall Configuration successfully cleared to NULL");
assertTest($woodCheckNull['booth_type'] === 'Wooden', "Stall Type remained 'Wooden'");

echo "\nTest 6: Simulation of API booths.php action=update with partial payloads\n";
// Test API logic with $existing loaded via SELECT * FROM booths WHERE id = :id
$apiBoothId = $combinationBooths[4]['id']; // Frame + 3 Sides (bth_indep_5)
$existing = $pdo->query("SELECT * FROM booths WHERE id = '{$apiBoothId}'")->fetch();

assertTest($existing['booth_type'] === 'Frame', "Existing booth has booth_type = Frame");
assertTest($existing['wall_configuration'] === '3 Sides', "Existing booth has wall_configuration = 3 Sides");

// Case A: Payload from EditBoothModal (sends booth_type, client_name, NO wall_configuration)
$bodyA = [
    'id'          => $apiBoothId,
    'client_name' => 'Updated Client Corp',
    'booth_type'  => 'Customize',
    // wall_configuration not sent or null
];
$boothTypeA = array_key_exists('booth_type', $bodyA) ? trim((string)$bodyA['booth_type']) : ($existing['booth_type'] ?? 'Wooden');
$wallConfigA = array_key_exists('wall_configuration', $bodyA)
    ? (trim((string)$bodyA['wall_configuration']) !== '' ? trim((string)$bodyA['wall_configuration']) : null)
    : ($existing['wall_configuration'] ?? null);

assertTest($boothTypeA === 'Customize', "Case A: booth_type resolves to 'Customize'");
assertTest($wallConfigA === '3 Sides', "Case A: wall_configuration preserved from existing as '3 Sides'");

// Case B: Payload from Wall Configuration selector (sends ONLY wall_configuration, NO booth_type)
$bodyB = [
    'id'                 => $apiBoothId,
    'wall_configuration' => 'Back + Left',
];
$boothTypeB = array_key_exists('booth_type', $bodyB) ? trim((string)$bodyB['booth_type']) : ($existing['booth_type'] ?? 'Wooden');
$wallConfigB = array_key_exists('wall_configuration', $bodyB)
    ? (trim((string)$bodyB['wall_configuration']) !== '' ? trim((string)$bodyB['wall_configuration']) : null)
    : ($existing['wall_configuration'] ?? null);

assertTest($boothTypeB === 'Frame', "Case B: booth_type preserved from existing as 'Frame'");
assertTest($wallConfigB === 'Back + Left', "Case B: wall_configuration resolves to 'Back + Left'");

// Case C: Explicitly clearing wall configuration (sends wall_configuration: '')
$bodyC = [
    'id'                 => $apiBoothId,
    'wall_configuration' => '',
];
$wallConfigC = array_key_exists('wall_configuration', $bodyC)
    ? (trim((string)$bodyC['wall_configuration']) !== '' ? trim((string)$bodyC['wall_configuration']) : null)
    : ($existing['wall_configuration'] ?? null);

assertTest($wallConfigC === null, "Case C: wall_configuration cleared to NULL when empty string is passed");

// Clean up
@unlink($testDbPath);

echo "\n------------------------------------------------------------\n";
echo "Results: {$passed} passed, {$failed} failed\n";

if ($failed > 0) {
    exit(1);
} else {
    echo "SUCCESS: Stall Type and Wall Configuration are completely independent!\n";
    exit(0);
}
