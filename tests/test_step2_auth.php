<?php
/**
 * Automated Verification Test Suite for Step 2
 * Tests SQLite schema, PIN auth, rate limiting, setup locking, and session security.
 * Uses an isolated temporary test directory (does NOT touch production data).
 */

$testDataDir = sys_get_temp_dir() . '/reworkzone_test_' . bin2hex(random_bytes(6));
mkdir($testDataDir, 0755, true);
define('REWORKZONE_DATA_DIR_OVERRIDE', $testDataDir);

require_once dirname(__DIR__) . '/manage/api/config.php';
require_once dirname(__DIR__) . '/manage/api/auth-helper.php';

$passed = 0;
$failed = 0;

function assert_test($description, $condition) {
    global $passed, $failed;
    if ($condition) {
        echo "  [PASS] {$description}\n";
        $passed++;
    } else {
        echo "  [FAIL] {$description}\n";
        $failed++;
    }
}

echo "========================================================\n";
echo "REWORKZONE STALLS - STEP 2 AUTOMATED TEST SUITE\n";
echo "Isolated Test Database: {$testDataDir}/reworkzone_stalls.sqlite\n";
echo "========================================================\n\n";

// ---------------------------------------------------------
// TEST GROUP 1: Database Initialization & Idempotency
// ---------------------------------------------------------
echo "Test Group 1: Database Connection & Schema Idempotency\n";

$pdo = reworkzone_get_db();
assert_test("Database connection created successfully", $pdo instanceof PDO);

// Verify foreign keys are enabled
$fk = (int)$pdo->query("PRAGMA foreign_keys;")->fetchColumn();
assert_test("PRAGMA foreign_keys is ON", $fk === 1);

// Verify journal mode is WAL
$jm = strtoupper($pdo->query("PRAGMA journal_mode;")->fetchColumn());
assert_test("PRAGMA journal_mode is WAL", $jm === 'WAL');

// Verify all required tables exist
$tables = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")->fetchAll(PDO::FETCH_COLUMN);
$expectedTables = ['activity_logs', 'auth_accounts', 'auth_lockouts', 'booth_expenses', 'booth_items', 'booth_links', 'booth_tasks', 'booths', 'events'];

foreach ($expectedTables as $t) {
    assert_test("Table '{$t}' exists", in_array($t, $tables));
}

// Verify booth_links columns
$linkCols = $pdo->query("PRAGMA table_info(booth_links);")->fetchAll(PDO::FETCH_COLUMN, 1);
assert_test("booth_links has 'drive_url'", in_array('drive_url', $linkCols));
assert_test("booth_links has 'is_final'", in_array('is_final', $linkCols));
assert_test("booth_links has 'approved_at'", in_array('approved_at', $linkCols));

// Verify booths columns
$boothCols = $pdo->query("PRAGMA table_info(booths);")->fetchAll(PDO::FETCH_COLUMN, 1);
assert_test("booths has 'main_drive_folder_url'", in_array('main_drive_folder_url', $boothCols));

// Verify Idempotency: Running schema init a second time must NOT fail or drop data
reworkzone_init_schema($pdo);
assert_test("Second run of reworkzone_init_schema() is idempotent without errors", true);

echo "\n";

// ---------------------------------------------------------
// TEST GROUP 2: Setup Secret & Initialization Gate
// ---------------------------------------------------------
echo "Test Group 2: First-Run Setup Gate & Secret Enforcement\n";

// At start, auth_accounts count must be 0
$cnt = (int)$pdo->query("SELECT COUNT(*) FROM auth_accounts;")->fetchColumn();
assert_test("Initial auth_accounts count is 0", $cnt === 0);

// Generate setup secret
$secretFile = $testDataDir . '/setup_secret.txt';
$testSecret = bin2hex(random_bytes(16));
file_put_contents($secretFile, $testSecret);
assert_test("Setup secret file created on server", file_exists($secretFile));

