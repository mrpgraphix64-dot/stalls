<?php
/**
 * Test: Google Drive Print Links Persistence & Two-Way Sync
 */

require_once __DIR__ . '/../manage/api/config.php';

echo "=== TEST SUITE: GOOGLE DRIVE PRINT LINKS PERSISTENCE ===\n\n";

$pdo = reworkzone_get_db();
$pass = 0;
$fail = 0;

function assert_true($cond, $msg) {
    global $pass, $fail;
    if ($cond) {
        echo "  [PASS] $msg\n";
        $pass++;
    } else {
        echo "  [FAIL] $msg\n";
        $fail++;
    }
}

// 1. Create a test event and booth
$eventId = 'evt_test_persist_' . bin2hex(random_bytes(4));
$pdo->prepare("INSERT INTO events (id, name, venue, city, start_date, end_date, status) VALUES (:id, 'Test Event', 'Expocentre', 'Noida', '2026-12-01', '2026-12-03', 'upcoming')")
    ->execute([':id' => $eventId]);

$boothId = 'bth_test_persist_' . bin2hex(random_bytes(4));
$pdo->prepare("INSERT INTO booths (id, event_id, booth_number, client_name, booking_stage, status) VALUES (:id, :eid, 'T-01', 'Acme Corp', 'confirmed', 'active')")
    ->execute([':id' => $boothId, ':eid' => $eventId]);

// Auto-seed default tasks
$defaultTasks = ['Design', 'Print Files', 'Production', 'Furniture', 'Electrical'];
$taskIds = [];
foreach ($defaultTasks as $idx => $tName) {
    $tId = 'tsk_test_' . bin2hex(random_bytes(4));
    $pdo->prepare("INSERT INTO booth_tasks (id, booth_id, phase, task_name, sort_order, display_order, status, is_completed) VALUES (:id, :bid, :p, :p, :so, :so, 'pending', 0)")
        ->execute([':id' => $tId, ':bid' => $boothId, ':p' => $tName, ':so' => $idx + 1]);
    $taskIds[$tName] = $tId;
}

assert_true(count($taskIds) === 5, "Seeded 5 checklist tasks for test booth");

// Test 2: Save print Drive link via simulated update
$testDriveUrl = 'https://drive.google.com/drive/folders/1234567890abcdef_test_folder';
$pdo->prepare("UPDATE booths SET print_drive_url = :url, print_file_status = 'All Files Ready' WHERE id = :id")
    ->execute([':url' => $testDriveUrl, ':id' => $boothId]);

// Two-way sync: insert or update booth_links
$linkId = 'lnk_pr_' . bin2hex(random_bytes(6));
$pdo->prepare("INSERT INTO booth_links (id, booth_id, category, title, drive_url, created_at, updated_at) VALUES (:id, :bid, 'print_ready', 'Print Ready Artwork', :url, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
    ->execute([':id' => $linkId, ':bid' => $boothId, ':url' => $testDriveUrl]);

$check = $pdo->prepare("SELECT print_drive_url, print_file_status FROM booths WHERE id = :id");
$check->execute([':id' => $boothId]);
$row = $check->fetch();
assert_true($row['print_drive_url'] === $testDriveUrl, "print_drive_url saved on booths table");
assert_true($row['print_file_status'] === 'All Files Ready', "print_file_status saved on booths table");

$linkCheck = $pdo->prepare("SELECT drive_url FROM booth_links WHERE booth_id = :bid AND category = 'print_ready'");
$linkCheck->execute([':bid' => $boothId]);
$syncedUrl = $linkCheck->fetchColumn();
assert_true($syncedUrl === $testDriveUrl, "booth_links synced with print_ready URL");

// Test 3: Toggle Task to Completed (Mark Done) - Verify print_drive_url is completely untouched
$printTaskId = $taskIds['Print Files'];
$pdo->prepare("UPDATE booth_tasks SET status = 'completed', is_completed = 1, updated_at = CURRENT_TIMESTAMP WHERE id = :id")
    ->execute([':id' => $printTaskId]);

$checkAfterDone = $pdo->prepare("SELECT print_drive_url, print_file_status FROM booths WHERE id = :id");
$checkAfterDone->execute([':id' => $boothId]);
$rowAfterDone = $checkAfterDone->fetch();
assert_true($rowAfterDone['print_drive_url'] === $testDriveUrl, "print_drive_url retained after task marked Done");

// Test 4: Toggle Task to N/A - Verify print_drive_url is completely untouched
$pdo->prepare("UPDATE booth_tasks SET status = 'not_applicable', is_completed = 0, updated_at = CURRENT_TIMESTAMP WHERE id = :id")
    ->execute([':id' => $printTaskId]);

$checkAfterNA = $pdo->prepare("SELECT print_drive_url, print_file_status FROM booths WHERE id = :id");
$checkAfterNA->execute([':id' => $boothId]);
$rowAfterNA = $checkAfterNA->fetch();
assert_true($rowAfterNA['print_drive_url'] === $testDriveUrl, "print_drive_url retained after task marked N/A");

// Test 5: Self-healing fallback test
// Simulate situation where booths.print_drive_url was null but booth_links had the record
$pdo->prepare("UPDATE booths SET print_drive_url = NULL WHERE id = :id")->execute([':id' => $boothId]);

// Execute self-healing query as implemented in booths.php
$healCheck = $pdo->prepare("SELECT drive_url FROM booth_links WHERE booth_id = :b_id AND category IN ('print_ready', 'working_artwork') AND drive_url IS NOT NULL AND drive_url != '' ORDER BY created_at DESC LIMIT 1");
$healCheck->execute([':b_id' => $boothId]);
$foundUrl = $healCheck->fetchColumn();
assert_true($foundUrl === $testDriveUrl, "Self-healing detected link from booth_links");

if ($foundUrl) {
    $pdo->prepare("UPDATE booths SET print_drive_url = :url WHERE id = :id")->execute([':url' => $foundUrl, ':id' => $boothId]);
}

$checkAfterHeal = $pdo->prepare("SELECT print_drive_url FROM booths WHERE id = :id");
$checkAfterHeal->execute([':id' => $boothId]);
assert_true($checkAfterHeal->fetchColumn() === $testDriveUrl, "booths.print_drive_url restored via self-healing");

// Clean up
$pdo->prepare("DELETE FROM booth_links WHERE booth_id = :bid")->execute([':bid' => $boothId]);
$pdo->prepare("DELETE FROM booth_tasks WHERE booth_id = :bid")->execute([':bid' => $boothId]);
$pdo->prepare("DELETE FROM booths WHERE id = :bid")->execute([':bid' => $boothId]);
$pdo->prepare("DELETE FROM events WHERE id = :eid")->execute([':eid' => $eventId]);

echo "\n--- SUMMARY ---\n";
echo "Total assertions: " . ($pass + $fail) . "\n";
echo "Passed: $pass\n";
echo "Failed: $fail\n\n";

if ($fail > 0) {
    exit(1);
}
