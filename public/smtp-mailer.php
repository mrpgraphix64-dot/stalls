<?php
/**
 * Reworkzone Exhibition Stalls - Lightweight Native SMTP Mailer
 * Zero dependencies, works out of the box on Hostinger PHP 7.4 - 8.3+
 */

function reworkzone_get_data_dir() {
    // 1. Try persistent directory outside public_html (never wiped by Hostinger Git Deploy)
    $parentDir = dirname(__DIR__);
    $persistentDir = $parentDir . '/reworkzone_leads';
    if (@is_dir($persistentDir) || @mkdir($persistentDir, 0755, true)) {
        // Migrate any local data so nothing is ever lost
        $localCsv = __DIR__ . '/data/enquiries.csv';
        $persistentCsv = $persistentDir . '/enquiries.csv';
        if (file_exists($localCsv) && !file_exists($persistentCsv)) {
            @copy($localCsv, $persistentCsv);
        }
        $localSmtp = __DIR__ . '/data/smtp_config.json';
        $persistentSmtp = $persistentDir . '/smtp_config.json';
        if (file_exists($localSmtp) && !file_exists($persistentSmtp)) {
            @copy($localSmtp, $persistentSmtp);
        }
        return $persistentDir;
    }

    // 2. Fallback to local data/ directory
    $localDir = __DIR__ . '/data';
    if (!is_dir($localDir)) {
        @mkdir($localDir, 0755, true);
    }
    return $localDir;
}

function reworkzone_get_smtp_config() {
    $dataDir = reworkzone_get_data_dir();
    $configFile = $dataDir . '/smtp_config.json';
    if (file_exists($configFile)) {
        $content = @file_get_contents($configFile);
        $data = json_decode($content, true);
        if (is_array($data) && !empty($data['host']) && !empty($data['username']) && !empty($data['password'])) {
            return $data;
        }
    }
    $localConfigFile = __DIR__ . '/data/smtp_config.json';
    if (file_exists($localConfigFile)) {
        $content = @file_get_contents($localConfigFile);
        $data = json_decode($content, true);
        if (is_array($data) && !empty($data['host']) && !empty($data['username']) && !empty($data['password'])) {
            return $data;
        }
    }
    return null;
}

function reworkzone_save_smtp_config($host, $port, $username, $password, $encryption = 'ssl') {
    $dataDir = reworkzone_get_data_dir();
    $configFile = $dataDir . '/smtp_config.json';
    $data = [
        'host'       => trim($host),
        'port'       => intval($port),
        'username'   => trim($username),
        'password'   => $password,
        'encryption' => trim($encryption),
        'updated_at' => date('Y-m-d H:i:s'),
    ];
    $json = json_encode($data, JSON_PRETTY_PRINT);
    // Save to persistent external directory
    $saved = @file_put_contents($configFile, $json) !== false;
    // Also save copy to local data directory
    $localDir = __DIR__ . '/data';
    if (!is_dir($localDir)) @mkdir($localDir, 0755, true);
    @file_put_contents($localDir . '/smtp_config.json', $json);

    return $saved;
}

