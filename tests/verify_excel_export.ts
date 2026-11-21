import ExcelJS from 'exceljs';
import {
  generateStallRequirementsWorkbook,
  extractCarpetColor,
  extractFlooring,
  extractTvMounting,
  deriveStallShape,
  formatTvRequirements,
  formatSofaRequirements,
  formatSpecialRequirements,
  calculateOverallProgress,
  getExcelExportFilename,
} from '../src/pages/manage/excelExport';
import { StallPrintData, BoothTask } from '../src/pages/manage/types';

async function runVerification() {
  console.log('=== VERIFY REFINED 23-COLUMN EXCEL EXPORT WORKBOOK GENERATION ===');

  // Test 1: Filename generation
  const fn1 = getExcelExportFilename('Tech Expo 2026', 'all');
  const fn2 = getExcelExportFilename('Tech Expo 2026', 'done');
  if (fn1 !== 'Tech_Expo_2026_Stall_Requirements.xlsx') throw new Error('Filename all mismatch');
  if (fn2 !== 'Tech_Expo_2026_Completed_Stall_Requirements.xlsx') throw new Error('Filename done mismatch');

  // Test 2: deriveStallShape
  if (deriveStallShape('3 Sides') !== 'C Shape / U Shape') throw new Error('Stall shape 3 Sides mismatch');
  if (deriveStallShape('3_sides') !== 'C Shape / U Shape') throw new Error('Stall shape 3_sides mismatch');
  if (deriveStallShape('Back + Left') !== 'L Shape') throw new Error('Stall shape Back + Left mismatch');
  if (deriveStallShape('2 Sides - Back + Right') !== 'L Shape') throw new Error('Stall shape Back + Right mismatch');
  if (deriveStallShape('Back Wall Only') !== 'Back Wall Only') throw new Error('Stall shape Back Wall Only mismatch');
  if (deriveStallShape('Back Only') !== 'Back Wall Only') throw new Error('Stall shape Back Only mismatch');
  if (deriveStallShape('') !== 'Not Specified') throw new Error('Stall shape empty mismatch');
  if (deriveStallShape(null) !== 'Not Specified') throw new Error('Stall shape null mismatch');

  // Test 3: formatTvRequirements
  const mockTvSingle = [
    { id: '1', booth_id: 'b1', category: 'production' as const, item_name: 'TV — 42 inch', specification: 'With Stand', quantity: 1 },
  ];
  const tvSingleResult = formatTvRequirements(mockTvSingle, false);
  console.log('TV single result:', tvSingleResult);
  if (tvSingleResult !== '42" × 1 — With Stand') throw new Error(`TV single failed: got ${tvSingleResult}`);

  const mockTvMultiple = [
    { id: '1', booth_id: 'b1', category: 'production' as const, item_name: 'TV — 42 inch', specification: 'Wall Mount', quantity: 1 },
    { id: '2', booth_id: 'b1', category: 'production' as const, item_name: 'TV — 50–55 inch', specification: 'With Stand', quantity: 1 },
  ];
  const tvMultiResult = formatTvRequirements(mockTvMultiple, false);
  console.log('TV multiple result:\n' + tvMultiResult);
  if (!tvMultiResult.includes('42" × 1 — Wall Mount') || !tvMultiResult.includes('50–55" × 1 — With Stand')) {
    throw new Error('TV multiple failed');
  }

  // Test 4: formatSofaRequirements
  const mockSofaCombined = [
    { id: '1', booth_id: 'b1', category: 'furniture' as const, item_name: '1-Seater Sofa', quantity: 2 },
    { id: '2', booth_id: 'b1', category: 'furniture' as const, item_name: '2-Seater Sofa', quantity: 1 },
  ];
  const sofaResult = formatSofaRequirements(mockSofaCombined, false);
  console.log('Sofa combined result:\n' + sofaResult);
  if (!sofaResult.includes('1-Seater × 2') || !sofaResult.includes('2-Seater × 1')) {
    throw new Error('Sofa combined failed');
  }

  // Test 5: formatSpecialRequirements (Selfie Booth + Custom items)
  const mockSpecialProd = [
    { id: 'p1', booth_id: 'b1', category: 'production' as const, item_name: 'Selfie Booth', quantity: 1 },
    { id: 'p2', booth_id: 'b1', category: 'production' as const, item_name: 'Acrylic Logo', quantity: 2 },
  ];
  const mockSpecialFurn = [
    { id: 'f1', booth_id: 'b1', category: 'furniture' as const, item_name: 'Bar Stool', quantity: 2 },
  ];
  const specialResult = formatSpecialRequirements(mockSpecialProd, mockSpecialFurn, []);
  console.log('Special requirements result:\n' + specialResult);
  if (!specialResult.includes('Selfie Booth × 1') || !specialResult.includes('Acrylic Logo × 2') || !specialResult.includes('Bar Stool × 2')) {
    throw new Error('Special requirements failed');
  }

  // Test 6: Full Multi-Stall Workbook Generation matching 23-column reference
  const tasksAllDone: BoothTask[] = [
    { id: 't1', booth_id: 'b1', task_name: '1. Design', phase: 'Design', status: 'completed', is_completed: 1, sort_order: 1, display_order: 1 },
    { id: 't2', booth_id: 'b1', task_name: '2. Print', phase: 'Print', status: 'completed', is_completed: 1, sort_order: 2, display_order: 2 },
    { id: 't3', booth_id: 'b1', task_name: '3. Production', phase: 'Production', status: 'completed', is_completed: 1, sort_order: 3, display_order: 3 },
    { id: 't4', booth_id: 'b1', task_name: '4. Furniture', phase: 'Furniture', status: 'not_applicable', is_completed: 0, sort_order: 4, display_order: 4 },
    { id: 't5', booth_id: 'b1', task_name: '5. Electrical', phase: 'Electrical', status: 'not_applicable', is_completed: 0, sort_order: 5, display_order: 5 },
  ];

  const tasksAllNA: BoothTask[] = [
    { id: 't1', booth_id: 'b1', task_name: '1. Design', phase: 'Design', status: 'not_applicable', is_completed: 0, sort_order: 1, display_order: 1 },
    { id: 't2', booth_id: 'b1', task_name: '2. Print', phase: 'Print', status: 'not_applicable', is_completed: 0, sort_order: 2, display_order: 2 },
    { id: 't3', booth_id: 'b1', task_name: '3. Production', phase: 'Production', status: 'not_applicable', is_completed: 0, sort_order: 3, display_order: 3 },
    { id: 't4', booth_id: 'b1', task_name: '4. Furniture', phase: 'Furniture', status: 'not_applicable', is_completed: 0, sort_order: 4, display_order: 4 },
    { id: 't5', booth_id: 'b1', task_name: '5. Electrical', phase: 'Electrical', status: 'not_applicable', is_completed: 0, sort_order: 5, display_order: 5 },
  ];

  const mockStalls: StallPrintData[] = [
    {
      booth: {
        id: 'bth_1',
        event_id: 'evt_1',
        booth_number: 'A-02',
        client_name: 'Alpha Technologies',
        stand_size: '6 × 3 m',
        booth_type: 'Wooden',
        wall_configuration: '3 Sides',
        booking_stage: 'confirmed',
        design_responsibility: 'Client Side',
        print_drive_url: 'https://drive.google.com/print_alpha',
        print_file_status: 'All Files Ready',
        status: 'confirmed',
      },
      eventName: 'Tech Expo 2026',
      tasks: tasksAllDone,
      productionItems: [
        { id: 'p1', booth_id: 'bth_1', category: 'production', item_name: 'Wooden Platform Flooring', quantity: 1 },
        { id: 'p2', booth_id: 'bth_1', category: 'production', item_name: 'Carpet', specification: 'Color: Blue', quantity: 1 },
        { id: 'p3', booth_id: 'bth_1', category: 'production', item_name: 'TV — 50–55 inch', specification: 'Wall Mounted (Without Stand)', quantity: 1 },
        { id: 'p4', booth_id: 'bth_1', category: 'production', item_name: 'Backdrop Frame', quantity: 1 },
        { id: 'p5', booth_id: 'bth_1', category: 'production', item_name: 'Selfie Booth', quantity: 1 },
      ],
      furnitureItems: [
        { id: 'f1', booth_id: 'bth_1', category: 'furniture', item_name: 'Glass Round Table', quantity: 1 },
        { id: 'f2', booth_id: 'bth_1', category: 'furniture', item_name: 'Chair', quantity: 4 },
      ],
      electricalItems: [
        { id: 'e1', booth_id: 'bth_1', category: 'electrical', item_name: 'Power Socket', quantity: 2 },
        { id: 'e2', booth_id: 'bth_1', category: 'electrical', item_name: 'Pelmet Light', quantity: 4 },
      ],
      goodiesItems: [
        { id: 'g1', booth_id: 'bth_1', category: 'goodies', item_name: 'Book', quantity: 50 },
        { id: 'g2', booth_id: 'bth_1', category: 'goodies', item_name: 'Pen', quantity: 100 },
      ],
      views3D: [],
    },
    {
      booth: {
        id: 'bth_2',
        event_id: 'evt_1',
        booth_number: 'A-01',
        client_name: 'Beta Dynamic Systems',
        stand_size: '3 × 3 m',
        booth_type: 'Frame',
        wall_configuration: '2 Sides - Back + Right',
        booking_stage: 'confirmed',
        design_responsibility: 'Our Side',
        print_drive_url: null,
        print_file_status: 'Designs Pending',
        status: 'confirmed',
      },
      eventName: 'Tech Expo 2026',
      tasks: [],
      productionItems: [
        { id: 'p6', booth_id: 'bth_2', category: 'production', item_name: 'Carpet', specification: 'Color: Grey', quantity: 1 },
        { id: 'p7', booth_id: 'bth_2', category: 'production', item_name: 'TV — 42 inch', specification: 'With Stand', quantity: 1 },
      ],
      furnitureItems: [
        { id: 'f3', booth_id: 'bth_2', category: 'furniture', item_name: '1-Seater Sofa', quantity: 2 },
        { id: 'f4', booth_id: 'bth_2', category: 'furniture', item_name: '2-Seater Sofa', quantity: 1 },
      ],
      electricalItems: [
        { id: 'e3', booth_id: 'bth_2', category: 'electrical', item_name: 'Power Socket', quantity: 1 },
      ],
      goodiesItems: [],
      views3D: [],
    },
    {
      booth: {
        id: 'bth_3',
        event_id: 'evt_1',
        booth_number: 'B-10',
        client_name: 'Gamma Ongoing Ventures',
        stand_size: '4 × 3 m',
        booth_type: 'Customize',
        wall_configuration: 'Back Wall Only',
        booking_stage: 'discussion',
        status: 'draft',
      },
      eventName: 'Tech Expo 2026',
      tasks: tasksAllNA,
      productionItems: [],
      furnitureItems: [],
      electricalItems: [],
      goodiesItems: [],
      views3D: [],
    },
  ];

  const eventMetadata = {
    name: 'Tech Expo 2026',
    venue: 'Convention Center',
    city: 'Mumbai',
    startDate: '2026-12-10',
    endDate: '2026-12-14',
  };

  const wb = await generateStallRequirementsWorkbook(mockStalls, eventMetadata);

  if (wb.worksheets.length !== 1) throw new Error(`Expected exactly 1 worksheet, got ${wb.worksheets.length}`);
  const ws = wb.getWorksheet('Stall Requirements')!;

  console.log('WS Name:', ws.name);
  console.log('WS Row Count:', ws.rowCount);
  console.log('WS Col Count:', ws.columnCount);

  // Verify exactly 23 columns
  const expectedHeaders = [
    'Sr. No.',
    'Company Name',
    'Stall No.',
    'Stall Shape',
    'Booth Type',
    'Wall Configuration',
    'Size',
    'Wooden Platform Flooring',
    'Carpet',
    'Carpet Color',
    'Table Vinyl Branding',
    'TV',
    'Glass Round Table',
    'Sofa',
    'Chair',
    'Power Socket',
    'Permanent Light',
    'Print Files',
    'Book',
    'Pen',
    'Leaflet',
    'Other Goodies',
    'Special Requirements',
  ];

  if (expectedHeaders.length !== 23) throw new Error('Expected 23 columns in specification');

  for (let c = 1; c <= 23; c++) {
    const h = ws.getCell(4, c).value;
    if (h !== expectedHeaders[c - 1]) {
      throw new Error(`Column ${c} header mismatch: expected "${expectedHeaders[c - 1]}", got "${h}"`);
    }
  }

  // Row 5 is Beta Dynamic Systems (A-01):
  // Col 1: Sr. No. = 1
  if (ws.getCell('A5').value !== 1) throw new Error('Row 5 Sr. No. mismatch');
  // Col 2: Company Name
  if (ws.getCell('B5').value !== 'Beta Dynamic Systems') throw new Error('Row 5 Company Name mismatch');
  // Col 3: Stall No.
  if (ws.getCell('C5').value !== '#A-01') throw new Error('Row 5 Stall No mismatch');
  // Col 4: Stall Shape = 'L Shape' (derived from '2 Sides - Back + Right')
  if (ws.getCell('D5').value !== 'L Shape') throw new Error(`Row 5 Stall Shape mismatch: got ${ws.getCell('D5').value}`);
  // Col 5: Booth Type = 'Frame'
  if (ws.getCell('E5').value !== 'Frame') throw new Error('Row 5 Booth Type mismatch');
  // Col 6: Wall Configuration = 'Back + Right'
  if (ws.getCell('F5').value !== 'Back + Right') throw new Error(`Row 5 Wall Config mismatch: got ${ws.getCell('F5').value}`);
  // Col 8: Flooring = '—'
  if (ws.getCell('H5').value !== '—') throw new Error('Row 5 Flooring mismatch');
  // Col 9: Carpet = 'YES'
  if (ws.getCell('I5').value !== 'YES') throw new Error('Row 5 Carpet mismatch');
  // Col 10: Carpet Color = 'GREY'
  if (ws.getCell('J5').value !== 'GREY') throw new Error('Row 5 Carpet Color mismatch');
  // Col 12: TV = '42" × 1 — With Stand'
  if (ws.getCell('L5').value !== '42" × 1 — With Stand') throw new Error(`Row 5 TV mismatch: got ${ws.getCell('L5').value}`);
  // Col 14: Sofa = '1-Seater × 2\n2-Seater × 1'
  const r5Sofa = String(ws.getCell('N5').value);
  if (!r5Sofa.includes('1-Seater × 2') || !r5Sofa.includes('2-Seater × 1')) {
    throw new Error(`Row 5 Sofa mismatch: got ${r5Sofa}`);
  }

  // Row 6 is Alpha Technologies (A-02):
  // Col 4: Stall Shape = 'C Shape / U Shape' (derived from '3 Sides')
  if (ws.getCell('D6').value !== 'C Shape / U Shape') throw new Error(`Row 6 Stall Shape mismatch: got ${ws.getCell('D6').value}`);
  // Col 5: Booth Type = 'Wooden'
  if (ws.getCell('E6').value !== 'Wooden') throw new Error('Row 6 Booth Type mismatch');
  // Col 6: Wall Config = '3 Sides'
  if (ws.getCell('F6').value !== '3 Sides') throw new Error('Row 6 Wall Config mismatch');
  // Col 10: Carpet Color = 'BLUE'
  if (ws.getCell('J6').value !== 'BLUE') throw new Error('Row 6 Carpet Color mismatch');
  // Col 12: TV = '50–55" × 1 — Wall Mount'
  if (ws.getCell('L6').value !== '50–55" × 1 — Wall Mount') throw new Error(`Row 6 TV mismatch: got ${ws.getCell('L6').value}`);
  // Col 23: Special Requirements contains 'Selfie Booth × 1' and 'Backdrop Frame × 1'
  const r6Special = String(ws.getCell('W6').value);
  console.log('Row 6 Special Requirements:\n' + r6Special);
  if (!r6Special.includes('Selfie Booth × 1') || !r6Special.includes('Backdrop Frame × 1')) {
    throw new Error(`Row 6 Special Requirements mismatch: got ${r6Special}`);
  }

  // Row 7 is Gamma Ongoing Ventures (B-10) with Back Wall Only:
  // Col 4: Stall Shape = 'Back Wall Only'
  if (ws.getCell('D7').value !== 'Back Wall Only') throw new Error(`Row 7 Stall Shape mismatch: got ${ws.getCell('D7').value}`);
  // Col 6: Wall Config = 'Back Only'
  if (ws.getCell('F7').value !== 'Back Only') throw new Error(`Row 7 Wall Config mismatch: got ${ws.getCell('F7').value}`);

  // Verify writeBuffer creates valid bytes
  const buf = await wb.xlsx.writeBuffer();
  console.log('Workbook buffer byte length:', buf.byteLength);
  if (buf.byteLength < 5000) throw new Error('Generated XLSX buffer size abnormally small');

  console.log('\n[SUCCESS] All Refined 23-Column Excel workbook generation assertions passed!\n');
}

runVerification().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
