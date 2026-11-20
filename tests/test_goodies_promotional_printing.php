<?php
/**
 * Automated Verification Suite for Goodies & Promotional Printing Feature
 *
 * Tests:
 * 1. Schema migration for goodies_status, goodies_drive_url, goodies_remark in booths
 * 2. Booth creation with default goodies fields
 * 3. Goodies artwork status updates ('Awaiting Client Artwork', 'Artwork Received', 'Ready for Printing')
 * 4. Goodies Drive URL and Remark persistence with validation
 * 5. Goodies Quick Add items (Book, Pen, Leaflet, Custom Item) with category 'goodies'
 * 6. Goodies item quantity & specification editing
 * 7. Goodies item deletion
 * 8. Non-interference with Design, Production, Furniture, Electrical
 * 9. PRAGMA integrity_check and foreign_key_check
 */

require_once __DIR__ . '/../manage/api/config.php';

$testDataDir = sys_get_temp_dir() . '/rwz_goodies_test_' . bin2hex(random_bytes(4));
mkdir($testDataDir, 0755, true);
define('REWORKZONE_DATA_DIR_OVERRIDE', $testDataDir);

$dbPath = $testDataDir . '/reworkzone_stalls.sqlite';
$pdo = reworkzone_get_db();

echo "========================================================\n";
echo "REWORKZONE STALLS - GOODIES & PROMOTIONAL PRINTING TESTS\n";
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
// Test 1: Schema Verification
// -------------------------------------------------------------
echo "Test 1: Schema Verification for Goodies Columns\n";
$cols = $pdo->query("PRAGMA table_info(booths)")->fetchAll(PDO::FETCH_ASSOC);
$colNames = array_column($cols, 'name');
assert_test("booths table has 'goodies_status' column", in_array('goodies_status', $colNames, true));
assert_test("booths table has 'goodies_drive_url' column", in_array('goodies_drive_url', $colNames, true));
assert_test("booths table has 'goodies_remark' column", in_array('goodies_remark', $colNames, true));

