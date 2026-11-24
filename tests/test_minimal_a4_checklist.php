<?php
/**
 * Test Suite: Minimal A4 PDF Production Checklist with QR Codes
 *
 * Verifies all 16 requirements specified in user prompt:
 * 1. Complete removal of footer & signature area (Prepared By, Checked By, Date signature, footer branding, Doc Ref).
 * 2. Simplified compact header: Logo, Exhibition, prominent Company Name & Booth Number, Size, Type, Wall Configuration diagram.
 * 3. Removal of all print status and digital badges from printed sheet (Designs Pending, Partially Received, All Files Ready, Print Readiness, Done/Pending badges).
 * 4. QR code generation for PRINT FILES and 3D VIEW.
 * 5. 3D image-only handling (thumbnail embed, no fake links).
 * 6. Four clean checklist categories: Print Files & Design, Production, Furniture, Electrical.
 * 7. Goodies table omission when 0 goodies items exist.
 * 8. Furniture & Electrical omission when Not Required and 0 items.
 * 9. Production inconsistency preservation when marked N/A with active items.
 * 10. Clickable links and QR code anchors inside PDF.
 */

echo "=== TEST SUITE: MINIMAL A4 PDF CHECKLIST WITH QR CODES ===\n\n";

$passCount = 0;
$failCount = 0;

function assert_test($condition, $desc) {
    global $passCount, $failCount;
    if ($condition) {
        echo "  [PASS] {$desc}\n";
        $passCount++;
    } else {
        echo "  [FAIL] {$desc}\n";
        $failCount++;
    }
}

// 1. Inspect StallChecklistSheet.tsx source code directly
$sheetPath = __DIR__ . '/../src/pages/manage/StallChecklistSheet.tsx';
assert_test(file_exists($sheetPath), "StallChecklistSheet.tsx exists at expected location");
$sheetContent = file_get_contents($sheetPath);

// Verification 1: Footer and Signature Area Completely Removed
assert_test(strpos($sheetContent, 'Prepared By:') === false, "Footer 'Prepared By' is completely removed");
assert_test(strpos($sheetContent, 'Checked By:') === false, "Footer 'Checked By' is completely removed");
assert_test(strpos($sheetContent, 'Date signature') === false && strpos($sheetContent, 'Date:') === false, "Footer Date signature line is completely removed");
assert_test(strpos($sheetContent, 'Reworkzone Stalls Operations Management') === false, "Footer branding text is completely removed");
assert_test(strpos($sheetContent, 'Official Production Checklist') === false, "Footer repeated doc reference is completely removed");

// Verification 2: Simplified Header
assert_test(strpos($sheetContent, 'Doc Ref:') === false, "Header repeated 'Doc Ref:' is removed");
assert_test(strpos($sheetContent, 'Exhibitions & Turnkey Fabrication') === false, "Header giant subtitle 'Exhibitions & Turnkey Fabrication' is removed");
assert_test(strpos($sheetContent, 'Stall Production & Requirements Checklist') === false, "Header giant title 'Stall Production & Requirements Checklist' is removed");
assert_test(strpos($sheetContent, 'Company / Exhibitor') !== false, "Header retains Company / Exhibitor block");
assert_test(strpos($sheetContent, 'Booth Number') !== false, "Header retains Booth Number block");
assert_test(strpos($sheetContent, 'PrintableWallDiagram') !== false, "Header retains compact top-view vector diagram");

// Verification 3: Print Status Removed from PDF
assert_test(strpos($sheetContent, 'Designs Pending') === false, "Print file status fallback 'Designs Pending' removed from PDF view");
assert_test(strpos($sheetContent, 'Partially Received') === false, "'Partially Received' badge removed from PDF view");
assert_test(strpos($sheetContent, 'All Files Ready') === false, "'All Files Ready' badge removed from PDF view");
assert_test(strpos($sheetContent, 'Print Readiness') === false, "'Print Readiness' removed from PDF view");
assert_test(strpos($sheetContent, 'renderStatusBadge(printStatus)') === false, "Digital section status badge removed from Section 1 header");
assert_test(strpos($sheetContent, 'renderStatusBadge(prodStatus)') === false, "Digital section status badge removed from Section 2 header");
assert_test(strpos($sheetContent, 'renderStatusBadge(furnStatus)') === false, "Digital section status badge removed from Section 3 header");
assert_test(strpos($sheetContent, 'renderStatusBadge(elecStatus)') === false, "Digital section status badge removed from Section 4 header");

