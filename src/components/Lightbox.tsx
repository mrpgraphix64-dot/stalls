import React, { useEffect, useState, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Maximize2, Minimize2, MapPin, Tag, MessageSquare, Download, Share2 } from 'lucide-react';
import { ProjectImage } from '../data/projectsData';

interface LightboxProps {
  images: ProjectImage[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (newIndex: number) => void;
  onDiscussStall: (image: ProjectImage) => void;
}

export const Lightbox: React.FC<LightboxProps> = ({
  images,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
  onDiscussStall,
}) => {
  const currentImage = images[currentIndex];
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && currentIndex < images.length - 1) onNavigate(currentIndex + 1);
      if (e.key === 'ArrowLeft' && currentIndex > 0) onNavigate(currentIndex - 1);
    },
    [isOpen, currentIndex, images.length, onClose, onNavigate]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [handleKeyDown, isOpen]);

  useEffect(() => {
    setIsLoaded(false);
    setIsZoomed(false);
  }, [currentIndex]);

  // Touch swipe support
  const minSwipeDistance = 50;
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe && currentIndex < images.length - 1) {
      onNavigate(currentIndex + 1);
    }
    if (isRightSwipe && currentIndex > 0) {
      onNavigate(currentIndex - 1);
    }
  };

  if (!isOpen || !currentImage) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between select-none animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="Image Lightbox"
    >
      {/* Top Header Controls */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-gradient-to-b from-black/80 to-transparent z-20">
        
        {/* Left: Counter & Title */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold tracking-wider">
            {currentIndex + 1} / {images.length}
          </div>
          <div className="hidden sm:block text-white text-xs text-gray-300 truncate max-w-sm">
            {currentImage.client || currentImage.title}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => onDiscussStall(currentImage)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-red hover:bg-brand-orange text-white text-xs font-bold uppercase tracking-wider transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Discuss This Stall</span>
            <span className="sm:hidden">Enquire</span>
          </button>

          <button
            onClick={() => setIsZoomed(!isZoomed)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            title={isZoomed ? "Reset zoom" : "Full zoom"}
            aria-label="Zoom image"
          >
            {isZoomed ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close Lightbox (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Center Area: Image & Nav Buttons */}
      <div
        className="relative flex-1 flex items-center justify-center p-2 sm:p-6 overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Previous Button */}
        {currentIndex > 0 && (
          <button
            onClick={() => onNavigate(currentIndex - 1)}
            className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/50 hover:bg-white/20 text-white backdrop-blur-sm transition-all"
            aria-label="Previous Image"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* High Resolution Protected Image */}
        <div 
          className={`relative max-w-full max-h-full flex items-center justify-center select-none transition-transform duration-300 ${isZoomed ? 'scale-125 cursor-zoom-out' : 'cursor-default'}`}
          onContextMenu={(e) => e.preventDefault()}
        >
          <img
            src={currentImage.fullUrl}
            alt={currentImage.caption || currentImage.title}
            onLoad={() => setIsLoaded(true)}
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            className={`max-h-[75vh] sm:max-h-[82vh] max-w-[95vw] sm:max-w-[88vw] object-contain rounded-lg transition-opacity duration-300 pointer-events-none select-none ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Invisible Anti-Download Shield */}
          <div 
            className="absolute inset-0 z-10 cursor-default" 
            onContextMenu={(e) => e.preventDefault()}
            onClick={() => setIsZoomed(!isZoomed)}
          />

          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-brand-red border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        {/* Next Button */}
        {currentIndex < images.length - 1 && (
          <button
            onClick={() => onNavigate(currentIndex + 1)}
            className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/50 hover:bg-white/20 text-white backdrop-blur-sm transition-all"
            aria-label="Next Image"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom Metadata Bar */}
      <div className="bg-gradient-to-t from-black via-black/80 to-transparent px-4 sm:px-8 py-4 z-20">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-brand-red text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                {currentImage.categoryLabel}
              </span>
              {currentImage.boothNumber && (
                <span className="text-xs text-gray-300 font-medium">{currentImage.boothNumber}</span>
              )}
              {currentImage.year && (
                <span className="text-xs text-gray-400 font-normal">• {currentImage.year}</span>
              )}
            </div>

            <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
              {currentImage.title}
            </h3>

            {currentImage.caption && (
              <p className="text-xs text-gray-300 font-light mt-0.5 max-w-2xl">
                {currentImage.caption}
              </p>
            )}
          </div>

          {currentImage.location && (
            <div className="flex items-center gap-1.5 text-xs text-gray-300 shrink-0">
              <MapPin className="w-3.5 h-3.5 text-brand-orange" />
              <span>{currentImage.location}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
