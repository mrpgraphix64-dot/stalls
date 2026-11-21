import ExcelJS from 'exceljs';
import fs from 'fs';

async function testWorkbookGeneration() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Reworkzone Operations System';
  wb.created = new Date();

  const ws = wb.addWorksheet('Stall Requirements', {
    pageSetup: {
      orientation: 'landscape',
      paperSize: 8, // A3
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: '3:4',
      horizontalCentered: true,
    },
    views: [{ state: 'frozen', xSplit: 3, ySplit: 4 }],
  });

  // Row 1: Main Title Banner (A1:W1)
  ws.mergeCells('A1:W1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'REWORKZONE STALLS — MASTER STALL DETAIL & PRODUCTION REQUIREMENTS';
  titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF18181B' } }; // Dark charcoal
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 26;

  // Row 2: Subtitle / Event metadata (A2:W2)
  ws.mergeCells('A2:W2');
  const subCell = ws.getCell('A2');
  subCell.value = 'Exhibition: Tech Expo 2026 | Venue: Pragati Maidan Hall 12, New Delhi | Date: 12-15 Dec 2026 | Generated: ' + new Date().toLocaleDateString('en-GB');
  subCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF52525B' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F5' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(2).height = 20;

  // Row 3: Section Group Headers (23 Columns A to W)
  // Group 1: BASIC DETAILS (A3:G3) - 7 cols
  ws.mergeCells('A3:G3');
  const g1 = ws.getCell('A3');
  g1.value = 'BASIC DETAILS';
  g1.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
  g1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF27272A' } };
  g1.alignment = { vertical: 'middle', horizontal: 'center' };

  // Group 2: PRODUCTION REQUIREMENTS (H3:L3) - 5 cols
  ws.mergeCells('H3:L3');
  const g2 = ws.getCell('H3');
  g2.value = 'PRODUCTION REQUIREMENTS';
  g2.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF78350F' } };
  g2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
  g2.alignment = { vertical: 'middle', horizontal: 'center' };

  // Group 3: FURNITURE (M3:O3) - 3 cols
  ws.mergeCells('M3:O3');
  const g3 = ws.getCell('M3');
  g3.value = 'FURNITURE';
  g3.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF064E3B' } };
  g3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
  g3.alignment = { vertical: 'middle', horizontal: 'center' };

  // Group 4: ELECTRICAL (P3:Q3) - 2 cols
  ws.mergeCells('P3:Q3');
  const g4 = ws.getCell('P3');
  g4.value = 'ELECTRICAL';
  g4.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF7C2D12' } };
  g4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } };
  g4.alignment = { vertical: 'middle', horizontal: 'center' };

  // Group 5: PRINTING & GOODIES (R3:V3) - 5 cols
  ws.mergeCells('R3:V3');
  const g5 = ws.getCell('R3');
  g5.value = 'PRINTING & GOODIES';
  g5.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF581C87' } };
  g5.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } };
  g5.alignment = { vertical: 'middle', horizontal: 'center' };

  // Group 6: SPECIAL REQUIREMENTS (W3) - 1 col
  const g6 = ws.getCell('W3');
  g6.value = 'SPECIAL REQUIREMENTS';
  g6.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF1E293B' } };
  g6.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  g6.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(3).height = 18;

  // Row 4: Column Headers (Exactly 23 columns)
  const columns = [
    { header: 'Sr. No.', width: 8 },
    { header: 'Company Name', width: 34 },
    { header: 'Stall No.', width: 13 },
    { header: 'Stall Shape', width: 16 },
    { header: 'Booth Type', width: 14 },
    { header: 'Wall Configuration', width: 18 },
    { header: 'Size', width: 12 },
    { header: 'Wooden Platform Flooring', width: 15 },
    { header: 'Carpet', width: 11 },
    { header: 'Carpet Color', width: 14 },
    { header: 'Table Vinyl Branding', width: 16 },
    { header: 'TV', width: 22 },
    { header: 'Glass Round Table', width: 15 },
    { header: 'Sofa', width: 16 },
    { header: 'Chair', width: 11 },
    { header: 'Power Socket', width: 13 },
    { header: 'Permanent Light', width: 15 },
    { header: 'Print Files', width: 12 },
    { header: 'Book', width: 11 },
    { header: 'Pen', width: 11 },
    { header: 'Leaflet', width: 11 },
    { header: 'Other Goodies', width: 20 },
    { header: 'Special Requirements', width: 28 },
  ];

  columns.forEach((c, idx) => {
    ws.getColumn(idx + 1).width = c.width;
  });

  const headerRow = ws.addRow(columns.map((c) => c.header));
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF18181B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F5' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD4D4D8' } },
      bottom: { style: 'medium', color: { argb: 'FF71717A' } },
      left: { style: 'thin', color: { argb: 'FFE4E4E7' } },
      right: { style: 'thin', color: { argb: 'FFE4E4E7' } },
    };
  });

  ws.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: 23 },
  };

  // Row 5: Sample Data Row
  const rowData = [
    1,
    'Softqube Technologies Pvt. Ltd.',
    '#A119',
    'L Shape',
    'Wooden',
    'Back + Left',
    '3 × 3 m',
    // Production
    '1',
    'YES',
    'GREY',
    '1',
    '42" × 1 — Wall Mount',
    // Furniture
    '1',
    '2-Seater × 1',
    '4',
    // Electrical
    '1',
    '4 SPOTLIGHT',
    // Printing & Goodies
    'YES',
    '50',
    '100',
    '—',
    '—',
    // Special Requirements
    'Selfie Booth × 1\nBrochure Stand (1)',
  ];

  const dataRow = ws.addRow(rowData);
  dataRow.height = 32;
  dataRow.eachCell((cell, colNum) => {
    cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF18181B' } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE4E4E7' } },
      bottom: { style: 'thin', color: { argb: 'FFE4E4E7' } },
      left: { style: 'thin', color: { argb: 'FFE4E4E7' } },
      right: { style: 'thin', color: { argb: 'FFE4E4E7' } },
    };

    if (colNum === 2) {
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF0F172A' } };
    } else if (colNum === 12 || colNum === 14 || colNum === 22 || colNum === 23) {
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    } else {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }

    if (colNum === 10 && cell.value === 'GREY') {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF374151' } };
    }
  });

  const buf = await wb.xlsx.writeBuffer();
  fs.writeFileSync('tests/test_output.xlsx', Buffer.from(buf));
  console.log('Successfully wrote tests/test_output.xlsx, size:', buf.byteLength);

  // Read it back with ExcelJS to ensure 100% validity
  const readWb = new ExcelJS.Workbook();
  await readWb.xlsx.readFile('tests/test_output.xlsx');
  console.log('Read back sheets count:', readWb.worksheets.length);
  console.log('Sheet 1 name:', readWb.worksheets[0].name);
  console.log('Row count:', readWb.worksheets[0].rowCount);
  console.log('Sample cell A1:', readWb.worksheets[0].getCell('A1').value);
  console.log('Sample cell J5 (Carpet Color):', readWb.worksheets[0].getCell('J5').value);
  console.log('Sample cell L5 (TV):', readWb.worksheets[0].getCell('L5').value);
  console.log('Sample cell N5 (Sofa):', readWb.worksheets[0].getCell('N5').value);
  console.log('Sample cell W5 (Special Requirements):', readWb.worksheets[0].getCell('W5').value);
  fs.unlinkSync('tests/test_output.xlsx');
}

testWorkbookGeneration().catch((err) => {
  console.error(err);
  process.exit(1);
});
