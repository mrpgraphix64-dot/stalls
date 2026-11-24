<?php
/**
 * Reworkzone Stalls - Local Development Server Router
 * 
 * Routes requests for PHP built-in server (php -S 127.0.0.1:8000 local-server.php):
 * 1. /manage/api/<endpoint> -> /manage/api/<endpoint>.php
 * 2. Static assets & PHP scripts
 * 3. /manage and SPA routes -> /index.html
 */

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// 0. Block CLI scripts from web execution
if (preg_match('#cli\.php$#i', $uri)) {
    http_response_code(403);
    echo "CLI scripts cannot be accessed via web.";
    exit;
}

// 1. Route /manage/api/<endpoint> or /manage/api/<endpoint>.php
if (preg_match('#^/manage/api/([^/]+)/?$#', $uri, $m)) {
    $name = substr($m[1], -4) === '.php' ? substr($m[1], 0, -4) : $m[1];
    $apiFile = __DIR__ . '/manage/api/' . $name . '.php';
    if (file_exists($apiFile)) {
        require $apiFile;
        exit;
    }
}

// 2. Direct PHP scripts
$requestedFile = __DIR__ . $uri;
if (is_file($requestedFile) && substr($requestedFile, -4) === '.php') {
    require $requestedFile;
    exit;
}

// 3. Static files if they exist on disk (images, css, js, icons)
if (is_file($requestedFile)) {
    return false;
}

// 3b. Serve 3D preview uploads through persistent image streamer if missing in local root
if (preg_match('#^/uploads/3d_previews/([^/]+)$#', $uri, $m)) {
    $_GET['file'] = $m[1];
    require __DIR__ . '/manage/api/preview-image.php';
    exit;
}

// 4. Special rewrites
if ($uri === '/admin' || $uri === '/admin/') {
    require __DIR__ . '/admin.php';
    exit;
}

// Do not serve index.html for missing images or assets (prevent 422/syntax errors)
if (preg_match('#\.(jpe?g|png|gif|webp|svg|ico|css|js|map|woff2?|ttf|eot)$#i', $uri)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=UTF-8');
    echo "404 Not Found";
    exit;
}

// 5. Fallback for SPA (Public site, /#/build, /manage)
if (file_exists(__DIR__ . '/index.html')) {
    header('Content-Type: text/html; charset=UTF-8');
    readfile(__DIR__ . '/index.html');
    exit;
}

return false;
