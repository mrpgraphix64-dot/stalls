import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  Download,
  Loader2,
  Share2,
  CheckSquare,
  Square,
  Layers,
  Armchair,
  Zap,
  Package,
  Box,
  Link as LinkIcon,
  Eye,
  SlidersHorizontal,
  FileText,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { BoothItem, BoothItemRecord, BoothLink } from './types';
import { isPendingOrEmpty } from './boothSort';
import { ClientStallSheet } from './ClientStallSheet';
import { exportClientStallDetailsToPdf, getClientStallDetailsFilename } from './pdfExport';

export interface ShareStallModalProps {
  isOpen: boolean;
  onClose: () => void;
  booth: BoothItem;
  eventName: string;
  views3D?: BoothLink[];
  productionItems?: BoothItemRecord[];
  furnitureItems?: BoothItemRecord[];
  electricalItems?: BoothItemRecord[];
  goodiesItems?: BoothItemRecord[];
}

export function ShareStallModal({
  isOpen,
  onClose,
  booth,
  eventName,
  views3D = [],
  productionItems = [],
  furnitureItems = [],
  electricalItems = [],
  goodiesItems = [],
}: ShareStallModalProps) {
  // Mobile / Desktop view tab: 'preview' or 'customize'
  const [activeTab, setActiveTab] = useState<'preview' | 'customize'>('preview');

  // Included 3D Links (default: all checked)
  const [included3DLinkIds, setIncluded3DLinkIds] = useState<Set<string>>(() => {
    return new Set(views3D.filter((v) => v.drive_url && v.drive_url.trim()).map((v) => v.id));
  });

  // Included Items (default: all checked)
  const allInitialItemIds = useMemo(() => {
    const ids = new Set<string>();
    productionItems.forEach((i) => ids.add(i.id));
    furnitureItems.forEach((i) => ids.add(i.id));
    electricalItems.forEach((i) => ids.add(i.id));
    goodiesItems.forEach((i) => ids.add(i.id));
    return ids;
  }, [productionItems, furnitureItems, electricalItems, goodiesItems]);

  const [includedItemIds, setIncludedItemIds] = useState<Set<string>>(allInitialItemIds);

  // Private internal Drive links (default: UNCHECKED for safety!)
  const [includePrintLink, setIncludePrintLink] = useState<boolean>(false);
  const [includeGoodiesLink, setIncludeGoodiesLink] = useState<boolean>(false);

  // Optional client note
  const [clientNote, setClientNote] = useState<string>('');

  // Export / Print state
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<string>('');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const downloadBtnRef = useRef<HTMLButtonElement>(null);

  // Reset state when modal opens or booth changes
  useEffect(() => {
    if (isOpen) {
      setIncluded3DLinkIds(
        new Set(views3D.filter((v) => v.drive_url && v.drive_url.trim()).map((v) => v.id))
      );
      const ids = new Set<string>();
      productionItems.forEach((i) => ids.add(i.id));
      furnitureItems.forEach((i) => ids.add(i.id));
      electricalItems.forEach((i) => ids.add(i.id));
      goodiesItems.forEach((i) => ids.add(i.id));
      setIncludedItemIds(ids);
      setIncludePrintLink(false);
      setIncludeGoodiesLink(false);
      setClientNote('');
      setActiveTab('preview');
    }
  }, [isOpen, booth.id, views3D, productionItems, furnitureItems, electricalItems, goodiesItems]);

  // Lock body scroll & keyboard listeners
  useEffect(() => {
    if (!isOpen) return;

    const previousScrollY = window.scrollY || window.pageYOffset || 0;
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const handleBeforePrint = () => setIsPrinting(true);
    const handleAfterPrint = () => setIsPrinting(false);
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isPrinting && !isDownloading) {
          e.preventDefault();
          onClose();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      window.scrollTo(0, previousScrollY);
    };
  }, [isOpen, onClose, isPrinting, isDownloading]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  // Toggle helpers
  const toggle3DLink = (id: string) => {
    setIncluded3DLinkIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleItem = (id: string) => {
    setIncludedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCategory = (items: BoothItemRecord[]) => {
    const allIncluded = items.every((i) => includedItemIds.has(i.id));
    setIncludedItemIds((prev) => {
      const next = new Set(prev);
      items.forEach((i) => {
        if (allIncluded) next.delete(i.id);
        else next.add(i.id);
      });
      return next;
    });
  };

  const filename = getClientStallDetailsFilename(
    eventName || booth.event_name,
    booth.booth_number,
    booth.client_name
  );

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (isDownloading) return;
    try {
      setIsDownloading(true);
      setDownloadProgress('1/1');

      // Locate sheet in preview container
      const targetSheet = previewContainerRef.current?.querySelector<HTMLElement>('.client-stall-sheet');
      if (!targetSheet) {
        throw new Error('Unable to find preview sheet to export.');
      }

      await exportClientStallDetailsToPdf(targetSheet, filename, (curr, total) => {
        setDownloadProgress(`${curr}/${total}`);
      });
    } catch (err: any) {
      alert(err.message || 'Failed to generate Client PDF. You can also use "Print" to Save as PDF.');
    } finally {
      setIsDownloading(false);
      setDownloadProgress('');
    }
  };

  const totalSelectedItems = includedItemIds.size;
  const isDiscussion = booth.booking_stage === 'discussion';

  return createPortal(
    <>
      {/* Dynamic Print Stylesheet for exact A4 portrait rendering */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            width: 100% !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-client-stall-root,
          #printable-client-stall-root * {
            visibility: visible !important;
          }
          #printable-client-stall-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            display: block !important;
          }
          .no-print {
            display: none !important;
          }
          .client-stall-sheet {
            margin: 0 auto !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            box-shadow: none !important;
            border: none !important;
          }
          table {
            table-layout: fixed !important;
            width: 100% !important;
            border-collapse: collapse !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .break-inside-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Screen Modal Overlay */}
      <div
        className="fixed inset-0 z-[99999] flex flex-col bg-[#0b0c10] text-zinc-100 no-print overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Share Client Stall Details PDF"
      >
        {/* Top Navbar */}
        <div className="h-16 px-4 sm:px-6 bg-[#121319] border-b border-white/[0.08] flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <Share2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-bold text-zinc-100 truncate">
                  Share Stall Details — {booth.client_name}
                </h1>
                {isDiscussion ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25">
                    Proposed / Not Confirmed
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                    Confirmed
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 truncate mt-0.5">
                {eventName || booth.event_name} • Stall #{booth.booth_number || 'TBD'} • {filename}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Mobile Tab Switcher */}
            <div className="flex lg:hidden bg-zinc-800 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('customize')}
                className={`px-2.5 py-1.5 rounded-md font-semibold transition-colors ${
                  activeTab === 'customize' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400'
                }`}
              >
                Customize
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-2.5 py-1.5 rounded-md font-semibold transition-colors ${
                  activeTab === 'preview' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400'
                }`}
              >
                Preview
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 border border-white/[0.08] transition-all cursor-pointer"
              title="Print Clean A4 Client Sheet (Ctrl + P)"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>Print / Save PDF</span>
            </button>

            <button
              ref={downloadBtnRef}
              type="button"
              disabled={isDownloading}
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-sm shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-40"
              title="Download Client Stall Details PDF"
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{isDownloading ? (downloadProgress ? `Saving ${downloadProgress}` : 'Saving...') : 'Download PDF'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer ml-1"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Content: Split Pane (Controls on Left, Live A4 Preview on Right) */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT PANEL: Review & Customization Controls */}
          <div
            className={`w-full lg:w-[380px] xl:w-[420px] bg-[#121319] border-r border-white/[0.08] flex flex-col shrink-0 overflow-y-auto ${
              activeTab === 'preview' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <div className="p-4 sm:p-5 space-y-6">
              {/* Header Box */}
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                    <span>Review &amp; Share Scope</span>
                  </h2>
                  <span className="text-[11px] text-zinc-400">
                    {totalSelectedItems} items included
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Adjust requirements and links for this client document. Changes do not alter database records.
                </p>
              </div>

              {/* Discussion Warning */}
              {isDiscussion && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Ongoing Discussion Stall</span>
                  </div>
                  <p className="text-[11px] text-amber-300/80 leading-relaxed">
                    This document will be clearly marked as <strong>Proposed Stall Details — Not Confirmed</strong>.
                  </p>
                </div>
              )}

              {/* 3D Links Selection */}
              {views3D.length > 0 && (
                <div className="space-y-2.5 pt-2 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-200 uppercase tracking-wide">
                      <Box className="w-3.5 h-3.5 text-amber-400" />
                      <span>3D Stall Design Links</span>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400">
                      {included3DLinkIds.size} of {views3D.length}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {views3D.map((v) => {
                      const isChecked = included3DLinkIds.has(v.id);
                      return (
                        <label
                          key={v.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggle3DLink(v.id)}
                              className="rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                            />
                            <span className="text-xs font-medium text-zinc-300 truncate">
                              {v.title || 'Interactive 3D View'}
                            </span>
                          </div>
                          <a
                            href={v.drive_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-zinc-500 hover:text-amber-400 p-1"
                            title="Preview link"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Shared Client Drive Folders (Optional & Safe) */}
              <div className="space-y-2.5 pt-2 border-t border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-200 uppercase tracking-wide">
                  <LinkIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span>Client Artwork Folders</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-normal">
                  Internal Drive folders are hidden by default. Only check if client has view permissions.
                </p>

                <div className="space-y-2">
                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors ${
                      !booth.print_drive_url
                        ? 'opacity-40 border-white/[0.04] bg-white/[0.01] cursor-not-allowed'
                        : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={!booth.print_drive_url}
                      checked={includePrintLink}
                      onChange={(e) => setIncludePrintLink(e.target.checked)}
                      className="mt-0.5 rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-0 cursor-pointer"
                    />
                    <div className="text-xs min-w-0">
                      <div className="font-semibold text-zinc-200">Include Print Files Folder Link</div>
                      <div className="text-[11px] text-zinc-400 truncate">
                        {booth.print_drive_url || 'No Drive folder link saved'}
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors ${
                      !booth.goodies_drive_url
                        ? 'opacity-40 border-white/[0.04] bg-white/[0.01] cursor-not-allowed'
                        : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={!booth.goodies_drive_url}
                      checked={includeGoodiesLink}
                      onChange={(e) => setIncludeGoodiesLink(e.target.checked)}
                      className="mt-0.5 rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-0 cursor-pointer"
                    />
                    <div className="text-xs min-w-0">
                      <div className="font-semibold text-zinc-200">Include Goodies Artwork Link</div>
                      <div className="text-[11px] text-zinc-400 truncate">
                        {booth.goodies_drive_url || 'No Goodies folder link saved'}
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Requirement Items Scope (Production, Furniture, Electrical, Goodies) */}
              <div className="space-y-4 pt-2 border-t border-white/[0.06]">
                <div className="text-xs font-bold text-zinc-200 uppercase tracking-wide">
                  Ordered Requirement Items
                </div>

                {/* Production Items */}
                {productionItems.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-amber-400" />
                        <span>Production ({productionItems.length})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleCategory(productionItems)}
                        className="text-[11px] text-amber-400 hover:text-amber-300 cursor-pointer"
                      >
                        Toggle All
                      </button>
                    </div>
                    <div className="space-y-1">
                      {productionItems.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center justify-between p-2 rounded bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] text-xs cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <input
                              type="checkbox"
                              checked={includedItemIds.has(item.id)}
                              onChange={() => toggleItem(item.id)}
                              className="rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-0 cursor-pointer"
                            />
                            <span className="font-medium text-zinc-300 truncate">
                              {item.item_name}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-zinc-400 shrink-0">
                            ×{item.quantity}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Furniture Items */}
                {furnitureItems.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
                      <span className="flex items-center gap-1.5">
                        <Armchair className="w-3.5 h-3.5 text-amber-400" />
                        <span>Furniture ({furnitureItems.length})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleCategory(furnitureItems)}
                        className="text-[11px] text-amber-400 hover:text-amber-300 cursor-pointer"
                      >
                        Toggle All
                      </button>
                    </div>
                    <div className="space-y-1">
                      {furnitureItems.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center justify-between p-2 rounded bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] text-xs cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <input
                              type="checkbox"
                              checked={includedItemIds.has(item.id)}
                              onChange={() => toggleItem(item.id)}
                              className="rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-0 cursor-pointer"
                            />
                            <span className="font-medium text-zinc-300 truncate">
                              {item.item_name}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-zinc-400 shrink-0">
                            ×{item.quantity}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Electrical Items */}
                {electricalItems.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
                      <span className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>Electrical ({electricalItems.length})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleCategory(electricalItems)}
                        className="text-[11px] text-amber-400 hover:text-amber-300 cursor-pointer"
                      >
                        Toggle All
                      </button>
                    </div>
                    <div className="space-y-1">
                      {electricalItems.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center justify-between p-2 rounded bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] text-xs cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <input
                              type="checkbox"
                              checked={includedItemIds.has(item.id)}
                              onChange={() => toggleItem(item.id)}
                              className="rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-0 cursor-pointer"
                            />
                            <span className="font-medium text-zinc-300 truncate">
                              {item.item_name}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-zinc-400 shrink-0">
                            ×{item.quantity}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Goodies Items */}
                {goodiesItems.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
                      <span className="flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-amber-400" />
                        <span>Printing &amp; Goodies ({goodiesItems.length})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleCategory(goodiesItems)}
                        className="text-[11px] text-amber-400 hover:text-amber-300 cursor-pointer"
                      >
                        Toggle All
                      </button>
                    </div>
                    <div className="space-y-1">
                      {goodiesItems.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center justify-between p-2 rounded bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] text-xs cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <input
                              type="checkbox"
                              checked={includedItemIds.has(item.id)}
                              onChange={() => toggleItem(item.id)}
                              className="rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-0 cursor-pointer"
                            />
                            <span className="font-medium text-zinc-300 truncate">
                              {item.item_name}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-zinc-400 shrink-0">
                            ×{item.quantity}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Optional Client Note */}
              <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                <div className="text-xs font-bold text-zinc-200 uppercase tracking-wide flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>Optional Client Note</span>
                </div>
                <textarea
                  rows={3}
                  value={clientNote}
                  onChange={(e) => setClientNote(e.target.value)}
                  placeholder="e.g. Please confirm carpet color and TV position by Tuesday afternoon..."
                  className="w-full bg-[#161820] border border-white/[0.08] rounded-xl p-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/80 resize-none"
                />
                <p className="text-[10px] text-zinc-500">
                  This note will be printed in a special callout box on the PDF.
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT CANVAS: Live A4 PDF Preview */}
          <div
            ref={previewContainerRef}
            className={`flex-1 bg-zinc-950/95 overflow-y-auto p-4 sm:p-8 flex justify-center items-start ${
              activeTab === 'customize' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <div className="w-full max-w-[794px] my-auto">
              {/* Paper Preview Wrapper */}
              <ClientStallSheet
                booth={booth}
                eventName={eventName}
                views3D={views3D}
                productionItems={productionItems}
                furnitureItems={furnitureItems}
                electricalItems={electricalItems}
                goodiesItems={goodiesItems}
                includedItemIds={includedItemIds}
                included3DLinkIds={included3DLinkIds}
                includePrintLink={includePrintLink}
                includeGoodiesLink={includeGoodiesLink}
                clientNote={clientNote}
                isPrintPreview={true}
              />
            </div>
          </div>
        </div>
      </div>

      {/* DEDICATED PRINT DOM CONTAINER (Visible ONLY during window.print()) */}
      <div id="printable-client-stall-root" className="hidden">
        <ClientStallSheet
          booth={booth}
          eventName={eventName}
          views3D={views3D}
          productionItems={productionItems}
          furnitureItems={furnitureItems}
          electricalItems={electricalItems}
          goodiesItems={goodiesItems}
          includedItemIds={includedItemIds}
          included3DLinkIds={included3DLinkIds}
          includePrintLink={includePrintLink}
          includeGoodiesLink={includeGoodiesLink}
          clientNote={clientNote}
          isPrintPreview={false}
        />
      </div>
    </>,
    document.body
  );
}
