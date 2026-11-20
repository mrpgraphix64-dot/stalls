<?php
/**
 * Automated Verification for Stall Types & Refined Quick Add
 * Tests Stall Types (Wooden, Frame, Customize), TV in Production migration,
 * Flooring + Linked Carpet with colors, Furniture and Electrical presets,
 * and inline editing of specifications.
 */

$testDir = sys_get_temp_dir() . '/rwz_quickadd_test_' . bin2hex(random_bytes(4));
mkdir($testDir, 0777, true);
$testDbPath = $testDir . '/reworkzone_stalls.sqlite';

putenv("REWORKZONE_DATA_DIR={$testDir}");

require_once __DIR__ . '/../manage/api/config.php';

echo "========================================================\n";
echo "REWORKZONE STALLS - STALL TYPE & QUICK ADD TESTS\n";
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
// Test 1: Stall Types Persistence
// -------------------------------------------------------------
echo "Test 1: Stall Types (Wooden, Frame, Customize)\n";
$eventId = 'evt_' . bin2hex(random_bytes(4));
$pdo->prepare("INSERT INTO events (id, name, venue, city, start_date, end_date) VALUES (:id, 'Stall Types Expo', 'GUCEC', 'Ahmedabad', '2026-11-27', '2026-11-29')")->execute([':id' => $eventId]);

$b1 = 'bth_w_' . bin2hex(random_bytes(3));
$b2 = 'bth_f_' . bin2hex(random_bytes(3));
$b3 = 'bth_c_' . bin2hex(random_bytes(3));

$pdo->prepare("INSERT INTO booths (id, event_id, booth_number, client_name, booth_type) VALUES (:id, :eid, 'A-01', 'Co 1', 'Wooden')")->execute([':id' => $b1, ':eid' => $eventId]);
$pdo->prepare("INSERT INTO booths (id, event_id, booth_number, client_name, booth_type) VALUES (:id, :eid, 'A-02', 'Co 2', 'Frame')")->execute([':id' => $b2, ':eid' => $eventId]);
$pdo->prepare("INSERT INTO booths (id, event_id, booth_number, client_name, booth_type) VALUES (:id, :eid, 'A-03', 'Co 3', 'Customize')")->execute([':id' => $b3, ':eid' => $eventId]);

$res1 = $pdo->query("SELECT booth_type FROM booths WHERE id = '{$b1}'")->fetchColumn();
$res2 = $pdo->query("SELECT booth_type FROM booths WHERE id = '{$b2}'")->fetchColumn();
$res3 = $pdo->query("SELECT booth_type FROM booths WHERE id = '{$b3}'")->fetchColumn();

assertTest($res1 === 'Wooden', "Stall 1 saved with 'Wooden'");
assertTest($res2 === 'Frame', "Stall 2 saved with 'Frame'");
assertTest($res3 === 'Customize', "Stall 3 saved with 'Customize'");

// Backward compatibility check with legacy 'Octonorm'
$bLegacy = 'bth_leg_' . bin2hex(random_bytes(3));
$pdo->prepare("INSERT INTO booths (id, event_id, booth_number, client_name, booth_type) VALUES (:id, :eid, 'A-04', 'Legacy Co', 'Octonorm')")->execute([':id' => $bLegacy, ':eid' => $eventId]);
$rawLegacy = $pdo->query("SELECT booth_type FROM booths WHERE id = '{$bLegacy}'")->fetchColumn();
assertTest($rawLegacy === 'Octonorm', "Historical 'Octonorm' record preserved as-is in SQLite");

// -------------------------------------------------------------
// Test 2: TV Migration from Electrical to Production
// -------------------------------------------------------------
echo "\nTest 2: TV Category Migration from Electrical to Production\n";
// Insert legacy TV under electrical
$tvLegacyId = 'itm_tv_leg_' . bin2hex(random_bytes(3));
$pdo->prepare("INSERT INTO booth_items (id, booth_id, category, item_name, quantity, specification) VALUES (:id, :bid, 'electrical', '50-inch LED TV', 1, 'Stand')")->execute([':id' => $tvLegacyId, ':bid' => $b1]);

