<?php
/**
 * Reworkzone Stalls Portfolio - Private Admin Dashboard
 * URL: stalls.reworkzone.in/admin
 */

session_start();

// ==========================================
// CONFIGURATION
// Default Admin PIN: 8401 (You can change this below)
// ==========================================
define('ADMIN_PIN', '8401');
$csvPath = __DIR__ . '/data/enquiries.csv';

// Handle Logout
if (isset($_GET['action']) && $_GET['action'] === 'logout') {
    $_SESSION['admin_logged_in'] = false;
    session_destroy();
    header('Location: /admin');
    exit;
}

// Handle CSV Download
if (isset($_GET['action']) && $_GET['action'] === 'download') {
    if (empty($_SESSION['admin_logged_in'])) {
        header('Location: /admin');
        exit;
    }
    if (file_exists($csvPath)) {
        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="reworkzone_stall_leads_' . date('Y-m-d') . '.csv"');
        readfile($csvPath);
        exit;
    } else {
        die('No leads data found yet.');
    }
}

// Handle PIN Verification
$loginError = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['pin'])) {
    $enteredPin = trim($_POST['pin']);
    if ($enteredPin === ADMIN_PIN) {
        $_SESSION['admin_logged_in'] = true;
        header('Location: /admin');
        exit;
    } else {
        $loginError = 'Invalid PIN code. Please try again.';
    }
}

$isLoggedIn = !empty($_SESSION['admin_logged_in']);

// Test Email Action for Diagnosing Hostinger Deliverability
$testMailNotice = '';
if ($isLoggedIn && isset($_GET['action']) && $_GET['action'] === 'test_mail') {
    $to = 'info@reworkzone.in';
    $subject = 'Hostinger Mail Delivery Test - ' . date('H:i:s');
    $body = "Hello Team Reworkzone,\n\nThis is a test notification from stalls.reworkzone.in/admin sent at " . date('Y-m-d H:i:s') . ".\n\nHostinger PHP mail is working properly and delivering directly to info@reworkzone.in.";
    $headers = [];
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'Content-type: text/plain; charset=UTF-8';
    $headers[] = 'From: Reworkzone Stalls <info@reworkzone.in>';
    $headers[] = 'Reply-To: info@reworkzone.in';
    $headers[] = 'Return-Path: <info@reworkzone.in>';
    $headers[] = 'X-Mailer: PHP/' . phpversion();

    $sent = @mail($to, $subject, $body, implode("\r\n", $headers), "-finfo@reworkzone.in");
    if (!$sent) {
        $sent = @mail($to, $subject, $body, implode("\r\n", $headers));
    }
    if ($sent) {
        $testMailNotice = 'SUCCESS: Test email successfully sent to info@reworkzone.in! Please check your Hostinger inbox (and Spam folder).';
    } else {
        $testMailNotice = 'NOTE: Hostinger mail() returned false. Please verify that info@reworkzone.in exists in Hostinger Mail and PHP Sendmail is enabled in hPanel.';
    }
}

