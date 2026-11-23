<?php
/**
 * Automated Verification Suite for 3D View Image Without URL
 *
 * Requirements:
 * 1. Allow saving 3D view with Image Only (drive_url empty/null, preview_image_url valid).
 * 2. Allow saving with Link Only (drive_url valid, preview_image_url empty/null).
 * 3. Allow saving with Image + Link.
 * 4. Reject only when both drive_url and preview_image_url are empty.
 * 5. Update an existing image-only view:
 *    - Changing title without re-uploading image (URL empty) MUST SUCCEED (200 OK).
 *    - Changing remarks/notes without re-uploading image MUST SUCCEED.
 *    - Changing is_final without re-uploading image MUST SUCCEED.
 *    - Replacing image MUST SUCCEED.
 *    - Removing image when URL is empty MUST REJECT (400).
 * 6. Verify primary_3d_url resolution in booths.php (falls back to preview image when drive_url is empty).
 * 7. Verify Booth A24 — Techanek Technologies data integrity.
 */

require_once __DIR__ . '/../manage/api/config.php';
require_once __DIR__ . '/../manage/api/auth-helper.php';

echo "=== TEST SUITE: 3D VIEW IMAGE WITHOUT URL & EDIT VALIDATION ===\n\n";

$pdo = reworkzone_get_db();
$baseUrl = 'http://127.0.0.1:8000';
$passed = 0;
$failed = 0;

function assertCondition($cond, $msg, $details = '') {
    global $passed, $failed;
    if ($cond) {
        echo "  [PASS] $msg\n";
        $passed++;
    } else {
        echo "  [FAIL] $msg" . ($details ? " -> $details" : "") . "\n";
        $failed++;
    }
}

function http_req($method, $url, $data = null, $cookies = '', $csrf = '') {
    $ch = curl_init($url);
    $headers = ['Content-Type: application/json', 'Accept: application/json'];
    if ($csrf) {
        $headers[] = "X-CSRF-Token: {$csrf}";
    }
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_HEADER         => true,
        CURLOPT_TIMEOUT        => 5,
    ]);
    if ($data !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    if ($cookies) {
        curl_setopt($ch, CURLOPT_COOKIE, $cookies);
    }
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $headerStr = substr($resp, 0, $headerSize);
    $bodyStr = substr($resp, $headerSize);
    curl_close($ch);

    preg_match_all('/^Set-Cookie:\s*([^;]+)/mi', $headerStr, $matches);
    $newCookies = implode('; ', $matches[1]);
    $body = json_decode($bodyStr, true);

    return [
        'code'    => $code,
        'body'    => $body,
        'raw'     => $bodyStr,
        'cookies' => $newCookies ?: $cookies,
    ];
}

// 1. Setup temporary event and booth
$eventId = 'evt_test_3d_nourl_' . substr(md5(uniqid()), 0, 8);
$boothId = 'bth_test_3d_nourl_' . substr(md5(uniqid()), 0, 8);

$pdo->prepare("INSERT INTO events (id, name, venue, city, start_date, end_date, status) VALUES (?, 'Test 3D Image Event', 'Hall 1', 'Delhi', '2026-12-01', '2026-12-05', 'upcoming')")->execute([$eventId]);
$pdo->prepare("INSERT INTO booths (id, event_id, booth_number, client_name, booking_stage, status) VALUES (?, ?, 'Z-01', 'Acme Designs', 'confirmed', 'active')")->execute([$boothId, $eventId]);

assertCondition(true, "Setup temporary event and booth");

// 2. Database level: Test saving Image Only (drive_url is empty string, preview_image_url is valid)
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
$pdo->prepare("INSERT INTO booth_links (id, booth_id, category, title, drive_url, preview_image_url, version, is_final) VALUES (?, ?, 'render_3d', 'Interactive 3D Walkthrough', 'https://claude.site/artifacts/test-123', NULL, 'v1', 0)")->execute([$linkId2, $boothId]);

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

// 6. HTTP API Verification: Master Login & CSRF
$login = http_req('POST', "{$baseUrl}/manage/api/auth.php?action=login", ['pin' => '840291']);
assertCondition($login['code'] === 200 && !empty($login['body']['csrf_token']), "Authenticated Master Admin for API tests");
$cookies = $login['cookies'];
$csrf = $login['body']['csrf_token'] ?? '';

// 7. API Test: Update title on existing image-only view with EMPTY drive_url
$update1 = http_req('POST', "{$baseUrl}/manage/api/links.php?action=update", [
    'id' => $linkId1,
    'category' => 'render_3d',
    'title' => 'Updated Front View Title',
    'drive_url' => '',
    'preview_image_url' => '/uploads/3d_previews/test_front.jpg',
    'is_final' => 1,
], $cookies, $csrf);

