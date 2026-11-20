import React from 'react';

export interface BoothWallIndicatorProps {
  wallConfig?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export type WallConfigType =
  | '3_sides'
  | '2_sides_left'
  | '2_sides_right'
  | 'back_only'
  | 'unconfigured';

export interface WallConfigInfo {
  type: WallConfigType;
  label: string;
  shortLabel: string;
  tooltip: string;
  isConfigured: boolean;
}

/**
 * Parses raw wall configuration string from SQLite into structured metadata.
 * Strictly uses saved wall configuration data; never infers from stall structure.
 */
export function parseWallConfig(raw?: string | null): WallConfigInfo {
  if (!raw || typeof raw !== 'string') {
    return {
      type: 'unconfigured',
      label: 'Not Configured',
      shortLabel: '—',
      tooltip: 'Wall configuration not configured',
      isConfigured: false,
    };
  }

  const s = raw.trim().toLowerCase();

  if (s === '3 sides' || s === '3sides' || s.includes('3 side')) {
    return {
      type: '3_sides',
      label: '3 Sides',
      shortLabel: '3 Sides',
      tooltip: '3 Sides — Back + Left + Right (Open Front)',
      isConfigured: true,
    };
  }

  if (s.includes('right') || s === 'back + right' || s === '2 sides - right') {
    return {
      type: '2_sides_right',
      label: 'Back + Right',
      shortLabel: 'Back + Right',
      tooltip: '2 Sides — Back + Right (Corner Stall)',
      isConfigured: true,
    };
  }

  if (s.includes('left') || s === 'back + left' || s === '2 sides - left') {
    return {
      type: '2_sides_left',
      label: 'Back + Left',
      shortLabel: 'Back + Left',
      tooltip: '2 Sides — Back + Left (Corner Stall)',
      isConfigured: true,
    };
  }

  if (s.includes('back wall') || s.includes('back only') || s === 'back wall only') {
    return {
      type: 'back_only',
      label: 'Back Wall Only',
      shortLabel: 'Back Wall',
      tooltip: 'Back Wall Only (3 Open Sides)',
      isConfigured: true,
    };
  }

  // Graceful fallback for generic '2 Sides' without orientation specified
  if (s.includes('2 side')) {
    return {
      type: '2_sides_left',
      label: '2 Sides',
      shortLabel: '2 Sides',
      tooltip: '2 Sides — Back + Side Wall',
      isConfigured: true,
    };
  }

  return {
    type: 'unconfigured',
    label: 'Not Configured',
    shortLabel: '—',
    tooltip: 'Wall configuration not configured',
    isConfigured: false,
  };
}

/**
 * Top-view floorplan architectural wall diagram (28-36px range default):
 * Top = Back Wall, Left = Left Wall, Right = Right Wall, Bottom = Open Front Aisle.
 * Solid physical walls: Amber stroke.
 * Open front / aisle side: Subtle emerald dashed line.
 * Subtle stall boundary: Thin gray stroke.
 */
export function WallDiagramSvg({
  type,
  size = 'md',
  className = '',
}: {
  type: WallConfigType;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  // Dimensions: sm = 20px, md = 30px (default within 28-36px), lg = 34px
  const dimensionClass =
    size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-8.5 h-8.5' : 'w-7.5 h-7.5';

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={`${dimensionClass} shrink-0 ${className}`}
      aria-hidden="true"
    >
      {/* Floor / Footprint boundary with subtle border */}
      <rect
        x="4.5"
        y="4.5"
        width="23"
        height="23"
        rx="2.5"
        className="fill-[#141720] stroke-white/[0.08]"
        strokeWidth="1"
      />

      {type === '3_sides' && (
        <>
          {/* Solid walls: Left, Back, Right */}
          <path
            d="M 7 25.5 L 7 6.5 L 25 6.5 L 25 25.5"
            className="stroke-amber-400"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Open Front entrance / aisle: dashed emerald */}
          <path
            d="M 7 25.5 L 25 25.5"
            className="stroke-emerald-400/60"
            strokeWidth="1.5"
            strokeDasharray="2.5 2"
            strokeLinecap="round"
          />
        </>
      )}

      {type === '2_sides_left' && (
        <>
          {/* Solid walls: Left and Back (L-shape) */}
          <path
            d="M 7 25.5 L 7 6.5 L 25 6.5"
            className="stroke-amber-400"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Open Right and Front entrance: dashed emerald */}
          <path
            d="M 25 6.5 L 25 25.5 L 7 25.5"
            className="stroke-emerald-400/60"
            strokeWidth="1.5"
            strokeDasharray="2.5 2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      {type === '2_sides_right' && (
        <>
          {/* Solid walls: Back and Right (reversed L-shape) */}
          <path
            d="M 7 6.5 L 25 6.5 L 25 25.5"
            className="stroke-amber-400"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Open Left and Front entrance: dashed emerald */}
          <path
            d="M 7 6.5 L 7 25.5 L 25 25.5"
            className="stroke-emerald-400/60"
            strokeWidth="1.5"
            strokeDasharray="2.5 2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      {type === 'back_only' && (
        <>
          {/* Solid wall: Back wall only */}
          <path
            d="M 7 6.5 L 25 6.5"
            className="stroke-amber-400"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Open Left, Front, Right: dashed emerald */}
          <path
            d="M 7 6.5 L 7 25.5 L 25 25.5 L 25 6.5"
            className="stroke-emerald-400/60"
            strokeWidth="1.5"
            strokeDasharray="2.5 2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}

export function BoothWallIndicator({
  wallConfig,
  size = 'md',
  showLabel = true,
  className = '',
}: BoothWallIndicatorProps) {
  const info = parseWallConfig(wallConfig);

  if (!info.isConfigured) {
    return (
      <span
        className={`font-mono text-zinc-600 text-sm leading-none select-none inline-block px-1 ${className}`}
        title="Wall configuration not configured"
      >
        —
      </span>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 ${className}`}
      title={info.tooltip}
    >
      <WallDiagramSvg type={info.type} size={size} />
      {showLabel && (
        <span className="font-mono text-[11px] text-zinc-300 font-medium whitespace-nowrap">
          {info.shortLabel}
        </span>
      )}
    </div>
  );
}