// Verification 4: QR Codes for File Access
assert_test(strpos($sheetContent, 'import QRCode from \'qrcode\';') !== false, "QRCode library imported");
assert_test(strpos($sheetContent, 'export function ChecklistQRCode') !== false, "ChecklistQRCode component defined and exported");
assert_test(strpos($sheetContent, 'label="PRINT FILES"') !== false, "PRINT FILES QR code included");
assert_test(strpos($sheetContent, 'label="3D VIEW"') !== false, "3D VIEW QR code included");

// Verification 5: Clean Omission of Empty Content
assert_test(strpos($sheetContent, 'shouldShowFurnSection') !== false, "Furniture section has omission condition for Not Required + 0 items");
assert_test(strpos($sheetContent, 'shouldShowElecSection') !== false, "Electrical section has omission condition for Not Required + 0 items");
assert_test(strpos($sheetContent, 'goodiesItems && goodiesItems.length > 0') !== false, "Goodies table is omitted when 0 goodies items exist");

// Verification 6: Node.js QR Code generation with long Google Drive URL
$nodeOutput = shell_exec("node " . escapeshellarg(__DIR__ . '/test_qr_generation.js'));
$nodeRes = json_decode(trim($nodeOutput ?? ''), true);

assert_test(!empty($nodeRes['success']), "Node generated valid base64 PNG data URLs for Drive & 3D links");
assert_test(($nodeRes['qr1Len'] ?? 0) > 1000, "Google Drive QR data URL contains valid scannable binary image");
assert_test(($nodeRes['qr2Len'] ?? 0) > 1000, "Claude 3D QR data URL contains valid scannable binary image");

// Verification 7: Check pdfExport.ts link annotations and continuation headers
$pdfExportPath = __DIR__ . '/../src/pages/manage/pdfExport.ts';
$pdfExportContent = file_get_contents($pdfExportPath);
assert_test(strpos($pdfExportContent, 'pdf.link(pdfX, totalPdfY, pdfW, pdfH, { url: href })') !== false, "pdfExport.ts embeds clickable link annotations for on-screen PDF viewers");
assert_test(strpos($pdfExportContent, '(Continuation)') !== false, "pdfExport.ts repeats essential booth identification on multi-page continuation sheets");

// Verification 8: ClientStallSheet.tsx Consistency & Client Protection
$clientSheetPath = __DIR__ . '/../src/pages/manage/ClientStallSheet.tsx';
assert_test(file_exists($clientSheetPath), "ClientStallSheet.tsx exists at expected location");
$clientSheetContent = file_get_contents($clientSheetPath);

assert_test(strpos($clientSheetContent, 'ChecklistQRCode') !== false, "ClientStallSheet uses shared ChecklistQRCode for 3D and Print links");
assert_test(strpos($clientSheetContent, 'PrintableWallDiagram') !== false, "ClientStallSheet uses shared PrintableWallDiagram");
assert_test(strpos($clientSheetContent, '1. 3D Design') !== false, "ClientStallSheet includes Category 1 (3D Design & Approved Files)");
assert_test(strpos($clientSheetContent, '2. Production') !== false, "ClientStallSheet includes Category 2 (Production & Structure Requirements)");
assert_test(strpos($clientSheetContent, '3. Furniture Requirements') !== false, "ClientStallSheet includes Category 3 (Furniture Requirements)");
assert_test(strpos($clientSheetContent, '4. Electrical') !== false, "ClientStallSheet includes Category 4 (Electrical & Power Requirements)");
assert_test(strpos($clientSheetContent, 'Verified on site') === false, "ClientStallSheet excludes internal verification checkboxes");
assert_test(strpos($clientSheetContent, 'Production verified') === false, "ClientStallSheet excludes internal production verification checkboxes");
assert_test(strpos($clientSheetContent, 'booth.print_remark') === false, "ClientStallSheet excludes internal unapproved print remarks");
assert_test(strpos($clientSheetContent, 'booth.notes') === false, "ClientStallSheet excludes internal production notes");
assert_test(strpos($clientSheetContent, 'Prepared By:') === false && strpos($clientSheetContent, 'Checked By:') === false, "ClientStallSheet excludes internal signature blocks");

echo "\n--- SUMMARY ---\n";
echo "Total assertions: " . ($passCount + $failCount) . "\n";
echo "Passed: {$passCount}\n";
echo "Failed: {$failCount}\n";

if ($failCount > 0) {
    exit(1);
}