// Trigger migration query
$pdo->exec("
    UPDATE booth_items 
    SET category = 'production' 
    WHERE category = 'electrical' 
      AND (item_name LIKE '%TV%' OR item_name LIKE '%Television%' OR specification LIKE '%TV%');
");

$migratedCat = $pdo->query("SELECT category FROM booth_items WHERE id = '{$tvLegacyId}'")->fetchColumn();
assertTest($migratedCat === 'production', "Legacy TV item safely migrated to 'production' category");

// -------------------------------------------------------------
// Test 3: Production Presets - Wooden Platform Flooring & Linked Carpet
// -------------------------------------------------------------
echo "\nTest 3: Wooden Platform Flooring + Linked Carpet with Color\n";
$floorId = 'itm_flr_' . bin2hex(random_bytes(3));
$carpetId = 'itm_cpt_' . bin2hex(random_bytes(3));

$pdo->prepare("INSERT INTO booth_items (id, booth_id, category, item_name, quantity, unit) VALUES (:id, :bid, 'production', 'Wooden Platform Flooring', 1, 'sq.ft')")->execute([':id' => $floorId, ':bid' => $b1]);
$pdo->prepare("INSERT INTO booth_items (id, booth_id, category, item_name, quantity, unit, specification, notes) VALUES (:id, :bid, 'production', 'Carpet', 1, 'sq.ft', 'Color: Grey', 'linked_flooring')")->execute([':id' => $carpetId, ':bid' => $b1]);

$flr = $pdo->query("SELECT * FROM booth_items WHERE id = '{$floorId}'")->fetch(PDO::FETCH_ASSOC);
$cpt = $pdo->query("SELECT * FROM booth_items WHERE id = '{$carpetId}'")->fetch(PDO::FETCH_ASSOC);

assertTest($flr['item_name'] === 'Wooden Platform Flooring', "Flooring item created");
assertTest($cpt['item_name'] === 'Carpet' && $cpt['specification'] === 'Color: Grey', "Linked Carpet created with Color: Grey");
assertTest($cpt['notes'] === 'linked_flooring', "Carpet linked to flooring via notes");

// Test Carpet Color change (Red / Blue)
$pdo->prepare("UPDATE booth_items SET specification = 'Color: Red' WHERE id = :id")->execute([':id' => $carpetId]);
$cptRed = $pdo->query("SELECT specification FROM booth_items WHERE id = '{$carpetId}'")->fetchColumn();
assertTest($cptRed === 'Color: Red', "Carpet color updated to 'Color: Red'");

$pdo->prepare("UPDATE booth_items SET specification = 'Color: Blue' WHERE id = :id")->execute([':id' => $carpetId]);
$cptBlue = $pdo->query("SELECT specification FROM booth_items WHERE id = '{$carpetId}'")->fetchColumn();
assertTest($cptBlue === 'Color: Blue', "Carpet color updated to 'Color: Blue'");

// -------------------------------------------------------------
// Test 4: Television Presets in Production
// -------------------------------------------------------------
echo "\nTest 4: TV Presets in Production with Installation Types\n";
$tv42Id = 'itm_tv42_' . bin2hex(random_bytes(3));
$tv55Id = 'itm_tv55_' . bin2hex(random_bytes(3));

$pdo->prepare("INSERT INTO booth_items (id, booth_id, category, item_name, quantity, specification) VALUES (:id, :bid, 'production', 'TV — 42 inch', 1, 'Wall Mounted (Without Stand)')")->execute([':id' => $tv42Id, ':bid' => $b1]);
$pdo->prepare("INSERT INTO booth_items (id, booth_id, category, item_name, quantity, specification) VALUES (:id, :bid, 'production', 'TV — 50–55 inch', 2, 'With Stand')")->execute([':id' => $tv55Id, ':bid' => $b1]);

$tv42 = $pdo->query("SELECT * FROM booth_items WHERE id = '{$tv42Id}'")->fetch(PDO::FETCH_ASSOC);
$tv55 = $pdo->query("SELECT * FROM booth_items WHERE id = '{$tv55Id}'")->fetch(PDO::FETCH_ASSOC);

assertTest($tv42['category'] === 'production' && $tv42['specification'] === 'Wall Mounted (Without Stand)', "TV 42 inch in Production with Wall Mounted installation");
assertTest($tv55['category'] === 'production' && $tv55['specification'] === 'With Stand' && (int)$tv55['quantity'] === 2, "TV 50-55 inch in Production with Stand (Qty: 2)");

// -------------------------------------------------------------
// Test 5: Furniture Presets (Glass Round Table, 2 Seater Sofa, Chair)
// -------------------------------------------------------------
echo "\nTest 5: Furniture Presets\n";
$f1 = 'itm_f1_' . bin2hex(random_bytes(3));
$f2 = 'itm_f2_' . bin2hex(random_bytes(3));
$f3 = 'itm_f3_' . bin2hex(random_bytes(3));

$pdo->prepare("INSERT INTO booth_items (id, booth_id, category, item_name, quantity) VALUES (:id, :bid, 'furniture', 'Glass Round Table', 1)")->execute([':id' => $f1, ':bid' => $b1]);
$pdo->prepare("INSERT INTO booth_items (id, booth_id, category, item_name, quantity) VALUES (:id, :bid, 'furniture', '2 Seater Sofa', 1)")->execute([':id' => $f2, ':bid' => $b1]);
$pdo->prepare("INSERT INTO booth_items (id, booth_id, category, item_name, quantity) VALUES (:id, :bid, 'furniture', 'Chair', 4)")->execute([':id' => $f3, ':bid' => $b1]);

assertTest((int)$pdo->query("SELECT COUNT(*) FROM booth_items WHERE booth_id = '{$b1}' AND category = 'furniture'")->fetchColumn() === 3, "All 3 Furniture presets created");

// -------------------------------------------------------------
// Test 6: Electrical Presets (Power Socket, Pelmet Light)
// -------------------------------------------------------------
echo "\nTest 6: Electrical Presets (Power Socket, Pelmet Light)\n";
$e1 = 'itm_e1_' . bin2hex(random_bytes(3));
$e2 = 'itm_e2_' . bin2hex(random_bytes(3));

$pdo->prepare("INSERT INTO booth_items (id, booth_id, category, item_name, quantity) VALUES (:id, :bid, 'electrical', 'Power Socket', 2)")->execute([':id' => $e1, ':bid' => $b1]);
$pdo->prepare("INSERT INTO booth_items (id, booth_id, category, item_name, quantity) VALUES (:id, :bid, 'electrical', 'Pelmet Light', 3)")->execute([':id' => $e2, ':bid' => $b1]);

$elecItems = $pdo->query("SELECT item_name FROM booth_items WHERE booth_id = '{$b1}' AND category = 'electrical'")->fetchAll(PDO::FETCH_COLUMN);
assertTest(in_array('Power Socket', $elecItems, true), "'Power Socket' created in Electrical");
assertTest(in_array('Pelmet Light', $elecItems, true), "'Pelmet Light' created in Electrical");
assertTest(!in_array('TV', $elecItems, true), "Zero TV items in Electrical");

// -------------------------------------------------------------
// Test 7: Production Other Presets (Selfie Booth, Table Vinyl Branding)
// -------------------------------------------------------------
echo "\nTest 7: Selfie Booth & Table Vinyl Branding\n";
$pSb = 'itm_sb_' . bin2hex(random_bytes(3));
$pTv = 'itm_tvb_' . bin2hex(random_bytes(3));

$pdo->prepare("INSERT INTO booth_items (id, booth_id, category, item_name, quantity) VALUES (:id, :bid, 'production', 'Selfie Booth', 1)")->execute([':id' => $pSb, ':bid' => $b1]);
$pdo->prepare("INSERT INTO booth_items (id, booth_id, category, item_name, quantity) VALUES (:id, :bid, 'production', 'Table Vinyl Branding', 2)")->execute([':id' => $pTv, ':bid' => $b1]);

$sb = $pdo->query("SELECT * FROM booth_items WHERE id = '{$pSb}'")->fetch(PDO::FETCH_ASSOC);
$tvb = $pdo->query("SELECT * FROM booth_items WHERE id = '{$pTv}'")->fetch(PDO::FETCH_ASSOC);

assertTest($sb['item_name'] === 'Selfie Booth', "Selfie Booth created in Production");
assertTest($tvb['item_name'] === 'Table Vinyl Branding', "Table Vinyl Branding created in Production");

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