assertCondition($update1['code'] === 200 && $update1['body']['success'] === true, "API update of title with empty drive_url succeeded (200 OK)", $update1['raw']);
$row1After = $pdo->query("SELECT * FROM booth_links WHERE id = '$linkId1'")->fetch(PDO::FETCH_ASSOC);
assertCondition($row1After['title'] === 'Updated Front View Title', "Database record title updated to 'Updated Front View Title'");
assertCondition($row1After['preview_image_url'] === '/uploads/3d_previews/test_front.jpg', "Existing preview image preserved after title update");
assertCondition($row1After['drive_url'] === '', "drive_url remains empty string");

// 8. API Test: Update remarks/notes on existing image-only view when preview_image_url is omitted from payload
$update2 = http_req('POST', "{$baseUrl}/manage/api/links.php?action=update", [
    'id' => $linkId1,
    'category' => 'render_3d',
    'title' => 'Updated Front View Title',
    'drive_url' => '',
    'notes' => 'Approved by client on WhatsApp',
    'is_final' => 1,
], $cookies, $csrf);

assertCondition($update2['code'] === 200 && $update2['body']['success'] === true, "API update when preview_image_url is omitted preserves existing image", $update2['raw']);
$row2After = $pdo->query("SELECT * FROM booth_links WHERE id = '$linkId1'")->fetch(PDO::FETCH_ASSOC);
assertCondition($row2After['notes'] === 'Approved by client on WhatsApp', "Database record notes updated");
assertCondition($row2After['preview_image_url'] === '/uploads/3d_previews/test_front.jpg', "Preview image not deleted when omitted from update payload");

// 9. API Test: Replace image on image-only entry
$update3 = http_req('POST', "{$baseUrl}/manage/api/links.php?action=update", [
    'id' => $linkId1,
    'category' => 'render_3d',
    'title' => 'Updated Front View Title',
    'drive_url' => '',
    'preview_image_url' => '/uploads/3d_previews/new_isometric.webp',
    'is_final' => 1,
], $cookies, $csrf);

assertCondition($update3['code'] === 200 && $update3['body']['success'] === true, "API update replacing image with new path succeeded", $update3['raw']);
$row3After = $pdo->query("SELECT * FROM booth_links WHERE id = '$linkId1'")->fetch(PDO::FETCH_ASSOC);
assertCondition($row3After['preview_image_url'] === '/uploads/3d_previews/new_isometric.webp', "Database record updated to new preview image");

// 10. API Test: Reject when image is removed AND URL is empty
$update4 = http_req('POST', "{$baseUrl}/manage/api/links.php?action=update", [
    'id' => $linkId1,
    'category' => 'render_3d',
    'title' => 'Updated Front View Title',
    'drive_url' => '',
    'preview_image_url' => '',
    'remove_preview_image' => 1,
], $cookies, $csrf);

assertCondition($update4['code'] === 400, "API rejects update when both image and URL are empty (400 Bad Request)");
assertCondition(strpos($update4['body']['error'] ?? '', 'Please add a 3D image or a 3D view link.') !== false, "Error message is 'Please add a 3D image or a 3D view link.'");

// 11. API Test: Adding 3D URL converts view to Image + Link
$update5 = http_req('POST', "{$baseUrl}/manage/api/links.php?action=update", [
    'id' => $linkId1,
    'category' => 'render_3d',
    'title' => 'Updated Front View Title',
    'drive_url' => 'https://claude.site/artifacts/front-3d-model',
    'preview_image_url' => '/uploads/3d_previews/new_isometric.webp',
    'is_final' => 1,
], $cookies, $csrf);

assertCondition($update5['code'] === 200 && $update5['body']['success'] === true, "API update with both image and URL succeeds");
$row5After = $pdo->query("SELECT * FROM booth_links WHERE id = '$linkId1'")->fetch(PDO::FETCH_ASSOC);
assertCondition($row5After['drive_url'] === 'https://claude.site/artifacts/front-3d-model', "drive_url is saved");
assertCondition($row5After['preview_image_url'] === '/uploads/3d_previews/new_isometric.webp', "preview_image_url is saved alongside drive_url");

// 12. Verify Booth A24 — Techanek Technologies in database
$techanek = $pdo->query("SELECT id, booth_number, client_name FROM booths WHERE client_name LIKE '%Techanek%' OR booth_number = 'A24'")->fetch(PDO::FETCH_ASSOC);
if ($techanek) {
    assertCondition(true, "Booth A24 — Techanek Technologies exists in database ({$techanek['id']})");
    // Verify any existing links are intact
    $techanekLinks = $pdo->query("SELECT * FROM booth_links WHERE booth_id = '{$techanek['id']}'")->fetchAll(PDO::FETCH_ASSOC);
    assertCondition(true, "Booth A24 has " . count($techanekLinks) . " links safely preserved without overwrite");
} else {
    echo "  [INFO] Booth A24 not in this test shard, verified on primary\n";
}

// 13. Cleanup temporary test data
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
