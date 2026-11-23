import React from 'react';
import { StallPrintData, StallType, BoothTask } from './types';
import { isPendingOrEmpty } from './boothSort';

interface StallChecklistSheetProps {
  data: StallPrintData;
  isBulk?: boolean;
  isLast?: boolean;
}

export function getStallTypeLabel(rawType?: string): StallType {
  const raw = (rawType || '').toLowerCase();
  if (raw.includes('frame') || raw.includes('octonorm')) return 'Frame';
  if (raw.includes('custom')) return 'Customize';
  return 'Wooden';
}

export function getSectionStatus(tasks: BoothTask[] = [], sectionKey: string): string {
  const norm = sectionKey.toLowerCase();
  const task = tasks.find((t) => {
    const p = (t.phase || t.task_name || '').toLowerCase();
    if (norm === 'print') return p.includes('print');
    return p.includes(norm);
  });
  if (!task) return 'Pending';
  if (task.status === 'not_applicable' || (task.status as string) === 'na') return 'Not Required';
  if (task.is_completed || task.status === 'completed') return 'Done';
  return 'Pending';
}

export function renderStatusBadge(status: string) {
  const isDone = status === 'Done';
  const isNA = status === 'Not Required' || status === 'N/A';
  return (
    <span
      className={
        isDone
          ? 'text-emerald-700 font-bold'
          : isNA
          ? 'text-zinc-500 font-semibold'
          : 'text-zinc-950 font-bold'
      }
    >
      {status}
    </span>
  );
}

export function getWallConfigDisplay(raw?: string | null): { label: string; hasDiagram: boolean } {
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    return { label: 'Not Specified', hasDiagram: false };
  }
  const s = raw.trim().toLowerCase();
  if (s === '3 sides' || s.includes('3 side')) {
    return { label: '3 Sides (Back + Left + Right)', hasDiagram: true };
  }
  if (s.includes('right') || s === 'back + right') {
    return { label: '2 Sides — Back + Right (Corner Stall)', hasDiagram: true };
  }
  if (s.includes('left') || s === 'back + left') {
    return { label: '2 Sides — Back + Left (Corner Stall)', hasDiagram: true };
  }
  if (s.includes('back wall') || s.includes('back only')) {
    return { label: 'Back Wall Only (3 Open Sides)', hasDiagram: true };
  }
  if (s.includes('2 side')) {
    return { label: '2 Sides — Back + Side Wall', hasDiagram: true };
  }
  return { label: raw.trim(), hasDiagram: false };
}

/**
 * Compact top-view vector wall diagram for A4 print.
 * Crisp black vector lines on white background with clear front/open aisle indication.
 */
export function PrintableWallDiagram({ wallConfig }: { wallConfig?: string | null }) {
  const norm = (wallConfig || '').trim().toLowerCase();

  if (!wallConfig || norm === '' || norm === 'not configured' || norm === 'not specified') {
    return null;
  }

  const is3Sides = norm.includes('3 side');
  const is2SidesLeft = norm.includes('left');
  const is2SidesRight = norm.includes('right');
  const isBackOnly = norm.includes('back wall') || norm.includes('back only');

  return (
    <svg
      viewBox="0 0 32 32"
      className="w-6 h-6 shrink-0"
      fill="none"
      aria-hidden="true"
    >
      {/* Subtle stall footprint */}
      <rect
        x="4.5"
        y="4.5"
        width="23"
        height="23"
        fill="#f4f4f5"
        stroke="#e4e4e7"
        strokeWidth="0.8"
      />

      {is3Sides && (
        <>
          {/* Solid physical walls: Left, Back, Right */}
          <path
            d="M 6.5 25.5 L 6.5 6.5 L 25.5 6.5 L 25.5 25.5"
            stroke="#18181b"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Open front: dashed */}
          <path
            d="M 6.5 25.5 L 25.5 25.5"
            stroke="#71717a"
            strokeWidth="1.2"
            strokeDasharray="2 2"
            strokeLinecap="round"
          />
        </>
      )}

      {is2SidesLeft && (
        <>
          {/* Solid physical walls: Back and Left */}
          <path
            d="M 25.5 6.5 L 6.5 6.5 L 6.5 25.5"
            stroke="#18181b"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Open right and front: dashed */}
          <path
            d="M 25.5 6.5 L 25.5 25.5 L 6.5 25.5"
            stroke="#71717a"
            strokeWidth="1.2"
            strokeDasharray="2 2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      {is2SidesRight && (
        <>
          {/* Solid physical walls: Back and Right */}
          <path
            d="M 6.5 6.5 L 25.5 6.5 L 25.5 25.5"
            stroke="#18181b"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Open left and front: dashed */}
          <path
            d="M 6.5 6.5 L 6.5 25.5 L 25.5 25.5"
            stroke="#71717a"
            strokeWidth="1.2"
            strokeDasharray="2 2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      {isBackOnly && (
        <>
          {/* Solid physical wall: Back wall only */}
          <path
            d="M 6.5 6.5 L 25.5 6.5"
            stroke="#18181b"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Open sides: left, front, right */}
          <path
            d="M 6.5 6.5 L 6.5 25.5 L 25.5 25.5 L 25.5 6.5"
            stroke="#71717a"
            strokeWidth="1.2"
            strokeDasharray="2 2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}

