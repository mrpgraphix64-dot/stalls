<?php
/**
 * Reworkzone Stalls Operations System - CLI Backup & Restore Utility
 *
 * Can be run via Hostinger cron job or command line:
 * - Daily backup with 7-day retention: php manage/backup-cli.php
 * - Database integrity verification:   php manage/backup-cli.php --verify
 * - Restoration:                       php manage/backup-cli.php --restore=backup.sqlite
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    echo "CLI only.\n";
    exit(1);
}

require_once __DIR__ . '/api/config.php';
require_once __DIR__ . '/api/auth-helper.php';

$pdo = reworkzone_get_db();
$dataDir = reworkzone_get_data_dir();
$dbFile = reworkzone_get_db_path();
$backupsDir = $dataDir . '/backups';

if (!is_dir($backupsDir)) {
    @mkdir($backupsDir, 0755, true);
}

$args = getopt('', ['verify', 'restore::', 'help']);

if (isset($args['help'])) {
    echo "Reworkzone Stalls Backup Utility\n";
    echo "Usage:\n";
    echo "  php manage/backup-cli.php            Create a daily snapshot with 7-day retention\n";
    echo "  php manage/backup-cli.php --verify   Verify SQLite file and foreign keys integrity\n";
    echo "  php manage/backup-cli.php --restore=<path> Restore database from backup file\n";
    exit(0);
}

// 1. VERIFY
if (isset($args['verify'])) {
    echo "Verifying database integrity...\n";
    $integrity = $pdo->query("PRAGMA integrity_check;")->fetchColumn();
    $fkCheck = $pdo->query("PRAGMA foreign_key_check;")->fetchAll();

    echo "  PRAGMA integrity_check: {$integrity}\n";
    echo "  Foreign key violations: " . count($fkCheck) . "\n";
    echo "  Database size: " . number_format(filesize($dbFile)) . " bytes\n";

    if ($integrity === 'ok' && empty($fkCheck)) {
        echo "SUCCESS: Database is healthy.\n";
        exit(0);
    } else {
        echo "ERROR: Database health issue detected.\n";
        exit(1);
    }
}

// 2. RESTORE
if (isset($args['restore'])) {
    $restoreFile = $args['restore'];
    if (!file_exists($restoreFile)) {
        echo "ERROR: Backup file '{$restoreFile}' does not exist.\n";
        exit(1);
    }

    echo "Verifying source backup file integrity...\n";
    $testPdo = new PDO("sqlite:{$restoreFile}");
    $check = $testPdo->query("PRAGMA integrity_check;")->fetchColumn();
    $testPdo = null;

    if ($check !== 'ok') {
        echo "ERROR: Source backup file is corrupt ({$check}). Restore aborted.\n";
        exit(1);
    }

    // Create safety copy of current DB before overwriting
    $safetyCopy = $backupsDir . '/pre_restore_safety_' . date('Ymd_His') . '.sqlite';
    @copy($dbFile, $safetyCopy);
    echo "Safety backup created at: {$safetyCopy}\n";

    // Close PDO connection by nulling it
    $pdo = null;

    if (!copy($restoreFile, $dbFile)) {
        echo "ERROR: Failed to copy backup into database file.\n";
        exit(1);
    }

    // Remove WAL files if present so SQLite starts clean
    @unlink($dbFile . '-wal');
    @unlink($dbFile . '-shm');

    echo "SUCCESS: Database restored successfully from '{$restoreFile}'.\n";
    exit(0);
}

// 3. CREATE DAILY SNAPSHOT (Default action)
echo "Starting automated database backup...\n";

$timestamp = date('Y-m-d_His');
$snapshotFilename = "reworkzone_stalls_backup_{$timestamp}.sqlite";
$snapshotPath = $backupsDir . '/' . $snapshotFilename;

try {
    try {
        $pdo->exec("VACUUM INTO " . $pdo->quote($snapshotPath));
    } catch (Exception $e) {
        $pdo->exec("PRAGMA wal_checkpoint(TRUNCATE);");
        copy($dbFile, $snapshotPath);
    }

    $testPdo = new PDO("sqlite:{$snapshotPath}");
    $check = $testPdo->query("PRAGMA integrity_check;")->fetchColumn();
    $testPdo = null;

    if ($check !== 'ok') {
        @unlink($snapshotPath);
        throw new Exception("Integrity check failed on snapshot: {$check}");
    }

    // Prune backups keeping last 7
    $allSnapshots = glob($backupsDir . '/reworkzone_stalls_backup_*.sqlite') ?: [];
    rsort($allSnapshots);
    $pruned = 0;
    if (count($allSnapshots) > 7) {
        for ($i = 7; $i < count($allSnapshots); $i++) {
            if (@unlink($allSnapshots[$i])) {
                $pruned++;
            }
        }
    }

    echo "SUCCESS: Backup created at {$snapshotPath} (" . number_format(filesize($snapshotPath)) . " bytes)\n";
    echo "Retained: " . min(count($allSnapshots), 7) . " snapshots (Pruned: {$pruned})\n";
    exit(0);

} catch (Exception $e) {
    echo "ERROR: Backup failed: " . $e->getMessage() . "\n";
    exit(1);
}
