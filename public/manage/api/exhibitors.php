<?php
/**
 * Reworkzone Stalls - Exhibitors Catalogue API
 * 
 * Provides reference catalogue of exhibitors, supports searching,
 * manual exhibitor creation, and updates without affecting active projects.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth-helper.php';

// All requests require authenticated session
$session = reworkzone_require_auth();
$pdo = reworkzone_get_db();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? '';

// -------------------------------------------------------------------------
// 1. GET /manage/api/exhibitors.php — List / Search Exhibitors
// -------------------------------------------------------------------------
if ($method === 'GET') {
    $search  = trim($_GET['search'] ?? '');
    $eventId = trim($_GET['event_id'] ?? '');
    $limit   = isset($_GET['limit']) ? min(300, max(1, (int)$_GET['limit'])) : 200;

    $sql = "SELECT * FROM exhibitors WHERE 1=1";
    $params = [];

    if (!empty($search)) {
        $sql .= " AND (company_name LIKE :search OR booth_number LIKE :search OR contact_person LIKE :search OR city LIKE :search)";
        $params[':search'] = '%' . $search . '%';
    }

    if (!empty($eventId)) {
        $sql .= " AND (event_id = :event_id OR event_id IS NULL)";
        $params[':event_id'] = $eventId;
    }

    $sql .= " ORDER BY company_name COLLATE NOCASE ASC LIMIT " . (int)$limit;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $exhibitors = $stmt->fetchAll();

    reworkzone_json_response([
        'success'    => true,
        'count'      => count($exhibitors),
        'exhibitors' => $exhibitors
    ]);
}

// -------------------------------------------------------------------------
// POST Actions require CSRF protection
// -------------------------------------------------------------------------
if ($method === 'POST') {
    reworkzone_verify_csrf();
    $rawBody = file_get_contents('php://input');
    $body = json_decode($rawBody, true) ?? $_POST;

    // 2A. CREATE EXHIBITOR (Manual addition)
    if ($action === 'create') {
        $companyName   = trim($body['company_name'] ?? '');
        $officialId    = trim($body['official_id'] ?? '');
        $contactPerson = trim($body['contact_person'] ?? '');
        $phone         = trim($body['phone'] ?? '');
        $email         = trim($body['email'] ?? '');
        $websiteUrl    = trim($body['website_url'] ?? '');
        $city          = trim($body['city'] ?? '');
        $tagline       = trim($body['tagline'] ?? '');
        $boothNumber   = trim($body['booth_number'] ?? '');
        $boothCategory = trim($body['booth_category'] ?? '');
        $notes         = trim($body['notes'] ?? '');
        $eventId       = trim($body['event_id'] ?? '');

        if (empty($companyName)) {
            reworkzone_json_response([
                'success' => false,
                'error'   => 'Company name is required.'
            ], 400);
        }

        // Check for duplicate company name
        $check = $pdo->prepare("SELECT id, company_name FROM exhibitors WHERE LOWER(company_name) = LOWER(:name)");
        $check->execute([':name' => $companyName]);
        $existing = $check->fetch();

        if ($existing) {
            reworkzone_json_response([
                'success'   => true,
                'message'   => 'Exhibitor already exists in catalogue.',
                'exhibitor' => $existing,
                'is_existing' => true
            ], 200);
        }

        $id = 'ex_' . bin2hex(random_bytes(8));
        $now = date('Y-m-d H:i:s');

        $stmt = $pdo->prepare("
            INSERT INTO exhibitors (
                id, event_id, company_name, official_id, contact_person, phone,
                email, website_url, city, tagline, booth_number, booth_category,
                notes, source, verified_at, created_at, updated_at
            ) VALUES (
                :id, :event_id, :company_name, :official_id, :contact_person, :phone,
                :email, :website_url, :city, :tagline, :booth_number, :booth_category,
                :notes, 'manual', :verified_at, :created_at, :updated_at
            )
        ");

        $stmt->execute([
            ':id'             => $id,
            ':event_id'       => !empty($eventId) ? $eventId : null,
            ':company_name'   => $companyName,
            ':official_id'    => !empty($officialId) ? $officialId : null,
            ':contact_person' => !empty($contactPerson) ? $contactPerson : null,
            ':phone'          => !empty($phone) ? $phone : null,
            ':email'          => !empty($email) ? $email : null,
            ':website_url'    => !empty($websiteUrl) ? $websiteUrl : null,
            ':city'           => !empty($city) ? $city : null,
            ':tagline'        => !empty($tagline) ? $tagline : null,
            ':booth_number'   => !empty($boothNumber) ? $boothNumber : null,
            ':booth_category' => !empty($boothCategory) ? $boothCategory : null,
            ':notes'          => !empty($notes) ? $notes : null,
            ':verified_at'    => $now,
            ':created_at'     => $now,
            ':updated_at'     => $now,
        ]);

        $get = $pdo->prepare("SELECT * FROM exhibitors WHERE id = :id");
        $get->execute([':id' => $id]);
        $created = $get->fetch();

        reworkzone_json_response([
            'success'   => true,
            'message'   => 'Exhibitor added to catalogue successfully.',
            'exhibitor' => $created
        ], 201);
    }

    // 2B. UPDATE EXHIBITOR
    if ($action === 'update') {
        $id = trim($body['id'] ?? ($_GET['id'] ?? ''));
        if (empty($id)) {
            reworkzone_json_response(['success' => false, 'error' => 'Exhibitor ID is required.'], 400);
        }

        $check = $pdo->prepare("SELECT * FROM exhibitors WHERE id = :id");
        $check->execute([':id' => $id]);
        $existing = $check->fetch();

        if (!$existing) {
            reworkzone_json_response(['success' => false, 'error' => 'Exhibitor not found.'], 404);
        }

        $companyName   = trim($body['company_name'] ?? $existing['company_name']);
        $contactPerson = trim($body['contact_person'] ?? ($existing['contact_person'] ?? ''));
        $phone         = trim($body['phone'] ?? ($existing['phone'] ?? ''));
        $email         = trim($body['email'] ?? ($existing['email'] ?? ''));
        $city          = trim($body['city'] ?? ($existing['city'] ?? ''));
        $notes         = trim($body['notes'] ?? ($existing['notes'] ?? ''));
        $boothNumber   = trim($body['booth_number'] ?? ($existing['booth_number'] ?? ''));
        $boothCategory = trim($body['booth_category'] ?? ($existing['booth_category'] ?? ''));

        if (empty($companyName)) {
            reworkzone_json_response(['success' => false, 'error' => 'Company name is required.'], 400);
        }

        $now = date('Y-m-d H:i:s');
        $stmt = $pdo->prepare("
            UPDATE exhibitors
            SET company_name = :company_name,
                contact_person = :contact_person,
                phone = :phone,
                email = :email,
                city = :city,
                notes = :notes,
                booth_number = :booth_number,
                booth_category = :booth_category,
                updated_at = :now
            WHERE id = :id
        ");

        $stmt->execute([
            ':company_name'   => $companyName,
            ':contact_person' => !empty($contactPerson) ? $contactPerson : null,
            ':phone'          => !empty($phone) ? $phone : null,
            ':email'          => !empty($email) ? $email : null,
            ':city'           => !empty($city) ? $city : null,
            ':notes'          => !empty($notes) ? $notes : null,
            ':booth_number'   => !empty($boothNumber) ? $boothNumber : null,
            ':booth_category' => !empty($boothCategory) ? $boothCategory : null,
            ':now'            => $now,
            ':id'             => $id,
        ]);

        $get = $pdo->prepare("SELECT * FROM exhibitors WHERE id = :id");
        $get->execute([':id' => $id]);
        $updated = $get->fetch();

        reworkzone_json_response([
            'success'   => true,
            'message'   => 'Exhibitor updated successfully.',
            'exhibitor' => $updated
        ]);
    }
}

reworkzone_json_response(['success' => false, 'error' => 'Unsupported action.'], 400);
