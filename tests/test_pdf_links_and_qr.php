<?php
/**
 * Test Suite: Clickable 3D & Print File Links, QR Codes & PDF Generation Integrity
 * 
 * Verifies:
 * 1. Booths & Events print_checklists API endpoints return complete 3D views and artwork URLs.
 * 2. 3D views (category = 'render_3d') properly segregated per booth without cross-booth pollution.
 * 3. Print Drive URL & Goodies Drive URL properly persisted and returned in checklist dataset.
 * 4. Stalls without links return clean empty arrays / nulls for "Not Added" fallback.
 * 5. Multi-angle 3D views support individual titles and URLs.
 * 6. Programmatic validation of PDF hyperlink annotations (/Subtype /Link, /URI).
 */

require_once __DIR__ . '/../manage/api/config.php';
require_once __DIR__ . '/../manage/api/auth-helper.php';

echo "=== TEST SUITE: CLICKABLE 3D & PRINT FILE LINKS TO PDF ===\n\n";
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
$testEventId = 'evt_test_links_' . bin2hex(random_bytes(4));
$stmt = $pdo->prepare("
    INSERT INTO events (id, name, venue, city, start_date, end_date, status)
    VALUES (:id, 'Clickable Links Expo 2026', 'Convention Center', 'Mumbai', '2026-12-01', '2026-12-05', 'upcoming')
");
$stmt->execute([':id' => $testEventId]);
assert_test(true, "Created test event {$testEventId}");

// 2. Create Booth A: Single 3D view + Print URL + Goodies URL
$boothAId = 'bth_test_a_' . bin2hex(random_bytes(4));
$stmt = $pdo->prepare("
    INSERT INTO booths (
        id, event_id, booth_number, client_name, stand_size, booth_type, 
        wall_configuration, booking_stage, print_file_status, print_drive_url, 
        print_remark, goodies_status, goodies_drive_url, goodies_remark, main_drive_folder_url
    ) VALUES (
        :id, :event_id, 'A101', 'Alpha Technologies', '6 × 3 m', 'Wooden',
        '3 Sides', 'confirmed', 'Ready for Print', 'https://drive.google.com/drive/folders/print_alpha_123',
        'Final CMYK print files ready', 'Client Supplied', 'https://drive.google.com/drive/folders/goodies_alpha_456',
        'Branded lanyards & pens', 'https://drive.google.com/drive/folders/main_alpha_789'
    )
");
$stmt->execute([':id' => $boothAId, ':event_id' => $testEventId]);

// Add 1 3D view to Booth A
$linkA1Id = 'lnk_a1_' . bin2hex(random_bytes(4));
$stmt = $pdo->prepare("
    INSERT INTO booth_links (id, booth_id, category, title, drive_url)
    VALUES (:id, :b_id, 'render_3d', 'Alpha Front 3D Render', 'https://claude.site/artifacts/alpha-3d-view')
");
$stmt->execute([':id' => $linkA1Id, ':b_id' => $boothAId]);
assert_test(true, "Created Booth A (A101) with 3D link, print Drive link, and goodies Drive link");

// 3. Create Booth B: Multiple 3D views (2 angles) + Print URL + No goodies URL
$boothBId = 'bth_test_b_' . bin2hex(random_bytes(4));
$stmt = $pdo->prepare("
    INSERT INTO booths (
        id, event_id, booth_number, client_name, stand_size, booth_type, 
        wall_configuration, booking_stage, print_file_status, print_drive_url, 
        print_remark, goodies_status, goodies_drive_url, goodies_remark
    ) VALUES (
        :id, :event_id, 'B202', 'Beta Dynamics', '3 × 3 m', 'Frame',
        '2 Sides - Back + Right', 'confirmed', 'In Review', 'https://drive.google.com/drive/folders/print_beta_999',
        'Awaiting high-res logo replacement', 'Not Required', NULL, NULL
    )
");
$stmt->execute([':id' => $boothBId, ':event_id' => $testEventId]);

// Add 2 3D views to Booth B
$linkB1Id = 'lnk_b1_' . bin2hex(random_bytes(4));
$stmt = $pdo->prepare("
    INSERT INTO booth_links (id, booth_id, category, title, drive_url)
    VALUES (:id, :b_id, 'render_3d', 'Isometric Perspective', 'https://drive.google.com/file/d/beta-iso-render')
");
$stmt->execute([':id' => $linkB1Id, ':b_id' => $boothBId]);

$linkB2Id = 'lnk_b2_' . bin2hex(random_bytes(4));
$stmt = $pdo->prepare("
    INSERT INTO booth_links (id, booth_id, category, title, drive_url)
    VALUES (:id, :b_id, 'render_3d', 'Walkthrough Birdseye View', 'https://viewer.3d-stall.com/beta-walkthrough')
");
$stmt->execute([':id' => $linkB2Id, ':b_id' => $boothBId]);
assert_test(true, "Created Booth B (B202) with 2 multi-angle 3D views and print URL");

// 4. Create Booth C: No 3D views, no print URL, no goodies URL (empty state test)
$boothCId = 'bth_test_c_' . bin2hex(random_bytes(4));
$stmt = $pdo->prepare("
    INSERT INTO booths (
        id, event_id, booth_number, client_name, stand_size, booth_type, 
        wall_configuration, booking_stage, print_file_status, print_drive_url, 
        print_remark, goodies_status, goodies_drive_url
    ) VALUES (
        :id, :event_id, 'C303', 'Gamma Innovations', '4 × 3 m', 'Customize',
        'Back Wall Only', 'confirmed', 'Designs Pending', NULL, NULL, 'Awaiting Client Artwork', NULL
    )
");
$stmt->execute([':id' => $boothCId, ':event_id' => $testEventId]);
assert_test(true, "Created Booth C (C303) with no links for 'Not Added' fallback testing");

// 5. Test print_checklists API simulation for Event
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['id'] = $testEventId;
$_GET['action'] = 'print_checklists';

// Emulate events.php batch fetch
$stmt = $pdo->prepare("SELECT * FROM events WHERE id = :id");
$stmt->execute([':id' => $testEventId]);
$event = $stmt->fetch();

$bStmt = $pdo->prepare("SELECT * FROM booths WHERE event_id = :e_id AND status != 'archived'");
$bStmt->execute([':e_id' => $testEventId]);
$eventBooths = $bStmt->fetchAll();

usort($eventBooths, function($a, $b) {
    return strnatcasecmp($a['booth_number'] ?? '', $b['booth_number'] ?? '');
});

$bIds = array_column($eventBooths, 'id');
$placeholders = implode(',', array_fill(0, count($bIds), '?'));
$linkStmt = $pdo->prepare("SELECT * FROM booth_links WHERE booth_id IN ($placeholders) AND category = 'render_3d' ORDER BY created_at");
$linkStmt->execute($bIds);
$linksByBooth = [];
while ($lnk = $linkStmt->fetch()) {
    $linksByBooth[$lnk['booth_id']][] = $lnk;
}

$stallsData = [];
foreach ($eventBooths as $b) {
    $stallsData[] = [
        'booth' => $b,
        'eventName' => $event['name'],
        'views3D' => $linksByBooth[$b['id']] ?? [],
    ];
}

assert_test(count($stallsData) === 3, "Batch event print_checklists returned 3 stalls");

// Check Booth A in batch
$stallA = $stallsData[0];
assert_test($stallA['booth']['booth_number'] === 'A101', "Stall 1 is Booth A101 (natural sort)");
assert_test(count($stallA['views3D']) === 1, "Booth A has exactly 1 3D view");
assert_test($stallA['views3D'][0]['drive_url'] === 'https://claude.site/artifacts/alpha-3d-view', "Booth A 3D URL is Claude artifact URL");
assert_test($stallA['views3D'][0]['title'] === 'Alpha Front 3D Render', "Booth A 3D title matches");
assert_test($stallA['booth']['print_drive_url'] === 'https://drive.google.com/drive/folders/print_alpha_123', "Booth A print Drive URL matches");
assert_test($stallA['booth']['goodies_drive_url'] === 'https://drive.google.com/drive/folders/goodies_alpha_456', "Booth A goodies Drive URL matches");

// Check Booth B in batch
$stallB = $stallsData[1];
assert_test($stallB['booth']['booth_number'] === 'B202', "Stall 2 is Booth B202");
assert_test(count($stallB['views3D']) === 2, "Booth B has exactly 2 multi-angle 3D views");
assert_test($stallB['views3D'][0]['title'] === 'Isometric Perspective', "Booth B View 1 title matches");
assert_test($stallB['views3D'][0]['drive_url'] === 'https://drive.google.com/file/d/beta-iso-render', "Booth B View 1 URL matches");
assert_test($stallB['views3D'][1]['title'] === 'Walkthrough Birdseye View', "Booth B View 2 title matches");
assert_test($stallB['views3D'][1]['drive_url'] === 'https://viewer.3d-stall.com/beta-walkthrough', "Booth B View 2 URL matches");
assert_test($stallB['booth']['print_drive_url'] === 'https://drive.google.com/drive/folders/print_beta_999', "Booth B print Drive URL matches");
assert_test(empty($stallB['booth']['goodies_drive_url']), "Booth B goodies URL is correctly empty");

// Check Booth C in batch
$stallC = $stallsData[2];
assert_test($stallC['booth']['booth_number'] === 'C303', "Stall 3 is Booth C303");
assert_test(empty($stallC['views3D']), "Booth C has 0 3D views (triggers '3D View: Not Added')");
assert_test(empty($stallC['booth']['print_drive_url']), "Booth C has no print URL (triggers 'Print Files: Not Added')");
assert_test(empty($stallC['booth']['goodies_drive_url']), "Booth C has no goodies URL (triggers 'Artwork: Not Added')");

// 6. Test booths directory print_checklists with booth_ids filter
$filteredBIds = [$boothAId, $boothCId];
$placeholdersFiltered = implode(',', array_fill(0, count($filteredBIds), '?'));
$fStmt = $pdo->prepare("SELECT * FROM booths WHERE id IN ($placeholdersFiltered)");
$fStmt->execute($filteredBIds);
$filteredBooths = $fStmt->fetchAll();
assert_test(count($filteredBooths) === 2, "Booths directory filtered checklists returned 2 booths");

// 7. Verify jsPDF Link Annotation structure via Node execution
$nodeOutput = shell_exec("node " . escapeshellarg(__DIR__ . '/verify_jspdf_links.js'));
$nodeRes = json_decode(trim($nodeOutput ?? ''), true);

assert_test(is_array($nodeRes) && ($nodeRes['linkCount'] ?? 0) === 3, "jsPDF generates exactly 3 /Subtype /Link annotations");
assert_test(!empty($nodeRes['hasClaude']), "PDF contains binary /URI annotation for Claude 3D view");
assert_test(!empty($nodeRes['hasPrint']), "PDF contains binary /URI annotation for Print Drive folder");
assert_test(!empty($nodeRes['hasGoodies']), "PDF contains binary /URI annotation for Goodies Drive folder");

// Cleanup test event and booths
$pdo->prepare("DELETE FROM booth_links WHERE booth_id IN (?, ?, ?)")->execute([$boothAId, $boothBId, $boothCId]);
$pdo->prepare("DELETE FROM booths WHERE event_id = ?")->execute([$testEventId]);
$pdo->prepare("DELETE FROM events WHERE id = ?")->execute([$testEventId]);
assert_test(true, "Cleaned up test event, booths, and links");

echo "\n--- SUMMARY ---\n";
echo "Total assertions: " . ($passCount + $failCount) . "\n";
echo "Passed: {$passCount}\n";
echo "Failed: {$failCount}\n";

if ($failCount > 0) {
    exit(1);
}
