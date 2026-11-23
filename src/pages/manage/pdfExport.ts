import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export type ChecklistFilterType = 'all' | 'without_discussions' | 'done' | 'in_progress' | 'not_started' | 'discussions';

export interface ChecklistFilterOption {
  id: ChecklistFilterType;
  label: string;
}

export const CHECKLIST_FILTER_OPTIONS: ChecklistFilterOption[] = [
  { id: 'all', label: 'All Stalls' },
  { id: 'without_discussions', label: 'Without Discussions' },
  { id: 'done', label: 'All Steps Done' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'not_started', label: 'Not Started' },
  { id: 'discussions', label: 'Ongoing Discussions' },
];

/**
 * Generates standardized, professional export filenames for stall checklists.
 * Examples:
 * - All: Tech_Expo_2026_Stall_Checklists.pdf
 * - Completed: Tech_Expo_2026_Completed_Stalls.pdf
 * - In Progress: Tech_Expo_2026_InProgress_Stalls.pdf
 * - Not Started: Tech_Expo_2026_NotStarted_Stalls.pdf
 * - Discussions: Tech_Expo_2026_Ongoing_Discussions.pdf
 */
export function getExportFilename(
  eventName: string,
  filterType: ChecklistFilterType | string,
  boothNumber?: string | null
): string {
  const cleanEvent = (eventName || 'Exhibition')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (boothNumber && boothNumber.trim()) {
    const cleanBooth = boothNumber.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${cleanEvent || 'Exhibition'}_Stall_${cleanBooth}_Checklist.pdf`;
  }

  if (filterType === 'without_discussions') {
    return `${cleanEvent || 'Exhibition'}_Without_Discussions.pdf`;
  }
  if (filterType === 'done') {
    return `${cleanEvent || 'Exhibition'}_Completed_Stalls.pdf`;
  }
  if (filterType === 'in_progress') {
    return `${cleanEvent || 'Exhibition'}_InProgress_Stalls.pdf`;
  }
  if (filterType === 'not_started') {
    return `${cleanEvent || 'Exhibition'}_NotStarted_Stalls.pdf`;
  }
  if (filterType === 'discussions') {
    return `${cleanEvent || 'Exhibition'}_Ongoing_Discussions.pdf`;
  }
  return `${cleanEvent || 'Exhibition'}_Stall_Checklists.pdf`;
}

/**
 * Generates standardized client stall details filename.
 * Example: Tech_Expo_2026_A7_Emblit_Stall_Details.pdf
 */
export function getClientStallDetailsFilename(
  eventName?: string | null,
  boothNumber?: string | null,
  clientName?: string | null
): string {
  const cleanEvent = (eventName || 'Exhibition')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'Exhibition';

  const rawBooth = (boothNumber || '').trim();
  const cleanBooth =
    rawBooth && !['tbd', 'tba', 'pending', 'not assigned', 'not allocated', '—', '-', 'none', 'n/a'].includes(rawBooth.toLowerCase())
      ? rawBooth.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
      : 'Proposed';

  const cleanClient = (clientName || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'Stall';

  return `${cleanEvent}_${cleanBooth}_${cleanClient}_Stall_Details.pdf`;
}

/**
 * Client Stall Details single/multi-page A4 PDF export with embedded hyperlinks.
 */
export async function exportClientStallDetailsToPdf(
  element: HTMLElement,
  filename: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  return exportElementsToPdf([element], filename, onProgress);
}

/**
 * Client-side multi-page A4 PDF export.
 * Each stall starts on a brand-new page with comfortable 8mm margins.
 * Long checklists that exceed a single page seamlessly continue onto subsequent pages.
 */
export async function exportElementsToPdf(
  elements: HTMLElement[],
  filename: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const validElements = (elements || []).filter((el) => {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return (rect.width > 0 && rect.height > 0) || (el.offsetWidth > 0 && el.offsetHeight > 0);
  });

  if (validElements.length === 0) {
    throw new Error('No visible stall sheets found to export.');
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pdfWidth = 210;
  const pdfHeight = 297;
  const margin = 8;
  const printWidth = pdfWidth - margin * 2; // 194 mm
  const printHeight = pdfHeight - margin * 2; // 281 mm

  let pageIndex = 0;

  for (let i = 0; i < validElements.length; i++) {
    if (onProgress) {
      onProgress(i + 1, validElements.length);
    }

    const el = validElements[i];

    // Ensure all preview and logo images in this stall sheet are loaded prior to canvas rendering
    const images = Array.from(el.querySelectorAll<HTMLImageElement>('img'));
    if (images.length > 0) {
      await Promise.all(
        images.map((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, 2500); // 2.5s fallback so bulk PDF export never stalls
            img.onload = () => { clearTimeout(timer); resolve(); };
            img.onerror = () => { clearTimeout(timer); resolve(); };
          });
        })
      );
    }

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 794,
    });

    const imgWidth = printWidth;
    const imgHeight = (canvas.height * printWidth) / canvas.width;
    const elRect = el.getBoundingClientRect();
    const scaleFactor = elRect.width > 0 ? printWidth / elRect.width : 1;

    const stallStartPage = pageIndex + 1;

    if (imgHeight <= printHeight) {
      // Single A4 page
      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(canvas, 'JPEG', margin, margin, imgWidth, imgHeight, undefined, 'FAST');
      pageIndex++;
    } else {
      // Multi-page stall: flows across pages
      let heightLeft = imgHeight;
      let position = 0;

      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(canvas, 'JPEG', margin, margin, imgWidth, imgHeight, undefined, 'FAST');
      pageIndex++;
      heightLeft -= printHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(canvas, 'JPEG', margin, margin + position, imgWidth, imgHeight, undefined, 'FAST');
        pageIndex++;
        heightLeft -= printHeight;
      }
    }

    // Embed real clickable PDF hyperlink annotations (/Subtype /Link, /URI) for all valid links in this stall
    if (elRect.width > 0) {
      const anchors = Array.from(el.querySelectorAll<HTMLAnchorElement>('a[href]'));
      for (const a of anchors) {
        const href = a.getAttribute('href')?.trim();
        if (!href || (!href.startsWith('http://') && !href.startsWith('https://'))) {
          continue;
        }
        const aRect = a.getBoundingClientRect();
        if (aRect.width <= 0 || aRect.height <= 0) {
          continue;
        }

        // Convert DOM position relative to stall container into PDF coordinates in mm
        const relX = aRect.left - elRect.left;
        const relY = aRect.top - elRect.top;
        const relW = aRect.width;
        const relH = aRect.height;

        const pdfX = margin + relX * scaleFactor;
        const totalPdfY = margin + relY * scaleFactor;
        const pdfW = relW * scaleFactor;
        const pdfH = relH * scaleFactor;

        if (imgHeight <= printHeight) {
          pdf.setPage(stallStartPage);
          pdf.link(pdfX, totalPdfY, pdfW, pdfH, { url: href });
        } else {
          const pageOffset = Math.floor((totalPdfY - margin) / printHeight);
          const targetPage = stallStartPage + pageOffset;
          const pageY = margin + ((totalPdfY - margin) % printHeight);
          if (targetPage <= pdf.getNumberOfPages()) {
            pdf.setPage(targetPage);
            pdf.link(pdfX, pageY, pdfW, pdfH, { url: href });
          }
        }
      }
    }
  }

  pdf.save(filename);
}