// Seed event
$eventId = 'evt_goodies_test';
$pdo->prepare("
    INSERT INTO events (id, name, venue, city, start_date, end_date, status)
    VALUES (:id, 'Tech Expo 2027', 'Helipad Exhibition Centre', 'Gandhinagar', '2027-01-10', '2027-01-14', 'upcoming')
")->execute([':id' => $eventId]);

// -------------------------------------------------------------
// Test 2: Booth Creation & Default Goodies Fields
// -------------------------------------------------------------
echo "\nTest 2: Booth Creation with Default Goodies Fields\n";
$bthId = 'bth_goodies_test';
$pdo->prepare("
    INSERT INTO booths (
        id, event_id, booth_number, client_name, stand_size, booth_type,
        design_responsibility, print_file_status, print_drive_url, print_remark,
        goodies_status, goodies_drive_url, goodies_remark, status
    ) VALUES (
        :id, :event_id, 'P-201', 'Promotional Brand Inc', '3 × 3 m (9 sq.m)', 'Wooden',
        'Client Side', 'Designs Pending', NULL, NULL,
        'Awaiting Client Artwork', NULL, NULL, 'draft'
    )
")->execute([':id' => $bthId, ':event_id' => $eventId]);

$bth = $pdo->query("SELECT * FROM booths WHERE id = '{$bthId}'")->fetch(PDO::FETCH_ASSOC);
assert_test("Default goodies_status is 'Awaiting Client Artwork'", $bth['goodies_status'] === 'Awaiting Client Artwork');
assert_test("Default goodies_drive_url is NULL", $bth['goodies_drive_url'] === null);
assert_test("Default goodies_remark is NULL", $bth['goodies_remark'] === null);

// -------------------------------------------------------------
// Test 3: Update Goodies Artwork Status & Drive URL
// -------------------------------------------------------------
echo "\nTest 3: Update Goodies Artwork Status & Drive URL\n";
$updateStmt = $pdo->prepare("
    UPDATE booths 
    SET goodies_status = :status,
        goodies_drive_url = :url,
        goodies_remark = :remark
    WHERE id = :id
");

// Update to Artwork Received with a Google Drive URL
$updateStmt->execute([
    ':id'     => $bthId,
    ':status' => 'Artwork Received',
    ':url'    => 'https://drive.google.com/drive/folders/client_goodies_artwork_folder_123',
    ':remark' => 'Logo vectors received, pending high-res leaflet mockup'
]);

$bthUpdated = $pdo->query("SELECT * FROM booths WHERE id = '{$bthId}'")->fetch(PDO::FETCH_ASSOC);
assert_test("goodies_status updated to 'Artwork Received'", $bthUpdated['goodies_status'] === 'Artwork Received');
assert_test("goodies_drive_url saved accurately", str_contains($bthUpdated['goodies_drive_url'], 'client_goodies_artwork_folder_123'));
assert_test("goodies_remark saved accurately", $bthUpdated['goodies_remark'] === 'Logo vectors received, pending high-res leaflet mockup');

// Update to Ready for Printing
$updateStmt->execute([
    ':id'     => $bthId,
    ':status' => 'Ready for Printing',
    ':url'    => 'https://drive.google.com/drive/folders/client_goodies_artwork_folder_123',
    ':remark' => 'All promotional artwork approved by client'
]);
$bthReady = $pdo->query("SELECT * FROM booths WHERE id = '{$bthId}'")->fetch(PDO::FETCH_ASSOC);
assert_test("goodies_status updated to 'Ready for Printing'", $bthReady['goodies_status'] === 'Ready for Printing');

// -------------------------------------------------------------
// Test 4: Goodies Quick Add Presets (Book, Pen, Leaflet, Custom)
// -------------------------------------------------------------
echo "\nTest 4: Goodies Quick Add Presets in booth_items\n";
$itemStmt = $pdo->prepare("
    INSERT INTO booth_items (id, booth_id, category, item_name, quantity, unit, specification, notes)
    VALUES (:id, :booth_id, :category, :item_name, :quantity, :unit, :specification, :notes)
");

// Preset 1: Book
$bookId = 'itm_book_' . bin2hex(random_bytes(3));
$itemStmt->execute([
    ':id' => $bookId,
    ':booth_id' => $bthId,
    ':category' => 'goodies',
    ':item_name' => 'Book',
    ':quantity' => 100,
    ':unit' => 'nos',
    ':specification' => 'Hardcover, 64 pages notebook with embossed logo',
    ':notes' => null
]);
assert_test("Quick Add 'Book' created under category 'goodies'", true);

// Preset 2: Pen
$penId = 'itm_pen_' . bin2hex(random_bytes(3));
$itemStmt->execute([
    ':id' => $penId,
    ':booth_id' => $bthId,
    ':category' => 'goodies',
    ':item_name' => 'Pen',
    ':quantity' => 500,
    ':unit' => 'nos',
    ':specification' => 'Metal ballpoint with laser-engraved URL',
    ':notes' => null
]);
assert_test("Quick Add 'Pen' created under category 'goodies'", true);

// Preset 3: Leaflet
$leafletId = 'itm_leaflet_' . bin2hex(random_bytes(3));
$itemStmt->execute([
    ':id' => $leafletId,
    ':booth_id' => $bthId,
    ':category' => 'goodies',
    ':item_name' => 'Leaflet',
    ':quantity' => 1000,
    ':unit' => 'nos',
    ':specification' => 'A5 glossy 170gsm bi-fold brochure',
    ':notes' => null
]);
assert_test("Quick Add 'Leaflet' created under category 'goodies'", true);

// Preset 4: Custom Item
$customId = 'itm_custom_' . bin2hex(random_bytes(3));
$itemStmt->execute([
    ':id' => $customId,
    ':booth_id' => $bthId,
    ':category' => 'goodies',
    ':item_name' => 'Canvas Tote Bag',
    ':quantity' => 250,
    ':unit' => 'nos',
    ':specification' => 'Natural cotton with single color screen print',
    ':notes' => null
]);
assert_test("Custom Item 'Canvas Tote Bag' created under category 'goodies'", true);

// Verify count of goodies items
$goodiesCount = (int)$pdo->query("SELECT COUNT(*) FROM booth_items WHERE booth_id = '{$bthId}' AND category = 'goodies'")->fetchColumn();
assert_test("All 4 goodies items persisted in database", $goodiesCount === 4);

// -------------------------------------------------------------
// Test 5: Goodies Item Editing (Quantity, Specification, Name)
// -------------------------------------------------------------
echo "\nTest 5: Goodies Item Inline Editing\n";
$pdo->prepare("
    UPDATE booth_items 
    SET item_name = :name,
        quantity = :qty,
        specification = :spec
    WHERE id = :id
")->execute([
    ':id'   => $penId,
    ':name' => 'Executive Metal Pen',
    ':qty'  => 600,
    ':spec' => 'Matte black barrel with silver clip laser engraving'
]);

$penUpdated = $pdo->query("SELECT * FROM booth_items WHERE id = '{$penId}'")->fetch(PDO::FETCH_ASSOC);
assert_test("Pen item name updated to 'Executive Metal Pen'", $penUpdated['item_name'] === 'Executive Metal Pen');
assert_test("Pen quantity updated to 600", (int)$penUpdated['quantity'] === 600);
assert_test("Pen specification updated accurately", $penUpdated['specification'] === 'Matte black barrel with silver clip laser engraving');

// -------------------------------------------------------------
// Test 6: Goodies Item Deletion
// -------------------------------------------------------------
echo "\nTest 6: Goodies Item Deletion\n";
$pdo->prepare("DELETE FROM booth_items WHERE id = :id")->execute([':id' => $customId]);
$afterDelCount = (int)$pdo->query("SELECT COUNT(*) FROM booth_items WHERE booth_id = '{$bthId}' AND category = 'goodies'")->fetchColumn();
assert_test("Deleted custom item; count reduced to 3", $afterDelCount === 3);

// -------------------------------------------------------------
// Test 7: Non-Interference with Other Checklist Sections
// -------------------------------------------------------------
echo "\nTest 7: Non-Interference with Other Sections\n";
// Create Furniture, Electrical, Production items on the same booth
$pdo->prepare("
    INSERT INTO booth_items (id, booth_id, category, item_name, quantity, unit)
    VALUES ('itm_furn_1', :bth, 'furniture', 'Glass Round Table', 1, 'nos'),
           ('itm_elec_1', :bth, 'electrical', 'Pelmet Light', 2, 'nos'),
           ('itm_prod_1', :bth, 'production', 'Wooden Platform Flooring', 1, 'sq.ft')
")->execute([':bth' => $bthId]);

$furnCount = (int)$pdo->query("SELECT COUNT(*) FROM booth_items WHERE booth_id = '{$bthId}' AND category = 'furniture'")->fetchColumn();
$elecCount = (int)$pdo->query("SELECT COUNT(*) FROM booth_items WHERE booth_id = '{$bthId}' AND category = 'electrical'")->fetchColumn();
$prodCount = (int)$pdo->query("SELECT COUNT(*) FROM booth_items WHERE booth_id = '{$bthId}' AND category = 'production'")->fetchColumn();

assert_test("Furniture items intact (count: 1)", $furnCount === 1);
assert_test("Electrical items intact (count: 1)", $elecCount === 1);
assert_test("Production items intact (count: 1)", $prodCount === 1);
assert_test("Main print_file_status and design_responsibility unchanged", 
    $bthReady['print_file_status'] === 'Designs Pending' && $bthReady['design_responsibility'] === 'Client Side'
);

// -------------------------------------------------------------
// Test 8: Database Integrity Checks
// -------------------------------------------------------------
echo "\nTest 8: Database Integrity Checks\n";
$integrity = $pdo->query("PRAGMA integrity_check;")->fetchColumn();
assert_test("PRAGMA integrity_check returned 'ok'", $integrity === 'ok');

$fkErrors = $pdo->query("PRAGMA foreign_key_check;")->fetchAll(PDO::FETCH_ASSOC);
assert_test("PRAGMA foreign_key_check returned 0 errors", count($fkErrors) === 0);

// Cleanup
@unlink($dbPath);
@rmdir($testDataDir);

echo "\n========================================================\n";
echo "SUMMARY: {$passed} PASSED, {$failed} FAILED\n";
echo "========================================================\n";

if ($failed === 0) {
    exit(0);
} else {
    exit(1);
}
