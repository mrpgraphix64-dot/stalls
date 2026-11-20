import React from 'react';
import { StallPrintData, StallType, BoothTask } from './types';

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
  if (task.status === 'not_applicable' || (task.status as string) === 'na') return 'N/A';
  if (task.is_completed || task.status === 'completed') return 'Done';
  return 'Pending';
}

export function StallChecklistSheet({ data, isBulk = false, isLast = false }: StallChecklistSheetProps) {
  const { booth, eventName, tasks, productionItems, furnitureItems, electricalItems, goodiesItems, views3D } = data;

  const designStatus = getSectionStatus(tasks, 'design');
  const printStatus = getSectionStatus(tasks, 'print');
  const prodStatus = getSectionStatus(tasks, 'production');
  const furnStatus = getSectionStatus(tasks, 'furniture');
  const elecStatus = getSectionStatus(tasks, 'electrical');

  const structureType = getStallTypeLabel(booth.booth_type);
  const printDateStr = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div
      className={`stall-print-sheet bg-white text-zinc-900 font-sans leading-tight text-[11px] p-6 max-w-[210mm] mx-auto ${
        isBulk && !isLast ? 'break-after-page page-break-after-always' : ''
      }`}
      style={{
        boxSizing: 'border-box',
        minHeight: '270mm',
      }}
    >
      {/* 1. TOP HEADER & BRANDING */}
      <div className="border-b-2 border-zinc-900 pb-2 mb-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] tracking-widest uppercase font-bold text-zinc-600">
              Reworkzone Exhibitions & Events
            </div>
            <h1 className="text-lg font-black tracking-tight text-zinc-950 uppercase mt-0.5">
              Stall Operations Checklist
            </h1>
          </div>
          <div className="text-right text-[10px] text-zinc-600">
            <div>Doc Ref: <span className="font-mono font-bold text-zinc-900">{booth.id ? booth.id.substring(0, 10) : 'RWZ-STALL'}</span></div>
            <div>Printed: <span className="font-medium text-zinc-900">{printDateStr}</span></div>
          </div>
        </div>

        {/* Stall Metadata Grid */}
        <div className="mt-2.5 pt-2 border-t border-zinc-300 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          <div>
            <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-semibold">Exhibition</span>
            <span className="font-bold text-zinc-950 text-xs block truncate" title={eventName}>
              {eventName || booth.event_name || 'Exhibition'}
            </span>
          </div>

          <div>
            <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-semibold">Stall / Booth #</span>
            <span className="font-mono font-black text-sm text-zinc-950">
              {booth.booth_number && booth.booth_number.toLowerCase() !== 'pending'
                ? booth.booth_number
                : 'Pending Allotment'}
            </span>
          </div>

          <div>
            <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-semibold">Stall Size</span>
            <span className="font-mono font-bold text-zinc-950 text-xs">
              {booth.stand_size || '3 × 3 m'}
            </span>
          </div>

          <div>
            <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-semibold">Structure Type</span>
            <span className="font-bold text-zinc-950 text-xs">
              {structureType}
            </span>
          </div>
        </div>

        <div className="mt-1.5 pt-1.5 border-t border-dashed border-zinc-200 flex flex-wrap items-center justify-between text-[11px]">
          <div>
            <span className="text-zinc-500 font-semibold mr-1.5">Client / Exhibitor:</span>
            <span className="font-bold text-zinc-950 text-xs">{booth.client_name}</span>
          </div>
          {booth.phone && (
            <div>
              <span className="text-zinc-500 font-semibold mr-1.5">Contact:</span>
              <span className="font-mono font-semibold text-zinc-900">{booth.phone}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. SIX CHECKLIST SECTIONS */}
      <div className="space-y-3">
        {/* SECTION 1: DESIGN */}
        <div className="border border-zinc-300 rounded p-2.5 break-inside-avoid page-break-inside-avoid">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-1.5 mb-1.5">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-zinc-800 rounded-sm inline-block shrink-0" />
              <h2 className="text-xs font-bold text-zinc-950 uppercase tracking-wide">
                1. Design Responsibility
              </h2>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-zinc-400 font-semibold uppercase">
              Digital: {designStatus}
            </span>
          </div>

          <div className="space-y-1 text-zinc-800">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-700">Responsibility Assignment:</span>
              <span className="font-bold text-zinc-950 px-2 py-0.5 rounded bg-zinc-100 border border-zinc-300">
                {booth.design_responsibility || 'Client Side'}
              </span>
            </div>

            {views3D && views3D.length > 0 && (
              <div className="pt-1">
                <span className="font-semibold text-zinc-700">3D Stall Views ({views3D.length}):</span>
                <ul className="list-disc list-inside pl-1 text-[10px] text-zinc-800 mt-0.5 space-y-0.5">
                  {views3D.map((v) => (
                    <li key={v.id}>
                      <span className="font-bold">{v.title}</span>
                      {v.notes && <span className="text-zinc-600"> — {v.notes}</span>}
                      {v.drive_url && <span className="text-zinc-500 text-[9px] font-mono"> [Reference Attached]</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: PRINT FILES & GOODIES */}
        <div className="border border-zinc-300 rounded p-2.5 break-inside-avoid page-break-inside-avoid">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-1.5 mb-1.5">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-zinc-800 rounded-sm inline-block shrink-0" />
              <h2 className="text-xs font-bold text-zinc-950 uppercase tracking-wide">
                2. Print Files & Promotional Goodies
              </h2>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-zinc-400 font-semibold uppercase">
              Digital: {printStatus}
            </span>
          </div>

          <div className="space-y-1.5 text-zinc-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <span className="font-semibold text-zinc-700">Print Files Readiness:</span>{' '}
                <span className="font-bold text-zinc-950">
                  {booth.print_file_status || 'Designs Pending'}
                </span>
                {booth.print_drive_url && (
                  <span className="text-[10px] text-zinc-600 block">
                    Google Drive Folder: <span className="font-mono font-medium">[Folder Attached]</span>
                  </span>
                )}
              </div>

              {booth.print_remark && (
                <div>
                  <span className="font-semibold text-zinc-700">Remark:</span>{' '}
                  <span className="italic text-zinc-900">{booth.print_remark}</span>
                </div>
              )}
            </div>

            {/* Promotional Goodies subsection */}
            {(goodiesItems.length > 0 || booth.goodies_drive_url || (booth.goodies_status && booth.goodies_status !== 'Awaiting Client Artwork')) && (
              <div className="mt-1.5 pt-1.5 border-t border-dashed border-zinc-300">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-zinc-900 text-[10px] uppercase tracking-wider">
                    Goodies & Client Supplied Printing
                  </span>
                  <span className="text-[9px] font-semibold text-zinc-700">
                    Artwork: {booth.goodies_status || 'Awaiting Client Artwork'}
                    {booth.goodies_drive_url && ' • [Drive Attached]'}
                  </span>
                </div>

                {booth.goodies_remark && (
                  <div className="text-[10px] text-zinc-700 italic mt-0.5">
                    Note: {booth.goodies_remark}
                  </div>
                )}

                {goodiesItems.length > 0 && (
                  <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {goodiesItems.map((item) => (
                      <div key={item.id} className="flex items-start gap-1.5 text-[10px] py-0.5">
                        <span className="w-3 h-3 border border-zinc-700 rounded-sm inline-block shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-zinc-950">{item.item_name}</span>
                          <span className="font-mono font-semibold ml-1.5">Qty: {item.quantity}</span>
                          {item.specification && (
                            <span className="text-zinc-600 block text-[9px]">{item.specification}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* SECTION 3: PRODUCTION */}
        <div className="border border-zinc-300 rounded p-2.5 break-inside-avoid page-break-inside-avoid">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-1.5 mb-1.5">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-zinc-800 rounded-sm inline-block shrink-0" />
              <h2 className="text-xs font-bold text-zinc-950 uppercase tracking-wide">
                3. Production Requirements
              </h2>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-zinc-400 font-semibold uppercase">
              Digital: {prodStatus}
            </span>
          </div>

          {/* Wall Configuration Line */}
          {booth.wall_configuration && (
            <div className="mb-2 pb-1.5 border-b border-zinc-200 text-[11px] flex items-center justify-between">
              <div>
                <span className="font-semibold text-zinc-700 mr-1.5">Wall Configuration:</span>
                <span className="font-bold text-zinc-950 px-2 py-0.5 rounded bg-zinc-100 border border-zinc-300">
                  {booth.wall_configuration}
                </span>
              </div>
            </div>
          )}

          {productionItems.length === 0 ? (
            <p className="text-[10px] text-zinc-500 italic">No custom production items assigned.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {productionItems.map((item) => (
                <div key={item.id} className="flex items-start gap-1.5 py-0.5 border-b border-zinc-100 last:border-none">
                  <span className="w-3 h-3 border border-zinc-700 rounded-sm inline-block shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-zinc-950">{item.item_name}</span>
                    <span className="font-mono font-semibold ml-1.5">Qty: {item.quantity}</span>
                    {item.specification && (
                      <span className="text-zinc-700 block text-[10px] font-medium">
                        {item.specification}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 4 & 5: FURNITURE & ELECTRICAL (Side-by-side in print) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 break-inside-avoid page-break-inside-avoid">
          {/* SECTION 4: FURNITURE */}
          <div className="border border-zinc-300 rounded p-2.5">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-1.5 mb-1.5">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-zinc-800 rounded-sm inline-block shrink-0" />
                <h2 className="text-xs font-bold text-zinc-950 uppercase tracking-wide">
                  4. Furniture
                </h2>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-zinc-400 font-semibold uppercase">
                {furnStatus}
              </span>
            </div>

            {furnitureItems.length === 0 ? (
              <p className="text-[10px] text-zinc-500 italic">No furniture items assigned.</p>
            ) : (
              <div className="space-y-1">
                {furnitureItems.map((item) => (
                  <div key={item.id} className="flex items-start gap-1.5 py-0.5 border-b border-zinc-100 last:border-none">
                    <span className="w-3 h-3 border border-zinc-700 rounded-sm inline-block shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-bold text-zinc-950">{item.item_name}</span>
                      <span className="font-mono font-semibold ml-1.5">Qty: {item.quantity}</span>
                      {item.specification && (
                        <span className="text-zinc-600 block text-[9px]">{item.specification}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 5: ELECTRICAL */}
          <div className="border border-zinc-300 rounded p-2.5">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-1.5 mb-1.5">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-zinc-800 rounded-sm inline-block shrink-0" />
                <h2 className="text-xs font-bold text-zinc-950 uppercase tracking-wide">
                  5. Electrical
                </h2>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-zinc-400 font-semibold uppercase">
                {elecStatus}
              </span>
            </div>

            {electricalItems.length === 0 ? (
              <p className="text-[10px] text-zinc-500 italic">No electrical items assigned.</p>
            ) : (
              <div className="space-y-1">
                {electricalItems.map((item) => (
                  <div key={item.id} className="flex items-start gap-1.5 py-0.5 border-b border-zinc-100 last:border-none">
                    <span className="w-3 h-3 border border-zinc-700 rounded-sm inline-block shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-bold text-zinc-950">{item.item_name}</span>
                      <span className="font-mono font-semibold ml-1.5">Qty: {item.quantity}</span>
                      {item.specification && (
                        <span className="text-zinc-600 block text-[9px]">{item.specification}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SITE HANDOVER & ACCEPTANCE SIGN-OFF */}
        <div className="border border-zinc-300 rounded p-2.5 break-inside-avoid page-break-inside-avoid">
          <div className="border-b border-zinc-200 pb-1 mb-1.5">
            <h2 className="text-[11px] font-bold text-zinc-950 uppercase tracking-wide">
              Site Handover & Acceptance Sign-off
            </h2>
          </div>

          <div className="space-y-2">
            {booth.notes && (
              <div className="text-[10px] text-zinc-800 bg-zinc-50 p-1.5 rounded border border-zinc-200">
                <span className="font-semibold text-zinc-700">Booth Notes:</span> {booth.notes}
              </div>
            )}

            {/* Paper Manual Verification & Client Sign-off Line */}
            <div className="pt-1 grid grid-cols-3 gap-2 text-[9px] text-zinc-700">
              <div>
                <span className="font-semibold block">Site Supervisor:</span>
                <div className="h-6 border-b border-zinc-400 mt-2" />
              </div>
              <div>
                <span className="font-semibold block">Handover Date & Time:</span>
                <div className="h-6 border-b border-zinc-400 mt-2" />
              </div>
              <div>
                <span className="font-semibold block">Client Acceptance Signature:</span>
                <div className="h-6 border-b border-zinc-400 mt-2" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
