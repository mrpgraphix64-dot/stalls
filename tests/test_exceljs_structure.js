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

  // Row 1: Main Title Banner
  ws.mergeCells('A1:Y1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'REWORKZONE STALLS — MASTER STALL DETAIL & PRODUCTION REQUIREMENTS';
  titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF18181B' } }; // Dark charcoal
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 26;

  // Row 2: Subtitle / Event metadata
  ws.mergeCells('A2:Y2');
  const subCell = ws.getCell('A2');
  subCell.value = 'Exhibition: Tech Expo 2026 | Venue: Pragati Maidan Hall 12, New Delhi | Date: 12-15 Dec 2026 | Generated: ' + new Date().toLocaleDateString('en-GB');
  subCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF52525B' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F5' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(2).height = 20;

  // Row 3: Section Group Headers
  ws.mergeCells('A3:F3');
  const g1 = ws.getCell('A3');
  g1.value = 'BASIC DETAILS';
  g1.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
  g1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF27272A' } };
  g1.alignment = { vertical: 'middle', horizontal: 'center' };

  ws.mergeCells('G3:N3');
  const g2 = ws.getCell('G3');
  g2.value = 'PRODUCTION REQUIREMENTS';
  g2.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF78350F' } };
  g2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
  g2.alignment = { vertical: 'middle', horizontal: 'center' };

  ws.mergeCells('O3:Q3');
  const g3 = ws.getCell('O3');
  g3.value = 'FURNITURE';
  g3.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF064E3B' } };
  g3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
  g3.alignment = { vertical: 'middle', horizontal: 'center' };

  ws.mergeCells('R3:S3');
  const g4 = ws.getCell('R3');
  g4.value = 'ELECTRICAL';
  g4.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF7C2D12' } };
  g4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } };
  g4.alignment = { vertical: 'middle', horizontal: 'center' };

  ws.mergeCells('T3:X3');
  const g5 = ws.getCell('T3');
  g5.value = 'PRINTING & GOODIES';
  g5.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF581C87' } };
  g5.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } };
  g5.alignment = { vertical: 'middle', horizontal: 'center' };

  const g6 = ws.getCell('Y3');
  g6.value = 'ADDITIONAL';
  g6.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF1F2937' } };
  g6.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
  g6.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(3).height = 18;

  // Row 4: Column Headers (25 columns)
  const columns = [
    { header: 'Sr. No.', width: 8 },
    { header: 'Company Name', width: 34 },
    { header: 'Stall No.', width: 13 },
    { header: 'Booth Type', width: 14 },
    { header: 'Wall Configuration', width: 18 },
    { header: 'Size', width: 12 },
    { header: 'Wooden Platform Flooring', width: 15 },
    { header: 'Carpet', width: 11 },
    { header: 'Carpet Color', width: 14 },
    { header: 'Selfie Booth', width: 13 },
    { header: 'Table Vinyl Branding', width: 16 },
    { header: 'TV 42 Inch', width: 13 },
    { header: 'TV 50–55 Inch', width: 14 },
    { header: 'TV Mount', width: 16 },
    { header: 'Glass Round Table', width: 15 },
    { header: '2-Seater Sofa', width: 14 },
    { header: 'Chair', width: 11 },
    { header: 'Power Socket', width: 13 },
    { header: 'Permanent Light', width: 15 },
    { header: 'Print Files', width: 12 },
    { header: 'Book', width: 11 },
    { header: 'Pen', width: 11 },
    { header: 'Leaflet', width: 11 },
    { header: 'Other Goodies', width: 20 },
    { header: 'Other Requirements', width: 26 },
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
    to: { row: 4, column: 25 },
  };

  // Row 5: Sample Data Row
  const rowData = [
    1,
    'Softqube Technologies Pvt. Ltd.',
    '#A119',
    'Wooden',
    'Back + Left',
    '3 × 3 m',
    // Production
    '1',
    'YES',
    'GREY',
    '—',
    '1',
    '—',
    '1',
    'WALL MOUNT',
    // Furniture
    '1',
    '1',
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
    // Other Requirements
    'Brochure Stand (1), Plants (2)',
  ];

  const dataRow = ws.addRow(rowData);
  dataRow.height = 20;
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
    } else if (colNum === 24 || colNum === 25) {
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    } else {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }

    if (colNum === 9 && cell.value === 'GREY') {
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
  console.log('Sample cell I5 (Carpet Color):', readWb.worksheets[0].getCell('I5').value);
  fs.unlinkSync('tests/test_output.xlsx');
}

testWorkbookGeneration().catch((err) => {
  console.error(err);
  process.exit(1);
});
