<?php
/**
 * Reworkzone Stalls Operations System - Booth Management API
 * 
 * Handles listing, creating, reading, updating, and archiving booths.
 * Read operations require Master session auth.
 * Write operations require Master session auth + CSRF validation.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth-helper.php';

header('Content-Type: application/json; charset=UTF-8');

$pdo = reworkzone_get_db();
$sessionUser = reworkzone_require_master_auth($pdo);

$method = $_SERVER['REQUEST_METHOD'];

// =========================================================================
// 1. GET: Fetch single booth by ID OR list booths with filters
// =========================================================================
if ($method === 'GET') {
    $id = trim($_GET['id'] ?? '');

    // 1A. Fetch Single Booth Details
    if (!empty($id)) {
        $stmt = $pdo->prepare("
            SELECT 
                b.*,
                e.name AS event_name,
                e.venue AS event_venue,
                e.city AS event_city,
                e.start_date AS event_start_date,
                e.end_date AS event_end_date,
                e.setup_date AS event_setup_date,
                e.dismantling_date AS event_dismantling_date,
                e.status AS event_status,
                (SELECT COUNT(*) FROM booth_links WHERE booth_id = b.id) AS link_count,
                (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id) AS task_count,
                (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND is_completed = 1) AS tasks_completed,
                (SELECT COUNT(*) FROM booth_items WHERE booth_id = b.id) AS item_count,
                (SELECT COUNT(*) FROM booth_expenses WHERE booth_id = b.id) AS expense_count
            FROM booths b
            LEFT JOIN events e ON b.event_id = e.id
            WHERE b.id = :id
            LIMIT 1
        ");
        $stmt->execute([':id' => $id]);
        $booth = $stmt->fetch();

        if (!$booth) {
            reworkzone_json_response(['success' => false, 'error' => 'Booth not found.'], 404);
        }

        reworkzone_json_response([
            'success' => true,
            'booth'   => $booth
        ]);
    }

    // 1B. Fetch Booth List with Filters & Search
    $eventId = trim($_GET['event_id'] ?? '');
    $status  = trim($_GET['status'] ?? '');
    $search  = trim($_GET['search'] ?? '');

    $sql = "
        SELECT 
            b.*,
            e.name AS event_name,
            e.city AS event_city,
            e.start_date AS event_start_date,
            e.setup_date AS event_setup_date,
            (SELECT COUNT(*) FROM booth_links WHERE booth_id = b.id) AS link_count,
            (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id) AS task_count,
            (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND is_completed = 1) AS tasks_completed
        FROM booths b
        LEFT JOIN events e ON b.event_id = e.id
        WHERE 1=1
    ";
    $params = [];

    // Filter by Event
    if (!empty($eventId)) {
        $sql .= " AND b.event_id = :event_id";
        $params[':event_id'] = $eventId;
    }

    // Filter by Status
    if ($status === 'archived') {
        $sql .= " AND b.status = 'archived'";
    } elseif (!empty($status) && $status !== 'all') {
        $sql .= " AND b.status = :status";
        $params[':status'] = $status;
    } else {
        $sql .= " AND b.status != 'archived'";
    }

    // Search by client name, booth number, or contact person
    if (!empty($search)) {
        $sql .= " AND (b.client_name LIKE :s1 OR b.booth_number LIKE :s2 OR b.contact_person LIKE :s3 OR e.name LIKE :s4)";
        $params[':s1'] = "%{$search}%";
        $params[':s2'] = "%{$search}%";
        $params[':s3'] = "%{$search}%";
        $params[':s4'] = "%{$search}%";
    }

    $sql .= " ORDER BY b.created_at DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $booths = $stmt->fetchAll();

    reworkzone_json_response([
        'success' => true,
        'booths'  => $booths,
        'count'   => count($booths)
    ]);
}

// =========================================================================
// 2. POST / PUT: Mutating actions (Create, Update, Archive)
// =========================================================================
if ($method === 'POST') {
    // Enforce CSRF protection on all state mutations
    reworkzone_verify_csrf();

    $raw = file_get_contents('php://input');
    $body = json_decode($raw, true) ?: $_POST;

    $action = trim($_GET['action'] ?? ($body['action'] ?? 'create'));

    // ---------------------------------------------------------------------
    // 2A. CREATE BOOTH
    // ---------------------------------------------------------------------
    if ($action === 'create') {
        $eventId            = trim($body['event_id'] ?? '');
        $boothNumber        = trim($body['booth_number'] ?? '');
        $clientName         = trim($body['client_name'] ?? '');
        $contactPerson      = trim($body['contact_person'] ?? '');
        $phone              = trim($body['phone'] ?? '');
        $email              = trim($body['email'] ?? '');
        $standSize          = trim($body['stand_size'] ?? '');
        $boothType          = trim($body['booth_type'] ?? 'Custom Stall');
        $budget             = !empty($body['budget']) ? (float)$body['budget'] : 0.0;
        $quotedAmount       = !empty($body['quoted_amount']) ? (float)$body['quoted_amount'] : 0.0;
        $mainDriveFolderUrl = trim($body['main_drive_folder_url'] ?? '');
        $status             = trim($body['status'] ?? 'draft');
        $notes              = trim($body['notes'] ?? '');

        // Validation
        if (empty($eventId)) {
            reworkzone_json_response(['success' => false, 'error' => 'Please select an event for this booth.'], 400);
        }

        // Verify event exists
        $eventCheck = $pdo->prepare("SELECT id, name FROM events WHERE id = :event_id");
        $eventCheck->execute([':event_id' => $eventId]);
        $eventRecord = $eventCheck->fetch();

        if (!$eventRecord) {
            reworkzone_json_response(['success' => false, 'error' => 'Selected event does not exist.'], 400);
        }

        if (empty($boothNumber)) {
            reworkzone_json_response(['success' => false, 'error' => 'Booth / Stall number is required.'], 400);
        }

        if (strlen($clientName) < 2) {
            reworkzone_json_response(['success' => false, 'error' => 'Client name must be at least 2 characters.'], 400);
        }

        // Basic Drive URL sanity check
        if (!empty($mainDriveFolderUrl) && !filter_var($mainDriveFolderUrl, FILTER_VALIDATE_URL)) {
            reworkzone_json_response(['success' => false, 'error' => 'Main Google Drive URL must be a valid web link.'], 400);
        }

        $validStatuses = ['draft', 'design', 'approved', 'in_production', 'installed', 'handover', 'completed', 'archived'];
        if (!in_array($status, $validStatuses, true)) {
            $status = 'draft';
        }

        $id = 'bth_' . bin2hex(random_bytes(6));
        $now = date('Y-m-d H:i:s');

        $stmt = $pdo->prepare("
            INSERT INTO booths (
                id, event_id, booth_number, client_name, contact_person, phone, email,
                stand_size, booth_type, budget, quoted_amount, main_drive_folder_url,
                status, notes, created_at, updated_at
            ) VALUES (
                :id, :event_id, :booth_number, :client_name, :contact_person, :phone, :email,
                :stand_size, :booth_type, :budget, :quoted_amount, :main_drive_folder_url,
                :status, :notes, :created_at, :updated_at
            )
        ");
        $stmt->execute([
            ':id'                    => $id,
            ':event_id'              => $eventId,
            ':booth_number'          => $boothNumber,
            ':client_name'           => $clientName,
            ':contact_person'        => $contactPerson,
            ':phone'                 => $phone,
            ':email'                 => $email,
            ':stand_size'            => $standSize,
            ':booth_type'            => $boothType,
            ':budget'                => $budget,
            ':quoted_amount'         => $quotedAmount,
            ':main_drive_folder_url' => $mainDriveFolderUrl,
            ':status'                => $status,
            ':notes'                 => $notes,
            ':created_at'            => $now,
            ':updated_at'            => $now,
        ]);

        // Audit Log
        $logStmt = $pdo->prepare("
            INSERT INTO activity_logs (id, booth_id, action_type, actor_label, description)
            VALUES (:id, :booth_id, 'booth_created', 'Master Admin', :desc)
        ");
        $logStmt->execute([
            ':id'       => bin2hex(random_bytes(16)),
            ':booth_id' => $id,
            ':desc'     => "Created booth '{$boothNumber}' for client '{$clientName}' under event '{$eventRecord['name']}'."
        ]);

        // Auto-seed default 6 checklist tasks for this new booth
        $defaultTasks = [
            'Design',
            'Print Files',
            'Production',
            'Furniture',
            'Electrical',
            'Installation',
        ];
        $insertTaskStmt = $pdo->prepare("
            INSERT INTO booth_tasks (id, booth_id, phase, task_name, sort_order, display_order, is_completed, status, created_at, updated_at)
            VALUES (:id, :booth_id, :phase, :task_name, :sort_order, :sort_order, 0, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ");
        foreach ($defaultTasks as $idx => $taskName) {
            $tId = 'tsk_' . bin2hex(random_bytes(6));
            $order = $idx + 1;
            $phase = $taskName;
            $insertTaskStmt->execute([
                ':id'         => $tId,
                ':booth_id'   => $id,
                ':phase'      => $phase,
                ':task_name'  => $taskName,
                ':sort_order' => $order,
            ]);
        }

        // Retrieve inserted booth
        $getStmt = $pdo->prepare("SELECT * FROM booths WHERE id = :id");
        $getStmt->execute([':id' => $id]);
        $created = $getStmt->fetch();

        reworkzone_json_response([
            'success' => true,
            'message' => 'Booth created successfully.',
            'booth'   => $created
        ], 201);
    }

    // ---------------------------------------------------------------------
    // 2B. UPDATE BOOTH
    // ---------------------------------------------------------------------
    if ($action === 'update') {
        $id = trim($body['id'] ?? ($_GET['id'] ?? ''));

        if (empty($id)) {
            reworkzone_json_response(['success' => false, 'error' => 'Booth ID is required.'], 400);
        }

        $check = $pdo->prepare("SELECT id, booth_number, client_name, event_id FROM booths WHERE id = :id");
        $check->execute([':id' => $id]);
        $existing = $check->fetch();

        if (!$existing) {
            reworkzone_json_response(['success' => false, 'error' => 'Booth not found.'], 404);
        }

        $eventId            = trim($body['event_id'] ?? $existing['event_id']);
        $boothNumber        = trim($body['booth_number'] ?? $existing['booth_number']);
        $clientName         = trim($body['client_name'] ?? $existing['client_name']);
        $contactPerson      = trim($body['contact_person'] ?? '');
        $phone              = trim($body['phone'] ?? '');
        $email              = trim($body['email'] ?? '');
        $standSize          = trim($body['stand_size'] ?? '');
        $boothType          = trim($body['booth_type'] ?? 'Custom Stall');
        $budget             = isset($body['budget']) ? (float)$body['budget'] : 0.0;
        $quotedAmount       = isset($body['quoted_amount']) ? (float)$body['quoted_amount'] : 0.0;
        $mainDriveFolderUrl = trim($body['main_drive_folder_url'] ?? '');
        $status             = trim($body['status'] ?? 'draft');
        $notes              = trim($body['notes'] ?? '');

        if (empty($boothNumber)) {
            reworkzone_json_response(['success' => false, 'error' => 'Booth number is required.'], 400);
        }
        if (strlen($clientName) < 2) {
            reworkzone_json_response(['success' => false, 'error' => 'Client name must be at least 2 characters.'], 400);
        }

        if (!empty($mainDriveFolderUrl) && !filter_var($mainDriveFolderUrl, FILTER_VALIDATE_URL)) {
            reworkzone_json_response(['success' => false, 'error' => 'Main Google Drive URL must be a valid web link.'], 400);
        }

        $validStatuses = ['draft', 'design', 'approved', 'in_production', 'installed', 'handover', 'completed', 'archived'];
        if (!in_array($status, $validStatuses, true)) {
            $status = 'draft';
        }

        $now = date('Y-m-d H:i:s');
        $stmt = $pdo->prepare("
            UPDATE booths 
            SET event_id = :event_id,
                booth_number = :booth_number,
                client_name = :client_name,
                contact_person = :contact_person,
                phone = :phone,
                email = :email,
                stand_size = :stand_size,
                booth_type = :booth_type,
                budget = :budget,
                quoted_amount = :quoted_amount,
                main_drive_folder_url = :main_drive_folder_url,
                status = :status,
                notes = :notes,
                updated_at = :updated_at
            WHERE id = :id
        ");
        $stmt->execute([
            ':event_id'              => $eventId,
            ':booth_number'          => $boothNumber,
            ':client_name'           => $clientName,
            ':contact_person'        => $contactPerson,
            ':phone'                 => $phone,
            ':email'                 => $email,
            ':stand_size'            => $standSize,
            ':booth_type'            => $boothType,
            ':budget'                => $budget,
            ':quoted_amount'         => $quotedAmount,
            ':main_drive_folder_url' => $mainDriveFolderUrl,
            ':status'                => $status,
            ':notes'                 => $notes,
            ':updated_at'            => $now,
            ':id'                    => $id,
        ]);

        // Audit Log
        $logStmt = $pdo->prepare("
            INSERT INTO activity_logs (id, booth_id, action_type, actor_label, description)
            VALUES (:id, :booth_id, 'booth_updated', 'Master Admin', :desc)
        ");
        $logStmt->execute([
            ':id'       => bin2hex(random_bytes(16)),
            ':booth_id' => $id,
            ':desc'     => "Updated details for booth '{$boothNumber}' ({$clientName})."
        ]);

        $getStmt = $pdo->prepare("SELECT * FROM booths WHERE id = :id");
        $getStmt->execute([':id' => $id]);
        $updated = $getStmt->fetch();

        reworkzone_json_response([
            'success' => true,
            'message' => 'Booth updated successfully.',
            'booth'   => $updated
        ]);
    }

    // ---------------------------------------------------------------------
    // 2C. ARCHIVE BOOTH (Safe Archiving, Never Destructive)
    // ---------------------------------------------------------------------
    if ($action === 'archive') {
        $id = trim($body['id'] ?? ($_GET['id'] ?? ''));

        if (empty($id)) {
            reworkzone_json_response(['success' => false, 'error' => 'Booth ID is required.'], 400);
        }

        $check = $pdo->prepare("SELECT id, booth_number, client_name FROM booths WHERE id = :id");
        $check->execute([':id' => $id]);
        $existing = $check->fetch();

        if (!$existing) {
            reworkzone_json_response(['success' => false, 'error' => 'Booth not found.'], 404);
        }

        $now = date('Y-m-d H:i:s');
        $stmt = $pdo->prepare("UPDATE booths SET status = 'archived', updated_at = :now WHERE id = :id");
        $stmt->execute([':now' => $now, ':id' => $id]);

        // Audit Log
        $logStmt = $pdo->prepare("
            INSERT INTO activity_logs (id, booth_id, action_type, actor_label, description)
            VALUES (:id, :booth_id, 'booth_archived', 'Master Admin', :desc)
        ");
        $logStmt->execute([
            ':id'       => bin2hex(random_bytes(16)),
            ':booth_id' => $id,
            ':desc'     => "Archived booth '{$existing['booth_number']}' ({$existing['client_name']})."
        ]);

        reworkzone_json_response([
            'success' => true,
            'message' => "Booth '{$existing['booth_number']}' archived successfully."
        ]);
    }

    reworkzone_json_response(['success' => false, 'error' => 'Invalid action.'], 400);
}

reworkzone_json_response(['success' => false, 'error' => 'Method not allowed.'], 405);
