import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, ArrowLeft, Download, Loader2 } from 'lucide-react';
import { StallPrintData } from './types';
import { StallChecklistSheet, getStallTypeLabel } from './StallChecklistSheet';
import { isPendingOrEmpty } from './boothSort';
import { exportElementsToPdf, getExportFilename } from './pdfExport';

interface PrintChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  stalls: StallPrintData[];
  filterType?: string;
}

export function PrintChecklistModal({
  isOpen,
  onClose,
  title,
  subtitle,
  stalls,
  filterType = 'all',
}: PrintChecklistModalProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState('');
  const printBtnRef = useRef<HTMLButtonElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 1. Lock background scrolling & restore focus on mount/unmount
  useEffect(() => {
    if (!isOpen) return;

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const previousScrollY = window.scrollY || window.pageYOffset || 0;
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    // Lock page background scrolling
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Focus primary action button after portal attaches
    const timer = setTimeout(() => {
      printBtnRef.current?.focus();
    }, 50);

    // Track browser print state to prevent accidental dismissal during print dialog
    const handleBeforePrint = () => setIsPrinting(true);
    const handleAfterPrint = () => setIsPrinting(false);
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    // Keyboard handlers
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isPrinting) {
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
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);

      // Restore body and html scroll
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      window.scrollTo(0, previousScrollY);

      // Restore focus to original triggering button
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        try {
          previousActiveElement.focus();
        } catch (_) {}
      }
    };
  }, [isOpen, onClose, isPrinting]);

  if (!isOpen || stalls.length === 0 || typeof document === 'undefined') {
    return null;
  }

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (isDownloading) return;
    try {
      setIsDownloading(true);
      setDownloadProgress('1/1');
      const previewContainer = scrollContainerRef.current;
      const visibleSheets = previewContainer
        ? Array.from(previewContainer.querySelectorAll<HTMLElement>('.stall-print-sheet'))
        : [];
      const targetSheets =
        visibleSheets.length > 0
          ? visibleSheets
          : Array.from(document.querySelectorAll<HTMLElement>('.stall-print-sheet')).filter(
              (el) => el.offsetWidth > 0 && el.offsetHeight > 0
            );

      if (targetSheets.length === 0) {
        throw new Error('No visible stall checklist found to export.');
      }

      const evtName = stalls[0]?.eventName || singleBooth?.event_name || 'Exhibition';
      const filename = getExportFilename(
        evtName,
        filterType || 'all',
        isSingleStall ? singleBooth?.booth_number : undefined
      );

      await exportElementsToPdf(targetSheets, filename, (curr, total) => {
        setDownloadProgress(`${curr}/${total}`);
      });
    } catch (err: any) {
      alert(err.message || 'Failed to download PDF. Please use "Print / Save as PDF" instead.');
    } finally {
      setIsDownloading(false);
      setDownloadProgress('');
    }
  };

  const isSingleStall = stalls.length === 1;
  const singleBooth = isSingleStall ? stalls[0].booth : null;
  const stallNum = singleBooth?.booth_number;
  const companyName = singleBooth?.client_name || stalls[0].eventName || title;
  const eventName = stalls[0].eventName || singleBooth?.event_name;

  return createPortal(
    <>
      {/* Dynamic Print Stylesheet for exact A4 rendering */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
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
          #printable-checklists-root,
          #printable-checklists-root * {
            visibility: visible !important;
          }
          #printable-checklists-root {
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
          .stall-print-sheet {
            page-break-inside: auto !important;
            break-inside: auto !important;
            margin: 0 auto !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            box-shadow: none !important;
            border: none !important;
          }
          .break-inside-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .page-break-after-always {
            page-break-after: always !important;
            break-after: page !important;
          }
        }
      `}</style>

      {/* Screen Modal Overlay (Hidden during Print via .no-print) */}
      <div
        className="fixed inset-0 z-[99999] flex flex-col bg-[#0b0c10] text-zinc-100 no-print overflow-hidden"
        style={{ zIndex: 99999 }}
        role="dialog"
        aria-modal="true"
        aria-label="Print Checklist Preview"
      >
        {/* Single Redesigned Compact Header (Fixed/Sticky at top, non-scrolling) */}
        <header className="shrink-0 h-14 bg-[#121319] border-b border-white/[0.08] px-3 sm:px-6 flex items-center justify-between gap-2 shadow-lg z-20">
          {/* Left: Back/Close button + Stall Number + Company Name */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] transition-all cursor-pointer shrink-0"
              title="Close Preview (Esc)"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-4 h-4 text-zinc-400" />
              <span className="hidden sm:inline">Back</span>
            </button>

            {isSingleStall ? (
              <div className="flex items-center gap-2 min-w-0">
                {!isPendingOrEmpty(stallNum) ? (
                  <span className="font-mono text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded shrink-0">
                    #{stallNum}
                  </span>
                ) : (
                  <span className="font-mono text-[11px] text-zinc-400 bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded shrink-0">
                    Not Assigned
                  </span>
                )}
                <span
                  className="font-bold text-sm text-zinc-100 truncate max-w-[120px] xs:max-w-[180px] sm:max-w-[280px] md:max-w-md"
                  title={companyName}
                >
                  {companyName}
                </span>
                {singleBooth && (
                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-400 shrink-0">
                    <span>•</span>
                    <span className="text-zinc-300 font-medium">{getStallTypeLabel(singleBooth.booth_type)}</span>
                    {singleBooth.wall_configuration && (
                      <>
                        <span>•</span>
                        <span className="text-amber-400 font-medium">{singleBooth.wall_configuration}</span>
                      </>
                    )}
                  </div>
                )}
                {eventName && (
                  <span
                    className="hidden lg:inline text-xs text-zinc-500 truncate max-w-[200px]"
                    title={eventName}
                  >
                    • {eventName}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="font-bold text-sm text-zinc-100 truncate max-w-[140px] xs:max-w-[200px] sm:max-w-md"
                  title={title}
                >
                  {title}
                </span>
                <span className="font-mono text-[11px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full shrink-0">
                  {stalls.length} Stalls
                </span>
              </div>
            )}
          </div>

          {/* Right: Download PDF + Print / Save as PDF + Close Icon */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <button
              type="button"
              disabled={isDownloading}
              onClick={handleDownloadPDF}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white/[0.08] hover:bg-white/[0.14] text-zinc-100 hover:text-amber-300 border border-white/[0.1] font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer select-none disabled:opacity-50"
              title="Download combined PDF checklist directly"
              aria-label="Download combined PDF checklist"
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              ) : (
                <Download className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span className="hidden xs:inline">{isDownloading ? `Saving ${downloadProgress}...` : 'Download PDF'}</span>
              <span className="xs:hidden">{isDownloading ? downloadProgress : 'PDF'}</span>
            </button>

            <button
              ref={printBtnRef}
              type="button"
              onClick={handlePrint}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5 sm:gap-2 cursor-pointer select-none"
              title="Print or Save as PDF (Ctrl/Cmd + P)"
              aria-label="Print or Save as PDF"
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span className="hidden xs:inline">Print / Save as PDF</span>
              <span className="xs:hidden">Print</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.08] rounded-xl transition-colors cursor-pointer"
              title="Close (Esc)"
              aria-label="Close print preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Scrollable Preview Canvas (Single scroll container for preview content) */}
        <main
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 lg:p-8 overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="w-full max-w-[210mm] mx-auto space-y-6 sm:space-y-8 pb-12">
            {stalls.map((stall, idx) => (
              <div
                key={stall.booth.id || idx}
                className="w-full bg-white rounded-lg shadow-2xl overflow-hidden border border-zinc-300"
              >
                <StallChecklistSheet
                  data={stall}
                  isBulk={stalls.length > 1}
                  isLast={idx === stalls.length - 1}
                />
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* Dedicated Print DOM Container (Rendered to body, visible ONLY during @media print) */}
      <div id="printable-checklists-root" className="hidden" aria-hidden="true">
        {stalls.map((stall, idx) => (
          <StallChecklistSheet
            key={stall.booth.id || idx}
            data={stall}
            isBulk={stalls.length > 1}
            isLast={idx === stalls.length - 1}
          />
        ))}
      </div>
    </>,
    document.body
  );
}
