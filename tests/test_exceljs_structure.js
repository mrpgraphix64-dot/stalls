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
      printTitlesRow: '4:5',
      horizontalCentered: true,
    },
    views: [{ state: 'frozen', xSplit: 2, ySplit: 5 }],
  });

  // Row 1: Main Title Banner
  ws.mergeCells('A1:AJ1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'REWORKZONE EXHIBITIONS — STALL PRODUCTION & REQUIREMENTS MATRIX';
  titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF18181B' } }; // Dark charcoal
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 30;

  // Row 2: Subtitle / Event metadata
  ws.mergeCells('A2:AJ2');
  const subCell = ws.getCell('A2');
  subCell.value = 'Exhibition: Tech Expo 2026 | Venue: Pragati Maidan Hall 12, New Delhi | Date: 12-15 Dec 2026 | Generated: ' + new Date().toLocaleDateString('en-GB');
  subCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF52525B' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F5' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(2).height = 20;

  // Row 3: Blank separator
  ws.getRow(3).height = 8;

  // Row 4: Section Group Headers
  ws.mergeCells('A4:H4');
  const g1 = ws.getCell('A4');
  g1.value = 'IDENTIFYING DETAILS & STRUCTURE';
  g1.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  g1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF27272A' } };
  g1.alignment = { vertical: 'middle', horizontal: 'center' };

  ws.mergeCells('I4:K4');
  const g2 = ws.getCell('I4');
  g2.value = 'DESIGN';
  g2.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E3A8A' } };
  g2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
  g2.alignment = { vertical: 'middle', horizontal: 'center' };

  ws.mergeCells('L4:Q4');
  const g3 = ws.getCell('L4');
  g3.value = 'PRINTING & GOODIES';
  g3.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF581C87' } };
  g3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } };
  g3.alignment = { vertical: 'middle', horizontal: 'center' };

  ws.mergeCells('R4:W4');
  const g4 = ws.getCell('R4');
  g4.value = 'PRODUCTION';
  g4.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF78350F' } };
  g4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
  g4.alignment = { vertical: 'middle', horizontal: 'center' };

  ws.mergeCells('X4:AA4');
  const g5 = ws.getCell('X4');
  g5.value = 'FURNITURE';
  g5.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF064E3B' } };
  g5.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
  g5.alignment = { vertical: 'middle', horizontal: 'center' };

  ws.mergeCells('AB4:AD4');
  const g6 = ws.getCell('AB4');
  g6.value = 'ELECTRICAL';
  g6.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF7C2D12' } };
  g6.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } };
  g6.alignment = { vertical: 'middle', horizontal: 'center' };

  ws.mergeCells('AE4:AJ4');
  const g7 = ws.getCell('AE4');
  g7.value = 'CHECKLIST COMPLETION';
  g7.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1F2937' } };
  g7.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
  g7.alignment = { vertical: 'middle', horizontal: 'center' };

  ws.getRow(4).height = 22;

  // Row 5: Column Headers
  const headers = [
    'Booth #',
    'Company Name',
    'Booth Size',
    'Booth Type',
    'Wall Configuration',
    'Flooring Required',
    'Carpet Color',
    'Booking Stage',
    'Client Side',
    'Our Side',
    '3D View',
    'Print Link',
    'Print Ready',
    'Book',
    'Pen',
    'Leaflet',
    'Other Goodies',
    'Selfie Booth',
    'Table Vinyl',
    'TV 42"',
    'TV 50–55"',
    'TV Mounting',
    'Other Production',
    'Glass Round Table',
    '2 Seater Sofa',
    'Chair',
    'Other Furniture',
    'Power Socket',
    'Permanent Light',
    'Other Electrical',
    'Design Done',
    'Print Done',
    'Production Done',
    'Furniture Done',
    'Electrical Done',
    'Overall Progress',
  ];

  const headerRow = ws.addRow(headers);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF18181B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F5' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD4D4D8' } },
      bottom: { style: 'medium', color: { argb: 'FFA1A1AA' } },
      left: { style: 'thin', color: { argb: 'FFE4E4E7' } },
      right: { style: 'thin', color: { argb: 'FFE4E4E7' } },
    };
  });

  // Enable AutoFilter on row 5
  ws.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: 5, column: headers.length },
  };

  // Sample data row
  const rowData = [
    'A-01',
    'Alpha Innovations Ltd.',
    '6 × 3 m',
    'Wooden',
    '3 Sides',
    '✓ 1',
    'Blue',
    'Confirmed',
    '—',
    '✓',
    '✓ 1',
    '✓',
    '✓',
    '✓ 20',
    '✓ 100',
    '✓ 200',
    '—',
    '✓ 1',
    '✓ 1',
    '—',
    '✓ 1',
    'Wall Mounted (Without Stand)',
    'Backdrop Wooden Frame (1)',
    '✓ 1',
    '✓ 1',
    '✓ 4',
    '—',
    '✓ 2',
    '✓ 4',
    'Spotlight 50W (2)',
    'Done',
    'Done',
    'Done',
    'Pending',
    'Done',
    '80% (4/5)',
  ];

  const dataRow = ws.addRow(rowData);
  dataRow.height = 22;
  dataRow.eachCell((cell, colNum) => {
    cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF18181B' } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE4E4E7' } },
      bottom: { style: 'thin', color: { argb: 'FFE4E4E7' } },
      left: { style: 'thin', color: { argb: 'FFE4E4E7' } },
      right: { style: 'thin', color: { argb: 'FFE4E4E7' } },
    };

    if (colNum === 2) {
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    } else {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }

    // Carpet color special styling
    if (colNum === 7) {
      if (cell.value === 'Blue') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }; // Soft pastel blue
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF1E40AF' } };
      }
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
  console.log('Sample cell G6 (Carpet):', readWb.worksheets[0].getCell('G6').value);
  fs.unlinkSync('tests/test_output.xlsx');
}

testWorkbookGeneration().catch((err) => {
  console.error(err);
  process.exit(1);
});
