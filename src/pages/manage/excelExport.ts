import ExcelJS from 'exceljs';
import { StallPrintData, BoothTask, BoothItemRecord, StallType } from './types';
import { sortBoothsByNumber } from './boothSort';
import { getStallTypeLabel, getWallConfigDisplay, getSectionStatus } from './StallChecklistSheet';

export interface EventExportMetadata {
  name: string;
  venue?: string | null;
  city?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

/**
 * Standardizes filename for Excel export.
 * Example: Tech_Expo_2026_Stall_Requirements.xlsx
 */
export function getExcelExportFilename(eventName: string, filterType?: string): string {
  const cleanEvent = (eventName || 'Exhibition')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (filterType === 'done') {
    return `${cleanEvent || 'Exhibition'}_Completed_Stall_Requirements.xlsx`;
  }
  if (filterType === 'in_progress') {
    return `${cleanEvent || 'Exhibition'}_InProgress_Stall_Requirements.xlsx`;
  }
  if (filterType === 'not_started') {
    return `${cleanEvent || 'Exhibition'}_NotStarted_Stall_Requirements.xlsx`;
  }
  if (filterType === 'discussions') {
    return `${cleanEvent || 'Exhibition'}_Ongoing_Discussions_Requirements.xlsx`;
  }
  return `${cleanEvent || 'Exhibition'}_Stall_Requirements.xlsx`;
}

/**
 * Extracts the recorded carpet color from booth production items.
 * Checks for "Carpet" item specification (e.g. "Color: Blue", "Color: Grey", "Red").
 * Returns "—" if no carpet item is recorded.
 */
export function extractCarpetColor(items: BoothItemRecord[] = []): string {
  const carpetItem = items.find((i) => (i.item_name || '').toLowerCase().includes('carpet'));
  if (!carpetItem) return '—';

  const spec = (carpetItem.specification || '').trim();
  if (!spec) return 'Standard';

  const lower = spec.toLowerCase();
  if (lower.includes('grey') || lower.includes('gray')) return 'Grey';
  if (lower.includes('blue')) return 'Blue';
  if (lower.includes('red')) return 'Red';

  const match = spec.match(/(?:color[:\s]*)([a-zA-Z0-9_\s-]+)/i);
  if (match && match[1]) {
    const rawColor = match[1].trim();
    return rawColor.charAt(0).toUpperCase() + rawColor.slice(1);
  }

  return spec;
}

/**
 * Checks for Wooden Platform Flooring in production items.
 */
export function extractFlooring(items: BoothItemRecord[] = []): string {
  const floorItem = items.find((i) => (i.item_name || '').toLowerCase().includes('flooring'));
  if (!floorItem) return '—';
  const qty = floorItem.quantity ?? 1;
  return qty > 1 ? `✓ ${qty}` : '✓';
}

/**
 * Helper to match item by keyword(s) and return "✓ Qty" or "—".
 */
export function extractItemRequirement(
  items: BoothItemRecord[] = [],
  keywords: string[]
): { found: boolean; text: string; matchedItem?: BoothItemRecord } {
  const matched = items.filter((i) => {
    const name = (i.item_name || '').toLowerCase();
    return keywords.some((k) => name.includes(k.toLowerCase()));
  });

  if (matched.length === 0) {
    return { found: false, text: '—' };
  }

  const totalQty = matched.reduce((sum, item) => sum + (item.quantity ?? 1), 0);
  return {
    found: true,
    text: `✓ ${totalQty}`,
    matchedItem: matched[0],
  };
}

/**
 * Extracts remaining custom items from a category that don't match standard keywords.
 */
export function extractOtherItems(
  items: BoothItemRecord[] = [],
  excludedKeywords: string[]
): string {
  const others = items.filter((i) => {
    const name = (i.item_name || '').toLowerCase();
    return !excludedKeywords.some((k) => name.includes(k.toLowerCase()));
  });

  if (others.length === 0) return '—';

  return others
    .map((i) => {
      const q = i.quantity ? ` (${i.quantity})` : '';
      const s = i.specification ? ` [${i.specification}]` : '';
      return `${i.item_name}${q}${s}`;
    })
    .join(', ');
}

/**
 * Extracts TV Mounting Type from TV items in production.
 */
export function extractTvMounting(items: BoothItemRecord[] = []): string {
  const tvItem = items.find((i) => (i.item_name || '').toLowerCase().includes('tv'));
  if (!tvItem) return '—';

  const spec = (tvItem.specification || '').trim();
  if (!spec) return 'Standard Mounting';

  const lower = spec.toLowerCase();
  if (lower.includes('wall')) return 'Wall Mounted';
  if (lower.includes('stand')) return 'With Stand';
  return spec;
}

/**
 * Calculates overall progress string excluding N/A sections.
 */
export function calculateOverallProgress(tasks: BoothTask[] = []): string {
  const mainSections = ['design', 'print', 'production', 'furniture', 'electrical'];
  let doneCount = 0;
  let naCount = 0;

  for (const sec of mainSections) {
    const st = getSectionStatus(tasks, sec);
    if (st === 'Done') doneCount++;
    else if (st === 'Not Required') naCount++;
  }

  const applicable = mainSections.length - naCount;
  if (applicable === 0) return 'No Applicable Tasks';

  const pct = Math.round((doneCount / applicable) * 100);
  return `${pct}% (${doneCount}/${applicable})${naCount > 0 ? ` • ${naCount} N/A` : ''}`;
}

/**
 * Builds the complete multi-worksheet Excel workbook.
 * Sheet 1: "Stall Requirements" (Complete event-wide landscape requirements matrix)
 * Sheet 2: "Print Summary" (Concise landscape printable overview)
 */
export async function generateStallRequirementsWorkbook(
  stalls: StallPrintData[],
  eventInfo: EventExportMetadata
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Reworkzone Exhibitions Operations';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Natural ascending sort by booth number
  const sortedStalls = sortBoothsByNumber(
    stalls.map((s) => ({
      ...s,
      booth_number: s.booth.booth_number,
      client_name: s.booth.client_name,
      id: s.booth.id,
    }))
  );

  // =========================================================================
  // WORKSHEET 1: MAIN MATRIX ("Stall Requirements")
  // =========================================================================
  const ws1 = workbook.addWorksheet('Stall Requirements', {
    pageSetup: {
      orientation: 'landscape',
      paperSize: 8 as any, // A3 landscape (code 8)
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: '4:5',
      horizontalCentered: true,
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.4,
        bottom: 0.4,
        header: 0.2,
        footer: 0.2,
      },
    },
    views: [{ state: 'frozen', xSplit: 2, ySplit: 5 }],
  });

