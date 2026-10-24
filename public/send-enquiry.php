<?php
/**
 * Reworkzone Exhibition Stalls - Lead Intake & Notification Handler
 * Target Recipient: info@reworkzone.in
 */

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// Read raw JSON body or POST form data
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);
if (!is_array($data)) {
    $data = $_POST;
}

// 1. Spam Honeypot Detection
if (!empty($data['botcheck'])) {
    // Return success to confuse bots without sending email
    echo json_encode(['success' => true, 'message' => 'Enquiry received']);
    exit;
}

// 2. Sanitize and Extract Fields
$fullName    = trim($data['fullName'] ?? $data['name'] ?? '');
$phone       = trim($data['phone'] ?? '');
$email       = trim($data['email'] ?? '');
$boothNumber = trim($data['boothNumber'] ?? $data['booth_number'] ?? '');
$stallSize   = trim($data['stallDimensions'] ?? $data['stall_size'] ?? 'Not specified');
$requirements= trim($data['requirements'] ?? $data['message'] ?? 'None specified');

// 3. Validation
if (empty($fullName) || empty($phone) || empty($email)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Please provide your full name, phone number, and email.']);
    exit;
}

$digitsOnly = preg_replace('/\D/', '', $phone);
if (strlen($digitsOnly) < 10 || strlen($digitsOnly) > 14) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Please enter a valid 10-digit mobile number.']);
    exit;
}

if (preg_match('/^(\d)\1{9,}$/', $digitsOnly)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Please enter a genuine mobile number.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Please provide a valid email address.']);
    exit;
}

// 4. Save to secure local CSV file on Hostinger
$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0755, true);
}

$csvFile = $dataDir . '/enquiries.csv';
$isNewFile = !file_exists($csvFile);

$now = date('Y-m-d H:i:s');
$clientIp = $_SERVER['REMOTE_ADDR'] ?? 'Unknown';

$fp = @fopen($csvFile, 'a');
if ($fp) {
    if ($isNewFile) {
        fputcsv($fp, ['Timestamp', 'Full Name', 'Phone', 'Email', 'Booth No', 'Stall Size', 'Requirements', 'Client IP']);
    }
    fputcsv($fp, [$now, $fullName, $phone, $email, $boothNumber, $stallSize, $requirements, $clientIp]);
    fclose($fp);
}

// 5. Send Notification Email to info@reworkzone.in
$to = 'info@reworkzone.in';
$boothSubjectPart = $boothNumber ? " [Booth: {$boothNumber}]" : '';
$subject = "New Exhibition Stall Enquiry: {$fullName} ({$phone}){$boothSubjectPart}";

// Clean display values for HTML
$safeName        = htmlspecialchars($fullName, ENT_QUOTES, 'UTF-8');
$safePhone       = htmlspecialchars($phone, ENT_QUOTES, 'UTF-8');
$safeEmail       = htmlspecialchars($email, ENT_QUOTES, 'UTF-8');
$safeBooth       = !empty($boothNumber) ? htmlspecialchars($boothNumber, ENT_QUOTES, 'UTF-8') : '<span style="color:#888;">Not specified / Pending</span>';
$safeSize        = htmlspecialchars($stallSize, ENT_QUOTES, 'UTF-8');
$safeReqs        = nl2br(htmlspecialchars($requirements, ENT_QUOTES, 'UTF-8'));

$waLink = "https://wa.me/" . preg_replace('/[^0-9]/', '', $phone);

