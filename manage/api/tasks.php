<?php
/**
 * Reworkzone Stalls Operations System - Booth Tasks & Checklist API
 *
 * Manages 10-step default execution checklist, custom tasks,
 * completion timestamps, and auto-calculated progress metrics.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth-helper.php';

// Authenticate session
$auth = reworkzone_require_auth();
$pdo = reworkzone_get_db();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Core 4 Checklist Tasks (Simple Everyday Operations)
$defaultTasks = [
    'Print Files & Design',
    'Production',
    'Furniture',
    'Electrical',
];

// Helper: Seed 6 default tasks if booth has 0 tasks
function reworkzone_seed_default_tasks(PDO $pdo, string $boothId, array $defaultTasks) {
    $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM booth_tasks WHERE booth_id = :booth_id");
    $checkStmt->execute([':booth_id' => $boothId]);
    $count = (int)$checkStmt->fetchColumn();

    if ($count === 0) {
        $insertStmt = $pdo->prepare("
            INSERT INTO booth_tasks (id, booth_id, phase, task_name, sort_order, display_order, is_completed, status, created_at, updated_at)
            VALUES (:id, :booth_id, :phase, :task_name, :sort_order, :display_order, 0, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ");

        $pdo->beginTransaction();
        try {
            foreach ($defaultTasks as $idx => $taskName) {
                $taskId = 'tsk_' . bin2hex(random_bytes(6));
                $order = $idx + 1;
                $phase = $taskName;
                $insertStmt->execute([
                    ':id'            => $taskId,
                    ':booth_id'      => $boothId,
                    ':phase'         => $phase,
                    ':task_name'     => $taskName,
                    ':sort_order'    => $order,
                    ':display_order' => $order,
                ]);
            }
            $pdo->commit();
            reworkzone_log_activity($pdo, $boothId, 'checklist_initialized', 'Default 6-step checklist initialized');
        } catch (Exception $e) {
            $pdo->rollBack();
            error_log('Failed to seed default tasks: ' . $e->getMessage());
        }
    }
}

// -------------------------------------------------------------
// GET: Fetch tasks and checklist progress metrics for a booth
// -------------------------------------------------------------
if ($method === 'GET') {
    $boothId = trim($_GET['booth_id'] ?? '');

    if (empty($boothId)) {
        reworkzone_json_response(['success' => false, 'error' => 'Booth ID is required.'], 400);
    }

    // Verify booth exists
    $boothCheck = $pdo->prepare("SELECT id, booth_number, client_name FROM booths WHERE id = :id");
    $boothCheck->execute([':id' => $boothId]);
    $booth = $boothCheck->fetch();

    if (!$booth) {
        reworkzone_json_response(['success' => false, 'error' => 'Booth not found.'], 404);
    }

    // Seed if empty
    reworkzone_seed_default_tasks($pdo, $boothId, $defaultTasks);

    // Fetch tasks ordered by sort_order (excluding legacy installation tasks)
    $stmt = $pdo->prepare("
        SELECT id, booth_id, phase, task_name, assigned_to, completed_by, is_completed, status, completed_at, due_date, notes, sort_order, display_order, created_at, updated_at
        FROM booth_tasks
        WHERE booth_id = :booth_id AND LOWER(task_name) NOT LIKE '%install%' AND LOWER(task_name) != 'design' AND LOWER(task_name) != 'design approved'
        ORDER BY sort_order ASC, created_at ASC
    ");
    $stmt->execute([':booth_id' => $boothId]);
    $tasks = $stmt->fetchAll();

    $total = count($tasks);
    $applicable = 0;
    $completed = 0;
    $na = 0;
    $pending = 0;
    foreach ($tasks as &$t) {
        // Normalize status
        if (empty($t['status'])) {
            $t['status'] = ((int)$t['is_completed'] === 1) ? 'completed' : 'pending';
        }
        if ($t['status'] === 'not_applicable') {
            $na++;
            $t['is_completed'] = 0; // Enforce mutual exclusivity
        } else {
            $applicable++;
            if ($t['status'] === 'completed' || (int)$t['is_completed'] === 1) {
                $completed++;
            } else {
                $pending++;
            }
        }
    }
    unset($t);

    $percentage = $applicable > 0 ? round(($completed / $applicable) * 100, 1) : 0.0;

    reworkzone_json_response([
        'success'          => true,
        'booth'            => $booth,
        'total'            => $total,
        'applicable_count' => $applicable,
        'completed'        => $completed,
        'na_count'         => $na,
        'pending_count'    => $pending,
        'percentage'       => $percentage,
        'tasks'            => $tasks,
    ]);
}

// -------------------------------------------------------------
// POST: Actions (toggle, create, update, delete)
// -------------------------------------------------------------
if ($method === 'POST') {
    reworkzone_verify_csrf();

    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true) ?? [];

    // 1. TOGGLE TASK COMPLETION
    if ($action === 'toggle') {
        $taskId = trim($data['id'] ?? '');
        if (empty($taskId)) {
            reworkzone_json_response(['success' => false, 'error' => 'Task ID is required.'], 400);
        }

        $taskStmt = $pdo->prepare("SELECT id, booth_id, task_name, is_completed, status FROM booth_tasks WHERE id = :id");
        $taskStmt->execute([':id' => $taskId]);
        $task = $taskStmt->fetch();

        if (!$task) {
            reworkzone_json_response(['success' => false, 'error' => 'Task not found.'], 404);
        }

        // Prevent toggling a Not Required (N/A) task directly to completed
        if ($task['status'] === 'not_applicable') {
            reworkzone_json_response(['success' => false, 'error' => 'Cannot mark a Not Required (N/A) task as completed. Clear N/A first.'], 400);
        }

        $newCompleted = (int)$task['is_completed'] === 1 ? 0 : 1;
        $completedAt = $newCompleted === 1 ? date('Y-m-d H:i:s') : null;
        $completedBy = $newCompleted === 1 ? 'Master' : null;
        $newStatus = $newCompleted === 1 ? 'completed' : 'pending';

        $updateStmt = $pdo->prepare("
            UPDATE booth_tasks
            SET is_completed = :is_completed, status = :status, completed_at = :completed_at, completed_by = :completed_by, updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
        ");
        $updateStmt->execute([
            ':is_completed' => $newCompleted,
            ':status'       => $newStatus,
            ':completed_at' => $completedAt,
            ':completed_by' => $completedBy,
            ':id'           => $taskId,
        ]);

        $logAction = $newCompleted === 1 ? 'task_completed' : 'task_reopened';
        $logDesc = ($newCompleted === 1 ? 'Completed' : 'Reopened') . " task: {$task['task_name']}";
        reworkzone_log_activity($pdo, $task['booth_id'], $logAction, $logDesc);

        // Fetch refreshed task
        $freshStmt = $pdo->prepare("SELECT * FROM booth_tasks WHERE id = :id");
        $freshStmt->execute([':id' => $taskId]);
        $refreshed = $freshStmt->fetch();

        // Calculate refreshed stats for the booth (applicable only, excluding legacy installation)
        $allTasksStmt = $pdo->prepare("SELECT is_completed, status FROM booth_tasks WHERE booth_id = :b_id AND LOWER(task_name) NOT LIKE '%install%' AND LOWER(task_name) != 'design' AND LOWER(task_name) != 'design approved'");
        $allTasksStmt->execute([':b_id' => $task['booth_id']]);
        $bTasks = $allTasksStmt->fetchAll();

        $total = count($bTasks);
        $applicable = 0;
        $completed = 0;
        $na = 0;
        $pending = 0;
        foreach ($bTasks as $bt) {
            $st = !empty($bt['status']) ? $bt['status'] : ((int)$bt['is_completed'] === 1 ? 'completed' : 'pending');
            if ($st === 'not_applicable') {
                $na++;
            } else {
                $applicable++;
                if ($st === 'completed' || (int)$bt['is_completed'] === 1) {
                    $completed++;
                } else {
                    $pending++;
                }
            }
        }
        $percentage = $applicable > 0 ? round(($completed / $applicable) * 100, 1) : 0.0;

        reworkzone_json_response([
            'success'          => true,
            'task'             => $refreshed,
            'total'            => $total,
            'applicable_count' => $applicable,
            'completed'        => $completed,
            'na_count'         => $na,
            'pending_count'    => $pending,
            'percentage'       => $percentage,
            'message'          => "Task status updated successfully.",
        ]);
    }

    // 1B. SET TASK STATUS (Pending, Completed, Not Applicable)
    if ($action === 'set_status') {
        $taskId = trim($data['id'] ?? '');
        $status = trim($data['status'] ?? 'pending');

        if (empty($taskId)) {
            reworkzone_json_response(['success' => false, 'error' => 'Task ID is required.'], 400);
        }

        if (!in_array($status, ['pending', 'completed', 'not_applicable'], true)) {
            $status = 'pending';
        }

        $taskStmt = $pdo->prepare("SELECT id, booth_id, task_name, is_completed, status FROM booth_tasks WHERE id = :id");
        $taskStmt->execute([':id' => $taskId]);
        $task = $taskStmt->fetch();

        if (!$task) {
            reworkzone_json_response(['success' => false, 'error' => 'Task not found.'], 404);
        }

        $isCompleted = ($status === 'completed') ? 1 : 0;
        $completedAt = ($status === 'completed') ? date('Y-m-d H:i:s') : null;
        $completedBy = ($status === 'completed') ? 'Master' : null;

        $updateStmt = $pdo->prepare("
            UPDATE booth_tasks
            SET is_completed = :is_completed, status = :status, completed_at = :completed_at, completed_by = :completed_by, updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
        ");
        $updateStmt->execute([
            ':is_completed' => $isCompleted,
            ':status'       => $status,
            ':completed_at' => $completedAt,
            ':completed_by' => $completedBy,
            ':id'           => $taskId,
        ]);

        $logDesc = "Set task '{$task['task_name']}' status to {$status}";
        reworkzone_log_activity($pdo, $task['booth_id'], 'task_status_changed', $logDesc);

        // Fetch refreshed task
        $freshStmt = $pdo->prepare("SELECT * FROM booth_tasks WHERE id = :id");
        $freshStmt->execute([':id' => $taskId]);
        $refreshed = $freshStmt->fetch();

        // Calculate refreshed stats for the booth (excluding legacy installation)
        $allTasksStmt = $pdo->prepare("SELECT is_completed, status FROM booth_tasks WHERE booth_id = :b_id AND LOWER(task_name) NOT LIKE '%install%' AND LOWER(task_name) != 'design' AND LOWER(task_name) != 'design approved'");
        $allTasksStmt->execute([':b_id' => $task['booth_id']]);
        $bTasks = $allTasksStmt->fetchAll();

        $total = count($bTasks);
        $applicable = 0;
        $completed = 0;
        $na = 0;
        $pending = 0;
        foreach ($bTasks as $bt) {
            $st = !empty($bt['status']) ? $bt['status'] : ((int)$bt['is_completed'] === 1 ? 'completed' : 'pending');
            if ($st === 'not_applicable') {
                $na++;
            } else {
                $applicable++;
                if ($st === 'completed' || (int)$bt['is_completed'] === 1) {
                    $completed++;
                } else {
                    $pending++;
                }
            }
        }
        $percentage = $applicable > 0 ? round(($completed / $applicable) * 100, 1) : 0.0;

        reworkzone_json_response([
            'success'          => true,
            'task'             => $refreshed,
            'total'            => $total,
            'applicable_count' => $applicable,
            'completed'        => $completed,
            'na_count'         => $na,
            'pending_count'    => $pending,
            'percentage'       => $percentage,
            'message'          => "Task marked as " . ($status === 'not_applicable' ? 'Not Required' : str_replace('_', ' ', $status)) . ".",
        ]);
    }

    // 2. CREATE CUSTOM TASK
    if ($action === 'create') {
        $boothId = trim($data['booth_id'] ?? '');
        $taskName = trim($data['task_name'] ?? '');
        $phase = trim($data['phase'] ?? 'General Execution');
        $notes = trim($data['notes'] ?? '');
        $dueDate = trim($data['due_date'] ?? '');

        if (empty($boothId) || empty($taskName)) {
            reworkzone_json_response(['success' => false, 'error' => 'Booth ID and task name are required.'], 400);
        }

        // Verify booth
        $bCheck = $pdo->prepare("SELECT id FROM booths WHERE id = :id");
        $bCheck->execute([':id' => $boothId]);
        if (!$bCheck->fetch()) {
            reworkzone_json_response(['success' => false, 'error' => 'Booth not found.'], 404);
        }

        // Determine next sort order
        $orderStmt = $pdo->prepare("SELECT MAX(sort_order) FROM booth_tasks WHERE booth_id = :booth_id");
        $orderStmt->execute([':booth_id' => $boothId]);
        $maxOrder = (int)$orderStmt->fetchColumn();
        $nextOrder = $maxOrder + 1;

        $taskId = 'tsk_' . bin2hex(random_bytes(6));
        $insertStmt = $pdo->prepare("
            INSERT INTO booth_tasks (id, booth_id, phase, task_name, sort_order, display_order, due_date, notes, is_completed, created_at, updated_at)
            VALUES (:id, :booth_id, :phase, :task_name, :sort_order, :sort_order, :due_date, :notes, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ");
        $insertStmt->execute([
            ':id'         => $taskId,
            ':booth_id'   => $boothId,
            ':phase'      => $phase,
            ':task_name'  => $taskName,
            ':sort_order' => $nextOrder,
            ':due_date'   => !empty($dueDate) ? $dueDate : null,
            ':notes'      => !empty($notes) ? $notes : null,
        ]);

        reworkzone_log_activity($pdo, $boothId, 'task_created', "Added custom task: {$taskName}");

        $freshStmt = $pdo->prepare("SELECT * FROM booth_tasks WHERE id = :id");
        $freshStmt->execute([':id' => $taskId]);
        $createdTask = $freshStmt->fetch();

        reworkzone_json_response(['success' => true, 'task' => $createdTask], 201);
    }

    // 3. UPDATE TASK
    if ($action === 'update') {
        $taskId = trim($data['id'] ?? '');
        $taskName = trim($data['task_name'] ?? '');
        $phase = trim($data['phase'] ?? '');
        $notes = trim($data['notes'] ?? '');
        $dueDate = trim($data['due_date'] ?? '');

        if (empty($taskId) || empty($taskName)) {
            reworkzone_json_response(['success' => false, 'error' => 'Task ID and name are required.'], 400);
        }

        $existingStmt = $pdo->prepare("SELECT id, booth_id FROM booth_tasks WHERE id = :id");
        $existingStmt->execute([':id' => $taskId]);
        $existing = $existingStmt->fetch();

        if (!$existing) {
            reworkzone_json_response(['success' => false, 'error' => 'Task not found.'], 404);
        }

        $updateStmt = $pdo->prepare("
            UPDATE booth_tasks
            SET task_name = :task_name,
                phase = COALESCE(NULLIF(:phase, ''), phase),
                due_date = :due_date,
                notes = :notes,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
        ");
        $updateStmt->execute([
            ':task_name' => $taskName,
            ':phase'     => $phase,
            ':due_date'  => !empty($dueDate) ? $dueDate : null,
            ':notes'     => !empty($notes) ? $notes : null,
            ':id'        => $taskId,
        ]);

        reworkzone_log_activity($pdo, $existing['booth_id'], 'task_updated', "Updated task: {$taskName}");

        $freshStmt = $pdo->prepare("SELECT * FROM booth_tasks WHERE id = :id");
        $freshStmt->execute([':id' => $taskId]);

        reworkzone_json_response(['success' => true, 'task' => $freshStmt->fetch()]);
    }

    // 4. DELETE CUSTOM TASK
    if ($action === 'delete') {
        $taskId = trim($data['id'] ?? '');
        if (empty($taskId)) {
            reworkzone_json_response(['success' => false, 'error' => 'Task ID is required.'], 400);
        }

        $taskStmt = $pdo->prepare("SELECT id, booth_id, task_name FROM booth_tasks WHERE id = :id");
        $taskStmt->execute([':id' => $taskId]);
        $task = $taskStmt->fetch();

        if (!$task) {
            reworkzone_json_response(['success' => false, 'error' => 'Task not found.'], 404);
        }

        $delStmt = $pdo->prepare("DELETE FROM booth_tasks WHERE id = :id");
        $delStmt->execute([':id' => $taskId]);

        reworkzone_log_activity($pdo, $task['booth_id'], 'task_deleted', "Deleted task: {$task['task_name']}");

        reworkzone_json_response(['success' => true, 'message' => 'Task removed successfully.']);
    }

    reworkzone_json_response(['success' => false, 'error' => 'Invalid action.'], 400);
}

reworkzone_json_response(['success' => false, 'error' => 'Method not allowed.'], 405);
