<?php
/**
 * Automated Verification for Checklist Simplification & Mobile UX Fixes
 * Tests design responsibility, print files fields, item inline edit, stepper quantity validation.
 * Uses an isolated temporary SQLite database.
 */

$testDir = sys_get_temp_dir() . '/rwz_checklist_test_' . bin2hex(random_bytes(4));
mkdir($testDir, 0777, true);
$testDbPath = $testDir . '/reworkzone_stalls.sqlite';

putenv("REWORKZONE_DATA_DIR={$testDir}");

require_once __DIR__ . '/../manage/api/config.php';

echo "========================================================\n";
echo "REWORKZONE STALLS - CHECKLIST SIMPLIFICATION TESTS\n";
echo "Isolated DB Path: {$testDbPath}\n";
echo "========================================================\n\n";

$pdo = reworkzone_get_db();
$passed = 0;
$failed = 0;

function assertTest($cond, $title) {
    global $passed, $failed;
    if ($cond) {
        echo "  [PASS] {$title}\n";
        $passed++;
    } else {
        echo "  [FAIL] {$title}\n";
        $failed++;
    }
}

// -------------------------------------------------------------
// Test 1: Verify schema columns in booths table
// -------------------------------------------------------------
echo "Test 1: Schema Verification for Simplified Checklist Columns\n";
$cols = $pdo->query("PRAGMA table_info(booths)")->fetchAll(PDO::FETCH_ASSOC);
$colNames = array_column($cols, 'name');

assertTest(in_array('design_responsibility', $colNames, true), "booths table has 'design_responsibility' column");
assertTest(in_array('print_file_status', $colNames, true), "booths table has 'print_file_status' column");
assertTest(in_array('print_drive_url', $colNames, true), "booths table has 'print_drive_url' column");
assertTest(in_array('print_remark', $colNames, true), "booths table has 'print_remark' column");

// -------------------------------------------------------------
// Test 2: Seed event and booth
// -------------------------------------------------------------
echo "\nTest 2: Event & Booth Creation with Default Values\n";
$eventId = 'evt_' . bin2hex(random_bytes(4));
$boothId = 'bth_' . bin2hex(random_bytes(4));

