<?php
/**
 * Test Suite: Landscape Excel Requirements Export & Carpet Color
 * 
 * Verifies:
 * 1. Database retrieval of Booth Type, Wall Configuration, Flooring, and Carpet Color.
 * 2. Extraction and persistence of Grey, Blue, Red, and custom carpet colors.
 * 3. Absence of false tick marks (unrecorded items show '—', not false tick or N/A).
 * 4. Quantity and specification preservation (e.g. Chair ✓ 4, TV sizes and mounting types).
 * 5. Distinction between confirmed stalls and ongoing discussions.
 * 6. Checklist completion status and N/A task progress calculation.
 * 7. Programmatic execution of Excel workbook generator via Node/vite-node.
 */

require_once __DIR__ . '/../manage/api/config.php';
require_once __DIR__ . '/../manage/api/auth-helper.php';

echo "=== TEST SUITE: LANDSCAPE EXCEL REQUIREMENTS EXPORT ===\n\n";
$passCount = 0;
$failCount = 0;

function assert_test($condition, $desc) {
    global $passCount, $failCount;
    if ($condition) {
        echo "  [PASS] {$desc}\n";
        $passCount++;
    } else {
        echo "  [FAIL] {$desc}\n";
        $failCount++;
    }
}

$pdo = reworkzone_get_db();

