import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  RotateCw,
  Copy,
  Trash2,
  Eraser,
  MessageSquare,
  MousePointerClick,
  Info,
  Box,
  LayoutGrid,
  ChevronDown,
} from 'lucide-react';

import { WALL_T, hasWall, CATALOG, CAT, WALL_FIXED, MAX_CUSTOM_H_FT, STALLS, STALL, standardItems } from './builderModel';
import type { ItemType, PlacedItem, WallLayout, BuildStyle } from './builderModel';

const Preview3D = lazy(() => import('./Preview3D'));

// Same framing ratio the 3D preview uses on small screens
const canvasAspect = (s: { w: number; d: number }) => Math.min(1.8, Math.max(1, (s.w / s.d) * 0.7));

// ---------- Model ----------
const SNAP = 0.05;
const STORAGE_KEY = 'rz-builder-v3';
const SHELL_WHITE = '#f8fafc';

const LAYOUTS: { id: WallLayout; label: string; hint: string }[] = [
  { id: 'none', label: 'Open', hint: 'No walls' },
  { id: 'single', label: '1 wall', hint: 'Back wall' },
  { id: 'corner', label: '2 walls', hint: 'Back + left' },
  { id: 'three', label: '3 walls', hint: 'Back + sides' },
];

const WALL_COLORS = [
  { name: 'White', value: '#f8fafc' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Black', value: '#1f2937' },
];
const FLOOR_COLORS = [
  { name: 'Grey carpet', value: '#d1d5db' },
  { name: 'Blue carpet', value: '#bfdbfe' },
  { name: 'Red carpet', value: '#fecaca' },
  { name: 'Black carpet', value: '#9ca3af' },
  { name: 'Wooden floor', value: '#e7d3b4' },
];

const WOOD = '#b07a43';
const WOOD_LIGHT = '#d8b184';

const snap = (v: number) => Math.round(v / SNAP) * SNAP;

function extents(it: PlacedItem) {
  const c = CAT[it.type];
  const sideways = it.rot === 90 || it.rot === 270;
  return { hw: (sideways ? c.d : c.w) / 2, hh: (sideways ? c.w : c.d) / 2 };
}

interface Ctx {
  layout: WallLayout;
  W: number; // frontage (open side), metres
  D: number; // depth, metres
}

function clampItem(it: PlacedItem, c: Ctx): PlacedItem {
  const w = hasWall(c.layout);
  const { hw, hh } = extents(it);
  const minX = (w.left ? WALL_T : 0) + hw;
  const maxX = c.W - (w.right ? WALL_T : 0) - hw;
  const minY = (w.back ? WALL_T : 0) + hh;
  const maxY = c.D - hh;
  return {
    ...it,
    x: Math.min(maxX, Math.max(minX, it.x)),
    y: Math.min(maxY, Math.max(minY, it.y)),
  };
}

// Wall-mounted items (TV, logo, plug point) jump onto the nearest wall when dropped close to it
function snapToWall(it: PlacedItem, c: Ctx): PlacedItem {
  if (!CAT[it.type].wallMounted) return it;
  const w = hasWall(c.layout);
  const d = CAT[it.type].d;
  const cands: { dist: number; rot: PlacedItem['rot']; x?: number; y?: number }[] = [];
  if (w.back) cands.push({ dist: it.y, rot: 0, y: WALL_T + d / 2 });
  if (w.left) cands.push({ dist: it.x, rot: 90, x: WALL_T + d / 2 });
  if (w.right) cands.push({ dist: c.W - it.x, rot: 270, x: c.W - WALL_T - d / 2 });
  if (cands.length === 0) return it;
  const best = cands.sort((a, b) => a.dist - b.dist)[0];
  if (best.dist > 0.7) return it;
  return clampItem({ ...it, rot: best.rot, x: best.x ?? it.x, y: best.y ?? it.y }, c);
}

let idCounter = 0;
const newId = () => `i${Date.now().toString(36)}${idCounter++}`;

// ---------- Item artwork (local coords, centred, front = +y) ----------
const ItemArt: React.FC<{ type: ItemType; brand: string }> = ({ type, brand }) => {
  const c = CAT[type];
  const w = c.w;
  const d = c.d;
  const stroke = '#374151';
  const sw = 0.012;
  switch (type) {
    case 'counter':
      return (
        <g>
          <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={0.03} fill="#ffffff" stroke={stroke} strokeWidth={sw} />
          <rect x={-w / 2} y={d / 2 - 0.1} width={w} height={0.1} rx={0.03} fill="#e5e7eb" />
          <text y={0.03} textAnchor="middle" fontSize={0.09} fill="#6b7280" fontWeight={700}>COUNTER</text>
        </g>
      );
    case 'table':
      return (
        <g>
          <circle r={w / 2} fill={WOOD_LIGHT} stroke={stroke} strokeWidth={sw} />
          <circle r={w / 2 - 0.06} fill="none" stroke="#ffffff55" strokeWidth={0.02} />
          <text y={0.03} textAnchor="middle" fontSize={0.09} fill="#5b3a12" fontWeight={700}>TABLE</text>
        </g>
      );
    case 'chair':
      return (
        <g>
          <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={0.07} fill="#ffffff" stroke={stroke} strokeWidth={sw} />
          <rect x={-w / 2} y={-d / 2} width={w} height={0.1} rx={0.04} fill="#cbd5e1" />
        </g>
      );
    case 'sofa':
      return (
        <g>
          <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={0.08} fill="#9ca3af" stroke={stroke} strokeWidth={sw} />
          <rect x={-w / 2} y={-d / 2} width={w} height={0.2} rx={0.08} fill="#6b7280" />
          <rect x={-w / 2} y={-d / 2} width={0.16} height={d} rx={0.06} fill="#6b7280" />
          <rect x={w / 2 - 0.16} y={-d / 2} width={0.16} height={d} rx={0.06} fill="#6b7280" />
          <text y={0.12} textAnchor="middle" fontSize={0.09} fill="#1f2937" fontWeight={700}>SOFA</text>
        </g>
      );
    case 'tv':
      return (
        <g>
          <rect x={-w / 2} y={-d / 2} width={w} height={d} fill="#111827" stroke="#000" strokeWidth={0.01} />
          <rect x={-w / 2 + 0.03} y={-d / 2 + 0.02} width={w - 0.06} height={d - 0.04} fill="#38bdf8" />
        </g>
      );
    case 'logo':
      return (
        <g>
          <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={0.02} fill={WOOD} stroke="#6b4423" strokeWidth={0.01} />
          <text y={0.03} textAnchor="middle" fontSize={0.075} fill="#fff7ed" fontWeight={800} letterSpacing={0.01}>
            {(brand || 'YOUR LOGO').toUpperCase().slice(0, 14)}
          </text>
        </g>
      );
    case 'shelf':
      return (
        <g>
          <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={0.02} fill={WOOD_LIGHT} stroke={stroke} strokeWidth={sw} />
          <line x1={-w / 2} x2={w / 2} y1={0} y2={0} stroke="#8a5a2b" strokeWidth={0.012} />
          <text y={0.12} textAnchor="middle" fontSize={0.08} fill="#5b3a12" fontWeight={700}>DISPLAY</text>
        </g>
      );
    case 'rack':
      return (
        <g>
          <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={0.02} fill="#e5e7eb" stroke={stroke} strokeWidth={sw} />
          {[-0.1, 0, 0.1].map((x) => (
            <line key={x} x1={x} x2={x} y1={-d / 2 + 0.03} y2={d / 2 - 0.03} stroke="#9ca3af" strokeWidth={0.015} />
          ))}
        </g>
      );
    case 'highTable':
      return (
        <g>
          <circle r={w / 2} fill="#dbeafe" stroke={stroke} strokeWidth={sw} />
          <circle r={w / 2 - 0.05} fill="none" stroke="#ffffffaa" strokeWidth={0.02} />
          <circle r={0.04} fill="#9ca3af" />
          <text y={0.1} textAnchor="middle" fontSize={0.06} fill="#1e3a8a" fontWeight={700}>HIGH</text>
        </g>
      );
    case 'barStool':
      return (
        <g>
          <circle r={w / 2} fill="#4b5563" stroke={stroke} strokeWidth={sw} />
          <circle r={w / 2 - 0.07} fill="#6b7280" />
          <path d={`M ${-w / 2 + 0.04} ${-d / 2 + 0.06} Q 0 ${-d / 2 - 0.02} ${w / 2 - 0.04} ${-d / 2 + 0.06}`} fill="none" stroke="#1f2937" strokeWidth={0.05} strokeLinecap="round" />
        </g>
      );
    case 'lightLogo':
      return (
        <g>
          <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={0.02} fill="#1f2937" stroke="#fbbf24" strokeWidth={0.012} />
          <text y={0.03} textAnchor="middle" fontSize={0.075} fill="#fde68a" fontWeight={800} letterSpacing={0.01}>
            {(brand || 'LIGHT LOGO').toUpperCase().slice(0, 12)}
          </text>
        </g>
      );
    case 'octanormTable':
      return (
        <g>
          <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={0.02} fill="#ffffff" stroke={stroke} strokeWidth={sw} />
          <rect x={-w / 2} y={d / 2 - 0.09} width={w} height={0.09} fill="#2563eb" />
          <text y={0.02} textAnchor="middle" fontSize={0.07} fill="#6b7280" fontWeight={700}>OCTANORM</text>
        </g>
      );
    case 'topLight':
      return (
        <g>
          <circle r={w / 2} fill="#fef3c7" stroke="#f59e0b" strokeWidth={0.02} />
          <circle r={0.07} fill="#f59e0b" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <line key={a} x1={Math.cos((a * Math.PI) / 180) * 0.14} y1={Math.sin((a * Math.PI) / 180) * 0.14} x2={Math.cos((a * Math.PI) / 180) * 0.2} y2={Math.sin((a * Math.PI) / 180) * 0.2} stroke="#f59e0b" strokeWidth={0.018} />
          ))}
        </g>
      );
    case 'glassTable':
      return (
        <g>
          <circle r={w / 2} fill="#dbeafe" fillOpacity={0.7} stroke="#0369a1" strokeWidth={sw} />
          <circle r={w / 2 - 0.06} fill="none" stroke="#ffffffcc" strokeWidth={0.02} />
          <text y={0.03} textAnchor="middle" fontSize={0.08} fill="#075985" fontWeight={700}>GLASS</text>
        </g>
      );
    case 'wastebasket':
      return (
        <g>
          <circle r={w / 2} fill="#9ca3af" stroke={stroke} strokeWidth={sw} />
          <circle r={w / 2 - 0.03} fill="#d1d5db" />
        </g>
      );
    case 'plugPoint':
      return (
        <g>
          <rect x={-w / 2} y={-d / 2} width={w} height={d} fill="#ffffff" stroke="#b45309" strokeWidth={0.01} />
          <text y={-0.06} textAnchor="middle" fontSize={0.06} fill="#b45309" fontWeight={800}>15A</text>
        </g>
      );
    case 'steelChair':
      return (
        <g>
          <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={0.05} fill="#111827" stroke={stroke} strokeWidth={sw} />
          <rect x={-w / 2} y={-d / 2} width={w} height={0.08} rx={0.03} fill="#374151" />
        </g>
      );
    case 'laminateTable':
      return (
        <g>
          <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={0.02} fill="#f3e8d6" stroke={stroke} strokeWidth={sw} />
          <text y={0.03} textAnchor="middle" fontSize={0.08} fill="#7a5a2b" fontWeight={700}>TABLE</text>
        </g>
      );
    case 'centreTable':
      return (
        <g>
          <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={0.04} fill="#e5e7eb" stroke={stroke} strokeWidth={sw} />
          <rect x={-w / 2 + 0.07} y={-d / 2 + 0.07} width={w - 0.14} height={d - 0.14} fill="none" stroke="#9ca3af" strokeWidth={0.01} />
          <text y={0.03} textAnchor="middle" fontSize={0.08} fill="#4b5563" fontWeight={700}>CENTRE</text>
        </g>
      );
    case 'lockableTable':
      return (
        <g>
          <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={0.02} fill="#e5e7eb" stroke={stroke} strokeWidth={sw} />
          <circle cx={0} cy={d / 2 - 0.08} r={0.03} fill="#374151" />
          <text y={0.03} textAnchor="middle" fontSize={0.07} fill="#4b5563" fontWeight={700}>LOCKABLE</text>
        </g>
      );
    case 'showcaseH':
      return (
        <g>
          <rect x={-w / 2} y={-d / 2} width={w} height={d} fill="#dff1ff" stroke={stroke} strokeWidth={sw} />
          <line x1={-w / 2} y1={-d / 2} x2={w / 2} y2={d / 2} stroke="#ffffffcc" strokeWidth={0.03} />
          <text y={0.03} textAnchor="middle" fontSize={0.07} fill="#1e3a8a" fontWeight={700}>SHOWCASE</text>
        </g>
      );
    case 'showcaseV':
      return (
        <g>
          <rect x={-w / 2} y={-d / 2} width={w} height={d} fill="#dff1ff" stroke={stroke} strokeWidth={sw} />
          <line x1={-w / 2} y1={-d / 2} x2={w / 2} y2={d / 2} stroke="#1e3a8a55" strokeWidth={0.01} />
          <line x1={w / 2} y1={-d / 2} x2={-w / 2} y2={d / 2} stroke="#1e3a8a55" strokeWidth={0.01} />
        </g>
      );
    case 'glassShelf':
      return (
        <g>
          <rect x={-w / 2} y={-d / 2} width={w} height={d} fill="#e0f2fe" stroke="#0369a1" strokeWidth={sw} />
          <line x1={-w / 2} x2={w / 2} y1={0} y2={0} stroke="#0369a155" strokeWidth={0.01} />
          <text y={0.1} textAnchor="middle" fontSize={0.07} fill="#075985" fontWeight={700}>GLASS</text>
        </g>
      );
    case 'garmentRack':
      return (
        <g>
          <rect x={-w / 2} y={-d / 2} width={w} height={d} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray="0.05 0.03" />
          {[-0.35, -0.12, 0.12, 0.35].map((x) => (
            <circle key={x} cx={x} cy={0} r={0.05} fill="#9ca3af" />
          ))}
          <line x1={-w / 2 + 0.05} x2={w / 2 - 0.05} y1={0} y2={0} stroke="#6b7280" strokeWidth={0.015} />
        </g>
      );
    case 'queueManager':
      return (
        <g>
          <line x1={-w / 2 + 0.07} x2={w / 2 - 0.07} y1={0} y2={0} stroke="#ef4444" strokeWidth={0.03} />
          <circle cx={-w / 2 + 0.07} cy={0} r={0.07} fill="#9ca3af" stroke={stroke} strokeWidth={0.01} />
          <circle cx={w / 2 - 0.07} cy={0} r={0.07} fill="#9ca3af" stroke={stroke} strokeWidth={0.01} />
        </g>
      );
    case 'halogen50':
    case 'halogen100':
      return (
        <g>
          <circle r={w / 2} fill="#fde68a" stroke="#d97706" strokeWidth={0.02} />
          <text y={0.04} textAnchor="middle" fontSize={0.09} fill="#92400e" fontWeight={800}>
            {type === 'halogen50' ? '50W' : '100W'}
          </text>
        </g>
      );
    case 'plant':
      return (
        <g>
          <circle r={w / 2} fill="#bbf7d0" stroke="#15803d" strokeWidth={sw} />
          <circle r={w / 2 - 0.07} fill="#22c55e" />
          <circle r={0.05} fill="#7c4a1d" />
        </g>
      );
  }
};