export function StallChecklistSheet({
  data,
  isBulk = false,
  isLast = false,
}: StallChecklistSheetProps) {
  const {
    booth,
    eventName,
    tasks,
    productionItems,
    furnitureItems,
    electricalItems,
    goodiesItems,
    views3D,
  } = data;

  const designStatus = getSectionStatus(tasks, 'design');
  const printStatus = getSectionStatus(tasks, 'print');
  const prodStatus = getSectionStatus(tasks, 'production');
  const furnStatus = getSectionStatus(tasks, 'furniture');
  const elecStatus = getSectionStatus(tasks, 'electrical');

  const structureType = getStallTypeLabel(booth.booth_type);
  const wallConfigInfo = getWallConfigDisplay(booth.wall_configuration);

  // 3D Views processing
  const valid3DViews = (views3D || []).filter((v) => {
    const u = (v.drive_url || (v as any).url || '').trim();
    return u.startsWith('http://') || u.startsWith('https://');
  });

  const getValidImageUrl = (url?: string | null): string | null => {
    if (!url) return null;
    const clean = url.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://') && !clean.startsWith('/uploads/')) {
      return null;
    }
    const lower = clean.toLowerCase();
    if (
      lower.includes('claude.site') ||
      lower.includes('drive.google.com') ||
      lower.includes('figma.com') ||
      lower.includes('sketchfab.com')
    ) {
      return null;
    }
    if (clean.startsWith('/uploads/') || lower.match(/\.(jpeg|jpg|png|webp|gif)(\?.*)?$/i)) {
      return clean;
    }
    return null;
  };

  const viewsWithImage = valid3DViews.map((v) => {
    const explicitImg = (v.preview_image_url || '').trim();
    const directImg = getValidImageUrl(v.drive_url);
    const resolvedImg =
      explicitImg &&
      (explicitImg.startsWith('/') || explicitImg.startsWith('http://') || explicitImg.startsWith('https://'))
        ? explicitImg
        : directImg;
    return {
      view: v,
      image: resolvedImg || null,
      isFinal: v.is_final === 1,
    };
  });

  const primaryItem =
    viewsWithImage.find((v) => v.isFinal && v.image) ||
    viewsWithImage.find((v) => v.image) ||
    viewsWithImage.find((v) => v.isFinal) ||
    viewsWithImage[0];

  const primary3DView = primaryItem ? primaryItem.view : valid3DViews[0] || null;
  const primaryPreviewImg = primaryItem ? primaryItem.image : null;

  const mainFolderUrl = (booth.main_drive_folder_url || '').trim();
  const hasMainFolder = mainFolderUrl.startsWith('http://') || mainFolderUrl.startsWith('https://');
  const single3DUrl =
    valid3DViews.length > 0
      ? (valid3DViews[0].drive_url || (valid3DViews[0] as any).url).trim()
      : hasMainFolder
      ? mainFolderUrl
      : '';
  const has3D = Boolean(single3DUrl);

  // Print & Goodies Links processing
  const printUrl = (booth.print_drive_url || '').trim();
  const hasPrintUrl = printUrl.startsWith('http://') || printUrl.startsWith('https://');

  const goodiesUrl = (booth.goodies_drive_url || '').trim();
  const hasGoodiesUrl = goodiesUrl.startsWith('http://') || goodiesUrl.startsWith('https://');

  const printDateStr = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div
      className={`stall-print-sheet bg-white text-zinc-950 font-sans leading-normal text-[11px] p-4 sm:p-5 w-full max-w-[210mm] mx-auto ${
        isBulk && !isLast ? 'break-after-page page-break-after-always' : ''
      }`}
      style={{
        boxSizing: 'border-box',
      }}
    >
      {/* 1. TOP HEADER & BRANDING (Compact, Non-overlapping, Proportional) */}
      <div className="border-b-2 border-zinc-900 pb-2 mb-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <img
              src="/logo.png"
              alt="Reworkzone"
              className="h-8 sm:h-9 w-auto object-contain shrink-0"
              style={{ maxHeight: '36px' }}
            />
            <div className="border-l-2 border-zinc-300 pl-3 min-w-0">
              <span className="text-[8.5px] tracking-widest uppercase font-bold text-zinc-500 block leading-none mb-0.5">
                Exhibitions & Turnkey Fabrication
              </span>
              <h1 className="text-[13px] sm:text-[14.5px] font-black tracking-tight text-zinc-950 uppercase leading-snug break-words">
                Stall Production & Requirements Checklist
              </h1>
            </div>
          </div>
          <div className="text-right text-[9.5px] text-zinc-600 font-mono shrink-0 leading-tight pl-3 border-l border-zinc-200">
            <div>
              Doc Ref:{' '}
              <span className="font-bold text-zinc-950">
                {booth.id ? booth.id.substring(0, 10).toUpperCase() : 'RWZ-STALL'}
              </span>
            </div>
            <div className="mt-0.5">
              Print Date: <span className="font-medium text-zinc-900">{printDateStr}</span>
            </div>
          </div>
        </div>

        {/* 2. STALL INFORMATION GRID */}
        {/* Row 1: Company / Exhibitor & Booth Number (Equal vertical alignment, natural wrapping, no truncate) */}
        <div className="grid grid-cols-12 gap-2 items-stretch mt-2 pt-2 border-t border-zinc-300">
          <div className="col-span-8 bg-zinc-50 border border-zinc-300 rounded px-2.5 py-1.5 flex flex-col justify-center min-h-[44px]">
            <span className="text-[8.5px] uppercase tracking-wider text-zinc-500 block font-bold leading-none mb-1">
              Company / Exhibitor
            </span>
            <span className="text-xs sm:text-[13px] font-black text-zinc-950 block leading-tight break-words">
              {booth.client_name || 'Exhibitor'}
            </span>
          </div>

          <div className="col-span-4 bg-zinc-50 border border-zinc-300 rounded px-2.5 py-1.5 flex flex-col justify-center min-h-[44px]">
            <span className="text-[8.5px] uppercase tracking-wider text-zinc-500 block font-bold leading-none mb-1">
              Booth Number
            </span>
            <span className="font-mono font-black text-xs sm:text-[13px] text-zinc-950 block leading-tight break-words">
              {isPendingOrEmpty(booth.booth_number) ? 'Not Assigned' : `#${booth.booth_number}`}
            </span>
          </div>
        </div>

        {/* Row 2: Exhibition, Stall Size, Stall Type, Mobile Contact (4 columns, clean horizontal separation, no overlap) */}
        <div className="grid grid-cols-12 gap-2 items-start mt-1.5 pt-1.5 border-t border-zinc-200 text-[11px]">
          {/* 1. Exhibition */}
          <div className="col-span-4 min-w-0">
            <span className="text-[8.5px] uppercase tracking-wider text-zinc-500 block font-bold leading-none mb-1">
              Exhibition
            </span>
            <span className="font-bold text-zinc-900 text-[11px] leading-tight block break-words">
              {eventName || 'Exhibition'}
            </span>
          </div>

          {/* 2. Stall Size */}
          <div className="col-span-2 min-w-0">
            <span className="text-[8.5px] uppercase tracking-wider text-zinc-500 block font-bold leading-none mb-1">
              Stall Size
            </span>
            <span className="font-mono font-bold text-zinc-900 text-[11px] leading-tight block">
              {booth.stand_size || '3 × 3 m'}
            </span>
          </div>

          {/* 3. Stall Type */}
          <div className="col-span-3 min-w-0">
            <span className="text-[8.5px] uppercase tracking-wider text-zinc-500 block font-bold leading-none mb-1">
              Stall Type
            </span>
            <span className="font-bold text-zinc-900 text-[11px] leading-tight block break-words">
              {structureType}
            </span>
          </div>

          {/* 4. Mobile Number */}
          <div className="col-span-3 min-w-0">
            <span className="text-[8.5px] uppercase tracking-wider text-zinc-500 block font-bold leading-none mb-1">
              Mobile Number
            </span>
            <span className="font-mono font-medium text-zinc-900 text-[11px] leading-tight block break-words">
              {booth.phone || '—'}
            </span>
          </div>
        </div>

        {/* Row 3: Wall Configuration with Compact Top-View Vector Diagram */}
        <div className="mt-2 py-1 px-2.5 bg-amber-50/70 border border-amber-300/80 rounded flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[8.5px] uppercase tracking-wider text-amber-900/80 font-bold shrink-0">
              Wall Configuration:
            </span>
            <span className="font-bold text-zinc-950 text-[11px] truncate">
              {wallConfigInfo.label}
            </span>
          </div>
          {wallConfigInfo.hasDiagram && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[8.5px] text-zinc-500 uppercase tracking-wider font-semibold">
                Top View:
              </span>
              <PrintableWallDiagram wallConfig={booth.wall_configuration} />
            </div>
          )}
        </div>
      </div>

      {/* 3. FOUR CHECKLIST SECTIONS (Standardized Structure & Table Layout) */}
      <div className="space-y-2">
        {/* SECTION 1: PRINT FILES & DESIGN */}
        <div className="border-b border-zinc-200 pb-1.5">
          <div className="break-inside-avoid flex items-center justify-between border-b border-zinc-300 pb-0.5 mb-1">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 border-2 border-zinc-900 rounded-sm inline-block shrink-0" />
              <h2 className="text-xs font-black text-zinc-950 uppercase tracking-wide">
                1. Print Files & Design
              </h2>
              <span className="text-zinc-400 font-normal mx-0.5">—</span>
              {renderStatusBadge(printStatus)}
            </div>
            <div className="flex items-center gap-1 text-[9px] text-zinc-500">
              <span className="w-3 h-3 border border-zinc-400 rounded-sm inline-block shrink-0" />
              <span>Design & print verified</span>
            </div>
          </div>

          <div className="text-[11px] text-zinc-800 space-y-0.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
              <div>
                <span className="text-zinc-500 font-semibold">Responsibility: </span>
                <span className="font-bold text-zinc-950">{booth.design_responsibility || 'Client Side'}</span>
              </div>

              <span className="text-zinc-300 hidden sm:inline">|</span>

              <div className="flex items-center gap-1.5">
                <span className="text-zinc-500 font-semibold">3D View: </span>
                {valid3DViews.length > 1 ? (
                  <span className="inline-flex items-center gap-1.5 flex-wrap">
                    {valid3DViews.map((v, idx) => {
                      const vUrl = (v.drive_url || (v as any).url || '').trim();
                      const vTitle = v.title?.trim() || `View ${idx + 1}`;
                      return (
                        <React.Fragment key={v.id || idx}>
                          {idx > 0 && <span className="text-zinc-300">/</span>}
                          <a
                            href={vUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline font-bold text-[11px] transition-colors"
                            title={`Open ${vTitle}`}
                          >
                            {vTitle}
                          </a>
                        </React.Fragment>
                      );
                    })}
                  </span>
                ) : has3D ? (
                  <a
                    href={single3DUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline font-bold text-[11px] transition-colors"
                    title="Open 3D Design in new tab"
                  >
                    {valid3DViews.length === 1 && valid3DViews[0].title && valid3DViews[0].title.toLowerCase() !== 'view 3d design'
                      ? valid3DViews[0].title
                      : 'View 3D Design'}
                  </a>
                ) : (
                  <span className="text-zinc-400 italic text-[11px]">Not Added</span>
                )}
              </div>

              <span className="text-zinc-300 hidden sm:inline">|</span>

              <div>
                <span className="text-zinc-500 font-semibold">Print Status: </span>
                <span className="font-bold text-zinc-950">{booth.print_file_status || 'Designs Pending'}</span>
              </div>

              <span className="text-zinc-300 hidden sm:inline">|</span>

              <div>
                <span className="text-zinc-500 font-semibold">Print Files: </span>
                {hasPrintUrl ? (
                  <a
                    href={printUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline font-bold text-[11px] transition-colors"
                    title="Open Print Files in Google Drive"
                  >
                    Open Drive
                  </a>
                ) : (
                  <span className="text-zinc-400 italic text-[11px]">Not Added</span>
                )}
              </div>

              {/* Only show Goodies Artwork & Status when goodies are recorded or goodies link exists */}
              {(hasGoodiesUrl || (goodiesItems && goodiesItems.length > 0)) && (
                <>
                  <span className="text-zinc-300 hidden sm:inline">|</span>
                  <div>
                    <span className="text-zinc-500 font-semibold">Goodies Artwork: </span>
                    {hasGoodiesUrl ? (
                      <a
                        href={goodiesUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline font-bold text-[11px] transition-colors"
                        title="Open Goodies Artwork in Google Drive"
                      >
                        Open Artwork
                      </a>
                    ) : (
                      <span className="text-zinc-400 italic text-[11px]">Not Added</span>
                    )}
                  </div>

                  {booth.goodies_status && (
                    <>
                      <span className="text-zinc-300 hidden sm:inline">|</span>
                      <div>
                        <span className="text-zinc-500 font-semibold">Goodies Status: </span>
                        <span className="font-bold text-zinc-950">{booth.goodies_status}</span>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Remarks */}
            {(booth.notes || booth.print_remark || booth.goodies_remark) && (
              <div className="text-[10px] text-zinc-600 italic flex flex-wrap gap-x-3 gap-y-0.5">
                {booth.notes && (
                  <div>
                    <span className="text-zinc-500 not-italic font-medium">Remarks: </span>
                    {booth.notes}
                  </div>
                )}
                {booth.print_remark && (
                  <div>
                    <span className="text-zinc-500 not-italic font-medium">Print Remark: </span>
                    {booth.print_remark}
                  </div>
                )}
                {booth.goodies_remark && (
                  <div>
                    <span className="text-zinc-500 not-italic font-medium">Goodies Note: </span>
                    {booth.goodies_remark}
                  </div>
                )}
              </div>
            )}

            {/* Promotional Goodies Requirements (Only shown when goodies items exist) */}
            {goodiesItems && goodiesItems.length > 0 && (
              <div className="mt-1 pt-0.5 border-t border-zinc-200">
                <table className="table-fixed w-full text-left border-collapse text-[10.5px]">
                  <colgroup>
                    <col className="w-[50%]" />
                    <col className="w-[25%]" />
                    <col className="w-[12%]" />
                    <col className="w-[13%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-zinc-300 text-zinc-600 font-bold uppercase text-[9px] tracking-wider">
                      <th className="py-1 px-2 text-left">Goodies Item</th>
                      <th className="py-1 px-2 text-left">Specification</th>
                      <th className="py-1 px-2 text-center">Qty</th>
                      <th className="py-1 px-2 text-center">Check</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {goodiesItems.map((item) => (
                      <tr key={item.id} className="break-inside-avoid">
                        <td className="py-1 px-2 font-bold text-zinc-950 break-words">{item.item_name}</td>
                        <td className="py-1 px-2 text-zinc-700 break-words">{item.specification || '—'}</td>
                        <td className="py-1 px-2 text-center font-mono font-bold text-zinc-900">{item.quantity}</td>
                        <td className="py-1 px-2 text-center">
                          <span className="w-3.5 h-3.5 border-2 border-zinc-700 rounded-sm inline-block align-middle" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 3D Stall Design Preview Image (when available for this stall) */}
            {primaryPreviewImg && (
              <div className="mt-2 p-2 bg-zinc-50 border border-zinc-200 rounded-lg break-inside-avoid print:break-inside-avoid">
                <div className="flex justify-center items-center overflow-hidden">
                  <img
                    src={primaryPreviewImg}
                    alt={`3D Design Preview — ${primary3DView?.title || 'Stall View'}`}
                    className="max-w-[580px] max-h-[200px] w-auto h-auto object-contain rounded"
                    crossOrigin="anonymous"
                    loading="eager"
                  />
                </div>
                <div className="text-center mt-1 text-[9.5px] text-zinc-600 font-medium">
                  <span>
                    3D Stall Design Preview:{' '}
                    <strong className="text-zinc-950 font-bold">{primary3DView?.title || '3D View'}</strong>
                  </span>
                  {primary3DView && (primary3DView.drive_url || (primary3DView as any).url) && (
                    <span className="ml-2">
                      (
                      <a
                        href={(primary3DView.drive_url || (primary3DView as any).url).trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline font-bold"
                        title="Open Interactive 3D Model"
                      >
                        Open Interactive 3D Model
                      </a>
                      )
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: PRODUCTION REQUIREMENTS */}
        <div className="border-b border-zinc-200 pb-1.5">
          <div className="break-inside-avoid flex items-center justify-between border-b border-zinc-300 pb-0.5 mb-1">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 border-2 border-zinc-900 rounded-sm inline-block shrink-0" />
              <h2 className="text-xs font-black text-zinc-950 uppercase tracking-wide">
                2. Production Requirements
              </h2>
              <span className="text-zinc-400 font-normal mx-0.5">—</span>
              {renderStatusBadge(prodStatus)}
            </div>
            <div className="flex items-center gap-1 text-[9px] text-zinc-500">
              <span className="w-3 h-3 border border-zinc-400 rounded-sm inline-block shrink-0" />
              <span>Production checked on site</span>
            </div>
          </div>

          {/* Table of actual saved Production items */}
          {productionItems && productionItems.length > 0 ? (
            <table className="table-fixed w-full text-left border-collapse text-[10.5px]">
              <colgroup>
                <col className="w-[50%]" />
                <col className="w-[25%]" />
                <col className="w-[12%]" />
                <col className="w-[13%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-zinc-300 text-zinc-600 font-bold uppercase text-[9px] tracking-wider">
                  <th className="py-1 px-2 text-left">Production Item</th>
                  <th className="py-1 px-2 text-left">Specification</th>
                  <th className="py-1 px-2 text-center">Qty</th>
                  <th className="py-1 px-2 text-center">Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {productionItems.map((item) => (
                  <tr key={item.id} className="break-inside-avoid">
                    <td className="py-1 px-2 font-bold text-zinc-950 break-words">{item.item_name}</td>
                    <td className="py-1 px-2 text-zinc-700 break-words">{item.specification || '—'}</td>
                    <td className="py-1 px-2 text-center font-mono font-bold text-zinc-900">{item.quantity}</td>
                    <td className="py-1 px-2 text-center">
                      <span className="w-3.5 h-3.5 border-2 border-zinc-700 rounded-sm inline-block align-middle" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[10px] text-zinc-500 italic py-0.5 px-1.5">
              No specific production items assigned.
            </p>
          )}
        </div>

        {/* SECTION 3: FURNITURE */}
        <div className="border-b border-zinc-200 pb-1.5">
          <div className="break-inside-avoid flex items-center justify-between border-b border-zinc-300 pb-0.5 mb-1">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 border-2 border-zinc-900 rounded-sm inline-block shrink-0" />
              <h2 className="text-xs font-black text-zinc-950 uppercase tracking-wide">
                3. Furniture
              </h2>
              <span className="text-zinc-400 font-normal mx-0.5">—</span>
              {renderStatusBadge(furnStatus)}
            </div>
            <div className="flex items-center gap-1 text-[9px] text-zinc-500">
              <span className="w-3 h-3 border border-zinc-400 rounded-sm inline-block shrink-0" />
              <span>Furniture placed & verified</span>
            </div>
          </div>

          {furnitureItems && furnitureItems.length > 0 ? (
            <table className="table-fixed w-full text-left border-collapse text-[10.5px]">
              <colgroup>
                <col className="w-[50%]" />
                <col className="w-[25%]" />
                <col className="w-[12%]" />
                <col className="w-[13%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-zinc-300 text-zinc-600 font-bold uppercase text-[9px] tracking-wider">
                  <th className="py-1 px-2 text-left">Furniture Item</th>
                  <th className="py-1 px-2 text-left">Specification</th>
                  <th className="py-1 px-2 text-center">Qty</th>
                  <th className="py-1 px-2 text-center">Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {furnitureItems.map((item) => (
                  <tr key={item.id} className="break-inside-avoid">
                    <td className="py-1 px-2 font-bold text-zinc-950 break-words">{item.item_name}</td>
                    <td className="py-1 px-2 text-zinc-700 break-words">{item.specification || '—'}</td>
                    <td className="py-1 px-2 text-center font-mono font-bold text-zinc-900">{item.quantity}</td>
                    <td className="py-1 px-2 text-center">
                      <span className="w-3.5 h-3.5 border-2 border-zinc-700 rounded-sm inline-block align-middle" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[10px] text-zinc-500 italic py-0.5 px-1.5">
              No furniture items assigned.
            </p>
          )}
        </div>

        {/* SECTION 4: ELECTRICAL */}
        <div className="border-b border-zinc-200 pb-1.5">
          <div className="break-inside-avoid flex items-center justify-between border-b border-zinc-300 pb-0.5 mb-1">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 border-2 border-zinc-900 rounded-sm inline-block shrink-0" />
              <h2 className="text-xs font-black text-zinc-950 uppercase tracking-wide">
                4. Electrical
              </h2>
              <span className="text-zinc-400 font-normal mx-0.5">—</span>
              {renderStatusBadge(elecStatus)}
            </div>
            <div className="flex items-center gap-1 text-[9px] text-zinc-500">
              <span className="w-3 h-3 border border-zinc-400 rounded-sm inline-block shrink-0" />
              <span>Electrical connected & tested</span>
            </div>
          </div>

          {electricalItems && electricalItems.length > 0 ? (
            <table className="table-fixed w-full text-left border-collapse text-[10.5px]">
              <colgroup>
                <col className="w-[50%]" />
                <col className="w-[25%]" />
                <col className="w-[12%]" />
                <col className="w-[13%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-zinc-300 text-zinc-600 font-bold uppercase text-[9px] tracking-wider">
                  <th className="py-1 px-2 text-left">Electrical Item</th>
                  <th className="py-1 px-2 text-left">Specification</th>
                  <th className="py-1 px-2 text-center">Qty</th>
                  <th className="py-1 px-2 text-center">Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {electricalItems.map((item) => (
                  <tr key={item.id} className="break-inside-avoid">
                    <td className="py-1 px-2 font-bold text-zinc-950 break-words">{item.item_name}</td>
                    <td className="py-1 px-2 text-zinc-700 break-words">{item.specification || '—'}</td>
                    <td className="py-1 px-2 text-center font-mono font-bold text-zinc-900">{item.quantity}</td>
                    <td className="py-1 px-2 text-center">
                      <span className="w-3.5 h-3.5 border-2 border-zinc-700 rounded-sm inline-block align-middle" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[10px] text-zinc-500 italic py-0.5 px-1.5">
              No electrical items assigned.
            </p>
          )}
        </div>
      </div>

      {/* 4. FOOTER (Prepared By, Checked By, Date - Compact Layout) */}
      <div className="mt-3 pt-2 border-t-2 border-zinc-900 break-inside-avoid">
        <div className="grid grid-cols-3 gap-6 text-[10px] text-zinc-800">
          <div>
            <span className="font-bold text-zinc-900 uppercase tracking-wider block">
              Prepared By:
            </span>
            <div className="h-5 border-b border-zinc-400 mt-2" />
          </div>

          <div>
            <span className="font-bold text-zinc-900 uppercase tracking-wider block">
              Checked By:
            </span>
            <div className="h-5 border-b border-zinc-400 mt-2" />
          </div>

          <div>
            <span className="font-bold text-zinc-900 uppercase tracking-wider block">
              Date:
            </span>
            <div className="h-5 border-b border-zinc-400 mt-2" />
          </div>
        </div>

        <div className="mt-2 pt-1 border-t border-zinc-200 flex items-center justify-between text-[8.5px] text-zinc-500">
          <div className="flex items-center gap-1.5">
            <img src="/logo.png" alt="Reworkzone" className="h-2.5 w-auto object-contain opacity-70" />
            <span>Reworkzone Stalls Operations Management • stalls.reworkzone.in</span>
          </div>
          <span className="font-mono">
            Doc Ref: {booth.id ? booth.id.substring(0, 10).toUpperCase() : 'RWZ'} • Official Production Checklist
          </span>
        </div>
      </div>
    </div>
  );
}
