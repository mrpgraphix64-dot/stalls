import React from 'react';
import { Layers, MapPin, ArrowRight, Eye, Calendar, Sparkles } from 'lucide-react';
import { ProjectGroup } from '../data/projectsData';

interface ProjectGroupsViewProps {
  groups: ProjectGroup[];
  onSelectProject: (projectId: string) => void;
}

export const ProjectGroupsView: React.FC<ProjectGroupsViewProps> = ({
  groups,
  onSelectProject,
}) => {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {groups.map((group) => {
          const viewCount = group.images.length;
          const lead = group.leadImage;

          return (
            <div
              key={group.projectId}
              className="bg-white rounded-2xl overflow-hidden border border-brand-subtle shadow-card hover:shadow-floating transition-all duration-300 flex flex-col group cursor-pointer"
              onClick={() => onSelectProject(group.projectId)}
            >
              {/* Cover Image Container */}
              <div 
                className="relative aspect-[16/10] overflow-hidden bg-gray-100 select-none"
                onContextMenu={(e) => e.preventDefault()}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#ECE9DF] via-[#F4F2EB] to-[#ECE9DF] animate-pulse" />
                <img
                  src={lead.thumbUrl}
                  alt={group.title}
                  loading="lazy"
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                  className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 pointer-events-none select-none"
                />
                <div className="absolute inset-0 z-10" onContextMenu={(e) => e.preventDefault()} />
                
                {/* Badges Overlay */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                  <span className="bg-brand-red text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md shadow-sm">
                    {group.categoryLabel}
                  </span>
                  
                  <span className="bg-black/70 backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-sm">
                    <Eye className="w-3.5 h-3.5 text-brand-orange" />
                    <span>{viewCount} {viewCount === 1 ? 'View' : 'Angles'}</span>
                  </span>
                </div>

                {/* Booth Indicator */}
                {group.boothNumber && (
                  <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-gray-200 text-xs font-medium px-2 py-0.5 rounded">
                    {group.boothNumber}
                  </div>
                )}
              </div>

              {/* Content Body */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                    <span className="font-semibold text-brand-dark">{group.event}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-brand-red" />
                      {group.location}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-brand-dark leading-snug group-hover:text-brand-red transition-colors mb-2">
                    {group.title}
                  </h3>

                  <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed mb-4">
                    {group.description}
                  </p>
                </div>

                {/* Bottom Action Footer */}
                <div className="pt-3 border-t border-brand-subtle/60 flex items-center justify-between">
                  {group.specs ? (
                    <span className="text-[11px] text-gray-500 font-medium truncate max-w-[200px]" title={group.specs}>
                      {group.specs}
                    </span>
                  ) : (
                    <span className="text-[11px] text-gray-400">Verified Project</span>
                  )}

                  <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-dark group-hover:text-brand-red transition-colors shrink-0">
                    <span>Explore</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