// If logged in, read CSV records
$leads = [];
if ($isLoggedIn && file_exists($csvPath)) {
    if (($handle = fopen($csvPath, 'r')) !== false) {
        $header = fgetcsv($handle); // Skip header row
        while (($row = fgetcsv($handle)) !== false) {
            if (count($row) >= 7) {
                $leads[] = [
                    'timestamp'    => $row[0] ?? '',
                    'name'         => $row[1] ?? '',
                    'phone'        => $row[2] ?? '',
                    'email'        => $row[3] ?? '',
                    'booth'        => $row[4] ?? '',
                    'stall_size'   => $row[5] ?? '',
                    'requirements' => $row[6] ?? '',
                    'ip'           => $row[7] ?? '',
                ];
            }
        }
        fclose($handle);
    }
    // Reverse to show newest leads first
    $leads = array_reverse($leads);
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Portal &bull; Reworkzone Stalls</title>
  <link rel="icon" type="image/png" href="/favicon.png">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #FAF9F5; }
  </style>
</head>
<body class="min-h-screen text-gray-900 flex flex-col font-sans antialiased">

  <!-- Top Navigation Header -->
  <header class="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <a href="/" class="flex items-center gap-2">
          <img src="/logo.png" alt="Reworkzone" class="h-8 w-auto">
          <span class="text-xs font-bold uppercase tracking-wider text-gray-400 pl-2 border-l border-gray-200 hidden sm:inline">
            Stalls Portal
          </span>
        </a>
      </div>

      <div class="flex items-center gap-3">
        <a href="/" class="text-xs font-semibold text-gray-600 hover:text-red-600 transition-colors">
          &larr; View Website
        </a>
        <?php if ($isLoggedIn): ?>
          <a href="/admin?action=logout" class="text-xs font-bold uppercase px-3.5 py-1.5 bg-gray-100 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors border border-gray-200">
            Sign Out
          </a>
        <?php endif; ?>
      </div>
    </div>
  </header>

  <!-- Main Body -->
  <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

    <?php if (!$isLoggedIn): ?>
      <!-- LOGIN VIEW -->
      <div class="max-w-md mx-auto pt-8 sm:pt-16">
        <div class="bg-white p-8 sm:p-10 rounded-2xl border border-gray-200 shadow-sm text-center">
          
          <div class="w-14 h-14 bg-red-50 text-red-600 rounded-2xl mx-auto flex items-center justify-center mb-5 border border-red-100">
            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
          </div>

          <h2 class="text-2xl font-black text-gray-900 tracking-tight mb-2">Admin Lead Portal</h2>
          <p class="text-xs text-gray-500 mb-6">Enter your security PIN to access exhibition stall enquiries and export data.</p>

          <?php if ($loginError): ?>
            <div class="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
              <?= htmlspecialchars($loginError) ?>
            </div>
          <?php endif; ?>

          <form method="POST" action="/admin" class="space-y-4">
            <div>
              <input
                type="password"
                name="pin"
                autofocus
                required
                maxlength="8"
                placeholder="Enter Security PIN"
                class="w-full text-center text-xl tracking-widest font-mono py-3.5 px-4 bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-none transition-all"
              >
            </div>

            <button
              type="submit"
              class="w-full py-3.5 px-6 bg-gray-900 hover:bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors shadow-sm"
            >
              Verify PIN &amp; Enter
            </button>
          </form>

          <p class="text-[11px] text-gray-400 mt-6">
            Default security PIN: <code class="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 font-mono">8401</code>
          </p>
        </div>
      </div>

    <?php else: ?>
      <!-- DASHBOARD VIEW -->
      <div class="space-y-6">

        <?php if (!empty($testMailNotice)): ?>
          <div class="p-4 rounded-xl <?= strpos($testMailNotice, 'SUCCESS') !== false ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800' ?> border text-xs font-semibold flex items-center justify-between shadow-sm">
            <span><?= htmlspecialchars($testMailNotice) ?></span>
            <a href="/admin" class="underline ml-4 opacity-75 hover:opacity-100">Dismiss</a>
          </div>
        <?php endif; ?>

        <!-- Top Control Bar -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div>
            <h1 class="text-2xl font-black text-gray-900 tracking-tight">Exhibition Stall Enquiries</h1>
            <p class="text-xs text-gray-500 mt-0.5">Real-time leads captured from stalls.reworkzone.in</p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <?= count($leads) ?> Total Leads
            </span>

            <a
              href="/admin?action=test_mail"
              class="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors border border-gray-200"
              title="Send a quick test email to info@reworkzone.in to verify deliverability"
            >
              <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
              <span>Test Mail</span>
            </a>

            <?php if (count($leads) > 0): ?>
              <a
                href="/admin?action=download"
                class="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors shadow-sm"
                title="Download CSV to open in Microsoft Excel or Google Sheets"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                <span>Export to Excel / CSV</span>
              </a>
            <?php endif; ?>
          </div>
        </div>

        <!-- Leads Table -->
        <?php if (count($leads) === 0): ?>
          <div class="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-3 shadow-sm">
            <div class="w-12 h-12 rounded-full bg-gray-100 text-gray-400 mx-auto flex items-center justify-center">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
              </svg>
            </div>
            <h3 class="text-base font-bold text-gray-800">No Enquiries Received Yet</h3>
            <p class="text-xs text-gray-500 max-w-sm mx-auto">
              When clients fill out the enquiry form on the website, their details will instantly appear here and be delivered to info@reworkzone.in.
            </p>
          </div>
        <?php else: ?>
          <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200 text-left text-xs">
                <thead class="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th scope="col" class="py-3.5 px-4">Date / Time</th>
                    <th scope="col" class="py-3.5 px-4">Client Name</th>
                    <th scope="col" class="py-3.5 px-4">Phone / WhatsApp</th>
                    <th scope="col" class="py-3.5 px-4">Email</th>
                    <th scope="col" class="py-3.5 px-4">Booth No.</th>
                    <th scope="col" class="py-3.5 px-4">Stall Size</th>
                    <th scope="col" class="py-3.5 px-4">Requirements</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 bg-white">
                  <?php foreach ($leads as $i => $lead): 
                    $cleanPhone = preg_replace('/[^0-9]/', '', $lead['phone']);
                    $waLink = "https://wa.me/" . $cleanPhone;
                  ?>
                    <tr class="hover:bg-gray-50/80 transition-colors">
                      <!-- Date -->
                      <td class="py-3.5 px-4 whitespace-nowrap text-gray-500 font-mono text-[11px]">
                        <?= htmlspecialchars($lead['timestamp']) ?>
                      </td>

                      <!-- Name -->
                      <td class="py-3.5 px-4 whitespace-nowrap font-bold text-gray-900 text-sm">
                        <?= htmlspecialchars($lead['name']) ?>
                      </td>

                      <!-- Phone -->
                      <td class="py-3.5 px-4 whitespace-nowrap">
                        <div class="flex items-center gap-2">
                          <a href="tel:<?= htmlspecialchars($lead['phone']) ?>" class="font-semibold text-gray-900 hover:text-red-600 transition-colors">
                            <?= htmlspecialchars($lead['phone']) ?>
                          </a>
                          <?php if (!empty($cleanPhone)): ?>
                            <a
                              href="<?= $waLink ?>"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[10px] font-bold transition-colors"
                              title="Open direct WhatsApp conversation"
                            >
                              WhatsApp &raquo;
                            </a>
                          <?php endif; ?>
                        </div>
                      </td>

                      <!-- Email -->
                      <td class="py-3.5 px-4 whitespace-nowrap">
                        <a href="mailto:<?= htmlspecialchars($lead['email']) ?>" class="text-blue-600 hover:underline">
                          <?= htmlspecialchars($lead['email']) ?>
                        </a>
                      </td>

                      <!-- Booth No -->
                      <td class="py-3.5 px-4 whitespace-nowrap font-medium text-gray-800">
                        <?php if (!empty($lead['booth'])): ?>
                          <span class="inline-block px-2 py-0.5 rounded bg-gray-100 font-mono text-gray-900 font-bold">
                            <?= htmlspecialchars($lead['booth']) ?>
                          </span>
                        <?php else: ?>
                          <span class="text-gray-400 italic">Not set</span>
                        <?php endif; ?>
                      </td>

                      <!-- Stall Dimensions -->
                      <td class="py-3.5 px-4 whitespace-nowrap text-gray-700 font-medium">
                        <?= htmlspecialchars($lead['stall_size']) ?>
                      </td>

                      <!-- Requirements -->
                      <td class="py-3.5 px-4 max-w-xs text-gray-600">
                        <div class="line-clamp-3 text-xs leading-relaxed" title="<?= htmlspecialchars($lead['requirements']) ?>">
                          <?= nl2br(htmlspecialchars($lead['requirements'])) ?>
                        </div>
                      </td>
                    </tr>
                  <?php endforeach; ?>
                </tbody>
              </table>
            </div>
          </div>
        <?php endif; ?>

      </div>
    <?php endif; ?>

  </main>

  <!-- Footer -->
  <footer class="mt-auto py-6 border-t border-gray-200/80 bg-white text-center text-xs text-gray-400">
    Reworkzone Stalls Portfolio &bull; Confidential Lead Management
  </footer>

</body>
</html>
