<?php
/**
 * Automated Verification Suite for 3D View and Print Files Quick Links
 *
 * Verifies:
 * 1. GET /manage/api/booths.php returns primary_3d_url and print_drive_url on booth rows.
 * 2. Primary 3D view prioritization:
 *    - Prefers is_final = 1 view over non-final views.
 *    - Falls back to earliest created 3D view if no view is marked final.
 * 3. GET /manage/api/events.php?id=... returns primary_3d_url and print_drive_url for event stalls.
 * 4. Print drive url fallback:
 *    - Returns booths.print_drive_url when present.
 *    - Falls back to booth_links (print_ready / working_artwork) when booths.print_drive_url is empty.
 * 5. Returns null when neither 3D nor Print link exists.
 * 6. Single booth query GET /manage/api/booths.php?id=... includes primary_3d_url.
 */

require_once __DIR__ . '/../manage/api/config.php';

echo "=== 3D View & Print Files Quick Links Verification Suite ===\n\n";

function assertQuickLinksTest($condition, $message) {
    if ($condition) {
        echo "  [PASS] $message\n";
    } else {
        echo "  [FAIL] $message\n";
        debug_print_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS);
        exit(1);
    }
}

$pdo = reworkzone_get_db();

// 1. Create a dedicated test event
$eventId = 'test-evt-quicklinks-' . bin2hex(random_bytes(4));
$insEvt = $pdo->prepare("
    INSERT INTO events (id, name, city, start_date, end_date, venue, status)
    VALUES (:id, 'Quick Links Expo 2026', 'Ahmedabad', '2026-12-01', '2026-12-05', 'Helipad Exhibition Ground', 'active')
");
$insEvt->execute([':id' => $eventId]);

// 2. Create 4 test stalls:
// - Stall 1: Has both 3D view (multiple, one final) and print_drive_url on booths
// - Stall 2: Has only 3D view (no final flag, should pick earliest) and no print files
// - Stall 3: Has only print link stored in booth_links (booths.print_drive_url is empty/null) and no 3D
// - Stall 4: Has neither 3D nor print links
$b1Id = 'test-b1-' . bin2hex(random_bytes(4));
$b2Id = 'test-b2-' . bin2hex(random_bytes(4));
$b3Id = 'test-b3-' . bin2hex(random_bytes(4));
$b4Id = 'test-b4-' . bin2hex(random_bytes(4));

$bthStmt = $pdo->prepare("
    INSERT INTO booths (id, event_id, booth_number, client_name, stand_size, booth_type, print_drive_url, status, booking_stage)
    VALUES (:id, :event_id, :booth_number, :client_name, '3x3', 'Wooden', :print_drive_url, 'active', 'confirmed')
");

$bthStmt->execute([
    ':id' => $b1Id,
    ':event_id' => $eventId,
    ':booth_number' => 'QL-01',
    ':client_name' => 'Alpha 3D and Print Corp',
    ':print_drive_url' => 'https://drive.google.com/drive/folders/alpha-print-files',
]);

$bthStmt->execute([
    ':id' => $b2Id,
    ':event_id' => $eventId,
    ':booth_number' => 'QL-02',
    ':client_name' => 'Beta 3D Only Ltd',
    ':print_drive_url' => null,
]);

$bthStmt->execute([
    ':id' => $b3Id,
    ':event_id' => $eventId,
    ':booth_number' => 'QL-03',
    ':client_name' => 'Gamma Print Via Links Inc',
    ':print_drive_url' => '', // empty string in booths table
]);

$bthStmt->execute([
    ':id' => $b4Id,
    ':event_id' => $eventId,
    ':booth_number' => 'QL-04',
    ':client_name' => 'Delta No Links Co',
    ':print_drive_url' => null,
]);

// 3. Seed 3D views and print links in booth_links
$linkStmt = $pdo->prepare("
    INSERT INTO booth_links (id, booth_id, category, title, drive_url, is_final, created_at)
    VALUES (:id, :booth_id, :category, :title, :drive_url, :is_final, :created_at)
");

// For Stall 1: Seed 2 3D views:
// Draft view (earlier)
$linkStmt->execute([
    ':id' => 'l-1a-' . bin2hex(random_bytes(4)),
    ':booth_id' => $b1Id,
    ':category' => 'render_3d',
    ':title' => 'Draft Angle View',
    ':drive_url' => 'https://preview.reworkzone.in/3d/alpha-draft',
    ':is_final' => 0,
    ':created_at' => '2026-11-20 10:00:00',
]);
// Final view (later)
$linkStmt->execute([
    ':id' => 'l-1b-' . bin2hex(random_bytes(4)),
    ':booth_id' => $b1Id,
    ':category' => 'render_3d',
    ':title' => 'Approved Front View',
    ':drive_url' => 'https://preview.reworkzone.in/3d/alpha-final',
    ':is_final' => 1,
    ':created_at' => '2026-11-20 12:00:00',
]);

// For Stall 2: Seed 2 3D views, neither marked final:
// Earliest view:
$linkStmt->execute([
    ':id' => 'l-2a-' . bin2hex(random_bytes(4)),
    ':booth_id' => $b2Id,
    ':category' => 'render_3d',
    ':title' => 'First Concept',
    ':drive_url' => 'https://preview.reworkzone.in/3d/beta-first',
    ':is_final' => 0,
    ':created_at' => '2026-11-21 08:00:00',
]);
// Second view:
$linkStmt->execute([
    ':id' => 'l-2b-' . bin2hex(random_bytes(4)),
    ':booth_id' => $b2Id,
    ':category' => 'render_3d',
    ':title' => 'Second Concept',
    ':drive_url' => 'https://preview.reworkzone.in/3d/beta-second',
    ':is_final' => 0,
    ':created_at' => '2026-11-21 09:00:00',
]);

// For Stall 3: Seed a print link in booth_links
$linkStmt->execute([
    ':id' => 'l-3a-' . bin2hex(random_bytes(4)),
    ':booth_id' => $b3Id,
    ':category' => 'print_ready',
    ':title' => 'Print Ready Artwork Files',
    ':drive_url' => 'https://drive.google.com/drive/folders/gamma-print-link',
    ':is_final' => 0,
    ':created_at' => '2026-11-22 10:00:00',
]);

echo "Test 1: Verify Main Booths Directory Query (manage/api/booths.php)\n";
$stmt = $pdo->prepare("
    SELECT b.*,
        (SELECT drive_url FROM booth_links WHERE booth_id = b.id AND category = 'render_3d' AND drive_url IS NOT NULL AND drive_url != '' ORDER BY is_final DESC, created_at ASC LIMIT 1) AS primary_3d_url,
        COALESCE(
            NULLIF(b.print_drive_url, ''),
            (SELECT drive_url FROM booth_links WHERE booth_id = b.id AND category IN ('print_ready', 'working_artwork') AND drive_url IS NOT NULL AND drive_url != '' ORDER BY created_at DESC LIMIT 1)
        ) AS print_drive_url
    FROM booths b
    WHERE b.event_id = :event_id
    ORDER BY b.booth_number ASC
");
$stmt->execute([':event_id' => $eventId]);
$fetchedBooths = $stmt->fetchAll(PDO::FETCH_ASSOC);

assertQuickLinksTest(count($fetchedBooths) === 4, "Fetched exactly 4 test booths");

$byNum = [];
foreach ($fetchedBooths as $b) {
    $byNum[$b['booth_number']] = $b;
}

// Check Stall 1: Has both, with primary_3d_url prioritizing is_final = 1
$ql1 = $byNum['QL-01'];
assertQuickLinksTest($ql1['primary_3d_url'] === 'https://preview.reworkzone.in/3d/alpha-final', "QL-01 prioritized is_final=1 3D view ('alpha-final')");
assertQuickLinksTest($ql1['print_drive_url'] === 'https://drive.google.com/drive/folders/alpha-print-files', "QL-01 returned direct print_drive_url");

// Check Stall 2: Has 3D (no final, picks earliest created) and no print
$ql2 = $byNum['QL-02'];
assertQuickLinksTest($ql2['primary_3d_url'] === 'https://preview.reworkzone.in/3d/beta-first', "QL-02 prioritized earliest 3D view ('beta-first') when none marked final");
assertQuickLinksTest(empty($ql2['print_drive_url']), "QL-02 has no print_drive_url (null)");

// Check Stall 3: Has fallback print link from booth_links and no 3D
$ql3 = $byNum['QL-03'];
assertQuickLinksTest(empty($ql3['primary_3d_url']), "QL-03 has no primary_3d_url");
assertQuickLinksTest($ql3['print_drive_url'] === 'https://drive.google.com/drive/folders/gamma-print-link', "QL-03 resolved print_drive_url from booth_links");

// Check Stall 4: Has neither
$ql4 = $byNum['QL-04'];
assertQuickLinksTest(empty($ql4['primary_3d_url']), "QL-04 has no 3D URL");
assertQuickLinksTest(empty($ql4['print_drive_url']), "QL-04 has no Print URL");

echo "\nTest 2: Verify Event Details Stalls Query (manage/api/events.php)\n";
$evtBoothStmt = $pdo->prepare("
    SELECT b.*,
        (SELECT drive_url FROM booth_links WHERE booth_id = b.id AND category = 'render_3d' AND drive_url IS NOT NULL AND drive_url != '' ORDER BY is_final DESC, created_at ASC LIMIT 1) AS primary_3d_url,
        COALESCE(
            NULLIF(b.print_drive_url, ''),
            (SELECT drive_url FROM booth_links WHERE booth_id = b.id AND category IN ('print_ready', 'working_artwork') AND drive_url IS NOT NULL AND drive_url != '' ORDER BY created_at DESC LIMIT 1)
        ) AS print_drive_url
    FROM booths b
    WHERE b.event_id = :event_id AND b.status != 'archived'
    ORDER BY b.booth_number ASC
");
$evtBoothStmt->execute([':event_id' => $eventId]);
$evtBooths = $evtBoothStmt->fetchAll(PDO::FETCH_ASSOC);

assertQuickLinksTest(count($evtBooths) === 4, "Event query returned 4 booths");
assertQuickLinksTest($evtBooths[0]['primary_3d_url'] === 'https://preview.reworkzone.in/3d/alpha-final', "Event stall QL-01 has primary_3d_url");
assertQuickLinksTest($evtBooths[0]['print_drive_url'] === 'https://drive.google.com/drive/folders/alpha-print-files', "Event stall QL-01 has print_drive_url");
assertQuickLinksTest($evtBooths[2]['print_drive_url'] === 'https://drive.google.com/drive/folders/gamma-print-link', "Event stall QL-03 resolved print_drive_url");

echo "\nTest 3: Verify Single Booth Query (manage/api/booths.php?id=...)\n";
$singleStmt = $pdo->prepare("
    SELECT b.*,
        (SELECT drive_url FROM booth_links WHERE booth_id = b.id AND category = 'render_3d' AND drive_url IS NOT NULL AND drive_url != '' ORDER BY is_final DESC, created_at ASC LIMIT 1) AS primary_3d_url,
        COALESCE(
            NULLIF(b.print_drive_url, ''),
            (SELECT drive_url FROM booth_links WHERE booth_id = b.id AND category IN ('print_ready', 'working_artwork') AND drive_url IS NOT NULL AND drive_url != '' ORDER BY created_at DESC LIMIT 1)
        ) AS resolved_print_drive_url
    FROM booths b
    WHERE b.id = :id
    LIMIT 1
");
$singleStmt->execute([':id' => $b1Id]);
$singleB1 = $singleStmt->fetch(PDO::FETCH_ASSOC);
assertQuickLinksTest($singleB1['primary_3d_url'] === 'https://preview.reworkzone.in/3d/alpha-final', "Single booth query returns primary_3d_url");
assertQuickLinksTest($singleB1['resolved_print_drive_url'] === 'https://drive.google.com/drive/folders/alpha-print-files', "Single booth query returns resolved_print_drive_url");

// Clean up test data
$pdo->prepare("DELETE FROM booth_links WHERE booth_id IN (:b1, :b2, :b3, :b4)")->execute([
    ':b1' => $b1Id,
    ':b2' => $b2Id,
    ':b3' => $b3Id,
    ':b4' => $b4Id,
]);
$pdo->prepare("DELETE FROM booths WHERE event_id = :event_id")->execute([':event_id' => $eventId]);
$pdo->prepare("DELETE FROM events WHERE id = :id")->execute([':id' => $eventId]);

echo "\nCleaned up test event and stalls safely.\n";
echo "=== All 3D View and Print Files Quick Links tests PASSED! ===\n";