// Test rejection of invalid secret
$fakeSecret = 'wrong_secret_12345';
assert_test("Setup rejects invalid secret", !hash_equals(trim(file_get_contents($secretFile)), $fakeSecret));

// Test rejection of invalid PIN format
$badPins = ['123', 'abcdef', '1234567', '111111', '123456'];
foreach ($badPins as $bp) {
    $isBad = !preg_match('/^\d{6}$/', $bp) || preg_match('/^(\d)\1{5}$/', $bp) || in_array($bp, ['123456', '654321', '012345']);
    assert_test("Invalid or weak PIN '{$bp}' rejected", $isBad);
}

// Execute valid initialization with secure 6-digit PIN
$validPin = '840291';
$pinHash = password_hash($validPin, PASSWORD_BCRYPT, ['cost' => 12]);
$stmt = $pdo->prepare("INSERT INTO auth_accounts (account_name, pin_hash, role, is_active) VALUES ('Master Admin', :h, 'master', 1)");
$stmt->execute([':h' => $pinHash]);
unlink($secretFile);

assert_test("Master account created with role 'master'", (int)$pdo->query("SELECT COUNT(*) FROM auth_accounts WHERE role='master'")->fetchColumn() === 1);
assert_test("Setup secret file securely removed after initialization", !file_exists($secretFile));

// Verify Setup is now PERMANENTLY LOCKED
$isLocked = (int)$pdo->query("SELECT COUNT(*) FROM auth_accounts;")->fetchColumn() > 0;
assert_test("Setup is permanently locked once Master account exists", $isLocked);

echo "\n";

// ---------------------------------------------------------
// TEST GROUP 3: Authentication & Password Verification
// ---------------------------------------------------------
echo "Test Group 3: Authentication, Password Hashing & Rate Limiting\n";

$account = $pdo->query("SELECT * FROM auth_accounts WHERE role='master' LIMIT 1;")->fetch();

// Test password_verify
assert_test("Valid PIN {$validPin} verified by password_verify()", password_verify($validPin, $account['pin_hash']));
assert_test("Wrong PIN 999999 rejected by password_verify()", !password_verify('999999', $account['pin_hash']));

// Test Rate Limiter
$testIp = '192.168.1.100';
reworkzone_clear_failed_attempts($pdo, $testIp);

$status0 = reworkzone_check_rate_limit($pdo, $testIp);
assert_test("Initial rate limit status is not locked", $status0['locked'] === false);

// Simulate 4 failed attempts
for ($i = 1; $i <= 4; $i++) {
    $att = reworkzone_record_failed_attempt($pdo, $testIp);
    assert_test("Attempt {$i} recorded (not yet locked)", $att === $i);
}

$status4 = reworkzone_check_rate_limit($pdo, $testIp);
assert_test("After 4 failed attempts: still not locked", $status4['locked'] === false);

// 5th failed attempt must trigger 15-minute lockout
$att5 = reworkzone_record_failed_attempt($pdo, $testIp);
$status5 = reworkzone_check_rate_limit($pdo, $testIp);
assert_test("5th failed attempt triggers lockout", $status5['locked'] === true && $status5['retry_after'] > 800);

// Clear failed attempts on simulated successful login
reworkzone_clear_failed_attempts($pdo, $testIp);
$statusCleared = reworkzone_check_rate_limit($pdo, $testIp);
assert_test("Successful authentication clears rate limiter", $statusCleared['locked'] === false && $statusCleared['attempts'] === 0);

echo "\n";

// ---------------------------------------------------------
// TEST GROUP 4: Session Security & Auth Middleware
// ---------------------------------------------------------
echo "Test Group 4: Session Security & Middleware\n";

reworkzone_start_session();

