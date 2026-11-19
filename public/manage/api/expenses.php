<?php
/**
 * Reworkzone Stalls Operations System - Booth Costing & Expenses API
 *
 * Manages itemized fabrication, print, furniture, electrical, transport,
 * and labor costs. Calculates total estimated vs. actual expenses and variance.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth-helper.php';

// Authenticate session
$auth = reworkzone_require_auth();
$pdo = reworkzone_get_db();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

$validCategories = [
    'printing',
    'structure',
    'furniture',
    'electrical',
    'transport',
    'labor',
    'other',
];

// -------------------------------------------------------------
// GET: Fetch all expenses & summary metrics for a booth
// -------------------------------------------------------------
if ($method === 'GET') {
    $boothId = trim($_GET['booth_id'] ?? '');

    if (empty($boothId)) {
        reworkzone_json_response(['success' => false, 'error' => 'Booth ID is required.'], 400);
    }

    // Verify booth exists
    $bCheck = $pdo->prepare("SELECT id, booth_number, client_name, budget, quoted_amount FROM booths WHERE id = :id");
    $bCheck->execute([':id' => $boothId]);
    $booth = $bCheck->fetch();

    if (!$booth) {
        reworkzone_json_response(['success' => false, 'error' => 'Booth not found.'], 404);
    }

    $stmt = $pdo->prepare("
        SELECT id, booth_id, category, description,
               estimated_cost, actual_cost, amount,
               vendor_name, paid_to, payment_status, is_paid,
               notes, created_at, updated_at
        FROM booth_expenses
        WHERE booth_id = :booth_id
        ORDER BY created_at ASC
    ");
    $stmt->execute([':booth_id' => $boothId]);
    $expenses = $stmt->fetchAll();

    $totalEstimated = 0.0;
    $totalActual = 0.0;

    foreach ($expenses as &$exp) {
        $est = (float)($exp['estimated_cost'] ?? 0.0);
        $act = (float)($exp['actual_cost'] ?? $exp['amount'] ?? 0.0);
        $totalEstimated += $est;
        $totalActual += $act;

        // Normalise fields
        $exp['estimated_cost'] = $est;
        $exp['actual_cost'] = $act;
        $exp['vendor_name'] = $exp['vendor_name'] ?: $exp['paid_to'] ?: '';
    }
    unset($exp);

    $variance = $totalActual - $totalEstimated;

    reworkzone_json_response([
        'success'         => true,
        'booth'           => $booth,
        'total_estimated' => round($totalEstimated, 2),
        'total_actual'    => round($totalActual, 2),
        'variance'        => round($variance, 2),
        'expense_count'   => count($expenses),
        'expenses'        => $expenses,
    ]);
}

// -------------------------------------------------------------
// POST: Actions (create, update, delete)
// -------------------------------------------------------------
if ($method === 'POST') {
    reworkzone_verify_csrf();

    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true) ?? [];

    // Helper to validate nonnegative finite number
    $validateCost = function ($val, string $fieldName) {
        if ($val === null || $val === '') {
            return 0.0;
        }
        if (!is_numeric($val) || !is_finite((float)$val) || (float)$val < 0) {
            reworkzone_json_response([
                'success' => false,
                'error'   => "The {$fieldName} must be a valid non-negative number.",
            ], 400);
        }
        return round((float)$val, 2);
    };

    // 1. CREATE EXPENSE
    if ($action === 'create') {
        $boothId = trim($data['booth_id'] ?? '');
        $category = trim($data['category'] ?? 'other');
        $description = trim($data['description'] ?? '');
        $estimatedCost = $validateCost($data['estimated_cost'] ?? 0, 'Estimated cost');
        $actualCost = $validateCost($data['actual_cost'] ?? 0, 'Actual cost');
        $vendorName = trim($data['vendor_name'] ?? '');
        $paymentStatus = trim($data['payment_status'] ?? 'unpaid');
        $notes = trim($data['notes'] ?? '');

        if (empty($boothId) || empty($description)) {
            reworkzone_json_response(['success' => false, 'error' => 'Booth ID and description are required.'], 400);
        }

        // Verify booth
        $bCheck = $pdo->prepare("SELECT id FROM booths WHERE id = :id");
        $bCheck->execute([':id' => $boothId]);
        if (!$bCheck->fetch()) {
            reworkzone_json_response(['success' => false, 'error' => 'Booth not found.'], 404);
        }

        $isPaid = ($paymentStatus === 'paid') ? 1 : 0;
        $id = 'exp_' . bin2hex(random_bytes(6));

        $stmt = $pdo->prepare("
            INSERT INTO booth_expenses (
                id, booth_id, category, description,
                estimated_cost, actual_cost, amount,
                vendor_name, paid_to, payment_status, is_paid,
                notes, created_at, updated_at
            ) VALUES (
                :id, :booth_id, :category, :description,
                :estimated_cost, :actual_cost, :amount,
                :vendor_name, :paid_to, :payment_status, :is_paid,
                :notes, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
        ");
        $stmt->execute([
            ':id'             => $id,
            ':booth_id'       => $boothId,
            ':category'       => $category,
            ':description'    => $description,
            ':estimated_cost' => $estimatedCost,
            ':actual_cost'    => $actualCost,
            ':amount'         => $actualCost,
            ':vendor_name'    => $vendorName ?: null,
            ':paid_to'        => $vendorName ?: null,
            ':payment_status' => $paymentStatus,
            ':is_paid'        => $isPaid,
            ':notes'          => $notes ?: null,
        ]);

        reworkzone_log_activity($pdo, $boothId, 'expense_created', "Added expense: {$description} (₹{$actualCost})");

        $freshStmt = $pdo->prepare("SELECT * FROM booth_expenses WHERE id = :id");
        $freshStmt->execute([':id' => $id]);
        $created = $freshStmt->fetch();

        reworkzone_json_response(['success' => true, 'expense' => $created], 201);
    }

    // 2. UPDATE EXPENSE
    if ($action === 'update') {
        $id = trim($data['id'] ?? '');
        $category = trim($data['category'] ?? '');
        $description = trim($data['description'] ?? '');
        $estimatedCost = $validateCost($data['estimated_cost'] ?? 0, 'Estimated cost');
        $actualCost = $validateCost($data['actual_cost'] ?? 0, 'Actual cost');
        $vendorName = trim($data['vendor_name'] ?? '');
        $paymentStatus = trim($data['payment_status'] ?? 'unpaid');
        $notes = trim($data['notes'] ?? '');

        if (empty($id) || empty($description)) {
            reworkzone_json_response(['success' => false, 'error' => 'Expense ID and description are required.'], 400);
        }

        $exStmt = $pdo->prepare("SELECT id, booth_id FROM booth_expenses WHERE id = :id");
        $exStmt->execute([':id' => $id]);
        $existing = $exStmt->fetch();

        if (!$existing) {
            reworkzone_json_response(['success' => false, 'error' => 'Expense record not found.'], 404);
        }

        $isPaid = ($paymentStatus === 'paid') ? 1 : 0;

        $updateStmt = $pdo->prepare("
            UPDATE booth_expenses
            SET category = COALESCE(NULLIF(:category, ''), category),
                description = :description,
                estimated_cost = :estimated_cost,
                actual_cost = :actual_cost,
                amount = :amount,
                vendor_name = :vendor_name,
                paid_to = :paid_to,
                payment_status = :payment_status,
                is_paid = :is_paid,
                notes = :notes,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
        ");
        $updateStmt->execute([
            ':category'       => $category,
            ':description'    => $description,
            ':estimated_cost' => $estimatedCost,
            ':actual_cost'    => $actualCost,
            ':amount'         => $actualCost,
            ':vendor_name'    => $vendorName ?: null,
            ':paid_to'        => $vendorName ?: null,
            ':payment_status' => $paymentStatus,
            ':is_paid'        => $isPaid,
            ':notes'          => $notes ?: null,
            ':id'             => $id,
        ]);

        reworkzone_log_activity($pdo, $existing['booth_id'], 'expense_updated', "Updated expense: {$description}");

        $freshStmt = $pdo->prepare("SELECT * FROM booth_expenses WHERE id = :id");
        $freshStmt->execute([':id' => $id]);

        reworkzone_json_response(['success' => true, 'expense' => $freshStmt->fetch()]);
    }

    // 3. DELETE EXPENSE
    if ($action === 'delete') {
        $id = trim($data['id'] ?? '');
        if (empty($id)) {
            reworkzone_json_response(['success' => false, 'error' => 'Expense ID is required.'], 400);
        }

        $exStmt = $pdo->prepare("SELECT id, booth_id, description FROM booth_expenses WHERE id = :id");
        $exStmt->execute([':id' => $id]);
        $existing = $exStmt->fetch();

        if (!$existing) {
            reworkzone_json_response(['success' => false, 'error' => 'Expense record not found.'], 404);
        }

        $delStmt = $pdo->prepare("DELETE FROM booth_expenses WHERE id = :id");
        $delStmt->execute([':id' => $id]);

        reworkzone_log_activity($pdo, $existing['booth_id'], 'expense_deleted', "Deleted expense: {$existing['description']}");

        reworkzone_json_response(['success' => true, 'message' => 'Expense removed successfully.']);
    }

    reworkzone_json_response(['success' => false, 'error' => 'Invalid action.'], 400);
}

reworkzone_json_response(['success' => false, 'error' => 'Method not allowed.'], 405);
