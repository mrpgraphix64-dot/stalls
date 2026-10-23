import React from 'react';
import { Search, Grid3X3, Layers, X } from 'lucide-react';
import { CATEGORIES } from '../data/projectsData';

interface FilterBarProps {
  activeCategory: string;
  onSelectCategory: (category: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: 'masonry' | 'projects';
  onViewModeChange: (mode: 'masonry' | 'projects') => void;
  totalFilteredCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  activeCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  totalFilteredCount,
}) => {
  return (
    <div className="sticky top-[68px] z-30 bg-[#FAF9F5]/95 backdrop-blur-md py-4 mb-8">
      <div className="max-w-7xl mx-auto space-y-4">
        
        {/* Top Row: Search and View Mode Switcher */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by client, booth, city, or keyword..."
              className="w-full pl-10 pr-9 py-2.5 bg-white text-sm text-brand-dark rounded-xl border border-brand-subtle focus:border-brand-dark focus:ring-1 focus:ring-brand-dark outline-none transition-all placeholder:text-gray-500"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-black"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Controls: Count & View Switcher */}
          <div className="flex items-center justify-between sm:justify-end gap-4">
            <div className="text-sm text-gray-700 font-medium">
              Showing <span className="font-bold text-brand-dark">{totalFilteredCount}</span> items
            </div>

            <div className="inline-flex items-center p-1 bg-white rounded-xl border border-brand-subtle">
              <button
                onClick={() => onViewModeChange('masonry')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'masonry'
                    ? 'bg-brand-dark text-white'
                    : 'text-gray-700 hover:text-black'
                }`}
                title="View individual photos in an editorial grid"
              >
                <Grid3X3 className="w-4 h-4" />
                <span>Gallery</span>
              </button>

              <button
                onClick={() => onViewModeChange('projects')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'projects'
                    ? 'bg-brand-dark text-white'
                    : 'text-gray-700 hover:text-black'
                }`}
                title="View grouped by client stall case study"
              >
                <Layers className="w-4 h-4" />
                <span>Case Studies</span>
              </button>
            </div>
          </div>

        </div>

        {/* Bottom Row: Wrapped Category Tabs (No side-scroll clipping) */}
        <div className="flex flex-wrap items-center gap-2.5 py-1">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  isActive
                    ? 'bg-brand-red text-white'
                    : 'bg-white text-gray-800 hover:bg-brand-surface border border-brand-subtle'
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    isActive ? 'bg-white/30 text-white' : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
};
