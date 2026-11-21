import ExcelJS from 'exceljs';
import {
  generateStallRequirementsWorkbook,
  extractCarpetColor,
  extractFlooring,
  extractTvMounting,
  calculateOverallProgress,
  getExcelExportFilename,
} from '../src/pages/manage/excelExport';
import { StallPrintData, BoothTask } from '../src/pages/manage/types';

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
  const mockCarpetBlue = [{ id: '1', booth_id: 'b1', category: 'production' as const, item_name: 'Carpet', specification: 'Color: Blue', quantity: 1 }];
  const mockCarpetRed = [{ id: '2', booth_id: 'b1', category: 'production' as const, item_name: 'Carpet', specification: 'Red', quantity: 1 }];
  const mockCarpetGrey = [{ id: '3', booth_id: 'b1', category: 'production' as const, item_name: 'Carpet', specification: 'Color: Grey', quantity: 1 }];
  const mockCarpetNone: any[] = [];

  if (extractCarpetColor(mockCarpetBlue) !== 'BLUE') throw new Error(`Carpet Blue failed: got ${extractCarpetColor(mockCarpetBlue)}`);
  if (extractCarpetColor(mockCarpetRed) !== 'RED') throw new Error(`Carpet Red failed: got ${extractCarpetColor(mockCarpetRed)}`);
  if (extractCarpetColor(mockCarpetGrey) !== 'GREY') throw new Error(`Carpet Grey failed: got ${extractCarpetColor(mockCarpetGrey)}`);
  if (extractCarpetColor(mockCarpetNone) !== '—') throw new Error('Carpet None failed');

  const mockFlooring = [{ id: '4', booth_id: 'b1', category: 'production' as const, item_name: 'Wooden Platform Flooring', quantity: 1 }];
  if (extractFlooring(mockFlooring) !== '1') throw new Error(`Flooring failed: expected 1, got ${extractFlooring(mockFlooring)}`);
  if (extractFlooring([]) !== '—') throw new Error('Flooring empty failed');

  // Test 3: Overall Progress calculation
  const tasksAllDone: BoothTask[] = [
    { id: 't1', booth_id: 'b1', task_name: '1. Design', phase: 'Design', status: 'completed', is_completed: 1, sort_order: 1, display_order: 1 },
    { id: 't2', booth_id: 'b1', task_name: '2. Print', phase: 'Print', status: 'completed', is_completed: 1, sort_order: 2, display_order: 2 },
    { id: 't3', booth_id: 'b1', task_name: '3. Production', phase: 'Production', status: 'completed', is_completed: 1, sort_order: 3, display_order: 3 },
    { id: 't4', booth_id: 'b1', task_name: '4. Furniture', phase: 'Furniture', status: 'not_applicable', is_completed: 0, sort_order: 4, display_order: 4 },
    { id: 't5', booth_id: 'b1', task_name: '5. Electrical', phase: 'Electrical', status: 'not_applicable', is_completed: 0, sort_order: 5, display_order: 5 },
  ];
  const prog1 = calculateOverallProgress(tasksAllDone);
  console.log('Progress 3 done + 2 NA:', prog1);
  if (!prog1.includes('100% (3/3)')) throw new Error('Overall progress formula failed');

  const tasksAllNA: BoothTask[] = [
    { id: 't1', booth_id: 'b1', task_name: '1. Design', phase: 'Design', status: 'not_applicable', is_completed: 0, sort_order: 1, display_order: 1 },
    { id: 't2', booth_id: 'b1', task_name: '2. Print', phase: 'Print', status: 'not_applicable', is_completed: 0, sort_order: 2, display_order: 2 },
    { id: 't3', booth_id: 'b1', task_name: '3. Production', phase: 'Production', status: 'not_applicable', is_completed: 0, sort_order: 3, display_order: 3 },
    { id: 't4', booth_id: 'b1', task_name: '4. Furniture', phase: 'Furniture', status: 'not_applicable', is_completed: 0, sort_order: 4, display_order: 4 },
    { id: 't5', booth_id: 'b1', task_name: '5. Electrical', phase: 'Electrical', status: 'not_applicable', is_completed: 0, sort_order: 5, display_order: 5 },
  ];
  const prog2 = calculateOverallProgress(tasksAllNA);
  console.log('Progress all NA:', prog2);
  if (prog2 !== 'No Applicable Tasks') throw new Error('All NA progress failed');

  // Test 4: Full Multi-Stall Workbook Generation matching Reference
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
        { id: 'l1', booth_id: 'bth_1', category: 'render_3d', title: 'Main 3D View', drive_url: 'https://claude.site/art1', version: '1', is_final: 1 },
      ],
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

  // Single worksheet expected as per reference specification
  if (wb.worksheets.length !== 1) throw new Error(`Expected exactly 1 worksheet, got ${wb.worksheets.length}`);
  const ws1 = wb.getWorksheet('Stall Requirements')!;

  console.log('WS1 Name:', ws1.name);
  console.log('WS1 Row Count:', ws1.rowCount);
  // Rows: 1: Title, 2: Subtitle, 3: Category Groups, 4: Column Headers, 5: A-01, 6: A-02, 7: B-10 -> 7 rows
  if (ws1.rowCount !== 7) throw new Error(`Expected 7 rows, got ${ws1.rowCount}`);

  // Natural sorting test: A-01 must come before A-02 before B-10!
  const r5Stall = ws1.getCell('C5').value;
  const r6Stall = ws1.getCell('C6').value;
  const r7Stall = ws1.getCell('C7').value;
  console.log(`Sorted Booths in Excel: ${r5Stall} -> ${r6Stall} -> ${r7Stall}`);
  if (r5Stall !== '#A-01' || r6Stall !== '#A-02' || r7Stall !== '#B-10') {
    throw new Error('Natural booth number sorting failed in Excel rows');
  }

  // Row 5 is Beta Dynamic Systems (A-01):
  // Col 1: Sr. No. = 1
  if (ws1.getCell('A5').value !== 1) throw new Error('Row 5 Sr. No. mismatch');
  // Col 2: Company Name
  if (ws1.getCell('B5').value !== 'Beta Dynamic Systems') throw new Error('Row 5 Company Name mismatch');
  // Col 4: Booth Type
  if (ws1.getCell('D5').value !== 'Frame') throw new Error('Row 5 Booth Type mismatch');
  // Col 5: Wall Configuration
  if (ws1.getCell('E5').value !== 'Back + Right') throw new Error(`Row 5 Wall Config mismatch: got ${ws1.getCell('E5').value}`);
  // Col 7: Flooring = '—'
  if (ws1.getCell('G5').value !== '—') throw new Error('Row 5 Flooring mismatch');
  // Col 8: Carpet = 'YES'
  if (ws1.getCell('H5').value !== 'YES') throw new Error('Row 5 Carpet mismatch');
  // Col 9: Carpet Color = 'GREY'
  if (ws1.getCell('I5').value !== 'GREY') throw new Error('Row 5 Carpet Color mismatch');
  // Col 12: TV 42" = '1'
  if (ws1.getCell('L5').value !== '1') throw new Error('Row 5 TV 42" mismatch');
  // Col 14: TV Mount = 'WITH STAND'
  if (ws1.getCell('N5').value !== 'WITH STAND') throw new Error('Row 5 TV Mount mismatch');
  // Col 16: 2-Seater Sofa = '1'
  if (ws1.getCell('P5').value !== '1') throw new Error('Row 5 Sofa mismatch');
  // Col 18: Power Socket = '1'
  if (ws1.getCell('R5').value !== '1') throw new Error('Row 5 Socket mismatch');

  // Row 6 is Alpha Technologies (A-02):
  // Col 1: Sr. No. = 2
  if (ws1.getCell('A6').value !== 2) throw new Error('Row 6 Sr. No. mismatch');
  // Col 2: Company Name
  if (ws1.getCell('B6').value !== 'Alpha Technologies') throw new Error('Row 6 Company Name mismatch');
  // Col 4: Booth Type = 'Wooden'
  if (ws1.getCell('D6').value !== 'Wooden') throw new Error('Row 6 Booth Type mismatch');
  // Col 5: Wall Config = '3 Sides'
  if (ws1.getCell('E6').value !== '3 Sides') throw new Error('Row 6 Wall Config mismatch');
  // Col 7: Flooring = '1'
  if (ws1.getCell('G6').value !== '1') throw new Error('Row 6 Flooring mismatch');
  // Col 8: Carpet = 'YES'
  if (ws1.getCell('H6').value !== 'YES') throw new Error('Row 6 Carpet mismatch');
  // Col 9: Carpet Color = 'BLUE'
  if (ws1.getCell('I6').value !== 'BLUE') throw new Error('Row 6 Carpet Color mismatch');
  // Col 12: TV 42" = '—'
  if (ws1.getCell('L6').value !== '—') throw new Error('Row 6 TV 42" mismatch');
  // Col 13: TV 50–55" = '1'
  if (ws1.getCell('M6').value !== '1') throw new Error('Row 6 TV 55" mismatch');
  // Col 14: TV Mount = 'WALL MOUNT'
  if (ws1.getCell('N6').value !== 'WALL MOUNT') throw new Error('Row 6 TV Mount mismatch');
  // Col 15: Glass Round Table = '1'
  if (ws1.getCell('O6').value !== '1') throw new Error('Row 6 Round Table mismatch');
  // Col 17: Chair = '4'
  if (ws1.getCell('Q6').value !== '4') throw new Error('Row 6 Chair mismatch');
  // Col 18: Power Socket = '2'
  if (ws1.getCell('R6').value !== '2') throw new Error('Row 6 Socket mismatch');
  // Col 19: Permanent Light = '4'
  if (ws1.getCell('S6').value !== '4') throw new Error('Row 6 Permanent Light mismatch');
  // Col 20: Print Files = 'YES'
  if (ws1.getCell('T6').value !== 'YES') throw new Error('Row 6 Print Files mismatch');
  // Col 21: Book = '50'
  if (ws1.getCell('U6').value !== '50') throw new Error('Row 6 Book mismatch');
  // Col 22: Pen = '100'
  if (ws1.getCell('V6').value !== '100') throw new Error('Row 6 Pen mismatch');
  // Col 25: Other Requirements = 'Backdrop Frame (1)'
  if (ws1.getCell('Y6').value !== 'Backdrop Frame (1)') throw new Error(`Row 6 Other Reqs mismatch: got ${ws1.getCell('Y6').value}`);

  // Row 7 is Gamma Ongoing Ventures (B-10) with all tasks N/A:
  // Col 7: Flooring = 'N/A'
  if (ws1.getCell('G7').value !== 'N/A') throw new Error('Row 7 Flooring N/A mismatch');
  // Col 8: Carpet = 'N/A'
  if (ws1.getCell('H7').value !== 'N/A') throw new Error('Row 7 Carpet N/A mismatch');
  // Col 9: Carpet Color = 'N/A'
  if (ws1.getCell('I7').value !== 'N/A') throw new Error('Row 7 Carpet Color N/A mismatch');
  // Col 15: Glass Round Table = 'N/A'
  if (ws1.getCell('O7').value !== 'N/A') throw new Error('Row 7 Furniture N/A mismatch');
  // Col 18: Power Socket = 'N/A'
  if (ws1.getCell('R7').value !== 'N/A') throw new Error('Row 7 Electrical N/A mismatch');

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
