<?php
// Runner for preview-image.php test invocations
$file = $argv[1] ?? '';
$override = $argv[2] ?? '';
$ifNoneMatch = $argv[3] ?? '';

if ($override !== '') {
    putenv("REWORKZONE_DATA_DIR_OVERRIDE={$override}");
}
$_GET['file'] = $file;
$_SERVER['REQUEST_METHOD'] = 'GET';
if ($ifNoneMatch !== '') {
    $_SERVER['HTTP_IF_NONE_MATCH'] = $ifNoneMatch;
}

require __DIR__ . '/../manage/api/preview-image.php';