  const TOTAL_COLUMNS = 36;
  const lastColLetter = 'AJ'; // Column 36 is AJ

  // Row 1: Document Header Title Banner
  ws1.mergeCells(`A1:${lastColLetter}1`);
  const r1 = ws1.getCell('A1');
  r1.value = 'REWORKZONE EXHIBITIONS — STALL PRODUCTION & REQUIREMENTS MATRIX';
  r1.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  r1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF18181B' } }; // Dark charcoal
  r1.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws1.getRow(1).height = 28;

  // Row 2: Event Subtitle Information
  ws1.mergeCells(`A2:${lastColLetter}2`);
  const r2 = ws1.getCell('A2');
  const dateStr =
    eventInfo.startDate && eventInfo.endDate
      ? `${eventInfo.startDate} to ${eventInfo.endDate}`
      : eventInfo.startDate || '';
  const venueStr = [eventInfo.venue, eventInfo.city].filter(Boolean).join(', ');
  r2.value = `Exhibition: ${eventInfo.name}  |  Venue: ${venueStr || 'Not Specified'}  |  Dates: ${dateStr || '—'}  |  Generated: ${new Date().toLocaleDateString('en-GB')}  |  Total Stalls: ${sortedStalls.length}`;
  r2.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF52525B' } };
  r2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F5' } };
  r2.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws1.getRow(2).height = 20;

