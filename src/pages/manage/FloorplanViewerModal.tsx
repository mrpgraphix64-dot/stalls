import React, { useState } from 'react';
import { ExternalLink, ZoomIn, ZoomOut, RotateCcw, X, MapPin, Layers } from 'lucide-react';
import { Modal } from './Modal';
import { OFFICIAL_FLOORPLAN_PDF, OFFICIAL_FLOORPLAN_IMAGE } from './floorplanData';

interface FloorplanViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  highlightStall?: string;
}

export function FloorplanViewerModal({ isOpen, onClose, highlightStall }: FloorplanViewerModalProps) {
  const [zoom, setZoom] = useState<number>(1);

  if (!isOpen) return null;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.3, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.3, 0.7));
  const handleResetZoom = () => setZoom(1);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Official Exhibition Floor Plan" maxWidth="max-w-5xl">
      <div className="space-y-4">
        {/* Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-950/80 p-3 rounded-xl border border-zinc-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-200">Tech Expo Gujarat 2026</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400">Layout Revision: R5</span>
            {highlightStall && (
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 font-mono font-bold">
                Target Stall: {highlightStall}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-zinc-900 border border-zinc-700/80 rounded-lg p-0.5">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1.5 hover:bg-zinc-800 text-zinc-300 rounded transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono text-[11px] text-zinc-400">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1.5 hover:bg-zinc-800 text-zinc-300 rounded transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded transition-colors"
                title="Reset Zoom"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <a
              href={OFFICIAL_FLOORPLAN_PDF}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-lg font-bold text-xs transition-colors shadow-sm"
            >
              <span>Open Official PDF</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Legend Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-[11px]">
          <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 px-2.5 py-1.5 rounded-lg">
            <span className="w-3 h-3 rounded-sm bg-yellow-400 shrink-0" />
            <span className="text-zinc-300">3x3m (82)</span>
          </div>
          <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 px-2.5 py-1.5 rounded-lg">
            <span className="w-3 h-3 rounded-sm bg-zinc-100 border border-zinc-400 shrink-0" />
            <span className="text-zinc-300">3x3m 2-Side (54)</span>
          </div>
          <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 px-2.5 py-1.5 rounded-lg">
            <span className="w-3 h-3 rounded-sm bg-emerald-500 shrink-0" />
            <span className="text-zinc-300">6x3m (21)</span>
          </div>
          <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 px-2.5 py-1.5 rounded-lg">
            <span className="w-3 h-3 rounded-sm bg-fuchsia-500 shrink-0" />
            <span className="text-zinc-300">6x6m (12)</span>
          </div>
          <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 px-2.5 py-1.5 rounded-lg">
            <span className="w-3 h-3 rounded-sm bg-amber-700 shrink-0" />
            <span className="text-zinc-300">27 sq.m (4)</span>
          </div>
          <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 px-2.5 py-1.5 rounded-lg">
            <span className="w-3 h-3 rounded-sm bg-cyan-500 shrink-0" />
            <span className="text-zinc-300">Startup (49)</span>
          </div>
        </div>

        {/* Viewport for zoomable image */}
        <div className="w-full h-[60vh] max-h-[600px] bg-zinc-950 border border-zinc-800 rounded-xl overflow-auto p-4 flex items-center justify-center relative shadow-inner">
          <img
            src={OFFICIAL_FLOORPLAN_IMAGE}
            alt="Tech Expo Gujarat 2026 Overall Venue Layout"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
              transition: 'transform 0.15s ease-out',
            }}
            className="max-w-none rounded select-none pointer-events-auto"
          />
        </div>
      </div>
    </Modal>
  );
}