function reworkzone_send_via_socket($host, $port, $username, $password, $to, $subject, $htmlBody, $replyToEmail = '', $replyToName = '', $encryption = 'ssl') {
    $timeout = 15;
    $context = stream_context_create([
        'ssl' => [
            'verify_peer'       => false,
            'verify_peer_name'  => false,
            'allow_self_signed' => true,
        ]
    ]);

    $protocol = ($encryption === 'ssl' || $port == 465) ? 'ssl://' : 'tcp://';
    $socket = @stream_socket_client($protocol . $host . ':' . $port, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT, $context);

    if (!$socket) {
        return ['success' => false, 'error' => "Cannot connect to {$host}:{$port} - {$errstr} ({$errno})"];
    }

    stream_set_timeout($socket, $timeout);

    $read = function() use ($socket) {
        $data = '';
        while ($line = fgets($socket, 515)) {
            $data .= $line;
            if (substr($line, 3, 1) === ' ') {
                break;
            }
        }
        return $data;
    };

    $send = function($cmd) use ($socket) {
        fputs($socket, $cmd . "\r\n");
    };

    $banner = $read();
    if (substr($banner, 0, 3) !== '220') {
        fclose($socket);
        return ['success' => false, 'error' => "Server did not send 220 greeting: {$banner}"];
    }

    $send("EHLO " . ($_SERVER['SERVER_NAME'] ?? 'reworkzone.in'));
    $ehlo = $read();

    if ($encryption === 'tls' || ($port == 587 && strpos($ehlo, 'STARTTLS') !== false)) {
        $send("STARTTLS");
        $tlsResp = $read();
        if (substr($tlsResp, 0, 3) === '220') {
            stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            $send("EHLO " . ($_SERVER['SERVER_NAME'] ?? 'reworkzone.in'));
            $read();
        }
    }

    $send("AUTH LOGIN");
    $authResp = $read();
    if (substr($authResp, 0, 3) !== '334') {
        fclose($socket);
        return ['success' => false, 'error' => "SMTP AUTH LOGIN rejected: {$authResp}"];
    }

    $send(base64_encode($username));
    $userResp = $read();
    if (substr($userResp, 0, 3) !== '334') {
        fclose($socket);
        return ['success' => false, 'error' => "Username rejected ({$username}): {$userResp}"];
    }

    $send(base64_encode($password));
    $passResp = $read();
    if (substr($passResp, 0, 3) !== '235') {
        fclose($socket);
        return ['success' => false, 'error' => "Authentication failed. Please verify your email password. Hostinger response: {$passResp}"];
    }

    $send("MAIL FROM: <{$username}>");
    $mailFromResp = $read();
    if (substr($mailFromResp, 0, 3) !== '250') {
        fclose($socket);
        return ['success' => false, 'error' => "MAIL FROM rejected: {$mailFromResp}"];
    }

    $send("RCPT TO: <{$to}>");
    $rcptResp = $read();
    if (substr($rcptResp, 0, 3) !== '250' && substr($rcptResp, 0, 3) !== '251') {
        fclose($socket);
        return ['success' => false, 'error' => "Recipient rejected ({$to}): {$rcptResp}"];
    }

    $send("DATA");
    $dataResp = $read();
    if (substr($dataResp, 0, 3) !== '354') {
        fclose($socket);
        return ['success' => false, 'error' => "DATA rejected: {$dataResp}"];
    }

    $headers = [];
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'Content-Type: text/html; charset=UTF-8';
    $headers[] = "From: Reworkzone Stalls <{$username}>";
    $headers[] = "To: <{$to}>";
    if (!empty($replyToEmail)) {
        $replyName = !empty($replyToName) ? $replyToName : $replyToEmail;
        $headers[] = "Reply-To: {$replyName} <{$replyToEmail}>";
    }
    $headers[] = "Subject: {$subject}";
    $headers[] = "Date: " . date('r');
    $headers[] = "Message-ID: <" . md5(uniqid(microtime(), true)) . "@{$host}>";
    $headers[] = 'X-Mailer: Reworkzone Hostinger Mailer 2.0';

    $payload = implode("\r\n", $headers) . "\r\n\r\n" . $htmlBody . "\r\n.";
    $send($payload);
    $sendResp = $read();

    $send("QUIT");
    fclose($socket);

    if (substr($sendResp, 0, 3) === '250') {
        return ['success' => true];
    } else {
        return ['success' => false, 'error' => "Delivery rejected by server: {$sendResp}"];
    }
}

/**
 * Dispatch email using SMTP (if configured) or native mail()
 */
function reworkzone_dispatch_email($to, $subject, $htmlBody, $replyToEmail = '', $replyToName = '') {
    $config = reworkzone_get_smtp_config();

    if ($config) {
        $res = reworkzone_send_via_socket(
            $config['host'],
            $config['port'],
            $config['username'],
            $config['password'],
            $to,
            $subject,
            $htmlBody,
            $replyToEmail,
            $replyToName,
            $config['encryption'] ?? 'ssl'
        );
        if ($res['success']) {
            return ['success' => true, 'method' => 'Hostinger SMTP'];
        } else {
            // Log error
            @file_put_contents(__DIR__ . '/data/mail_error.log', date('Y-m-d H:i:s') . ' SMTP Error: ' . $res['error'] . "\n", FILE_APPEND);
        }
    }

    // Fallback to PHP mail()
    $from = $config ? $config['username'] : 'info@reworkzone.in';
    $headers = [];
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'Content-type: text/html; charset=UTF-8';
    $headers[] = "From: Reworkzone Stalls <{$from}>";
    if (!empty($replyToEmail)) {
        $headers[] = "Reply-To: {$replyToEmail}";
    }
    $headers[] = "Return-Path: <{$from}>";
    $headers[] = 'X-Mailer: PHP/' . phpversion();

    $sent = @mail($to, $subject, $htmlBody, implode("\r\n", $headers), "-f{$from}");
    if (!$sent) {
        $sent = @mail($to, $subject, $htmlBody, implode("\r\n", $headers));
    }

    return [
        'success' => $sent,
        'method'  => 'PHP mail()',
        'error'   => $sent ? null : (isset($res) ? $res['error'] : 'Hostinger mail() disabled'),
    ];
}
