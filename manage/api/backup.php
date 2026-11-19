<?php
/**
 * Reworkzone Stalls Operations System - Database Backup API
 *
 * Implements:
 * 1. Master-only protected 1-click SQLite database download
 * 2. Safe online backup creation using SQLite VACUUM INTO / atomic snapshot
 * 3. Database integrity verification (PRAGMA integrity_check)
 * 4. Daily backup directory management with 7-day retention
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth-helper.php';

$pdo = reworkzone_get_db();
$auth = reworkzone_require_master_auth($pdo);

$action = $_GET['action'] ?? 'download';
$dataDir = reworkzone_get_data_dir();
$dbFile = reworkzone_get_db_path();
$backupsDir = $dataDir . '/backups';

if (!is_dir($backupsDir)) {
    @mkdir($backupsDir, 0755, true);
}

// -------------------------------------------------------------
// 1. ACTION: VERIFY DATABASE INTEGRITY
// -------------------------------------------------------------
if ($action === 'verify') {
    try {
        $integrityStmt = $pdo->query("PRAGMA integrity_check;");
        $integrityResult = $integrityStmt->fetchColumn();

        $fkStmt = $pdo->query("PRAGMA foreign_key_check;");
        $fkViolations = $fkStmt->fetchAll();

        $isOk = ($integrityResult === 'ok' && empty($fkViolations));

        reworkzone_json_response([
            'success'          => $isOk,
            'integrity'        => $integrityResult,
            'foreign_key_violations' => count($fkViolations),
            'database_path'    => basename($dbFile),
            'size_bytes'       => file_exists($dbFile) ? filesize($dbFile) : 0,
            'timestamp'        => date('Y-m-d H:i:s'),
        ]);
    } catch (Exception $e) {
        reworkzone_json_response([
            'success' => false,
            'error'   => 'Integrity verification failed: ' . $e->getMessage()
        ], 500);
    }
}

// -------------------------------------------------------------
// 2. ACTION: CREATE RETENTION SNAPSHOT (Daily Backups)
// -------------------------------------------------------------
if ($action === 'create_snapshot') {
    reworkzone_verify_csrf();

    try {
        $timestamp = date('Y-m-d_His');
        $snapshotFilename = "reworkzone_stalls_backup_{$timestamp}.sqlite";
        $snapshotPath = $backupsDir . '/' . $snapshotFilename;

        // Use VACUUM INTO for consistent transaction-safe copy if supported, otherwise atomic file copy
        try {
            $pdo->exec("VACUUM INTO " . $pdo->quote($snapshotPath));
        } catch (Exception $vacEx) {
            // Fallback for older SQLite versions: checkpoint WAL then copy
            $pdo->exec("PRAGMA wal_checkpoint(TRUNCATE);");
            if (!copy($dbFile, $snapshotPath)) {
                throw new Exception("Failed to copy database file.");
            }
        }

        // Verify backup integrity
        $testPdo = new PDO("sqlite:{$snapshotPath}");
        $check = $testPdo->query("PRAGMA integrity_check;")->fetchColumn();
        $testPdo = null;

        if ($check !== 'ok') {
            @unlink($snapshotPath);
            throw new Exception("Snapshot integrity check failed: {$check}");
        }

        // Apply retention: keep last 7 daily snapshots
        $allSnapshots = glob($backupsDir . '/reworkzone_stalls_backup_*.sqlite');
        rsort($allSnapshots);
        $pruned = 0;
        if (count($allSnapshots) > 7) {
            for ($i = 7; $i < count($allSnapshots); $i++) {
                if (@unlink($allSnapshots[$i])) {
                    $pruned++;
                }
            }
        }

        reworkzone_log_activity($pdo, null, 'backup_created', "Created database snapshot: {$snapshotFilename} ({$pruned} old pruned)");

        reworkzone_json_response([
            'success'     => true,
            'message'     => 'Database snapshot created successfully.',
            'filename'    => $snapshotFilename,
            'size_bytes'  => filesize($snapshotPath),
            'retained'    => min(count($allSnapshots), 7),
            'pruned'      => $pruned,
            'timestamp'   => date('Y-m-d H:i:s'),
        ]);

    } catch (Exception $e) {
        reworkzone_json_response([
            'success' => false,
            'error'   => 'Failed to create snapshot: ' . $e->getMessage()
        ], 500);
    }
}

// -------------------------------------------------------------
// 3. ACTION: LIST SNAPSHOTS
// -------------------------------------------------------------
if ($action === 'list') {
    $allSnapshots = glob($backupsDir . '/reworkzone_stalls_backup_*.sqlite') ?: [];
    rsort($allSnapshots);

    $list = [];
    foreach ($allSnapshots as $snap) {
        $list[] = [
            'filename'   => basename($snap),
            'size_bytes' => filesize($snap),
            'created_at' => date('Y-m-d H:i:s', filemtime($snap)),
        ];
    }

    reworkzone_json_response([
        'success'   => true,
        'count'     => count($list),
        'backups'   => $list,
    ]);
}

// -------------------------------------------------------------
// 4. ACTION: DOWNLOAD (Default) - 1-Click Master SQLite Download
// -------------------------------------------------------------
if ($action === 'download') {
    try {
        // Run checkpoint to ensure all WAL transactions are committed to the main database file
        $pdo->exec("PRAGMA wal_checkpoint(PASSIVE);");

        $timestamp = date('Ymd_His');
        $downloadName = "reworkzone_stalls_backup_{$timestamp}.sqlite";
        $tempSnapshot = sys_get_temp_dir() . '/' . bin2hex(random_bytes(8)) . '.sqlite';

        try {
            $pdo->exec("VACUUM INTO " . $pdo->quote($tempSnapshot));
        } catch (Exception $e) {
            $pdo->exec("PRAGMA wal_checkpoint(TRUNCATE);");
            if (!copy($dbFile, $tempSnapshot)) {
                throw new Exception("Could not prepare download file.");
            }
        }

        reworkzone_log_activity($pdo, null, 'backup_downloaded', "Master downloaded SQLite database backup snapshot ({$downloadName})");

        // Send headers for binary download
        header('Content-Description: File Transfer');
        header('Content-Type: application/x-sqlite3');
        header('Content-Disposition: attachment; filename="' . $downloadName . '"');
        header('Content-Transfer-Encoding: binary');
        header('Expires: 0');
        header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
        header('Pragma: public');
        header('Content-Length: ' . filesize($tempSnapshot));

        readfile($tempSnapshot);
        @unlink($tempSnapshot);
        exit;

    } catch (Exception $e) {
        reworkzone_json_response([
            'success' => false,
            'error'   => 'Backup download failed: ' . $e->getMessage()
        ], 500);
    }
}

reworkzone_json_response(['success' => false, 'error' => 'Invalid backup action.'], 400);