  // Row 3: Thin visual spacer
  ws1.getRow(3).height = 6;

  // Row 4: Group Category Banners
  // A4:H4 -> BOOTH SPECIFICATIONS & STRUCTURE
  ws1.mergeCells('A4:H4');
  const g1 = ws1.getCell('A4');
  g1.value = 'BOOTH SPECIFICATIONS & STRUCTURE';
  g1.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
  g1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF27272A' } };
  g1.alignment = { vertical: 'middle', horizontal: 'center' };

  // I4:K4 -> DESIGN
  ws1.mergeCells('I4:K4');
  const g2 = ws1.getCell('I4');
  g2.value = 'DESIGN';
  g2.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF1E3A8A' } };
  g2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }; // Soft Blue
  g2.alignment = { vertical: 'middle', horizontal: 'center' };

  // L4:Q4 -> PRINTING & GOODIES
  ws1.mergeCells('L4:Q4');
  const g3 = ws1.getCell('L4');
  g3.value = 'PRINTING & GOODIES';
  g3.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF581C87' } };
  g3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } }; // Soft Purple
  g3.alignment = { vertical: 'middle', horizontal: 'center' };

  // R4:W4 -> PRODUCTION REQUIREMENTS
  ws1.mergeCells('R4:W4');
  const g4 = ws1.getCell('R4');
  g4.value = 'PRODUCTION REQUIREMENTS';
  g4.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF78350F' } };
  g4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Soft Amber
  g4.alignment = { vertical: 'middle', horizontal: 'center' };

  // X4:AA4 -> FURNITURE
  ws1.mergeCells('X4:AA4');
  const g5 = ws1.getCell('X4');
  g5.value = 'FURNITURE';
  g5.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF064E3B' } };
  g5.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; // Soft Emerald
  g5.alignment = { vertical: 'middle', horizontal: 'center' };

  // AB4:AD4 -> ELECTRICAL
  ws1.mergeCells('AB4:AD4');
  const g6 = ws1.getCell('AB4');
  g6.value = 'ELECTRICAL';
  g6.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF7C2D12' } };
  g6.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } }; // Soft Orange
  g6.alignment = { vertical: 'middle', horizontal: 'center' };

  // AE4:AJ4 -> CHECKLIST COMPLETION
  ws1.mergeCells('AE4:AJ4');
  const g7 = ws1.getCell('AE4');
  g7.value = 'CHECKLIST COMPLETION';
  g7.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF1F2937' } };
  g7.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }; // Soft Slate
  g7.alignment = { vertical: 'middle', horizontal: 'center' };

  ws1.getRow(4).height = 20;

  // Row 5: Column Headers (Ordered strictly per prompt & update specifications)
  const columns = [
    { header: 'Booth Number', key: 'booth_number', width: 14 },
    { header: 'Company Name', key: 'company_name', width: 30 },
    { header: 'Booth Size', key: 'stand_size', width: 12 },
    { header: 'Booth Type', key: 'booth_type', width: 14 },
    { header: 'Wall Configuration', key: 'wall_config', width: 22 },
    { header: 'Flooring Required', key: 'flooring', width: 15 },
    { header: 'Carpet Color', key: 'carpet_color', width: 14 },
    { header: 'Booking Stage', key: 'booking_stage', width: 16 },
    // Design
    { header: 'Client Side', key: 'design_client', width: 12 },
    { header: 'Our Side', key: 'design_our', width: 12 },
    { header: '3D View Available', key: 'view_3d', width: 16 },
    // Printing & Goodies
    { header: 'Print Files Link', key: 'print_link', width: 15 },
    { header: 'Print Files Ready', key: 'print_ready', width: 15 },
    { header: 'Book', key: 'goodies_book', width: 12 },
    { header: 'Pen', key: 'goodies_pen', width: 12 },
    { header: 'Leaflet', key: 'goodies_leaflet', width: 12 },
    { header: 'Other Goodies', key: 'goodies_other', width: 20 },
    // Production
    { header: 'Selfie Booth', key: 'prod_selfie', width: 13 },
    { header: 'Table Vinyl Branding', key: 'prod_table_vinyl', width: 18 },
    { header: 'TV 42"', key: 'prod_tv_42', width: 12 },
    { header: 'TV 50–55"', key: 'prod_tv_55', width: 13 },
    { header: 'TV Mounting Type', key: 'prod_tv_mounting', width: 18 },
    { header: 'Other Production Items', key: 'prod_other', width: 24 },
    // Furniture
    { header: 'Glass Round Table', key: 'furn_table', width: 16 },
    { header: '2 Seater Sofa', key: 'furn_sofa', width: 14 },
    { header: 'Chair', key: 'furn_chair', width: 12 },
    { header: 'Other Furniture', key: 'furn_other', width: 22 },
    // Electrical
    { header: 'Power Socket', key: 'elec_socket', width: 14 },
    { header: 'Permanent Light', key: 'elec_light', width: 15 },
    { header: 'Other Electrical Items', key: 'elec_other', width: 22 },
    // Checklist Completion
    { header: 'Design Done', key: 'chk_design', width: 13 },
    { header: 'Print Done', key: 'chk_print', width: 13 },
    { header: 'Production Done', key: 'chk_prod', width: 14 },
    { header: 'Furniture Done', key: 'chk_furn', width: 14 },
    { header: 'Electrical Done', key: 'chk_elec', width: 14 },
    { header: 'Overall Progress', key: 'chk_overall', width: 17 },
  ];

  // Set column widths
  columns.forEach((c, idx) => {
    ws1.getColumn(idx + 1).width = c.width;
  });

  const headerRow5 = ws1.addRow(columns.map((c) => c.header));
  headerRow5.height = 24;
  headerRow5.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF18181B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F5' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD4D4D8' } },
      bottom: { style: 'medium', color: { argb: 'FFA1A1AA' } },
      left: { style: 'thin', color: { argb: 'FFE4E4E7' } },
      right: { style: 'thin', color: { argb: 'FFE4E4E7' } },
    };
  });

  // Enable Excel AutoFilter across all columns on row 5
  ws1.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: 5, column: TOTAL_COLUMNS },
  };

  // Populate Stall Data Rows
  let currentRowNum = 6;
  for (const s of sortedStalls) {
    const { booth, tasks, productionItems, furnitureItems, electricalItems, goodiesItems, views3D } = s;

    // 1. Structure & Wall Config
    const boothType = getStallTypeLabel(booth.booth_type);
    const wallInfo = getWallConfigDisplay(booth.wall_configuration);
    const wallConfigText = wallInfo.label || '—';

    // 2. Flooring & Carpet
    const flooringText = extractFlooring(productionItems);
    const carpetColor = extractCarpetColor(productionItems);

    // 3. Booking Stage
    const isDiscussion = (booth.booking_stage || '').toLowerCase() === 'discussion';
    const stageText = isDiscussion ? 'Ongoing Discussion' : 'Confirmed';

    // 4. Design
    const resp = (booth.design_responsibility || '').toLowerCase();
    const isClientSide = resp.includes('client');
    const isOurSide = resp.includes('our');
    const has3D =
      (views3D && views3D.length > 0) ||
      (booth.main_drive_folder_url && booth.main_drive_folder_url.trim().startsWith('http'));
    const d3dText = views3D && views3D.length > 1 ? `✓ ${views3D.length}` : has3D ? '✓' : '—';

    // 5. Printing & Goodies
    const hasPrintLink = Boolean(
      (booth.print_drive_url && booth.print_drive_url.trim().startsWith('http')) ||
      (booth.main_drive_folder_url && booth.main_drive_folder_url.trim().startsWith('http'))
    );
    const printStatus = (booth.print_file_status || '').trim();
    const isPrintReady = printStatus.toLowerCase().includes('ready');
    const printReadyText = isPrintReady ? '✓ Ready' : printStatus || '—';

    const bookReq = extractItemRequirement(goodiesItems, ['book']);
    const penReq = extractItemRequirement(goodiesItems, ['pen']);
    const leafletReq = extractItemRequirement(goodiesItems, ['leaflet', 'brochure', 'flyer']);
    const otherGoodiesText = extractOtherItems(goodiesItems, ['book', 'pen', 'leaflet', 'brochure', 'flyer']);

    // 6. Production
    const selfieReq = extractItemRequirement(productionItems, ['selfie']);
    const tableVinylReq = extractItemRequirement(productionItems, ['table vinyl', 'vinyl branding', 'counter vinyl']);
    const tv42Req = extractItemRequirement(productionItems, ['42 inch', '42"', '42-inch']);
    const tv55Req = extractItemRequirement(productionItems, ['50 inch', '50–55', '50-55', '55 inch', '50-inch', '55"']);
    const tvMountingText = extractTvMounting(productionItems);
    const otherProdText = extractOtherItems(productionItems, [
      'flooring',
      'carpet',
      'selfie',
      'table vinyl',
      'vinyl branding',
      'counter vinyl',
      'tv',
      '42',
      '50',
      '55',
    ]);

    // 7. Furniture
    const tableReq = extractItemRequirement(furnitureItems, ['glass round', 'round table', 'table']);
    const sofaReq = extractItemRequirement(furnitureItems, ['sofa', 'seater']);
    const chairReq = extractItemRequirement(furnitureItems, ['chair']);
    const otherFurnText = extractOtherItems(furnitureItems, ['round table', 'glass round', 'sofa', 'seater', 'chair']);

    // 8. Electrical
    const socketReq = extractItemRequirement(electricalItems, ['socket', 'power']);
    const lightReq = extractItemRequirement(electricalItems, ['pelmet', 'permanent', 'palmenent', 'light']);
    const otherElecText = extractOtherItems(electricalItems, ['socket', 'power', 'pelmet', 'permanent', 'palmenent', 'light']);

    // 9. Checklist Completion
    const chkDesign = getSectionStatus(tasks, 'design');
    const chkPrint = getSectionStatus(tasks, 'print');
    const chkProd = getSectionStatus(tasks, 'production');
    const chkFurn = getSectionStatus(tasks, 'furniture');
    const chkElec = getSectionStatus(tasks, 'electrical');
    const chkOverall = calculateOverallProgress(tasks);

    // Row Data Array
    const rowValues = [
      booth.booth_number ? `#${booth.booth_number}` : 'Not Assigned',
      booth.client_name,
      booth.stand_size || '3 × 3 m',
      boothType,
      wallConfigText,
      flooringText,
      carpetColor,
      stageText,
      // Design
      isClientSide ? '✓' : '—',
      isOurSide ? '✓' : '—',
      d3dText,
      // Printing & Goodies
      hasPrintLink ? '✓' : '—',
      printReadyText,
      bookReq.text,
      penReq.text,
      leafletReq.text,
      otherGoodiesText,
      // Production
      selfieReq.text,
      tableVinylReq.text,
      tv42Req.text,
      tv55Req.text,
      tvMountingText,
      otherProdText,
      // Furniture
      tableReq.text,
      sofaReq.text,
      chairReq.text,
      otherFurnText,
      // Electrical
      socketReq.text,
      lightReq.text,
      otherElecText,
      // Checklist
      chkDesign,
      chkPrint,
      chkProd,
      chkFurn,
      chkElec,
      chkOverall,
    ];

    const dataRow = ws1.addRow(rowValues);
    dataRow.height = 20;

    const isEven = currentRowNum % 2 === 0;
    const baseBg = isEven ? 'FFFBFBFC' : 'FFFFFFFF'; // Subtle alternating row striping

    dataRow.eachCell((cell, colNum) => {
      cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF18181B' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE4E4E7' } },
        bottom: { style: 'thin', color: { argb: 'FFE4E4E7' } },
        left: { style: 'thin', color: { argb: 'FFE4E4E7' } },
        right: { style: 'thin', color: { argb: 'FFE4E4E7' } },
      };

      // Alignment rules
      if (colNum === 2) {
        // Company Name: Left-aligned
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      } else if (colNum === 17 || colNum === 23 || colNum === 27 || colNum === 30) {
        // Custom item columns: Left-aligned for clean readability
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      } else {
        // Requirements, ticks, status: Centered
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }

      // Default zebra background
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };

      // Highlighting: Carpet Color (Col 7)
      if (colNum === 7) {
        const val = String(cell.value || '').trim();
        if (val === 'Blue') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }; // Soft Pastel Blue
          cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF1E40AF' } };
        } else if (val === 'Red') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } }; // Soft Pastel Red
          cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFB91C1C' } };
        } else if (val === 'Grey' || val === 'Gray') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }; // Soft Cool Grey
          cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF374151' } };
        } else if (val !== '—') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Soft Warm Tint
          cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF92400E' } };
        }
      }

      // Highlighting: Booking Stage (Col 8)
      if (colNum === 8 && isDiscussion) {
        cell.font = { name: 'Segoe UI', size: 8.5, italic: true, color: { argb: 'FFD97706' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
      }

      // Highlighting: Checklist Done Statuses (Cols 31-35)
      if (colNum >= 31 && colNum <= 35) {
        const val = String(cell.value || '');
        if (val === 'Done') {
          cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF15803D' } }; // Green
        } else if (val === 'Not Required' || val === 'N/A') {
          cell.font = { name: 'Segoe UI', size: 8.5, color: { argb: 'FF71717A' } }; // Zinc
        } else {
          cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF18181B' } }; // Pending
        }
      }
    });

    currentRowNum++;
  }

  // =========================================================================
  // WORKSHEET 2: EXECUTIVE PRINT SUMMARY ("Print Summary")
  // Fits easily on a single A4 landscape sheet with essential columns
  // =========================================================================
  const ws2 = workbook.addWorksheet('Print Summary', {
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9, // A4 landscape
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: '3:3',
      horizontalCentered: true,
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.4,
        bottom: 0.4,
        header: 0.2,
        footer: 0.2,
      },
    },
    views: [{ state: 'frozen', xSplit: 2, ySplit: 3 }],
  });

  const SUMMARY_COLS = 13;
  const lastSummaryCol = 'M';

  // Title Banner
  ws2.mergeCells(`A1:${lastSummaryCol}1`);
  const sTitle = ws2.getCell('A1');
  sTitle.value = `REWORKZONE — ${eventInfo.name.toUpperCase()} STALL REQUIREMENTS SUMMARY`;
  sTitle.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  sTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF18181B' } };
  sTitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws2.getRow(1).height = 24;

  // Subtitle
  ws2.mergeCells(`A2:${lastSummaryCol}2`);
  const sSub = ws2.getCell('A2');
  sSub.value = `Venue: ${venueStr || '—'}  |  Dates: ${dateStr || '—'}  |  Export Date: ${new Date().toLocaleDateString('en-GB')}`;
  sSub.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF52525B' } };
  sSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F5' } };
  sSub.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws2.getRow(2).height = 18;

  const summaryHeaders = [
    { header: 'Booth #', width: 12 },
    { header: 'Company Name', width: 28 },
    { header: 'Size', width: 11 },
    { header: 'Type', width: 13 },
    { header: 'Wall Config', width: 20 },
    { header: 'Flooring', width: 11 },
    { header: 'Carpet Color', width: 13 },
    { header: 'Booking Stage', width: 14 },
    { header: '3D View', width: 11 },
    { header: 'Print Ready', width: 13 },
    { header: 'TV / Display', width: 18 },
    { header: 'Key Furniture', width: 22 },
    { header: 'Progress', width: 15 },
  ];

  summaryHeaders.forEach((c, idx) => {
    ws2.getColumn(idx + 1).width = c.width;
  });

  const sumHeaderRow = ws2.addRow(summaryHeaders.map((c) => c.header));
  sumHeaderRow.height = 22;
  sumHeaderRow.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF18181B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4E4E7' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD4D4D8' } },
      bottom: { style: 'medium', color: { argb: 'FFA1A1AA' } },
      left: { style: 'thin', color: { argb: 'FFE4E4E7' } },
      right: { style: 'thin', color: { argb: 'FFE4E4E7' } },
    };
  });

  ws2.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3, column: SUMMARY_COLS },
  };

  let sumRowIdx = 4;
  for (const s of sortedStalls) {
    const { booth, tasks, productionItems, furnitureItems, views3D } = s;

    const bType = getStallTypeLabel(booth.booth_type);
    const wInfo = getWallConfigDisplay(booth.wall_configuration);
    const fl = extractFlooring(productionItems);
    const cc = extractCarpetColor(productionItems);
    const isDisc = (booth.booking_stage || '').toLowerCase() === 'discussion';

    const has3d =
      (views3D && views3D.length > 0) ||
      (booth.main_drive_folder_url && booth.main_drive_folder_url.trim().startsWith('http'));

    const tvItems = productionItems.filter((i) => (i.item_name || '').toLowerCase().includes('tv'));
    const tvSummary =
      tvItems.length > 0
        ? tvItems.map((t) => `${t.item_name}${t.specification ? ` (${t.specification})` : ''}`).join(', ')
        : '—';

    const furnSummary =
      furnitureItems.length > 0
        ? furnitureItems.map((f) => `${f.item_name} (${f.quantity || 1})`).join(', ')
        : '—';

    const prog = calculateOverallProgress(tasks);

    const sumVals = [
      booth.booth_number ? `#${booth.booth_number}` : 'Not Assigned',
      booth.client_name,
      booth.stand_size || '3 × 3 m',
      bType,
      wInfo.label || '—',
      fl,
      cc,
      isDisc ? 'Discussion' : 'Confirmed',
      has3d ? '✓' : '—',
      (booth.print_file_status || '').toLowerCase().includes('ready') ? '✓ Ready' : booth.print_file_status || '—',
      tvSummary,
      furnSummary,
      prog,
    ];

    const r = ws2.addRow(sumVals);
    r.height = 19;
    const isEven = sumRowIdx % 2 === 0;

    r.eachCell((cell, colNum) => {
      cell.font = { name: 'Segoe UI', size: 8.5, color: { argb: 'FF18181B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFFBFBFC' : 'FFFFFFFF' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE4E4E7' } },
        bottom: { style: 'thin', color: { argb: 'FFE4E4E7' } },
        left: { style: 'thin', color: { argb: 'FFE4E4E7' } },
        right: { style: 'thin', color: { argb: 'FFE4E4E7' } },
      };

      if (colNum === 2 || colNum === 11 || colNum === 12) {
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }

      // Carpet Color pill styling
      if (colNum === 7) {
        const val = String(cell.value || '').trim();
        if (val === 'Blue') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
          cell.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FF1E40AF' } };
        } else if (val === 'Red') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
          cell.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FFB91C1C' } };
        } else if (val === 'Grey' || val === 'Gray') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
          cell.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FF374151' } };
        }
      }
    });

    sumRowIdx++;
  }

  return workbook;
}

/**
 * Triggers a browser download of the generated Excel workbook.
 */
export async function downloadWorkbookAsXlsx(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();

  // Defer cleanup so Chromium / Edge download manager completes stream without ERR_FILE_NOT_FOUND
  setTimeout(() => {
    try {
      if (document.body.contains(anchor)) {
        document.body.removeChild(anchor);
      }
      window.URL.revokeObjectURL(url);
    } catch (_) {}
  }, 30000);
}
