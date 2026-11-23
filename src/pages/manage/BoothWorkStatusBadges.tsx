import React from 'react';
import { BoothItem } from './types';

interface BoothWorkStatusBadgesProps {
  booth: Pick<BoothItem, 'booking_stage' | 'print_status' | 'prod_status'>;
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

export function BoothWorkStatusBadges({ booth, className = '' }: BoothWorkStatusBadgesProps) {
  // Never show Print/Prod chips for ongoing discussions
  if (booth.booking_stage === 'discussion') {
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
      {/* Print Status Chip */}
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border leading-none transition-colors ${getChipStyle(
          print
        )}`}
        title={printTitle}
      >
        <span>Print</span>
        <span className="font-bold">{getSymbol(print)}</span>
      </span>

      {/* Production Status Chip */}
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border leading-none transition-colors ${getChipStyle(
          prod
        )}`}
        title={prodTitle}
      >
        <span>Prod</span>
        <span className="font-bold">{getSymbol(prod)}</span>
      </span>
    </span>
  );
}
