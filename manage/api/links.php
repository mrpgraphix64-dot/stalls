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
    // 2-UPLOAD. UPLOAD 3D PREVIEW IMAGE
    // ---------------------------------------------------------------------
    if ($action === 'upload_preview') {
        $file = $_FILES['preview_image'] ?? ($_FILES['image'] ?? ($_FILES['file'] ?? null));
        if (!$file || !isset($file['error']) || $file['error'] !== UPLOAD_ERR_OK) {
            $errorCode = $file['error'] ?? UPLOAD_ERR_NO_FILE;
            $msg = 'No file uploaded or upload error occurred.';
            if ($errorCode === UPLOAD_ERR_INI_SIZE || $errorCode === UPLOAD_ERR_FORM_SIZE) {
                $msg = 'File size exceeds server upload limit (max 10MB).';
            }
            reworkzone_json_response(['success' => false, 'error' => $msg], 400);
        }

        // Validate max 10MB
        if ($file['size'] > 10 * 1024 * 1024) {
            reworkzone_json_response(['success' => false, 'error' => 'File size exceeds maximum allowed size of 10MB.'], 400);
        }

        // Validate MIME type
        $allowedMimes = [
            'image/jpeg' => '.jpg',
            'image/jpg'  => '.jpg',
            'image/png'  => '.png',
            'image/webp' => '.webp',
        ];

        $mime = null;
        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            if ($finfo) {
                $mime = finfo_file($finfo, $file['tmp_name']);
                finfo_close($finfo);
            }
        }
        if (!$mime && function_exists('getimagesize')) {
            $imgInfo = @getimagesize($file['tmp_name']);
            if ($imgInfo && !empty($imgInfo['mime'])) {
                $mime = $imgInfo['mime'];
            }
        }

        if (!$mime || !isset($allowedMimes[$mime])) {
            reworkzone_json_response(['success' => false, 'error' => 'Invalid image format. Allowed formats: JPG, PNG, WebP.'], 400);
        }

        $ext = $allowedMimes[$mime];
        $safeName = 'stall_3d_' . bin2hex(random_bytes(8)) . $ext;

        $rootDir = dirname(__DIR__, 2);
        $uploadDir = $rootDir . '/uploads/3d_previews';
        if (!is_dir($uploadDir)) {
            @mkdir($uploadDir, 0755, true);
        }

        $destPath = $uploadDir . '/' . $safeName;
        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            reworkzone_json_response(['success' => false, 'error' => 'Failed to save uploaded image.'], 500);
        }

        // Sync to public/uploads/3d_previews if public directory exists
        $publicUploadDir = $rootDir . '/public/uploads/3d_previews';
        if (is_dir($rootDir . '/public')) {
            if (!is_dir($publicUploadDir)) {
                @mkdir($publicUploadDir, 0755, true);
            }
            @copy($destPath, $publicUploadDir . '/' . $safeName);
        }

        $webUrl = '/uploads/3d_previews/' . $safeName;

        reworkzone_json_response([
            'success'           => true,
            'preview_image_url' => $webUrl,
            'filename'          => $safeName
        ]);
    }

    // ---------------------------------------------------------------------
    // 2A. CREATE LINK
    // ---------------------------------------------------------------------
    if ($action === 'create') {
        $boothId         = trim($body['booth_id'] ?? '');
        $category        = trim($body['category'] ?? 'other');
        $title           = trim($body['title'] ?? '');
        $driveUrl        = trim($body['drive_url'] ?? '');
        $previewImageUrl = trim($body['preview_image_url'] ?? '');
        $version         = trim($body['version'] ?? 'v1.0');
        $notes           = trim($body['notes'] ?? '');
        $isFinal         = !empty($body['is_final']) ? 1 : 0;

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

        // For render_3d: allow Image Only, Link Only, or Image + Link.
        // Reject only when BOTH image and URL are missing.
        if ($category === 'render_3d') {
            if (empty($driveUrl) && empty($previewImageUrl)) {
                reworkzone_json_response(['success' => false, 'error' => 'Please add a 3D image or a 3D view link.'], 400);
            }
            if (!empty($driveUrl) && !filter_var($driveUrl, FILTER_VALIDATE_URL)) {
                reworkzone_json_response(['success' => false, 'error' => 'Please enter a valid 3D view URL.'], 400);
            }
        } else {
            if (empty($driveUrl) || !filter_var($driveUrl, FILTER_VALIDATE_URL)) {
                reworkzone_json_response(['success' => false, 'error' => 'A valid Google Drive URL is required.'], 400);
            }
        }

        // Security check on preview_image_url
        if (!empty($previewImageUrl)) {
            if (strpos($previewImageUrl, '..') !== false) {
                reworkzone_json_response(['success' => false, 'error' => 'Invalid preview image path.'], 400);
            }
            $isSafeInternal = strpos($previewImageUrl, '/uploads/3d_previews/') === 0;
            $isValidHttp = filter_var($previewImageUrl, FILTER_VALIDATE_URL) && (strpos($previewImageUrl, 'http://') === 0 || strpos($previewImageUrl, 'https://') === 0);
            if (!$isSafeInternal && !$isValidHttp) {
                reworkzone_json_response(['success' => false, 'error' => 'Preview image must be a valid uploaded file path or HTTPS URL.'], 400);
            }
        }

        if (!in_array($category, $validCategories, true)) {
            $category = 'other';
        }

        if (empty($version)) {
            $version = 'v1.0';
        }

        $id = 'lnk_' . bin2hex(random_bytes(6));
        $now = date('Y-m-d H:i:s');
        $approvedAt = $isFinal === 1 ? $now : null;

        // If this 3D view is marked final, ensure prior 3D views for this booth are marked draft
        if ($isFinal === 1 && $category === 'render_3d') {
            $pdo->prepare("UPDATE booth_links SET is_final = 0 WHERE booth_id = :bid AND category = 'render_3d'")
                ->execute([':bid' => $boothId]);
        }

        $stmt = $pdo->prepare("
            INSERT INTO booth_links (
                id, booth_id, category, title, drive_url, preview_image_url, version,
                is_final, approved_at, notes, created_at, updated_at
            ) VALUES (
                :id, :booth_id, :category, :title, :drive_url, :preview_image_url, :version,
                :is_final, :approved_at, :notes, :created_at, :updated_at
            )
        ");
        $stmt->execute([
            ':id'                => $id,
            ':booth_id'          => $boothId,
            ':category'          => $category,
            ':title'             => $title,
            ':drive_url'         => $driveUrl,
            ':preview_image_url' => $previewImageUrl !== '' ? $previewImageUrl : null,
            ':version'           => $version,
            ':is_final'          => $isFinal,
            ':approved_at'       => $approvedAt,
            ':notes'             => $notes,
            ':created_at'        => $now,
            ':updated_at'        => $now,
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

        // Two-way sync to booths table
        if (in_array($category, ['print_ready', 'working_artwork'])) {
            $pdo->prepare("UPDATE booths SET print_drive_url = :url, updated_at = CURRENT_TIMESTAMP WHERE id = :bid")
                ->execute([':url' => $driveUrl, ':bid' => $boothId]);
        } else if ($category === 'goodies') {
            $pdo->prepare("UPDATE booths SET goodies_drive_url = :url, updated_at = CURRENT_TIMESTAMP WHERE id = :bid")
                ->execute([':url' => $driveUrl, ':bid' => $boothId]);
        }

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

        // Validate booth association if supplied
        if (!empty($body['booth_id']) && $body['booth_id'] !== $existing['booth_id']) {
            reworkzone_json_response(['success' => false, 'error' => 'Invalid booth association.'], 400);
        }

        // Merge existing saved preview image with explicitly supplied changes.
        // Never interpret an omitted image field as a request to delete the image.
        // Clear the image only through an explicit remove request (remove_preview_image: true/1)
        // or when preview_image_url is explicitly set to empty/null.
        if (!empty($body['remove_preview_image'])) {
            $previewImageUrl = null;
        } elseif (array_key_exists('preview_image_url', $body)) {
            $rawImg = $body['preview_image_url'];
            if ($rawImg === null || trim((string)$rawImg) === '') {
                $previewImageUrl = null;
            } else {
                $previewImageUrl = trim((string)$rawImg);
            }
        } else {
            // Omitted: preserve existing saved image path
            $previewImageUrl = $existing['preview_image_url'];
        }

        if (empty($title)) {
            reworkzone_json_response(['success' => false, 'error' => 'Link title is required.'], 400);
        }

        // For render_3d: allow Image Only, Link Only, or Image + Link.
        // Reject only when BOTH image and URL are missing.
        if ($category === 'render_3d') {
            if (empty($driveUrl) && empty($previewImageUrl)) {
                reworkzone_json_response(['success' => false, 'error' => 'Please add a 3D image or a 3D view link.'], 400);
            }
            if (!empty($driveUrl) && !filter_var($driveUrl, FILTER_VALIDATE_URL)) {
                reworkzone_json_response(['success' => false, 'error' => 'Please enter a valid 3D view URL.'], 400);
            }
        } else {
            if (empty($driveUrl) || !filter_var($driveUrl, FILTER_VALIDATE_URL)) {
                reworkzone_json_response(['success' => false, 'error' => 'A valid Google Drive URL is required.'], 400);
            }
        }

        // Security check on preview_image_url
        if (!empty($previewImageUrl)) {
            if (strpos($previewImageUrl, '..') !== false) {
                reworkzone_json_response(['success' => false, 'error' => 'Invalid preview image path.'], 400);
            }
            $isSafeInternal = strpos($previewImageUrl, '/uploads/3d_previews/') === 0;
            $isValidHttp = filter_var($previewImageUrl, FILTER_VALIDATE_URL) && (strpos($previewImageUrl, 'http://') === 0 || strpos($previewImageUrl, 'https://') === 0);
            if (!$isSafeInternal && !$isValidHttp) {
                reworkzone_json_response(['success' => false, 'error' => 'Preview image must be a valid uploaded file path or HTTPS URL.'], 400);
            }
        }

        if (!in_array($category, $validCategories, true)) {
            $category = $existing['category'];
        }

        $isFinal    = array_key_exists('is_final', $body) ? (!empty($body['is_final']) ? 1 : 0) : (int)$existing['is_final'];
        $approvedAt = $existing['approved_at'];
        if ($isFinal === 1 && empty($approvedAt)) {
            $approvedAt = date('Y-m-d H:i:s');
        } elseif ($isFinal === 0) {
            $approvedAt = null;
        }

        // APPROVAL SAFETY RULE: If the Drive URL changed, automatically reset approval!
        if ($driveUrl !== $existing['drive_url']) {
            $isFinal = 0;
            $approvedAt = null;
        }

        // If this 3D view is marked final, ensure other 3D views for this booth are marked draft
        if ($isFinal === 1 && $category === 'render_3d') {
            $pdo->prepare("UPDATE booth_links SET is_final = 0 WHERE booth_id = :bid AND category = 'render_3d' AND id != :id")
                ->execute([':bid' => $existing['booth_id'], ':id' => $id]);
        }

        $now = date('Y-m-d H:i:s');
        $stmt = $pdo->prepare("
            UPDATE booth_links
            SET category = :category,
                title = :title,
                drive_url = :drive_url,
                preview_image_url = :preview_image_url,
                version = :version,
                is_final = :is_final,
                approved_at = :approved_at,
                notes = :notes,
                updated_at = :updated_at
            WHERE id = :id
        ");
        $stmt->execute([
            ':category'          => $category,
            ':title'             => $title,
            ':drive_url'         => $driveUrl,
            ':preview_image_url' => $previewImageUrl,
            ':version'           => $version,
            ':is_final'          => $isFinal,
            ':approved_at'       => $approvedAt,
            ':notes'             => $notes,
            ':updated_at'        => $now,
            ':id'                => $id,
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

        // Two-way sync to booths table
        if (in_array($category, ['print_ready', 'working_artwork'])) {
            $pdo->prepare("UPDATE booths SET print_drive_url = :url, updated_at = CURRENT_TIMESTAMP WHERE id = :bid")
                ->execute([':url' => $driveUrl, ':bid' => $existing['booth_id']]);
        } else if ($category === 'goodies') {
            $pdo->prepare("UPDATE booths SET goodies_drive_url = :url, updated_at = CURRENT_TIMESTAMP WHERE id = :bid")
                ->execute([':url' => $driveUrl, ':bid' => $existing['booth_id']]);
        }

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

        // Cleanup uploaded preview image if stored locally
        if (!empty($existing['preview_image_url']) && strpos($existing['preview_image_url'], '/uploads/3d_previews/') === 0) {
            $rootDir = dirname(__DIR__, 2);
            $filePath = $rootDir . $existing['preview_image_url'];
            if (is_file($filePath)) {
                @unlink($filePath);
            }
            if (is_file($rootDir . '/public' . $existing['preview_image_url'])) {
                @unlink($rootDir . '/public' . $existing['preview_image_url']);
            }
        }

        $log = $pdo->prepare("
            INSERT INTO activity_logs (id, booth_id, action_type, actor_label, description)
            VALUES (:id, :booth_id, 'link_deleted', 'Master Admin', :desc)
        ");
        $log->execute([
            ':id'       => bin2hex(random_bytes(16)),
            ':booth_id' => $existing['booth_id'],
            ':desc'     => "Removed Drive link '{$existing['title']}' ({$existing['version']})."
        ]);

        // Two-way sync to booths table
        if (in_array($existing['category'], ['print_ready', 'working_artwork'])) {
            $fallbackCheck = $pdo->prepare("SELECT drive_url FROM booth_links WHERE booth_id = :bid AND id != :id AND category IN ('print_ready', 'working_artwork') ORDER BY is_final DESC, created_at DESC LIMIT 1");
            $fallbackCheck->execute([':bid' => $existing['booth_id'], ':id' => $id]);
            $fallback = $fallbackCheck->fetchColumn();
            $pdo->prepare("UPDATE booths SET print_drive_url = :url, updated_at = CURRENT_TIMESTAMP WHERE id = :bid")
                ->execute([':url' => $fallback ? $fallback : null, ':bid' => $existing['booth_id']]);
        } else if ($existing['category'] === 'goodies') {
            $fallbackCheck = $pdo->prepare("SELECT drive_url FROM booth_links WHERE booth_id = :bid AND id != :id AND category = 'goodies' ORDER BY created_at DESC LIMIT 1");
            $fallbackCheck->execute([':bid' => $existing['booth_id'], ':id' => $id]);
            $fallback = $fallbackCheck->fetchColumn();
            $pdo->prepare("UPDATE booths SET goodies_drive_url = :url, updated_at = CURRENT_TIMESTAMP WHERE id = :bid")
                ->execute([':url' => $fallback ? $fallback : null, ':bid' => $existing['booth_id']]);
        }

        reworkzone_json_response([
            'success' => true,
            'message' => "Link '{$existing['title']}' removed."
        ]);
    }

    reworkzone_json_response(['success' => false, 'error' => 'Invalid action.'], 400);
}

reworkzone_json_response(['success' => false, 'error' => 'Method not allowed.'], 405);