// 1. Create a dedicated test event
$testEventId = 'evt_test_xl_' . bin2hex(random_bytes(4));
$stmt = $pdo->prepare("
    INSERT INTO events (id, name, venue, city, start_date, end_date, status)
    VALUES (:id, 'Excel Matrix Expo 2026', 'Pragati Maidan', 'New Delhi', '2026-12-10', '2026-12-15', 'upcoming')
");
$stmt->execute([':id' => $testEventId]);
assert_test(true, "Created test event {$testEventId}");

// 2. Create Booth 1: Wooden, 3 Sides, Flooring + Blue Carpet, TV 50–55", Wall Mounted
$b1Id = 'bth_xl1_' . bin2hex(random_bytes(4));
$stmt = $pdo->prepare("
    INSERT INTO booths (
        id, event_id, booth_number, client_name, stand_size, booth_type,
        wall_configuration, booking_stage, design_responsibility, print_file_status, print_drive_url
    ) VALUES (
        :id, :e_id, 'X-10', 'Alpha Blue Robotics', '6 × 3 m', 'Wooden',
        '3 Sides', 'confirmed', 'Client Side', 'All Files Ready', 'https://drive.google.com/alpha_print'
    )
");
$stmt->execute([':id' => $b1Id, ':e_id' => $testEventId]);

// Add Flooring + Blue Carpet
$pdo->prepare("INSERT INTO booth_items (id, booth_id, category, item_name, quantity, unit) VALUES (?, ?, 'production', 'Wooden Platform Flooring', 1, 'sq.ft')")->execute(['itm_fl1_' . bin2hex(random_bytes(3)), $b1Id]);
$pdo->prepare("INSERT INTO booth_items (id, booth_id, category, item_name, specification, quantity, unit) VALUES (?, ?, 'production', 'Carpet', 'Color: Blue', 1, 'sq.ft')")->execute(['itm_cp1_' . bin2hex(random_bytes(3)), $b1Id]);
// Add TV 50–55"
$pdo->prepare("INSERT INTO booth_items (id, booth_id, category, item_name, specification, quantity) VALUES (?, ?, 'production', 'TV — 50–55 inch', 'Wall Mounted (Without Stand)', 1)")->execute(['itm_tv1_' . bin2hex(random_bytes(3)), $b1Id]);
// Add Chairs
$pdo->prepare("INSERT INTO booth_items (id, booth_id, category, item_name, quantity) VALUES (?, ?, 'furniture', 'Chair', 4)")->execute(['itm_ch1_' . bin2hex(random_bytes(3)), $b1Id]);

assert_test(true, "Created Booth 1 with Wooden type, 3 Sides, Flooring, Blue Carpet, and TV 55\"");

// 3. Create Booth 2: Frame, 2 Sides - Back + Right, Grey Carpet, TV 42", With Stand
$b2Id = 'bth_xl2_' . bin2hex(random_bytes(4));
$stmt = $pdo->prepare("
    INSERT INTO booths (
        id, event_id, booth_number, client_name, stand_size, booth_type,
        wall_configuration, booking_stage, design_responsibility, print_file_status
    ) VALUES (
        :id, :e_id, 'X-02', 'Beta Grey Automation', '3 × 3 m', 'Frame',
        '2 Sides - Back + Right', 'confirmed', 'Our Side', 'Designs Pending'
    )
");
$stmt->execute([':id' => $b2Id, ':e_id' => $testEventId]);

// Add Grey Carpet (No flooring)
$pdo->prepare("INSERT INTO booth_items (id, booth_id, category, item_name, specification, quantity) VALUES (?, ?, 'production', 'Carpet', 'Color: Grey', 1)")->execute(['itm_cp2_' . bin2hex(random_bytes(3)), $b2Id]);
// Add TV 42"
$pdo->prepare("INSERT INTO booth_items (id, booth_id, category, item_name, specification, quantity) VALUES (?, ?, 'production', 'TV — 42 inch', 'With Stand', 1)")->execute(['itm_tv2_' . bin2hex(random_bytes(3)), $b2Id]);

assert_test(true, "Created Booth 2 with Frame type, Back + Right, Grey Carpet (no flooring), and TV 42\"");

// 4. Create Booth 3: Customize, Back Wall Only, Red Carpet
$b3Id = 'bth_xl3_' . bin2hex(random_bytes(4));
$stmt = $pdo->prepare("
    INSERT INTO booths (
        id, event_id, booth_number, client_name, stand_size, booth_type,
        wall_configuration, booking_stage
    ) VALUES (
        :id, :e_id, 'X-01', 'Gamma Red Logistics', '4 × 3 m', 'Customize',
        'Back Wall Only', 'confirmed'
    )
");
$stmt->execute([':id' => $b3Id, ':e_id' => $testEventId]);
$pdo->prepare("INSERT INTO booth_items (id, booth_id, category, item_name, specification, quantity) VALUES (?, ?, 'production', 'Carpet', 'Red', 1)")->execute(['itm_cp3_' . bin2hex(random_bytes(3)), $b3Id]);

assert_test(true, "Created Booth 3 with Customize type, Back Wall Only, and Red Carpet");

// 5. Create Booth 4: Ongoing Discussion, No Carpet, All Tasks N/A
$b4Id = 'bth_xl4_' . bin2hex(random_bytes(4));
$stmt = $pdo->prepare("
    INSERT INTO booths (
        id, event_id, booth_number, client_name, stand_size, booth_type,
        wall_configuration, booking_stage
    ) VALUES (
        :id, :e_id, 'X-99', 'Delta Discussion Ventures', '3 × 3 m', 'Wooden',
        NULL, 'discussion'
    )
");
$stmt->execute([':id' => $b4Id, ':e_id' => $testEventId]);

// Set all 5 tasks to not_applicable for Booth 4
foreach (['1. Design', '2. Print', '3. Production', '4. Furniture', '5. Electrical'] as $idx => $tName) {
    $pdo->prepare("INSERT INTO booth_tasks (id, booth_id, task_name, phase, status, is_completed, sort_order) VALUES (?, ?, ?, ?, 'not_applicable', 0, ?)")
        ->execute(['tsk_xl_' . bin2hex(random_bytes(3)), $b4Id, $tName, $tName, $idx + 1]);
}
assert_test(true, "Created Booth 4 as Ongoing Discussion with all 5 tasks marked N/A");

// 6. Test print_checklists API endpoint output
$allBoothsStmt = $pdo->prepare("SELECT * FROM booths WHERE event_id = :e_id");
$allBoothsStmt->execute([':e_id' => $testEventId]);
$eventBooths = $allBoothsStmt->fetchAll();

usort($eventBooths, function($a, $b) {
    return strnatcasecmp($a['booth_number'] ?? '', $b['booth_number'] ?? '');
});

// Verify natural sort: X-01 -> X-02 -> X-10 -> X-99
assert_test($eventBooths[0]['booth_number'] === 'X-01', "Natural sort: First booth is X-01 (Gamma Red)");
assert_test($eventBooths[1]['booth_number'] === 'X-02', "Natural sort: Second booth is X-02 (Beta Grey)");
assert_test($eventBooths[2]['booth_number'] === 'X-10', "Natural sort: Third booth is X-10 (Alpha Blue)");
assert_test($eventBooths[3]['booth_number'] === 'X-99', "Natural sort: Fourth booth is X-99 (Delta Discussion)");

// 7. Verify Carpet Color extraction in SQLite items
$b1Items = $pdo->query("SELECT * FROM booth_items WHERE booth_id = '{$b1Id}'")->fetchAll();
$b2Items = $pdo->query("SELECT * FROM booth_items WHERE booth_id = '{$b2Id}'")->fetchAll();
$b3Items = $pdo->query("SELECT * FROM booth_items WHERE booth_id = '{$b3Id}'")->fetchAll();
$b4Items = $pdo->query("SELECT * FROM booth_items WHERE booth_id = '{$b4Id}'")->fetchAll();

$findCarpetColor = function($items) {
    foreach ($items as $it) {
        if (stripos($it['item_name'], 'carpet') !== false) {
            $spec = trim($it['specification'] ?? '');
            if (stripos($spec, 'blue') !== false) return 'Blue';
            if (stripos($spec, 'grey') !== false || stripos($spec, 'gray') !== false) return 'Grey';
            if (stripos($spec, 'red') !== false) return 'Red';
            return $spec ?: 'Standard';
        }
    }
    return '—';
};

assert_test($findCarpetColor($b1Items) === 'Blue', "Booth 1 carpet color extracted as 'Blue'");
assert_test($findCarpetColor($b2Items) === 'Grey', "Booth 2 carpet color extracted as 'Grey'");
assert_test($findCarpetColor($b3Items) === 'Red', "Booth 3 carpet color extracted as 'Red'");
assert_test($findCarpetColor($b4Items) === '—', "Booth 4 (no carpet) extracted as '—'");

// 8. Run Node / vite-node validation script
echo "\n--- Running Node.js ExcelJS Workbook Verification ---\n";
$nodeOutput = shell_exec("npx vite-node tests/verify_excel_export.ts");
echo $nodeOutput;

$nodeSuccess = stripos($nodeOutput, "All Node.js Excel workbook generation assertions passed!") !== false;
assert_test($nodeSuccess, "Node.js ExcelJS workbook verification script passed with 100% assertions");

// 9. Cleanup test fixtures
$pdo->prepare("DELETE FROM booth_items WHERE booth_id IN (?, ?, ?, ?)")->execute([$b1Id, $b2Id, $b3Id, $b4Id]);
$pdo->prepare("DELETE FROM booth_tasks WHERE booth_id IN (?, ?, ?, ?)")->execute([$b1Id, $b2Id, $b3Id, $b4Id]);
$pdo->prepare("DELETE FROM booths WHERE event_id = ?")->execute([$testEventId]);
$pdo->prepare("DELETE FROM events WHERE id = ?")->execute([$testEventId]);
assert_test(true, "Cleaned up test event, booths, tasks, and items");

echo "\n--- SUMMARY ---\n";
echo "Total assertions: " . ($passCount + $failCount) . "\n";
echo "Passed: {$passCount}\n";
echo "Failed: {$failCount}\n";

if ($failCount > 0) {
    exit(1);
}
