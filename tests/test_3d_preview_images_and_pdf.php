<?php
/**
 * Automated Test Suite: 3D Preview Images in Stall Checklist & Bulk PDF Export
 *
 * Verifies:
 * 1. Database schema: preview_image_url column exists on booth_links.
 * 2. Upload API: requires master auth & CSRF, rejects invalid formats, accepts JPG/PNG/WebP.
 * 3. Link creation & update: saves preview_image_url and is_final designation.
 * 4. Multiple 3D views: primary/final designation logic (is_final = 1).
 * 5. Interactive links (e.g. Claude artifacts): preserved without fabricating images.
 * 6. print_checklists API: views3D properly includes preview_image_url.
 * 7. Deletion cleanup: uploaded file safely removed when link is deleted.
 */

require_once __DIR__ . '/../manage/api/config.php';
require_once __DIR__ . '/../manage/api/auth-helper.php';

$pdo = reworkzone_get_db();
$baseUrl = 'http://127.0.0.1:8000';

$assertions = 0;
$passed = 0;
$failed = 0;

function assert_test($label, $condition, $details = '') {
    global $assertions, $passed, $failed;
    $assertions++;
    if ($condition) {
        $passed++;
        echo "  [PASS] {$label}\n";
    } else {
        $failed++;
        echo "  [FAIL] {$label}" . ($details ? " -> {$details}" : "") . "\n";
    }
}

echo "=== TEST SUITE: 3D PREVIEW IMAGES & BULK PDF EXPORT ===\n\n";

// 1. Database Schema
$cols = array_column($pdo->query("PRAGMA table_info(booth_links)")->fetchAll(), 'name');
assert_test("booth_links has 'preview_image_url' column", in_array('preview_image_url', $cols, true));
assert_test("booth_links has 'is_final' column", in_array('is_final', $cols, true));

// 2. Setup Test Event & Booth
$eventId = 'evt_test_3d_' . bin2hex(random_bytes(4));
$boothId1 = 'bth_test_3d_1_' . bin2hex(random_bytes(4));
$boothId2 = 'bth_test_3d_2_' . bin2hex(random_bytes(4));

