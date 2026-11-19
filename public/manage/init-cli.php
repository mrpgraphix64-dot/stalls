<?php
/**
 * Reworkzone Stalls Operations System - Secure CLI Master PIN Initializer
 *
 * Designed for:
 * 1. Interactive terminal prompt with hidden PIN input (no echo)
 * 2. Confirmation matching to prevent typos
 * 3. Local database initialization: php manage/init-cli.php --out=reworkzone_stalls.sqlite
 * 4. Direct VPS SSH initialization: ssh user@vps "php /var/www/stalls.reworkzone.in/manage/init-cli.php"
 * 5. Piped input for CI / test automation: php manage/init-cli.php --pin=XXXXXX
 *
 * Security:
 * - Never logs PINs
 * - Never exposes PIN in Git or environment files
 * - Permanent lock once initialized (refuses to re-initialize or wipe existing data)
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    echo "Access denied: CLI only.\n";
    exit(1);
}

// Helper to read hidden password from terminal
function reworkzone_cli_read_hidden($prompt = "Enter 6-digit Master PIN: ") {
    echo $prompt;

    // Check if running in a POSIX environment (Linux, macOS, Git Bash)
    if (DIRECTORY_SEPARATOR === '/' || (getenv('SHELL') && stripos(getenv('SHELL'), 'bash') !== false)) {
        @exec('stty -echo 2>/dev/null');
        $input = trim(fgets(STDIN));
        @exec('stty echo 2>/dev/null');
        echo "\n";
        return $input;
    }

    // Windows PowerShell fallback for silent read
    if (stripos(PHP_OS, 'WIN') === 0 && function_exists('exec')) {
        $psCommand = 'powershell -Command "$p = Read-Host -AsSecureString; [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p))"';
        $out = [];
        $ret = 0;
        @exec($psCommand, $out, $ret);
        if ($ret === 0 && !empty($out)) {
            echo "\n";
            return trim($out[0]);
        }
    }

    // Standard fallback
    $input = trim(fgets(STDIN));
    return $input;
}

$longOpts = ['pin::', 'out::', 'target-db::', 'help'];
$options = getopt('', $longOpts);

if (isset($options['help'])) {
    echo "Reworkzone Stalls - Master PIN CLI Initializer\n";
    echo "Usage:\n";
    echo "  php manage/init-cli.php                      Interactive prompt with hidden PIN\n";
    echo "  php manage/init-cli.php --out=filename.db    Initialize a portable local SQLite DB\n";
    echo "  php manage/init-cli.php --pin=XXXXXX         Automated / non-interactive setup\n";
    exit(0);
}

// Target database file override
$targetDb = $options['out'] ?? ($options['target-db'] ?? null);
if ($targetDb) {
    define('REWORKZONE_DATA_DIR_OVERRIDE', dirname(realpath($targetDb) ?: $targetDb));
    putenv("REWORKZONE_DB_PATH=" . (realpath($targetDb) ?: $targetDb));
    $_ENV['REWORKZONE_DB_PATH'] = (realpath($targetDb) ?: $targetDb);
}

require_once __DIR__ . '/api/config.php';

$pdo = reworkzone_get_db();

// Verify if already initialized
$count = (int)$pdo->query("SELECT COUNT(*) FROM auth_accounts WHERE is_active = 1")->fetchColumn();
if ($count > 0) {
    echo "ERROR: System is already initialized. An active Master account exists.\n";
    echo "Setup is permanently locked to prevent unauthorized resets.\n";
    echo "To update the Master PIN, log in at /manage/settings and use the authenticated Change PIN option.\n";
    exit(1);
}

$pin = $options['pin'] ?? null;

if (empty($pin)) {
    echo "========================================================\n";
    echo "  REWORKZONE STALLS — MASTER PIN INITIALIZATION\n";
    echo "========================================================\n";
    echo "Configure the 6-digit Master PIN for internal operations access.\n";
    echo "Your entry is hidden and will not be displayed on screen.\n\n";

    $pin1 = reworkzone_cli_read_hidden("Enter 6-digit Master PIN: ");
    $pin2 = reworkzone_cli_read_hidden("Confirm 6-digit Master PIN: ");

    if ($pin1 !== $pin2) {
        echo "ERROR: PIN confirmation does not match. Setup aborted.\n";
        exit(1);
    }
    $pin = $pin1;
}

$pin = trim($pin);

// Format and complexity validation
if (!preg_match('/^\d{6}$/', $pin)) {
    echo "ERROR: PIN must be exactly 6 numeric digits (0-9).\n";
    exit(1);
}

if (preg_match('/^(\d)\1{5}$/', $pin) || in_array($pin, ['123456', '654321', '012345', '987654'])) {
    echo "ERROR: PIN is too simple (repeating or sequential). Please choose a secure 6-digit PIN.\n";
    exit(1);
}

// Initialize Master Account inside transaction
try {
    $pdo->beginTransaction();

    // Re-verify inside transaction
    $count = (int)$pdo->query("SELECT COUNT(*) FROM auth_accounts WHERE is_active = 1")->fetchColumn();
    if ($count > 0) {
        $pdo->rollBack();
        echo "ERROR: Database already initialized by another process.\n";
        exit(1);
    }

    $hash = password_hash($pin, PASSWORD_BCRYPT, ['cost' => 12]);
    $stmt = $pdo->prepare("
        INSERT INTO auth_accounts (account_name, pin_hash, role, is_active, created_at, updated_at)
        VALUES ('Master Admin', :pin_hash, 'master', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ");
    $stmt->execute([':pin_hash' => $hash]);

    // Log initialization event
    $logStmt = $pdo->prepare("
        INSERT INTO activity_logs (id, booth_id, action_type, actor_label, description, created_at)
        VALUES (:id, NULL, 'system_initialized_cli', 'CLI Initializer', 'Master account configured securely via CLI.', CURRENT_TIMESTAMP)
    ");
    $logStmt->execute([':id' => 'act_' . bin2hex(random_bytes(6))]);

    $pdo->commit();

    $activeDbPath = reworkzone_get_db_path();
    echo "\nSUCCESS: Master 6-digit PIN configured successfully!\n";
    echo "  Database file: {$activeDbPath}\n";
    echo "  First-run setup is now permanently locked.\n";
    echo "  Login is now active at: /manage\n";
    exit(0);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "ERROR: Database initialization failed: " . $e->getMessage() . "\n";
    exit(1);
}
