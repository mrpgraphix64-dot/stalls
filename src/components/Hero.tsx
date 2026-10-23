import React from 'react';
import { ArrowDown, ArrowUpRight } from 'lucide-react';

interface HeroProps {
  onExploreClick: () => void;
  onPlanClick: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onExploreClick, onPlanClick }) => {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-[#FAF9F5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Header Block */}
        <div className="max-w-4xl space-y-6 mb-12 lg:mb-16">
          <div className="text-sm font-bold text-brand-dark tracking-wide">
            Exhibition Stall Design & Turnkey Fabrication
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-brand-dark tracking-tight leading-[1.04] font-display">
            Spaces that make brands stand out.
          </h1>

          <p className="text-lg sm:text-xl text-gray-700 font-normal leading-relaxed max-w-2xl">
            Explore our exhibition stalls, custom-built brand environments, and projects brought to life through thoughtful design and precise execution.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={onExploreClick}
              className="inline-flex items-center gap-2 px-8 py-4 bg-brand-dark hover:bg-brand-red text-white text-sm font-bold tracking-wider uppercase rounded-xl transition-colors duration-200"
            >
              <span>Explore Our Work</span>
              <ArrowDown className="w-4 h-4" />
            </button>

            <button
              onClick={onPlanClick}
              className="inline-flex items-center gap-2 px-8 py-4 bg-white hover:bg-brand-surface text-brand-dark text-sm font-bold tracking-wider uppercase rounded-xl border border-brand-subtle transition-colors duration-200"
            >
              <span>Plan Your Exhibition</span>
              <ArrowUpRight className="w-4 h-4 text-brand-red" />
            </button>
          </div>
        </div>

        {/* Architectural Image Layout — Uneven Photographic Rhythm */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
          
          {/* Main Hero Exhibition Photograph */}
          <div 
            className="md:col-span-8 relative aspect-[16/10] rounded-2xl overflow-hidden bg-gray-200 select-none"
            onContextMenu={(e) => e.preventDefault()}
          >
            <img
              src="/images/optimized/DSC05907.webp"
              alt="AppAspect Technologies Corner Stall at Tech Expo"
              className="w-full h-full object-cover pointer-events-none select-none"
              loading="eager"
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
            />
            <div className="absolute inset-0 z-10" onContextMenu={(e) => e.preventDefault()} />
            <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-6 sm:p-8 text-white pointer-events-none">
              <div className="text-xs font-semibold text-brand-orange mb-1">
                Corner Exhibition Stand · Tech Expo
              </div>
              <div className="text-xl sm:text-2xl font-bold font-display">
                AppAspect Technologies
              </div>
              <div className="text-sm text-gray-200 font-light mt-1">
                Custom woodwork arch, illuminated brand fascias & executive consultation lounge
              </div>
            </div>
          </div>

          {/* Secondary Paired Architectural Render */}
          <div className="md:col-span-4 space-y-6">
            <div 
              className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-gray-200 select-none"
              onContextMenu={(e) => e.preventDefault()}
            >
              <img
                src="/images/optimized/radix_view_1.webp"
                alt="Radix 3D Spatial Visualization & Elevation Plan"
                className="w-full h-full object-cover pointer-events-none select-none"
                loading="eager"
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
              />
              <div className="absolute inset-0 z-10" onContextMenu={(e) => e.preventDefault()} />
              <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/75 via-transparent to-transparent flex flex-col justify-end p-5 text-white pointer-events-none">
                <div className="text-xs font-semibold text-brand-orange mb-1">
                  3D Spatial Visualization
                </div>
                <div className="text-base sm:text-lg font-bold font-display">
                  Radix Threat Defense
                </div>
                <div className="text-sm text-gray-200 font-light mt-0.5">
                  Full 3D elevation schematics & AV demo layout
                </div>
              </div>
            </div>

            {/* Architectural Statement Banner */}
            <div className="p-6 rounded-2xl bg-white border border-brand-subtle flex flex-col justify-between">
              <div className="text-2xl font-black text-brand-dark font-display">
                80+ Verified Projects
              </div>
              <div className="text-sm text-gray-700 mt-1">
                Photographed exhibition stalls, brand pavilions, and 3D concept elevations executed across India and the United Kingdom.
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
