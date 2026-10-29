import React from 'react';

interface StallLoaderProps {
  label?: string;
  className?: string;
}

/** Branded loader: a stall outline that draws itself, with a shimmering progress bar */
export const StallLoader: React.FC<StallLoaderProps> = ({ label = 'Preparing your 3D stall', className = '' }) => (
  <div
    role="status"
    aria-live="polite"
    className={`flex flex-col items-center justify-center gap-6 rounded-xl bg-gradient-to-b from-[#1b1e25] to-[#0d0f13] text-white ${className}`}
  >
    <svg viewBox="0 0 120 100" className="w-32 h-28" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path className="loader-draw loader-d1" d="M20 78 L60 96 L100 78 L60 60 Z" stroke="#ffffff55" strokeWidth="1.5" />
      <path className="loader-draw loader-d2" d="M20 78 V30 M100 78 V30 M60 60 V12" stroke="#ffffff" strokeWidth="2" />
      <path className="loader-draw loader-d3" d="M20 30 L60 12 L100 30" stroke="#e5322d" strokeWidth="3" />
      <path className="loader-draw loader-d4" d="M20 30 L60 48 L100 30 M60 48 V60" stroke="#ffffff55" strokeWidth="1.5" />
      <circle className="loader-pulse" cx="60" cy="30" r="3.5" fill="#e5322d" />
    </svg>
    <div className="w-44 h-1 rounded-full bg-white/10 overflow-hidden">
      <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-brand-red to-transparent loader-bar" />
    </div>
    <p className="text-xs font-semibold tracking-widest uppercase text-white/70">{label}</p>
    <span className="sr-only">Loading</span>
  </div>
);
