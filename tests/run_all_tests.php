<?php
$files = [
    __DIR__ . '/test_step2_auth.php',
    __DIR__ . '/test_step3_api.php',
    __DIR__ . '/test_step4_api.php',
    __DIR__ . '/test_step5_api.php',
    __DIR__ . '/test_step6_backup_hardening.php',
    __DIR__ . '/test_deletion_and_floorplan.php',
    __DIR__ . '/test_checklist_simplification.php',
    __DIR__ . '/test_quick_add_refinement.php',
    __DIR__ . '/test_goodies_promotional_printing.php',
    __DIR__ . '/test_design_3d_views.php',
    __DIR__ . '/test_ongoing_discussions.php',
    __DIR__ . '/test_printable_checklist.php',
    __DIR__ . '/test_remove_installation_section.php',
    __DIR__ . '/test_wall_configuration.php',
    __DIR__ . '/test_edit_booth_discussions.php',
    __DIR__ . '/test_event_booths_wall_column.php',
    __DIR__ . '/test_stall_type_wall_independence.php',
    __DIR__ . '/test_na_checklist_progress.php',
    __DIR__ . '/test_checklist_filters_and_bulk_pdf.php',
    __DIR__ . '/test_pdf_links_and_qr.php',
    __DIR__ . '/test_excel_requirements_export.php',
];
$totalFailed = 0;
foreach ($files as $file) {
    echo "\n--------------------------------------------------------\n";
    echo "Running " . basename($file) . "\n";
    echo "--------------------------------------------------------\n";
    passthru("php " . escapeshellarg($file), $ret);
    if ($ret !== 0) {
        $totalFailed++;
        echo "FAILED: " . basename($file) . " (code $ret)\n";
    }
}
echo "\n========================================================\n";
if ($totalFailed === 0) {
    echo "ALL " . count($files) . " TEST SUITES PASSED SUCCESSFULLY!\n";
    exit(0);
} else {
    echo "$totalFailed SUITES FAILED!\n";
    exit(1);
}

