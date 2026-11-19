/**
 * Official Floor Plan Reference Data & Helpers
 * Source: OVERALL VENUE LAYOUT IT EXPO R5 (Tech Expo Gujarat 2026, GUCEC Ahmedabad)
 * PDF: https://www.techexpogujarat.com/OVERALL%20VENUE%20%20LAYOUT%20IT%20EXPO%20R5.pdf
 */

export const OFFICIAL_FLOORPLAN_PDF =
  'https://www.techexpogujarat.com/OVERALL%20VENUE%20%20LAYOUT%20IT%20EXPO%20R5.pdf';

export const OFFICIAL_FLOORPLAN_IMAGE = '/images/floorplan_techexpo2026.png';

export interface VerifiedStallDef {
  number: string;
  size: string;
  type: string;
  category: '3x3_standard' | '3x3_2side' | '6x3' | '6x6' | '27sqm' | 'startup' | 'custom';
}

// 2-Side Open 3x3 stalls verified from layout legend & grid (54 stalls)
const TWO_SIDE_OPEN_A_STALLS = new Set([
  'A1', 'A2', 'A13', 'A14', 'A19', 'A22', 'A27', 'A31', 'A34',
  'A36', 'A37', 'A39', 'A42', 'A46', 'A48', 'A49', 'A51', 'A54',
  'A55', 'A57', 'A61', 'A63', 'A64', 'A66', 'A69', 'A71', 'A72',
  'A74', 'A78', 'A81', 'A84', 'A86', 'A87', 'A89', 'A93', 'A96',
  'A98', 'A99', 'A101', 'A102', 'A104', 'A108', 'A111', 'A113',
  'A116', 'A119', 'A121', 'A132', 'A135', 'A144', 'A147', 'A150'
]);

// Build master catalogue of verified stalls
export const VERIFIED_STALLS: VerifiedStallDef[] = [];

// 1. D-Series: D1 - D12 (6m x 6m Island / Premium, 12 stalls)
for (let i = 1; i <= 12; i++) {
  VERIFIED_STALLS.push({
    number: `D${i}`,
    size: '6m x 6m',
    type: '6m x 6m Island / Premium',
    category: '6x6',
  });
}

// 2. B-Series: B1 - B21 (6m x 3m, 21 stalls)
for (let i = 1; i <= 21; i++) {
  VERIFIED_STALLS.push({
    number: `B${i}`,
    size: '6m x 3m',
    type: '6m x 3m Stall',
    category: '6x3',
  });
}

// 3. C-Series: C1 - C4 (27 sq.m L-Shape Corner Stalls, 4 stalls)
for (let i = 1; i <= 4; i++) {
  VERIFIED_STALLS.push({
    number: `C${i}`,
    size: '27 sq.m',
    type: '27 sq.m L-Shape Corner',
    category: '27sqm',
  });
}

// 4. A-Series: A1 - A150 (3m x 3m, 136 total: 82 standard + 54 two-side open)
for (let i = 1; i <= 150; i++) {
  const num = `A${i}`;
  const is2Side = TWO_SIDE_OPEN_A_STALLS.has(num);
  VERIFIED_STALLS.push({
    number: num,
    size: '3m x 3m',
    type: is2Side ? '3m x 3m (2 Side Open)' : '3m x 3m Standard',
    category: is2Side ? '3x3_2side' : '3x3_standard',
  });
}

// 5. S-Series: S1 - S49 (Startup Booths, 49 stalls)
for (let i = 1; i <= 49; i++) {
  VERIFIED_STALLS.push({
    number: `S${i}`,
    size: '3m x 2m',
    type: 'Startup Booth',
    category: 'startup',
  });
}

/**
 * Standard configuration options for stalls
 */
export const STALL_SIZE_OPTIONS = [
  '3m x 3m',
  '3m x 3m (2 Side Open)',
  '6m x 3m',
  '6m x 6m',
  '27 sq.m',
  '3m x 2m',
  'Custom Size',
];

export const STALL_TYPE_OPTIONS = [
  '3m x 3m Standard',
  '3m x 3m (2 Side Open)',
  '6m x 3m Stall',
  '6m x 6m Island / Premium',
  '27 sq.m L-Shape Corner',
  'Startup Booth',
  'Custom Stall',
  'Turnkey Pavilion',
];

/**
 * Match user input stall number to verified floor plan specs
 */
export function matchFloorplanStall(inputNumber: string): VerifiedStallDef | null {
  if (!inputNumber) return null;
  const clean = inputNumber.trim().toUpperCase().replace(/\s+/g, '');

  const match = VERIFIED_STALLS.find(
    (s) => s.number.toUpperCase() === clean || s.number.toUpperCase().replace('-', '') === clean
  );

  return match || null;
}
