import React from 'react';
import { ExternalLink, Box, Sparkles, Layers, Armchair, Zap, Package, FileText } from 'lucide-react';
import { BoothItem, BoothItemRecord, BoothLink } from './types';
import { isPendingOrEmpty } from './boothSort';
import { getStallTypeLabel, PrintableWallDiagram, getWallConfigDisplay } from './StallChecklistSheet';
import { parseWallConfig } from './BoothWallIndicator';

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
  const boothNumberDisplay = hasAssignedBooth ? rawBoothNum : 'Proposed / In Discussion';

  const structureType = getStallTypeLabel(booth.booth_type);
  const wallConfigParsed = parseWallConfig(booth.wall_configuration);
  const wallConfigDisplay = getWallConfigDisplay(booth.wall_configuration);

  const formattedDate =
    documentDate ||
    new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const refNumber = `RWZ-${(eventName || 'EXPO').substring(0, 4).toUpperCase()}-${
    hasAssignedBooth ? rawBoothNum.replace(/[^a-zA-Z0-9]/g, '') : 'PROP'
  }`;

  // Filter 3D views based on review modal selection
  const active3DViews = views3D.filter((v) => {
    if (!v.drive_url || !v.drive_url.trim()) return false;
    if (included3DLinkIds) return included3DLinkIds.has(v.id);
    return true;
  });

  // Filter items based on review modal selection
  const isItemIncluded = (item: BoothItemRecord) => {
    if (includedItemIds) return includedItemIds.has(item.id);
    return true;
  };

  const activeProdItems = productionItems.filter(isItemIncluded);
  const activeFurnItems = furnitureItems.filter(isItemIncluded);
  const activeElecItems = electricalItems.filter(isItemIncluded);
  const activeGoodiesItems = goodiesItems.filter(isItemIncluded);

  // Check if carpet or flooring are already included in activeProdItems
  const hasCarpetItem = activeProdItems.some((it) => it.item_name.toLowerCase().includes('carpet'));
  const hasFlooringItem = activeProdItems.some(
    (it) => it.item_name.toLowerCase().includes('flooring') || it.item_name.toLowerCase().includes('platform')
  );

  return (
    <div
      className={`client-stall-sheet w-[794px] max-w-full bg-white text-zinc-900 mx-auto select-text font-sans antialiased text-left ${
        isPrintPreview ? 'p-8 sm:p-10 shadow-2xl ring-1 ring-zinc-300 rounded-sm' : 'p-8'
      }`}
      style={{
        boxSizing: 'border-box',
        minHeight: '1120px',
      }}
    >
      {/* 1. DOCUMENT HEADER */}
      <div className="border-b-2 border-zinc-900 pb-4 mb-5">
        <div className="flex items-start justify-between gap-4">
          {/* Brand Identity */}
          <div className="flex items-center gap-3.5">
            <img
              src="/logo.png"
              alt="Reworkzone"
              className="h-10 w-auto object-contain shrink-0"
              onError={(e) => {
                // Graceful fallback if /logo.png fails
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
            <div>
              <div className="text-sm font-black tracking-wider text-zinc-950 font-display">
                REWORKZONE
              </div>
              <div className="text-[9.5px] uppercase tracking-widest font-bold text-amber-600">
                Exhibitions &amp; Turnkey Fabrication
              </div>
            </div>
          </div>

          {/* Reference & Date */}
          <div className="text-right text-[11px] leading-tight text-zinc-600 shrink-0">
            <div>
              <span className="font-semibold text-zinc-500">Ref: </span>
              <span className="font-mono font-bold text-zinc-900">{refNumber}</span>
            </div>
            <div className="mt-1">
              <span className="font-semibold text-zinc-500">Date: </span>
              <span className="font-semibold text-zinc-800">{formattedDate}</span>
            </div>
          </div>
        </div>

        {/* Document Title Banner */}
        <div className="mt-4 pt-3 border-t border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-950 font-display uppercase">
              {isDiscussion ? (
                <span className="text-amber-800 flex items-center gap-2">
                  <span>Proposed Stall Details — Not Confirmed</span>
                </span>
              ) : (
                'Stall Details & Requirements'
              )}
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {isDiscussion
                ? 'Preliminary specification proposal for client review • Subject to final confirmation'
                : 'Turnkey exhibition stall fabrication scope, ordered items & design references'}
            </p>
          </div>

          {/* Event Badge */}
          <div className="text-right">
            <span className="inline-block px-3 py-1 rounded-full bg-zinc-100 border border-zinc-300 text-xs font-bold text-zinc-900 max-w-[280px] truncate">
              {eventName}
            </span>
          </div>
        </div>
      </div>

      {/* 2. EXHIBITOR & STALL METADATA OVERVIEW */}
      <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 sm:p-5 mb-5 break-inside-avoid">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 text-xs">
          {/* Left Column: Exhibitor Details */}
          <div className="space-y-2 border-b sm:border-b-0 sm:border-r border-zinc-200 pb-3 sm:pb-0 sm:pr-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">
                Company / Exhibitor
              </div>
              <div className="text-base font-black text-zinc-950 break-words mt-0.5">
                {booth.client_name}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">
                  Exhibition
                </span>
                <span className="font-semibold text-zinc-800 block truncate" title={eventName}>
                  {eventName}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">
                  Design Responsibility
                </span>
                <span className="font-bold text-zinc-900 inline-flex items-center px-2 py-0.5 rounded bg-zinc-200/80 text-[11px] mt-0.5">
                  {booth.design_responsibility || 'Client Side'}
                </span>
              </div>
            </div>

            {(booth.contact_person || booth.phone || booth.email) && (
              <div className="pt-1 text-[11px] text-zinc-600">
                <span className="font-semibold text-zinc-500">Contact: </span>
                <span>
                  {[booth.contact_person, booth.phone, booth.email].filter(Boolean).join(' • ')}
                </span>
              </div>
            )}
          </div>

          {/* Right Column: Physical Stall Specifications */}
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">
                  Stall Number
                </span>
                <div className="mt-0.5">
                  {hasAssignedBooth ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-900 font-mono font-black text-sm tracking-tight">
                      #{rawBoothNum}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-zinc-200 text-zinc-600 font-medium text-[11px]">
                      Not Assigned / Discussion
                    </span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">
                  Stall Size
                </span>
                <span className="font-bold text-zinc-900 text-sm block mt-1">
                  {booth.stand_size || '3 × 3 m (9 sqm)'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-200">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">
                  Structure Type
                </span>
                <span className="font-bold text-zinc-900 text-xs block mt-0.5">
                  {structureType} Stall
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">
                  Wall Configuration
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-bold text-zinc-900 text-xs truncate">
                    {wallConfigParsed.label}
                  </span>
                  {wallConfigDisplay.hasDiagram && (
                    <PrintableWallDiagram wallConfig={booth.wall_configuration} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 3D STALL DESIGN SECTION */}
      {active3DViews.length > 0 && (
        <div className="mb-5 p-4 rounded-xl border border-amber-300/80 bg-gradient-to-r from-amber-50/60 to-white break-inside-avoid">
          <div className="flex items-center justify-between border-b border-amber-200/80 pb-2 mb-2.5">
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 text-amber-600 shrink-0" />
              <h2 className="text-xs font-black uppercase tracking-wider text-zinc-950">
                3D Stall Design &amp; Spatial Walkthrough
              </h2>
            </div>
            <span className="text-[10px] text-zinc-500 font-medium">
              Clickable 3D Interactive Link
            </span>
          </div>

          <div className="space-y-2">
            {active3DViews.map((v, idx) => {
              const url = (v.drive_url || '').trim();
              const title = v.title?.trim() || `Interactive 3D View ${idx + 1}`;
              return (
                <div
                  key={v.id || idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-white border border-zinc-200 rounded-lg shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    {v.preview_image_url && (
                      <div className="w-14 h-10 rounded border border-zinc-200 bg-zinc-50 overflow-hidden shrink-0">
                        <img src={v.preview_image_url} alt={title} className="w-full h-full object-cover" crossOrigin="anonymous" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-zinc-900 truncate">{title}</div>
                      {v.notes && (
                        <div className="text-[10.5px] text-zinc-500 truncate">{v.notes}</div>
                      )}
                    </div>
                  </div>

                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="client-pdf-link inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-bold rounded-md shadow-xs transition-colors shrink-0"
                    title={`Open ${title}`}
                  >
                    <span>View 3D Design</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. REQUIREMENTS SECTIONS */}
      <div className="space-y-4">
        {/* A. PRODUCTION & STRUCTURE */}
        <div className="break-inside-avoid">
          <div className="flex items-center gap-2 border-b-2 border-zinc-900 pb-1 mb-2">
            <Layers className="w-4 h-4 text-amber-600 shrink-0" />
            <h2 className="text-xs font-black uppercase tracking-wider text-zinc-950">
              A. Production &amp; Structure Requirements
            </h2>
          </div>

          <table className="w-full text-left border-collapse text-xs table-fixed">
            <colgroup>
              <col className="w-[45%]" />
              <col className="w-[40%]" />
              <col className="w-[15%]" />
            </colgroup>
            <thead>
              <tr className="bg-zinc-100 border-b border-zinc-300 text-zinc-700 font-bold uppercase text-[9.5px] tracking-wider">
                <th className="py-1.5 px-2.5">Requirement / Item</th>
                <th className="py-1.5 px-2.5">Specification / Scope</th>
                <th className="py-1.5 px-2.5 text-center">Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-[11.5px]">
              {/* Core Physical Stall Specs */}
              <tr>
                <td className="py-1.5 px-2.5 font-bold text-zinc-950">Structure Fabrication</td>
                <td className="py-1.5 px-2.5 text-zinc-700">
                  {structureType} Structure • {booth.stand_size || '3 × 3 m'}
                </td>
                <td className="py-1.5 px-2.5 text-center font-mono font-bold text-zinc-900">
                  1 Set
                </td>
              </tr>
              <tr>
                <td className="py-1.5 px-2.5 font-bold text-zinc-950">Wall Configuration</td>
                <td className="py-1.5 px-2.5 text-zinc-700">
                  {wallConfigDisplay.label}
                </td>
                <td className="py-1.5 px-2.5 text-center font-mono font-bold text-zinc-900">
                  1 Stall
                </td>
              </tr>

              {/* Saved Production Items */}
              {activeProdItems.map((item) => (
                <tr key={item.id}>
                  <td className="py-1.5 px-2.5 font-bold text-zinc-950 break-words">
                    {item.item_name}
                  </td>
                  <td className="py-1.5 px-2.5 text-zinc-700 break-words">
                    {item.specification || '—'}
                  </td>
                  <td className="py-1.5 px-2.5 text-center font-mono font-bold text-zinc-900">
                    {item.quantity} {item.unit && item.unit !== 'nos' ? item.unit : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* B. FURNITURE */}
        {activeFurnItems.length > 0 && (
          <div className="break-inside-avoid">
            <div className="flex items-center gap-2 border-b-2 border-zinc-900 pb-1 mb-2">
              <Armchair className="w-4 h-4 text-amber-600 shrink-0" />
              <h2 className="text-xs font-black uppercase tracking-wider text-zinc-950">
                B. Furniture Requirements
              </h2>
            </div>

            <table className="w-full text-left border-collapse text-xs table-fixed">
              <colgroup>
                <col className="w-[45%]" />
                <col className="w-[40%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead>
                <tr className="bg-zinc-100 border-b border-zinc-300 text-zinc-700 font-bold uppercase text-[9.5px] tracking-wider">
                  <th className="py-1.5 px-2.5">Furniture Item</th>
                  <th className="py-1.5 px-2.5">Specification</th>
                  <th className="py-1.5 px-2.5 text-center">Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-[11.5px]">
                {activeFurnItems.map((item) => (
                  <tr key={item.id}>
                    <td className="py-1.5 px-2.5 font-bold text-zinc-950 break-words">
                      {item.item_name}
                    </td>
                    <td className="py-1.5 px-2.5 text-zinc-700 break-words">
                      {item.specification || 'Standard Exhibition Finish'}
                    </td>
                    <td className="py-1.5 px-2.5 text-center font-mono font-bold text-zinc-900">
                      {item.quantity} {item.unit && item.unit !== 'nos' ? item.unit : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* C. ELECTRICAL */}
        {activeElecItems.length > 0 && (
          <div className="break-inside-avoid">
            <div className="flex items-center gap-2 border-b-2 border-zinc-900 pb-1 mb-2">
              <Zap className="w-4 h-4 text-amber-600 shrink-0" />
              <h2 className="text-xs font-black uppercase tracking-wider text-zinc-950">
                C. Electrical &amp; Power Requirements
              </h2>
            </div>

            <table className="w-full text-left border-collapse text-xs table-fixed">
              <colgroup>
                <col className="w-[45%]" />
                <col className="w-[40%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead>
                <tr className="bg-zinc-100 border-b border-zinc-300 text-zinc-700 font-bold uppercase text-[9.5px] tracking-wider">
                  <th className="py-1.5 px-2.5">Electrical Item</th>
                  <th className="py-1.5 px-2.5">Specification</th>
                  <th className="py-1.5 px-2.5 text-center">Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-[11.5px]">
                {activeElecItems.map((item) => (
                  <tr key={item.id}>
                    <td className="py-1.5 px-2.5 font-bold text-zinc-950 break-words">
                      {item.item_name}
                    </td>
                    <td className="py-1.5 px-2.5 text-zinc-700 break-words">
                      {item.specification || 'Standard Electrical Connection'}
                    </td>
                    <td className="py-1.5 px-2.5 text-center font-mono font-bold text-zinc-900">
                      {item.quantity} {item.unit && item.unit !== 'nos' ? item.unit : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* D. PRINTING & PROMOTIONAL GOODIES */}
        {(activeGoodiesItems.length > 0 || (includePrintLink && booth.print_drive_url) || (includeGoodiesLink && booth.goodies_drive_url)) && (
          <div className="break-inside-avoid">
            <div className="flex items-center gap-2 border-b-2 border-zinc-900 pb-1 mb-2">
              <Package className="w-4 h-4 text-amber-600 shrink-0" />
              <h2 className="text-xs font-black uppercase tracking-wider text-zinc-950">
                D. Printing &amp; Promotional Items
              </h2>
            </div>

            {activeGoodiesItems.length > 0 && (
              <table className="w-full text-left border-collapse text-xs table-fixed mb-3">
                <colgroup>
                  <col className="w-[45%]" />
                  <col className="w-[40%]" />
                  <col className="w-[15%]" />
                </colgroup>
                <thead>
                  <tr className="bg-zinc-100 border-b border-zinc-300 text-zinc-700 font-bold uppercase text-[9.5px] tracking-wider">
                    <th className="py-1.5 px-2.5">Item Name</th>
                    <th className="py-1.5 px-2.5">Specification</th>
                    <th className="py-1.5 px-2.5 text-center">Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 text-[11.5px]">
                  {activeGoodiesItems.map((item) => (
                    <tr key={item.id}>
                      <td className="py-1.5 px-2.5 font-bold text-zinc-950 break-words">
                        {item.item_name}
                      </td>
                      <td className="py-1.5 px-2.5 text-zinc-700 break-words">
                        {item.specification || '—'}
                      </td>
                      <td className="py-1.5 px-2.5 text-center font-mono font-bold text-zinc-900">
                        {item.quantity} {item.unit && item.unit !== 'nos' ? item.unit : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Approved Shared Client Artwork / Print Links */}
            {(includePrintLink || includeGoodiesLink) && (
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg space-y-2 text-xs">
                {includePrintLink && booth.print_drive_url && (
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-zinc-700">
                      <span className="font-bold text-zinc-900">Shared Print Files Folder: </span>
                      <span className="text-[11px] text-zinc-500">Stall graphics &amp; artwork files</span>
                    </div>
                    <a
                      href={booth.print_drive_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="client-pdf-link inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-800 underline text-xs shrink-0"
                    >
                      <span>Open Shared Print Files</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {includeGoodiesLink && booth.goodies_drive_url && (
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-zinc-700">
                      <span className="font-bold text-zinc-900">Shared Goodies Artwork: </span>
                      <span className="text-[11px] text-zinc-500">Promotional collateral &amp; branding</span>
                    </div>
                    <a
                      href={booth.goodies_drive_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="client-pdf-link inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-800 underline text-xs shrink-0"
                    >
                      <span>Open Goodies Artwork</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. CLIENT-FACING NOTE (Optional) */}
      {clientNote && clientNote.trim() && (
        <div className="mt-5 p-3.5 bg-amber-50/70 border-l-4 border-amber-500 rounded-r-lg text-xs text-zinc-800 break-inside-avoid">
          <div className="font-bold text-amber-900 mb-0.5 text-xs">Important Client Note:</div>
          <p className="whitespace-pre-line leading-relaxed text-[11.5px]">{clientNote.trim()}</p>
        </div>
      )}

      {/* 6. DOCUMENT FOOTER */}
      <div className="mt-8 pt-4 border-t-2 border-zinc-900 text-xs text-zinc-500 break-inside-avoid flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="font-bold text-zinc-950">
            Prepared by Reworkzone • Exhibitions &amp; Turnkey Fabrication
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            Turnkey Stall Design, Modular Systems &amp; Custom Fabrication Worldwide • info@reworkzone.in
          </div>
        </div>

        <div className="text-left sm:text-right text-[10.5px] shrink-0 leading-tight">
          <div className="font-mono font-bold text-zinc-800">Ref: {refNumber}</div>
          <div className="text-zinc-400 mt-0.5">Prepared on {formattedDate}</div>
        </div>
      </div>
    </div>
  );
}
