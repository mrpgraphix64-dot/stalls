import React from 'react';
import { Ruler, CheckCircle2, Hammer, Clock, Plus, MessageSquare } from 'lucide-react';
import { SIZES, SIZE_PACKAGES } from '../data/projectsData';

interface SizeFilterProps {
  activeSize: string;
  onSelectSize: (size: string) => void;
  totalCount: number;
  onGetQuote: (sizeLabel: string) => void;
}

export const SizeFilter: React.FC<SizeFilterProps> = ({ activeSize, onSelectSize, totalCount, onGetQuote }) => {
  const pkg = activeSize !== 'all' ? SIZE_PACKAGES[activeSize] : undefined;
  const active = SIZES.find((s) => s.id === activeSize);

  return (
    <div className="mb-8 space-y-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex items-center gap-1.5 text-xs font-bold text-gray-600 uppercase tracking-wider mr-1">
          <Ruler className="w-4 h-4 text-brand-red" />
          Stall size
        </span>
        {[{ id: 'all', label: 'All sizes', count: totalCount }, ...SIZES].map((s) => {
          const isActive = activeSize === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onSelectSize(s.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                isActive
                  ? 'bg-brand-dark text-white'
                  : 'bg-white text-gray-800 hover:bg-brand-surface border border-brand-subtle'
              }`}
            >
              <span>{s.label}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${isActive ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-800'}`}>
                {s.count}
              </span>
            </button>
          );
        })}
      </div>

      {pkg && active && (
        <div className="bg-white rounded-2xl border border-brand-subtle p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-smooth-in">
          <div className="space-y-3">
            <h3 className="text-2xl font-black text-brand-dark font-display">{active.label} stalls</h3>
            <p className="text-sm text-gray-700 leading-relaxed">{pkg.blurb}</p>
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-gray-700">
              <span className="px-2.5 py-1 rounded-lg bg-brand-surface">{pkg.area}</span>
              <span className="px-2.5 py-1 rounded-lg bg-brand-surface flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-brand-red" />
                {pkg.buildTime}
              </span>
            </div>
            <button
              onClick={() => onGetQuote(`${active.label} stall`)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-red hover:bg-brand-dark text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Get a {active.label} quote
            </button>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-brand-red" /> What's included
            </h4>
            <ul className="space-y-1.5 text-sm text-gray-700">
              {pkg.inclusions.map((i) => (
                <li key={i} className="flex gap-2"><span className="text-brand-red">✓</span>{i}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                <Hammer className="w-4 h-4 text-brand-red" /> Materials
              </h4>
              <div className="flex flex-wrap gap-2">
                {pkg.materials.map((m) => (
                  <span key={m} className="text-xs px-2.5 py-1 rounded-lg bg-brand-surface text-gray-700">{m}</span>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-brand-red" /> Optional add-ons
              </h4>
              <div className="flex flex-wrap gap-2">
                {pkg.addons.map((a) => (
                  <span key={a} className="text-xs px-2.5 py-1 rounded-lg border border-brand-subtle text-gray-700">{a}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
