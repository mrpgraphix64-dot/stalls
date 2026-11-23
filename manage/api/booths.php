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
                e.floor_plan_url AS event_floor_plan_url,
                (SELECT COUNT(*) FROM booth_links WHERE booth_id = b.id) AS link_count,
                (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND LOWER(task_name) NOT LIKE '%install%' AND LOWER(task_name) != 'design' AND LOWER(task_name) != 'design approved' AND (status IS NULL OR status != 'not_applicable')) AS task_count,
                (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND is_completed = 1 AND LOWER(task_name) NOT LIKE '%install%' AND LOWER(task_name) != 'design' AND LOWER(task_name) != 'design approved' AND (status IS NULL OR status != 'not_applicable')) AS tasks_completed,
                (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND LOWER(task_name) NOT LIKE '%install%' AND LOWER(task_name) != 'design' AND LOWER(task_name) != 'design approved' AND status = 'not_applicable') AS tasks_na,
                (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND LOWER(task_name) NOT LIKE '%install%' AND LOWER(task_name) != 'design' AND LOWER(task_name) != 'design approved') AS tasks_total,
                (SELECT CASE 
                    WHEN status IN ('not_applicable', 'na') THEN 'na' 
                    WHEN is_completed = 1 OR status = 'completed' THEN 'done' 
                    ELSE 'pending' 
                 END 
                 FROM booth_tasks 
                 WHERE booth_id = b.id AND (LOWER(phase) LIKE '%print%' OR LOWER(task_name) LIKE '%print%') 
                 LIMIT 1
                ) AS print_status,
                (SELECT CASE 
                    WHEN status IN ('not_applicable', 'na') THEN 'na' 
                    WHEN is_completed = 1 OR status = 'completed' THEN 'done' 
                    ELSE 'pending' 
                 END 
                 FROM booth_tasks 
                 WHERE booth_id = b.id AND (LOWER(phase) LIKE '%production%' OR LOWER(task_name) LIKE '%production%') 
                 LIMIT 1
                ) AS prod_status,
                (SELECT 
                    CASE 
                        WHEN drive_url IS NOT NULL AND drive_url != '' THEN drive_url 
                        WHEN preview_image_url IS NOT NULL AND preview_image_url != '' THEN preview_image_url 
                        ELSE NULL 
                    END 
                 FROM booth_links 
                 WHERE booth_id = b.id AND category = 'render_3d' 
                   AND ((drive_url IS NOT NULL AND drive_url != '') OR (preview_image_url IS NOT NULL AND preview_image_url != '')) 
                 ORDER BY is_final DESC, created_at ASC LIMIT 1) AS primary_3d_url,
                (SELECT preview_image_url FROM booth_links WHERE booth_id = b.id AND category = 'render_3d' AND preview_image_url IS NOT NULL AND preview_image_url != '' ORDER BY is_final DESC, created_at ASC LIMIT 1) AS primary_3d_preview_url,
                COALESCE(
                    NULLIF(b.print_drive_url, ''),
                    (SELECT drive_url FROM booth_links WHERE booth_id = b.id AND category IN ('print_ready', 'working_artwork') AND drive_url IS NOT NULL AND drive_url != '' ORDER BY is_final DESC, created_at DESC LIMIT 1),
                    NULLIF(b.main_drive_folder_url, '')
                ) AS resolved_print_drive_url,
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

        // Canonical synchronization for single booth query:
        // Ensure both print_drive_url and resolved_print_drive_url carry the canonical coalesced value
        $canonicalPrintUrl = !empty($booth['resolved_print_drive_url'])
            ? trim((string)$booth['resolved_print_drive_url'])
            : (!empty($booth['print_drive_url'])
                ? trim((string)$booth['print_drive_url'])
                : (!empty($booth['main_drive_folder_url']) ? trim((string)$booth['main_drive_folder_url']) : null));

        if (!empty($canonicalPrintUrl)) {
            $booth['print_drive_url'] = $canonicalPrintUrl;
            $booth['resolved_print_drive_url'] = $canonicalPrintUrl;
            // Backfill booths table if print_drive_url was empty
            $pdo->prepare("UPDATE booths SET print_drive_url = :url WHERE id = :id AND (print_drive_url IS NULL OR print_drive_url = '')")
                ->execute([':url' => $canonicalPrintUrl, ':id' => $id]);
        }

        if (empty($booth['goodies_drive_url'])) {
            $goodiesCheck = $pdo->prepare("SELECT drive_url FROM booth_links WHERE booth_id = :b_id AND category = 'goodies' AND drive_url IS NOT NULL AND drive_url != '' ORDER BY is_final DESC, created_at DESC LIMIT 1");
            $goodiesCheck->execute([':b_id' => $id]);
            $foundGoodiesUrl = $goodiesCheck->fetchColumn();
            if ($foundGoodiesUrl) {
                $booth['goodies_drive_url'] = $foundGoodiesUrl;
                $pdo->prepare("UPDATE booths SET goodies_drive_url = :url WHERE id = :id")->execute([':url' => $foundGoodiesUrl, ':id' => $id]);
            }
        }

        reworkzone_json_response([
            'success' => true,
            'booth'   => $booth
        ]);
    }

    // 1A-1. Dedicated Print Checklists Batch Data for Booths Directory
    if (($_GET['action'] ?? '') === 'print_checklists') {
        $requestedBoothIds = !empty($_GET['booth_ids']) ? array_filter(array_map('trim', explode(',', (string)$_GET['booth_ids']))) : null;
        $eventId = trim($_GET['event_id'] ?? '');

        $sql = "
            SELECT 
                b.*,
                e.name AS event_name,
                e.city AS event_city,
                e.start_date AS event_start_date,
                e.setup_date AS event_setup_date,
                e.floor_plan_url AS event_floor_plan_url,
                (SELECT COUNT(*) FROM booth_links WHERE booth_id = b.id) AS link_count,
                (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND LOWER(task_name) NOT LIKE '%install%' AND LOWER(task_name) != 'design' AND LOWER(task_name) != 'design approved' AND (status IS NULL OR status != 'not_applicable')) AS task_count,
                (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND is_completed = 1 AND LOWER(task_name) NOT LIKE '%install%' AND LOWER(task_name) != 'design' AND LOWER(task_name) != 'design approved' AND (status IS NULL OR status != 'not_applicable')) AS tasks_completed,
                (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND LOWER(task_name) NOT LIKE '%install%' AND LOWER(task_name) != 'design' AND LOWER(task_name) != 'design approved' AND status = 'not_applicable') AS tasks_na,
                (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND LOWER(task_name) NOT LIKE '%install%' AND LOWER(task_name) != 'design' AND LOWER(task_name) != 'design approved') AS tasks_total,
                (SELECT CASE 
                    WHEN status IN ('not_applicable', 'na') THEN 'na' 
                    WHEN is_completed = 1 OR status = 'completed' THEN 'done' 
                    ELSE 'pending' 
                 END 
                 FROM booth_tasks 
                 WHERE booth_id = b.id AND (LOWER(phase) LIKE '%print%' OR LOWER(task_name) LIKE '%print%') 
                 LIMIT 1
                ) AS print_status,
                (SELECT CASE 
                    WHEN status IN ('not_applicable', 'na') THEN 'na' 
                    WHEN is_completed = 1 OR status = 'completed' THEN 'done' 
                    ELSE 'pending' 
                 END 
                 FROM booth_tasks 
                 WHERE booth_id = b.id AND (LOWER(phase) LIKE '%production%' OR LOWER(task_name) LIKE '%production%') 
                 LIMIT 1
                ) AS prod_status,
                (SELECT 
                    CASE 
                        WHEN drive_url IS NOT NULL AND drive_url != '' THEN drive_url 
                        WHEN preview_image_url IS NOT NULL AND preview_image_url != '' THEN preview_image_url 
                        ELSE NULL 
                    END 
                 FROM booth_links 
                 WHERE booth_id = b.id AND category = 'render_3d' 
                   AND ((drive_url IS NOT NULL AND drive_url != '') OR (preview_image_url IS NOT NULL AND preview_image_url != '')) 
                 ORDER BY is_final DESC, created_at ASC LIMIT 1) AS primary_3d_url,
                (SELECT preview_image_url FROM booth_links WHERE booth_id = b.id AND category = 'render_3d' AND preview_image_url IS NOT NULL AND preview_image_url != '' ORDER BY is_final DESC, created_at ASC LIMIT 1) AS primary_3d_preview_url,
                COALESCE(
                    NULLIF(b.print_drive_url, ''),
                    (SELECT drive_url FROM booth_links WHERE booth_id = b.id AND category IN ('print_ready', 'working_artwork') AND drive_url IS NOT NULL AND drive_url != '' ORDER BY is_final DESC, created_at DESC LIMIT 1),
                    NULLIF(b.main_drive_folder_url, '')
                ) AS print_drive_url
            FROM booths b
            LEFT JOIN events e ON b.event_id = e.id
            WHERE b.status != 'archived'
        ";
        $params = [];
        if ($eventId !== '') {
            $sql .= " AND b.event_id = :event_id";
            $params[':event_id'] = $eventId;
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $allBooths = $stmt->fetchAll();

        if ($requestedBoothIds !== null) {
            $booths = array_values(array_filter($allBooths, fn($b) => in_array($b['id'], $requestedBoothIds, true)));
        } else {
            $includeDiscussions = isset($_GET['include_discussions']) && ($_GET['include_discussions'] === '1' || $_GET['include_discussions'] === 'true');
            if (!$includeDiscussions) {
                $booths = array_values(array_filter($allBooths, fn($b) => ($b['booking_stage'] ?? '') !== 'discussion'));
            } else {
                $booths = $allBooths;
            }
        }

        // Natural ascending sort by booth number
        usort($booths, function($a, $b) {
            return strnatcasecmp($a['booth_number'] ?? '', $b['booth_number'] ?? '');
        });

        $boothIds = array_column($booths, 'id');
        $itemsByBooth = [];
        $tasksByBooth = [];
        $linksByBooth = [];

        if (!empty($boothIds)) {
            $placeholders = implode(',', array_fill(0, count($boothIds), '?'));

            $itemStmt = $pdo->prepare("SELECT * FROM booth_items WHERE booth_id IN ($placeholders) ORDER BY category, created_at");
            $itemStmt->execute($boothIds);
            while ($itm = $itemStmt->fetch()) {
                $itemsByBooth[$itm['booth_id']][] = $itm;
            }

            $taskStmt = $pdo->prepare("SELECT * FROM booth_tasks WHERE booth_id IN ($placeholders) AND LOWER(task_name) NOT LIKE '%install%' AND LOWER(task_name) != 'design' AND LOWER(task_name) != 'design approved' ORDER BY sort_order, display_order");
            $taskStmt->execute($boothIds);
            while ($tsk = $taskStmt->fetch()) {
                $tasksByBooth[$tsk['booth_id']][] = $tsk;
            }

            $linkStmt = $pdo->prepare("SELECT * FROM booth_links WHERE booth_id IN ($placeholders) AND category = 'render_3d' ORDER BY created_at");
            $linkStmt->execute($boothIds);
            while ($lnk = $linkStmt->fetch()) {
                $linksByBooth[$lnk['booth_id']][] = $lnk;
            }
        }

        $printData = [];
        foreach ($booths as $b) {
            $bId = $b['id'];
            $bItems = $itemsByBooth[$bId] ?? [];
            $printData[] = [
                'booth' => $b,
                'eventName' => $b['event_name'] ?? 'Exhibition',
                'tasks' => $tasksByBooth[$bId] ?? [],
                'productionItems' => array_values(array_filter($bItems, fn($i) => ($i['category'] ?? '') === 'production')),
                'furnitureItems' => array_values(array_filter($bItems, fn($i) => ($i['category'] ?? '') === 'furniture')),
                'electricalItems' => array_values(array_filter($bItems, fn($i) => ($i['category'] ?? '') === 'electrical')),
                'goodiesItems' => array_values(array_filter($bItems, fn($i) => ($i['category'] ?? '') === 'goodies')),
                'views3D' => $linksByBooth[$bId] ?? [],
            ];
        }

        reworkzone_json_response([
            'success' => true,
            'stalls'  => $printData,
            'count'   => count($printData)
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
            e.floor_plan_url AS event_floor_plan_url,
            (SELECT COUNT(*) FROM booth_links WHERE booth_id = b.id) AS link_count,
            (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND LOWER(task_name) NOT LIKE '%install%' AND LOWER(task_name) != 'design' AND LOWER(task_name) != 'design approved' AND (status IS NULL OR status != 'not_applicable')) AS task_count,
            (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND is_completed = 1 AND LOWER(task_name) NOT LIKE '%install%' AND LOWER(task_name) != 'design' AND LOWER(task_name) != 'design approved' AND (status IS NULL OR status != 'not_applicable')) AS tasks_completed,
            (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND LOWER(task_name) NOT LIKE '%install%' AND LOWER(task_name) != 'design' AND LOWER(task_name) != 'design approved' AND status = 'not_applicable') AS tasks_na,
            (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND LOWER(task_name) NOT LIKE '%install%' AND LOWER(task_name) != 'design' AND LOWER(task_name) != 'design approved') AS tasks_total,
            (SELECT CASE 
                WHEN status IN ('not_applicable', 'na') THEN 'na' 
                WHEN is_completed = 1 OR status = 'completed' THEN 'done' 
                ELSE 'pending' 
             END 
             FROM booth_tasks 
             WHERE booth_id = b.id AND (LOWER(phase) LIKE '%print%' OR LOWER(task_name) LIKE '%print%') 
             LIMIT 1
            ) AS print_status,
            (SELECT CASE 
                WHEN status IN ('not_applicable', 'na') THEN 'na' 
                WHEN is_completed = 1 OR status = 'completed' THEN 'done' 
                ELSE 'pending' 
             END 
             FROM booth_tasks 
             WHERE booth_id = b.id AND (LOWER(phase) LIKE '%production%' OR LOWER(task_name) LIKE '%production%') 
             LIMIT 1
            ) AS prod_status,
            (SELECT 
                CASE 
                    WHEN drive_url IS NOT NULL AND drive_url != '' THEN drive_url 
                    WHEN preview_image_url IS NOT NULL AND preview_image_url != '' THEN preview_image_url 
                    ELSE NULL 
                END 
             FROM booth_links 
             WHERE booth_id = b.id AND category = 'render_3d' 
               AND ((drive_url IS NOT NULL AND drive_url != '') OR (preview_image_url IS NOT NULL AND preview_image_url != '')) 
             ORDER BY is_final DESC, created_at ASC LIMIT 1) AS primary_3d_url,
            (SELECT preview_image_url FROM booth_links WHERE booth_id = b.id AND category = 'render_3d' AND preview_image_url IS NOT NULL AND preview_image_url != '' ORDER BY is_final DESC, created_at ASC LIMIT 1) AS primary_3d_preview_url,
            COALESCE(
                NULLIF(b.print_drive_url, ''),
                (SELECT drive_url FROM booth_links WHERE booth_id = b.id AND category IN ('print_ready', 'working_artwork') AND drive_url IS NOT NULL AND drive_url != '' ORDER BY is_final DESC, created_at DESC LIMIT 1),
                NULLIF(b.main_drive_folder_url, '')
            ) AS print_drive_url
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

    // Filter by Booking Stage (confirmed vs discussion)
    $bookingStageFilter = trim($_GET['booking_stage'] ?? '');
    if ($bookingStageFilter === 'confirmed') {
        $sql .= " AND (b.booking_stage = 'confirmed' OR b.booking_stage IS NULL OR b.booking_stage = '')";
    } elseif ($bookingStageFilter === 'discussion') {
        $sql .= " AND b.booking_stage = 'discussion'";
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
        $mainDriveFolderUrl   = trim($body['main_drive_folder_url'] ?? '');
        $designResponsibility = trim($body['design_responsibility'] ?? 'Client Side');
        $printFileStatus      = trim($body['print_file_status'] ?? 'Designs Pending');
        $printDriveUrl        = trim($body['print_drive_url'] ?? '');
        $printRemark          = trim($body['print_remark'] ?? '');
        $goodiesStatus        = trim($body['goodies_status'] ?? 'Awaiting Client Artwork');
        $goodiesDriveUrl      = trim($body['goodies_drive_url'] ?? '');
        $goodiesRemark        = trim($body['goodies_remark'] ?? '');
        $status               = trim($body['status'] ?? 'draft');
        $notes                = trim($body['notes'] ?? '');
        $bookingStage         = trim($body['booking_stage'] ?? 'confirmed');
        if (!in_array($bookingStage, ['confirmed', 'discussion'], true)) {
            $bookingStage = 'confirmed';
        }
        $discussionRemark     = trim($body['discussion_remark'] ?? '');
        $wallConfiguration    = array_key_exists('wall_configuration', $body)
            ? (trim((string)$body['wall_configuration']) !== '' ? trim((string)$body['wall_configuration']) : null)
            : null;
        if ($wallConfiguration !== null && !in_array($wallConfiguration, ['3 Sides', 'Back + Left', 'Back + Right', 'Back Wall Only'], true)) {
            $wallConfiguration = null;
        }

        if (!in_array($designResponsibility, ['Client Side', 'Our Side'], true)) {
            $designResponsibility = 'Client Side';
        }
        if (!in_array($printFileStatus, ['Designs Pending', 'Partially Received', 'All Files Ready'], true)) {
            $printFileStatus = 'Designs Pending';
        }
        if (!empty($printDriveUrl) && !filter_var($printDriveUrl, FILTER_VALIDATE_URL)) {
            reworkzone_json_response(['success' => false, 'error' => 'Print Google Drive URL must be a valid web link.'], 400);
        }
        $validGoodiesStatuses = ['Awaiting Client Artwork', 'Artwork Received', 'Ready for Printing'];
        if (!in_array($goodiesStatus, $validGoodiesStatuses, true)) {
            $goodiesStatus = 'Awaiting Client Artwork';
        }
        if (!empty($goodiesDriveUrl) && !filter_var($goodiesDriveUrl, FILTER_VALIDATE_URL)) {
            reworkzone_json_response(['success' => false, 'error' => 'Client Artwork Google Drive URL must be a valid web link.'], 400);
        }

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

        if ($bookingStage === 'discussion') {
            if (empty($boothNumber)) {
                $boothNumber = 'Pending';
            }
        } else {
            if (empty($boothNumber) || strtolower($boothNumber) === 'pending') {
                reworkzone_json_response(['success' => false, 'error' => 'Booth / Stall number is required for confirmed stalls.'], 400);
            }

            // Conflict check: prevent duplicate confirmed stall number within the same event
            $dupCheck = $pdo->prepare("
                SELECT id, booth_number, client_name FROM booths 
                WHERE event_id = :event_id 
                  AND UPPER(TRIM(booth_number)) = UPPER(TRIM(:booth_number))
                  AND (booking_stage = 'confirmed' OR booking_stage IS NULL OR booking_stage = '')
                  AND status != 'archived'
            ");
            $dupCheck->execute([':event_id' => $eventId, ':booth_number' => $boothNumber]);
            if ($dupRow = $dupCheck->fetch()) {
                reworkzone_json_response([
                    'success' => false,
                    'error'   => "Stall #{$boothNumber} is already confirmed for this event ({$dupRow['client_name']})."
                ], 400);
            }
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
                design_responsibility, print_file_status, print_drive_url, print_remark,
                goodies_status, goodies_drive_url, goodies_remark,
                booking_stage, discussion_remark, wall_configuration,
                status, notes, created_at, updated_at
            ) VALUES (
                :id, :event_id, :booth_number, :client_name, :contact_person, :phone, :email,
                :stand_size, :booth_type, :budget, :quoted_amount, :main_drive_folder_url,
                :design_responsibility, :print_file_status, :print_drive_url, :print_remark,
                :goodies_status, :goodies_drive_url, :goodies_remark,
                :booking_stage, :discussion_remark, :wall_configuration,
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
            ':design_responsibility' => $designResponsibility,
            ':print_file_status'     => $printFileStatus,
            ':print_drive_url'       => !empty($printDriveUrl) ? $printDriveUrl : null,
            ':print_remark'          => !empty($printRemark) ? $printRemark : null,
            ':goodies_status'        => $goodiesStatus,
            ':goodies_drive_url'      => !empty($goodiesDriveUrl) ? $goodiesDriveUrl : null,
            ':goodies_remark'        => !empty($goodiesRemark) ? $goodiesRemark : null,
            ':booking_stage'         => $bookingStage,
            ':discussion_remark'     => !empty($discussionRemark) ? $discussionRemark : null,
            ':wall_configuration'    => $wallConfiguration,
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

        // Auto-seed default 5 checklist tasks ONLY for confirmed booths
        if ($bookingStage === 'confirmed') {
            $defaultTasks = [
                'Print Files & Design',
                'Production',
                'Furniture',
                'Electrical',
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

        $check = $pdo->prepare("SELECT * FROM booths WHERE id = :id");
        $check->execute([':id' => $id]);
        $existing = $check->fetch();

        if (!$existing) {
            reworkzone_json_response(['success' => false, 'error' => 'Booth not found.'], 404);
        }

        $eventId            = array_key_exists('event_id', $body) ? trim((string)$body['event_id']) : $existing['event_id'];
        $boothNumber        = array_key_exists('booth_number', $body) ? trim((string)$body['booth_number']) : $existing['booth_number'];
        $clientName         = array_key_exists('client_name', $body) ? trim((string)$body['client_name']) : $existing['client_name'];
        $contactPerson      = array_key_exists('contact_person', $body) ? trim((string)$body['contact_person']) : ($existing['contact_person'] ?? '');
        $phone              = array_key_exists('phone', $body) ? trim((string)$body['phone']) : ($existing['phone'] ?? '');
        $email              = array_key_exists('email', $body) ? trim((string)$body['email']) : ($existing['email'] ?? '');
        $standSize          = array_key_exists('stand_size', $body) ? trim((string)$body['stand_size']) : ($existing['stand_size'] ?? '');
        $boothType          = array_key_exists('booth_type', $body) ? trim((string)$body['booth_type']) : ($existing['booth_type'] ?? 'Wooden');
        $budget             = array_key_exists('budget', $body) ? (float)$body['budget'] : (float)($existing['budget'] ?? 0.0);
        $quotedAmount       = array_key_exists('quoted_amount', $body) ? (float)$body['quoted_amount'] : (float)($existing['quoted_amount'] ?? 0.0);
        $mainDriveFolderUrl   = array_key_exists('main_drive_folder_url', $body) ? trim((string)$body['main_drive_folder_url']) : ($existing['main_drive_folder_url'] ?? '');
        $designResponsibility = array_key_exists('design_responsibility', $body) ? trim((string)$body['design_responsibility']) : ($existing['design_responsibility'] ?? 'Client Side');
        $printFileStatus      = array_key_exists('print_file_status', $body) ? trim((string)$body['print_file_status']) : ($existing['print_file_status'] ?? 'Designs Pending');
        $printDriveUrl        = array_key_exists('print_drive_url', $body) ? trim((string)$body['print_drive_url']) : ($existing['print_drive_url'] ?? '');
        $printRemark          = array_key_exists('print_remark', $body) ? trim((string)$body['print_remark']) : ($existing['print_remark'] ?? '');
        $goodiesStatus        = array_key_exists('goodies_status', $body) ? trim((string)$body['goodies_status']) : ($existing['goodies_status'] ?? 'Awaiting Client Artwork');
        $goodiesDriveUrl      = array_key_exists('goodies_drive_url', $body) ? trim((string)$body['goodies_drive_url']) : ($existing['goodies_drive_url'] ?? '');
        $goodiesRemark        = array_key_exists('goodies_remark', $body) ? trim((string)$body['goodies_remark']) : ($existing['goodies_remark'] ?? '');
        $status               = array_key_exists('status', $body) ? trim((string)$body['status']) : ($existing['status'] ?? 'draft');
        $notes                = array_key_exists('notes', $body) ? trim((string)$body['notes']) : ($existing['notes'] ?? '');
        $bookingStage         = array_key_exists('booking_stage', $body) ? trim((string)$body['booking_stage']) : ($existing['booking_stage'] ?? 'confirmed');
        if (!in_array($bookingStage, ['confirmed', 'discussion'], true)) {
            $bookingStage = $existing['booking_stage'] ?? 'confirmed';
        }
        $discussionRemark     = array_key_exists('discussion_remark', $body)
            ? (trim((string)$body['discussion_remark']) !== '' ? trim((string)$body['discussion_remark']) : null)
            : ($existing['discussion_remark'] ?? null);
        $wallConfiguration    = array_key_exists('wall_configuration', $body)
            ? (trim((string)$body['wall_configuration']) !== '' ? trim((string)$body['wall_configuration']) : null)
            : ($existing['wall_configuration'] ?? null);
        if ($wallConfiguration !== null && !in_array($wallConfiguration, ['3 Sides', 'Back + Left', 'Back + Right', 'Back Wall Only'], true)) {
            $wallConfiguration = $existing['wall_configuration'] ?? null;
        }

        if (!in_array($designResponsibility, ['Client Side', 'Our Side'], true)) {
            $designResponsibility = $existing['design_responsibility'] ?? 'Client Side';
        }
        if (!in_array($printFileStatus, ['Designs Pending', 'Partially Received', 'All Files Ready'], true)) {
            $printFileStatus = $existing['print_file_status'] ?? 'Designs Pending';
        }
        if (!empty($printDriveUrl) && !filter_var($printDriveUrl, FILTER_VALIDATE_URL)) {
            reworkzone_json_response(['success' => false, 'error' => 'Print Google Drive URL must be a valid web link.'], 400);
        }
        $validGoodiesStatuses = ['Awaiting Client Artwork', 'Artwork Received', 'Ready for Printing'];
        if (!in_array($goodiesStatus, $validGoodiesStatuses, true)) {
            $goodiesStatus = $existing['goodies_status'] ?? 'Awaiting Client Artwork';
        }
        if (!empty($goodiesDriveUrl) && !filter_var($goodiesDriveUrl, FILTER_VALIDATE_URL)) {
            reworkzone_json_response(['success' => false, 'error' => 'Client Artwork Google Drive URL must be a valid web link.'], 400);
        }

        if ($bookingStage === 'discussion') {
            if (empty($boothNumber)) {
                $boothNumber = 'Pending';
            }
        } else {
            if (empty($boothNumber) || strtolower($boothNumber) === 'pending') {
                reworkzone_json_response(['success' => false, 'error' => 'Booth / Stall number is required for confirmed stalls.'], 400);
            }

            // Conflict check: prevent duplicate confirmed stall number within the same event
            $dupCheck = $pdo->prepare("
                SELECT id, booth_number, client_name FROM booths 
                WHERE event_id = :event_id 
                  AND UPPER(TRIM(booth_number)) = UPPER(TRIM(:booth_number))
                  AND id != :id
                  AND (booking_stage = 'confirmed' OR booking_stage IS NULL OR booking_stage = '')
                  AND status != 'archived'
            ");
            $dupCheck->execute([
                ':event_id'     => $eventId,
                ':booth_number' => $boothNumber,
                ':id'           => $id,
            ]);
            if ($dupRow = $dupCheck->fetch()) {
                reworkzone_json_response([
                    'success' => false,
                    'error'   => "Stall #{$boothNumber} is already confirmed for this event ({$dupRow['client_name']})."
                ], 400);
            }
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
                design_responsibility = :design_responsibility,
                print_file_status = :print_file_status,
                print_drive_url = :print_drive_url,
                print_remark = :print_remark,
                goodies_status = :goodies_status,
                goodies_drive_url = :goodies_drive_url,
                goodies_remark = :goodies_remark,
                booking_stage = :booking_stage,
                discussion_remark = :discussion_remark,
                wall_configuration = :wall_configuration,
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
            ':design_responsibility' => $designResponsibility,
            ':print_file_status'     => $printFileStatus,
            ':print_drive_url'       => !empty($printDriveUrl) ? $printDriveUrl : null,
            ':print_remark'          => !empty($printRemark) ? $printRemark : null,
            ':goodies_status'        => $goodiesStatus,
            ':goodies_drive_url'      => !empty($goodiesDriveUrl) ? $goodiesDriveUrl : null,
            ':goodies_remark'        => !empty($goodiesRemark) ? $goodiesRemark : null,
            ':booking_stage'         => $bookingStage,
            ':discussion_remark'     => !empty($discussionRemark) ? $discussionRemark : null,
            ':wall_configuration'    => $wallConfiguration,
            ':status'                => $status,
            ':notes'                 => $notes,
            ':updated_at'            => $now,
            ':id'                    => $id,
        ]);

        // Two-way synchronization: Keep booth_links synchronized with booths.print_drive_url and goodies_drive_url
        if (!empty($printDriveUrl)) {
            // Also keep main_drive_folder_url in sync if empty
            if (empty($mainDriveFolderUrl)) {
                $mainDriveFolderUrl = $printDriveUrl;
                $pdo->prepare("UPDATE booths SET main_drive_folder_url = :url WHERE id = :id AND (main_drive_folder_url IS NULL OR main_drive_folder_url = '')")
                    ->execute([':url' => $printDriveUrl, ':id' => $id]);
            }
            $existingLinkStmt = $pdo->prepare("SELECT id FROM booth_links WHERE booth_id = :b_id AND category IN ('print_ready', 'working_artwork') LIMIT 1");
            $existingLinkStmt->execute([':b_id' => $id]);
            $existingLinkId = $existingLinkStmt->fetchColumn();
            if ($existingLinkId) {
                $pdo->prepare("UPDATE booth_links SET drive_url = :url, is_final = 1, updated_at = CURRENT_TIMESTAMP WHERE id = :id")
                    ->execute([':url' => $printDriveUrl, ':id' => $existingLinkId]);
            } else {
                $pdo->prepare("INSERT INTO booth_links (id, booth_id, category, title, drive_url, is_final, created_at, updated_at) VALUES (:id, :b_id, 'print_ready', 'Print Ready Artwork', :url, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
                    ->execute([':id' => 'lnk_pr_' . bin2hex(random_bytes(6)), ':b_id' => $id, ':url' => $printDriveUrl]);
            }
        } else if (array_key_exists('print_drive_url', $body) && empty($printDriveUrl)) {
            $pdo->prepare("DELETE FROM booth_links WHERE booth_id = :b_id AND category IN ('print_ready', 'working_artwork')")
                ->execute([':b_id' => $id]);
        }

        if (!empty($goodiesDriveUrl)) {
            $gLinkStmt = $pdo->prepare("SELECT id FROM booth_links WHERE booth_id = :b_id AND category = 'goodies' LIMIT 1");
            $gLinkStmt->execute([':b_id' => $id]);
            $gId = $gLinkStmt->fetchColumn();
            if ($gId) {
                $pdo->prepare("UPDATE booth_links SET drive_url = :url, updated_at = CURRENT_TIMESTAMP WHERE id = :id")
                    ->execute([':url' => $goodiesDriveUrl, ':id' => $gId]);
            } else {
                $pdo->prepare("INSERT INTO booth_links (id, booth_id, category, title, drive_url, created_at, updated_at) VALUES (:id, :b_id, 'goodies', 'Goodies Artwork', :url, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
                    ->execute([':id' => 'lnk_gd_' . bin2hex(random_bytes(6)), ':b_id' => $id, ':url' => $goodiesDriveUrl]);
            }
        } else if (array_key_exists('goodies_drive_url', $body) && empty($goodiesDriveUrl)) {
            $pdo->prepare("DELETE FROM booth_links WHERE booth_id = :b_id AND category = 'goodies'")
                ->execute([':b_id' => $id]);
        }

        // Auto-seed default 6 checklist tasks if this booth is confirmed and has no tasks
        if ($bookingStage === 'confirmed') {
            $taskCheck = $pdo->prepare("SELECT COUNT(*) FROM booth_tasks WHERE booth_id = :id");
            $taskCheck->execute([':id' => $id]);
            if ((int)$taskCheck->fetchColumn() === 0) {
                $defaultTasks = [
                    'Design',
                    'Print Files',
                    'Production',
                    'Furniture',
                    'Electrical',
                ];
                $insertTaskStmt = $pdo->prepare("
                    INSERT INTO booth_tasks (id, booth_id, phase, task_name, sort_order, display_order, is_completed, status, created_at, updated_at)
                    VALUES (:id, :booth_id, :phase, :task_name, :sort_order, :sort_order, 0, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ");
                foreach ($defaultTasks as $idx => $taskName) {
                    $insertTaskStmt->execute([
                        ':id'         => 'tsk_' . bin2hex(random_bytes(6)),
                        ':booth_id'   => $id,
                        ':phase'      => $taskName,
                        ':task_name'  => $taskName,
                        ':sort_order' => $idx + 1,
                    ]);
                }
            }
        }

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

        // Self-healing fallback: If print_drive_url is empty on booths, check booth_links records or main_drive_folder_url
        if (!empty($updated) && empty($updated['print_drive_url'])) {
            $linkCheck = $pdo->prepare("SELECT drive_url FROM booth_links WHERE booth_id = :b_id AND category IN ('print_ready', 'working_artwork') AND drive_url IS NOT NULL AND drive_url != '' ORDER BY is_final DESC, created_at DESC LIMIT 1");
            $linkCheck->execute([':b_id' => $id]);
            $foundUrl = $linkCheck->fetchColumn();
            if (!$foundUrl && !empty($updated['main_drive_folder_url'])) {
                $foundUrl = $updated['main_drive_folder_url'];
            }
            if ($foundUrl) {
                $updated['print_drive_url'] = $foundUrl;
                $pdo->prepare("UPDATE booths SET print_drive_url = :url WHERE id = :id")->execute([':url' => $foundUrl, ':id' => $id]);
            }
        }
        if (!empty($updated)) {
            $updated['resolved_print_drive_url'] = $updated['print_drive_url'] ?? null;
        }

        if (!empty($updated) && empty($updated['goodies_drive_url'])) {
            $goodiesCheck = $pdo->prepare("SELECT drive_url FROM booth_links WHERE booth_id = :b_id AND category = 'goodies' AND drive_url IS NOT NULL AND drive_url != '' ORDER BY created_at DESC LIMIT 1");
            $goodiesCheck->execute([':b_id' => $id]);
            $foundGoodiesUrl = $goodiesCheck->fetchColumn();
            if ($foundGoodiesUrl) {
                $updated['goodies_drive_url'] = $foundGoodiesUrl;
                $pdo->prepare("UPDATE booths SET goodies_drive_url = :url WHERE id = :id")->execute([':url' => $foundGoodiesUrl, ':id' => $id]);
            }
        }

        reworkzone_json_response([
            'success' => true,
            'message' => 'Booth updated successfully.',
            'booth'   => $updated
        ]);
    }

    // ---------------------------------------------------------------------
    // 2B-2. CONFIRM BOOTH (Convert Ongoing Discussion to Confirmed Stall)
    // ---------------------------------------------------------------------
    if ($action === 'confirm') {
        $id = trim($body['id'] ?? ($_GET['id'] ?? ''));

        if (empty($id)) {
            reworkzone_json_response(['success' => false, 'error' => 'Booth ID is required.'], 400);
        }

        $check = $pdo->prepare("SELECT * FROM booths WHERE id = :id");
        $check->execute([':id' => $id]);
        $existing = $check->fetch();

        if (!$existing) {
            reworkzone_json_response(['success' => false, 'error' => 'Booth not found.'], 404);
        }

        $boothNumber = trim($body['booth_number'] ?? ($existing['booth_number'] ?? ''));
        if (empty($boothNumber) || strtolower($boothNumber) === 'pending') {
            reworkzone_json_response(['success' => false, 'error' => 'Booth / Stall number is required to confirm this stall.'], 400);
        }

        // Conflict check: prevent duplicate confirmed stall number within the same event
        $dupCheck = $pdo->prepare("
            SELECT id, booth_number, client_name FROM booths 
            WHERE event_id = :event_id 
              AND UPPER(TRIM(booth_number)) = UPPER(TRIM(:booth_number))
              AND id != :id
              AND (booking_stage = 'confirmed' OR booking_stage IS NULL OR booking_stage = '')
              AND status != 'archived'
        ");
        $dupCheck->execute([
            ':event_id'     => $existing['event_id'],
            ':booth_number' => $boothNumber,
            ':id'           => $id,
        ]);
        if ($dupRow = $dupCheck->fetch()) {
            reworkzone_json_response([
                'success' => false,
                'error'   => "Stall #{$boothNumber} is already confirmed for this event ({$dupRow['client_name']})."
            ], 400);
        }

        $now = date('Y-m-d H:i:s');
        $stmt = $pdo->prepare("
            UPDATE booths 
            SET booking_stage = 'confirmed',
                booth_number = :booth_number,
                updated_at = :now
            WHERE id = :id
        ");
        $stmt->execute([
            ':booth_number' => $boothNumber,
            ':now'          => $now,
            ':id'           => $id,
        ]);

        // Auto-seed default 5 checklist tasks exactly once if not already present
        $taskCheck = $pdo->prepare("SELECT COUNT(*) FROM booth_tasks WHERE booth_id = :id");
        $taskCheck->execute([':id' => $id]);
        if ((int)$taskCheck->fetchColumn() === 0) {
            $defaultTasks = [
                'Print Files & Design',
                'Production',
                'Furniture',
                'Electrical',
            ];
            $insertTaskStmt = $pdo->prepare("
                INSERT INTO booth_tasks (id, booth_id, phase, task_name, sort_order, display_order, is_completed, status, created_at, updated_at)
                VALUES (:id, :booth_id, :phase, :task_name, :sort_order, :sort_order, 0, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ");
            foreach ($defaultTasks as $idx => $taskName) {
                $insertTaskStmt->execute([
                    ':id'         => 'tsk_' . bin2hex(random_bytes(6)),
                    ':booth_id'   => $id,
                    ':phase'      => $taskName,
                    ':task_name'  => $taskName,
                    ':sort_order' => $idx + 1,
                ]);
            }
        }

        // Audit Log
        $logStmt = $pdo->prepare("
            INSERT INTO activity_logs (id, booth_id, action_type, actor_label, description)
            VALUES (:id, :booth_id, 'booth_confirmed', 'Master Admin', :desc)
        ");
        $logStmt->execute([
            ':id'       => bin2hex(random_bytes(16)),
            ':booth_id' => $id,
            ':desc'     => "Confirmed stall '{$boothNumber}' for client '{$existing['client_name']}'."
        ]);

        // Retrieve updated booth
        $getStmt = $pdo->prepare("
            SELECT b.*, e.name AS event_name, e.city AS event_city
            FROM booths b
            LEFT JOIN events e ON b.event_id = e.id
            WHERE b.id = :id
        ");
        $getStmt->execute([':id' => $id]);
        $updated = $getStmt->fetch();

        reworkzone_json_response([
            'success' => true,
            'message' => "Stall #{$boothNumber} confirmed successfully.",
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

    // ---------------------------------------------------------------------
    // 2D. DELETE BOOTH (Destructive with Safe Transaction & Foreign Keys)
    // ---------------------------------------------------------------------
    if ($action === 'delete') {
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

        $pdo->beginTransaction();
        try {
            $delExp = $pdo->prepare("DELETE FROM booth_expenses WHERE booth_id = :id");
            $delExp->execute([':id' => $id]);

            $delItm = $pdo->prepare("DELETE FROM booth_items WHERE booth_id = :id");
            $delItm->execute([':id' => $id]);

            $delLnk = $pdo->prepare("DELETE FROM booth_links WHERE booth_id = :id");
            $delLnk->execute([':id' => $id]);

            $delTsk = $pdo->prepare("DELETE FROM booth_tasks WHERE booth_id = :id");
            $delTsk->execute([':id' => $id]);

            $updAct = $pdo->prepare("UPDATE activity_logs SET booth_id = NULL WHERE booth_id = :id");
            $updAct->execute([':id' => $id]);

            $delBth = $pdo->prepare("DELETE FROM booths WHERE id = :id");
            $delBth->execute([':id' => $id]);

            $logStmt = $pdo->prepare("
                INSERT INTO activity_logs (id, booth_id, action_type, actor_label, description)
                VALUES (:id, NULL, 'booth_deleted', 'Master Admin', :desc)
            ");
            $logStmt->execute([
                ':id'   => bin2hex(random_bytes(16)),
                ':desc' => "Permanently deleted stall '{$existing['booth_number']}' ({$existing['client_name']})."
            ]);

            $pdo->commit();

            reworkzone_json_response([
                'success'    => true,
                'message'    => "Stall '{$existing['booth_number']}' deleted permanently.",
                'deleted_id' => $id,
                'event_id'   => $existing['event_id']
            ]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            error_log('Booth delete error: ' . $e->getMessage());
            reworkzone_json_response(['success' => false, 'error' => 'Failed to delete booth: ' . $e->getMessage()], 500);
        }
    }

    reworkzone_json_response(['success' => false, 'error' => 'Invalid action.'], 400);
}

// =========================================================================
// 3. DELETE: Permanent Stall Deletion by ID
// =========================================================================
if ($method === 'DELETE') {
    reworkzone_verify_csrf();
    $id = trim($_GET['id'] ?? '');
    if (empty($id)) {
        $raw = file_get_contents('php://input');
        $body = json_decode($raw, true) ?? [];
        $id = trim($body['id'] ?? '');
    }

    if (empty($id)) {
        reworkzone_json_response(['success' => false, 'error' => 'Booth ID is required.'], 400);
    }

    $check = $pdo->prepare("SELECT id, booth_number, client_name, event_id FROM booths WHERE id = :id");
    $check->execute([':id' => $id]);
    $existing = $check->fetch();

    if (!$existing) {
        reworkzone_json_response(['success' => false, 'error' => 'Booth not found.'], 404);
    }

    $pdo->beginTransaction();
    try {
        $delExp = $pdo->prepare("DELETE FROM booth_expenses WHERE booth_id = :id");
        $delExp->execute([':id' => $id]);

        $delItm = $pdo->prepare("DELETE FROM booth_items WHERE booth_id = :id");
        $delItm->execute([':id' => $id]);

        $delLnk = $pdo->prepare("DELETE FROM booth_links WHERE booth_id = :id");
        $delLnk->execute([':id' => $id]);

        $delTsk = $pdo->prepare("DELETE FROM booth_tasks WHERE booth_id = :id");
        $delTsk->execute([':id' => $id]);

        $updAct = $pdo->prepare("UPDATE activity_logs SET booth_id = NULL WHERE booth_id = :id");
        $updAct->execute([':id' => $id]);

        $delBth = $pdo->prepare("DELETE FROM booths WHERE id = :id");
        $delBth->execute([':id' => $id]);

        $logStmt = $pdo->prepare("
            INSERT INTO activity_logs (id, booth_id, action_type, actor_label, description)
            VALUES (:id, NULL, 'booth_deleted', 'Master Admin', :desc)
        ");
        $logStmt->execute([
            ':id'   => bin2hex(random_bytes(16)),
            ':desc' => "Permanently deleted stall '{$existing['booth_number']}' ({$existing['client_name']})."
        ]);

        $pdo->commit();

        reworkzone_json_response([
            'success'    => true,
            'message'    => "Stall '{$existing['booth_number']}' deleted permanently.",
            'deleted_id' => $id,
            'event_id'   => $existing['event_id']
        ]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('Booth delete error: ' . $e->getMessage());
        reworkzone_json_response(['success' => false, 'error' => 'Failed to delete booth: ' . $e->getMessage()], 500);
    }
}

reworkzone_json_response(['success' => false, 'error' => 'Method not allowed.'], 405);
