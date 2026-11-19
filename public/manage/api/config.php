<?php
/**
 * Reworkzone Stalls Operations System - Database & Core Configuration
 * 
 * Manages SQLite connection, directory locations, schema initialization,
 * foreign keys, and JSON response helpers.
 */

// Enable strict error reporting for internal logging
error_reporting(E_ALL);
ini_set('display_errors', '0');

/**
 * Resolve the persistent data directory outside public_html.
 * Survives Hostinger Git deployments.
 */
function reworkzone_manage_get_data_dir() {
    // Check if test environment overrides data directory
    if (defined('REWORKZONE_DATA_DIR_OVERRIDE')) {
        $customDir = constant('REWORKZONE_DATA_DIR_OVERRIDE');
        if (!is_dir($customDir)) {
            @mkdir($customDir, 0755, true);
        }
        return $customDir;
    }
    $envOverride = getenv('REWORKZONE_DATA_DIR_OVERRIDE');
    if ($envOverride && is_string($envOverride) && trim($envOverride) !== '') {
        $customDir = trim($envOverride);
        if (!is_dir($customDir)) {
            @mkdir($customDir, 0755, true);
        }
        return $customDir;
    }

    // 2. Parent external directory outside webroot (e.g. /home/u.../domains/stalls.reworkzone.in/reworkzone_data)
    $webRoot = dirname(__DIR__, 2);
    $parentExternalDir = dirname($webRoot) . '/reworkzone_data';
    if (is_dir($parentExternalDir) || @mkdir($parentExternalDir, 0755, true)) {
        return $parentExternalDir;
    }

    // 4. Primary: Persistent directory outside public_html
    $persistentDir = $webRoot . '/reworkzone_data';
    if (is_dir($persistentDir) || @mkdir($persistentDir, 0755, true)) {
        return $persistentDir;
    }

    // 5. Fallback: Internal data directory if parent is restricted
    $fallbackDir = $webRoot . '/data';
    if (!is_dir($fallbackDir)) {
        @mkdir($fallbackDir, 0755, true);
    }
    return $fallbackDir;
}

/**
 * Convenience aliases for data dir and database path
 */
function reworkzone_get_data_dir() {
    return reworkzone_manage_get_data_dir();
}

function reworkzone_get_db_path() {
    return reworkzone_manage_get_data_dir() . '/reworkzone_stalls.sqlite';
}

/**
 * Get or create the SQLite PDO connection.
 * Configures foreign keys, busy timeout, and WAL journal mode.
 */
function reworkzone_get_db() {
    static $pdo = null;

    if ($pdo !== null) {
        return $pdo;
    }

    $dataDir = reworkzone_manage_get_data_dir();
    $dbPath = $dataDir . '/reworkzone_stalls.sqlite';

    // Verify PDO SQLite driver availability
    if (!in_array('sqlite', PDO::getAvailableDrivers(), true)) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'error'   => 'SQLite PDO driver is not available on this server environment.'
        ]);
        exit;
    }

    $isNewDb = !file_exists($dbPath);

    try {
        $pdo = new PDO("sqlite:{$dbPath}", null, null, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_TIMEOUT            => 5,
        ]);

        // Enable foreign key constraints
        $pdo->exec('PRAGMA foreign_keys = ON;');

        // Set busy timeout to 5000ms to avoid database locked errors under concurrent access
        $pdo->exec('PRAGMA busy_timeout = 5000;');

        // Enable WAL journal mode for high concurrency
        $pdo->exec('PRAGMA journal_mode = WAL;');

        // Automatically initialize and upgrade schema if needed (idempotent)
        reworkzone_init_schema($pdo);

    } catch (PDOException $e) {
        error_log('Database connection failure: ' . $e->getMessage());
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'error'   => 'Could not establish secure database connection.'
        ]);
        exit;
    }

    return $pdo;
}

/**
 * Create or upgrade the 8 SQLite core tables idempotently.
 */
