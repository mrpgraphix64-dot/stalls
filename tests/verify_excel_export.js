import ExcelJS from 'exceljs';
import fs from 'fs';
import {
  generateStallRequirementsWorkbook,
  extractCarpetColor,
  extractFlooring,
  extractTvMounting,
  calculateOverallProgress,
  getExcelExportFilename,
} from '../src/pages/manage/excelExport.js';

async function runVerification() {
  console.log('=== VERIFY EXCEL EXPORT WORKBOOK GENERATION ===');

  // Test 1: Filename generation
  const fn1 = getExcelExportFilename('Tech Expo 2026', 'all');
  const fn2 = getExcelExportFilename('Tech Expo 2026', 'done');
  const fn3 = getExcelExportFilename('Tech Expo 2026', 'in_progress');
  const fn4 = getExcelExportFilename('Tech Expo 2026', 'discussions');
  console.log('Filename all:', fn1);
  console.log('Filename done:', fn2);
  if (fn1 !== 'Tech_Expo_2026_Stall_Requirements.xlsx') throw new Error('Filename all mismatch');
  if (fn2 !== 'Tech_Expo_2026_Completed_Stall_Requirements.xlsx') throw new Error('Filename done mismatch');
  if (fn3 !== 'Tech_Expo_2026_InProgress_Stall_Requirements.xlsx') throw new Error('Filename in_progress mismatch');
  if (fn4 !== 'Tech_Expo_2026_Ongoing_Discussions_Requirements.xlsx') throw new Error('Filename discussions mismatch');

  // Test 2: Carpet Color & Flooring extraction
  const mockCarpetBlue = [{ id: '1', booth_id: 'b1', category: 'production', item_name: 'Carpet', specification: 'Color: Blue', quantity: 1 }];
  const mockCarpetRed = [{ id: '2', booth_id: 'b1', category: 'production', item_name: 'Carpet', specification: 'Red', quantity: 1 }];
  const mockCarpetGrey = [{ id: '3', booth_id: 'b1', category: 'production', item_name: 'Carpet', specification: 'Color: Grey', quantity: 1 }];
  const mockCarpetNone = [];

  if (extractCarpetColor(mockCarpetBlue) !== 'Blue') throw new Error('Carpet Blue failed');
  if (extractCarpetColor(mockCarpetRed) !== 'Red') throw new Error('Carpet Red failed');
  if (extractCarpetColor(mockCarpetGrey) !== 'Grey') throw new Error('Carpet Grey failed');
  if (extractCarpetColor(mockCarpetNone) !== '—') throw new Error('Carpet None failed');

  const mockFlooring = [{ id: '4', booth_id: 'b1', category: 'production', item_name: 'Wooden Platform Flooring', quantity: 1 }];
  if (extractFlooring(mockFlooring) !== '✓') throw new Error('Flooring failed');
  if (extractFlooring([]) !== '—') throw new Error('Flooring empty failed');

  // Test 3: Overall Progress calculation
  const tasksAllDone = [
    { id: 't1', task_name: '1. Design', status: 'completed', is_completed: 1 },
    { id: 't2', task_name: '2. Print', status: 'completed', is_completed: 1 },
    { id: 't3', task_name: '3. Production', status: 'completed', is_completed: 1 },
    { id: 't4', task_name: '4. Furniture', status: 'not_applicable', is_completed: 0 },
    { id: 't5', task_name: '5. Electrical', status: 'not_applicable', is_completed: 0 },
  ];
  const prog1 = calculateOverallProgress(tasksAllDone);
  console.log('Progress 3 done + 2 NA:', prog1);
  if (!prog1.includes('100% (3/3)')) throw new Error('Overall progress formula failed');

  const tasksAllNA = [
    { id: 't1', task_name: '1. Design', status: 'not_applicable', is_completed: 0 },
    { id: 't2', task_name: '2. Print', status: 'not_applicable', is_completed: 0 },
    { id: 't3', task_name: '3. Production', status: 'not_applicable', is_completed: 0 },
    { id: 't4', task_name: '4. Furniture', status: 'not_applicable', is_completed: 0 },
    { id: 't5', task_name: '5. Electrical', status: 'not_applicable', is_completed: 0 },
  ];
  const prog2 = calculateOverallProgress(tasksAllNA);
  console.log('Progress all NA:', prog2);
  if (prog2 !== 'No Applicable Tasks') throw new Error('All NA progress failed');

  // Test 4: Full Multi-Stall Workbook Generation
  const mockStalls = [
    {
      booth: {
        id: 'bth_1',
        booth_number: 'A-02',
        client_name: 'Alpha Technologies',
        stand_size: '6 × 3 m',
        booth_type: 'Wooden',
        wall_configuration: '3 Sides',
        booking_stage: 'confirmed',
        design_responsibility: 'Client Side',
        print_drive_url: 'https://drive.google.com/print_alpha',
        print_file_status: 'All Files Ready',
      },
      eventName: 'Tech Expo 2026',
      tasks: tasksAllDone,
      productionItems: [
        { id: 'p1', booth_id: 'bth_1', category: 'production', item_name: 'Wooden Platform Flooring', quantity: 1 },
        { id: 'p2', booth_id: 'bth_1', category: 'production', item_name: 'Carpet', specification: 'Color: Blue', quantity: 1 },
        { id: 'p3', booth_id: 'bth_1', category: 'production', item_name: 'TV — 50–55 inch', specification: 'Wall Mounted (Without Stand)', quantity: 1 },
        { id: 'p4', booth_id: 'bth_1', category: 'production', item_name: 'Backdrop Frame', quantity: 1 },
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
      views3D: [
        { id: 'l1', booth_id: 'bth_1', category: 'render_3d', title: 'Main 3D View', drive_url: 'https://claude.site/art1' },
      ],
    },
    {
      booth: {
        id: 'bth_2',
        booth_number: 'A-01',
        client_name: 'Beta Dynamic Systems',
        stand_size: '3 × 3 m',
        booth_type: 'Frame',
        wall_configuration: '2 Sides - Back + Right',
        booking_stage: 'confirmed',
        design_responsibility: 'Our Side',
        print_drive_url: null,
        print_file_status: 'Designs Pending',
      },
      eventName: 'Tech Expo 2026',
      tasks: [],
      productionItems: [
        { id: 'p5', booth_id: 'bth_2', category: 'production', item_name: 'Carpet', specification: 'Color: Grey', quantity: 1 },
        { id: 'p6', booth_id: 'bth_2', category: 'production', item_name: 'TV — 42 inch', specification: 'With Stand', quantity: 1 },
      ],
      furnitureItems: [
        { id: 'f3', booth_id: 'bth_2', category: 'furniture', item_name: '2 Seater Sofa', quantity: 1 },
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
        booth_number: 'B-10',
        client_name: 'Gamma Ongoing Ventures',
        stand_size: '4 × 3 m',
        booth_type: 'Customize',
        wall_configuration: 'Back Wall Only',
        booking_stage: 'discussion',
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

  if (wb.worksheets.length !== 2) throw new Error('Expected 2 worksheets (Stall Requirements & Print Summary)');
  const ws1 = wb.getWorksheet('Stall Requirements');
  const ws2 = wb.getWorksheet('Print Summary');

  // Verify Worksheet 1:
  console.log('WS1 Name:', ws1.name);
  console.log('WS1 Row Count:', ws1.rowCount);
  if (ws1.rowCount !== 8) throw new Error(`Expected 8 rows (title, sub, spacer, group, headers, 3 stalls), got ${ws1.rowCount}`);

  // Natural sorting test: A-01 must come before A-02 before B-10!
  const r6Booth = ws1.getCell('A6').value;
  const r7Booth = ws1.getCell('A7').value;
  const r8Booth = ws1.getCell('A8').value;
  console.log(`Sorted Booths in Excel: ${r6Booth} -> ${r7Booth} -> ${r8Booth}`);
  if (r6Booth !== '#A-01' || r7Booth !== '#A-02' || r8Booth !== '#B-10') {
    throw new Error('Natural booth number sorting failed in Excel rows');
  }

  // Row 6 is Beta Dynamic Systems (A-01):
  // Col 4: Booth Type
  if (ws1.getCell('D6').value !== 'Frame') throw new Error('Row 6 Booth Type mismatch');
  // Col 5: Wall Configuration
  if (!String(ws1.getCell('E6').value).includes('Right')) throw new Error('Row 6 Wall Config mismatch');
  // Col 6: Flooring Required
  if (ws1.getCell('F6').value !== '—') throw new Error('Row 6 Flooring mismatch (expected —)');
  // Col 7: Carpet Color
  if (ws1.getCell('G6').value !== 'Grey') throw new Error('Row 6 Carpet Color mismatch');
  // Col 8: Booking Stage
  if (ws1.getCell('H6').value !== 'Confirmed') throw new Error('Row 6 Booking Stage mismatch');

  // Row 7 is Alpha Technologies (A-02):
  // Col 4: Booth Type
  if (ws1.getCell('D7').value !== 'Wooden') throw new Error('Row 7 Booth Type mismatch');
  // Col 5: Wall Config
  if (!String(ws1.getCell('E7').value).includes('3 Sides')) throw new Error('Row 7 Wall Config mismatch');
  // Col 6: Flooring Required
  if (ws1.getCell('F7').value !== '✓') throw new Error('Row 7 Flooring mismatch (expected ✓)');
  // Col 7: Carpet Color
  if (ws1.getCell('G7').value !== 'Blue') throw new Error('Row 7 Carpet Color mismatch');
  // Col 21: TV 50–55"
  if (ws1.getCell('U7').value !== '✓ 1') throw new Error('Row 7 TV 55" mismatch');
  // Col 22: TV Mounting
  if (!String(ws1.getCell('V7').value).includes('Wall Mounted')) throw new Error('Row 7 TV Mounting mismatch');
  // Col 26: Chair
  if (ws1.getCell('Z7').value !== '✓ 4') throw new Error('Row 7 Chair mismatch');

  // Row 8 is Gamma Ongoing Ventures (B-10):
  // Col 7: Carpet Color
  if (ws1.getCell('G8').value !== '—') throw new Error('Row 8 Carpet Color mismatch (expected —)');
  // Col 8: Booking Stage
  if (ws1.getCell('H8').value !== 'Ongoing Discussion') throw new Error('Row 8 Booking Stage mismatch');
  // Col 36: Progress
  if (ws1.getCell('AJ8').value !== 'No Applicable Tasks') throw new Error('Row 8 Progress mismatch');

  // Verify writeBuffer creates valid bytes
  const buf = await wb.xlsx.writeBuffer();
  console.log('Workbook buffer byte length:', buf.byteLength);
  if (buf.byteLength < 5000) throw new Error('Generated XLSX buffer size abnormally small');

  console.log('\n[SUCCESS] All Node.js Excel workbook generation assertions passed!\n');
}

runVerification().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
