// Shared builder model (used by the 2D plan and the 3D preview)
export const WALL_T = 0.08;

// Tech Expo Gujarat 2026 manual: shell scheme walls are 8'0" high, custom stalls may go up to 15 ft
export const SHELL_WALL_H = 2.44;
export const CUSTOM_WALL_H = 2.5;
export const MAX_CUSTOM_H_FT = 15;

export type WallLayout = 'none' | 'single' | 'corner' | 'three';
export type BuildStyle = 'shell' | 'custom';

export type ItemType =
  | 'counter'
  | 'table'
  | 'chair'
  | 'sofa'
  | 'tv'
  | 'logo'
  | 'plant'
  | 'rack'
  | 'shelf'
  | 'highTable'
  | 'barStool'
  | 'lightLogo'
  | 'octanormTable'
  | 'topLight'
  | 'wastebasket'
  | 'plugPoint'
  | 'steelChair'
  | 'laminateTable'
  | 'centreTable'
  | 'lockableTable'
  | 'showcaseH'
  | 'showcaseV'
  | 'glassShelf'
  | 'garmentRack'
  | 'queueManager'
  | 'halogen50'
  | 'halogen100'
  | 'glassTable';

export interface PlacedItem {
  id: string;
  type: ItemType;
  x: number; // centre, metres
  y: number;
  rot: 0 | 90 | 180 | 270;
}

export type ItemGroup = 'Furniture' | 'Lighting & power' | 'Branding & decor';

export interface CatalogEntry {
  type: ItemType;
  label: string;
  w: number;
  d: number;
  group: ItemGroup;
  wallMounted?: boolean;
  /** organiser add-on code and rent per unit (₹), from Tech Expo Gujarat 2026 manual, Section 5 */
  ref?: string;
  rate?: number;
}

export const CATALOG: CatalogEntry[] = [
  // Furniture
  { type: 'counter', label: 'System counter', w: 1.07, d: 0.61, group: 'Furniture' },
  { type: 'chair', label: 'White chair', w: 0.45, d: 0.45, group: 'Furniture' },
  { type: 'steelChair', label: 'Black steel chair', w: 0.45, d: 0.45, group: 'Furniture', ref: 'FF-02', rate: 400 },
  { type: 'glassTable', label: 'Round glass table', w: 0.8, d: 0.8, group: 'Furniture' },
  { type: 'table', label: 'Round table', w: 0.7, d: 0.7, group: 'Furniture', ref: 'FF-03', rate: 1200 },
  { type: 'laminateTable', label: 'Laminate table', w: 1.2, d: 0.6, group: 'Furniture', ref: 'FF-01', rate: 1000 },
  { type: 'centreTable', label: 'Centre table', w: 0.8, d: 0.8, group: 'Furniture', ref: 'FF-05', rate: 1000 },
  { type: 'lockableTable', label: 'Lockable table', w: 1.0, d: 0.5, group: 'Furniture', ref: 'FF-08', rate: 2500 },
  { type: 'sofa', label: '2-seater sofa', w: 1.52, d: 0.76, group: 'Furniture', ref: 'FF-10', rate: 2500 },
  { type: 'barStool', label: 'Bar stool', w: 0.4, d: 0.4, group: 'Furniture', ref: 'FF-12', rate: 800 },
  { type: 'highTable', label: 'High glass table', w: 0.6, d: 0.6, group: 'Furniture' },
  { type: 'octanormTable', label: 'Octanorm table', w: 1.0, d: 0.5, group: 'Furniture' },
  { type: 'showcaseH', label: 'Horizontal showcase', w: 1.0, d: 0.5, group: 'Furniture', ref: 'FF-06', rate: 3000 },
  { type: 'showcaseV', label: 'Vertical showcase', w: 0.5, d: 0.4, group: 'Furniture', ref: 'FF-07', rate: 5000 },
  { type: 'glassShelf', label: 'Glass shelf', w: 1.0, d: 0.35, group: 'Furniture', ref: 'FF-04', rate: 500 },
  { type: 'shelf', label: 'Wooden shelf', w: 1.0, d: 0.35, group: 'Furniture' },
  { type: 'rack', label: 'Brochure stand', w: 0.4, d: 0.3, group: 'Furniture', ref: 'FF-11', rate: 1000 },
  { type: 'garmentRack', label: 'Garment rack', w: 1.0, d: 0.5, group: 'Furniture', ref: 'FF-09', rate: 2500 },
  { type: 'queueManager', label: 'Queue manager', w: 1.2, d: 0.15, group: 'Furniture', ref: 'FF-13', rate: 600 },
  // Lighting & power
  { type: 'topLight', label: 'Spot light', w: 0.4, d: 0.4, group: 'Lighting & power', ref: 'FF-14', rate: 500 },
  { type: 'halogen50', label: 'LED halogen 50 W', w: 0.3, d: 0.3, group: 'Lighting & power', ref: 'FF-16', rate: 1000 },
  { type: 'halogen100', label: 'LED halogen 100 W', w: 0.3, d: 0.3, group: 'Lighting & power', ref: 'FF-17', rate: 1500 },
  { type: 'plugPoint', label: 'Plug point 15 A', w: 0.12, d: 0.04, group: 'Lighting & power', wallMounted: true, ref: 'FF-15', rate: 500 },
  // Branding & decor
  { type: 'tv', label: 'TV screen', w: 0.9, d: 0.1, group: 'Branding & decor', wallMounted: true },
  { type: 'logo', label: 'Wooden logo', w: 1.0, d: 0.1, group: 'Branding & decor', wallMounted: true },
  { type: 'lightLogo', label: '3D light logo', w: 1.0, d: 0.1, group: 'Branding & decor', wallMounted: true },
  { type: 'plant', label: 'Plant', w: 0.4, d: 0.4, group: 'Branding & decor' },
  { type: 'wastebasket', label: 'Wastepaper basket', w: 0.25, d: 0.25, group: 'Branding & decor' },
];
export const CAT = Object.fromEntries(CATALOG.map((c) => [c.type, c])) as Record<ItemType, CatalogEntry>;