function reworkzone_init_schema(PDO $pdo) {
    // 1. Auth Accounts (Master 6-digit PIN in V1)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS auth_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_name TEXT NOT NULL,
            pin_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'master',
            is_active INTEGER NOT NULL DEFAULT 1,
            last_login_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    ");

    // 2. Auth Lockouts (Rate limiting brute-force protection)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS auth_lockouts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip_address TEXT NOT NULL UNIQUE,
            failed_attempts INTEGER NOT NULL DEFAULT 0,
            locked_until DATETIME,
            last_attempt_at DATETIME
        );
    ");

    // 3. Events Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            venue TEXT NOT NULL,
            city TEXT NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            setup_date DATE,
            dismantling_date DATE,
            notes TEXT,
            status TEXT NOT NULL DEFAULT 'upcoming',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    ");

    // Safe migration: check if events table has NOT NULL on setup_date or dismantling_date
    $eventCols = $pdo->query("PRAGMA table_info(events)")->fetchAll(PDO::FETCH_ASSOC);
    $needsEventMigration = false;
    foreach ($eventCols as $col) {
        if (($col['name'] === 'setup_date' || $col['name'] === 'dismantling_date') && (int)$col['notnull'] === 1) {
            $needsEventMigration = true;
            break;
        }
    }
    if ($needsEventMigration) {
        $pdo->exec("PRAGMA foreign_keys = OFF;");
        $pdo->beginTransaction();
        try {
            $pdo->exec("
                CREATE TABLE events_migrated (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    venue TEXT NOT NULL,
                    city TEXT NOT NULL,
                    start_date DATE NOT NULL,
                    end_date DATE NOT NULL,
                    setup_date DATE,
                    dismantling_date DATE,
                    notes TEXT,
                    status TEXT NOT NULL DEFAULT 'upcoming',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
                INSERT INTO events_migrated (id, name, venue, city, start_date, end_date, setup_date, dismantling_date, notes, status, created_at, updated_at)
                SELECT id, name, venue, city, start_date, end_date, setup_date, dismantling_date, notes, status, created_at, updated_at FROM events;
                DROP TABLE events;
                ALTER TABLE events_migrated RENAME TO events;
            ");
            $pdo->commit();
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            error_log('Event schema migration failed: ' . $e->getMessage());
        }
        $pdo->exec("PRAGMA foreign_keys = ON;");
    }

    // Safe column check for floor_plan_url in events
    $eventColsAfter = $pdo->query("PRAGMA table_info(events)")->fetchAll(PDO::FETCH_ASSOC);
    $eventColNames = array_column($eventColsAfter, 'name');
    if (!in_array('floor_plan_url', $eventColNames, true)) {
        $pdo->exec("ALTER TABLE events ADD COLUMN floor_plan_url TEXT DEFAULT NULL;");
    }

    // 4. Booths Table (with main_drive_folder_url)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS booths (
            id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL,
            booth_number TEXT NOT NULL,
            client_name TEXT NOT NULL,
            contact_person TEXT,
            phone TEXT,
            email TEXT,
            stand_size TEXT,
            booth_type TEXT,
            budget REAL,
            quoted_amount REAL,
            main_drive_folder_url TEXT,
            status TEXT NOT NULL DEFAULT 'draft',
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
        );
    ");

    // 5. Booth Links (Google Drive URLs only; NO file uploads)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS booth_links (
            id TEXT PRIMARY KEY,
            booth_id TEXT NOT NULL,
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            drive_url TEXT NOT NULL,
            version TEXT,
            is_final INTEGER NOT NULL DEFAULT 0,
            approved_at DATETIME,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (booth_id) REFERENCES booths(id) ON DELETE CASCADE
        );
    ");

    // 6. Booth Items (Furniture, electrical, AV, graphic panels)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS booth_items (
            id TEXT PRIMARY KEY,
            booth_id TEXT NOT NULL,
            category TEXT NOT NULL,
            item_name TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            unit TEXT,
            specification TEXT,
            vendor_name TEXT,
            unit_cost REAL DEFAULT 0,
            total_cost REAL DEFAULT 0,
            is_delivered INTEGER NOT NULL DEFAULT 0,
            is_installed INTEGER NOT NULL DEFAULT 0,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (booth_id) REFERENCES booths(id) ON DELETE CASCADE
        );
    ");

    // 7. Booth Tasks / Checklists
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS booth_tasks (
            id TEXT PRIMARY KEY,
            booth_id TEXT NOT NULL,
            phase TEXT DEFAULT 'General',
            task_name TEXT NOT NULL,
            assigned_to TEXT,
            completed_by TEXT,
            is_completed INTEGER NOT NULL DEFAULT 0,
            completed_at DATETIME,
            due_date DATE,
            notes TEXT,
            sort_order INTEGER DEFAULT 0,
            display_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (booth_id) REFERENCES booths(id) ON DELETE CASCADE
        );
    ");

    // 8. Booth Expenses (Cost tracking & P&L)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS booth_expenses (
            id TEXT PRIMARY KEY,
            booth_id TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            amount REAL DEFAULT 0.0,
            estimated_cost REAL DEFAULT 0.0,
            actual_cost REAL DEFAULT 0.0,
            paid_to TEXT,
            vendor_name TEXT,
            payment_status TEXT NOT NULL DEFAULT 'unpaid',
            is_paid INTEGER NOT NULL DEFAULT 0,
            receipt_drive_url TEXT,
            expense_date DATE DEFAULT CURRENT_DATE,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (booth_id) REFERENCES booths(id) ON DELETE CASCADE
        );
    ");

    // Schema upgrades for existing databases (idempotent)
    $taskCols = [];
    $stmt = $pdo->query("PRAGMA table_info(booth_tasks);");
    while ($row = $stmt->fetch()) {
        $taskCols[] = $row['name'];
    }
    if (!in_array('display_order', $taskCols)) {
        $pdo->exec("ALTER TABLE booth_tasks ADD COLUMN display_order INTEGER DEFAULT 0;");
    }
    if (!in_array('completed_by', $taskCols)) {
        $pdo->exec("ALTER TABLE booth_tasks ADD COLUMN completed_by TEXT;");
    }
    if (!in_array('status', $taskCols)) {
        $pdo->exec("ALTER TABLE booth_tasks ADD COLUMN status TEXT DEFAULT 'pending';");
        $pdo->exec("UPDATE booth_tasks SET status = 'completed' WHERE is_completed = 1;");
    }

    $expCols = [];
    $stmt = $pdo->query("PRAGMA table_info(booth_expenses);");
    while ($row = $stmt->fetch()) {
        $expCols[] = $row['name'];
    }
    if (!in_array('estimated_cost', $expCols)) {
        $pdo->exec("ALTER TABLE booth_expenses ADD COLUMN estimated_cost REAL DEFAULT 0.0;");
    }
    if (!in_array('actual_cost', $expCols)) {
        $pdo->exec("ALTER TABLE booth_expenses ADD COLUMN actual_cost REAL DEFAULT 0.0;");
    }
    if (!in_array('vendor_name', $expCols)) {
        $pdo->exec("ALTER TABLE booth_expenses ADD COLUMN vendor_name TEXT;");
    }
    if (!in_array('notes', $expCols)) {
        $pdo->exec("ALTER TABLE booth_expenses ADD COLUMN notes TEXT;");
    }
    if (!in_array('is_paid', $expCols)) {
        $pdo->exec("ALTER TABLE booth_expenses ADD COLUMN is_paid INTEGER DEFAULT 0;");
    }

    // 9. Activity Logs (Audit trail)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS activity_logs (
            id TEXT PRIMARY KEY,
            booth_id TEXT,
            action_type TEXT NOT NULL,
            actor_label TEXT NOT NULL DEFAULT 'Master',
            description TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (booth_id) REFERENCES booths(id) ON DELETE SET NULL
        );
    ");

    // 10. Exhibitors Catalogue Table (Official reference & custom additions)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS exhibitors (
            id TEXT PRIMARY KEY,
            event_id TEXT,
            company_name TEXT NOT NULL,
            official_id TEXT,
            contact_person TEXT,
            phone TEXT,
            email TEXT,
            website_url TEXT,
            city TEXT,
            tagline TEXT,
            booth_number TEXT,
            booth_category TEXT,
            notes TEXT,
            source TEXT DEFAULT 'official_catalogue',
            verified_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    ");

    // Create Indexes for high-frequency search and relational filters
    $pdo->exec("
        CREATE INDEX IF NOT EXISTS idx_booths_event_id ON booths(event_id);
        CREATE INDEX IF NOT EXISTS idx_booth_links_booth_id ON booth_links(booth_id);
        CREATE INDEX IF NOT EXISTS idx_booth_items_booth_id ON booth_items(booth_id);
        CREATE INDEX IF NOT EXISTS idx_booth_tasks_booth_id ON booth_tasks(booth_id);
        CREATE INDEX IF NOT EXISTS idx_booth_expenses_booth_id ON booth_expenses(booth_id);
        CREATE INDEX IF NOT EXISTS idx_activity_logs_booth_id ON activity_logs(booth_id);
        CREATE INDEX IF NOT EXISTS idx_exhibitors_name ON exhibitors(company_name);
        CREATE INDEX IF NOT EXISTS idx_exhibitors_event_id ON exhibitors(event_id);
    ");

    // Auto-seed verified exhibitors if catalogue is empty
    $exCount = (int)$pdo->query("SELECT count(*) FROM exhibitors;")->fetchColumn();
    if ($exCount === 0) {
        $seedFile = __DIR__ . '/data/verified_exhibitors.json';
        if (file_exists($seedFile)) {
            $seedData = json_decode(file_get_contents($seedFile), true);
            if (is_array($seedData)) {
                $ins = $pdo->prepare("
                    INSERT OR IGNORE INTO exhibitors (
                        id, event_id, company_name, official_id, contact_person, phone,
                        email, website_url, city, tagline, booth_number, booth_category,
                        source, verified_at, created_at, updated_at
                    ) VALUES (
                        :id, :event_id, :company_name, :official_id, :contact_person, :phone,
                        :email, :website_url, :city, :tagline, :booth_number, :booth_category,
                        'official_catalogue', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    )
                ");
                $now = date('Y-m-d H:i:s');
                foreach ($seedData as $row) {
                    $id = !empty($row['id']) ? 'ex_' . $row['id'] : ('ex_' . bin2hex(random_bytes(6)));
                    $ins->execute([
                        ':id'             => $id,
                        ':event_id'       => null,
                        ':company_name'   => trim($row['companyName'] ?? ''),
                        ':official_id'    => $row['id'] ?? null,
                        ':contact_person' => null,
                        ':phone'          => !empty($row['companyMobile']) ? $row['companyMobile'] : null,
                        ':email'          => !empty($row['companyEmail']) ? $row['companyEmail'] : null,
                        ':website_url'    => !empty($row['websiteUrl']) ? $row['websiteUrl'] : null,
                        ':city'           => !empty($row['placeOfBusiness']) ? $row['placeOfBusiness'] : null,
                        ':tagline'        => !empty($row['companyTagline']) ? $row['companyTagline'] : null,
                        ':booth_number'   => !empty($row['boothNumber']) ? $row['boothNumber'] : null,
                        ':booth_category' => !empty($row['boothCategory']) ? $row['boothCategory'] : null,
                    ]);
                }
            }
        }
    }
}

/**
 * Standardized JSON response helper
 */
function reworkzone_json_response(array $data, int $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=UTF-8');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}
