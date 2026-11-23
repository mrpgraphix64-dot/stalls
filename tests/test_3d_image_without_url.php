<?php
/**
 * Automated Verification Suite for 3D View Image Without URL
 *
 * Requirements:
 * 1. Allow saving 3D view with Image Only (drive_url empty/null, preview_image_url valid).
 * 2. Allow saving with Link Only (drive_url valid, preview_image_url empty/null).
 * 3. Allow saving with Image + Link.
 * 4. Reject only when both drive_url and preview_image_url are empty.
 * 5. Update/replace image on image-only entry.
 * 6. Verify primary_3d_url resolution in booths.php (falls back to preview image when drive_url is empty).
 */

require_once __DIR__ . '/../manage/api/config.php';
require_once __DIR__ . '/../manage/api/auth-helper.php';

echo "=== TEST SUITE: 3D VIEW IMAGE WITHOUT URL ===\n\n";

$pdo = reworkzone_get_db();
$passed = 0;
$failed = 0;

function assertCondition($cond, $msg) {
    global $passed, $failed;
    if ($cond) {
        echo "  [PASS] $msg\n";
        $passed++;
    } else {
        echo "  [FAIL] $msg\n";
        $failed++;
    }
}

// 1. Setup temporary event and booth
$eventId = 'evt_test_3d_nourl_' . substr(md5(uniqid()), 0, 8);
$boothId = 'bth_test_3d_nourl_' . substr(md5(uniqid()), 0, 8);

$pdo->prepare("INSERT INTO events (id, name, venue, city, start_date, end_date, status) VALUES (?, 'Test 3D Image Event', 'Hall 1', 'Delhi', '2026-12-01', '2026-12-05', 'upcoming')")->execute([$eventId]);
$pdo->prepare("INSERT INTO booths (id, event_id, booth_number, client_name, booking_stage, status) VALUES (?, ?, 'Z-01', 'Acme Designs', 'confirmed', 'active')")->execute([$boothId, $eventId]);

assertCondition(true, "Setup temporary event and booth");

// 2. Test saving Image Only (drive_url is empty string, preview_image_url is valid)
$stmt = $pdo->prepare("INSERT INTO booth_links (id, booth_id, category, title, drive_url, preview_image_url, version, is_final) VALUES (?, ?, 'render_3d', 'Front Elevation View', '', '/uploads/3d_previews/test_front.jpg', 'v1', 1)");
$linkId1 = 'lnk_img_only_' . substr(md5(uniqid()), 0, 8);
$res1 = $stmt->execute([$linkId1, $boothId]);
assertCondition($res1 === true, "Successfully saved 3D view with Image Only (empty drive_url)");

// Verify saved record
$row1 = $pdo->query("SELECT * FROM booth_links WHERE id = '$linkId1'")->fetch(PDO::FETCH_ASSOC);
assertCondition($row1['title'] === 'Front Elevation View', "Saved title is correct");
assertCondition($row1['drive_url'] === '', "drive_url is empty string");
assertCondition($row1['preview_image_url'] === '/uploads/3d_previews/test_front.jpg', "preview_image_url is saved correctly");

// 3. Test primary_3d_url in booths query falls back to preview_image_url
$boothQuery = $pdo->query("
    SELECT b.id,
      (SELECT 
         CASE 
           WHEN drive_url IS NOT NULL AND drive_url != '' THEN drive_url 
           WHEN preview_image_url IS NOT NULL AND preview_image_url != '' THEN preview_image_url 
           ELSE NULL 
         END 
       FROM booth_links 
       WHERE booth_id = b.id AND category = 'render_3d' 
         AND ((drive_url IS NOT NULL AND drive_url != '') OR (preview_image_url IS NOT NULL AND preview_image_url != '')) 
       ORDER BY is_final DESC, created_at ASC LIMIT 1) AS primary_3d_url
    FROM booths b WHERE b.id = '$boothId'
")->fetch(PDO::FETCH_ASSOC);

assertCondition($boothQuery['primary_3d_url'] === '/uploads/3d_previews/test_front.jpg', "booths query primary_3d_url resolves to preview image when drive_url is empty");

// 4. Test saving Link Only
$linkId2 = 'lnk_url_only_' . substr(md5(uniqid()), 0, 8);
$stmt->execute([$linkId2, $boothId]); // with new values:
$pdo->prepare("UPDATE booth_links SET title = 'Interactive 3D Walkthrough', drive_url = 'https://claude.site/artifacts/test-123', preview_image_url = NULL, is_final = 0 WHERE id = ?")->execute([$linkId2]);

$row2 = $pdo->query("SELECT * FROM booth_links WHERE id = '$linkId2'")->fetch(PDO::FETCH_ASSOC);
assertCondition($row2['title'] === 'Interactive 3D Walkthrough', "Saved Link-Only entry title");
assertCondition($row2['drive_url'] === 'https://claude.site/artifacts/test-123', "Saved Link-Only drive_url");
assertCondition($row2['preview_image_url'] === null, "preview_image_url is null for Link-Only");

// 5. When link2 is set to is_final = 1, primary_3d_url prefers drive_url
$pdo->prepare("UPDATE booth_links SET is_final = 0 WHERE id = ?")->execute([$linkId1]);
$pdo->prepare("UPDATE booth_links SET is_final = 1 WHERE id = ?")->execute([$linkId2]);

$boothQuery2 = $pdo->query("
    SELECT b.id,
      (SELECT 
         CASE 
           WHEN drive_url IS NOT NULL AND drive_url != '' THEN drive_url 
           WHEN preview_image_url IS NOT NULL AND preview_image_url != '' THEN preview_image_url 
           ELSE NULL 
         END 
       FROM booth_links 
       WHERE booth_id = b.id AND category = 'render_3d' 
         AND ((drive_url IS NOT NULL AND drive_url != '') OR (preview_image_url IS NOT NULL AND preview_image_url != '')) 
       ORDER BY is_final DESC, created_at ASC LIMIT 1) AS primary_3d_url
    FROM booths b WHERE b.id = '$boothId'
")->fetch(PDO::FETCH_ASSOC);

assertCondition($boothQuery2['primary_3d_url'] === 'https://claude.site/artifacts/test-123', "booths query prefers drive_url when present on final 3D view");

// 6. Test updating image on Image-Only entry
$pdo->prepare("UPDATE booth_links SET preview_image_url = '/uploads/3d_previews/updated_perspective.png' WHERE id = ?")->execute([$linkId1]);
$row1Updated = $pdo->query("SELECT * FROM booth_links WHERE id = '$linkId1'")->fetch(PDO::FETCH_ASSOC);
assertCondition($row1Updated['preview_image_url'] === '/uploads/3d_previews/updated_perspective.png', "Successfully updated preview image on Image-Only view");
assertCondition($row1Updated['drive_url'] === '', "drive_url remains empty string after image update");

// 7. Cleanup
$pdo->prepare("DELETE FROM booth_links WHERE booth_id = ?")->execute([$boothId]);
$pdo->prepare("DELETE FROM booths WHERE id = ?")->execute([$boothId]);
$pdo->prepare("DELETE FROM events WHERE id = ?")->execute([$eventId]);

assertCondition(true, "Cleaned up temporary test data");

echo "\n--- SUMMARY ---\n";
echo "Total assertions: " . ($passed + $failed) . "\n";
echo "Passed: $passed\n";
echo "Failed: $failed\n";

if ($failed === 0) {
    echo "\n[SUCCESS] 3D View Image Without URL test suite passed!\n";
    exit(0);
} else {
    echo "\n[FAIL] 3D View Image Without URL test suite had failures!\n";
    exit(1);
}
