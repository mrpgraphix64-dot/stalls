import React from 'react';
import QRCode from 'qrcode';
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
      className="w-5 h-5 shrink-0"
      fill="none"
      aria-hidden="true"
    >
      {/* Stall footprint */}
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
          <path
            d="M 6.5 25.5 L 6.5 6.5 L 25.5 6.5 L 25.5 25.5"
            stroke="#18181b"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
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
          <path
            d="M 25.5 6.5 L 6.5 6.5 L 6.5 25.5"
            stroke="#18181b"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
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
          <path
            d="M 6.5 6.5 L 25.5 6.5 L 25.5 25.5"
            stroke="#18181b"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
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
          <path
            d="M 6.5 6.5 L 25.5 6.5"
            stroke="#18181b"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
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

// In-memory cache for generated QR code data URLs (instant synchronous reuse)
const qrCodeCache = new Map<string, string>();

/**
 * Scannable and clickable QR code component for A4 print and PDF export.
 * Wrapped in an anchor tag so clicking inside PDF viewer navigates directly to the URL.
 * Renders at approx 18-22 mm (72-84px) with high contrast black-on-white.
 */
export function ChecklistQRCode({
  url,
  label,
  sizePx = 76,
}: {
  url?: string | null;
  label: string;
  sizePx?: number;
}) {
  const cleanUrl = (url || '').trim();
  const isValid = cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://');

  // Slightly larger QR canvas if URL is very long, unless a compact size was explicitly requested
  const actualSize =
    sizePx < 70
      ? sizePx
      : cleanUrl.length > 120
      ? Math.max(sizePx, 84)
      : sizePx;

  const [dataUrl, setDataUrl] = React.useState<string | null>(() => {
    if (!isValid) return null;
    return qrCodeCache.get(cleanUrl) || null;
  });

  React.useEffect(() => {
    if (!isValid) {
      setDataUrl(null);
      return;
    }
    if (qrCodeCache.has(cleanUrl)) {
      setDataUrl(qrCodeCache.get(cleanUrl)!);
      return;
    }
    let isMounted = true;
    QRCode.toDataURL(cleanUrl, {
      margin: 1,
      width: actualSize * 2, // high-res for 300dpi PDF canvas rendering
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((dataUri) => {
        qrCodeCache.set(cleanUrl, dataUri);
        if (isMounted) {
          setDataUrl(dataUri);
        }
      })
      .catch((err) => {
        console.error('QR code generation error for', cleanUrl, err);
      });

    return () => {
      isMounted = false;
    };
  }, [cleanUrl, isValid, actualSize]);

  if (!isValid || !dataUrl) {
    return null;
  }

  return (
    <a
      href={cleanUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex flex-col items-center justify-between p-1 bg-white border border-zinc-300 rounded shadow-2xs hover:border-zinc-700 transition-colors group text-decoration-none shrink-0"
      title={`Scan or click to open ${label}`}
      style={{ width: `${actualSize + 12}px` }}
    >
      <img
        src={dataUrl}
        alt={`${label} QR Code`}
        className="w-auto h-auto object-contain block"
        style={{ width: `${actualSize}px`, height: `${actualSize}px` }}
        loading="eager"
      />
      <span
        className={`${
          actualSize < 65 ? 'text-[7.5px]' : 'text-[8.5px]'
        } font-black uppercase tracking-wider text-zinc-950 mt-1 text-center leading-tight group-hover:text-blue-600 block whitespace-nowrap`}
      >
        {label}
      </span>
      <span
        className={`${
          actualSize < 65 ? 'text-[6.5px]' : 'text-[7px]'
        } text-zinc-500 font-medium mt-0.5 leading-none text-center block whitespace-nowrap`}
      >
        Scan / Click
      </span>
    </a>
  );
}

function getClientAccessibleImageUrl(imgUrl?: string | null): string | null {
  if (!imgUrl) return null;
  const clean = imgUrl.trim();
  if (clean.startsWith('https://')) return clean;
  if (clean.startsWith('/uploads/') && typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;
    if (origin.startsWith('https://')) {
      return `${origin}${clean}`;
    }
  }
  return null;
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

  const furnStatus = getSectionStatus(tasks, 'furniture');
  const elecStatus = getSectionStatus(tasks, 'electrical');

  const structureType = getStallTypeLabel(booth.booth_type);
  const wallConfigInfo = getWallConfigDisplay(booth.wall_configuration);

  // 3D Views processing
  const valid3DViews = (views3D || []).filter((v) => {
    const u = (v.drive_url || (v as any).url || '').trim();
    const img = (v.preview_image_url || '').trim();
    return u.startsWith('http://') || u.startsWith('https://') || img.length > 0;
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
    primary3DView && primary3DView.drive_url && (primary3DView.drive_url.startsWith('http://') || primary3DView.drive_url.startsWith('https://'))
      ? primary3DView.drive_url.trim()
      : valid3DViews.length > 0 && valid3DViews[0].drive_url && (valid3DViews[0].drive_url.startsWith('http://') || valid3DViews[0].drive_url.startsWith('https://'))
      ? valid3DViews[0].drive_url.trim()
      : hasMainFolder
      ? mainFolderUrl
      : '';
  const has3DViewUrl = Boolean(single3DUrl && (single3DUrl.startsWith('http://') || single3DUrl.startsWith('https://')));
  const clientImgUrl = getClientAccessibleImageUrl(primaryPreviewImg);

  // Print & Goodies Links processing
  const printUrl = (booth.print_drive_url || '').trim();
  const hasPrintUrl = printUrl.startsWith('http://') || printUrl.startsWith('https://');

  const goodiesUrl = (booth.goodies_drive_url || '').trim();
  const hasGoodiesUrl = goodiesUrl.startsWith('http://') || goodiesUrl.startsWith('https://');

  // Furniture & Electrical omission rules
  const isFurnNotRequired = furnStatus === 'Not Required';
  const hasFurnItems = Boolean(furnitureItems && furnitureItems.length > 0);
  const shouldShowFurnSection = hasFurnItems || !isFurnNotRequired;

  const isElecNotRequired = elecStatus === 'Not Required';
  const hasElecItems = Boolean(electricalItems && electricalItems.length > 0);
  const shouldShowElecSection = hasElecItems || !isElecNotRequired;

  const hasAnyQRorMedia = hasPrintUrl || has3DViewUrl || primaryPreviewImg || clientImgUrl;

  return (
    <div
      className={`stall-print-sheet bg-white text-zinc-950 font-sans leading-normal text-[11px] p-5 w-full max-w-[210mm] mx-auto ${
        isBulk && !isLast ? 'break-after-page page-break-after-always' : ''
      }`}
      data-booth-number={booth.booth_number || ''}
      data-client-name={booth.client_name || ''}
      style={{
        boxSizing: 'border-box',
      }}
    >
      {/* 1. COMPACT MINIMAL HEADER */}
      <div className="border-b-2 border-zinc-900 pb-2.5 mb-3">
        {/* Top line: Exhibition Name & Logo */}
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <img
              src="/logo.png"
              alt="Reworkzone"
              className="h-6 w-auto object-contain shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
            <div className="min-w-0 flex-1">
              <span className="text-[11.5px] font-black tracking-wide uppercase text-zinc-700 block leading-snug break-words">
                {eventName || 'Exhibition'}
              </span>
            </div>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 bg-zinc-100 border border-zinc-300 px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap self-center">
            Production Sheet
          </span>
        </div>

        {/* Primary Row: Company Name & Booth Number (Prominent!) */}
        <div className="grid grid-cols-12 gap-2.5 items-stretch">
          <div className="col-span-8 bg-zinc-50 border border-zinc-300 rounded px-3.5 py-2.5 flex flex-col justify-between">
            <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-bold leading-normal mb-1">
              Company / Exhibitor
            </span>
            <span className="text-sm sm:text-base font-black text-zinc-950 leading-snug break-words">
              {booth.client_name || 'Exhibitor'}
            </span>
          </div>

          <div className="col-span-4 bg-zinc-900 text-white border border-zinc-900 rounded px-3.5 py-2.5 flex flex-col justify-between items-center text-center">
            <span className="text-[8px] uppercase tracking-wider text-zinc-300 font-bold leading-normal mb-1">
              Booth Number
            </span>
            <span className="font-mono font-black text-sm sm:text-base text-white leading-snug break-words">
              {isPendingOrEmpty(booth.booth_number) ? 'Not Assigned' : `#${booth.booth_number}`}
            </span>
          </div>
        </div>

        {/* Secondary Row: Stall Size, Stall Type, Wall Configuration (with vector diagram) */}
        <div className="grid grid-cols-12 gap-2.5 items-stretch mt-2.5 pt-2 border-t border-zinc-200 text-[11px]">
          <div className="col-span-3 bg-zinc-50/70 border border-zinc-200 rounded px-3 py-2 flex flex-col justify-between min-w-0">
            <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-bold block leading-normal mb-1">
              Size
            </span>
            <span className="font-mono font-bold text-zinc-950 text-[11.5px] leading-snug block break-words">
              {booth.stand_size || '3 × 3 m'}
            </span>
          </div>

          <div className="col-span-3 bg-zinc-50/70 border border-zinc-200 rounded px-3 py-2 flex flex-col justify-between min-w-0">
            <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-bold block leading-normal mb-1">
              Stall Type
            </span>
            <span className="font-bold text-zinc-950 text-[11.5px] leading-snug block break-words">
              {structureType}
            </span>
          </div>

          <div className="col-span-6 bg-amber-50/80 border border-amber-300/80 rounded px-3 py-2 flex items-center justify-between gap-2.5 min-w-0">
            <div className="min-w-0 flex-1">
              <span className="text-[8px] uppercase tracking-wider text-amber-900 font-bold block leading-normal mb-1">
                Wall Configuration
              </span>
              <span className="font-bold text-zinc-950 text-[11px] leading-snug block break-words">
                {wallConfigInfo.label}
              </span>
            </div>
            {wallConfigInfo.hasDiagram && (
              <div className="shrink-0 p-1 bg-white/90 rounded border border-amber-200">
                <PrintableWallDiagram wallConfig={booth.wall_configuration} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. FOUR CHECKLIST SECTIONS */}
      <div className="space-y-2.5">
        {/* SECTION 1: PRINT FILES & DESIGN */}
        <div className="border-b border-zinc-200 pb-2">
          <div className="break-inside-avoid flex items-center justify-between border-b border-zinc-300 pb-1 mb-1.5">
            <h2 className="text-xs font-black text-zinc-950 uppercase tracking-wide">
              1. Print Files & Design
            </h2>
            <div className="flex items-center gap-1.5 text-[9px] text-zinc-600 font-semibold">
              <span className="w-3.5 h-3.5 border border-zinc-500 rounded-xs inline-block shrink-0 bg-white" />
              <span>Verified on site</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-start justify-between">
            {/* Left Column: Details, Links, Remarks, Goodies */}
            <div className="flex-1 min-w-0 space-y-1.5 text-[11px] text-zinc-800">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
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
                        const hasVUrl = vUrl.startsWith('http://') || vUrl.startsWith('https://');
                        const vTitle = v.title?.trim() || `View ${idx + 1}`;
                        return (
                          <React.Fragment key={v.id || idx}>
                            {idx > 0 && <span className="text-zinc-300">/</span>}
                            {hasVUrl ? (
                              <a
                                href={vUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline font-bold text-[11px] transition-colors"
                                title={`Open ${vTitle}`}
                              >
                                {vTitle}
                              </a>
                            ) : (
                              <span className="text-zinc-950 font-bold text-[11px]">
                                {vTitle} (Image Attached)
                              </span>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </span>
                  ) : has3DViewUrl ? (
                    <a
                      href={single3DUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline font-bold text-[11px] transition-colors"
                      title="Open 3D Design in new tab"
                    >
                      {valid3DViews[0]?.title && valid3DViews[0].title.toLowerCase() !== 'view 3d design'
                        ? valid3DViews[0].title
                        : 'Open 3D View'}
                    </a>
                  ) : primaryPreviewImg ? (
                    <span className="text-zinc-950 font-bold text-[11px]">
                      {primary3DView?.title || '3D Design'} (Image Attached)
                    </span>
                  ) : (
                    <span className="text-zinc-400 italic text-[11px]">Not Added</span>
                  )}
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

                {hasGoodiesUrl && (
                  <>
                    <span className="text-zinc-300 hidden sm:inline">|</span>
                    <div>
                      <span className="text-zinc-500 font-semibold">Goodies Files: </span>
                      <a
                        href={goodiesUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline font-bold text-[11px] transition-colors"
                        title="Open Goodies Artwork in Google Drive"
                      >
                        Open Artwork
                      </a>
                    </div>
                  </>
                )}
              </div>

              {/* Remarks (Only when saved & relevant) */}
              {(booth.print_remark || booth.notes || booth.goodies_remark) && (
                <div className="text-[10px] text-zinc-600 italic flex flex-wrap gap-x-3 gap-y-0.5 pt-0.5">
                  {booth.print_remark && (
                    <div>
                      <span className="text-zinc-500 not-italic font-semibold">Print Remark: </span>
                      {booth.print_remark}
                    </div>
                  )}
                  {booth.notes && (
                    <div>
                      <span className="text-zinc-500 not-italic font-semibold">Notes: </span>
                      {booth.notes}
                    </div>
                  )}
                  {booth.goodies_remark && (
                    <div>
                      <span className="text-zinc-500 not-italic font-semibold">Goodies Note: </span>
                      {booth.goodies_remark}
                    </div>
                  )}
                </div>
              )}

              {/* Promotional Goodies Requirements (Omitted entirely if no goodies saved) */}
              {goodiesItems && goodiesItems.length > 0 && (
                <div className="mt-1 pt-1 border-t border-zinc-200">
                  <div className="text-[9.5px] font-bold text-zinc-700 uppercase tracking-wider mb-0.5">
                    Goodies Requirements
                  </div>
                  <table className="table-fixed w-full text-left border-collapse text-[10px]">
                    <colgroup>
                      <col className="w-[50%]" />
                      <col className="w-[25%]" />
                      <col className="w-[12%]" />
                      <col className="w-[13%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-zinc-300 text-zinc-600 font-bold uppercase text-[8.5px] tracking-wider">
                        <th className="py-0.5 px-2 text-left">Goodies Item</th>
                        <th className="py-0.5 px-2 text-left">Specification</th>
                        <th className="py-0.5 px-2 text-center">Qty</th>
                        <th className="py-0.5 px-2 text-center">Check</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {goodiesItems.map((item) => (
                        <tr key={item.id} className="break-inside-avoid">
                          <td className="py-0.5 px-2 font-bold text-zinc-950 break-words">{item.item_name}</td>
                          <td className="py-0.5 px-2 text-zinc-700 break-words">{item.specification || '—'}</td>
                          <td className="py-0.5 px-2 text-center font-mono font-bold text-zinc-900">{item.quantity}</td>
                          <td className="py-0.5 px-2 text-center">
                            <span className="w-3.5 h-3.5 border-2 border-zinc-700 rounded-xs inline-block align-middle" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right Column: QR Codes & 3D Thumbnail (Compact Media Block) */}
            {hasAnyQRorMedia && (
              <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-2 shrink-0 self-center sm:self-start">
                {/* Print Files QR Code */}
                {hasPrintUrl && (
                  <ChecklistQRCode url={printUrl} label="PRINT FILES" />
                )}

                {/* 3D View QR Code (or 3D Image QR if image-only with accessible HTTPS URL) */}
                {has3DViewUrl ? (
                  <ChecklistQRCode url={single3DUrl} label="3D VIEW" />
                ) : clientImgUrl ? (
                  <ChecklistQRCode url={clientImgUrl} label="3D IMAGE" />
                ) : null}

                {/* 3D Stall Design Preview Thumbnail */}
                {primaryPreviewImg && (
                  <div className="inline-flex flex-col items-center justify-between p-1 bg-white border border-zinc-300 rounded shadow-2xs shrink-0">
                    <a
                      href={has3DViewUrl ? single3DUrl : primaryPreviewImg}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block overflow-hidden"
                      title={primary3DView?.title || 'Open 3D Design'}
                    >
                      <img
                        src={primaryPreviewImg}
                        alt={`3D Design — ${primary3DView?.title || 'Stall View'}`}
                        className="max-h-[76px] max-w-[120px] w-auto h-auto object-contain rounded-xs"
                        crossOrigin="anonymous"
                        loading="eager"
                        onError={(e) => {
                          const box = (e.currentTarget.parentElement as HTMLElement)?.parentElement;
                          if (box) box.style.display = 'none';
                        }}
                      />
                    </a>
                    <span className="text-[7.5px] font-black uppercase tracking-wider text-zinc-950 mt-1 text-center leading-none block">
                      3D Preview
                    </span>
                    <span className="text-[7px] text-zinc-500 font-medium mt-0.5 leading-none text-center block">
                      {primary3DView?.title || 'Design View'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: PRODUCTION REQUIREMENTS */}
        <div className="border-b border-zinc-200 pb-2">
          <div className="break-inside-avoid flex items-center justify-between border-b border-zinc-300 pb-1 mb-1.5">
            <h2 className="text-xs font-black text-zinc-950 uppercase tracking-wide">
              2. Production Requirements
            </h2>
            <div className="flex items-center gap-1.5 text-[9px] text-zinc-600 font-semibold">
              <span className="w-3.5 h-3.5 border border-zinc-500 rounded-xs inline-block shrink-0 bg-white" />
              <span>Production verified</span>
            </div>
          </div>

          {productionItems && productionItems.length > 0 ? (
            <table className="table-fixed w-full text-left border-collapse text-[10.5px]">
              <colgroup>
                <col className="w-[50%]" />
                <col className="w-[25%]" />
                <col className="w-[12%]" />
                <col className="w-[13%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-zinc-300 text-zinc-600 font-bold uppercase text-[8.5px] tracking-wider">
                  <th className="py-1 px-2.5 text-left">Production Item</th>
                  <th className="py-1 px-2.5 text-left">Specification</th>
                  <th className="py-1 px-2.5 text-center">Qty</th>
                  <th className="py-1 px-2.5 text-center">Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {productionItems.map((item) => (
                  <tr key={item.id} className="break-inside-avoid">
                    <td className="py-1.5 px-2.5 font-bold text-zinc-950 break-words leading-snug">{item.item_name}</td>
                    <td className="py-1.5 px-2.5 text-zinc-700 break-words leading-snug">{item.specification || '—'}</td>
                    <td className="py-1.5 px-2.5 text-center font-mono font-bold text-zinc-900">{item.quantity}</td>
                    <td className="py-1.5 px-2.5 text-center">
                      <span className="w-3.5 h-3.5 border-2 border-zinc-700 rounded-xs inline-block align-middle" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[10px] text-zinc-500 italic py-1 px-2.5">
              No production items recorded.
            </p>
          )}
        </div>

        {/* SECTION 3: FURNITURE (Omitted if explicitly Not Required and 0 items) */}
        {shouldShowFurnSection && (
          <div className="border-b border-zinc-200 pb-2">
            <div className="break-inside-avoid flex items-center justify-between border-b border-zinc-300 pb-1 mb-1.5">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-black text-zinc-950 uppercase tracking-wide">
                  3. Furniture
                </h2>
                {isFurnNotRequired && hasFurnItems && (
                  <span className="text-[8.5px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded leading-none">
                    Marked N/A with active items
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[9px] text-zinc-600 font-semibold">
                <span className="w-3.5 h-3.5 border border-zinc-500 rounded-xs inline-block shrink-0 bg-white" />
                <span>Placed & verified</span>
              </div>
            </div>

            {hasFurnItems ? (
              <table className="table-fixed w-full text-left border-collapse text-[10.5px]">
                <colgroup>
                  <col className="w-[50%]" />
                  <col className="w-[25%]" />
                  <col className="w-[12%]" />
                  <col className="w-[13%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-zinc-300 text-zinc-600 font-bold uppercase text-[8.5px] tracking-wider">
                    <th className="py-1 px-2.5 text-left">Furniture Item</th>
                    <th className="py-1 px-2.5 text-left">Specification</th>
                    <th className="py-1 px-2.5 text-center">Qty</th>
                    <th className="py-1 px-2.5 text-center">Check</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {furnitureItems.map((item) => (
                    <tr key={item.id} className="break-inside-avoid">
                      <td className="py-1.5 px-2.5 font-bold text-zinc-950 break-words leading-snug">{item.item_name}</td>
                      <td className="py-1.5 px-2.5 text-zinc-700 break-words leading-snug">{item.specification || '—'}</td>
                      <td className="py-1.5 px-2.5 text-center font-mono font-bold text-zinc-900">{item.quantity}</td>
                      <td className="py-1.5 px-2.5 text-center">
                        <span className="w-3.5 h-3.5 border-2 border-zinc-700 rounded-xs inline-block align-middle" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-[10px] text-zinc-500 italic py-1 px-2.5">
                No furniture items requested.
              </p>
            )}
          </div>
        )}

        {/* SECTION 4: ELECTRICAL (Omitted if explicitly Not Required and 0 items) */}
        {shouldShowElecSection && (
          <div className="border-b border-zinc-200 pb-2">
            <div className="break-inside-avoid flex items-center justify-between border-b border-zinc-300 pb-1 mb-1.5">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-black text-zinc-950 uppercase tracking-wide">
                  4. Electrical
                </h2>
                {isElecNotRequired && hasElecItems && (
                  <span className="text-[8.5px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded leading-none">
                    Marked N/A with active items
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[9px] text-zinc-600 font-semibold">
                <span className="w-3.5 h-3.5 border border-zinc-500 rounded-xs inline-block shrink-0 bg-white" />
                <span>Connected & tested</span>
              </div>
            </div>

            {hasElecItems ? (
              <table className="table-fixed w-full text-left border-collapse text-[10.5px]">
                <colgroup>
                  <col className="w-[50%]" />
                  <col className="w-[25%]" />
                  <col className="w-[12%]" />
                  <col className="w-[13%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-zinc-300 text-zinc-600 font-bold uppercase text-[8.5px] tracking-wider">
                    <th className="py-1 px-2.5 text-left">Electrical Item</th>
                    <th className="py-1 px-2.5 text-left">Specification</th>
                    <th className="py-1 px-2.5 text-center">Qty</th>
                    <th className="py-1 px-2.5 text-center">Check</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {electricalItems.map((item) => (
                    <tr key={item.id} className="break-inside-avoid">
                      <td className="py-1.5 px-2.5 font-bold text-zinc-950 break-words leading-snug">{item.item_name}</td>
                      <td className="py-1.5 px-2.5 text-zinc-700 break-words leading-snug">{item.specification || '—'}</td>
                      <td className="py-1.5 px-2.5 text-center font-mono font-bold text-zinc-900">{item.quantity}</td>
                      <td className="py-1.5 px-2.5 text-center">
                        <span className="w-3.5 h-3.5 border-2 border-zinc-700 rounded-xs inline-block align-middle" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-[10px] text-zinc-500 italic py-1 px-2.5">
                No electrical items requested.
              </p>
            )}
          </div>
        )}
      </div>

      {/* NO FOOTER / SIGNATURES AREA - Clean sheet boundary */}
    </div>
  );
}

export default StallChecklistSheet;
