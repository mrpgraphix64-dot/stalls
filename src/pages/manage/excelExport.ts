import ExcelJS from 'exceljs';
import { StallPrintData, BoothTask, BoothItemRecord } from './types';
import { sortBoothsByNumber } from './boothSort';
import { getStallTypeLabel, getSectionStatus } from './StallChecklistSheet';

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
 * Formats Wall Configuration cleanly for Master Stall Detail export.
 * 3 Sides / Back + Left / Back + Right / Back Only
 */
export function formatWallConfigForExcel(raw?: string | null): string {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return '—';
  const s = raw.trim().toLowerCase();
  if (s.includes('3 side')) return '3 Sides';
  if (s.includes('back + left') || (s.includes('left') && s.includes('back'))) return 'Back + Left';
  if (s.includes('back + right') || (s.includes('right') && s.includes('back'))) return 'Back + Right';
  if (s.includes('back') || s.includes('only')) return 'Back Only';
  return raw;
}

/**
 * Extracts the recorded carpet color from booth production items.
 * Returns 'GREY', 'BLUE', 'RED', 'STANDARD', or '—'.
 */
export function extractCarpetColor(items: BoothItemRecord[] = []): string {
  const carpetItem = items.find((i) => (i.item_name || '').toLowerCase().includes('carpet'));
  if (!carpetItem) return '—';

  const spec = (carpetItem.specification || '').trim();
  if (!spec) return 'STANDARD';

  const lower = spec.toLowerCase();
  if (lower.includes('grey') || lower.includes('gray')) return 'GREY';
  if (lower.includes('blue')) return 'BLUE';
  if (lower.includes('red')) return 'RED';

  const match = spec.match(/(?:color[:\s]*)([a-zA-Z0-9_\s-]+)/i);
  if (match && match[1]) {
    return match[1].trim().toUpperCase();
  }

  return spec.toUpperCase();
}

/**
 * Extracts Wooden Platform Flooring in production items.
 * Returns quantity string (e.g. '1', '2'), '✓' if no qty, or '—'.
 */
export function extractFlooring(items: BoothItemRecord[] = []): string {
  const floorItem = items.find((i) => {
    const name = (i.item_name || '').toLowerCase();
    return name.includes('floor') || name.includes('flooring') || name.includes('platform');
  });
  if (!floorItem) return '—';
  const qty = floorItem.quantity;
  if (qty !== null && qty !== undefined && qty > 0) {
    return String(qty);
  }
  return '✓';
}

/**
 * Extracts TV Mounting Type from TV items in production.
 * Returns 'WALL MOUNT', 'WITH STAND', or '—'.
 */
export function extractTvMounting(items: BoothItemRecord[] = []): string {
  const tvItem = items.find((i) => (i.item_name || '').toLowerCase().includes('tv'));
  if (!tvItem) return '—';

  const spec = (tvItem.specification || '').trim().toLowerCase();
  if (!spec) return 'WALL MOUNT';

  if (spec.includes('without stand') || spec.includes('wall')) return 'WALL MOUNT';
  if (spec.includes('with stand') || spec.includes('floor stand') || spec.includes('stand')) return 'WITH STAND';
  return tvItem.specification ? tvItem.specification.toUpperCase() : 'WALL MOUNT';
}

/**
 * Helper to match item by keyword(s) and return quantity / details.
 */
