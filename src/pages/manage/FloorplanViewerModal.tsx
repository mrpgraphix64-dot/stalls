import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  X,
  FileText,
  AlertCircle,
  Plus,
  Edit2,
  Check,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Modal } from './Modal';

interface FloorplanViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId?: string;
  eventName?: string;
  pdfUrl?: string | null;
  onUpdatePdfUrl?: (newUrl: string) => Promise<void>;
  highlightStall?: string;
}

const TECH_EXPO_OFFICIAL_R5_PDF = '/floorplans/OVERALL_VENUE_LAYOUT_IT_EXPO_R5.pdf';

export function FloorplanViewerModal({
  isOpen,
  onClose,
  eventId,
  eventName = 'Exhibition',
  pdfUrl,
  onUpdatePdfUrl,
  highlightStall,
}: FloorplanViewerModalProps) {
  const [currentUrl, setCurrentUrl] = useState<string>(pdfUrl || '');
  const [isEditingUrl, setIsEditingUrl] = useState<boolean>(!pdfUrl || !pdfUrl.trim());
  const [urlInput, setUrlInput] = useState<string>(pdfUrl || '');
  const [urlError, setUrlError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [iframeError, setIframeError] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const active = pdfUrl ? pdfUrl.trim() : '';
      setCurrentUrl(active);
      setUrlInput(active);
      setIsEditingUrl(!active);
      setUrlError('');
      setSaving(false);
      setIframeError(false);
    }
  }, [isOpen, pdfUrl]);

  if (!isOpen) return null;

  const validatePdfUrl = (url: string): string | null => {
    const trimmed = url.trim();
    if (!trimmed) {
      return 'Please enter a PDF URL or relative file path.';
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('/')) {
      return 'URL must start with http://, https://, or /';
    }
    // Must look like a PDF or document link
    if (!/\.pdf($|\?|#)/i.test(trimmed) && !/drive\.google\.com/i.test(trimmed)) {
      return 'Floor plan link must be a direct PDF file URL (ending in .pdf) or authorized document link.';
    }
    return null;
  };

  const handleSaveUrl = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setUrlError('');

    const error = validatePdfUrl(urlInput);
    if (error) {
      setUrlError(error);
      return;
    }

    const cleanedUrl = urlInput.trim();
    setSaving(true);
    try {
      if (onUpdatePdfUrl) {
        await onUpdatePdfUrl(cleanedUrl);
      }
      setCurrentUrl(cleanedUrl);
      setIsEditingUrl(false);
    } catch (err: any) {
      setUrlError(err.message || 'Failed to save floor plan URL.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAttachTechExpo = () => {
    setUrlInput(TECH_EXPO_OFFICIAL_R5_PDF);
    setUrlError('');
  };

  const isTechExpoEvent = eventName.toLowerCase().includes('tech expo') || eventName.toLowerCase().includes('it expo');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Exhibition Floor Plan"
      subtitle={`${eventName} • Original Vector Layout`}
      maxWidth="max-w-6xl w-[96vw]"
    >
      <div className="flex flex-col h-[78vh] sm:h-[82vh] -mx-4 sm:-mx-6 -mb-6 -mt-2">
        {/* Top Controls Toolbar */}
        <div className="px-4 py-2.5 bg-[#13151b] border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-zinc-200">{eventName}</span>
            {currentUrl && (
              <>
                <span className="text-zinc-600 hidden sm:inline">•</span>
                <span className="px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-300 font-mono text-[10px] border border-white/[0.06]">
                  Vector PDF
                </span>
              </>
            )}
            {highlightStall && (
              <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono font-bold text-[11px]">
                Target Stall: {highlightStall}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {currentUrl && !isEditingUrl && (
              <>
                <a
                  href={currentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1c1f2a] hover:bg-zinc-700/80 text-zinc-200 border border-white/[0.08] rounded-lg font-medium text-xs transition-colors cursor-pointer"
                >
                  <span>Open PDF in New Tab</span>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                </a>

                {onUpdatePdfUrl && (
                  <button
                    type="button"
                    onClick={() => setIsEditingUrl(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-400 hover:text-zinc-200 rounded-lg text-xs transition-colors cursor-pointer"
                    title="Change Floor Plan URL"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Change URL</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Modal Canvas: Empty State Form VS Interactive PDF Viewer */}
        <div className="flex-1 w-full bg-zinc-950 relative overflow-hidden flex flex-col">
          {(!currentUrl || isEditingUrl) ? (
            /* No Floor Plan Added Empty State & Attach Form */
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <FileText className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-zinc-100">
                  No floor plan added
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  No floor plan PDF has been configured for <strong className="text-zinc-200">{eventName}</strong>. Enter a direct PDF link to display the original vector layout for this exhibition.
                </p>
              </div>

              {urlError && (
                <div className="w-full p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-left flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{urlError}</span>
                </div>
              )}

              {/* PDF URL Input Form */}
              <form onSubmit={handleSaveUrl} className="w-full space-y-3 text-left">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    Floor Plan PDF URL (.pdf)
                  </label>
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value);
                      if (urlError) setUrlError('');
                    }}
                    placeholder="https://example.com/floorplan.pdf or /floorplans/..."
                    className="w-full bg-[#1c1f2a] border border-white/[0.08] focus:border-amber-500/80 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none transition-all font-mono"
                  />
                  <p className="text-[10px] text-zinc-500">
                    Must be a direct link to an official PDF document.
                  </p>
                </div>

                {isTechExpoEvent && (
                  <button
                    type="button"
                    onClick={handleQuickAttachTechExpo}
                    className="w-full p-2.5 rounded-xl bg-[#1c1f2a] hover:bg-zinc-800/80 border border-amber-500/30 text-amber-400 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Use Official Tech Expo Gujarat R5 Layout PDF</span>
                  </button>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  {currentUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setUrlInput(currentUrl);
                        setIsEditingUrl(false);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-transparent hover:bg-white/[0.05] text-zinc-400 hover:text-zinc-200 text-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-950/40 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving PDF...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save Floor Plan</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : !iframeError ? (
            /* Original Vector PDF Viewer in Iframe */
            <iframe
              src={`${currentUrl}#toolbar=1&navpanes=0&zoom=page-width`}
              title="Official Exhibition Floor Plan PDF"
              className="w-full h-full border-0 bg-zinc-950"
              onError={() => setIframeError(true)}
            />
          ) : (
            /* Fallback State */
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-amber-400" />
              <div className="text-sm font-semibold text-zinc-200">
                Embedded PDF preview blocked by browser policy
              </div>
              <p className="text-xs text-zinc-400 max-w-md">
                Your browser or mobile security settings prevented inline rendering of this PDF. You can view the original high-resolution vector PDF in a full window.
              </p>
              <a
                href={currentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs inline-flex items-center gap-2 shadow-lg"
              >
                <FileText className="w-4 h-4" />
                <span>Open Original High-Resolution PDF</span>
              </a>
            </div>
          )}

          {/* Mobile Helper Bar */}
          {currentUrl && !isEditingUrl && (
            <div className="sm:hidden px-3 py-1.5 bg-[#13151b] border-t border-white/[0.08] text-[10px] text-zinc-400 flex items-center justify-between">
              <span>Pinch-zoom or open full screen for details</span>
              <a
                href={currentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 font-semibold underline flex items-center gap-0.5"
              >
                <span>Full Screen</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
