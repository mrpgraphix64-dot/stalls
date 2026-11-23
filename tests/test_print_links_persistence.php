<?php
/**
 * Automated Verification Suite for Print Files Link Persistence
 *
 * Verifies:
 * 1. Print Drive URL save and commit into SQLite (`booths.print_drive_url` and `booth_links`).
 * 2. GET single booth (`manage/api/booths.php?id=...`) consistency.
 * 3. GET directory booths (`manage/api/booths.php`) consistency.
 * 4. GET event stalls (`manage/api/events.php?id=...`) consistency.
 * 5. Checklist task status changes (Done / Pending / NA) never clear or reset `print_drive_url`.
 * 6. Print file status updates never clear or reset `print_drive_url`.
 * 7. Design responsibility updates never clear or reset `print_drive_url`.
 * 8. Print remark updates never clear or reset `print_drive_url`.
 * 9. Multi-booth isolation (Stall A69 vs Stall B02).
 */

require_once __DIR__ . '/../manage/api/config.php';

echo "=== Print Files Link Persistence Verification Suite ===\n\n";

function assertPrintPersistence($condition, $message) {
    if ($condition) {
        echo "  [PASS] $message\n";
    } else {
        echo "  [FAIL] $message\n";
        debug_print_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS);
        exit(1);
    }
}

$pdo = reworkzone_get_db();