const PaletteIcon: React.FC<{ type: ItemType }> = ({ type }) => {
  const c = CAT[type];
  const side = Math.max(c.w, c.d, 0.45) + 0.1;
  return (
    <svg width={42} height={42} viewBox={`${-side / 2} ${-side / 2} ${side} ${side}`} aria-hidden>
      <ItemArt type={type} brand="LOGO" />
    </svg>
  );
};

// ---------- Page ----------
interface BuilderPageProps {
  onRequestQuote: (summary: string) => void;
}

export const BuilderPage: React.FC<BuilderPageProps> = ({ onRequestQuote }) => {
  const saved = useMemo(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, []);
  const initStall = STALL[saved.stallId] || STALL['3x3'];
  const [stallId, setStallId] = useState<string>(initStall.id);
  const [style, setStyle] = useState<BuildStyle>(saved.style || 'shell');
  const [stallNo, setStallNo] = useState<string>(typeof saved.stallNo === 'string' ? saved.stallNo : '');
  const [layout, setLayout] = useState<WallLayout>(saved.layout || (initStall.noWalls ? 'none' : 'three'));
  const [wallColor, setWallColor] = useState<string>(saved.wallColor || WALL_COLORS[0].value);
  const [floorColor, setFloorColor] = useState<string>(saved.floorColor || FLOOR_COLORS[0].value);
  const [brand, setBrand] = useState<string>(typeof saved.brand === 'string' ? saved.brand : '');
  const [items, setItems] = useState<PlacedItem[]>(Array.isArray(saved.items) ? saved.items : standardItems(initStall));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'2d' | '3d'>('2d');
  const [tab, setTab] = useState<'setup' | 'items' | 'style'>('setup');

  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  // Persist (best-effort)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ stallId, style, stallNo, layout, wallColor, floorColor, brand, items }));
    } catch {
      /* ignore */
    }
  }, [stallId, style, stallNo, layout, wallColor, floorColor, brand, items]);

  const stall = STALL[stallId];
  const W = stall.w;
  const D = stall.d;
  const ctx: Ctx = { layout, W, D };

  const shell = style === 'shell';
  const effWall = shell ? SHELL_WHITE : wallColor;
  const walls = hasWall(layout);
  const selected = items.find((i) => i.id === selectedId) || null;

  const toWorld = (clientX: number, clientY: number) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x, y: p.y };
  };

  const addItem = (type: ItemType, at?: { x: number; y: number }) => {
    const c = CAT[type];
    const n = items.filter((i) => i.type === type).length;
    const base: PlacedItem = {
      id: newId(),
      type,
      x: at ? at.x : W / 2 + ((n % 3) - 1) * 0.3,
      y: at ? at.y : c.wallMounted ? 0.2 : D / 2 + Math.floor(n / 3) * 0.3,
      rot: 0,
    };
    const placed = snapToWall(clampItem({ ...base, x: snap(base.x), y: snap(base.y) }, ctx), ctx);
    setItems((prev) => [...prev, placed]);
    setSelectedId(placed.id);
  };

  const updateItem = (id: string, fn: (it: PlacedItem) => PlacedItem) =>
    setItems((prev) => prev.map((i) => (i.id === id ? fn(i) : i)));

  const changeLayout = (l: WallLayout) => {
    setLayout(l);
    setItems((prev) => prev.map((i) => snapToWall(clampItem(i, { layout: l, W, D }), { layout: l, W, D })));
  };

  const loadStandard = (s = stall) => {
    setStyle('shell');
    setLayout(s.noWalls ? 'none' : 'three');
    setWallColor(SHELL_WHITE);
    setFloorColor(FLOOR_COLORS[0].value);
    setItems(standardItems(s).map((i) => ({ ...i, id: newId() })));
    setSelectedId(null);
  };

  const changeStall = (id: string) => {
    if (id === stallId) return;
    setStallId(id);
    loadStandard(STALL[id]);
  };

  const rotate = () => {
    if (!selected) return;
    updateItem(selected.id, (i) => clampItem({ ...i, rot: (((i.rot + 90) % 360) as PlacedItem['rot']) }, ctx));
  };
  const duplicate = () => {
    if (!selected) return;
    const copy = clampItem({ ...selected, id: newId(), x: selected.x + 0.25, y: selected.y + 0.25 }, ctx);
    setItems((prev) => [...prev, copy]);
    setSelectedId(copy.id);
  };
  const remove = () => {
    if (!selected) return;
    setItems((prev) => prev.filter((i) => i.id !== selected.id));
    setSelectedId(null);
  };

  const removeOne = (type: ItemType) => {
    const last = [...items].reverse().find((i) => i.type === type);
    if (!last) return;
    setItems((prev) => prev.filter((i) => i.id !== last.id));
    if (selectedId === last.id) setSelectedId(null);
  };

  // Keyboard: Delete removes, R rotates
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!selected) return;
      if (e.key === 'Delete' || e.key === 'Backspace') remove();
      if (e.key.toLowerCase() === 'r') rotate();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Drag handling on the SVG
  const onItemPointerDown = (e: React.PointerEvent, it: PlacedItem) => {
    e.stopPropagation();
    setSelectedId(it.id);
    const p = toWorld(e.clientX, e.clientY);
    drag.current = { id: it.id, dx: p.x - it.x, dy: p.y - it.y };
    svgRef.current?.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toWorld(e.clientX, e.clientY);
    updateItem(d.id, (i) => clampItem({ ...i, x: snap(p.x - d.dx), y: snap(p.y - d.dy) }, ctx));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d) updateItem(d.id, (i) => snapToWall(i, ctx));
  };

  // Palette drag & drop (desktop); click also adds (touch friendly)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('text/plain') as ItemType;
    if (!CAT[type]) return;
    const p = toWorld(e.clientX, e.clientY);
    addItem(type, p);
  };

  const summary = useMemo(() => {
    const counts = new Map<ItemType, number>();
    items.forEach((i) => counts.set(i.type, (counts.get(i.type) || 0) + 1));
    return CATALOG.filter((c) => counts.has(c.type)).map((c) => {
      const qty = counts.get(c.type)!;
      const inc = stall.pack[c.type] || 0;
      const extra = Math.max(0, qty - inc);
      let cost = 0;
      let note = '';
      if (c.rate) {
        cost = extra * c.rate;
        note = extra === 0 ? 'included' : inc ? `${inc} included, ${extra} extra` : `${c.ref}`;
      } else if (inc) {
        note = extra === 0 ? 'included' : `${extra} extra: on request`;
      } else {
        note = 'custom item: quoted';
      }
      return { ...c, qty, cost, note };
    });
  }, [items, stall]);

  const rentTotal = summary.reduce((s, l) => s + l.cost, 0);
  const inr = (n: number) => '₹' + n.toLocaleString('en-IN');

  const warnings = useMemo(() => {
    const w: string[] = [];
    if (shell) {
      WALL_FIXED.forEach((ty) => {
        if (items.some((i) => i.type === ty)) {
          w.push(`${CAT[ty].label} must be fixed on the wall. Drilling, sticking or hanging on shell panels is not allowed. Switch to Custom build to use it.`);
        }
      });
      if (stall.noWalls) {
        w.push('Startup booths have no panel walls, fascia or spot lights. Plan standees and displays to fit within 2 × 2 m.');
      } else if (layout !== 'three') {
        w.push('Standard shell stalls have 3 enclosed sides and one open front.');
      }
      if (stall.centrePost) w.push('The centre post shown on the front is part of the structure and cannot be removed.');
    } else {
      w.push(`Custom stalls: maximum height ${MAX_CUSTOM_H_FT} ft, build only inside your allotted stall.`);
    }
    w.push('Graphics must be vinyl printing only (no stickers). Vinyl on furniture is removed by the exhibitor.');
    return w;
  }, [items, shell, layout, stall]);

  const requestQuote = () => {
    const layoutLabel = LAYOUTS.find((l) => l.id === layout)!.label;
    const fc = FLOOR_COLORS.find((c) => c.value === floorColor)?.name || 'Custom';
    const wc = shell ? 'White panels' : WALL_COLORS.find((c) => c.value === wallColor)?.name || 'Custom';
    const list = summary.map((s) => `${s.qty} x ${s.label}`).join(', ') || 'none';
    onRequestQuote(
      `Custom stall designed in the builder. Size: ${W}m x ${D}m (${stall.area}). Build style: ${shell ? 'Standard shell scheme' : 'Custom build'}. Layout: ${layoutLabel}. Wall colour: ${wc}. Floor: ${fc}.` +
        (brand ? ` Company name: ${brand}.` : '') +
        (stallNo ? ` Stall no: ${stallNo}.` : '') +
        ` Items: ${list}.` +
        (rentTotal ? ` Estimated add-on rent: ${inr(rentTotal)} + GST.` : '')
    );
  };

  const vb = `${-0.4} ${-0.4} ${W + 0.8} ${D + 0.8}`;
  const gridX = Array.from({ length: Math.max(0, Math.ceil(W) - 1) }, (_, i) => i + 1);
  const gridY = Array.from({ length: Math.max(0, Math.ceil(D) - 1) }, (_, i) => i + 1);

  const arStyle = { ['--ar' as string]: `${W + 0.8} / ${D + 0.8}` } as React.CSSProperties;
  const arStyle3d = { ['--ar' as string]: String(canvasAspect(stall)) } as React.CSSProperties;

  const tabs = [
    { id: 'setup', label: 'Setup' },
    { id: 'items', label: 'Items' },
    { id: 'style', label: 'Style' },
  ] as const;

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col bg-[#FAF9F5] text-brand-dark">
      {/* Slim header */}
      <header className="shrink-0 z-40 bg-white border-b border-gray-200/90">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          <a href="#/" className="flex items-center gap-3">
            <img src="/logo.png" alt="Reworkzone" className="h-8 w-auto" />
            <span className="hidden sm:block text-xs font-bold tracking-widest uppercase border-l border-brand-subtle pl-3">
              Stall Builder
            </span>
          </a>
          <div className="flex items-center gap-2">
            <a
              href="#/"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-700 hover:text-brand-dark rounded-lg hover:bg-black/5"
            >
              <ArrowLeft className="w-4 h-4" />
              Portfolio
            </a>
            <button
              onClick={requestQuote}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-red hover:bg-brand-dark text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Get quote
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 flex flex-col max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-4">
        <div className="shrink-0 mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
          <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight">Design your {stall.label} stall.</h1>
          <p className="text-xs sm:text-sm text-gray-600 flex items-center gap-1.5">
            <MousePointerClick className="w-4 h-4 text-brand-red" />
            Click or drag items onto the plan. 1 grid square = 1 m.
          </p>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)_310px] lg:grid-rows-[minmax(0,1fr)]">
          {/* LEFT: toolbox with tabs */}
          <aside className="order-2 lg:order-none flex flex-col min-h-0 bg-white border border-brand-subtle rounded-2xl overflow-hidden">
            <div className="shrink-0 grid grid-cols-3 border-b border-brand-subtle">
              {tabs.map((tb) => (
                <button
                  key={tb.id}
                  onClick={() => setTab(tb.id)}
                  className={`py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
                    tab === tb.id ? 'border-brand-red text-brand-dark' : 'border-transparent text-gray-500 hover:text-brand-dark'
                  }`}
                >
                  {tb.label}
                </button>
              ))}
            </div>

            <ScrollPane resetKey={tab} className="p-4 space-y-5">
              {tab === 'setup' && (
                <>
                  <section className="space-y-2">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Stall size</h2>
                    <div className="grid grid-cols-2 gap-2">
                      {STALLS.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => changeStall(s.id)}
                          className={`rounded-xl px-3 py-2 text-left border transition-colors ${
                            stallId === s.id ? 'bg-brand-dark text-white border-brand-dark' : 'bg-white border-brand-subtle hover:bg-brand-surface'
                          } ${s.noWalls ? 'col-span-2' : ''}`}
                        >
                          <div className="text-sm font-bold">{s.label}</div>
                          <div className={`text-[11px] ${stallId === s.id ? 'text-gray-300' : 'text-gray-500'}`}>{s.area}</div>
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-500 leading-snug">{stall.note}</p>
                  </section>

                  <section className="space-y-2">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Build style</h2>
                    <div className="grid grid-cols-2 gap-2">
                      {([['shell', 'Shell scheme', 'Standard package'], ['custom', 'Custom build', 'Own design']] as const).map(([id, l, h]) => (
                        <button
                          key={id}
                          onClick={() => setStyle(id)}
                          className={`rounded-xl px-3 py-2 text-left border transition-colors ${
                            style === id ? 'bg-brand-dark text-white border-brand-dark' : 'bg-white border-brand-subtle hover:bg-brand-surface'
                          }`}
                        >
                          <div className="text-sm font-bold">{l}</div>
                          <div className={`text-[11px] ${style === id ? 'text-gray-300' : 'text-gray-500'}`}>{h}</div>
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => loadStandard()}
                      className="w-full px-3 py-2 rounded-xl border border-brand-red text-brand-red hover:bg-brand-red hover:text-white text-xs font-bold transition-colors"
                    >
                      Load standard {stall.label} package
                    </button>
                  </section>

                  <section className="space-y-2">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Walls</h2>
                    <div className="grid grid-cols-2 gap-2">
                      {LAYOUTS.map((l) => (
                        <button
                          key={l.id}
                          onClick={() => changeLayout(l.id)}
                          disabled={stall.noWalls}
                          className={`rounded-xl px-3 py-2 text-left border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                            layout === l.id
                              ? 'bg-brand-dark text-white border-brand-dark'
                              : 'bg-white border-brand-subtle hover:bg-brand-surface'
                          }`}
                        >
                          <div className="text-sm font-bold">{l.label}</div>
                          <div className={`text-[11px] ${layout === l.id ? 'text-gray-300' : 'text-gray-500'}`}>{l.hint}</div>
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              )}

              {tab === 'items' && (
                <section>
                  <p className="text-[11px] text-gray-500 mb-3">Click to add, or drag onto the plan.</p>
                  {(['Furniture', 'Lighting & power', 'Branding & decor'] as const).map((grp) => (
                    <div key={grp} className="mb-4 last:mb-0">
                      <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{grp}</div>
                      <div className="grid grid-cols-3 gap-2">
                        {CATALOG.filter((c) => c.group === grp).map((c) => (
                          <button
                            key={c.type}
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData('text/plain', c.type)}
                            onClick={() => addItem(c.type)}
                            title={`Click or drag to add ${c.label}${c.ref ? ` (${c.ref})` : ''}`}
                            className="flex flex-col items-center gap-1 rounded-xl border border-brand-subtle bg-white hover:bg-brand-surface hover:border-brand-dark px-1.5 py-2 cursor-grab active:cursor-grabbing transition-colors"
                          >
                            <PaletteIcon type={c.type} />
                            <span className="text-[11px] font-semibold text-gray-700 leading-tight text-center">{c.label}</span>
                            {c.rate ? (
                              <span className="text-[10px] font-bold text-brand-red">{inr(c.rate)}</span>
                            ) : stall.pack[c.type] ? (
                              <span className="text-[10px] font-bold text-emerald-600">in package</span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </section>
              )}

              {tab === 'style' && (
                <section className="space-y-4">
                  <label className="block text-xs font-semibold text-gray-700">
                    Company name (fascia, logos, screens)
                    <input
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      maxLength={14}
                      placeholder="e.g. ACME"
                      className="mt-1 w-full px-3 py-2 bg-white text-sm rounded-lg border border-brand-subtle focus:border-brand-dark outline-none"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-gray-700">
                    Stall number (fascia)
                    <input
                      value={stallNo}
                      onChange={(e) => setStallNo(e.target.value)}
                      maxLength={8}
                      placeholder="e.g. B-12"
                      className="mt-1 w-full px-3 py-2 bg-white text-sm rounded-lg border border-brand-subtle focus:border-brand-dark outline-none"
                    />
                  </label>
                  {shell ? (
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      Shell scheme panels are white. Choose Custom build (Setup tab) for wall colours.
                    </p>
                  ) : (
                    <Swatches label="Wall colour" options={WALL_COLORS} value={wallColor} onChange={setWallColor} />
                  )}
                  <Swatches label="Floor" options={FLOOR_COLORS} value={floorColor} onChange={setFloorColor} />
                </section>
              )}
            </ScrollPane>
          </aside>

          {/* CENTER: canvas */}
          <section className="order-1 lg:order-none flex flex-col min-h-0 gap-3">
            <div className="shrink-0 flex flex-wrap items-center gap-2 min-h-[40px]">
              <div className="inline-flex items-center p-1 bg-white rounded-xl border border-brand-subtle">
                {([['2d', 'Plan (2D)', LayoutGrid], ['3d', '3D preview', Box]] as const).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    onClick={() => setView(id)}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      view === id ? 'bg-brand-dark text-white' : 'text-gray-700 hover:text-black'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>

              {view === '2d' ? (
                <>
                  {selected ? (
                    <>
                      <span className="text-xs font-bold text-gray-600 ml-1">{CAT[selected.type].label}</span>
                      <ToolButton onClick={rotate} icon={<RotateCw className="w-4 h-4" />} label="Rotate" />
                      <ToolButton onClick={duplicate} icon={<Copy className="w-4 h-4" />} label="Copy" />
                      <ToolButton onClick={remove} icon={<Trash2 className="w-4 h-4" />} label="Delete" danger />
                    </>
                  ) : (
                    <span className="text-xs text-gray-500 flex items-center gap-1.5 ml-1">
                      <Info className="w-3.5 h-3.5" /> Click an item to rotate, copy or delete it (or press Delete). You can also use the bin icon in the list on the right.
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setItems([]);
                      setSelectedId(null);
                    }}
                    className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 hover:text-brand-red rounded-lg"
                  >
                    <Eraser className="w-4 h-4" /> Clear all
                  </button>
                </>
              ) : (
                <span className="text-xs text-gray-500 ml-1">Drag to orbit, scroll to zoom. Switch to Plan to move items.</span>
              )}
            </div>

            {view === '3d' && (
              <div className="lg:flex-1 min-h-0 bg-white border border-brand-subtle rounded-2xl p-2 sm:p-3">
                <Suspense fallback={<div className="py-32 text-center text-sm text-gray-500">Loading 3D preview…</div>}>
                  <Preview3D layout={layout} wallColor={effWall} floorColor={floorColor} brand={brand} stallNo={stallNo} shell={shell} stall={stall} items={items} />
                </Suspense>
              </div>
            )}

            <div
              className={`lg:flex-1 min-h-0 bg-white border border-brand-subtle rounded-2xl p-3 flex items-center justify-center ${view === '3d' ? 'hidden' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
            >
              <svg
                ref={svgRef}
                viewBox={vb}
                className="w-full aspect-[var(--ar)] max-h-[70vh] lg:max-h-full lg:aspect-auto lg:h-full select-none touch-none"
                style={arStyle}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onPointerDown={() => setSelectedId(null)}
              >
                {/* floor */}
                <rect x={0} y={0} width={W} height={D} fill={floorColor} stroke="#9ca3af" strokeWidth={0.02} />
                <g stroke="#00000018" strokeWidth={0.01} strokeDasharray="0.05 0.05">
                  {gridX.map((g) => (
                    <line key={`x${g}`} x1={g} x2={g} y1={0} y2={D} />
                  ))}
                  {gridY.map((g) => (
                    <line key={`y${g}`} y1={g} y2={g} x1={0} x2={W} />
                  ))}
                </g>

                {/* walls */}
                {walls.back && <rect x={0} y={0} width={W} height={WALL_T} fill={effWall} stroke="#374151" strokeWidth={0.015} />}
                {walls.left && <rect x={0} y={0} width={WALL_T} height={D} fill={effWall} stroke="#374151" strokeWidth={0.015} />}
                {walls.right && <rect x={W - WALL_T} y={0} width={WALL_T} height={D} fill={effWall} stroke="#374151" strokeWidth={0.015} />}

                {/* open-side label */}
                {stall.centrePost && <circle cx={W / 2} cy={D - 0.06} r={0.06} fill="#6b7280" stroke="#374151" strokeWidth={0.015} />}
                <text x={W / 2} y={D + 0.22} textAnchor="middle" fontSize={0.13} fill="#6b7280" fontWeight={600}>
                  AISLE / VISITOR SIDE · {W} m
                </text>
                <text x={-0.2} y={D / 2} textAnchor="middle" fontSize={0.13} fill="#6b7280" fontWeight={600} transform={`rotate(-90 -0.2 ${D / 2})`}>
                  {D} m
                </text>

                {/* items */}
                {items.map((it) => {
                  const isSel = it.id === selectedId;
                  const { hw, hh } = extents(it);
                  return (
                    <g
                      key={it.id}
                      transform={`translate(${it.x} ${it.y})`}
                      onPointerDown={(e) => onItemPointerDown(e, it)}
                      style={{ cursor: 'grab' }}
                    >
                      <g transform={`rotate(${it.rot})`}>
                        <ItemArt type={it.type} brand={brand} />
                      </g>
                      {isSel && (
                        <rect
                          x={-hw - 0.04}
                          y={-hh - 0.04}
                          width={hw * 2 + 0.08}
                          height={hh * 2 + 0.08}
                          fill="none"
                          stroke="#E53935"
                          strokeWidth={0.025}
                          strokeDasharray="0.08 0.05"
                          rx={0.04}
                          pointerEvents="none"
                        />
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </section>

          {/* RIGHT: summary, with the total and quote button always visible */}
          <aside className="order-3 lg:order-none flex flex-col min-h-0 bg-white border border-brand-subtle rounded-2xl overflow-hidden">
            <ScrollPane className="p-4 space-y-4">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Your stall</h2>
              <dl className="text-sm space-y-1.5">
                <Row k="Size" v={`${stall.label} (${stall.area})`} />
                <Row k="Style" v={shell ? 'Shell scheme' : 'Custom build'} />
                <Row k="Walls" v={LAYOUTS.find((l) => l.id === layout)!.label} />
                <Row k="Wall colour" v={shell ? 'White panels' : WALL_COLORS.find((c) => c.value === wallColor)?.name || ''} />
                <Row k="Floor" v={FLOOR_COLORS.find((c) => c.value === floorColor)?.name || ''} />
              </dl>
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Items & add-on rent</h3>
                {summary.length === 0 ? (
                  <p className="text-sm text-gray-500">Nothing added yet.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {summary.map((s) => (
                      <li key={s.type} className="flex justify-between gap-2">
                        <div>
                          <div>
                            {s.label} <span className="font-bold">× {s.qty}</span>
                          </div>
                          <div className="text-[11px] text-gray-500">{s.note}</div>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-bold text-right whitespace-nowrap">{s.cost ? inr(s.cost) : ''}</span>
                          <button
                            type="button"
                            title={`Remove one ${s.label}`}
                            aria-label={`Remove one ${s.label}`}
                            onClick={() => removeOne(s.type)}
                            className="p-1 rounded-md text-gray-400 hover:text-brand-red hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-1.5">
                <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Exhibitor rules</h3>
                <ul className="space-y-1.5 text-[11px] text-amber-900 leading-snug list-disc pl-4">
                  {warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            </ScrollPane>

            <div className="shrink-0 border-t border-brand-subtle p-4 space-y-2.5 bg-white">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Add-on rent</span>
                <span className="text-xl font-black">{inr(rentTotal)}</span>
              </div>
              <button
                onClick={requestQuote}
                className="w-full inline-flex items-center justify-center gap-2 py-3 bg-brand-red hover:bg-brand-dark text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                Request quote for this design
              </button>
              <p className="text-[11px] text-gray-500 leading-snug">
                Per unit rent for the full event, GST as applicable. Custom items are quoted separately. Based on the Tech Expo Gujarat 2026
                manual; our team confirms the final design and pricing.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

// ---------- Small pieces ----------
// Scrollable pane (desktop): visible scrollbar, edge fades and a "More below" chip while content continues
const ScrollPane: React.FC<{ className?: string; resetKey?: string; children: React.ReactNode }> = ({
  className = '',
  resetKey,
  children,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ top: false, bottom: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdge({
      top: el.scrollTop > 4,
      bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 4,
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ top: 0 });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => ro.disconnect();
  }, [resetKey, update]);

  return (
    <div className="relative flex-1 min-h-0">
      <div ref={ref} onScroll={update} className={`lg:absolute lg:inset-0 lg:overflow-y-auto pane-scroll ${className}`}>
        {children}
      </div>
      <div
        aria-hidden
        className={`hidden lg:block pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white to-transparent transition-opacity duration-200 ${
          edge.top ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        aria-hidden
        className={`hidden lg:block pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white via-white/80 to-transparent transition-opacity duration-200 ${
          edge.bottom ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <button
        type="button"
        tabIndex={edge.bottom ? 0 : -1}
        onClick={() => ref.current?.scrollBy({ top: (ref.current?.clientHeight || 300) * 0.8, behavior: 'smooth' })}
        className={`hidden lg:inline-flex absolute left-1/2 -translate-x-1/2 bottom-2 items-center gap-1 pl-3 pr-2.5 py-1 rounded-full bg-brand-dark text-white text-[11px] font-bold shadow-lg hover:bg-brand-red transition-all duration-200 ${
          edge.bottom ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
      >
        More below
        <ChevronDown className="w-3.5 h-3.5 animate-nudge" />
      </button>
    </div>
  );
};

const Row: React.FC<{ k: string; v: string }> = ({ k, v }) => (
  <div className="flex justify-between gap-3">
    <dt className="text-gray-500">{k}</dt>
    <dd className="font-semibold text-right">{v}</dd>
  </div>
);

const ToolButton: React.FC<{ onClick: () => void; icon: React.ReactNode; label: string; danger?: boolean }> = ({
  onClick,
  icon,
  label,
  danger,
}) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
      danger
        ? 'border-red-200 text-brand-red hover:bg-red-50'
        : 'border-brand-subtle bg-white text-gray-800 hover:bg-brand-surface'
    }`}
  >
    {icon}
    {label}
  </button>
);

const Swatches: React.FC<{
  label: string;
  options: { name: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}> = ({ label, options, value, onChange }) => (
  <div>
    <div className="text-xs font-semibold text-gray-700 mb-1.5">{label}</div>
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          title={o.name}
          aria-label={o.name}
          className={`w-8 h-8 rounded-full border-2 transition-transform ${
            value === o.value ? 'border-brand-red scale-110' : 'border-gray-300 hover:scale-105'
          }`}
          style={{ background: o.value }}
        />
      ))}
    </div>
  </div>
);