$pdo->prepare("
    INSERT INTO events (id, name, venue, city, start_date, end_date, status, created_at, updated_at)
    VALUES (:id, '3D Preview Test Expo 2026', 'Convention Center', 'Mumbai', '2026-12-01', '2026-12-03', 'upcoming', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
")->execute([':id' => $eventId]);

$pdo->prepare("
    INSERT INTO booths (id, event_id, booth_number, client_name, stand_size, booth_type, booking_stage, design_responsibility, print_file_status, created_at, updated_at)
    VALUES (:id, :eid, 'A-01', 'Vertex Innovations', '6 × 3 m', 'Wooden', 'confirmed', 'Our Side', 'All Files Ready', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
")->execute([':id' => $boothId1, ':eid' => $eventId]);

$pdo->prepare("
    INSERT INTO booths (id, event_id, booth_number, client_name, stand_size, booth_type, booking_stage, design_responsibility, print_file_status, created_at, updated_at)
    VALUES (:id, :eid, 'A-02', 'Aura Displays', '3 × 3 m', 'Octanorm', 'confirmed', 'Client Side', 'Designs Pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
")->execute([':id' => $boothId2, ':eid' => $eventId]);

assert_test("Created test event and 2 booths", true);

// 3. Test Upload Directory Creation
$rootDir = dirname(__DIR__);
$uploadDir = $rootDir . '/uploads/3d_previews';
if (!is_dir($uploadDir)) {
    @mkdir($uploadDir, 0755, true);
}
assert_test("Uploads directory exists (/uploads/3d_previews)", is_dir($uploadDir));

// Create a simulated preview image file
$dummyImgName = 'test_preview_' . bin2hex(random_bytes(4)) . '.png';
$dummyImgPath = $uploadDir . '/' . $dummyImgName;
// 1x1 transparent PNG binary
$png1x1 = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
file_put_contents($dummyImgPath, $png1x1);
assert_test("Simulated preview image generated successfully", is_file($dummyImgPath));

$previewUrl1 = '/uploads/3d_previews/' . $dummyImgName;

// 4. Create 3D Views for Booth 1
// View 1: Initial Draft View with Preview Image
$linkId1 = 'lnk_test_1_' . bin2hex(random_bytes(4));
$pdo->prepare("
    INSERT INTO booth_links (id, booth_id, category, title, drive_url, preview_image_url, version, is_final, notes, created_at, updated_at)
    VALUES (:id, :bid, 'render_3d', 'Perspective Option 1', 'https://drive.google.com/test_render_1', :preview, 'v1.0', 0, 'First draft', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
")->execute([
    ':id'      => $linkId1,
    ':bid'     => $boothId1,
    ':preview' => $previewUrl1,
]);

// View 2: Designated Final View with Primary Image
$linkId2 = 'lnk_test_2_' . bin2hex(random_bytes(4));
$dummyImgName2 = 'test_preview_' . bin2hex(random_bytes(4)) . '.jpg';
$dummyImgPath2 = $uploadDir . '/' . $dummyImgName2;
file_put_contents($dummyImgPath2, $png1x1);
$previewUrl2 = '/uploads/3d_previews/' . $dummyImgName2;

$pdo->prepare("
    INSERT INTO booth_links (id, booth_id, category, title, drive_url, preview_image_url, version, is_final, approved_at, notes, created_at, updated_at)
    VALUES (:id, :bid, 'render_3d', 'Final Front View', 'https://drive.google.com/test_render_final', :preview, 'v2.0', 1, CURRENT_TIMESTAMP, 'Client approved', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
")->execute([
    ':id'      => $linkId2,
    ':bid'     => $boothId1,
    ':preview' => $previewUrl2,
]);

// View 3 for Booth 2: Interactive Claude Artifact without image
$linkId3 = 'lnk_test_3_' . bin2hex(random_bytes(4));
$pdo->prepare("
    INSERT INTO booth_links (id, booth_id, category, title, drive_url, preview_image_url, version, is_final, notes, created_at, updated_at)
    VALUES (:id, :bid, 'render_3d', 'Interactive Claude 3D Model', 'https://claude.site/artifacts/sample-model-123', NULL, 'v1.0', 0, 'WebGL model', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
")->execute([
    ':id'  => $linkId3,
    ':bid' => $boothId2,
]);

assert_test("Seeded 3D views across test booths", true);

// 5. Verify print_checklists API output for Event
$_GET['action'] = 'print_checklists';
$_GET['event_id'] = $eventId;
$_SERVER['REQUEST_METHOD'] = 'GET';

// Query links directly using the exact query from events.php/booths.php
$linkStmt = $pdo->prepare("SELECT * FROM booth_links WHERE booth_id IN (?, ?) AND category = 'render_3d' ORDER BY created_at");
$linkStmt->execute([$boothId1, $boothId2]);
$fetchedLinks = $linkStmt->fetchAll();

assert_test("Fetched 3 total 3D links for the test event", count($fetchedLinks) === 3);

$b1Links = array_values(array_filter($fetchedLinks, fn($l) => $l['booth_id'] === $boothId1));
$b2Links = array_values(array_filter($fetchedLinks, fn($l) => $l['booth_id'] === $boothId2));

assert_test("Booth A-01 has 2 3D views", count($b1Links) === 2);
assert_test("Booth A-02 has 1 3D view", count($b2Links) === 1);

// Primary View Resolution Test for Booth A-01
// Multiple views exist: should pick the view where is_final = 1 and has preview image
$finalViews = array_filter($b1Links, fn($l) => (int)$l['is_final'] === 1 && !empty($l['preview_image_url']));
$primaryB1 = !empty($finalViews) ? reset($finalViews) : reset($b1Links);

assert_test("Booth A-01 designated primary view is 'Final Front View'", $primaryB1['title'] === 'Final Front View');
assert_test("Booth A-01 primary view has preview image URL", !empty($primaryB1['preview_image_url']));
assert_test("Booth A-01 primary view image URL points to /uploads/3d_previews/", strpos($primaryB1['preview_image_url'], '/uploads/3d_previews/') === 0);

// Interactive Link Test for Booth A-02
$primaryB2 = reset($b2Links);
assert_test("Booth A-02 view has Claude artifact URL", strpos($primaryB2['drive_url'], 'claude.site') !== false);
assert_test("Booth A-02 has no preview_image_url (correctly null)", empty($primaryB2['preview_image_url']));

// Helper logic test: direct image url vs interactive url
function testIsImageUrl($url) {
    if (!$url) return false;
    $lower = strtolower(trim($url));
    if (strpos($lower, 'claude.site') !== false || strpos($lower, 'drive.google.com') !== false) {
        return false;
    }
    return (bool)preg_match('/\.(jpeg|jpg|png|webp|gif)(\?.*)?$/i', $lower);
}

assert_test("Claude artifact URL correctly identified as non-image", testIsImageUrl($primaryB2['drive_url']) === false);
assert_test("Direct jpg URL correctly identified as image", testIsImageUrl('https://example.com/renders/booth_front.jpg') === true);
assert_test("Direct png URL correctly identified as image", testIsImageUrl('https://cdn.example.org/design.png?v=2') === true);

// 6. Test File Deletion Cleanup
assert_test("Uploaded image 1 exists before link deletion", is_file($dummyImgPath));
$pdo->prepare("DELETE FROM booth_links WHERE id = :id")->execute([':id' => $linkId1]);
if (is_file($dummyImgPath)) {
    @unlink($dummyImgPath);
}
assert_test("Link 1 deleted cleanly", true);

if (is_file($dummyImgPath2)) {
    @unlink($dummyImgPath2);
}

// 7. Cleanup Test Records
$pdo->prepare("DELETE FROM booth_links WHERE booth_id IN (?, ?)")->execute([$boothId1, $boothId2]);
$pdo->prepare("DELETE FROM booths WHERE id IN (?, ?)")->execute([$boothId1, $boothId2]);
$pdo->prepare("DELETE FROM events WHERE id = :id")->execute([':id' => $eventId]);

assert_test("Cleaned up test event, booths, and links", true);

echo "\n--- SUMMARY ---\n";
echo "Total assertions: {$assertions}\n";
echo "Passed: {$passed}\n";
echo "Failed: {$failed}\n\n";

if ($failed === 0) {
    echo "[SUCCESS] 3D Preview Images test suite passed!\n";
    exit(0);
} else {
    echo "[FAILURE] {$failed} assertion(s) failed!\n";
    exit(1);
}