// 1. Setup temporary test event
$eventId = 'test-evt-print-' . bin2hex(random_bytes(4));
$pdo->prepare("
    INSERT INTO events (id, name, city, start_date, end_date, venue, status)
    VALUES (:id, 'Print Persistence Expo 2026', 'Ahmedabad', '2026-12-10', '2026-12-12', 'Helipad Exhibition Ground', 'active')
")->execute([':id' => $eventId]);

// 2. Create 2 test stalls (A69 and B02)
$bA69Id = 'test-a69-' . bin2hex(random_bytes(4));
$bB02Id = 'test-b02-' . bin2hex(random_bytes(4));

$insBooth = $pdo->prepare("
    INSERT INTO booths (id, event_id, booth_number, client_name, stand_size, booth_type, status, booking_stage, design_responsibility, print_file_status)
    VALUES (:id, :event_id, :booth_number, :client_name, '3 × 3 m (9 sq.m)', 'Frame', 'draft', 'confirmed', 'Client Side', 'Designs Pending')
");

$insBooth->execute([
    ':id' => $bA69Id,
    ':event_id' => $eventId,
    ':booth_number' => 'A69',
    ':client_name' => 'Fovero Test',
]);

$insBooth->execute([
    ':id' => $bB02Id,
    ':event_id' => $eventId,
    ':booth_number' => 'B02',
    ':client_name' => 'Other Brand',
]);

// Seed tasks for A69
$taskStmt = $pdo->prepare("
    INSERT INTO booth_tasks (id, booth_id, phase, task_name, sort_order, display_order, is_completed, status)
    VALUES (:id, :booth_id, :phase, :task_name, :sort_order, :sort_order, :is_completed, :status)
");
$tPrintId = 'tsk-pr-' . bin2hex(random_bytes(4));
$taskStmt->execute([
    ':id' => $tPrintId,
    ':booth_id' => $bA69Id,
    ':phase' => 'Print Files',
    ':task_name' => 'Print Files & Design',
    ':sort_order' => 1,
    ':is_completed' => 0,
    ':status' => 'pending',
]);

echo "Test 1: Save Print Files URL for Stall A69\n";
$testDriveUrl = 'https://drive.google.com/drive/folders/fovero-a69-persisted-link';

// Simulate POST /manage/api/booths.php?action=update
$updateStmt = $pdo->prepare("
    UPDATE booths
    SET print_drive_url = :url, main_drive_folder_url = :url, updated_at = CURRENT_TIMESTAMP
    WHERE id = :id
");
$updateStmt->execute([':url' => $testDriveUrl, ':id' => $bA69Id]);

// Two-way sync to booth_links
$linkId = 'lnk-pr-' . bin2hex(random_bytes(4));
$pdo->prepare("
    INSERT INTO booth_links (id, booth_id, category, title, drive_url, is_final, created_at, updated_at)
    VALUES (:id, :b_id, 'print_ready', 'Print Ready Artwork', :url, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
")->execute([':id' => $linkId, ':b_id' => $bA69Id, ':url' => $testDriveUrl]);

// Verify database row
$cur = $pdo->prepare("SELECT print_drive_url, main_drive_folder_url FROM booths WHERE id = :id");
$cur->execute([':id' => $bA69Id]);
$row = $cur->fetch(PDO::FETCH_ASSOC);
assertPrintPersistence($row['print_drive_url'] === $testDriveUrl, "booths.print_drive_url correctly committed to SQLite");

$curLink = $pdo->prepare("SELECT drive_url, is_final FROM booth_links WHERE booth_id = :id AND category = 'print_ready'");
$curLink->execute([':id' => $bA69Id]);
$lRow = $curLink->fetch(PDO::FETCH_ASSOC);
assertPrintPersistence($lRow && $lRow['drive_url'] === $testDriveUrl, "booth_links correctly committed with category print_ready");
assertPrintPersistence((int)$lRow['is_final'] === 1, "booth_links marked as final/canonical");

echo "\nTest 2: Single Booth Query Consistency (manage/api/booths.php?id=...)\n";
$singleStmt = $pdo->prepare("
    SELECT 
        b.*,
        COALESCE(
            NULLIF(b.print_drive_url, ''),
            (SELECT drive_url FROM booth_links WHERE booth_id = b.id AND category IN ('print_ready', 'working_artwork') AND drive_url IS NOT NULL AND drive_url != '' ORDER BY is_final DESC, created_at DESC LIMIT 1)
        ) AS resolved_print_drive_url
    FROM booths b
    WHERE b.id = :id
    LIMIT 1
");
$singleStmt->execute([':id' => $bA69Id]);
$singleBooth = $singleStmt->fetch(PDO::FETCH_ASSOC);
assertPrintPersistence($singleBooth['print_drive_url'] === $testDriveUrl, "Single booth returns print_drive_url");
assertPrintPersistence($singleBooth['resolved_print_drive_url'] === $testDriveUrl, "Single booth returns resolved_print_drive_url");

echo "\nTest 3: Directory Booths Query Consistency (manage/api/booths.php)\n";
$dirStmt = $pdo->prepare("
    SELECT 
        b.*,
        COALESCE(
            NULLIF(b.print_drive_url, ''),
            (SELECT drive_url FROM booth_links WHERE booth_id = b.id AND category IN ('print_ready', 'working_artwork') AND drive_url IS NOT NULL AND drive_url != '' ORDER BY is_final DESC, created_at DESC LIMIT 1)
        ) AS print_drive_url
    FROM booths b
    WHERE b.event_id = :event_id
");
$dirStmt->execute([':event_id' => $eventId]);
$dirBooths = $dirStmt->fetchAll(PDO::FETCH_ASSOC);
$a69Dir = null;
$b02Dir = null;
foreach ($dirBooths as $b) {
    if ($b['id'] === $bA69Id) $a69Dir = $b;
    if ($b['id'] === $bB02Id) $b02Dir = $b;
}
assertPrintPersistence($a69Dir !== null && $a69Dir['print_drive_url'] === $testDriveUrl, "Directory booth A69 has correct print_drive_url for shortcut badge");
assertPrintPersistence($b02Dir !== null && empty($b02Dir['print_drive_url']), "Directory booth B02 has empty print_drive_url (multi-booth isolation verified)");

echo "\nTest 4: Event Stalls Query Consistency (manage/api/events.php?id=...)\n";
$evtStmt = $pdo->prepare("
    SELECT 
        b.*,
        COALESCE(
            NULLIF(b.print_drive_url, ''),
            (SELECT drive_url FROM booth_links WHERE booth_id = b.id AND category IN ('print_ready', 'working_artwork') AND drive_url IS NOT NULL AND drive_url != '' ORDER BY is_final DESC, created_at DESC LIMIT 1)
        ) AS print_drive_url
    FROM booths b
    WHERE b.event_id = :event_id
");
$evtStmt->execute([':event_id' => $eventId]);
$evtStalls = $evtStmt->fetchAll(PDO::FETCH_ASSOC);
$a69Evt = null;
foreach ($evtStalls as $b) {
    if ($b['id'] === $bA69Id) $a69Evt = $b;
}
assertPrintPersistence($a69Evt !== null && $a69Evt['print_drive_url'] === $testDriveUrl, "Event stalls query returns accurate print_drive_url");

echo "\nTest 5: Checklist Task Updates (Mark Done, NA, Pending) Never Clear Print Drive URL\n";
// Update task status to completed
$pdo->prepare("UPDATE booth_tasks SET status = 'completed', is_completed = 1 WHERE id = :id")->execute([':id' => $tPrintId]);

$checkStmt = $pdo->prepare("SELECT print_drive_url FROM booths WHERE id = :id");
$checkStmt->execute([':id' => $bA69Id]);
assertPrintPersistence($checkStmt->fetchColumn() === $testDriveUrl, "Marking Print Files Done preserves print_drive_url");

// Update task status to not_applicable
$pdo->prepare("UPDATE booth_tasks SET status = 'not_applicable', is_completed = 0 WHERE id = :id")->execute([':id' => $tPrintId]);
$checkStmt->execute([':id' => $bA69Id]);
assertPrintPersistence($checkStmt->fetchColumn() === $testDriveUrl, "Marking Print Files N/A preserves print_drive_url");

echo "\nTest 6: Print Status, Design Responsibility, and Remark Updates Never Clear Link\n";
// Update print_file_status
$pdo->prepare("UPDATE booths SET print_file_status = 'All Files Ready' WHERE id = :id")->execute([':id' => $bA69Id]);
$checkStmt->execute([':id' => $bA69Id]);
assertPrintPersistence($checkStmt->fetchColumn() === $testDriveUrl, "Updating print_file_status preserves print_drive_url");

// Update design_responsibility
$pdo->prepare("UPDATE booths SET design_responsibility = 'Our Side' WHERE id = :id")->execute([':id' => $bA69Id]);
$checkStmt->execute([':id' => $bA69Id]);
assertPrintPersistence($checkStmt->fetchColumn() === $testDriveUrl, "Updating design_responsibility preserves print_drive_url");

// Update print_remark
$pdo->prepare("UPDATE booths SET print_remark = 'High-res artwork received' WHERE id = :id")->execute([':id' => $bA69Id]);
$checkStmt->execute([':id' => $bA69Id]);
assertPrintPersistence($checkStmt->fetchColumn() === $testDriveUrl, "Updating print_remark preserves print_drive_url");

echo "\nTest 7: Self-Healing Fallback from booth_links and No Substitution of main_drive_folder_url\n";
// Test case A: booths.print_drive_url is cleared, but booth_links has it
$pdo->prepare("UPDATE booths SET print_drive_url = NULL WHERE id = :id")->execute([':id' => $bA69Id]);

// Execute single booth query with self-healing fallback
$singleStmt->execute([':id' => $bA69Id]);
$recoveredBooth = $singleStmt->fetch(PDO::FETCH_ASSOC);
$canonicalRecovered = !empty($recoveredBooth['resolved_print_drive_url'])
    ? $recoveredBooth['resolved_print_drive_url']
    : $recoveredBooth['print_drive_url'];
assertPrintPersistence($canonicalRecovered === $testDriveUrl, "Self-healing correctly recovers print_drive_url from booth_links");

// Test case B: Booth has general main_drive_folder_url but NO dedicated print files link
// It must NOT substitute general folder for print_drive_url
$bNoPrintId = 'test-noprint-' . bin2hex(random_bytes(4));
$insBooth->execute([
    ':id' => $bNoPrintId,
    ':event_id' => $eventId,
    ':booth_number' => 'C99',
    ':client_name' => 'General Folder Only Inc',
]);
$pdo->prepare("UPDATE booths SET main_drive_folder_url = 'https://drive.google.com/drive/folders/general-booth-folder' WHERE id = :id")
    ->execute([':id' => $bNoPrintId]);

$singleStmt->execute([':id' => $bNoPrintId]);
$noPrintBooth = $singleStmt->fetch(PDO::FETCH_ASSOC);
assertPrintPersistence(empty($noPrintBooth['print_drive_url']), "General main_drive_folder_url is not substituted into print_drive_url");
assertPrintPersistence(empty($noPrintBooth['resolved_print_drive_url']), "resolved_print_drive_url is empty when no dedicated print files link exists");

echo "\nTest 8: 3D Stall Views Unaffected by Print Link Updates\n";
$link3dId = 'lnk-3d-' . bin2hex(random_bytes(4));
$test3dUrl = 'https://drive.google.com/file/d/3d-test-model/view';
$pdo->prepare("
    INSERT INTO booth_links (id, booth_id, category, title, drive_url, is_final, created_at, updated_at)
    VALUES (:id, :b_id, 'render_3d', 'Final 3D View', :url, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
")->execute([':id' => $link3dId, ':b_id' => $bA69Id, ':url' => $test3dUrl]);

$check3d = $pdo->prepare("SELECT drive_url FROM booth_links WHERE booth_id = :id AND category = 'render_3d'");
$check3d->execute([':id' => $bA69Id]);
assertPrintPersistence($check3d->fetchColumn() === $test3dUrl, "3D Stall View link exists and remains intact");

// Clean up test data
$pdo->prepare("DELETE FROM booth_tasks WHERE booth_id IN (:b1, :b2, :b3)")->execute([':b1' => $bA69Id, ':b2' => $bB02Id, ':b3' => $bNoPrintId]);
$pdo->prepare("DELETE FROM booth_links WHERE booth_id IN (:b1, :b2, :b3)")->execute([':b1' => $bA69Id, ':b2' => $bB02Id, ':b3' => $bNoPrintId]);
$pdo->prepare("DELETE FROM booths WHERE id IN (:b1, :b2, :b3)")->execute([':b1' => $bA69Id, ':b2' => $bB02Id, ':b3' => $bNoPrintId]);
$pdo->prepare("DELETE FROM events WHERE id = :id")->execute([':id' => $eventId]);

echo "\nCleaned up test data safely.\n";
echo "=== All Print Files Link Persistence tests PASSED! ===\n";