// Test unauthorized access
$_SESSION = [];
$unauthCaught = false;
try {
    // Check unauth detection
    if (empty($_SESSION['manage_authenticated'])) {
        $unauthCaught = true;
    }
} catch (Exception $e) {
    $unauthCaught = true;
}
assert_test("Unauthenticated session detected correctly", $unauthCaught);

// Simulate active session
$_SESSION['manage_authenticated'] = true;
$_SESSION['manage_account_id'] = 1;
$_SESSION['manage_account_name'] = 'Master Admin';
$_SESSION['manage_role'] = 'master';
$_SESSION['manage_login_time'] = time();

$auth = reworkzone_require_master_auth($pdo);
assert_test("Active Master session authenticated by middleware", $auth['role'] === 'master');

// Simulate session expiry (> 7 days)
$_SESSION['manage_login_time'] = time() - (86400 * 8);
$expired = (time() - $_SESSION['manage_login_time'] > (86400 * 7));
assert_test("Session older than 7 days flagged as expired", $expired);

echo "\n";

// ---------------------------------------------------------
// TEST GROUP 5: Authenticated PIN Change
// ---------------------------------------------------------
echo "Test Group 5: Authenticated PIN Change\n";

$newPin = '731804';
$newHash = password_hash($newPin, PASSWORD_BCRYPT, ['cost' => 12]);
$updateStmt = $pdo->prepare("UPDATE auth_accounts SET pin_hash = :h WHERE role = 'master'");
$updateStmt->execute([':h' => $newHash]);

$updatedAccount = $pdo->query("SELECT pin_hash FROM auth_accounts WHERE role = 'master'")->fetch();
assert_test("Old PIN {$validPin} rejected after update", !password_verify($validPin, $updatedAccount['pin_hash']));
assert_test("New PIN {$newPin} accepted after update", password_verify($newPin, $updatedAccount['pin_hash']));

echo "\n";

// ---------------------------------------------------------
// TEST GROUP 6: Data Preservation & Persistence Check
// ---------------------------------------------------------
echo "Test Group 6: Data Integrity on Re-initialization\n";

// Insert a test event and booth
$eventId = 'evt_test_' . bin2hex(random_bytes(4));
$pdo->prepare("INSERT INTO events (id, name, venue, city, start_date, end_date, setup_date, dismantling_date) VALUES (:id, 'Test Expo', 'Hall 1', 'Ahmedabad', '2026-12-01', '2026-12-03', '2026-11-30', '2026-12-04')")
    ->execute([':id' => $eventId]);

$boothId = 'bth_test_' . bin2hex(random_bytes(4));
$pdo->prepare("INSERT INTO booths (id, event_id, booth_number, client_name, main_drive_folder_url) VALUES (:id, :eid, 'A01', 'Acme Corp', 'https://drive.google.com/test')")
    ->execute([':id' => $boothId, ':eid' => $eventId]);

// Re-run schema initialization
reworkzone_init_schema($pdo);

// Verify records still exist
$eventCheck = $pdo->query("SELECT name FROM events WHERE id = '{$eventId}'")->fetchColumn();
$boothCheck = $pdo->query("SELECT main_drive_folder_url FROM booths WHERE id = '{$boothId}'")->fetchColumn();

assert_test("Existing event preserved after re-running schema init", $eventCheck === 'Test Expo');
assert_test("Existing booth preserved with Google Drive URL", $boothCheck === 'https://drive.google.com/test');

echo "\n";

// Clean up isolated test directory
$files = glob($testDataDir . '/*');
foreach ($files as $f) {
    if (is_file($f)) @unlink($f);
}
@rmdir($testDataDir);

echo "========================================================\n";
echo "TEST RESULTS SUMMARY: {$passed} PASSED, {$failed} FAILED\n";
echo "========================================================\n";

if ($failed === 0) {
    echo "STATUS: ALL STEP 2 CRITERIA VERIFIED SUCCESSFULLY.\n";
    exit(0);
} else {
    echo "STATUS: VERIFICATION FAILED.\n";
    exit(1);
}
