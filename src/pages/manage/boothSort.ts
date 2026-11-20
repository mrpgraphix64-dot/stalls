import { BoothItem } from './types';

export type SortDirection = 'asc' | 'desc';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/**
 * Normalizes booth number strings:
 * - Replaces various Unicode dashes (en-dash, em-dash, minus, horizontal bar) with standard hyphen '-'
 * - Trims whitespace
 */
export function normalizeBoothNumber(str: string | null | undefined): string {
  if (!str) return '';
  return str.trim().replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-');
}

/**
 * Checks whether a booth number string represents an unallotted / pending / empty state.
 */
export function isPendingOrEmpty(val: string | null | undefined): boolean {
  if (!val) return true;
  const s = val.trim().toLowerCase();
  return s === '' || s === 'pending' || s === 'tbd' || s === 'n/a' || s === '-';
}

/**
 * Natural comparison between two booth number strings.
 * Handles:
 * - Prefixes (A, B, C, D, Hall 1 - A, etc.)
 * - Natural numeric ordering (A2 before A9 before A24 before A119)
 * - Combined booth numbers (A36-A37, A36–A37)
 * - Unicode dashes (en-dash, em-dash, etc.)
 * - Unallotted/Pending values placed at the end in both directions so real stalls are prioritized
 */
export function compareBoothNumbers(
  aNum: string | null | undefined,
  bNum: string | null | undefined,
  direction: SortDirection = 'asc'
): number {
  const aEmpty = isPendingOrEmpty(aNum);
  const bEmpty = isPendingOrEmpty(bNum);

  // If both are empty or pending, treat as equivalent
  if (aEmpty && bEmpty) return 0;

  // Unallotted / pending stalls always stay at the bottom
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  const aNorm = normalizeBoothNumber(aNum);
  const bNorm = normalizeBoothNumber(bNum);

  const cmp = collator.compare(aNorm, bNorm);
  return direction === 'asc' ? cmp : -cmp;
}

/**
 * Sorts an array of BoothItems by booth_number using natural numeric ordering.
 * Preserves the original array by returning a new shallow-copied array.
 * Guarantees stable ordering for items with equivalent identifiers (tie-breaker by client_name, then id).
 */
export function sortBoothsByNumber<T extends { booth_number?: string | null; client_name?: string; id?: string }>(
  booths: T[],
  direction: SortDirection = 'asc'
): T[] {
  return [...booths].sort((a, b) => {
    const cmp = compareBoothNumbers(a.booth_number, b.booth_number, direction);
    if (cmp !== 0) return cmp;

    // Stable tie-breaker 1: client name
    const nameA = (a.client_name || '').trim();
    const nameB = (b.client_name || '').trim();
    const nameCmp = collator.compare(nameA, nameB);
    if (nameCmp !== 0) return nameCmp;

    // Stable tie-breaker 2: unique ID
    return (a.id || '').localeCompare(b.id || '');
  });
}
