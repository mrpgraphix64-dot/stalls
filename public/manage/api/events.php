<?php
/**
 * Reworkzone Stalls Operations System - Event Management API
 * 
 * Handles listing, creating, reading, updating, and archiving events.
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
// 1. GET: Fetch list of events OR single event by ID
// =========================================================================
if ($method === 'GET') {
    $id = trim($_GET['id'] ?? '');

    // 1A. Fetch Single Event
    if (!empty($id)) {
        $stmt = $pdo->prepare("
            SELECT 
                e.*,
                COUNT(b.id) AS booth_count
            FROM events e
            LEFT JOIN booths b ON e.id = b.event_id AND b.status != 'archived'
            WHERE e.id = :id
            GROUP BY e.id
            LIMIT 1
        ");
        $stmt->execute([':id' => $id]);
        $event = $stmt->fetch();

        if (!$event) {
            reworkzone_json_response(['success' => false, 'error' => 'Event not found.'], 404);
        }

        // Fetch booths registered under this event
        $boothStmt = $pdo->prepare("
            SELECT 
                b.*,
                (SELECT COUNT(*) FROM booth_links WHERE booth_id = b.id) AS link_count,
                (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND is_completed = 1 AND LOWER(task_name) NOT LIKE '%install%' AND LOWER(task_name) != 'design' AND LOWER(task_name) != 'design approved' AND (status IS NULL OR status != 'not_applicable')) AS tasks_completed,
                (SELECT COUNT(*) FROM booth_tasks WHERE booth_id = b.id AND LOWER(task_name) NOT LIKE '%install%' AND LOWER(task_name) != 'design' AND LOWER(task_name) != 'design approved' AND (status IS NULL OR status != 'not_applicable')) AS task_count,
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
                    (SELECT drive_url FROM booth_links WHERE booth_id = b.id AND category IN ('print_ready', 'working_artwork') AND drive_url IS NOT NULL AND drive_url != '' ORDER BY created_at DESC LIMIT 1)
                ) AS print_drive_url
            FROM booths b
            WHERE b.event_id = :event_id AND b.status != 'archived'
            ORDER BY b.booth_number ASC, b.created_at DESC
        ");
        $boothStmt->execute([':event_id' => $id]);
        $booths = $boothStmt->fetchAll();

        // 1A-1. Dedicated Print Checklists Batch Data for Event Stalls
        if (($_GET['action'] ?? '') === 'print_checklists') {
            $requestedBoothIds = !empty($_GET['booth_ids']) ? array_filter(array_map('trim', explode(',', (string)$_GET['booth_ids']))) : null;
            if ($requestedBoothIds !== null) {
                $booths = array_values(array_filter($booths, fn($b) => in_array($b['id'], $requestedBoothIds, true)));
            } else {
                // By default, exclude ongoing discussions from checklists unless explicitly requested
                $includeDiscussions = isset($_GET['include_discussions']) && ($_GET['include_discussions'] === '1' || $_GET['include_discussions'] === 'true');
                if (!$includeDiscussions) {
                    $booths = array_values(array_filter($booths, fn($b) => ($b['booking_stage'] ?? '') !== 'discussion'));
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
                    'eventName' => $event['name'],
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
                'event'   => $event,
                'stalls'  => $printData,
                'count'   => count($printData)
            ]);
        }

        $event['booths'] = $booths;

        reworkzone_json_response([
            'success' => true,
            'event'   => $event
        ]);
    }

    // 1B. Fetch Event List (with filters & search)
    $search = trim($_GET['search'] ?? '');
    $status = trim($_GET['status'] ?? '');

    $sql = "
        SELECT 
            e.*,
            COUNT(b.id) AS booth_count
        FROM events e
        LEFT JOIN booths b ON e.id = b.event_id AND b.status != 'archived'
        WHERE 1=1
    ";
    $params = [];

    if ($status === 'archived') {
        $sql .= " AND e.status = 'archived'";
    } elseif (!empty($status) && $status !== 'all') {
        $sql .= " AND e.status = :status";
        $params[':status'] = $status;
    } else {
        $sql .= " AND e.status != 'archived'";
    }

    if (!empty($search)) {
        $sql .= " AND (e.name LIKE :s1 OR e.venue LIKE :s2 OR e.city LIKE :s3)";
        $params[':s1'] = "%{$search}%";
        $params[':s2'] = "%{$search}%";
        $params[':s3'] = "%{$search}%";
    }

    $sql .= " GROUP BY e.id ORDER BY e.start_date DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $events = $stmt->fetchAll();

    reworkzone_json_response([
        'success' => true,
        'events'  => $events,
        'count'   => count($events)
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
    // 2A. CREATE EVENT
    // ---------------------------------------------------------------------
    if ($action === 'create') {
        $name            = trim($body['name'] ?? '');
        $venue           = trim($body['venue'] ?? '');
        $city            = trim($body['city'] ?? '');
        $startDate       = trim($body['start_date'] ?? '');
        $endDate         = trim($body['end_date'] ?? '');
        $setupDate       = !empty($body['setup_date']) ? trim($body['setup_date']) : null;
        $dismantlingDate = !empty($body['dismantling_date']) ? trim($body['dismantling_date']) : null;
        $notes           = !empty($body['notes']) ? trim($body['notes']) : null;
        $floorPlanUrl    = array_key_exists('floor_plan_url', $body) ? (trim((string)$body['floor_plan_url']) ?: null) : null;
        $status          = 'upcoming';

        if (!empty($body['status']) && in_array(trim($body['status']), ['upcoming', 'in_progress', 'live', 'completed', 'archived'], true)) {
            $status = trim($body['status']);
        }

        // Validation
        if (strlen($name) < 2) {
            reworkzone_json_response(['success' => false, 'error' => 'Event name must be at least 2 characters.'], 400);
        }
        if (strlen($venue) < 2) {
            reworkzone_json_response(['success' => false, 'error' => 'Venue is required.'], 400);
        }
        if (strlen($city) < 2) {
            reworkzone_json_response(['success' => false, 'error' => 'City is required.'], 400);
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate)) {
            reworkzone_json_response(['success' => false, 'error' => 'Valid start date (YYYY-MM-DD) is required.'], 400);
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
            reworkzone_json_response(['success' => false, 'error' => 'Valid end date (YYYY-MM-DD) is required.'], 400);
        }
        if (strtotime($endDate) < strtotime($startDate)) {
            reworkzone_json_response(['success' => false, 'error' => 'End date cannot be earlier than start date.'], 400);
        }
        if ($setupDate !== null && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $setupDate)) {
            reworkzone_json_response(['success' => false, 'error' => 'Setup date must be in YYYY-MM-DD format.'], 400);
        }
        if ($dismantlingDate !== null && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dismantlingDate)) {
            reworkzone_json_response(['success' => false, 'error' => 'Dismantling date must be in YYYY-MM-DD format.'], 400);
        }

        $id = 'evt_' . bin2hex(random_bytes(6));
        $now = date('Y-m-d H:i:s');

        $stmt = $pdo->prepare("
            INSERT INTO events (id, name, venue, city, start_date, end_date, setup_date, dismantling_date, status, notes, floor_plan_url, created_at, updated_at)
            VALUES (:id, :name, :venue, :city, :start_date, :end_date, :setup_date, :dismantling_date, :status, :notes, :floor_plan_url, :created_at, :updated_at)
        ");
        $stmt->execute([
            ':id'               => $id,
            ':name'             => $name,
            ':venue'            => $venue,
            ':city'             => $city,
            ':start_date'       => $startDate,
            ':end_date'         => $endDate,
            ':setup_date'       => $setupDate,
            ':dismantling_date' => $dismantlingDate,
            ':status'           => $status,
            ':notes'            => $notes,
            ':floor_plan_url'   => $floorPlanUrl,
            ':created_at'       => $now,
            ':updated_at'       => $now,
        ]);

        // Audit Log
        $logStmt = $pdo->prepare("
            INSERT INTO activity_logs (id, booth_id, action_type, actor_label, description)
            VALUES (:id, NULL, 'event_created', 'Master Admin', :desc)
        ");
        $logStmt->execute([
            ':id'   => bin2hex(random_bytes(16)),
            ':desc' => "Created exhibition event '{$name}' at {$venue}, {$city}."
        ]);

        // Fetch inserted record
        $getStmt = $pdo->prepare("SELECT * FROM events WHERE id = :id");
        $getStmt->execute([':id' => $id]);
        $created = $getStmt->fetch();

        reworkzone_json_response([
            'success' => true,
            'message' => 'Event created successfully.',
            'event'   => $created
        ], 201);
    }

    // ---------------------------------------------------------------------
    // 2B. UPDATE EVENT
    // ---------------------------------------------------------------------
    if ($action === 'update') {
        $id = trim($body['id'] ?? ($_GET['id'] ?? ''));

        if (empty($id)) {
            reworkzone_json_response(['success' => false, 'error' => 'Event ID is required.'], 400);
        }

        // Check existence
        $check = $pdo->prepare("SELECT * FROM events WHERE id = :id");
        $check->execute([':id' => $id]);
        $existing = $check->fetch();

        if (!$existing) {
            reworkzone_json_response(['success' => false, 'error' => 'Event not found.'], 404);
        }

        $name            = array_key_exists('name', $body) ? trim($body['name']) : $existing['name'];
        $venue           = array_key_exists('venue', $body) ? trim($body['venue']) : $existing['venue'];
        $city            = array_key_exists('city', $body) ? trim($body['city']) : $existing['city'];
        $startDate       = array_key_exists('start_date', $body) ? trim($body['start_date']) : $existing['start_date'];
        $endDate         = array_key_exists('end_date', $body) ? trim($body['end_date']) : $existing['end_date'];
        $setupDate       = array_key_exists('setup_date', $body) ? (trim((string)$body['setup_date']) ?: null) : $existing['setup_date'];
        $dismantlingDate = array_key_exists('dismantling_date', $body) ? (trim((string)$body['dismantling_date']) ?: null) : $existing['dismantling_date'];
        $status          = array_key_exists('status', $body) ? trim($body['status']) : $existing['status'];
        $notes           = array_key_exists('notes', $body) ? (trim((string)$body['notes']) ?: null) : $existing['notes'];
        $floorPlanUrl    = array_key_exists('floor_plan_url', $body) ? (trim((string)$body['floor_plan_url']) ?: null) : ($existing['floor_plan_url'] ?? null);

        if (strlen($name) < 2) {
            reworkzone_json_response(['success' => false, 'error' => 'Event name must be at least 2 characters.'], 400);
        }
        if (strlen($venue) < 2) {
            reworkzone_json_response(['success' => false, 'error' => 'Venue is required.'], 400);
        }
        if (strlen($city) < 2) {
            reworkzone_json_response(['success' => false, 'error' => 'City is required.'], 400);
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate)) {
            reworkzone_json_response(['success' => false, 'error' => 'Valid start date (YYYY-MM-DD) is required.'], 400);
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
            reworkzone_json_response(['success' => false, 'error' => 'Valid end date (YYYY-MM-DD) is required.'], 400);
        }
        if (strtotime($endDate) < strtotime($startDate)) {
            reworkzone_json_response(['success' => false, 'error' => 'End date cannot be earlier than start date.'], 400);
        }

        $validStatuses = ['upcoming', 'in_progress', 'live', 'completed', 'archived'];
        if (!in_array($status, $validStatuses, true)) {
            $status = $existing['status'];
        }

        $now = date('Y-m-d H:i:s');
        $stmt = $pdo->prepare("
            UPDATE events 
            SET name = :name,
                venue = :venue,
                city = :city,
                start_date = :start_date,
                end_date = :end_date,
                setup_date = :setup_date,
                dismantling_date = :dismantling_date,
                status = :status,
                notes = :notes,
                floor_plan_url = :floor_plan_url,
                updated_at = :updated_at
            WHERE id = :id
        ");
        $stmt->execute([
            ':name'             => $name,
            ':venue'            => $venue,
            ':city'             => $city,
            ':start_date'       => $startDate,
            ':end_date'         => $endDate,
            ':setup_date'       => $setupDate,
            ':dismantling_date' => $dismantlingDate,
            ':status'           => $status,
            ':notes'            => $notes,
            ':floor_plan_url'   => $floorPlanUrl,
            ':updated_at'       => $now,
            ':id'               => $id,
        ]);

        // Audit Log
        $logStmt = $pdo->prepare("
            INSERT INTO activity_logs (id, booth_id, action_type, actor_label, description)
            VALUES (:id, NULL, 'event_updated', 'Master Admin', :desc)
        ");
        $logStmt->execute([
            ':id'   => bin2hex(random_bytes(16)),
            ':desc' => "Updated exhibition event '{$name}'."
        ]);

        $getStmt = $pdo->prepare("SELECT * FROM events WHERE id = :id");
        $getStmt->execute([':id' => $id]);
        $updated = $getStmt->fetch();

        reworkzone_json_response([
            'success' => true,
            'message' => 'Event updated successfully.',
            'event'   => $updated
        ]);
    }

    // ---------------------------------------------------------------------
    // 2C. ARCHIVE EVENT (Safe Archiving, Never Destructive)
    // ---------------------------------------------------------------------
    if ($action === 'archive') {
        $id = trim($body['id'] ?? ($_GET['id'] ?? ''));

        if (empty($id)) {
            reworkzone_json_response(['success' => false, 'error' => 'Event ID is required.'], 400);
        }

        $check = $pdo->prepare("SELECT id, name FROM events WHERE id = :id");
        $check->execute([':id' => $id]);
        $existing = $check->fetch();

        if (!$existing) {
            reworkzone_json_response(['success' => false, 'error' => 'Event not found.'], 404);
        }

        $now = date('Y-m-d H:i:s');
        $stmt = $pdo->prepare("UPDATE events SET status = 'archived', updated_at = :now WHERE id = :id");
        $stmt->execute([':now' => $now, ':id' => $id]);

        // Audit Log
        $logStmt = $pdo->prepare("
            INSERT INTO activity_logs (id, booth_id, action_type, actor_label, description)
            VALUES (:id, NULL, 'event_archived', 'Master Admin', :desc)
        ");
        $logStmt->execute([
            ':id'   => bin2hex(random_bytes(16)),
            ':desc' => "Archived exhibition event '{$existing['name']}'."
        ]);

        reworkzone_json_response([
            'success' => true,
            'message' => "Event '{$existing['name']}' archived successfully."
        ]);
    }

    // ---------------------------------------------------------------------
    // 2D. DELETE EVENT (Destructive with Safe Transaction & Foreign Keys)
    // ---------------------------------------------------------------------
    if ($action === 'delete') {
        $id = trim($body['id'] ?? ($_GET['id'] ?? ''));

        if (empty($id)) {
            reworkzone_json_response(['success' => false, 'error' => 'Event ID is required.'], 400);
        }

        $check = $pdo->prepare("SELECT id, name FROM events WHERE id = :id");
        $check->execute([':id' => $id]);
        $existing = $check->fetch();

        if (!$existing) {
            reworkzone_json_response(['success' => false, 'error' => 'Event not found.'], 404);
        }

        $pdo->beginTransaction();
        try {
            $bStmt = $pdo->prepare("SELECT id FROM booths WHERE event_id = :event_id");
            $bStmt->execute([':event_id' => $id]);
            $boothIds = $bStmt->fetchAll(PDO::FETCH_COLUMN);

            $boothCount = count($boothIds);
            if ($boothCount > 0) {
                $placeholders = implode(',', array_fill(0, $boothCount, '?'));

                $delExp = $pdo->prepare("DELETE FROM booth_expenses WHERE booth_id IN ($placeholders)");
                $delExp->execute($boothIds);

                $delItm = $pdo->prepare("DELETE FROM booth_items WHERE booth_id IN ($placeholders)");
                $delItm->execute($boothIds);

                $delLnk = $pdo->prepare("DELETE FROM booth_links WHERE booth_id IN ($placeholders)");
                $delLnk->execute($boothIds);

                $delTsk = $pdo->prepare("DELETE FROM booth_tasks WHERE booth_id IN ($placeholders)");
                $delTsk->execute($boothIds);

                $updAct = $pdo->prepare("UPDATE activity_logs SET booth_id = NULL WHERE booth_id IN ($placeholders)");
                $updAct->execute($boothIds);

                $delBth = $pdo->prepare("DELETE FROM booths WHERE id IN ($placeholders)");
                $delBth->execute($boothIds);
            }

            $delEvt = $pdo->prepare("DELETE FROM events WHERE id = :id");
            $delEvt->execute([':id' => $id]);

            $logStmt = $pdo->prepare("
                INSERT INTO activity_logs (id, booth_id, action_type, actor_label, description)
                VALUES (:id, NULL, 'event_deleted', 'Master Admin', :desc)
            ");
            $logStmt->execute([
                ':id'   => bin2hex(random_bytes(16)),
                ':desc' => "Permanently deleted exhibition event '{$existing['name']}' with {$boothCount} associated stall(s)."
            ]);

            $pdo->commit();

            reworkzone_json_response([
                'success'              => true,
                'message'              => "Event '{$existing['name']}' and {$boothCount} associated stall(s) deleted permanently.",
                'deleted_id'           => $id,
                'booths_deleted_count' => $boothCount
            ]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            error_log('Event delete error: ' . $e->getMessage());
            reworkzone_json_response(['success' => false, 'error' => 'Failed to delete event: ' . $e->getMessage()], 500);
        }
    }

    reworkzone_json_response(['success' => false, 'error' => 'Invalid action.'], 400);
}

// =========================================================================
// 3. DELETE: Delete single event by ID
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
        reworkzone_json_response(['success' => false, 'error' => 'Event ID is required.'], 400);
    }

    $check = $pdo->prepare("SELECT id, name FROM events WHERE id = :id");
    $check->execute([':id' => $id]);
    $existing = $check->fetch();

    if (!$existing) {
        reworkzone_json_response(['success' => false, 'error' => 'Event not found.'], 404);
    }

    $pdo->beginTransaction();
    try {
        $bStmt = $pdo->prepare("SELECT id FROM booths WHERE event_id = :event_id");
        $bStmt->execute([':event_id' => $id]);
        $boothIds = $bStmt->fetchAll(PDO::FETCH_COLUMN);

        $boothCount = count($boothIds);
        if ($boothCount > 0) {
            $placeholders = implode(',', array_fill(0, $boothCount, '?'));

            $delExp = $pdo->prepare("DELETE FROM booth_expenses WHERE booth_id IN ($placeholders)");
            $delExp->execute($boothIds);

            $delItm = $pdo->prepare("DELETE FROM booth_items WHERE booth_id IN ($placeholders)");
            $delItm->execute($boothIds);

            $delLnk = $pdo->prepare("DELETE FROM booth_links WHERE booth_id IN ($placeholders)");
            $delLnk->execute($boothIds);

            $delTsk = $pdo->prepare("DELETE FROM booth_tasks WHERE booth_id IN ($placeholders)");
            $delTsk->execute($boothIds);

            $updAct = $pdo->prepare("UPDATE activity_logs SET booth_id = NULL WHERE booth_id IN ($placeholders)");
            $updAct->execute($boothIds);

            $delBth = $pdo->prepare("DELETE FROM booths WHERE id IN ($placeholders)");
            $delBth->execute($boothIds);
        }

        $delEvt = $pdo->prepare("DELETE FROM events WHERE id = :id");
        $delEvt->execute([':id' => $id]);

        $logStmt = $pdo->prepare("
            INSERT INTO activity_logs (id, booth_id, action_type, actor_label, description)
            VALUES (:id, NULL, 'event_deleted', 'Master Admin', :desc)
        ");
        $logStmt->execute([
            ':id'   => bin2hex(random_bytes(16)),
            ':desc' => "Permanently deleted exhibition event '{$existing['name']}' with {$boothCount} associated stall(s)."
        ]);

        $pdo->commit();

        reworkzone_json_response([
            'success'              => true,
            'message'              => "Event '{$existing['name']}' and {$boothCount} associated stall(s) deleted permanently.",
            'deleted_id'           => $id,
            'booths_deleted_count' => $boothCount
        ]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('Event delete error: ' . $e->getMessage());
        reworkzone_json_response(['success' => false, 'error' => 'Failed to delete event: ' . $e->getMessage()], 500);
    }
}

reworkzone_json_response(['success' => false, 'error' => 'Method not allowed.'], 405);
