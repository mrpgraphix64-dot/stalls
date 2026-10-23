import React, { useState, useMemo } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { FilterBar } from './components/FilterBar';
import { Gallery } from './components/Gallery';
import { ProjectGroupsView } from './components/ProjectGroupsView';
import { Lightbox } from './components/Lightbox';
import { ProjectModal } from './components/ProjectModal';
import { Services } from './components/Services';
import { Process } from './components/Process';
import { EnquirySection } from './components/EnquirySection';
import { Footer } from './components/Footer';

import {
  ALL_PROJECT_IMAGES,
  PROJECT_GROUPS,
  ProjectImage,
  ProjectGroup,
} from './data/projectsData';

export default function App() {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'masonry' | 'projects'>('masonry');

  // Lightbox State
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);
  const [lightboxImages, setLightboxImages] = useState<ProjectImage[]>(ALL_PROJECT_IMAGES);

  // Project Modal State
  const [selectedProject, setSelectedProject] = useState<ProjectGroup | null>(null);
  const [projectModalOpen, setProjectModalOpen] = useState<boolean>(false);

  // Prefilled Enquiry State
  const [prefilledStall, setPrefilledStall] = useState<string>('');

  // Global Image Protection: Block right-click context menu and drag-to-save
  React.useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG' || target.closest('img') || target.closest('.protected-image')) {
        e.preventDefault();
      }
    };
    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG' || target.closest('img')) {
        e.preventDefault();
      }
    };
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('dragstart', handleDragStart);
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('dragstart', handleDragStart);
    };
  }, []);

  // Filtered images calculation
  const filteredImages = useMemo(() => {
    return ALL_PROJECT_IMAGES.filter((img) => {
      // Category match
      const matchesCategory =
        activeCategory === 'all' || img.category === activeCategory;

      // Search match
      const query = searchQuery.toLowerCase().trim();
      if (!query) return matchesCategory;

      const matchesSearch =
        img.title.toLowerCase().includes(query) ||
        img.client.toLowerCase().includes(query) ||
        img.event.toLowerCase().includes(query) ||
        img.location.toLowerCase().includes(query) ||
        img.boothNumber.toLowerCase().includes(query) ||
        img.description.toLowerCase().includes(query) ||
        img.specs.toLowerCase().includes(query) ||
        img.tags.some((t) => t.toLowerCase().includes(query));

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  // Filtered projects calculation
  const filteredProjects = useMemo(() => {
    return PROJECT_GROUPS.filter((group) => {
      const matchesCategory =
        activeCategory === 'all' || group.category === activeCategory;

      const query = searchQuery.toLowerCase().trim();
      if (!query) return matchesCategory;

      const matchesSearch =
        group.title.toLowerCase().includes(query) ||
        group.client.toLowerCase().includes(query) ||
        group.event.toLowerCase().includes(query) ||
        group.location.toLowerCase().includes(query) ||
        group.boothNumber.toLowerCase().includes(query) ||
        group.description.toLowerCase().includes(query) ||
        group.specs.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  // Handlers
  const handleOpenLightbox = (image: ProjectImage, index: number) => {
    setLightboxImages(filteredImages);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const handleOpenProjectModal = (projectId: string) => {
    const found = PROJECT_GROUPS.find((g) => g.projectId === projectId);
    if (found) {
      setSelectedProject(found);
      setProjectModalOpen(true);
    }
  };

  const handleDiscussStall = (item: ProjectImage | string) => {
    const name = typeof item === 'string' ? item : item.title;
    setPrefilledStall(name);
    setLightboxOpen(false);
    setProjectModalOpen(false);
    const enquiryEl = document.getElementById('enquiry');
    if (enquiryEl) {
      enquiryEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToEnquiry = () => {
    const enquiryEl = document.getElementById('enquiry');
    if (enquiryEl) {
      enquiryEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToGallery = () => {
    const galleryEl = document.getElementById('gallery');
    if (galleryEl) {
      galleryEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F5] text-brand-dark">
      {/* Header */}
      <Header onQuoteClick={scrollToEnquiry} />

      <main className="flex-1">
        {/* Hero Section */}
        <Hero onExploreClick={scrollToGallery} onPlanClick={scrollToEnquiry} />

        {/* Gallery & Portfolio Section */}
        <section id="gallery" className="pt-6 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="mb-8 space-y-3">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-brand-dark tracking-tight font-display">
              Selected exhibition stalls.
            </h2>
            <p className="text-base text-gray-700 max-w-xl">
              Browse verified photography, custom exhibition stands, and multi-angle 3D spatial concepts.
            </p>
          </div>

          {/* Sticky Category and Filter Bar */}
          <FilterBar
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            totalFilteredCount={
              viewMode === 'masonry' ? filteredImages.length : filteredProjects.length
            }
          />

          {/* Active View: Masonry Gallery or Grouped Projects */}
          <div id="projects">
            {viewMode === 'masonry' ? (
              <Gallery
                images={filteredImages}
                onImageClick={handleOpenLightbox}
                onProjectClick={handleOpenProjectModal}
              />
            ) : (
              <ProjectGroupsView
                groups={filteredProjects}
                onSelectProject={handleOpenProjectModal}
              />
            )}
          </div>
        </section>

        {/* Services & Capabilities */}
        <Services />

        {/* Step-by-Step Process */}
        <Process />

        {/* Enquiry Form */}
        <EnquirySection prefilledStall={prefilledStall} />
      </main>

      {/* Footer */}
      <Footer />

      {/* Lightbox Modal */}
      <Lightbox
        images={lightboxImages}
        currentIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={setLightboxIndex}
        onDiscussStall={handleDiscussStall}
      />

      {/* Dedicated Project Modal */}
      <ProjectModal
        project={selectedProject}
        isOpen={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        onImageSelect={(img) => {
          setLightboxImages(selectedProject?.images || [img]);
          const idx = (selectedProject?.images || []).findIndex((i) => i.id === img.id);
          setLightboxIndex(Math.max(0, idx));
          setLightboxOpen(true);
        }}
        onDiscussStall={handleDiscussStall}
      />
    </div>
  );
}
