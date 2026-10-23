import React from 'react';

export const Process: React.FC = () => {
  const steps = [
    {
      phase: 'Initial Brief & Hall Survey',
      desc: 'We analyze your allocated stall coordinates, open sides (corner, peninsula, or island), venue regulations, target attendee demographics, and live product demo requirements.'
    },
    {
      phase: 'Spatial Zoning & Flow Planning',
      desc: 'We map clean visitor pathways, sightlines from main aisles, private consultation rooms, AV video wall positioning, and lockable storage pantries.'
    },
    {
      phase: 'Photorealistic 3D Visualization',
      desc: 'Review true-to-scale 3D models with daylight studies, illuminated lightboxes, corporate typography, and exact material elevation blueprints before any wood is cut.'
    },
    {
      phase: 'In-House Precision Fabrication',
      desc: 'Joinery, metal framework, CNC cutting, and pre-assembly testing carried out inside our dedicated production facility with strict structural quality checks.'
    },
    {
      phase: 'Venue Erection & Flawless Handover',
      desc: 'Our experienced on-site construction crew erects, paints, wires, and cleans your stall at the expo venue, handing over a pristine booth hours before the doors open.'
    }
  ];

  return (
    <section id="process" className="py-24 md:py-32 bg-[#FAF9F5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-16 space-y-4">
          <h2 className="text-3xl sm:text-5xl font-black text-brand-dark tracking-tight leading-tight font-display">
            How your exhibition stall comes together.
          </h2>
          <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
            A disciplined, predictable sequence that turns architectural designs into real physical environments on time, every time.
          </p>
        </div>

        {/* Process Flow */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {steps.map((step) => (
            <div
              key={step.phase}
              className="bg-white rounded-2xl p-6 sm:p-7 border border-brand-subtle flex flex-col justify-between"
            >
              <div>
                <h3 className="text-lg font-bold text-brand-dark mb-3 font-display leading-snug">
                  {step.phase}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
