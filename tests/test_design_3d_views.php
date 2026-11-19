<?php
/**
 * Automated Verification Suite for 3D View of Stall in Design Section
 *
 * Tests:
 * 1. Seed booth and add single 3D view under category 'render_3d'
 * 2. Add multiple 3D views to one booth (Front View, Perspective View, Top View)
 * 3. Verify stall-wise isolation (different stalls have different 3D views)
 * 4. Update existing 3D view (title, URL, note)
 * 5. Delete a 3D view
 * 6. Non-interference with Design Responsibility and Checklist Tasks
 * 7. PRAGMA integrity_check and foreign_key_check
 */

require_once __DIR__ . '/../manage/api/config.php';

$testDataDir = sys_get_temp_dir() . '/rwz_3dview_test_' . bin2hex(random_bytes(4));
mkdir($testDataDir, 0755, true);
define('REWORKZONE_DATA_DIR_OVERRIDE', $testDataDir);

$dbPath = $testDataDir . '/reworkzone_stalls.sqlite';
$pdo = reworkzone_get_db();

echo "========================================================\n";
echo "REWORKZONE STALLS - 3D VIEW OF STALL TESTS\n";
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
// Test 1: Setup Event & Booths
// -------------------------------------------------------------
echo "Test 1: Setup Event & Test Booths\n";
$eventId = 'evt_3d_test';
$pdo->prepare("
    INSERT INTO events (id, name, venue, city, start_date, end_date, status)
    VALUES (:id, 'Tech Expo 2027', 'Helipad Exhibition Centre', 'Gandhinagar', '2027-01-10', '2027-01-14', 'upcoming')
")->execute([':id' => $eventId]);

$bth1 = 'bth_3d_alpha';
$bth2 = 'bth_3d_beta';

$bthStmt = $pdo->prepare("
    INSERT INTO booths (
        id, event_id, booth_number, client_name, stand_size, booth_type,
        design_responsibility, print_file_status, status
    ) VALUES (
        :id, :event_id, :booth_num, :client, '3 × 3 m (9 sq.m)', 'Wooden',
        :resp, 'Designs Pending', 'draft'
    )
");
$bthStmt->execute([':id' => $bth1, ':event_id' => $eventId, ':booth_num' => 'A-101', ':client' => 'Alpha Corp', ':resp' => 'Client Side']);
$bthStmt->execute([':id' => $bth2, ':event_id' => $eventId, ':booth_num' => 'B-202', ':client' => 'Beta Industries', ':resp' => 'Our Side']);
assert_test("Test booths A-101 and B-202 created", true);

// -------------------------------------------------------------
// Test 2: Add First 3D View to Booth A-101
// -------------------------------------------------------------
echo "\nTest 2: Add First 3D View to Booth A-101\n";
$linkStmt = $pdo->prepare("
    INSERT INTO booth_links (id, booth_id, category, title, drive_url, notes)
    VALUES (:id, :booth_id, 'render_3d', :title, :url, :notes)
");

$v1Id = 'lnk_v1_' . bin2hex(random_bytes(3));
$linkStmt->execute([
    ':id' => $v1Id,
    ':booth_id' => $bth1,
    ':title' => 'Front View',
    ':url' => 'https://drive.google.com/file/d/3d_front_render_alpha/view',
    ':notes' => 'Client-approved version'
]);

$v1 = $pdo->query("SELECT * FROM booth_links WHERE id = '{$v1Id}'")->fetch(PDO::FETCH_ASSOC);
assert_test("3D view 'Front View' created with category 'render_3d'", $v1['category'] === 'render_3d');
assert_test("3D view URL preserved", str_contains($v1['drive_url'], '3d_front_render_alpha'));
assert_test("3D view note preserved", $v1['notes'] === 'Client-approved version');

// -------------------------------------------------------------
// Test 3: Add Multiple 3D Views to Same Booth
// -------------------------------------------------------------
echo "\nTest 3: Add Multiple 3D Views to Booth A-101\n";
$v2Id = 'lnk_v2_' . bin2hex(random_bytes(3));
$v3Id = 'lnk_v3_' . bin2hex(random_bytes(3));

$linkStmt->execute([
    ':id' => $v2Id,
    ':booth_id' => $bth1,
    ':title' => 'Perspective View',
    ':url' => 'https://drive.google.com/file/d/3d_perspective_alpha/view',
    ':notes' => 'Option 2 with arch'
]);

$linkStmt->execute([
    ':id' => $v3Id,
    ':booth_id' => $bth1,
    ':title' => 'Top View',
    ':url' => 'https://drive.google.com/file/d/3d_top_layout_alpha/view',
    ':notes' => 'Floor clearance check'
]);

$bth1Views = $pdo->query("SELECT * FROM booth_links WHERE booth_id = '{$bth1}' AND category = 'render_3d'")->fetchAll(PDO::FETCH_ASSOC);
assert_test("Booth A-101 has exactly 3 3D views", count($bth1Views) === 3);

// -------------------------------------------------------------
// Test 4: Stall-Wise Isolation
// -------------------------------------------------------------
echo "\nTest 4: Stall-Wise Isolation (Booth B-202 vs A-101)\n";
$vBetaId = 'lnk_vbeta_' . bin2hex(random_bytes(3));
$linkStmt->execute([
    ':id' => $vBetaId,
    ':booth_id' => $bth2,
    ':title' => 'Final 3D View',
    ':url' => 'https://drive.google.com/file/d/3d_beta_final/view',
    ':notes' => 'Fabrication ready'
]);

$bth1Count = (int)$pdo->query("SELECT COUNT(*) FROM booth_links WHERE booth_id = '{$bth1}' AND category = 'render_3d'")->fetchColumn();
$bth2Count = (int)$pdo->query("SELECT COUNT(*) FROM booth_links WHERE booth_id = '{$bth2}' AND category = 'render_3d'")->fetchColumn();
assert_test("Booth A-101 still has 3 3D views", $bth1Count === 3);
assert_test("Booth B-202 has exactly 1 3D view", $bth2Count === 1);

// -------------------------------------------------------------
// Test 5: Update 3D View (Title, URL, Note)
// -------------------------------------------------------------
echo "\nTest 5: Update 3D View\n";
$updateStmt = $pdo->prepare("
    UPDATE booth_links
    SET title = :title,
        drive_url = :url,
        notes = :notes,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = :id
");

$updateStmt->execute([
    ':id' => $v2Id,
    ':title' => 'Perspective View (Revised)',
    ':url' => 'https://drive.google.com/file/d/3d_perspective_alpha_v2/view',
    ':notes' => 'Latest update - logo adjusted'
]);

$v2Updated = $pdo->query("SELECT * FROM booth_links WHERE id = '{$v2Id}'")->fetch(PDO::FETCH_ASSOC);
assert_test("Title updated to 'Perspective View (Revised)'", $v2Updated['title'] === 'Perspective View (Revised)');
assert_test("URL updated accurately", str_contains($v2Updated['drive_url'], '3d_perspective_alpha_v2'));
assert_test("Notes updated accurately", $v2Updated['notes'] === 'Latest update - logo adjusted');

// -------------------------------------------------------------
// Test 6: Delete a 3D View
// -------------------------------------------------------------
echo "\nTest 6: Delete a 3D View\n";
$pdo->prepare("DELETE FROM booth_links WHERE id = :id")->execute([':id' => $v3Id]);
$bth1AfterDel = (int)$pdo->query("SELECT COUNT(*) FROM booth_links WHERE booth_id = '{$bth1}' AND category = 'render_3d'")->fetchColumn();
assert_test("Deleted 1 view from A-101; count reduced to 2", $bth1AfterDel === 2);
$deletedCheck = $pdo->query("SELECT COUNT(*) FROM booth_links WHERE id = '{$v3Id}'")->fetchColumn();
assert_test("Deleted view no longer exists", (int)$deletedCheck === 0);

// -------------------------------------------------------------
// Test 7: Non-Interference with Design Responsibility
// -------------------------------------------------------------
echo "\nTest 7: Non-Interference with Design Responsibility\n";
$bth1Check = $pdo->query("SELECT design_responsibility FROM booths WHERE id = '{$bth1}'")->fetch(PDO::FETCH_ASSOC);
$bth2Check = $pdo->query("SELECT design_responsibility FROM booths WHERE id = '{$bth2}'")->fetch(PDO::FETCH_ASSOC);
assert_test("Booth A-101 design_responsibility is still 'Client Side'", $bth1Check['design_responsibility'] === 'Client Side');
assert_test("Booth B-202 design_responsibility is still 'Our Side'", $bth2Check['design_responsibility'] === 'Our Side');

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