// Items that need hanging, drilling or sticking on panels (not allowed on shell scheme walls)
export const WALL_FIXED: ItemType[] = ['tv', 'logo', 'lightLogo'];

export const hasWall = (layout: WallLayout) => ({
  back: layout !== 'none',
  left: layout === 'corner' || layout === 'three',
  right: layout === 'three',
});

// ---------- Stall sizes and standard packages (Tech Expo Gujarat 2026 manual, Sections 1-2) ----------
export interface StallDef {
  id: string;
  label: string;
  w: number; // frontage (open side), metres
  d: number; // depth, metres
  area: string;
  note: string;
  /** standard entitlement: item type -> quantity */
  pack: Partial<Record<ItemType, number>>;
  noWalls?: boolean;
  centrePost?: boolean;
  riser?: boolean;
}

export const STALLS: StallDef[] = [
  {
    id: '3x3', label: '3 × 3 m', w: 3, d: 3, area: '9 sq m',
    note: 'Three-side enclosed stall with one open front.',
    pack: { counter: 1, chair: 2, wastebasket: 1, topLight: 3, plugPoint: 1 },
  },
  {
    id: '3x6', label: '3 × 6 m', w: 6, d: 3, area: '18 sq m', centrePost: true,
    note: 'Two modules with a 6 m open frontage. The centre post is part of the structure and cannot be removed.',
    pack: { counter: 2, chair: 4, wastebasket: 2, topLight: 6, plugPoint: 2 },
  },
  {
    id: '6x6', label: '6 × 6 m', w: 6, d: 6, area: '36 sq m',
    note: 'Large shell stall, ideal for product demos and meeting areas.',
    pack: { counter: 2, glassTable: 2, sofa: 2, chair: 6, wastebasket: 2, topLight: 12, plugPoint: 3 },
  },
  {
    id: '3x9', label: '3 × 9 m', w: 9, d: 3, area: '27 sq m',
    note: 'Corner stall with three modules and a 9 m open frontage, including a sofa and glass table meeting area.',
    pack: { sofa: 1, chair: 4, counter: 2, glassTable: 1, wastebasket: 2, topLight: 9, plugPoint: 3 },
  },
  {
    id: '2x2', label: 'Startup booth 2 × 2 m', w: 2, d: 2, area: '4 sq m', noWalls: true, riser: true,
    note: 'Compact booth on a riser with table, chairs and power. No panel walls, fascia or spot lights.',
    pack: { laminateTable: 1, chair: 2, wastebasket: 1, plugPoint: 1 },
  },
];
export const STALL = Object.fromEntries(STALLS.map((s) => [s.id, s])) as Record<string, StallDef>;

const pid = (() => {
  let n = 0;
  return () => `std${n++}`;
})();

/** Standard entitlement laid out inside the stall (positions in metres, plan coordinates) */
export function standardItems(s: StallDef): PlacedItem[] {
  const { w: W, d: D } = s;
  const out: PlacedItem[] = [];
  const add = (type: ItemType, x: number, y: number, rot: PlacedItem['rot'] = 0) => out.push({ id: pid(), type, x, y, rot });
  const spread = (n: number, i: number) => (W * (i + 1)) / (n + 1);
  const p = s.pack;

  if (s.noWalls) {
    add('laminateTable', 1.0, 0.7);
    add('chair', 0.5, 1.4);
    add('chair', 1.5, 1.4);
    add('wastebasket', 1.75, 1.75);
    add('plugPoint', 0.25, 0.25);
    return out;
  }

  for (let i = 0; i < (p.counter || 0); i++) add('counter', spread(p.counter!, i), D - 0.5);
  for (let i = 0; i < (p.chair || 0); i++) add('chair', spread(p.chair!, i), D - 1.35);
  for (let i = 0; i < (p.sofa || 0); i++) add('sofa', spread(p.sofa!, i) * (s.id === '3x9' ? 0.45 : 1), s.id === '6x6' ? 1.5 : 1.0);
  for (let i = 0; i < (p.glassTable || 0); i++) add('glassTable', s.id === '3x9' ? W * 0.72 : spread(p.glassTable!, i), s.id === '6x6' ? D / 2 + 0.3 : D / 2);
  for (let i = 0; i < (p.wastebasket || 0); i++) add('wastebasket', i === 0 ? W - 0.4 : 0.4, D - 0.4);
  const n = p.topLight || 0;
  const cap = Math.max(1, Math.floor(W / 0.9));
  const row1 = Math.min(n, cap);
  for (let i = 0; i < row1; i++) add('topLight', spread(row1, i), 0.4);
  const row2 = n - row1;
  for (let i = 0; i < row2; i++) add('topLight', spread(row2, i), Math.min(D / 2 + 0.2, 3));
  const wallSpots: [number, number, PlacedItem['rot']][] = [[0.1, 1.2, 90], [W / 2 + 0.6, 0.1, 0], [W - 0.1, 1.2, 270], [W / 2 - 0.6, 0.1, 0]];
  for (let i = 0; i < (p.plugPoint || 0); i++) add('plugPoint', wallSpots[i][0], wallSpots[i][1], wallSpots[i][2]);
  return out;
}
