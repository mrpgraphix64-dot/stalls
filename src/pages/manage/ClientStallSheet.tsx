import React from 'react';
import { BoothItem, BoothItemRecord, BoothLink } from './types';
import { isPendingOrEmpty } from './boothSort';
import {
  getStallTypeLabel,
  PrintableWallDiagram,
  getWallConfigDisplay,
  ChecklistQRCode,
} from './StallChecklistSheet';

export interface ClientStallSheetProps {
  booth: BoothItem;
  eventName: string;
  views3D?: BoothLink[];
  productionItems?: BoothItemRecord[];
  furnitureItems?: BoothItemRecord[];
  electricalItems?: BoothItemRecord[];
  goodiesItems?: BoothItemRecord[];
  // Review / Sharing customization:
  includedItemIds?: Set<string>;
  included3DLinkIds?: Set<string>;
  includePrintLink?: boolean;
  includeGoodiesLink?: boolean;
  clientNote?: string;
  documentDate?: string;
  isPrintPreview?: boolean;
}

export function ClientStallSheet({
  booth,
  eventName,
  views3D = [],
  productionItems = [],
  furnitureItems = [],
  electricalItems = [],
  goodiesItems = [],
  includedItemIds,
  included3DLinkIds,
  includePrintLink = false,
  includeGoodiesLink = false,
  clientNote = '',
  documentDate,
  isPrintPreview = false,
}: ClientStallSheetProps) {
  const isDiscussion = booth.booking_stage === 'discussion';
  const rawBoothNum = booth.booth_number;
  const hasAssignedBooth = rawBoothNum && !isPendingOrEmpty(rawBoothNum);
  const boothNumberDisplay = hasAssignedBooth ? `#${rawBoothNum}` : 'Proposed / In Discussion';

  const structureType = getStallTypeLabel(booth.booth_type);
  const wallConfigInfo = getWallConfigDisplay(booth.wall_configuration);

  const formattedDate =
    documentDate ||
    new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  // Filter 3D views based on review modal selection
  const active3DViews = views3D.filter((v) => {
    const hasUrl = Boolean(v.drive_url && v.drive_url.trim());
    const hasImg = Boolean(v.preview_image_url && v.preview_image_url.trim());
    if (!hasUrl && !hasImg) return false;
    if (included3DLinkIds) return included3DLinkIds.has(v.id);
    return true;
  });

  // Identify designated primary 3D view
  const primary3DView =
    active3DViews.find((v) => v.is_final === 1 && v.drive_url?.trim()) ||
    active3DViews.find((v) => v.drive_url?.trim()) ||
    active3DViews.find((v) => v.is_final === 1) ||
    active3DViews[0] ||
    null;

  const primary3DUrl = primary3DView?.drive_url?.trim() || '';
  const hasPrimary3DUrl = primary3DUrl.startsWith('http://') || primary3DUrl.startsWith('https://');
  const primaryPreviewImg =
    primary3DView?.preview_image_url?.trim() ||
    active3DViews.find((v) => v.preview_image_url?.trim())?.preview_image_url?.trim() ||
    null;

  // Filter items based on review modal selection
  const isItemIncluded = (item: BoothItemRecord) => {
    if (includedItemIds) return includedItemIds.has(item.id);
    return true;
  };

  const activeProdItems = productionItems.filter(isItemIncluded);
  const activeFurnItems = furnitureItems.filter(isItemIncluded);
  const activeElecItems = electricalItems.filter(isItemIncluded);
  const activeGoodiesItems = goodiesItems.filter(isItemIncluded);

  // Client-approved external links
  const printUrl = includePrintLink && booth.print_drive_url?.trim() ? booth.print_drive_url.trim() : '';
  const hasClientPrintUrl = printUrl.startsWith('http://') || printUrl.startsWith('https://');

  const goodiesUrl = includeGoodiesLink && booth.goodies_drive_url?.trim() ? booth.goodies_drive_url.trim() : '';
  const hasClientGoodiesUrl = goodiesUrl.startsWith('http://') || goodiesUrl.startsWith('https://');

  const hasAnyQRorMedia = hasClientPrintUrl || hasPrimary3DUrl || primaryPreviewImg;

  return (
    <div
      className={`client-stall-sheet bg-white text-zinc-950 font-sans leading-normal text-[11px] p-4 sm:p-5 w-full max-w-[210mm] mx-auto select-text ${
        isPrintPreview ? 'shadow-2xl ring-1 ring-zinc-300 rounded-sm' : ''
      }`}
      data-booth-number={hasAssignedBooth ? rawBoothNum : 'Proposed'}
      data-client-name={booth.client_name || 'Exhibitor'}
      style={{
        boxSizing: 'border-box',
      }}
    >
      {/* 1. COMPACT PROFESSIONAL HEADER */}
      <div className="border-b-2 border-zinc-900 pb-2 mb-2.5">
        {/* Top line: Exhibition Name & Logo */}
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/logo.png"
              alt="Reworkzone"
              className="h-6 w-auto object-contain shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
            <span className="text-[11px] font-black tracking-wider uppercase text-zinc-600 truncate">
              {eventName || 'Exhibition'}
            </span>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
            {isDiscussion ? 'Proposed Specification' : 'Client Specification Sheet'}
          </span>
        </div>

        {/* Primary Row: Company Name & Booth Number */}
        <div className="grid grid-cols-12 gap-2 items-stretch">
          <div className="col-span-8 bg-zinc-50 border border-zinc-300 rounded px-3 py-2 flex flex-col justify-center min-h-[46px]">
            <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-bold leading-none mb-1">
              Company / Exhibitor
            </span>
            <span className="text-sm sm:text-base font-black text-zinc-950 leading-tight break-words">
              {booth.client_name || 'Exhibitor'}
            </span>
          </div>

          <div className="col-span-4 bg-zinc-900 text-white border border-zinc-900 rounded px-3 py-2 flex flex-col justify-center items-center text-center min-h-[46px]">
            <span className="text-[8px] uppercase tracking-wider text-zinc-300 font-bold leading-none mb-1">
              Stall Number
            </span>
            <span className="font-mono font-black text-sm sm:text-base text-white leading-tight break-words">
              {boothNumberDisplay}
            </span>
          </div>
        </div>

        {/* Secondary Row: Stall Size, Stall Type, Wall Configuration */}
        <div className="grid grid-cols-12 gap-2 items-center mt-2 pt-1.5 border-t border-zinc-200 text-[11px]">
          <div className="col-span-3 min-w-0">
            <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-bold block leading-none mb-0.5">
              Size
            </span>
            <span className="font-mono font-bold text-zinc-900 text-[11.5px] leading-tight block">
              {booth.stand_size || '3 × 3 m'}
            </span>
          </div>

          <div className="col-span-3 min-w-0">
            <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-bold block leading-none mb-0.5">
              Structure Type
            </span>
            <span className="font-bold text-zinc-900 text-[11.5px] leading-tight block break-words">
              {structureType} Stall
            </span>
          </div>

          <div className="col-span-6 min-w-0 bg-amber-50/80 border border-amber-300/80 rounded px-2.5 py-1 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[8px] uppercase tracking-wider text-amber-900 font-bold block leading-none mb-0.5">
                Wall Configuration
              </span>
              <span className="font-bold text-zinc-950 text-[10.5px] leading-tight block truncate">
                {wallConfigInfo.label}
              </span>
            </div>
            {wallConfigInfo.hasDiagram && (
              <PrintableWallDiagram wallConfig={booth.wall_configuration} />
            )}
          </div>
        </div>
      </div>

      {/* 2. FOUR COMPACT CATEGORIES */}
      <div className="space-y-2.5">
        {/* SECTION 1: 3D DESIGN & CLIENT FILES */}
        <div className="border-b border-zinc-200 pb-2">
          <div className="break-inside-avoid flex items-center justify-between border-b border-zinc-300 pb-1 mb-1.5">
            <h2 className="text-xs font-black text-zinc-950 uppercase tracking-wide">
              1. 3D Design &amp; Approved Files
            </h2>
            <span className="text-[9px] text-zinc-500 font-medium">Design &amp; Artwork References</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-start justify-between">
            {/* Left Column: Design Info, Links, Goodies */}
            <div className="flex-1 min-w-0 space-y-1.5 text-[11px] text-zinc-800">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <div>
                  <span className="text-zinc-500 font-semibold">Responsibility: </span>
                  <span className="font-bold text-zinc-950">{booth.design_responsibility || 'Client Side'}</span>
                </div>

                <span className="text-zinc-300 hidden sm:inline">|</span>

                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-500 font-semibold">3D Design: </span>
                  {active3DViews.length > 0 ? (
                    <span className="inline-flex items-center gap-1.5 flex-wrap">
                      {active3DViews.map((v, idx) => {
                        const vUrl = (v.drive_url || '').trim();
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
                                className="client-pdf-link text-blue-600 hover:text-blue-800 underline font-bold text-[11px] transition-colors"
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
                  ) : (
                    <span className="text-zinc-400 italic text-[11px]">Not Provided</span>
                  )}
                </div>

                {hasClientPrintUrl && (
                  <>
                    <span className="text-zinc-300 hidden sm:inline">|</span>
                    <div>
                      <span className="text-zinc-500 font-semibold">Print Files: </span>
                      <a
                        href={printUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="client-pdf-link text-blue-600 hover:text-blue-800 underline font-bold text-[11px] transition-colors"
                        title="Open Shared Print Files in Google Drive"
                      >
                        Open Drive Folder
                      </a>
                    </div>
                  </>
                )}

                {hasClientGoodiesUrl && (
                  <>
                    <span className="text-zinc-300 hidden sm:inline">|</span>
                    <div>
                      <span className="text-zinc-500 font-semibold">Goodies Files: </span>
                      <a
                        href={goodiesUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="client-pdf-link text-blue-600 hover:text-blue-800 underline font-bold text-[11px] transition-colors"
                        title="Open Shared Goodies Artwork in Google Drive"
                      >
                        Open Artwork Folder
                      </a>
                    </div>
                  </>
                )}
              </div>

              {/* Promotional Goodies Requirements (Omitted if none selected) */}
              {activeGoodiesItems.length > 0 && (
                <div className="mt-1 pt-1 border-t border-zinc-200">
                  <div className="text-[9.5px] font-bold text-zinc-700 uppercase tracking-wider mb-0.5">
                    Promotional Goodies Requirements
                  </div>
                  <table className="table-fixed w-full text-left border-collapse text-[10px]">
                    <colgroup>
                      <col className="w-[50%]" />
                      <col className="w-[35%]" />
                      <col className="w-[15%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-zinc-300 text-zinc-600 font-bold uppercase text-[8.5px] tracking-wider">
                        <th className="py-0.5 px-2 text-left">Goodies Item</th>
                        <th className="py-0.5 px-2 text-left">Specification</th>
                        <th className="py-0.5 px-2 text-center">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {activeGoodiesItems.map((item) => (
                        <tr key={item.id} className="break-inside-avoid">
                          <td className="py-0.5 px-2 font-bold text-zinc-950 break-words">{item.item_name}</td>
                          <td className="py-0.5 px-2 text-zinc-700 break-words">{item.specification || '—'}</td>
                          <td className="py-0.5 px-2 text-center font-mono font-bold text-zinc-900">
                            {item.quantity} {item.unit && item.unit !== 'nos' ? item.unit : ''}
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
                {/* Print Files QR Code (when client print link is approved) */}
                {hasClientPrintUrl && (
                  <ChecklistQRCode url={printUrl} label="PRINT FILES" />
                )}

                {/* 3D View QR Code */}
                {hasPrimary3DUrl && (
                  <ChecklistQRCode url={primary3DUrl} label="3D VIEW" />
                )}

                {/* 3D Stall Design Preview Thumbnail */}
                {primaryPreviewImg && (
                  <div className="inline-flex flex-col items-center justify-between p-1 bg-white border border-zinc-300 rounded shadow-2xs shrink-0">
                    <a
                      href={hasPrimary3DUrl ? primary3DUrl : primaryPreviewImg}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="client-pdf-link block overflow-hidden"
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

        {/* SECTION 2: PRODUCTION & STRUCTURE REQUIREMENTS */}
        <div className="border-b border-zinc-200 pb-2">
          <div className="break-inside-avoid flex items-center justify-between border-b border-zinc-300 pb-1 mb-1.5">
            <h2 className="text-xs font-black text-zinc-950 uppercase tracking-wide">
              2. Production &amp; Structure Requirements
            </h2>
            <span className="text-[9px] text-zinc-500 font-medium">Fabrication Specifications</span>
          </div>

          <table className="table-fixed w-full text-left border-collapse text-[10.5px]">
            <colgroup>
              <col className="w-[50%]" />
              <col className="w-[35%]" />
              <col className="w-[15%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-zinc-300 text-zinc-600 font-bold uppercase text-[8.5px] tracking-wider">
                <th className="py-1 px-2 text-left">Requirement / Item</th>
                <th className="py-1 px-2 text-left">Specification / Scope</th>
                <th className="py-1 px-2 text-center">Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {/* Core Physical Stall Specs */}
              <tr className="break-inside-avoid">
                <td className="py-1 px-2 font-bold text-zinc-950">Structure Fabrication</td>
                <td className="py-1 px-2 text-zinc-700">
                  {structureType} Structure • {booth.stand_size || '3 × 3 m'}
                </td>
                <td className="py-1 px-2 text-center font-mono font-bold text-zinc-900">
                  1 Set
                </td>
              </tr>
              <tr className="break-inside-avoid">
                <td className="py-1 px-2 font-bold text-zinc-950">Wall Configuration</td>
                <td className="py-1 px-2 text-zinc-700">
                  {wallConfigInfo.label}
                </td>
                <td className="py-1 px-2 text-center font-mono font-bold text-zinc-900">
                  1 Stall
                </td>
              </tr>

              {/* Saved Production Items */}
              {activeProdItems.map((item) => (
                <tr key={item.id} className="break-inside-avoid">
                  <td className="py-1 px-2 font-bold text-zinc-950 break-words">{item.item_name}</td>
                  <td className="py-1 px-2 text-zinc-700 break-words">{item.specification || '—'}</td>
                  <td className="py-1 px-2 text-center font-mono font-bold text-zinc-900">
                    {item.quantity} {item.unit && item.unit !== 'nos' ? item.unit : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* SECTION 3: FURNITURE (Omitted if 0 items) */}
        {activeFurnItems.length > 0 && (
          <div className="border-b border-zinc-200 pb-2">
            <div className="break-inside-avoid flex items-center justify-between border-b border-zinc-300 pb-1 mb-1.5">
              <h2 className="text-xs font-black text-zinc-950 uppercase tracking-wide">
                3. Furniture Requirements
              </h2>
              <span className="text-[9px] text-zinc-500 font-medium">Ordered Furniture</span>
            </div>

            <table className="table-fixed w-full text-left border-collapse text-[10.5px]">
              <colgroup>
                <col className="w-[50%]" />
                <col className="w-[35%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-zinc-300 text-zinc-600 font-bold uppercase text-[8.5px] tracking-wider">
                  <th className="py-1 px-2 text-left">Furniture Item</th>
                  <th className="py-1 px-2 text-left">Specification</th>
                  <th className="py-1 px-2 text-center">Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {activeFurnItems.map((item) => (
                  <tr key={item.id} className="break-inside-avoid">
                    <td className="py-1 px-2 font-bold text-zinc-950 break-words">{item.item_name}</td>
                    <td className="py-1 px-2 text-zinc-700 break-words">{item.specification || 'Standard Exhibition Finish'}</td>
                    <td className="py-1 px-2 text-center font-mono font-bold text-zinc-900">
                      {item.quantity} {item.unit && item.unit !== 'nos' ? item.unit : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* SECTION 4: ELECTRICAL (Omitted if 0 items) */}
        {activeElecItems.length > 0 && (
          <div className="border-b border-zinc-200 pb-2">
            <div className="break-inside-avoid flex items-center justify-between border-b border-zinc-300 pb-1 mb-1.5">
              <h2 className="text-xs font-black text-zinc-950 uppercase tracking-wide">
                4. Electrical &amp; Power Requirements
              </h2>
              <span className="text-[9px] text-zinc-500 font-medium">Power &amp; Lighting Points</span>
            </div>

            <table className="table-fixed w-full text-left border-collapse text-[10.5px]">
              <colgroup>
                <col className="w-[50%]" />
                <col className="w-[35%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-zinc-300 text-zinc-600 font-bold uppercase text-[8.5px] tracking-wider">
                  <th className="py-1 px-2 text-left">Electrical Item</th>
                  <th className="py-1 px-2 text-left">Specification</th>
                  <th className="py-1 px-2 text-center">Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {activeElecItems.map((item) => (
                  <tr key={item.id} className="break-inside-avoid">
                    <td className="py-1 px-2 font-bold text-zinc-950 break-words">{item.item_name}</td>
                    <td className="py-1 px-2 text-zinc-700 break-words">{item.specification || 'Standard Electrical Connection'}</td>
                    <td className="py-1 px-2 text-center font-mono font-bold text-zinc-900">
                      {item.quantity} {item.unit && item.unit !== 'nos' ? item.unit : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. OPTIONAL CLIENT NOTE */}
      {clientNote && clientNote.trim() && (
        <div className="mt-2.5 p-2 bg-amber-50/80 border-l-2 border-amber-500 rounded-r text-[10.5px] text-zinc-800 break-inside-avoid">
          <div className="font-bold text-amber-900 mb-0.5 text-[9.5px] uppercase tracking-wide">
            Client Note:
          </div>
          <p className="whitespace-pre-line leading-relaxed text-[10.5px]">{clientNote.trim()}</p>
        </div>
      )}

      {/* 4. COMPACT PROFESSIONAL FOOTER */}
      <div className="mt-3 pt-2 border-t border-zinc-300 text-[9px] text-zinc-500 flex items-center justify-between break-inside-avoid">
        <span>Reworkzone • Exhibitions &amp; Turnkey Fabrication • info@reworkzone.in</span>
        <span>Date: {formattedDate}</span>
      </div>
    </div>
  );
}

export default ClientStallSheet;
