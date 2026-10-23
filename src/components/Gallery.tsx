import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Maximize2, Layers, MapPin, Loader2, ArrowUp, CheckCircle2 } from 'lucide-react';
import { ProjectImage } from '../data/projectsData';

interface GalleryProps {
  images: ProjectImage[];
  onImageClick: (image: ProjectImage, index: number) => void;
  onProjectClick: (projectId: string) => void;
}

const ITEMS_PER_PAGE = 18;

// Hook to detect responsive column count without layout shifts
function useColumnCount() {
  const [columns, setColumns] = useState(() => {
    if (typeof window === 'undefined') return 4;
    const w = window.innerWidth;
    if (w < 640) return 1;
    if (w < 1024) return 2;
    if (w < 1280) return 3;
    return 4;
  });

  useEffect(() => {
    let timeoutId: number;
    const updateColumns = () => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        const w = window.innerWidth;
        let newCols = 4;
        if (w < 640) newCols = 1;
        else if (w < 1024) newCols = 2;
        else if (w < 1280) newCols = 3;
        setColumns(newCols);
      }, 80);
    };

    window.addEventListener('resize', updateColumns);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateColumns);
    };
  }, []);

  return columns;
}

// Individual Card with zero layout-shift aspect reservation & smooth image fade-in
const GalleryCard: React.FC<{
  img: ProjectImage;
  index: number;
  onImageClick: (image: ProjectImage, index: number) => void;
  onProjectClick: (projectId: string) => void;
}> = React.memo(({ img, index, onImageClick, onProjectClick }) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <div
      className="group relative rounded-2xl overflow-hidden bg-white border border-gray-200/80 transition-all duration-300 flex flex-col cursor-pointer shadow-sm hover:shadow-lg animate-smooth-in"
      onClick={() => onImageClick(img, index)}
    >
      {/* Image Container with explicit aspect ratio to prevent ANY layout shift */}
      <div 
        className="relative overflow-hidden bg-[#ECE9DF] select-none"
        style={{ aspectRatio: `${img.thumbWidth} / ${img.thumbHeight}` }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Warm shimmer placeholder while image decodes */}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-gradient-to-r from-[#ECE9DF] via-[#F4F2EB] to-[#ECE9DF] animate-pulse" />
        )}

        <img
          src={img.thumbUrl}
          alt={img.title}
          width={img.thumbWidth}
          height={img.thumbHeight}
          loading={index < 8 ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          onLoad={() => setImageLoaded(true)}
          onContextMenu={(e) => e.preventDefault()}
          className={`w-full h-full object-cover transform transition-all duration-700 ease-out group-hover:scale-105 pointer-events-none select-none ${
            imageLoaded ? 'opacity-100 filter-none' : 'opacity-0 scale-[0.98]'
          }`}
        />

        {/* Invisible Protective Shield preventing right-click or drag */}
        <div 
          className="absolute inset-0 z-10 cursor-pointer" 
          onContextMenu={(e) => e.preventDefault()}
        />

        {/* Subtle Hover Gradient Overlay */}
        <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-5 text-white pointer-events-none">
          
          {/* Top Bar on Hover */}
          <div className="absolute top-3.5 right-3.5 flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onImageClick(img, index);
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
      <div className="p-4 bg-white flex items-center justify-between text-sm border-t border-gray-100">
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
});

export const Gallery: React.FC<GalleryProps> = ({
  images,
  onImageClick,
  onProjectClick,
}) => {
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const columnCount = useColumnCount();

  // Reset pagination whenever dataset changes
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [images]);

  const displayedImages = images.slice(0, visibleCount);
  const hasMore = visibleCount < images.length;

  // Append next batch smoothly
  const loadMore = useCallback(() => {
    if (isLoadingMore || visibleCount >= images.length) return;
    setIsLoadingMore(true);

    // Smooth subtle delay to allow smooth network loading
    setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + 12, images.length));
      setIsLoadingMore(false);
    }, 200);
  }, [isLoadingMore, visibleCount, images.length]);

  // Infinite Scroll / Auto-Loading with 450px lookahead buffer
  useEffect(() => {
    const target = loaderRef.current;
    if (!target || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
          loadMore();
        }
      },
      { rootMargin: '450px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadMore]);

  // Distribute items into columns round-robin:
  // EXISTING ITEMS STAY IN THEIR EXACT COLUMN AND NEVER SHIFT!
  const columnsData = useMemo(() => {
    const cols: { item: ProjectImage; originalIndex: number }[][] = Array.from(
      { length: columnCount },
      () => []
    );
    displayedImages.forEach((img, idx) => {
      cols[idx % columnCount].push({ item: img, originalIndex: idx });
    });
    return cols;
  }, [displayedImages, columnCount]);

  if (images.length === 0) {
    return (
      <div className="py-24 text-center max-w-md mx-auto px-4">
        <h3 className="text-xl font-bold text-brand-dark mb-2">No exhibition stalls available</h3>
        <p className="text-base text-gray-600">
          Check back soon or contact us to discuss custom exhibition fabrication.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* 
        Column-based True Masonry:
        Each column is an independent vertical flex container.
        When new items are loaded, they append directly to the bottom.
        Previous images NEVER jump across columns!
      */}
      <div 
        className="grid gap-6 items-start"
        style={{
          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`
        }}
      >
        {columnsData.map((colItems, colIdx) => (
          <div key={`col-${colIdx}`} className="flex flex-col gap-6">
            {colItems.map(({ item, originalIndex }) => (
              <GalleryCard
                key={item.id}
                img={item}
                index={originalIndex}
                onImageClick={onImageClick}
                onProjectClick={onProjectClick}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Auto Loading Sentinel & Infinite Scroll Indicator */}
      {hasMore && (
        <div ref={loaderRef} className="pt-6 pb-12 flex flex-col items-center justify-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white border border-gray-200/90 shadow-sm text-xs font-bold uppercase tracking-wider text-brand-dark transition-all">
            <Loader2 className="w-4 h-4 text-brand-red animate-spin" />
            <span>Loading more stalls ({images.length - visibleCount} remaining)...</span>
          </div>

          {/* Smooth Progress Bar */}
          <div className="w-56 h-1.5 bg-gray-200/70 rounded-full mt-4 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-brand-orange to-brand-red transition-all duration-300 rounded-full"
              style={{ width: `${(visibleCount / images.length) * 100}%` }}
            />
          </div>

          <p className="text-xs text-gray-600 font-medium mt-2">
            Showing {displayedImages.length} of {images.length} verified project views
          </p>
        </div>
      )}

      {/* Completed State When All Projects Loaded */}
      {!hasMore && images.length > ITEMS_PER_PAGE && (
        <div className="py-12 flex flex-col items-center justify-center text-center border-t border-gray-200/80 mt-8 animate-smooth-in">
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 shadow-sm">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-brand-dark uppercase tracking-wider">
            All {images.length} Exhibition Stalls Loaded
          </h4>
          <p className="text-xs text-gray-600 mt-1 max-w-sm">
            You have explored the complete portfolio of custom exhibition stands, pavilions, and 3D concepts.
          </p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-gray-700 hover:text-brand-red px-5 py-2.5 rounded-xl bg-white border border-gray-200 hover:border-brand-red transition-all shadow-sm hover:shadow"
          >
            <ArrowUp className="w-3.5 h-3.5" />
            <span>Back to Top</span>
          </button>
        </div>
      )}
    </div>
  );
};
