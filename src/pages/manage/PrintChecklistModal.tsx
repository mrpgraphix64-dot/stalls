import React, { useEffect } from 'react';
import { X, Printer, FileText, CheckCircle2 } from 'lucide-react';
import { StallPrintData } from './types';
import { StallChecklistSheet } from './StallChecklistSheet';

interface PrintChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  stalls: StallPrintData[];
}

export function PrintChecklistModal({
  isOpen,
  onClose,
  title,
  subtitle,
  stalls,
}: PrintChecklistModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || stalls.length === 0) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Dynamic Print Stylesheet */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
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
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .page-break-after-always {
            page-break-after: always !important;
            break-after: page !important;
          }
        }
      `}</style>

      {/* Screen Modal Overlay (Hidden during Print) */}
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-sm flex flex-col no-print animate-in fade-in duration-150">
        {/* Top Control Bar */}
        <div className="sticky top-0 z-10 bg-[#121319] border-b border-white/[0.08] px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <span>{title}</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold">
                  {stalls.length} {stalls.length === 1 ? 'Stall' : 'Stalls'}
                </span>
              </h2>
              {subtitle && <p className="text-xs text-zinc-400">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.08] rounded-xl transition-colors cursor-pointer"
              title="Close Preview (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tip Bar */}
        <div className="bg-[#191c25] border-b border-white/[0.04] px-6 py-2 text-center text-xs text-zinc-400">
          <span>
            💡 <strong>Print Tip:</strong> In the browser print dialog, choose Destination <strong>Save as PDF</strong> or select your printer. Each stall prints on its own clean A4 page.
          </span>
        </div>

        {/* On-Screen A4 Preview Area */}
        <div className="flex-1 p-4 sm:p-8 overflow-y-auto space-y-8 flex flex-col items-center">
          {stalls.map((stall, idx) => (
            <div
              key={stall.booth.id || idx}
              className="w-full max-w-[210mm] bg-white rounded-lg shadow-2xl overflow-hidden border border-zinc-200"
            >
              <StallChecklistSheet
                data={stall}
                isBulk={stalls.length > 1}
                isLast={idx === stalls.length - 1}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Dedicated Print DOM Container (Visible ONLY during print via CSS) */}
      <div id="printable-checklists-root" className="hidden">
        {stalls.map((stall, idx) => (
          <StallChecklistSheet
            key={stall.booth.id || idx}
            data={stall}
            isBulk={stalls.length > 1}
            isLast={idx === stalls.length - 1}
          />
        ))}
      </div>
    </>
  );
}
