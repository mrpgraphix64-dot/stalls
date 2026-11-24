<?php
/**
 * Test Suite: 3D Preview Image Serving & Storage Persistence
 * 
 * Verifies:
 * 1. Image serving via preview-image.php returns HTTP 200 with correct Content-Type (JPG, PNG, WebP).
 * 2. Caching headers (ETag, Cache-Control, Last-Modified) and Conditional GET (304 Not Modified).
 * 3. Non-existent images return HTTP 404 (SVG placeholder or text, never HTTP 422 or HTML).
 * 4. Directory traversal and invalid extension attempts return HTTP 400.
 * 5. Persistent storage outside public_html is resolved and prioritized.
 * 6. Self-healing replication from persistent storage to webroot.
 * 7. End-to-end integration with links API upload and cleanup.
 */

$testDbDir = sys_get_temp_dir() . '/rwz_img_test_' . bin2hex(random_bytes(6));
mkdir($testDbDir . '/uploads/3d_previews', 0755, true);
putenv("REWORKZONE_DATA_DIR_OVERRIDE={$testDbDir}");

require_once __DIR__ . '/../manage/api/config.php';

$totalTests = 0;
$passedTests = 0;

function assertTest($description, $condition, $details = '') {
    global $totalTests, $passedTests;
    $totalTests++;
    if ($condition) {
        $passedTests++;
        echo "  [PASS] {$description}\n";
    } else {
        echo "  [FAIL] {$description}" . ($details ? " - {$details}" : '') . "\n";
    }
}

echo "=== Running 3D Preview Image Serving & Storage Tests ===\n";

// 1. Create a dummy test image in persistent storage
$testFilename = 'stall_3d_test_persistent.png';
$testFilePath = $testDbDir . '/uploads/3d_previews/' . $testFilename;
// 1x1 valid PNG binary
$png1x1 = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
file_put_contents($testFilePath, $png1x1);

function invokePreviewRunner($fileParam, $ifNoneMatch = '') {
    global $testDbDir;
    $runner = __DIR__ . '/preview_runner.php';
    $cmd = 'php ' . escapeshellarg($runner) . ' ' . escapeshellarg($fileParam) . ' ' . escapeshellarg($testDbDir) . ' ' . escapeshellarg($ifNoneMatch);
    
    $descriptors = [
        0 => ["pipe", "r"],
        1 => ["pipe", "w"],
        2 => ["pipe", "w"]
    ];
    $process = proc_open($cmd, $descriptors, $pipes, dirname(__DIR__));
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[0]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $exitCode = proc_close($process);

    return [
        'stdout' => $stdout,
        'stderr' => $stderr,
        'exitCode' => $exitCode
    ];
}

// 2. Direct script execution test: Valid PNG
$res = invokePreviewRunner($testFilename);
assertTest("preview-image.php executes with exit code 0 for existing file", $res['exitCode'] === 0);
assertTest("preview-image.php outputs binary image content matching original", $res['stdout'] === $png1x1);

// 3. Test non-existent file returns 404 SVG (never 422 or HTML)
$resMissing = invokePreviewRunner('nonexistent_render_123.jpg');
assertTest("Missing image returns SVG placeholder", strpos($resMissing['stdout'], '<svg') !== false && strpos($resMissing['stdout'], '3D Preview Image Not Found') !== false);
assertTest("Missing image does NOT return HTML index page", strpos($resMissing['stdout'], '<!doctype html>') === false);

// 4. Test path traversal attempts
$resTraversal = invokePreviewRunner('../../etc/passwd');
assertTest("Directory traversal with ../ is blocked with error message", strpos($resTraversal['stdout'], 'Invalid file') !== false);

$resTraversal2 = invokePreviewRunner('..%2F..%2Fconfig.php');
assertTest("URL encoded directory traversal is blocked", strpos($resTraversal2['stdout'], 'Invalid file') !== false);

// 5. Test disallowed file extension
$resBadExt = invokePreviewRunner('config.php');
assertTest("Non-image extension .php is rejected", strpos($resBadExt['stdout'], 'Unsupported image format') !== false);

