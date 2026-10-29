import React, { useState } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Gallery } from './components/Gallery';
import { Lightbox } from './components/Lightbox';
import { ProjectModal } from './components/ProjectModal';
import { Services } from './components/Services';
import { Process } from './components/Process';
import { EnquirySection } from './components/EnquirySection';
import { Footer } from './components/Footer';
import { SizeFilter } from './components/SizeFilter';

import {
  ALL_PROJECT_IMAGES,
  PROJECT_GROUPS,
  ProjectImage,
  ProjectGroup,
} from './data/projectsData';

interface AppProps {
  initialPrefill?: string;
}

export default function App({ initialPrefill = '' }: AppProps) {
  // Size filter
  const [activeSize, setActiveSize] = useState<string>('all');
  const visibleImages = React.useMemo(
    () => (activeSize === 'all' ? ALL_PROJECT_IMAGES : ALL_PROJECT_IMAGES.filter((i) => i.size === activeSize)),
    [activeSize]
  );

  // Lightbox State
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);
  const [lightboxImages, setLightboxImages] = useState<ProjectImage[]>(ALL_PROJECT_IMAGES);

  // Project Modal State
  const [selectedProject, setSelectedProject] = useState<ProjectGroup | null>(null);
  const [projectModalOpen, setProjectModalOpen] = useState<boolean>(false);

  // Prefilled Enquiry State
  const [prefilledStall, setPrefilledStall] = useState<string>(initialPrefill);

  // Arriving from the builder: jump to the enquiry form
  React.useEffect(() => {
    if (initialPrefill) setTimeout(() => document.getElementById('enquiry')?.scrollIntoView(), 50);
  }, [initialPrefill]);

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

  // Handlers
  const handleOpenLightbox = (_image: ProjectImage, index: number) => {
    setLightboxImages(visibleImages);
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
        <section id="gallery" className="pt-8 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="mb-10 space-y-3">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-brand-dark tracking-tight font-display">
              Selected exhibition stalls.
            </h2>
            <p className="text-base text-gray-700 max-w-xl">
              Browse verified photography, custom exhibition stands, and multi-angle 3D spatial concepts.
            </p>
          </div>

          <SizeFilter
            activeSize={activeSize}
            onSelectSize={setActiveSize}
            totalCount={ALL_PROJECT_IMAGES.length}
            onGetQuote={handleDiscussStall}
          />

          {/* Continuous Masonry Gallery */}
          <div id="projects">
            <Gallery
              images={visibleImages}
              onImageClick={handleOpenLightbox}
              onProjectClick={handleOpenProjectModal}
            />
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
