import React from 'react';
import { Box, Folder, ExternalLink } from 'lucide-react';
import { BoothItem } from './types';

interface BoothWorkStatusBadgesProps {
  booth: Pick<BoothItem, 'booking_stage' | 'print_status' | 'prod_status'> & {
    primary_3d_url?: string | null;
    print_drive_url?: string | null;
  };
  className?: string;
}

export type WorkTaskStatus = 'done' | 'pending' | 'na';

export function resolveWorkTaskStatus(status?: string | null): WorkTaskStatus {
  if (!status) return 'pending';
  const s = status.toLowerCase().trim();
  if (s === 'done' || s === 'completed') return 'done';
  if (s === 'na' || s === 'not_applicable' || s === 'n/a') return 'na';
  return 'pending';
}

function isValidUrl(url?: string | null): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/uploads/') ||
    trimmed.startsWith('uploads/')
  );
}

export function BoothWorkStatusBadges({ booth, className = '' }: BoothWorkStatusBadgesProps) {
  const isDiscussion = booth.booking_stage === 'discussion';
  const has3D = isValidUrl(booth.primary_3d_url);
  const hasFiles = isValidUrl(booth.print_drive_url);

  // If ongoing discussion and neither 3D nor Print link exists, nothing to display
  if (isDiscussion && !has3D && !hasFiles) {
    return null;
  }

  const print = resolveWorkTaskStatus(booth.print_status);
  const prod = resolveWorkTaskStatus(booth.prod_status);

  const getChipStyle = (status: WorkTaskStatus) => {
    switch (status) {
      case 'done':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
      case 'pending':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
      case 'na':
      default:
        return 'bg-zinc-800/80 text-zinc-400 border-zinc-700/50';
    }
  };

  const getSymbol = (status: WorkTaskStatus) => {
    switch (status) {
      case 'done':
        return '✓';
      case 'pending':
        return '○';
      case 'na':
        return '—';
    }
  };

  const printTitle =
    print === 'done'
      ? 'Print Files: Completed'
      : print === 'na'
      ? 'Print Files: Not Required (N/A)'
      : 'Print Files: Pending';

  const prodTitle =
    prod === 'done'
      ? 'Production: Completed'
      : prod === 'na'
      ? 'Production: Not Required (N/A)'
      : 'Production: Pending';

  return (
    <span className={`inline-flex items-center gap-1.5 shrink-0 select-none ${className}`}>
      {/* 1. Print & Production Work Status Chips (for confirmed stalls only) */}
      {!isDiscussion && (
        <>
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border leading-none transition-colors ${getChipStyle(
              print
            )}`}
            title={printTitle}
          >
            <span>Print</span>
            <span className="font-bold">{getSymbol(print)}</span>
          </span>

          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border leading-none transition-colors ${getChipStyle(
              prod
            )}`}
            title={prodTitle}
          >
            <span>Prod</span>
            <span className="font-bold">{getSymbol(prod)}</span>
          </span>
        </>
      )}

      {/* 2. 3D Stall View Quick Link */}
      {has3D && (() => {
        const isImg =
          booth.primary_3d_url?.startsWith('/uploads/') ||
          booth.primary_3d_url?.match(/\.(jpeg|jpg|png|webp|gif)(\?.*)?$/i);
        const title3d = isImg ? 'View 3D Stall Image' : 'Open 3D Stall View';
        return (
          <a
            href={booth.primary_3d_url!}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border leading-none transition-colors bg-sky-500/10 text-sky-400 border-sky-500/25 hover:bg-sky-500/20 hover:text-sky-300 hover:border-sky-500/40 cursor-pointer shrink-0"
            title={title3d}
            aria-label={title3d}
          >
            <Box className="w-2.5 h-2.5" />
            <span>3D</span>
            <ExternalLink className="w-2 h-2 opacity-75" />
          </a>
        );
      })()}

      {/* 3. Print Files Google Drive Folder Quick Link */}
      {hasFiles && (
        <a
          href={booth.print_drive_url!}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border leading-none transition-colors bg-amber-500/10 text-amber-400 border-amber-500/25 hover:bg-amber-500/20 hover:text-amber-300 hover:border-amber-500/40 cursor-pointer shrink-0"
          title="Open Print Files Folder"
          aria-label="Open Print Files Folder"
        >
          <Folder className="w-2.5 h-2.5" />
          <span>Files</span>
          <ExternalLink className="w-2 h-2 opacity-75" />
        </a>
      )}
    </span>
  );
}
