import React from 'react';
import { StallPrintData, StallType, BoothTask } from './types';
import { isPendingOrEmpty } from './boothSort';
import { CompactQRCode } from './QRCodeComponent';

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
      className="w-7 h-7 shrink-0"
      fill="none"
      aria-hidden="true"
    >
      {/* Subtle stall footprint */}
      <rect
        x="4.5"
        y="4.5"
        width="23"
        height="23"
        rx="1.5"
        stroke="#d4d4d8"
        strokeWidth="0.8"
        fill="#ffffff"
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
          {/* Solid physical walls: Left and Back */}
          <path
            d="M 6.5 25.5 L 6.5 6.5 L 25.5 6.5"
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
      className={`stall-print-sheet bg-white text-zinc-950 font-sans leading-normal text-[11px] p-5 sm:p-7 w-full max-w-[210mm] mx-auto ${
        isBulk && !isLast ? 'break-after-page page-break-after-always' : ''
      }`}
      style={{
        boxSizing: 'border-box',
      }}
    >
      {/* 1. TOP HEADER & BRANDING */}
      <div className="border-b-2 border-zinc-900 pb-2.5 mb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img
              src="/logo.png"
              alt="Reworkzone"
              className="h-9 sm:h-10 w-auto object-contain shrink-0"
            />
            <div className="border-l-2 border-zinc-300 pl-3.5">
              <span className="text-[10px] tracking-widest uppercase font-bold text-zinc-600 block">
                Exhibitions & Turnkey Fabrication
              </span>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-zinc-950 uppercase mt-0.5">
                Stall Production & Requirements Checklist
              </h1>
            </div>
          </div>
          <div className="text-right text-[10px] text-zinc-600 font-mono shrink-0">
            <div>
              Doc Ref:{' '}
              <span className="font-bold text-zinc-950">
                {booth.id ? booth.id.substring(0, 10).toUpperCase() : 'RWZ-STALL'}
              </span>
            </div>
            <div>
              Print Date: <span className="font-medium text-zinc-900">{printDateStr}</span>
            </div>
          </div>
        </div>

        {/* 2. STALL INFORMATION GRID (Prominent Company Name & Booth #) */}
        <div className="mt-2.5 pt-2 border-t border-zinc-300">
          <div className="grid grid-cols-12 gap-2 text-[11px]">
            {/* Prominent Company / Exhibitor */}
            <div className="col-span-8 bg-zinc-50 border border-zinc-200 rounded p-2">
              <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-semibold">
                Company / Exhibitor
              </span>
              <span
                className="text-sm sm:text-base font-black text-zinc-950 block truncate"
                title={booth.client_name}
              >
                {booth.client_name}
              </span>
            </div>

            {/* Prominent Booth Number */}
            <div className="col-span-4 bg-zinc-50 border border-zinc-200 rounded p-2">
              <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-semibold">
                Booth Number
              </span>
              <span className="font-mono font-black text-sm sm:text-base text-zinc-950 block">
                {isPendingOrEmpty(booth.booth_number) ? 'Not Assigned' : `#${booth.booth_number}`}
              </span>
            </div>

            {/* Exhibition Name */}
            <div className="col-span-4 py-1">
              <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-semibold">
                Exhibition
              </span>
              <span className="font-bold text-zinc-900 text-xs truncate block" title={eventName}>
                {eventName || 'Exhibition'}
              </span>
            </div>

            {/* Stall Size */}
            <div className="col-span-2 py-1">
              <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-semibold">
                Stall Size
              </span>
              <span className="font-mono font-bold text-zinc-900 text-xs block">
                {booth.stand_size || '3 × 3 m'}
              </span>
            </div>

            {/* Stall Type */}
            <div className="col-span-2 py-1">
              <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-semibold">
                Stall Type
              </span>
              <span className="font-bold text-zinc-900 text-xs block">
                {structureType}
              </span>
            </div>

            {/* Mobile Contact */}
            <div className="col-span-4 py-1">
              <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-semibold">
                Mobile Number
              </span>
              <span className="font-mono font-medium text-zinc-900 text-xs block">
                {booth.phone || '—'}
              </span>
            </div>

            {/* Wall Configuration with Compact Vector Diagram */}
            <div className="col-span-12 py-1.5 px-2 bg-amber-50/60 border border-amber-200/80 rounded flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-[9px] uppercase tracking-wider text-zinc-600 font-bold">
                  Wall Configuration:
                </span>
                <span className="font-bold text-zinc-950 text-xs">
                  {wallConfigInfo.label}
                </span>
              </div>
              {wallConfigInfo.hasDiagram && (
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">
                    Layout:
                  </span>
                  <PrintableWallDiagram wallConfig={booth.wall_configuration} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. FIVE MAIN CHECKLIST SECTIONS */}
      <div className="space-y-3.5">
        {/* SECTION 1: DESIGN */}
        <div className="break-inside-avoid border-b border-zinc-200 pb-2.5">
          <div className="flex items-center justify-between border-b border-zinc-300 pb-1 mb-2">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-zinc-900 rounded-sm inline-block shrink-0" />
              <h2 className="text-xs font-black text-zinc-950 uppercase tracking-wide">
                1. Design
              </h2>
            </div>
            <span className="text-[10px] font-mono text-zinc-600 font-semibold">
              Status: {renderStatusBadge(designStatus)}
            </span>
          </div>

          <div className="space-y-2 text-[11px] text-zinc-800">
            <div className="grid grid-cols-2 gap-3 items-start">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-semibold">
                  Responsibility Assignment
                </span>
                <span className="font-bold text-zinc-950 text-xs">
                  {booth.design_responsibility || 'Client Side'}
                </span>
              </div>

              {booth.notes && (
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-semibold">
                    Design Remarks / Notes
                  </span>
                  <span className="text-[10px] text-zinc-700 italic block">
                    {booth.notes}
                  </span>
                </div>
              )}
            </div>

            {/* 3D Stall View links & QR */}
            {valid3DViews.length > 1 ? (
              <div className="bg-zinc-50 border border-zinc-200 rounded p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-600 font-bold">
                    3D Stall Views ({valid3DViews.length})
                  </span>
                  <span className="text-[9px] text-zinc-400 font-mono">Multiple Angles Saved</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {valid3DViews.map((v, idx) => {
                    const vUrl = (v.drive_url || (v as any).url || '').trim();
                    const vTitle = v.title?.trim() || `3D View ${idx + 1}`;
                    return (
                      <div
                        key={v.id || idx}
                        className="flex items-center justify-between gap-2 bg-white border border-zinc-200 rounded p-1.5"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-[8.5px] uppercase tracking-wider text-zinc-400 block font-medium">
                            Angle {idx + 1}
                          </span>
                          <a
                            href={vUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline font-bold transition-colors text-[11px] truncate block"
                            title={`Open ${vTitle} in new tab`}
                          >
                            {vTitle}
                          </a>
                          <span className="text-[9px] text-zinc-400 font-mono truncate block mt-0.5">
                            {vUrl}
                          </span>
                        </div>
                        <a
                          href={vUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 block hover:opacity-80 transition-opacity"
                          title={`Scan or click to open ${vTitle}`}
                        >
                          <CompactQRCode url={vUrl} size={44} label="Scan 3D" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : has3D ? (
              <div className="flex items-center justify-between gap-3 bg-zinc-50 border border-zinc-200 rounded p-2">
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-semibold">
                    3D Stall View
                  </span>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <a
                      href={single3DUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline font-bold transition-colors text-xs"
                      title="Open 3D Design View in new tab"
                    >
                      View 3D Design
                    </a>
                    {valid3DViews.length === 1 && valid3DViews[0].title && valid3DViews[0].title.toLowerCase() !== 'view 3d design' && (
                      <span className="text-[10px] text-zinc-600 font-medium">
                        ({valid3DViews[0].title})
                      </span>
                    )}
                  </div>
                  <div className="text-[9.5px] text-zinc-400 font-mono truncate mt-0.5">
                    {single3DUrl}
                  </div>
                </div>
                <a
                  href={single3DUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 block hover:opacity-80 transition-opacity"
                  title="Scan or click to open 3D Design"
                >
                  <CompactQRCode url={single3DUrl} size={48} label="Scan 3D" />
                </a>
              </div>
            ) : (
              <div className="bg-zinc-50 border border-zinc-200 rounded p-2 text-[11px] text-zinc-500 italic">
                3D View: Not Added
              </div>
            )}

            <div className="pt-0.5 flex items-center gap-2 text-[10px] text-zinc-600">
              <span className="w-3 h-3 border border-zinc-700 rounded-sm inline-block shrink-0" />
              <span>Design approved and verified for site fabrication</span>
            </div>
          </div>
        </div>

        {/* SECTION 2: PRINT FILES & GOODIES */}
        <div className="break-inside-avoid border-b border-zinc-200 pb-2.5">
          <div className="flex items-center justify-between border-b border-zinc-300 pb-1 mb-2">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-zinc-900 rounded-sm inline-block shrink-0" />
              <h2 className="text-xs font-black text-zinc-950 uppercase tracking-wide">
                2. Print Files & Goodies
              </h2>
            </div>
            <span className="text-[10px] font-mono text-zinc-600 font-semibold">
              Status: {renderStatusBadge(printStatus)}
            </span>
          </div>

          <div className="space-y-2 text-[11px] text-zinc-800">
            {/* Side-by-Side Artwork Link Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Primary Print Files */}
              <div className="bg-zinc-50 border border-zinc-200 rounded p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-semibold">
                      Print Artwork
                    </span>
                    {hasPrintUrl ? (
                      <div className="mt-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <a
                            href={printUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline font-bold transition-colors text-xs"
                            title="Open Print Files in Google Drive"
                          >
                            Open Print Files
                          </a>
                        </div>
                        <div className="text-[9.5px] text-zinc-400 font-mono truncate mt-0.5">
                          {printUrl}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-zinc-500 italic mt-0.5">
                        Print Files: Not Added
                      </div>
                    )}
                    <div className="mt-1 text-[10px] text-zinc-800">
                      <span className="text-zinc-500 font-medium">Readiness: </span>
                      <span className="font-bold text-zinc-950">{booth.print_file_status || 'Designs Pending'}</span>
                    </div>
                    {booth.print_remark && (
                      <div className="text-[9.5px] text-zinc-600 italic mt-0.5">
                        Remark: {booth.print_remark}
                      </div>
                    )}
                  </div>
                  {hasPrintUrl && (
                    <a
                      href={printUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 block hover:opacity-80 transition-opacity"
                      title="Scan or click to open Print Files"
                    >
                      <CompactQRCode url={printUrl} size={48} label="Scan Print" />
                    </a>
                  )}
                </div>
              </div>

              {/* Promotional Goodies Artwork */}
              <div className="bg-zinc-50 border border-zinc-200 rounded p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-semibold">
                      Goodies Artwork
                    </span>
                    {hasGoodiesUrl ? (
                      <div className="mt-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <a
                            href={goodiesUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline font-bold transition-colors text-xs"
                            title="Open Goodies Artwork in Google Drive"
                          >
                            Open Goodies Artwork
                          </a>
                        </div>
                        <div className="text-[9.5px] text-zinc-400 font-mono truncate mt-0.5">
                          {goodiesUrl}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-zinc-500 italic mt-0.5">
                        Artwork: Not Added
                      </div>
                    )}
                    <div className="mt-1 text-[10px] text-zinc-800">
                      <span className="text-zinc-500 font-medium">Status: </span>
                      <span className="font-bold text-zinc-950">{booth.goodies_status || 'Awaiting Client Artwork'}</span>
                    </div>
                    {booth.goodies_remark && (
                      <div className="text-[9.5px] text-zinc-600 italic mt-0.5">
                        Note: {booth.goodies_remark}
                      </div>
                    )}
                  </div>
                  {hasGoodiesUrl && (
                    <a
                      href={goodiesUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 block hover:opacity-80 transition-opacity"
                      title="Scan or click to open Goodies Artwork"
                    >
                      <CompactQRCode url={goodiesUrl} size={48} label="Scan Goodies" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Promotional Goodies Requirements */}
            <div className="pt-1.5 border-t border-dashed border-zinc-200">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-zinc-900 uppercase tracking-wider">
                  Promotional Goodies Requirements
                </span>
                <span className="text-[10px] text-zinc-600">
                  Artwork: <span className="font-semibold text-zinc-900">{booth.goodies_status || 'Awaiting Client Artwork'}</span>
                </span>
              </div>

              {booth.goodies_remark && (
                <div className="text-[10px] text-zinc-700 italic mb-1.5">
                  Goodies Note: {booth.goodies_remark}
                </div>
              )}

              {goodiesItems && goodiesItems.length > 0 ? (
                <table className="w-full text-left border-collapse text-[10.5pt]">
                  <thead>
                    <tr className="border-b border-zinc-300 text-zinc-600 font-bold uppercase text-[9px] tracking-wider">
                      <th className="py-1 px-1.5">Goodies Item</th>
                      <th className="py-1 px-1.5">Specification</th>
                      <th className="py-1 px-1.5 w-16 text-center">Qty</th>
                      <th className="py-1 px-1.5 w-14 text-center">Check</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {goodiesItems.map((item) => (
                      <tr key={item.id} className="break-inside-avoid">
                        <td className="py-1 px-1.5 font-bold text-zinc-950">{item.item_name}</td>
                        <td className="py-1 px-1.5 text-zinc-700">{item.specification || '—'}</td>
                        <td className="py-1 px-1.5 text-center font-mono font-bold text-zinc-900">{item.quantity}</td>
                        <td className="py-1 px-1.5 text-center">
                          <span className="w-3.5 h-3.5 border-2 border-zinc-700 rounded-sm inline-block align-middle" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-[10px] text-zinc-500 italic">No promotional goodies assigned.</p>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 3: PRODUCTION REQUIREMENTS (Important Section!) */}
        <div className="break-inside-avoid border-b border-zinc-200 pb-2.5">
          <div className="flex items-center justify-between border-b border-zinc-300 pb-1 mb-2">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-zinc-900 rounded-sm inline-block shrink-0" />
              <h2 className="text-xs font-black text-zinc-950 uppercase tracking-wide">
                3. Production Requirements
              </h2>
            </div>
            <span className="text-[10px] font-mono text-zinc-600 font-semibold">
              Status: {renderStatusBadge(prodStatus)}
            </span>
          </div>

          {/* Wall Configuration prominently displayed at the top of Production */}
          <div className="py-1 px-2 mb-2 bg-zinc-50 border-l-2 border-amber-500 text-[11px] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-600 uppercase text-[9px] tracking-wider">
                Wall Configuration:
              </span>
              <span className="font-bold text-zinc-950 text-xs">
                {wallConfigInfo.label}
              </span>
            </div>
          </div>

          {/* Table of actual saved Production items */}
          {productionItems && productionItems.length > 0 ? (
            <table className="w-full text-left border-collapse text-[10.5pt]">
              <thead>
                <tr className="border-b border-zinc-300 text-zinc-600 font-bold uppercase text-[9px] tracking-wider">
                  <th className="py-1 px-1.5">Production Item</th>
                  <th className="py-1 px-1.5">Specification</th>
                  <th className="py-1 px-1.5 w-16 text-center">Qty</th>
                  <th className="py-1 px-1.5 w-14 text-center">Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {productionItems.map((item) => (
                  <tr key={item.id} className="break-inside-avoid">
                    <td className="py-1 px-1.5 font-bold text-zinc-950">{item.item_name}</td>
                    <td className="py-1 px-1.5 text-zinc-700">{item.specification || '—'}</td>
                    <td className="py-1 px-1.5 text-center font-mono font-bold text-zinc-900">{item.quantity}</td>
                    <td className="py-1 px-1.5 text-center">
                      <span className="w-3.5 h-3.5 border-2 border-zinc-700 rounded-sm inline-block align-middle" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[10px] text-zinc-500 italic py-1 px-1.5">
              No specific production items assigned.
            </p>
          )}
        </div>

        {/* SECTION 4: FURNITURE */}
        <div className="break-inside-avoid border-b border-zinc-200 pb-2.5">
          <div className="flex items-center justify-between border-b border-zinc-300 pb-1 mb-2">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-zinc-900 rounded-sm inline-block shrink-0" />
              <h2 className="text-xs font-black text-zinc-950 uppercase tracking-wide">
                4. Furniture
              </h2>
            </div>
            <span className="text-[10px] font-mono text-zinc-600 font-semibold">
              Status: {renderStatusBadge(furnStatus)}
            </span>
          </div>

          {furnitureItems && furnitureItems.length > 0 ? (
            <table className="w-full text-left border-collapse text-[10.5pt]">
              <thead>
                <tr className="border-b border-zinc-300 text-zinc-600 font-bold uppercase text-[9px] tracking-wider">
                  <th className="py-1 px-1.5">Furniture Item</th>
                  <th className="py-1 px-1.5">Specification</th>
                  <th className="py-1 px-1.5 w-16 text-center">Qty</th>
                  <th className="py-1 px-1.5 w-14 text-center">Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {furnitureItems.map((item) => (
                  <tr key={item.id} className="break-inside-avoid">
                    <td className="py-1 px-1.5 font-bold text-zinc-950">{item.item_name}</td>
                    <td className="py-1 px-1.5 text-zinc-700">{item.specification || '—'}</td>
                    <td className="py-1 px-1.5 text-center font-mono font-bold text-zinc-900">{item.quantity}</td>
                    <td className="py-1 px-1.5 text-center">
                      <span className="w-3.5 h-3.5 border-2 border-zinc-700 rounded-sm inline-block align-middle" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[10px] text-zinc-500 italic py-1 px-1.5">
              No furniture items assigned.
            </p>
          )}
        </div>

        {/* SECTION 5: ELECTRICAL */}
        <div className="break-inside-avoid border-b border-zinc-200 pb-2.5">
          <div className="flex items-center justify-between border-b border-zinc-300 pb-1 mb-2">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-zinc-900 rounded-sm inline-block shrink-0" />
              <h2 className="text-xs font-black text-zinc-950 uppercase tracking-wide">
                5. Electrical
              </h2>
            </div>
            <span className="text-[10px] font-mono text-zinc-600 font-semibold">
              Status: {renderStatusBadge(elecStatus)}
            </span>
          </div>

          {electricalItems && electricalItems.length > 0 ? (
            <table className="w-full text-left border-collapse text-[10.5pt]">
              <thead>
                <tr className="border-b border-zinc-300 text-zinc-600 font-bold uppercase text-[9px] tracking-wider">
                  <th className="py-1 px-1.5">Electrical Item</th>
                  <th className="py-1 px-1.5">Specification</th>
                  <th className="py-1 px-1.5 w-16 text-center">Qty</th>
                  <th className="py-1 px-1.5 w-14 text-center">Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {electricalItems.map((item) => (
                  <tr key={item.id} className="break-inside-avoid">
                    <td className="py-1 px-1.5 font-bold text-zinc-950">{item.item_name}</td>
                    <td className="py-1 px-1.5 text-zinc-700">{item.specification || '—'}</td>
                    <td className="py-1 px-1.5 text-center font-mono font-bold text-zinc-900">{item.quantity}</td>
                    <td className="py-1 px-1.5 text-center">
                      <span className="w-3.5 h-3.5 border-2 border-zinc-700 rounded-sm inline-block align-middle" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[10px] text-zinc-500 italic py-1 px-1.5">
              No electrical items assigned.
            </p>
          )}
        </div>
      </div>

      {/* 4. FOOTER (Prepared By, Checked By, Date) */}
      <div className="mt-4 pt-3 border-t-2 border-zinc-900 break-inside-avoid">
        <div className="grid grid-cols-3 gap-6 text-[10px] text-zinc-800">
          <div>
            <span className="font-bold text-zinc-900 uppercase tracking-wider block">
              Prepared By:
            </span>
            <div className="h-6 border-b border-zinc-500 mt-3" />
          </div>

          <div>
            <span className="font-bold text-zinc-900 uppercase tracking-wider block">
              Checked By:
            </span>
            <div className="h-6 border-b border-zinc-500 mt-3" />
          </div>

          <div>
            <span className="font-bold text-zinc-900 uppercase tracking-wider block">
              Date:
            </span>
            <div className="h-6 border-b border-zinc-500 mt-3" />
          </div>
        </div>

        <div className="mt-3 pt-1.5 border-t border-zinc-200 flex items-center justify-between text-[9px] text-zinc-500">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Reworkzone" className="h-3 w-auto object-contain opacity-70" />
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
