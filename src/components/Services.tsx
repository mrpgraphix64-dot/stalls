import React from 'react';
import { ArrowUpRight } from 'lucide-react';

export const Services: React.FC = () => {
  const capabilities = [
    {
      title: '3D Spatial Planning & Photorealistic Visualization',
      detail: 'Photorealistic multi-angle renders, daylight & artificial lighting studies, and precise elevation schematics before construction begins.',
      specs: 'CAD Elevations · 3ds Max / V-Ray · Material Texturing · Sightline Optimization'
    },
    {
      title: 'Custom Joinery & Structural Fabrication',
      detail: 'In-house woodwork, bespoke cabinetry, CNC precision milling, architectural metal frames, and seamless spray-painted finishes.',
      specs: 'MDF / Plywood Crafting · Structural Steel & Trusses · High-Gloss Acrylics · Fire-Retardant Standards'
    },
    {
      title: 'Backlit Graphics & Large-Format Signage',
      detail: 'High-lux LED edge-lit fabric displays, direct UV flatbed graphics, 3D raised corporate lettering, and durable anti-scratch vinyl.',
      specs: 'Seamless SEG Fabric · LED Matrix Panels · Dimensional 3D Acrylics · Frosted Glass'
    },
    {
      title: 'Modular & Reusable Exhibition Systems',
      detail: 'Smart aluminum modular architectures designed for multi-city trade shows, fast venue turnarounds, and reduced environmental footprint.',
      specs: 'Octanorm & Custom Profiles · Tool-Free Assembly · Multi-Expo Reconfigurability'
    },
    {
      title: 'Brand Pavilions & Multi-Zone Activations',
      detail: 'Expansive island setups, double-decker structural mezzanine levels, VIP meeting enclosures, and interactive product demo stations.',
      specs: 'Overhead Rigging & Banners · Heavy Equipment Flooring · Acoustic Meeting Lounges'
    },
    {
      title: 'Turnkey On-Site Erection & Supervision',
      detail: 'Experienced venue project managers, overnight build shifts, electrical compliance signoffs, and complete post-show dismantling.',
      specs: 'ExCeL London & NEC Birmingham · Gujarat & India Halls · 24/7 Standby Crew'
    }
  ];

  return (
    <section id="services" className="py-24 md:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-16 space-y-4">
          <h2 className="text-3xl sm:text-5xl font-black text-brand-dark tracking-tight leading-tight font-display">
            Turnkey capabilities from concept to construction.
          </h2>
          <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
            We handle the complete execution lifecycle so your marketing and leadership teams can focus entirely on attendees, clients, and closed deals.
          </p>
        </div>

        {/* Editorial Structured Capabilities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
          {capabilities.map((cap) => (
            <div
              key={cap.title}
              className="p-8 rounded-2xl bg-[#FAF9F5] border border-brand-subtle flex flex-col justify-between group hover:border-brand-dark transition-colors duration-200"
            >
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-brand-dark leading-snug group-hover:text-brand-red transition-colors font-display">
                  {cap.title}
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed font-normal">
                  {cap.detail}
                </p>
              </div>

              <div className="pt-6 mt-6 border-t border-brand-subtle/80">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Specifications
                </div>
                <div className="text-xs text-brand-dark font-medium mt-1">
                  {cap.specs}
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
