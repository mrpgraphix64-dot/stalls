import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Maximize2, Layers, MapPin, Loader2, ArrowUp, CheckCircle2 } from 'lucide-react';
import { ProjectImage } from '../data/projectsData';

interface GalleryProps {
  images: ProjectImage[];
  onImageClick: (image: ProjectImage, index: number) => void;
  onProjectClick: (projectId: string) => void;
}

const ITEMS_PER_PAGE = 18;

export const Gallery: React.FC<GalleryProps> = ({
  images,
  onImageClick,
  onProjectClick,
}) => {
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  // Reset pagination whenever filtered dataset changes
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [images]);

  const displayedImages = images.slice(0, visibleCount);
  const hasMore = visibleCount < images.length;

  const loadMore = useCallback(() => {
    if (isLoadingMore || visibleCount >= images.length) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + 12, images.length));
      setIsLoadingMore(false);
    }, 280);
  }, [isLoadingMore, visibleCount, images.length]);

  // Infinite Scroll / Auto-Loading Intersection Observer
  useEffect(() => {
    const target = loaderRef.current;
    if (!target || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
          loadMore();
        }
      },
      { rootMargin: '350px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadMore]);

  if (images.length === 0) {
    return (
      <div className="py-24 text-center max-w-md mx-auto px-4">
        <h3 className="text-xl font-bold text-brand-dark mb-2">No matching exhibition stalls</h3>
        <p className="text-base text-gray-600">
          Try clearing your search keyword or switching categories to see more projects.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Editorial Masonry Grid */}
      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
        {displayedImages.map((img, idx) => {
          return (
            <div
              key={img.id}
              className="break-inside-avoid group relative rounded-2xl overflow-hidden bg-white border border-brand-subtle transition-all duration-300 flex flex-col cursor-pointer shadow-sm hover:shadow-md animate-fade-in"
              onClick={() => onImageClick(img, idx)}
            >
              {/* Image Container with native aspect preservation */}
              <div 
                className="relative overflow-hidden bg-gray-100 select-none"
                onContextMenu={(e) => e.preventDefault()}
              >
                <img
                  src={img.thumbUrl}
                  alt={img.title}
                  width={img.thumbWidth}
                  height={img.thumbHeight}
                  loading={idx < 6 ? 'eager' : 'lazy'}
                  decoding="async"
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                  className="w-full h-auto object-cover transform transition-transform duration-500 ease-out group-hover:scale-105 pointer-events-none select-none"
                />

                {/* Invisible Protective Shield preventing right-click or drag */}
                <div 
                  className="absolute inset-0 z-10 cursor-pointer" 
                  onContextMenu={(e) => e.preventDefault()}
                />

                {/* Subtle Hover Gradient Overlay */}
                <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/85 via-black/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-5 text-white pointer-events-none">
                  
                  {/* Top Bar on Hover */}
                  <div className="absolute top-3.5 right-3.5 flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onImageClick(img, idx);
                      }}
                      className="p-2.5 rounded-xl bg-black/70 hover:bg-brand-red text-white transition-colors"
                      title="Open in fullscreen lightbox"
                      aria-label="Enlarge image"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Bottom Text Content */}
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="bg-brand-red text-white text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded">
                        {img.categoryLabel}
                      </span>
                      {img.boothNumber && (
                        <span className="text-xs text-gray-200 font-medium">
                          {img.boothNumber}
                        </span>
                      )}
                    </div>

                    <h4 className="text-base font-bold text-white leading-snug">
                      {img.client || img.title}
                    </h4>

                    {img.location && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-300 font-light mt-1">
                        <MapPin className="w-3.5 h-3.5 text-brand-orange" />
                        <span>{img.location}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Meta Bar Below Image for Clear Editorial Browsing */}
              <div className="p-4 bg-white flex items-center justify-between text-sm">
                <div className="truncate pr-2">
                  <div className="font-bold text-brand-dark truncate text-sm">{img.client}</div>
                  <div className="text-xs text-gray-600 truncate mt-0.5">{img.event}</div>
                </div>

                {/* Case study button if part of a recognized project */}
                {img.projectId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onProjectClick(img.projectId);
                    }}
                    className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold text-gray-700 hover:text-brand-red py-1.5 px-3 rounded-lg bg-[#FAF9F5] hover:bg-brand-surface transition-colors"
                    title="View all photos and specifications for this project"
                  >
                    <Layers className="w-3.5 h-3.5 text-brand-red" />
                    <span>Case Study</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Auto Loading Sentinel & Infinite Scroll Indicator */}
      {hasMore && (
        <div ref={loaderRef} className="pt-6 pb-12 flex flex-col items-center justify-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white border border-gray-200 shadow-sm text-xs font-bold uppercase tracking-wider text-brand-dark">
            <Loader2 className="w-4 h-4 text-brand-red animate-spin" />
            <span>Loading more stalls automatically ({images.length - visibleCount} remaining)</span>
          </div>

          {/* Smooth Progress Bar */}
          <div className="w-56 h-1.5 bg-gray-100 rounded-full mt-4 overflow-hidden shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-brand-orange to-brand-red transition-all duration-300 rounded-full"
              style={{ width: `${(visibleCount / images.length) * 100}%` }}
            />
          </div>

          <p className="text-xs text-gray-700 font-medium mt-2">
            Showing {displayedImages.length} of {images.length} verified project views
          </p>
        </div>
      )}

      {/* Completed State When All Projects Loaded */}
      {!hasMore && images.length > ITEMS_PER_PAGE && (
        <div className="py-12 flex flex-col items-center justify-center text-center border-t border-gray-200 mt-6">
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-brand-dark uppercase tracking-wider">
            All {images.length} Exhibition Stalls Loaded
          </h4>
          <p className="text-xs text-gray-700 mt-1 max-w-sm">
            You have explored the complete portfolio of custom exhibition stands, pavilions, and 3D concepts.
          </p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-gray-700 hover:text-brand-red px-5 py-2.5 rounded-xl bg-white border border-gray-200 hover:border-brand-red transition-all shadow-sm"
          >
            <ArrowUp className="w-3.5 h-3.5" />
            <span>Back to Top</span>
          </button>
        </div>
      )}
    </div>
  );
};