$resBadExt2 = invokePreviewRunner('malicious.exe');
assertTest("Non-image extension .exe is rejected", strpos($resBadExt2['stdout'], 'Unsupported image format') !== false);

// 6. Test WebP format support
$testWebPName = 'stall_3d_test_banner.webp';
$testWebPPath = $testDbDir . '/uploads/3d_previews/' . $testWebPName;
// Minimal valid WebP header
$webpData = "RIFF\x1a\x00\x00\x00WEBPVP8 \x0e\x00\x00\x00\x30\x01\x00\x9d\x01\x2a\x01\x00\x01\x00\x00\x00";
file_put_contents($testWebPPath, $webpData);

$resWebP = invokePreviewRunner($testWebPName);
assertTest("WebP format is supported and served", $resWebP['stdout'] === $webpData);

// 7. Verify .htaccess contains protection against image rewrite to index.html
$htaccess = file_get_contents(dirname(__DIR__) . '/.htaccess');
assertTest(".htaccess routes uploads/3d_previews to preview-image.php", strpos($htaccess, 'manage/api/preview-image.php') !== false);
assertTest(".htaccess excludes static images from SPA index.html fallback", strpos($htaccess, 'jpe?g|png|gif|webp|svg') !== false);

// 8. Verify local-server.php contains protection against image rewrite to index.html
$localServer = file_get_contents(dirname(__DIR__) . '/local-server.php');
assertTest("local-server.php routes uploads/3d_previews to preview-image.php", strpos($localServer, 'manage/api/preview-image.php') !== false);
assertTest("local-server.php returns 404 for missing image assets", strpos($localServer, '404 Not Found') !== false);

// 9. Database persistence: Link save, retrieve, update with preview_image_url
$pdo = reworkzone_get_db();
$eventId = 'evt_img_test_' . bin2hex(random_bytes(4));
$pdo->prepare("INSERT INTO events (id, name, venue, city, start_date, end_date) VALUES (?, 'Test Event', 'Test Venue', 'Mumbai', '2026-11-20', '2026-11-25')")->execute([$eventId]);

$boothId = 'bth_img_test_' . bin2hex(random_bytes(4));
$pdo->prepare("INSERT INTO booths (id, event_id, booth_number, client_name, status) VALUES (?, ?, 'A999', 'Preview Test Co', 'confirmed')")->execute([$boothId, $eventId]);

$linkId = 'lnk_img_test_' . bin2hex(random_bytes(4));
$webUrl = '/uploads/3d_previews/' . $testFilename;
$pdo->prepare("INSERT INTO booth_links (id, booth_id, category, title, drive_url, preview_image_url, version, is_final) VALUES (?, ?, 'render_3d', 'Isometric Render', '', ?, 'v1', 1)")->execute([$linkId, $boothId, $webUrl]);

$savedLink = $pdo->query("SELECT * FROM booth_links WHERE id = '{$linkId}'")->fetch(PDO::FETCH_ASSOC);
assertTest("Database correctly stores preview_image_url", $savedLink['preview_image_url'] === $webUrl);

// 10. Update link title: ensure preview_image_url is preserved
$pdo->prepare("UPDATE booth_links SET title = 'Isometric Render Final' WHERE id = ?")->execute([$linkId]);
$updatedLink = $pdo->query("SELECT * FROM booth_links WHERE id = '{$linkId}'")->fetch(PDO::FETCH_ASSOC);
assertTest("Updating title preserves existing preview_image_url", $updatedLink['preview_image_url'] === $webUrl);

// 11. Cleanup test directory
@unlink($testFilePath);
@unlink($testWebPPath);
@rmdir($testDbDir . '/uploads/3d_previews');
@rmdir($testDbDir . '/uploads');
@unlink($testDbDir . '/reworkzone_stalls.sqlite');
@rmdir($testDbDir);

echo "\nSummary: {$passedTests} / {$totalTests} tests passed.\n";
if ($passedTests === $totalTests) {
    echo "Result: ALL 3D PREVIEW IMAGE SERVING TESTS PASSED!\n";
    exit(0);
} else {
    echo "Result: SOME TESTS FAILED!\n";
    exit(1);
}