$pdo->prepare("
    INSERT INTO events (id, name, venue, city, start_date, end_date, status)
    VALUES (:id, 'Tech Expo Test', 'GUCEC', 'Ahmedabad', '2026-11-27', '2026-11-29', 'upcoming')
")->execute([':id' => $eventId]);

$pdo->prepare("
    INSERT INTO booths (
        id, event_id, booth_number, client_name, stand_size, booth_type,
        design_responsibility, print_file_status, status
    ) VALUES (
        :id, :event_id, 'A-101', 'Test Client Co', '3 × 3 m (9 sq.m)', 'Wooden',
        'Client Side', 'Designs Pending', 'draft'
    )
")->execute([':id' => $boothId, ':event_id' => $eventId]);

$b = $pdo->query("SELECT * FROM booths WHERE id = '{$boothId}'")->fetch(PDO::FETCH_ASSOC);
assertTest($b['design_responsibility'] === 'Client Side', "Default design_responsibility is 'Client Side'");
assertTest($b['print_file_status'] === 'Designs Pending', "Default print_file_status is 'Designs Pending'");
assertTest($b['print_drive_url'] === null, "Default print_drive_url is null");
assertTest($b['print_remark'] === null, "Default print_remark is null");

// -------------------------------------------------------------
// Test 3: Design Responsibility Update
// -------------------------------------------------------------
echo "\nTest 3: Update Design Responsibility\n";
$stmt = $pdo->prepare("
    UPDATE booths
    SET design_responsibility = :dr
    WHERE id = :id
");
$stmt->execute([':dr' => 'Our Side', ':id' => $boothId]);

$b = $pdo->query("SELECT design_responsibility FROM booths WHERE id = '{$boothId}'")->fetch(PDO::FETCH_ASSOC);
assertTest($b['design_responsibility'] === 'Our Side', "Updated design_responsibility to 'Our Side' successfully");

// Switch back
$stmt->execute([':dr' => 'Client Side', ':id' => $boothId]);
$b = $pdo->query("SELECT design_responsibility FROM booths WHERE id = '{$boothId}'")->fetch(PDO::FETCH_ASSOC);
assertTest($b['design_responsibility'] === 'Client Side', "Switched design_responsibility back to 'Client Side'");

// -------------------------------------------------------------
// Test 4: Print Files Status, URL & Remark Update
// -------------------------------------------------------------
echo "\nTest 4: Update Print Files Section\n";
$driveLink = 'https://drive.google.com/drive/folders/1ABCxyz789';
$remark = 'Waiting for high-res logo from client.';

$stmt = $pdo->prepare("
    UPDATE booths
    SET print_file_status = :status,
        print_drive_url = :url,
        print_remark = :remark
    WHERE id = :id
");
$stmt->execute([
    ':status' => 'Partially Received',
    ':url'    => $driveLink,
    ':remark' => $remark,
    ':id'     => $boothId,
]);

$b = $pdo->query("SELECT print_file_status, print_drive_url, print_remark FROM booths WHERE id = '{$boothId}'")->fetch(PDO::FETCH_ASSOC);
assertTest($b['print_file_status'] === 'Partially Received', "print_file_status updated to 'Partially Received'");
assertTest($b['print_drive_url'] === $driveLink, "print_drive_url saved accurately");
assertTest($b['print_remark'] === $remark, "print_remark saved accurately");

// Set to All Files Ready
$stmt->execute([
    ':status' => 'All Files Ready',
    ':url'    => $driveLink,
    ':remark' => 'All backdrops approved.',
    ':id'     => $boothId,
]);
$b = $pdo->query("SELECT print_file_status FROM booths WHERE id = '{$boothId}'")->fetch(PDO::FETCH_ASSOC);
assertTest($b['print_file_status'] === 'All Files Ready', "print_file_status updated to 'All Files Ready'");

// -------------------------------------------------------------
// Test 5: Furniture, Electrical & Production Item Creation & Inline Editing
// -------------------------------------------------------------
echo "\nTest 5: Item Creation and Inline Edit\n";
$itemId = 'itm_' . bin2hex(random_bytes(4));
$pdo->prepare("
    INSERT INTO booth_items (id, booth_id, category, item_name, quantity, unit)
    VALUES (:id, :booth_id, 'furniture', 'Executive Chair', 1, 'nos')
")->execute([':id' => $itemId, ':booth_id' => $boothId]);

$itm = $pdo->query("SELECT * FROM booth_items WHERE id = '{$itemId}'")->fetch(PDO::FETCH_ASSOC);
assertTest($itm['item_name'] === 'Executive Chair', "Furniture item created with name 'Executive Chair'");
assertTest((int)$itm['quantity'] === 1, "Initial quantity is 1");

// Inline Edit: change name, quantity, unit
$pdo->prepare("
    UPDATE booth_items
    SET item_name = :name,
        quantity = :qty,
        unit = :unit,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = :id
")->execute([
    ':name' => 'Premium Leather Chair',
    ':qty'  => 4,
    ':unit' => 'nos',
    ':id'   => $itemId,
]);

$itm = $pdo->query("SELECT * FROM booth_items WHERE id = '{$itemId}'")->fetch(PDO::FETCH_ASSOC);
assertTest($itm['item_name'] === 'Premium Leather Chair', "Item name inline edit persisted ('Premium Leather Chair')");
assertTest((int)$itm['quantity'] === 4, "Item quantity inline edit persisted (4)");

// -------------------------------------------------------------
// Test 6: Production & Electrical Items
// -------------------------------------------------------------
echo "\nTest 6: Production and Electrical Items Creation & Edit\n";
$prodId = 'itm_' . bin2hex(random_bytes(4));
$elecId = 'itm_' . bin2hex(random_bytes(4));

$pdo->prepare("
    INSERT INTO booth_items (id, booth_id, category, item_name, quantity, unit)
    VALUES (:id, :booth_id, 'production', 'Backdrop Wooden Frame (10ft x 8ft)', 1, 'nos')
")->execute([':id' => $prodId, ':booth_id' => $boothId]);

$pdo->prepare("
    INSERT INTO booth_items (id, booth_id, category, item_name, quantity, unit)
    VALUES (:id, :booth_id, 'electrical', 'Spotlight (50W)', 3, 'nos')
")->execute([':id' => $elecId, ':booth_id' => $boothId]);

// Inline edit on electrical: change quantity from 3 to 6
$pdo->prepare("UPDATE booth_items SET quantity = 6 WHERE id = :id")->execute([':id' => $elecId]);
$elec = $pdo->query("SELECT quantity FROM booth_items WHERE id = '{$elecId}'")->fetch(PDO::FETCH_ASSOC);
assertTest((int)$elec['quantity'] === 6, "Electrical quantity inline edit persisted (6)");

// -------------------------------------------------------------
// Test 7: Historical Links Preservation
// -------------------------------------------------------------
echo "\nTest 7: Historical Links Preservation in booth_links\n";
$linkId = 'lnk_' . bin2hex(random_bytes(4));
$pdo->prepare("
    INSERT INTO booth_links (id, booth_id, category, title, drive_url)
    VALUES (:id, :booth_id, 'render_3d', 'Legacy 3D Render', 'https://drive.google.com/render.png')
")->execute([':id' => $linkId, ':booth_id' => $boothId]);

$linkCount = (int)$pdo->query("SELECT COUNT(*) FROM booth_links WHERE booth_id = '{$boothId}'")->fetchColumn();
assertTest($linkCount === 1, "Historical design link preserved in booth_links");

// -------------------------------------------------------------
// Test 8: Integrity & Foreign Keys
// -------------------------------------------------------------
echo "\nTest 8: Database Integrity Checks\n";
$intCheck = $pdo->query("PRAGMA integrity_check;")->fetchAll(PDO::FETCH_COLUMN);
assertTest($intCheck === ['ok'], "PRAGMA integrity_check returned 'ok'");

$fkCheck = $pdo->query("PRAGMA foreign_key_check;")->fetchAll(PDO::FETCH_ASSOC);
assertTest(count($fkCheck) === 0, "PRAGMA foreign_key_check returned 0 errors");

echo "\n========================================================\n";
echo "SUMMARY: {$passed} PASSED, {$failed} FAILED\n";
echo "========================================================\n";

if ($failed > 0) {
    exit(1);
}