$htmlBody = <<<HTML
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>New Stall Enquiry</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f7f6f2; margin: 0; padding: 24px; color: #1a1a1a;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e5e5; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #111827; padding: 24px 32px; text-align: left; border-bottom: 3px solid #E53935;">
              <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">
                REWORKZONE <span style="color: #E53935;">STALLS</span>
              </h2>
              <p style="color: #9ca3af; margin: 4px 0 0 0; font-size: 13px;">New Exhibition Stall & Fabrication Inquiry</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="10" style="border-collapse: collapse; font-size: 14px;">
                <tr style="border-bottom: 1px solid #f0f0f0;">
                  <td width="160" style="font-weight: bold; color: #6b7280; text-transform: uppercase; font-size: 12px;">Full Name:</td>
                  <td style="font-size: 15px; font-weight: 700; color: #111827;">{$safeName}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f0f0f0;">
                  <td style="font-weight: bold; color: #6b7280; text-transform: uppercase; font-size: 12px;">Phone / WhatsApp:</td>
                  <td style="color: #111827; font-weight: 600;">
                    <a href="tel:{$safePhone}" style="color: #E53935; text-decoration: none;">{$safePhone}</a>
                    <span style="margin: 0 8px; color: #d1d5db;">|</span>
                    <a href="{$waLink}" style="color: #0f5132; text-decoration: none; font-weight: bold;">Direct WhatsApp Chat &raquo;</a>
                  </td>
                </tr>
                <tr style="border-bottom: 1px solid #f0f0f0;">
                  <td style="font-weight: bold; color: #6b7280; text-transform: uppercase; font-size: 12px;">Work Email:</td>
                  <td><a href="mailto:{$safeEmail}" style="color: #111827; text-decoration: none;">{$safeEmail}</a></td>
                </tr>
                <tr style="border-bottom: 1px solid #f0f0f0;">
                  <td style="font-weight: bold; color: #6b7280; text-transform: uppercase; font-size: 12px;">Booth / Stall No:</td>
                  <td style="font-weight: 700; color: #111827;">{$safeBooth}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f0f0f0;">
                  <td style="font-weight: bold; color: #6b7280; text-transform: uppercase; font-size: 12px;">Stall Dimensions:</td>
                  <td style="color: #111827; font-weight: 600;">{$safeSize}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top: 16px;">
                    <div style="font-weight: bold; color: #6b7280; text-transform: uppercase; font-size: 12px; margin-bottom: 8px;">
                      Event Details & Requirements:
                    </div>
                    <div style="background-color: #FAF9F5; padding: 16px; border-radius: 8px; border: 1px solid #e5e5e5; font-size: 14px; line-height: 1.6; color: #374151;">
                      {$safeReqs}
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Action Bar -->
              <div style="margin-top: 28px; text-align: center;">
                <a href="mailto:{$safeEmail}?subject=Re: Exhibition Stall Proposal - Reworkzone" style="background-color: #E53935; color: #ffffff; padding: 12px 24px; text-decoration: none; font-size: 13px; font-weight: bold; border-radius: 6px; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px;">
                  Reply to Client Directly
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 16px 32px; font-size: 11px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e5e5;">
              Received via stalls.reworkzone.in &bull; {$now} &bull; IP: {$clientIp}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
HTML;

// Email Headers
// Hostinger Mail policy: From and envelope sender (-f) MUST match an active domain mailbox (info@reworkzone.in)
$headers = [];
$headers[] = 'MIME-Version: 1.0';
$headers[] = 'Content-type: text/html; charset=UTF-8';
$headers[] = 'From: Reworkzone Stalls <info@reworkzone.in>';
$headers[] = "Reply-To: {$fullName} <{$email}>";
$headers[] = 'Return-Path: <info@reworkzone.in>';
$headers[] = 'X-Mailer: PHP/' . phpversion();

$additionalParams = '-finfo@reworkzone.in';
$mailSent = @mail($to, $subject, $htmlBody, implode("\r\n", $headers), $additionalParams);
if (!$mailSent) {
    // Fallback attempt without envelope flag if restricted
    $mailSent = @mail($to, $subject, $htmlBody, implode("\r\n", $headers));
}

// Log status to data/mail_status.log for quick troubleshooting
$logFile = $dataDir . '/mail_status.log';
$logEntry = date('Y-m-d H:i:s') . " | To: {$to} | From: {$fullName} ({$phone}) | MailSent: " . ($mailSent ? 'YES' : 'NO') . "\n";
@file_put_contents($logFile, $logEntry, FILE_APPEND);

echo json_encode([
    'success' => true,
    'message' => 'Thank you! Your enquiry has been received.',
    'mailSent' => $mailSent,
]);
