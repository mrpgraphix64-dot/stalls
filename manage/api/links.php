<?php
/**
 * Reworkzone Stalls Operations System - Google Drive Links API
 * 
 * Manages categorized Google Drive links for booth working artwork,
 * 3D renders, print PDFs, photos, and drawings.
 * Strict approval safety rules:
 * - New links default to draft (is_final = 0)
 * - Approval requires explicit user action (sets approved_at)
 * - Changing a Drive URL resets approval (is_final = 0, approved_at = NULL)
 * - Server validates all Drive URLs
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth-helper.php';

header('Content-Type: application/json; charset=UTF-8');

$pdo = reworkzone_get_db();
$sessionUser = reworkzone_require_master_auth($pdo);

$method = $_SERVER['REQUEST_METHOD'];

// =========================================================================
// 1. GET: Fetch links by booth_id or single link by id
// =========================================================================
if ($method === 'GET') {
    $id       = trim($_GET['id'] ?? '');
    $boothId  = trim($_GET['booth_id'] ?? '');
    $category = trim($_GET['category'] ?? '');

    // Single link
    if (!empty($id)) {
        $stmt = $pdo->prepare("SELECT * FROM booth_links WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $id]);
        $link = $stmt->fetch();

        if (!$link) {
            reworkzone_json_response(['success' => false, 'error' => 'Link not found.'], 404);
        }

        reworkzone_json_response(['success' => true, 'link' => $link]);
    }

    // List links for booth
    if (empty($boothId)) {
        reworkzone_json_response(['success' => false, 'error' => 'booth_id parameter is required.'], 400);
    }

    $sql = "SELECT * FROM booth_links WHERE booth_id = :booth_id";
    $params = [':booth_id' => $boothId];

    if (!empty($category) && $category !== 'all') {
        $sql .= " AND category = :category";
        $params[':category'] = $category;
    }

    $sql .= " ORDER BY created_at DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $links = $stmt->fetchAll();

    reworkzone_json_response([
        'success' => true,
        'links'   => $links,
        'count'   => count($links)
    ]);
}

// =========================================================================
// 2. POST: State-changing operations (Create, Update, Approve, Delete)
// =========================================================================
if ($method === 'POST') {
    reworkzone_verify_csrf();

    $raw = file_get_contents('php://input');
    $body = json_decode($raw, true) ?: $_POST;
    $action = trim($_GET['action'] ?? ($body['action'] ?? 'create'));

    $validCategories = ['render_3d', 'working_artwork', 'print_ready', 'photo', 'production', 'other'];

    // ---------------------------------------------------------------------
    // 2A. CREATE LINK
    // ---------------------------------------------------------------------
    if ($action === 'create') {
        $boothId  = trim($body['booth_id'] ?? '');
        $category = trim($body['category'] ?? 'other');
        $title    = trim($body['title'] ?? '');
        $driveUrl = trim($body['drive_url'] ?? '');
        $version  = trim($body['version'] ?? 'v1.0');
        $notes    = trim($body['notes'] ?? '');

        // Validation
        if (empty($boothId)) {
            reworkzone_json_response(['success' => false, 'error' => 'booth_id is required.'], 400);
        }

        // Verify booth exists
        $checkBooth = $pdo->prepare("SELECT id, booth_number, client_name FROM booths WHERE id = :booth_id");
        $checkBooth->execute([':booth_id' => $boothId]);
        $booth = $checkBooth->fetch();

        if (!$booth) {
            reworkzone_json_response(['success' => false, 'error' => 'Referenced booth does not exist.'], 400);
        }

        if (empty($title)) {
            reworkzone_json_response(['success' => false, 'error' => 'Link title is required.'], 400);
        }

        if (empty($driveUrl) || !filter_var($driveUrl, FILTER_VALIDATE_URL)) {
            reworkzone_json_response(['success' => false, 'error' => 'A valid Google Drive URL is required.'], 400);
        }

        if (!in_array($category, $validCategories, true)) {
            $category = 'other';
        }

        if (empty($version)) {
            $version = 'v1.0';
        }

        $id = 'lnk_' . bin2hex(random_bytes(6));
        $now = date('Y-m-d H:i:s');

        // New links ALWAYS default to Draft (is_final = 0, approved_at = NULL)
        $stmt = $pdo->prepare("
            INSERT INTO booth_links (
                id, booth_id, category, title, drive_url, version,
                is_final, approved_at, notes, created_at, updated_at
            ) VALUES (
                :id, :booth_id, :category, :title, :drive_url, :version,
                0, NULL, :notes, :created_at, :updated_at
            )
        ");
        $stmt->execute([
            ':id'         => $id,
            ':booth_id'   => $boothId,
            ':category'   => $category,
            ':title'      => $title,
            ':drive_url'  => $driveUrl,
            ':version'    => $version,
            ':notes'      => $notes,
            ':created_at' => $now,
            ':updated_at' => $now,
        ]);

        // Audit Log
        $log = $pdo->prepare("
            INSERT INTO activity_logs (id, booth_id, action_type, actor_label, description)
            VALUES (:id, :booth_id, 'link_added', 'Master Admin', :desc)
        ");
        $log->execute([
            ':id'       => bin2hex(random_bytes(16)),
            ':booth_id' => $boothId,
            ':desc'     => "Added Drive link '{$title}' ({$version}) under category '{$category}' for booth '{$booth['booth_number']}'."
        ]);

        $getStmt = $pdo->prepare("SELECT * FROM booth_links WHERE id = :id");
        $getStmt->execute([':id' => $id]);
        $created = $getStmt->fetch();

        reworkzone_json_response([
            'success' => true,
            'message' => 'Google Drive link added successfully.',
            'link'    => $created
        ], 201);
    }

    // ---------------------------------------------------------------------
    // 2B. UPDATE LINK
    // ---------------------------------------------------------------------
    if ($action === 'update') {
        $id = trim($body['id'] ?? ($_GET['id'] ?? ''));

        if (empty($id)) {
            reworkzone_json_response(['success' => false, 'error' => 'Link ID is required.'], 400);
        }

        $check = $pdo->prepare("SELECT * FROM booth_links WHERE id = :id");
        $check->execute([':id' => $id]);
        $existing = $check->fetch();

        if (!$existing) {
            reworkzone_json_response(['success' => false, 'error' => 'Link not found.'], 404);
        }

        $category = trim($body['category'] ?? $existing['category']);
        $title    = trim($body['title'] ?? $existing['title']);
        $driveUrl = trim($body['drive_url'] ?? $existing['drive_url']);
        $version  = trim($body['version'] ?? $existing['version']);
        $notes    = trim($body['notes'] ?? $existing['notes']);

        if (empty($title)) {
            reworkzone_json_response(['success' => false, 'error' => 'Link title is required.'], 400);
        }

        if (empty($driveUrl) || !filter_var($driveUrl, FILTER_VALIDATE_URL)) {
            reworkzone_json_response(['success' => false, 'error' => 'A valid Google Drive URL is required.'], 400);
        }

        if (!in_array($category, $validCategories, true)) {
            $category = $existing['category'];
        }

        $isFinal    = (int)$existing['is_final'];
        $approvedAt = $existing['approved_at'];

        // APPROVAL SAFETY RULE: If the Drive URL changed, automatically reset approval!
        if ($driveUrl !== $existing['drive_url']) {
            $isFinal = 0;
            $approvedAt = null;
        }

        $now = date('Y-m-d H:i:s');
        $stmt = $pdo->prepare("
            UPDATE booth_links
            SET category = :category,
                title = :title,
                drive_url = :drive_url,
                version = :version,
                is_final = :is_final,
                approved_at = :approved_at,
                notes = :notes,
                updated_at = :updated_at
            WHERE id = :id
        ");
        $stmt->execute([
            ':category'    => $category,
            ':title'       => $title,
            ':drive_url'   => $driveUrl,
            ':version'     => $version,
            ':is_final'    => $isFinal,
            ':approved_at' => $approvedAt,
            ':notes'       => $notes,
            ':updated_at'  => $now,
            ':id'          => $id,
        ]);

        $log = $pdo->prepare("
            INSERT INTO activity_logs (id, booth_id, action_type, actor_label, description)
            VALUES (:id, :booth_id, 'link_updated', 'Master Admin', :desc)
        ");
        $log->execute([
            ':id'       => bin2hex(random_bytes(16)),
            ':booth_id' => $existing['booth_id'],
            ':desc'     => "Updated Drive link '{$title}' ({$version})." . ($driveUrl !== $existing['drive_url'] ? ' Drive URL changed: approval status reset to draft.' : '')
        ]);

        $getStmt = $pdo->prepare("SELECT * FROM booth_links WHERE id = :id");
        $getStmt->execute([':id' => $id]);
        $updated = $getStmt->fetch();

        reworkzone_json_response([
            'success' => true,
            'message' => 'Link updated successfully.',
            'link'    => $updated
        ]);
    }

    // ---------------------------------------------------------------------
    // 2C. APPROVE LINK (Explicit User Approval)
    // ---------------------------------------------------------------------
    if ($action === 'approve') {
        $id = trim($body['id'] ?? ($_GET['id'] ?? ''));

        if (empty($id)) {
            reworkzone_json_response(['success' => false, 'error' => 'Link ID is required.'], 400);
        }

        $check = $pdo->prepare("SELECT * FROM booth_links WHERE id = :id");
        $check->execute([':id' => $id]);
        $existing = $check->fetch();

        if (!$existing) {
            reworkzone_json_response(['success' => false, 'error' => 'Link not found.'], 404);
        }

        $now = date('Y-m-d H:i:s');
        $stmt = $pdo->prepare("
            UPDATE booth_links 
            SET is_final = 1, approved_at = :approved_at, updated_at = :now 
            WHERE id = :id
        ");
        $stmt->execute([':approved_at' => $now, ':now' => $now, ':id' => $id]);

        $log = $pdo->prepare("
            INSERT INTO activity_logs (id, booth_id, action_type, actor_label, description)
            VALUES (:id, :booth_id, 'link_approved', 'Master Admin', :desc)
        ");
        $log->execute([
            ':id'       => bin2hex(random_bytes(16)),
            ':booth_id' => $existing['booth_id'],
            ':desc'     => "Approved Drive link '{$existing['title']}' ({$existing['version']}) as final."
        ]);

        $getStmt = $pdo->prepare("SELECT * FROM booth_links WHERE id = :id");
        $getStmt->execute([':id' => $id]);
        $approved = $getStmt->fetch();

        reworkzone_json_response([
            'success' => true,
            'message' => "Link '{$existing['title']}' marked as approved.",
            'link'    => $approved
        ]);
    }

    // ---------------------------------------------------------------------
    // 2D. UNAPPROVE LINK (Revert to Draft)
    // ---------------------------------------------------------------------
    if ($action === 'unapprove') {
        $id = trim($body['id'] ?? ($_GET['id'] ?? ''));

        if (empty($id)) {
            reworkzone_json_response(['success' => false, 'error' => 'Link ID is required.'], 400);
        }

        $check = $pdo->prepare("SELECT * FROM booth_links WHERE id = :id");
        $check->execute([':id' => $id]);
        $existing = $check->fetch();

        if (!$existing) {
            reworkzone_json_response(['success' => false, 'error' => 'Link not found.'], 404);
        }

        $now = date('Y-m-d H:i:s');
        $stmt = $pdo->prepare("
            UPDATE booth_links 
            SET is_final = 0, approved_at = NULL, updated_at = :now 
            WHERE id = :id
        ");
        $stmt->execute([':now' => $now, ':id' => $id]);

        $log = $pdo->prepare("
            INSERT INTO activity_logs (id, booth_id, action_type, actor_label, description)
            VALUES (:id, :booth_id, 'link_unapproved', 'Master Admin', :desc)
        ");
        $log->execute([
            ':id'       => bin2hex(random_bytes(16)),
            ':booth_id' => $existing['booth_id'],
            ':desc'     => "Reverted Drive link '{$existing['title']}' ({$existing['version']}) to draft status."
        ]);

        $getStmt = $pdo->prepare("SELECT * FROM booth_links WHERE id = :id");
        $getStmt->execute([':id' => $id]);
        $unapproved = $getStmt->fetch();

        reworkzone_json_response([
            'success' => true,
            'message' => "Link '{$existing['title']}' reverted to draft.",
            'link'    => $unapproved
        ]);
    }

    // ---------------------------------------------------------------------
    // 2E. DELETE LINK
    // ---------------------------------------------------------------------
    if ($action === 'delete') {
        $id = trim($body['id'] ?? ($_GET['id'] ?? ''));

        if (empty($id)) {
            reworkzone_json_response(['success' => false, 'error' => 'Link ID is required.'], 400);
        }

        $check = $pdo->prepare("SELECT * FROM booth_links WHERE id = :id");
        $check->execute([':id' => $id]);
        $existing = $check->fetch();

        if (!$existing) {
            reworkzone_json_response(['success' => false, 'error' => 'Link not found.'], 404);
        }

        $stmt = $pdo->prepare("DELETE FROM booth_links WHERE id = :id");
        $stmt->execute([':id' => $id]);

        $log = $pdo->prepare("
            INSERT INTO activity_logs (id, booth_id, action_type, actor_label, description)
            VALUES (:id, :booth_id, 'link_deleted', 'Master Admin', :desc)
        ");
        $log->execute([
            ':id'       => bin2hex(random_bytes(16)),
            ':booth_id' => $existing['booth_id'],
            ':desc'     => "Removed Drive link '{$existing['title']}' ({$existing['version']})."
        ]);

        reworkzone_json_response([
            'success' => true,
            'message' => "Link '{$existing['title']}' removed."
        ]);
    }

    reworkzone_json_response(['success' => false, 'error' => 'Invalid action.'], 400);
}

reworkzone_json_response(['success' => false, 'error' => 'Method not allowed.'], 405);
