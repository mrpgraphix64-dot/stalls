import React, { useEffect } from 'react';
import { X, MapPin, Calendar, Layers, CheckCircle2, MessageSquare, ArrowRight } from 'lucide-react';
import { ProjectGroup, ProjectImage } from '../data/projectsData';

interface ProjectModalProps {
  project: ProjectGroup | null;
  isOpen: boolean;
  onClose: () => void;
  onImageSelect: (image: ProjectImage) => void;
  onDiscussStall: (projectName: string) => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  project,
  isOpen,
  onClose,
  onImageSelect,
  onDiscussStall,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !project) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative bg-white rounded-3xl max-w-5xl w-full overflow-hidden shadow-2xl border border-brand-subtle my-8 animate-fadeIn">
        
        {/* Modal Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-black/60 hover:bg-black text-white backdrop-blur-sm transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Lead Hero Photo with Project Header */}
        <div 
          className="relative aspect-[16/9] sm:aspect-[21/9] bg-gray-900 overflow-hidden select-none"
          onContextMenu={(e) => e.preventDefault()}
        >
          <img
            src={project.leadImage.fullUrl}
            alt={project.title}
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            className="w-full h-full object-cover pointer-events-none select-none"
          />
          <div className="absolute inset-0 z-10" onContextMenu={(e) => e.preventDefault()} />
          <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none"></div>

          {/* Header Overlay Text */}
          <div className="absolute bottom-6 left-6 right-6 text-white">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="bg-brand-red text-white text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded">
                {project.categoryLabel}
              </span>
              {project.designType && (
                <span className="bg-white/20 text-white text-xs font-semibold px-2 py-0.5 rounded backdrop-blur-sm">
                  {project.designType}
                </span>
              )}
              {project.boothNumber && (
                <span className="bg-white/20 text-white text-xs font-semibold px-2 py-0.5 rounded backdrop-blur-sm">
                  {project.boothNumber}
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight font-display">
              {project.title}
            </h2>

            <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-gray-300 mt-2 font-medium">
              <span className="text-white font-semibold">{project.event}</span>
              {project.location && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-brand-orange" />
                    {project.location}
                  </span>
                </>
              )}
              {project.year && (
                <>
                  <span>•</span>
                  <span>{project.year}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-8">
          
          {/* Overview & Technical Specs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6 border-b border-brand-subtle">
            <div className="md:col-span-2 space-y-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                Project Overview & Execution
              </h3>
              <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                {project.description}
              </p>
            </div>

            <div className="bg-brand-surface/70 rounded-2xl p-5 border border-brand-subtle/80 space-y-3">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-brand-red" />
                <span>Fabrication Specs</span>
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                {project.specs || 'Custom carpentry, precision lighting, and complete turnkey on-site assembly.'}
              </p>
              <div className="pt-2">
                <button
                  onClick={() => {
                    onClose();
                    onDiscussStall(project.title);
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-brand-red hover:bg-brand-dark text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Discuss A Similar Stall</span>
                </button>
              </div>
            </div>
          </div>

          {/* Spec sheet: inclusions, materials, add-ons */}
          {project.inclusions && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6 border-b border-brand-subtle">
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">What's included</h3>
                <ul className="space-y-1.5 text-sm text-gray-700">
                  {project.inclusions.map((i) => (
                    <li key={i} className="flex gap-2"><span className="text-brand-red">✓</span>{i}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Materials</h3>
                <div className="flex flex-wrap gap-2">
                  {(project.materials || []).map((m) => (
                    <span key={m} className="text-xs px-2.5 py-1 rounded-lg bg-brand-surface text-gray-700">{m}</span>
                  ))}
                </div>
                {project.buildTime && (
                  <p className="text-xs text-gray-600 pt-2"><span className="font-bold">Build time:</span> {project.buildTime}</p>
                )}
              </div>
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Optional add-ons</h3>
                <div className="flex flex-wrap gap-2">
                  {(project.addons || []).map((a) => (
                    <span key={a} className="text-xs px-2.5 py-1 rounded-lg border border-brand-subtle text-gray-700">{a}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Multi-angle Views Gallery */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-brand-dark uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-red" />
                <span>All Angles & Visual Views ({project.images.length})</span>
              </h3>
              <span className="text-xs text-gray-400">Click any image to enlarge</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {project.images.map((img, idx) => (
                <div
                  key={img.id}
                  onClick={() => onImageSelect(img)}
                  onContextMenu={(e) => e.preventDefault()}
                  className="group relative rounded-xl overflow-hidden aspect-[4/3] bg-gray-100 cursor-pointer border border-brand-subtle hover:border-brand-dark transition-all select-none"
                >
                  <img
                    src={img.thumbUrl}
                    alt={img.caption || img.title}
                    draggable={false}
                    onContextMenu={(e) => e.preventDefault()}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 pointer-events-none select-none"
                  />
                  <div className="absolute inset-0 z-10" onContextMenu={(e) => e.preventDefault()} />
                  <div className="absolute inset-0 z-20 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold pointer-events-none">
                    View #{idx + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Modal Footer CTA */}
          <div className="bg-[#FAF9F5] rounded-2xl p-6 border border-brand-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="font-bold text-brand-dark text-sm sm:text-base">
                Ready to showcase your brand with a stall like this?
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Turnkey design, 3D visualization, fabrication, and on-site delivery in India and the UK.
              </p>
            </div>
            <button
              onClick={() => {
                onClose();
                onDiscussStall(project.title);
              }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand-dark hover:bg-brand-red text-white text-xs sm:text-sm font-bold uppercase tracking-wider rounded-xl transition-all shadow-md shrink-0"
            >
              <span>Request Quote For This Concept</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
