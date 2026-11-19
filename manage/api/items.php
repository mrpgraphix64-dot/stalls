<?php
/**
 * Reworkzone Stalls Operations System - Booth Items API
 * 
 * Manages operational requirements for booths across categories:
 * - furniture (tables, chairs, counters, sofas, brochure racks)
 * - electrical (lighting, LED screens, power sockets, extension boards)
 * - production (fabrication elements, structural items, acrylic, woodwork)
 * - print (vinyl prints, fabric banners, foam boards, signage)
 * - av (audio visual equipment, microphones, speakers)
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth-helper.php';

header('Content-Type: application/json; charset=UTF-8');

$pdo = reworkzone_get_db();
$sessionUser = reworkzone_require_master_auth($pdo);

$method = $_SERVER['REQUEST_METHOD'];

// =========================================================================
// 1. GET: Fetch items by booth_id and optional category
// =========================================================================
if ($method === 'GET') {
    $id       = trim($_GET['id'] ?? '');
    $boothId  = trim($_GET['booth_id'] ?? '');
    $category = trim($_GET['category'] ?? '');

    // Single item
    if (!empty($id)) {
        $stmt = $pdo->prepare("SELECT * FROM booth_items WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $id]);
        $item = $stmt->fetch();

        if (!$item) {
            reworkzone_json_response(['success' => false, 'error' => 'Item not found.'], 404);
        }

        reworkzone_json_response(['success' => true, 'item' => $item]);
    }

    // List items for booth
    if (empty($boothId)) {
        reworkzone_json_response(['success' => false, 'error' => 'booth_id parameter is required.'], 400);
    }

    $sql = "SELECT * FROM booth_items WHERE booth_id = :booth_id";
    $params = [':booth_id' => $boothId];

    if (!empty($category) && $category !== 'all') {
        $sql .= " AND category = :category";
        $params[':category'] = $category;
    }

    $sql .= " ORDER BY created_at ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $items = $stmt->fetchAll();

    reworkzone_json_response([
        'success' => true,
        'items'   => $items,
        'count'   => count($items)
    ]);
}

// =========================================================================
// 2. POST: State-changing operations (Create, Update, Toggle, Delete)
// =========================================================================
if ($method === 'POST') {
    reworkzone_verify_csrf();

    $raw = file_get_contents('php://input');
    $body = json_decode($raw, true) ?: $_POST;
    $action = trim($_GET['action'] ?? ($body['action'] ?? 'create'));

    $validCategories = ['furniture', 'electrical', 'production', 'print', 'av', 'goodies', 'promotional', 'other'];

    // ---------------------------------------------------------------------
    // 2A. CREATE ITEM
    // ---------------------------------------------------------------------
    if ($action === 'create') {
        $boothId       = trim($body['booth_id'] ?? '');
        $category      = trim($body['category'] ?? 'other');
        $itemName      = trim($body['item_name'] ?? '');
        $quantity      = isset($body['quantity']) ? (int)$body['quantity'] : 1;
        $unit          = trim($body['unit'] ?? 'nos');
        $specification = trim($body['specification'] ?? '');
        $vendorName    = trim($body['vendor_name'] ?? '');
        $unitCost      = isset($body['unit_cost']) ? (float)$body['unit_cost'] : 0.0;
        $totalCost     = isset($body['total_cost']) ? (float)$body['total_cost'] : ($unitCost * $quantity);
        $isDelivered   = !empty($body['is_delivered']) ? 1 : 0;
        $isInstalled   = !empty($body['is_installed']) ? 1 : 0;
        $notes         = trim($body['notes'] ?? '');

        // Validation
        if (empty($boothId)) {
            reworkzone_json_response(['success' => false, 'error' => 'booth_id is required.'], 400);
        }

        $checkBooth = $pdo->prepare("SELECT id, booth_number FROM booths WHERE id = :booth_id");
        $checkBooth->execute([':booth_id' => $boothId]);
        $booth = $checkBooth->fetch();

        if (!$booth) {
            reworkzone_json_response(['success' => false, 'error' => 'Referenced booth does not exist.'], 400);
        }

        if (empty($itemName)) {
            reworkzone_json_response(['success' => false, 'error' => 'Item name is required.'], 400);
        }

        if (!in_array($category, $validCategories, true)) {
            $category = 'other';
        }

        if ($quantity < 1) {
            reworkzone_json_response(['success' => false, 'error' => 'Quantity must be at least 1.'], 400);
        }

        if (empty($unit)) {
            $unit = 'nos';
        }

        $id = 'itm_' . bin2hex(random_bytes(6));
        $now = date('Y-m-d H:i:s');

        $stmt = $pdo->prepare("
            INSERT INTO booth_items (
                id, booth_id, category, item_name, quantity, unit,
                specification, vendor_name, unit_cost, total_cost,
                is_delivered, is_installed, notes, created_at, updated_at
            ) VALUES (
                :id, :booth_id, :category, :item_name, :quantity, :unit,
                :specification, :vendor_name, :unit_cost, :total_cost,
                :is_delivered, :is_installed, :notes, :created_at, :updated_at
            )
        ");
        $stmt->execute([
            ':id'            => $id,
            ':booth_id'      => $boothId,
            ':category'      => $category,
            ':item_name'     => $itemName,
            ':quantity'      => $quantity,
            ':unit'          => $unit,
            ':specification' => $specification,
            ':vendor_name'   => $vendorName,
            ':unit_cost'     => $unitCost,
            ':total_cost'    => $totalCost,
            ':is_delivered'  => $isDelivered,
            ':is_installed'  => $isInstalled,
            ':notes'         => $notes,
            ':created_at'    => $now,
            ':updated_at'    => $now,
        ]);

        $log = $pdo->prepare("
            INSERT INTO activity_logs (id, booth_id, action_type, actor_label, description)
            VALUES (:id, :booth_id, 'item_added', 'Master Admin', :desc)
        ");
        $log->execute([
            ':id'       => bin2hex(random_bytes(16)),
            ':booth_id' => $boothId,
            ':desc'     => "Added {$category} item '{$itemName}' ({$quantity} {$unit}) to stall '{$booth['booth_number']}'."
        ]);

        $getStmt = $pdo->prepare("SELECT * FROM booth_items WHERE id = :id");
        $getStmt->execute([':id' => $id]);
        $created = $getStmt->fetch();

        reworkzone_json_response([
            'success' => true,
            'message' => 'Item added successfully.',
            'item'    => $created
        ], 201);
    }

    // ---------------------------------------------------------------------
    // 2B. UPDATE ITEM
    // ---------------------------------------------------------------------
    if ($action === 'update') {
        $id = trim($body['id'] ?? ($_GET['id'] ?? ''));

        if (empty($id)) {
            reworkzone_json_response(['success' => false, 'error' => 'Item ID is required.'], 400);
        }

        $check = $pdo->prepare("SELECT * FROM booth_items WHERE id = :id");
        $check->execute([':id' => $id]);
        $existing = $check->fetch();

        if (!$existing) {
            reworkzone_json_response(['success' => false, 'error' => 'Item not found.'], 404);
        }

        $category      = trim($body['category'] ?? $existing['category']);
        $itemName      = trim($body['item_name'] ?? $existing['item_name']);
        $quantity      = isset($body['quantity']) ? (int)$body['quantity'] : (int)$existing['quantity'];
        $unit          = trim($body['unit'] ?? $existing['unit']);
        $specification = trim($body['specification'] ?? $existing['specification']);
        $vendorName    = trim($body['vendor_name'] ?? $existing['vendor_name']);
        $unitCost      = isset($body['unit_cost']) ? (float)$body['unit_cost'] : (float)$existing['unit_cost'];
        $totalCost     = isset($body['total_cost']) ? (float)$body['total_cost'] : ($unitCost * $quantity);
        $isDelivered   = isset($body['is_delivered']) ? ((int)$body['is_delivered'] ? 1 : 0) : (int)$existing['is_delivered'];
        $isInstalled   = isset($body['is_installed']) ? ((int)$body['is_installed'] ? 1 : 0) : (int)$existing['is_installed'];
        $notes         = trim($body['notes'] ?? $existing['notes']);

        if (empty($itemName)) {
            reworkzone_json_response(['success' => false, 'error' => 'Item name is required.'], 400);
        }

        if (!in_array($category, $validCategories, true)) {
            $category = $existing['category'];
        }

        if ($quantity < 1) {
            reworkzone_json_response(['success' => false, 'error' => 'Quantity must be at least 1.'], 400);
        }

        $now = date('Y-m-d H:i:s');
        $stmt = $pdo->prepare("
            UPDATE booth_items
            SET category = :category,
                item_name = :item_name,
                quantity = :quantity,
                unit = :unit,
                specification = :specification,
                vendor_name = :vendor_name,
                unit_cost = :unit_cost,
                total_cost = :total_cost,
                is_delivered = :is_delivered,
                is_installed = :is_installed,
                notes = :notes,
                updated_at = :updated_at
            WHERE id = :id
        ");
        $stmt->execute([
            ':category'      => $category,
            ':item_name'     => $itemName,
            ':quantity'      => $quantity,
            ':unit'          => $unit,
            ':specification' => $specification,
            ':vendor_name'   => $vendorName,
            ':unit_cost'     => $unitCost,
            ':total_cost'    => $totalCost,
            ':is_delivered'  => $isDelivered,
            ':is_installed'  => $isInstalled,
            ':notes'         => $notes,
            ':updated_at'    => $now,
            ':id'            => $id,
        ]);

        $log = $pdo->prepare("
            INSERT INTO activity_logs (id, booth_id, action_type, actor_label, description)
            VALUES (:id, :booth_id, 'item_updated', 'Master Admin', :desc)
        ");
        $log->execute([
            ':id'       => bin2hex(random_bytes(16)),
            ':booth_id' => $existing['booth_id'],
            ':desc'     => "Updated {$category} item '{$itemName}'."
        ]);

        $getStmt = $pdo->prepare("SELECT * FROM booth_items WHERE id = :id");
        $getStmt->execute([':id' => $id]);
        $updated = $getStmt->fetch();

        reworkzone_json_response([
            'success' => true,
            'message' => 'Item updated successfully.',
            'item'    => $updated
        ]);
    }

    // ---------------------------------------------------------------------
    // 2C. TOGGLE READINESS STATUS (1-Click Delivered / Installed)
    // ---------------------------------------------------------------------
    if ($action === 'toggle_status') {
        $id = trim($body['id'] ?? ($_GET['id'] ?? ''));

        if (empty($id)) {
            reworkzone_json_response(['success' => false, 'error' => 'Item ID is required.'], 400);
        }

        $check = $pdo->prepare("SELECT * FROM booth_items WHERE id = :id");
        $check->execute([':id' => $id]);
        $existing = $check->fetch();

        if (!$existing) {
            reworkzone_json_response(['success' => false, 'error' => 'Item not found.'], 404);
        }

        $field = trim($body['field'] ?? 'is_installed');
        if ($field !== 'is_delivered' && $field !== 'is_installed') {
            $field = 'is_installed';
        }

        $currentVal = (int)$existing[$field];
        $newVal = $currentVal ? 0 : 1;
        $now = date('Y-m-d H:i:s');

        $stmt = $pdo->prepare("UPDATE booth_items SET {$field} = :val, updated_at = :now WHERE id = :id");
        $stmt->execute([':val' => $newVal, ':now' => $now, ':id' => $id]);

        $getStmt = $pdo->prepare("SELECT * FROM booth_items WHERE id = :id");
        $getStmt->execute([':id' => $id]);
        $updated = $getStmt->fetch();

        reworkzone_json_response([
            'success' => true,
            'message' => "Item {$field} set to {$newVal}.",
            'item'    => $updated
        ]);
    }

    // ---------------------------------------------------------------------
    // 2D. DELETE ITEM
    // ---------------------------------------------------------------------
    if ($action === 'delete') {
        $id = trim($body['id'] ?? ($_GET['id'] ?? ''));

        if (empty($id)) {
            reworkzone_json_response(['success' => false, 'error' => 'Item ID is required.'], 400);
        }

        $check = $pdo->prepare("SELECT * FROM booth_items WHERE id = :id");
        $check->execute([':id' => $id]);
        $existing = $check->fetch();

        if (!$existing) {
            reworkzone_json_response(['success' => false, 'error' => 'Item not found.'], 404);
        }

        $stmt = $pdo->prepare("DELETE FROM booth_items WHERE id = :id");
        $stmt->execute([':id' => $id]);

        $log = $pdo->prepare("
            INSERT INTO activity_logs (id, booth_id, action_type, actor_label, description)
            VALUES (:id, :booth_id, 'item_deleted', 'Master Admin', :desc)
        ");
        $log->execute([
            ':id'       => bin2hex(random_bytes(16)),
            ':booth_id' => $existing['booth_id'],
            ':desc'     => "Removed item '{$existing['item_name']}' ({$existing['category']})."
        ]);

        reworkzone_json_response([
            'success' => true,
            'message' => "Item '{$existing['item_name']}' removed."
        ]);
    }

    reworkzone_json_response(['success' => false, 'error' => 'Invalid action.'], 400);
}

reworkzone_json_response(['success' => false, 'error' => 'Method not allowed.'], 405);
