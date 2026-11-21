<?php
require_once __DIR__ . '/../manage/api/config.php';

$db = reworkzone_get_db();

// Check if Long Event already exists
$stmt = $db->prepare("SELECT id FROM events WHERE name = 'Mega Global Expo 2026'");
$stmt->execute();
$existing = $stmt->fetch(PDO::FETCH_ASSOC);

if ($existing) {
    $eventId = $existing['id'];
    echo "Found existing event: $eventId\n";
} else {
    $eventId = 'evt_' . bin2hex(random_bytes(6));
    $stmt = $db->prepare("
        INSERT INTO events (id, name, venue, city, start_date, end_date, status, notes)
        VALUES (?, 'Mega Global Expo 2026', 'Bharat Mandapam Hall 1-5', 'New Delhi', '2026-11-20', '2026-11-25', 'upcoming', 'Major international exhibition with 30+ turnkey client stalls')
    ");
    $stmt->execute([$eventId]);
    echo "Created event: $eventId\n";
}

// Check how many booths exist for this event
$stmt = $db->prepare("SELECT count(*) FROM booths WHERE event_id = ?");
$stmt->execute([$eventId]);
$boothCount = (int)$stmt->fetchColumn();

if ($boothCount < 25) {
    echo "Seeding booths (currently $boothCount)...\n";
    $companies = [
        'Acrobat Engineering', 'BlueWave Robotics', 'Cybernetica Systems', 'DataPulse Analytics',
        'EchoPoint Displays', 'FiberCore Network', 'GigaVolt Power', 'Hyperion Dynamics',
        'InfiniTech Solutions', 'Jupiter Cloud Infra', 'Krypton Interactive', 'Luminary Media',
        'Mirage Holographics', 'NovaTech Fabrication', 'OmniPlatform Systems', 'PulseWave Audio',
        'QuantumLeap AI', 'Radiant Lighting Co', 'Starlight Media Solutions', 'TerraFirma Exhibits',
        'Ultraviolet Visuals', 'Vertex Precision Tools', 'Waveform Acoustics', 'XenoTech Hardware',
        'YieldMaster Displays', 'Zenith Turnkey Expo'
    ];

    $wallConfigs = ['3 Sides', 'Back + Left', 'Back + Right', 'Back Wall Only'];
    $types = ['Wooden', 'Frame', 'Customize'];

    foreach ($companies as $idx => $company) {
        $num = sprintf("%02d", $idx + 1);
        $boothNum = "M-$num";

        // Check if booth already exists
        $stmtCheck = $db->prepare("SELECT id FROM booths WHERE event_id = ? AND booth_number = ?");
        $stmtCheck->execute([$eventId, $boothNum]);
        $existingBooth = $stmtCheck->fetch(PDO::FETCH_ASSOC);

        if ($existingBooth) {
            $bthId = $existingBooth['id'];
        } else {
            $bthId = 'bth_' . bin2hex(random_bytes(6));
            $wall = $wallConfigs[$idx % count($wallConfigs)];
            $type = $types[$idx % count($types)];
            $size = (($idx % 3) + 3) . " × " . (($idx % 2) + 3) . " m";

            $stmtInsert = $db->prepare("
                INSERT INTO booths (id, event_id, booth_number, client_name, stand_size, booth_type, wall_configuration, booking_stage, phone)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', '9876543210')
            ");
            $stmtInsert->execute([$bthId, $eventId, $boothNum, $company, $size, $type, $wall]);
        }

        // Check tasks for this booth
        $stmtTaskCheck = $db->prepare("SELECT count(*) FROM booth_tasks WHERE booth_id = ?");
        $stmtTaskCheck->execute([$bthId]);
        if ((int)$stmtTaskCheck->fetchColumn() === 0) {
            $sections = ['Design', 'Print Files', 'Production', 'Furniture', 'Electrical'];
            foreach ($sections as $sIdx => $sec) {
                $status = ($idx % 3 === 0) ? 'completed' : (($idx % 2 === 0 && $sIdx < 2) ? 'completed' : 'pending');
                $isComp = ($status === 'completed') ? 1 : 0;
                $tId = 'tsk_' . bin2hex(random_bytes(6));
                $stmtTask = $db->prepare("
                    INSERT INTO booth_tasks (id, booth_id, phase, task_name, sort_order, display_order, is_completed, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ");
                $stmtTask->execute([$tId, $bthId, $sec, $sec, $sIdx + 1, $sIdx + 1, $isComp, $status]);
            }
        }
    }
    echo "Finished seeding stalls for Mega Global Expo 2026.\n";
} else {
    echo "Event already has $boothCount stalls.\n";
}

echo "EVENT_ID=$eventId\n";