export function extractItemRequirement(
  items: BoothItemRecord[] = [],
  keywords: string[]
): { found: boolean; text: string; quantity: number | null; matchedItem?: BoothItemRecord } {
  const matched = items.filter((i) => {
    const name = (i.item_name || '').toLowerCase();
    const spec = (i.specification || '').toLowerCase();
    return keywords.some((k) => name.includes(k.toLowerCase()) || spec.includes(k.toLowerCase()));
  });

  if (matched.length === 0) {
    return { found: false, text: '—', quantity: null };
  }

  const hasQty = matched.some((i) => i.quantity !== null && i.quantity !== undefined && i.quantity > 0);
  const totalQty = matched.reduce((sum, item) => sum + (item.quantity ?? 0), 0);

  return {
    found: true,
    text: hasQty ? String(totalQty) : '✓',
    quantity: hasQty ? totalQty : null,
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
      const q = i.quantity && i.quantity > 0 ? ` (${i.quantity})` : '';
      const s = i.specification ? ` [${i.specification}]` : '';
      return `${i.item_name}${q}${s}`;
    })
    .join(', ');
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
 * Builds the Master Stall Detail Excel workbook matching the STALL DETAIL reference.
 * One continuous, wide table on a single worksheet: "Stall Requirements".
 * Configured for A3 landscape physical and digital viewing.
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
  // SINGLE WORKSHEET: "Stall Requirements"
  // =========================================================================
  const ws = workbook.addWorksheet('Stall Requirements', {
    pageSetup: {
      orientation: 'landscape',
      paperSize: 8 as any, // A3 landscape
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: '3:4', // Repeating category banners and column headers
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
    views: [{ state: 'frozen', xSplit: 3, ySplit: 4 }], // Freeze Sr.No, Company Name, Stall No + Top 4 Header Rows
  });

  const TOTAL_COLUMNS = 25;
  const lastColLetter = 'Y'; // Column 25 is Y

  // -------------------------------------------------------------------------
  // Row 1: Document Header Title Banner
  // -------------------------------------------------------------------------
  ws.mergeCells(`A1:${lastColLetter}1`);
  const r1 = ws.getCell('A1');
  r1.value = 'REWORKZONE STALLS — MASTER STALL DETAIL & PRODUCTION REQUIREMENTS';
  r1.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  r1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF18181B' } }; // Dark charcoal
  r1.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 26;

  // -------------------------------------------------------------------------
  // Row 2: Event Subtitle Information
  // -------------------------------------------------------------------------
  ws.mergeCells(`A2:${lastColLetter}2`);
  const r2 = ws.getCell('A2');
  const dateStr =
    eventInfo.startDate && eventInfo.endDate
      ? `${eventInfo.startDate} to ${eventInfo.endDate}`
      : eventInfo.startDate || '';
  const venueStr = [eventInfo.venue, eventInfo.city].filter(Boolean).join(', ');
  r2.value = `Exhibition: ${eventInfo.name}  |  Venue: ${venueStr || 'Not Specified'}  |  Dates: ${dateStr || '—'}  |  Generated: ${new Date().toLocaleDateString('en-GB')}  |  Total Stalls: ${sortedStalls.length}`;
  r2.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF52525B' } };
  r2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F5' } };
  r2.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(2).height = 20;

  // -------------------------------------------------------------------------
  // Row 3: Group Category Banners
  // -------------------------------------------------------------------------
  // Columns 1-6 (A3:F3) -> BASIC DETAILS
  ws.mergeCells('A3:F3');
  const gBasic = ws.getCell('A3');
  gBasic.value = 'BASIC DETAILS';
  gBasic.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
  gBasic.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF27272A' } };
  gBasic.alignment = { vertical: 'middle', horizontal: 'center' };

  // Columns 7-14 (G3:N3) -> PRODUCTION
  ws.mergeCells('G3:N3');
  const gProd = ws.getCell('G3');
  gProd.value = 'PRODUCTION REQUIREMENTS';
  gProd.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF78350F' } };
  gProd.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Soft Amber
  gProd.alignment = { vertical: 'middle', horizontal: 'center' };

  // Columns 15-17 (O3:Q3) -> FURNITURE
  ws.mergeCells('O3:Q3');
  const gFurn = ws.getCell('O3');
  gFurn.value = 'FURNITURE';
  gFurn.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF064E3B' } };
  gFurn.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; // Soft Emerald
  gFurn.alignment = { vertical: 'middle', horizontal: 'center' };

  // Columns 18-19 (R3:S3) -> ELECTRICAL
  ws.mergeCells('R3:S3');
  const gElec = ws.getCell('R3');
  gElec.value = 'ELECTRICAL';
  gElec.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF7C2D12' } };
  gElec.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } }; // Soft Orange
  gElec.alignment = { vertical: 'middle', horizontal: 'center' };

  // Columns 20-24 (T3:X3) -> PRINTING & GOODIES
  ws.mergeCells('T3:X3');
  const gPrint = ws.getCell('T3');
  gPrint.value = 'PRINTING & GOODIES';
  gPrint.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF581C87' } };
  gPrint.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } }; // Soft Purple
  gPrint.alignment = { vertical: 'middle', horizontal: 'center' };

  // Column 25 (Y3) -> ADDITIONAL REQUIREMENTS
  const gOther = ws.getCell('Y3');
  gOther.value = 'ADDITIONAL';
  gOther.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF1F2937' } };
  gOther.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }; // Soft Slate
  gOther.alignment = { vertical: 'middle', horizontal: 'center' };

  ws.getRow(3).height = 18;

  // -------------------------------------------------------------------------
  // Row 4: Exact 25 Columns in approved reference order
  // -------------------------------------------------------------------------
  const columns = [
    // Basic Details (1-6)
    { header: 'Sr. No.', key: 'sr_no', width: 8 },
    { header: 'Company Name', key: 'company_name', width: 34 },
    { header: 'Stall No.', key: 'stall_no', width: 13 },
    { header: 'Booth Type', key: 'booth_type', width: 14 },
    { header: 'Wall Configuration', key: 'wall_config', width: 18 },
    { header: 'Size', key: 'stand_size', width: 12 },
    // Production (7-14)
    { header: 'Wooden Platform Flooring', key: 'flooring', width: 15 },
    { header: 'Carpet', key: 'carpet', width: 11 },
    { header: 'Carpet Color', key: 'carpet_color', width: 14 },
    { header: 'Selfie Booth', key: 'selfie_booth', width: 13 },
    { header: 'Table Vinyl Branding', key: 'table_vinyl', width: 16 },
    { header: 'TV 42 Inch', key: 'tv_42', width: 13 },
    { header: 'TV 50–55 Inch', key: 'tv_55', width: 14 },
    { header: 'TV Mount', key: 'tv_mount', width: 16 },
    // Furniture (15-17)
    { header: 'Glass Round Table', key: 'round_table', width: 15 },
    { header: '2-Seater Sofa', key: 'sofa', width: 14 },
    { header: 'Chair', key: 'chair', width: 11 },
    // Electrical (18-19)
    { header: 'Power Socket', key: 'power_socket', width: 13 },
    { header: 'Permanent Light', key: 'permanent_light', width: 15 },
    // Printing & Goodies (20-24)
    { header: 'Print Files', key: 'print_files', width: 12 },
    { header: 'Book', key: 'book', width: 11 },
    { header: 'Pen', key: 'pen', width: 11 },
    { header: 'Leaflet', key: 'leaflet', width: 11 },
    { header: 'Other Goodies', key: 'other_goodies', width: 20 },
    // Custom / Additional (25)
    { header: 'Other Requirements', key: 'other_requirements', width: 26 },
  ];

  // Apply column widths
  columns.forEach((c, idx) => {
    ws.getColumn(idx + 1).width = c.width;
  });

  const headerRow4 = ws.addRow(columns.map((c) => c.header));
  headerRow4.height = 30;
  headerRow4.eachCell((cell) => {
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

  // Enable Excel AutoFilter across all 25 columns on row 4
  ws.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: TOTAL_COLUMNS },
  };

  // -------------------------------------------------------------------------
  // Populate Data Rows (One stall per row)
  // -------------------------------------------------------------------------
  let rowNumber = 5;
  sortedStalls.forEach((s, idx) => {
    const { booth, tasks, productionItems, furnitureItems, electricalItems, goodiesItems } = s;

    // Check section applicability from checklist tasks
    const isProdNA = getSectionStatus(tasks, 'production') === 'Not Required';
    const isFurnNA = getSectionStatus(tasks, 'furniture') === 'Not Required';
    const isElecNA = getSectionStatus(tasks, 'electrical') === 'Not Required';
    const isPrintNA = getSectionStatus(tasks, 'print') === 'Not Required';

    // 1. Basic Details
    const srNo = idx + 1;
    const companyName = booth.client_name || '—';
    const rawStallNum = (booth.booth_number || '').trim();
    const stallNo = rawStallNum
      ? (rawStallNum.startsWith('#') ? rawStallNum : `#${rawStallNum}`)
      : 'Not Assigned';
    const boothType = getStallTypeLabel(booth.booth_type);
    const wallConfig = formatWallConfigForExcel(booth.wall_configuration);
    const standSize = booth.stand_size || '3 × 3 m';

    // 2. Production
    // Wooden Platform Flooring
    let flooringVal = isProdNA ? 'N/A' : '—';
    const floorItem = productionItems.find((i) => {
      const name = (i.item_name || '').toLowerCase();
      return name.includes('floor') || name.includes('flooring') || name.includes('platform');
    });
    if (floorItem) {
      const q = floorItem.quantity;
      flooringVal = q !== null && q !== undefined && q > 0 ? String(q) : '✓';
    }

    // Carpet
    let carpetVal = isProdNA ? 'N/A' : '—';
    const carpetItem = productionItems.find((i) => (i.item_name || '').toLowerCase().includes('carpet'));
    if (carpetItem) {
      const q = carpetItem.quantity;
      carpetVal = q !== null && q !== undefined && q > 1 ? String(q) : 'YES';
    }

    // Carpet Color
    let carpetColorVal = isProdNA ? 'N/A' : '—';
    if (carpetItem) {
      carpetColorVal = extractCarpetColor(productionItems);
    }

    // Selfie Booth
    let selfieVal = isProdNA ? 'N/A' : '—';
    const selfieItem = productionItems.find((i) => (i.item_name || '').toLowerCase().includes('selfie'));
    if (selfieItem) {
      const q = selfieItem.quantity;
      selfieVal = q !== null && q !== undefined && q > 0 ? String(q) : '✓';
    }

    // Table Vinyl Branding (VSB)
    let tableVinylVal = isProdNA ? 'N/A' : '—';
    const tableVinylItem = productionItems.find((i) => {
      const name = (i.item_name || '').toLowerCase();
      const spec = (i.specification || '').toLowerCase();
      return (
        name.includes('table vinyl') ||
        name.includes('vinyl branding') ||
        name.includes('counter vinyl') ||
        name.includes('reception vinyl') ||
        name.includes('table branding') ||
        name.includes('vsb') ||
        name.includes('octunam') ||
        spec.includes('vsb')
      );
    });
    if (tableVinylItem) {
      const q = tableVinylItem.quantity;
      tableVinylVal = q !== null && q !== undefined && q > 0 ? String(q) : '✓';
    }

    // TV 42 Inch
    let tv42Val = isProdNA ? 'N/A' : '—';
    const tv42Item = productionItems.find((i) => {
      const name = (i.item_name || '').toLowerCase();
      const spec = (i.specification || '').toLowerCase();
      return (name.includes('tv') || spec.includes('tv')) && (name.includes('42') || spec.includes('42'));
    });
    if (tv42Item) {
      const q = tv42Item.quantity;
      tv42Val = q !== null && q !== undefined && q > 0 ? String(q) : '1';
    }

    // TV 50–55 Inch
    let tv55Val = isProdNA ? 'N/A' : '—';
    const tv55Item = productionItems.find((i) => {
      const name = (i.item_name || '').toLowerCase();
      const spec = (i.specification || '').toLowerCase();
      return (
        (name.includes('tv') || spec.includes('tv')) &&
        (name.includes('50') || name.includes('55') || spec.includes('50') || spec.includes('55'))
      );
    });
    if (tv55Item) {
      const q = tv55Item.quantity;
      tv55Val = q !== null && q !== undefined && q > 0 ? String(q) : '1';
    }

    // TV Mount
    let tvMountVal = isProdNA ? 'N/A' : '—';
    const anyTv = productionItems.find((i) => (i.item_name || '').toLowerCase().includes('tv'));
    if (anyTv) {
      tvMountVal = extractTvMounting(productionItems);
    }

    // 3. Furniture
    // Glass Round Table
    let tableVal = isFurnNA ? 'N/A' : '—';
    const roundTableItem = furnitureItems.find((i) => {
      const name = (i.item_name || '').toLowerCase();
      return (
        name.includes('glass round') ||
        name.includes('round table') ||
        name.includes('glass table') ||
        name.includes('round')
      );
    });
    if (roundTableItem) {
      const q = roundTableItem.quantity;
      tableVal = q !== null && q !== undefined && q > 0 ? String(q) : '1';
    }

    // 2-Seater Sofa
    let sofaVal = isFurnNA ? 'N/A' : '—';
    const sofaItem = furnitureItems.find((i) => {
      const name = (i.item_name || '').toLowerCase();
      return (
        name.includes('sofa') ||
        name.includes('couch') ||
        name.includes('2-seater') ||
        name.includes('2 seater') ||
        name.includes('seater')
      );
    });
    if (sofaItem) {
      const q = sofaItem.quantity;
      sofaVal = q !== null && q !== undefined && q > 0 ? String(q) : '1';
    }

    // Chair
    let chairVal = isFurnNA ? 'N/A' : '—';
    const chairItem = furnitureItems.find((i) => {
      const name = (i.item_name || '').toLowerCase();
      return name.includes('chair') && !name.includes('sofa') && !name.includes('couch');
    });
    if (chairItem) {
      const q = chairItem.quantity;
      chairVal = q !== null && q !== undefined && q > 0 ? String(q) : '✓';
    }

    // 4. Electrical
    // Power Socket
    let socketVal = isElecNA ? 'N/A' : '—';
    const socketItem = electricalItems.find((i) => {
      const name = (i.item_name || '').toLowerCase();
      return (
        name.includes('socket') ||
        name.includes('power') ||
        name.includes('plug') ||
        name.includes('15a') ||
        name.includes('5a')
      );
    });
    if (socketItem) {
      const q = socketItem.quantity;
      socketVal = q !== null && q !== undefined && q > 0 ? String(q) : '1';
    }

    // Permanent Light
    let lightVal = isElecNA ? 'N/A' : '—';
    const lightItem = electricalItems.find((i) => {
      const name = (i.item_name || '').toLowerCase();
      return (
        name.includes('pelmet') ||
        name.includes('permanent') ||
        name.includes('palmenent') ||
        name.includes('spotlight') ||
        name.includes('sport light') ||
        name.includes('light')
      );
    });
    if (lightItem) {
      const q = lightItem.quantity;
      const spec = (lightItem.specification || '').toLowerCase();
      if (spec.includes('spot') || spec.includes('sport')) {
        lightVal = `${q && q > 0 ? q : ''} SPOTLIGHT`.trim();
      } else {
        lightVal = q !== null && q !== undefined && q > 0 ? String(q) : '✓';
      }
    }

    // 5. Printing & Goodies
    // Print Files Link Available / Ready
    let printFilesVal = isPrintNA ? 'N/A' : '—';
    const hasPrintUrl = Boolean(
      (booth.print_drive_url && booth.print_drive_url.trim().startsWith('http')) ||
      (booth.main_drive_folder_url && booth.main_drive_folder_url.trim().startsWith('http'))
    );
    const printStatus = (booth.print_file_status || '').toLowerCase();
    if (hasPrintUrl || printStatus.includes('ready')) {
      printFilesVal = 'YES';
    }

    // Book
    let bookVal = isPrintNA ? 'N/A' : '—';
    const bookItem = goodiesItems.find((i) => {
      const name = (i.item_name || '').toLowerCase();
      return name.includes('book') || name.includes('notebook') || name.includes('diary');
    });
    if (bookItem) {
      const q = bookItem.quantity;
      bookVal = q !== null && q !== undefined && q > 0 ? String(q) : '✓';
    }

    // Pen
    let penVal = isPrintNA ? 'N/A' : '—';
    const penItem = goodiesItems.find((i) => (i.item_name || '').toLowerCase().includes('pen'));
    if (penItem) {
      const q = penItem.quantity;
      penVal = q !== null && q !== undefined && q > 0 ? String(q) : '✓';
    }

    // Leaflet
    let leafletVal = isPrintNA ? 'N/A' : '—';
    const leafletItem = goodiesItems.find((i) => {
      const name = (i.item_name || '').toLowerCase();
      return (
        name.includes('leaflet') ||
        name.includes('brochure') ||
        name.includes('flyer') ||
        name.includes('pamphlet')
      );
    });
    if (leafletItem) {
      const q = leafletItem.quantity;
      leafletVal = q !== null && q !== undefined && q > 0 ? String(q) : '✓';
    }

    // Other Goodies
    let otherGoodiesVal = isPrintNA ? 'N/A' : '—';
    const customGoodies = goodiesItems.filter((i) => {
      const name = (i.item_name || '').toLowerCase();
      return (
        !name.includes('book') &&
        !name.includes('notebook') &&
        !name.includes('diary') &&
        !name.includes('pen') &&
        !name.includes('leaflet') &&
        !name.includes('brochure') &&
        !name.includes('flyer') &&
        !name.includes('pamphlet')
      );
    });
    if (customGoodies.length > 0) {
      otherGoodiesVal = customGoodies
        .map((i) => {
          const q = i.quantity && i.quantity > 0 ? ` (${i.quantity})` : '';
          return `${i.item_name}${q}`;
        })
        .join(', ');
    }

    // 6. Custom / Additional Requirements
    // Unmatched production items (e.g. plants, brochure stand, backdrop frame, racks)
    const customProd = productionItems.filter((i) => {
      const name = (i.item_name || '').toLowerCase();
      return (
        !name.includes('floor') &&
        !name.includes('platform') &&
        !name.includes('carpet') &&
        !name.includes('selfie') &&
        !name.includes('table vinyl') &&
        !name.includes('vinyl branding') &&
        !name.includes('counter vinyl') &&
        !name.includes('reception vinyl') &&
        !name.includes('table branding') &&
        !name.includes('vsb') &&
        !name.includes('octunam') &&
        !name.includes('tv') &&
        !name.includes('42') &&
        !name.includes('50') &&
        !name.includes('55')
      );
    });

    // Unmatched furniture items (e.g. bar stool, counter, pod)
    const customFurn = furnitureItems.filter((i) => {
      const name = (i.item_name || '').toLowerCase();
      return (
        !name.includes('glass round') &&
        !name.includes('round table') &&
        !name.includes('glass table') &&
        !name.includes('round') &&
        !name.includes('sofa') &&
        !name.includes('couch') &&
        !name.includes('2-seater') &&
        !name.includes('2 seater') &&
        !name.includes('seater') &&
        !name.includes('chair')
      );
    });

    // Unmatched electrical items (e.g. 500w halogen, extension board)
    const customElec = electricalItems.filter((i) => {
      const name = (i.item_name || '').toLowerCase();
      return (
        !name.includes('socket') &&
        !name.includes('power') &&
        !name.includes('plug') &&
        !name.includes('15a') &&
        !name.includes('5a') &&
        !name.includes('pelmet') &&
        !name.includes('permanent') &&
        !name.includes('palmenent') &&
        !name.includes('spotlight') &&
        !name.includes('sport light') &&
        !name.includes('light')
      );
    });

    const allCustom = [...customProd, ...customFurn, ...customElec];
    let otherReqsVal = '—';
    if (allCustom.length > 0) {
      otherReqsVal = allCustom
        .map((i) => {
          const q = i.quantity && i.quantity > 0 ? ` (${i.quantity})` : '';
          const s = i.specification ? ` [${i.specification}]` : '';
          return `${i.item_name}${q}${s}`;
        })
        .join(', ');
    }

    // Row Data
    const rowValues = [
      srNo,
      companyName,
      stallNo,
      boothType,
      wallConfig,
      standSize,
      // Production
      flooringVal,
      carpetVal,
      carpetColorVal,
      selfieVal,
      tableVinylVal,
      tv42Val,
      tv55Val,
      tvMountVal,
      // Furniture
      tableVal,
      sofaVal,
      chairVal,
      // Electrical
      socketVal,
      lightVal,
      // Printing & Goodies
      printFilesVal,
      bookVal,
      penVal,
      leafletVal,
      otherGoodiesVal,
      // Additional
      otherReqsVal,
    ];

    const dataRow = ws.addRow(rowValues);
    dataRow.height = 20;

    const isEven = rowNumber % 2 === 0;
    const baseBg = isEven ? 'FFFBFBFC' : 'FFFFFFFF'; // Subtle alternating row striping

    dataRow.eachCell((cell, colNum) => {
      cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF18181B' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE4E4E7' } },
        bottom: { style: 'thin', color: { argb: 'FFE4E4E7' } },
        left: { style: 'thin', color: { argb: 'FFE4E4E7' } },
        right: { style: 'thin', color: { argb: 'FFE4E4E7' } },
      };

      // Column-specific alignment
      if (colNum === 2) {
        // Company Name: Left-aligned
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF0F172A' } };
      } else if (colNum === 24 || colNum === 25) {
        // Other Goodies & Other Requirements: Left-aligned with text wrap
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        cell.font = { name: 'Segoe UI', size: 8.5, color: { argb: 'FF334155' } };
      } else {
        // Quantities, Indicators, Specifications: Centered
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }

      // Default zebra background
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };

      // Highlight Carpet Color (Col 9)
      if (colNum === 9) {
        const val = String(cell.value || '').trim();
        if (val === 'BLUE') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }; // Soft Pastel Blue
          cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF1E40AF' } };
        } else if (val === 'RED') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } }; // Soft Pastel Red
          cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFB91C1C' } };
        } else if (val === 'GREY' || val === 'GRAY') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }; // Soft Cool Grey
          cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF374151' } };
        } else if (val !== '—' && val !== 'N/A') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Soft Warm Tint
          cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF92400E' } };
        }
      }

      // Mute '—' and 'N/A' values slightly for visual clarity
      const cellStr = String(cell.value || '');
      if (cellStr === '—') {
        cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FFA1A1AA' } };
      } else if (cellStr === 'N/A') {
        cell.font = { name: 'Segoe UI', size: 8.5, color: { argb: 'FF71717A' } };
      }
    });

    rowNumber++;
  });

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
