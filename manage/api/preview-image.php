<?php
/**
 * Reworkzone Stalls Operations System - 3D Preview Image Delivery Endpoint
 * 
 * Safely serves uploaded 3D preview images from persistent storage outside public_html
 * or local upload directories. Prevents HTTP 422 errors by ensuring valid MIME types
 * and HTTP 404 responses for missing files (never serving index.html for image requests).
 */

require_once __DIR__ . '/config.php';

// Handle CORS for PDF generation (html2canvas) and canvas cross-origin access
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, HEAD, OPTIONS');
header('Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Extract filename parameter from query string or path info
$file = $_GET['file'] ?? ($_GET['f'] ?? '');
if (empty($file) && !empty($_SERVER['PATH_INFO'])) {
    $file = ltrim($_SERVER['PATH_INFO'], '/');
}

$rawFile = trim(urldecode($file));

// Strictly disallow directory traversal or subdirectories in filename
if (strpos($rawFile, '..') !== false || strpos($rawFile, '/') !== false || strpos($rawFile, '\\') !== false) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Invalid file path.';
    exit;
}

$cleanName = basename($rawFile);

if (empty($cleanName) || !preg_match('/^[a-zA-Z0-9_\-\.]+$/', $cleanName)) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Invalid file request.';
    exit;
}

// Disallow hidden files or dangerous filenames
if (strpos($cleanName, '.') === 0 || strpos($cleanName, '..') !== false) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Invalid file path.';
    exit;
}

// Validate file extension against allowed image types
$allowedExtensions = [
    'jpg'  => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png'  => 'image/png',
    'webp' => 'image/webp',
    'gif'  => 'image/gif',
    'svg'  => 'image/svg+xml'
];

$ext = strtolower(pathinfo($cleanName, PATHINFO_EXTENSION));
if (!isset($allowedExtensions[$ext])) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Unsupported image format.';
    exit;
}

$mimeType = $allowedExtensions[$ext];

// Search potential storage directories in order of priority:
// 1. Persistent storage outside public_html (survives Git deployments)
// 2. Persistent storage inside webroot reworkzone_data
// 3. Parent external directory reworkzone_data
// 4. Webroot uploads directory
// 5. Public uploads directory
$webRoot = dirname(__DIR__, 2);
$searchDirs = [
    reworkzone_manage_get_data_dir() . '/uploads/3d_previews',
    $webRoot . '/reworkzone_data/uploads/3d_previews',
    dirname($webRoot) . '/reworkzone_data/uploads/3d_previews',
    $webRoot . '/uploads/3d_previews',
    $webRoot . '/public/uploads/3d_previews',
    __DIR__ . '/data/uploads/3d_previews'
];

$resolvedPath = null;
foreach ($searchDirs as $dir) {
    if (!empty($dir) && is_dir($dir)) {
        $candidate = $dir . '/' . $cleanName;
        if (is_file($candidate) && is_readable($candidate)) {
            $resolvedPath = $candidate;
            break;
        }
    }
}

// If file not found anywhere, return HTTP 404 with clean SVG placeholder (never HTML or 422)
if (!$resolvedPath) {
    http_response_code(404);
    if (isset($_GET['format']) && $_GET['format'] === 'text') {
        header('Content-Type: text/plain; charset=UTF-8');
        echo 'Image not found.';
        exit;
    }
    header('Content-Type: image/svg+xml; charset=UTF-8');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    echo '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">'
       . '<rect width="400" height="300" fill="#18181b"/>'
       . '<rect x="1" y="1" width="398" height="298" rx="8" fill="none" stroke="#27272a" stroke-width="2"/>'
       . '<path d="M180 130l20 25 15-18 25 33H160z" fill="#71717a"/>'
       . '<circle cx="175" cy="115" r="8" fill="#71717a"/>'
       . '<text x="200" y="210" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600" fill="#a1a1aa" text-anchor="middle">3D Preview Image Not Found</text>'
       . '<text x="200" y="230" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#71717a" text-anchor="middle">The image file has been moved or is unavailable</text>'
       . '</svg>';
    exit;
}

// Self-healing: If found in persistent storage but not in webroot, replicate to webroot for fast direct serving
$publicUploadDir = $webRoot . '/uploads/3d_previews';
if (is_dir($publicUploadDir) && is_writable($publicUploadDir)) {
    $targetCopy = $publicUploadDir . '/' . $cleanName;
    if (!file_exists($targetCopy)) {
        @copy($resolvedPath, $targetCopy);
    }
}

// Caching and Conditional GET handling
$fileSize = filesize($resolvedPath);
$fileMtime = filemtime($resolvedPath);
$etag = '"' . md5($cleanName . '_' . $fileMtime . '_' . $fileSize) . '"';

header('Content-Type: ' . $mimeType);
header('Content-Length: ' . $fileSize);
header('ETag: ' . $etag);
header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $fileMtime) . ' GMT');
header('Cache-Control: public, max-age=2592000, immutable');
header('X-Content-Type-Options: nosniff');

if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH']) === $etag) {
    http_response_code(304);
    exit;
}

if (isset($_SERVER['HTTP_IF_MODIFIED_SINCE'])) {
    $sinceTime = strtotime($_SERVER['HTTP_IF_MODIFIED_SINCE']);
    if ($sinceTime !== false && $sinceTime >= $fileMtime) {
        http_response_code(304);
        exit;
    }
}

http_response_code(200);

// For HEAD requests, headers alone are sufficient
if ($_SERVER['REQUEST_METHOD'] === 'HEAD') {
    exit;
}

// Stream file content
readfile($resolvedPath);
exit;
