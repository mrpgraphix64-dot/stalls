import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { WALL_T, SHELL_WALL_H, CUSTOM_WALL_H, hasWall } from './builderModel';
import type { PlacedItem, StallDef, WallLayout } from './builderModel';

interface Preview3DProps {
  layout: WallLayout;
  wallColor: string;
  floorColor: string;
  brand: string;
  stallNo: string;
  shell: boolean;
  stall: StallDef;
  items: PlacedItem[];
}

const HALL = '#14171e';

// ---------- helpers ----------
const std = (color: string | number, extra: Partial<THREE.MeshPhysicalMaterialParameters> = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, metalness: 0.0, ...extra });
const gloss = (color: string | number, extra: Partial<THREE.MeshPhysicalMaterialParameters> = {}) =>
  std(color, { roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12, ...extra });
const chrome = () => std('#e5e7eb', { metalness: 1, roughness: 0.12 });
const glow = (color: string, intensity = 2.2) =>
  new THREE.MeshStandardMaterial({ color: '#111', emissive: color, emissiveIntensity: intensity });

function rbox(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0, r = 0.012) {
  const radius = Math.max(0.001, Math.min(r, Math.min(w, h, d) / 2 - 0.0005));
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius), m);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function cyl(rt: number, rb: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 40) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function textTexture(
  text: string,
  w: number,
  h: number,
  bg: string | CanvasGradient | null,
  fg: string,
  font: string,
  grain = false
) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  if (bg) {
    g.fillStyle = bg as string;
    g.fillRect(0, 0, w, h);
  }
  if (grain) {
    g.strokeStyle = 'rgba(70,40,10,0.22)';
    for (let i = 0; i < h / 7; i++) {
      g.beginPath();
      g.moveTo(0, 5 + i * 7);
      g.bezierCurveTo(w * 0.3, i * 7, w * 0.65, 12 + i * 7, w, 5 + i * 7);
      g.stroke();
    }
  }
  g.fillStyle = fg;
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 4, w - 40);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function gradientTexture(w: number, h: number, c1: string, c2: string, text: string) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, w, h);
  grd.addColorStop(0, c1);
  grd.addColorStop(1, c2);
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.beginPath();
  g.arc(w * 0.8, h * 0.2, h * 0.55, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff';
  g.font = '800 64px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2, w - 60);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function carpetTexture(color: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 256);
  const img = g.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 10);
  t.anisotropy = 8;
  return t;
}

// ---------- items (footprint centred on origin, front = +z) ----------
const OVERHEAD = ['topLight', 'halogen50', 'halogen100'];

function buildItem(it: PlacedItem, brand: string, accent: string, wallH: number, W: number, D: number, onWall: boolean): THREE.Group {
  const g = new THREE.Group();
  const label = (brand || 'YOUR BRAND').toUpperCase().slice(0, 14);
  const wood = gloss('#b9824a', { roughness: 0.4, clearcoat: 0.6 });
  const dark = std('#2b303b', { roughness: 0.7 });

  switch (it.type) {
    case 'counter': {
      g.add(rbox(1.0, 0.95, 0.56, gloss('#ffffff', { roughness: 0.3 }), 0, 0, 0, 0.02));
      g.add(rbox(1.07, 0.04, 0.61, std('#f1f5f9', { roughness: 0.25, clearcoat: 1 }), 0, 0.95, 0, 0.015));
      const tex = textTexture(label, 512, 256, accent, '#ffffff', '800 80px Arial, sans-serif');
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.99, 0.63),
        new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.55 })
      );
      panel.position.set(0, 0.48, 0.282);
      g.add(panel);
      g.add(rbox(0.96, 0.014, 0.012, glow(accent, 2.5), 0, 0.03, 0.283, 0.003));
      break;
    }
    case 'table': {
      g.add(cyl(0.35, 0.35, 0.04, wood, 0, 0.72, 0, 64));
      g.add(cyl(0.035, 0.035, 0.72, chrome(), 0, 0, 0, 24));
      g.add(cyl(0.23, 0.25, 0.025, chrome(), 0, 0, 0, 48));
      break;
    }
    case 'chair': {
      const shell = gloss('#ffffff', { roughness: 0.3 });
      g.add(rbox(0.46, 0.07, 0.46, shell, 0, 0.42, 0, 0.03));
      g.add(rbox(0.46, 0.42, 0.06, shell, 0, 0.49, -0.2, 0.03));
      for (const [x, z] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) {
        g.add(cyl(0.014, 0.011, 0.42, chrome(), x, 0, z, 12));
      }
      break;
    }
    case 'sofa': {
      const f = std('#3a4150', { roughness: 0.95 });
      const cu = std('#4a5365', { roughness: 0.95 });
      g.add(rbox(1.5, 0.22, 0.75, f, 0, 0.08, 0, 0.04));
      g.add(rbox(1.5, 0.5, 0.2, f, 0, 0.3, -0.275, 0.06));
      g.add(rbox(0.17, 0.32, 0.75, f, -0.665, 0.3, 0, 0.06));
      g.add(rbox(0.17, 0.32, 0.75, f, 0.665, 0.3, 0, 0.06));
      g.add(rbox(0.58, 0.14, 0.55, cu, -0.29, 0.3, 0.06, 0.05));
      g.add(rbox(0.58, 0.14, 0.55, cu, 0.29, 0.3, 0.06, 0.05));
      g.add(rbox(0.28, 0.28, 0.08, gloss(accent, { roughness: 0.8, clearcoat: 0 }), -0.42, 0.44, -0.12, 0.04));
      for (const x of [-0.65, 0.65]) g.add(cyl(0.02, 0.02, 0.08, chrome(), x, 0, 0.3, 12), cyl(0.02, 0.02, 0.08, chrome(), x, 0, -0.3, 12));
      break;
    }
    case 'tv': {
      g.add(rbox(0.92, 0.54, 0.05, std('#0b0d12', { roughness: 0.3, metalness: 0.4 }), 0, 1.04, 0, 0.01));
      const tex = gradientTexture(640, 360, '#0b1b4d', accent, label);
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.88, 0.5),
        new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.9, roughness: 0.2 })
      );
      screen.position.set(0, 1.3, 0.027);
      g.add(screen);
      break;
    }
    case 'logo': {
      const tex = textTexture(label, 768, 240, '#b07a43', '#fff7ed', '800 108px Arial, sans-serif', true);
      const side = std('#7a4c22', { roughness: 0.6 });
      const front = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.45, clearcoat: 0.5 });
      const geo = new RoundedBoxGeometry(1.0, 0.31, 0.08, 3, 0.012);
      const plank = new THREE.Mesh(geo, [side, side, side, side, front, side]);
      plank.position.set(0, 2.0, 0);
      plank.castShadow = true;
      g.add(plank);
      break;
    }
    case 'shelf': {
      for (const y of [0.05, 0.45, 0.85, 1.22]) g.add(rbox(1.0, 0.035, 0.35, wood, 0, y, 0, 0.01));
      g.add(rbox(0.035, 1.255, 0.35, wood, -0.4825, 0, 0, 0.01));
      g.add(rbox(0.035, 1.255, 0.35, wood, 0.4825, 0, 0, 0.01));
      g.add(rbox(1.0, 1.255, 0.015, std('#e9edf2', { roughness: 0.5 }), 0, 0, -0.17, 0.005));
      for (const y of [0.45, 0.85, 1.22]) g.add(rbox(0.92, 0.01, 0.012, glow('#fff1d0', 2.0), 0, y - 0.012, 0.15, 0.002));
      // little display objects
      g.add(rbox(0.16, 0.2, 0.1, gloss(accent, { roughness: 0.4 }), -0.25, 0.085, 0.02, 0.01));
      g.add(cyl(0.06, 0.06, 0.18, gloss('#ffffff'), 0.2, 0.085, 0.02));
      g.add(rbox(0.22, 0.14, 0.1, gloss('#ffffff'), -0.15, 0.485, 0.02, 0.01));
      g.add(cyl(0.05, 0.05, 0.26, gloss(accent), 0.22, 0.485, 0.02));
      g.add(rbox(0.3, 0.18, 0.1, gloss('#f8fafc'), 0, 0.885, 0.02, 0.01));
      break;
    }
    case 'rack': {
      g.add(rbox(0.42, 1.4, 0.3, std('#dfe4ea', { metalness: 0.6, roughness: 0.3 }), 0, 0, 0, 0.012));
      const cols = [accent, '#f59e0b', '#22c55e', '#ef4444'];
      for (let i = 0; i < 4; i++) g.add(rbox(0.34, 0.22, 0.03, gloss(cols[i], { roughness: 0.5 }), 0, 0.12 + i * 0.32, 0.12, 0.006));
      break;
    }
    case 'highTable': {
      const glass = new THREE.MeshPhysicalMaterial({ color: '#cfe8ff', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.38, clearcoat: 1, clearcoatRoughness: 0.03 });
      g.add(cyl(0.3, 0.3, 0.02, glass, 0, 1.03, 0, 64));
      g.add(cyl(0.305, 0.305, 0.008, chrome(), 0, 1.025, 0, 64));
      g.add(cyl(0.03, 0.03, 1.03, chrome(), 0, 0, 0, 24));
      g.add(cyl(0.22, 0.24, 0.03, chrome(), 0, 0, 0, 48));
      break;
    }
    case 'barStool': {
      const seat = gloss(accent, { roughness: 0.4 });
      g.add(cyl(0.18, 0.18, 0.07, seat, 0, 0.7, 0, 40));
      g.add(rbox(0.3, 0.22, 0.045, seat, 0, 0.77, -0.17, 0.02));
      g.add(cyl(0.025, 0.025, 0.7, chrome(), 0, 0, 0, 16));
      g.add(cyl(0.17, 0.19, 0.025, chrome(), 0, 0, 0, 40));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.01, 8, 32), chrome());
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.25;
      g.add(ring);
      break;
    }
    case 'octanormTable': {
      const tex = textTexture(label, 768, 256, accent, '#ffffff', '800 110px Arial, sans-serif');
      const vinyl = new THREE.Mesh(
        new THREE.PlaneGeometry(0.94, 0.62),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 })
      );
      vinyl.position.set(0, 0.36, 0.254);
      g.add(vinyl);
      g.add(rbox(1.0, 0.74, 0.5, std('#f4f6f9', { roughness: 0.4 }), 0, 0, 0, 0.006));
      g.add(rbox(1.04, 0.035, 0.54, gloss('#ffffff', { roughness: 0.25 }), 0, 0.74, 0, 0.01));
      for (const x of [-0.5, 0.5]) for (const z of [-0.25, 0.25]) g.add(rbox(0.035, 0.775, 0.035, std('#c3cad4', { metalness: 0.85, roughness: 0.25 }), x, 0, z, 0.004));
      break;
    }
    case 'lightLogo': {
      const mk = (blur: number, color: string, alpha: number) => {
        const c = document.createElement('canvas');
        c.width = 1024;
        c.height = 320;
        const cx = c.getContext('2d')!;
        cx.font = '900 150px Arial, sans-serif';
        cx.textAlign = 'center';
        cx.textBaseline = 'middle';
        cx.shadowColor = color;
        cx.shadowBlur = blur;
        cx.fillStyle = color;
        cx.globalAlpha = alpha;
        cx.fillText(label, 512, 165, 960);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
      };
      const layer = (tex: THREE.Texture, z: number, w: number, h: number, opacity = 1) => {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(w, h),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false, toneMapped: false })
        );
        m.position.set(0, 1.9, z);
        return m;
      };
      g.add(layer(mk(60, accent, 0.9), 0.0, 1.2, 0.375, 0.65)); // halo on the wall
      g.add(layer(mk(0, '#3a3f4a', 1), 0.012, 1.0, 0.3125)); // dark acrylic sides
      g.add(layer(mk(0, '#6b7280', 1), 0.024, 1.0, 0.3125));
      const face = mk(8, '#ffffff', 1);
      g.add(layer(face, 0.038, 1.0, 0.3125)); // glowing face
      g.add(layer(face, 0.04, 1.0, 0.3125));
      break;
    }
    case 'topLight':
    case 'halogen50':
    case 'halogen100': {
      const power = it.type === 'halogen100' ? 14 : it.type === 'halogen50' ? 9 : 8;
      const big = it.type === 'topLight' ? 1 : 1.25;
      const lens = it.type === 'topLight' ? '#fff3d6' : '#f2f7ff';
      g.add(cyl(0.006, 0.006, 0.32, std('#111827'), 0, wallH - 0.38, 0, 6));
      g.add(cyl(0.09 * big, 0.11 * big, 0.14, std('#1f2937', { metalness: 0.6, roughness: 0.35 }), 0, wallH - 0.52, 0, 24));
      g.add(cyl(0.085 * big, 0.085 * big, 0.012, glow(lens, 5), 0, wallH - 0.528, 0, 24));
      const sp = new THREE.SpotLight(it.type === 'topLight' ? '#fff0d4' : '#f2f7ff', power, 7, 0.75, 0.9, 2);
      sp.position.set(0, wallH - 0.54, 0);
      sp.target.position.set(0, 0, 0);
      g.add(sp, sp.target);
      break;
    }
    case 'glassTable': {
      const glassM = new THREE.MeshPhysicalMaterial({ color: '#cfe8ff', roughness: 0.04, transparent: true, opacity: 0.42, clearcoat: 1, clearcoatRoughness: 0.03 });
      g.add(cyl(0.4, 0.4, 0.02, glassM, 0, 0.74, 0, 64));
      g.add(cyl(0.405, 0.405, 0.008, chrome(), 0, 0.735, 0, 64));
      g.add(cyl(0.03, 0.03, 0.74, chrome(), 0, 0, 0, 24));
      g.add(cyl(0.26, 0.28, 0.025, chrome(), 0, 0, 0, 48));
      break;
    }
    case 'wastebasket':
      g.add(cyl(0.125, 0.1, 0.3, std('#9ca3af', { roughness: 0.5 }), 0, 0, 0, 32));
      g.add(cyl(0.112, 0.112, 0.006, std('#374151'), 0, 0.3, 0, 32));
      break;
    case 'plugPoint':
      if (!onWall) {
        g.add(rbox(0.14, 0.2, 0.1, std('#374151', { roughness: 0.5 }), 0, 0, 0, 0.01));
        g.add(rbox(0.1, 0.07, 0.01, std('#f8fafc'), 0, 0.1, 0.055, 0.003));
        g.add(rbox(0.02, 0.012, 0.006, glow('#fb923c', 3), 0, 0.06, 0.06, 0.002));
        break;
      }
      g.add(rbox(0.12, 0.12, 0.016, std('#f8fafc', { roughness: 0.4 }), 0, 0.3, 0, 0.005));
      g.add(rbox(0.04, 0.05, 0.006, std('#111827'), -0.025, 0.335, 0.011, 0.002));
      g.add(rbox(0.04, 0.05, 0.006, std('#111827'), 0.025, 0.335, 0.011, 0.002));
      g.add(rbox(0.02, 0.012, 0.006, glow('#fb923c', 3), 0, 0.28, 0.011, 0.002));
      break;
    case 'steelChair': {
      const sh = std('#1f2937', { roughness: 0.45, metalness: 0.3 });
      g.add(rbox(0.46, 0.05, 0.46, sh, 0, 0.44, 0, 0.02));
      g.add(rbox(0.46, 0.4, 0.04, sh, 0, 0.49, -0.21, 0.02));
      for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) g.add(cyl(0.013, 0.013, 0.44, chrome(), x, 0, z, 12));
      break;
    }
    case 'laminateTable':
      g.add(rbox(1.2, 0.035, 0.6, std('#f1e6d3', { roughness: 0.4, clearcoat: 0.4 }), 0, 0.72, 0, 0.01));
      for (const x of [-0.56, 0.56]) for (const z of [-0.26, 0.26]) g.add(cyl(0.017, 0.017, 0.72, chrome(), x, 0, z, 12));
      break;
    case 'centreTable':
      g.add(rbox(0.8, 0.04, 0.8, gloss('#eef1f5', { roughness: 0.2 }), 0, 0.4, 0, 0.012));
      g.add(rbox(0.7, 0.025, 0.7, std('#cfd6df', { roughness: 0.4 }), 0, 0.12, 0, 0.008));
      for (const x of [-0.36, 0.36]) for (const z of [-0.36, 0.36]) g.add(cyl(0.017, 0.017, 0.4, chrome(), x, 0, z, 12));
      break;
    case 'lockableTable':
      g.add(rbox(1.0, 0.86, 0.5, std('#e9ecf1', { roughness: 0.4 }), 0, 0, 0, 0.01));
      g.add(rbox(1.04, 0.035, 0.54, gloss('#ffffff', { roughness: 0.25 }), 0, 0.86, 0, 0.01));
      g.add(rbox(0.01, 0.74, 0.004, std('#9ca3af'), 0, 0.06, 0.252, 0.001));
      const knob = cyl(0.018, 0.018, 0.012, chrome(), 0.05, 0.42, 0.26, 16);
      knob.rotation.x = Math.PI / 2;
      g.add(knob);
      break;
    case 'showcaseH': {
      const glassM = new THREE.MeshPhysicalMaterial({ color: '#d6ecff', roughness: 0.04, transparent: true, opacity: 0.28, clearcoat: 1 });
      g.add(rbox(1.0, 0.82, 0.5, std('#f4f6f9', { roughness: 0.4 }), 0, 0, 0, 0.01));
      g.add(rbox(0.96, 0.24, 0.46, glassM, 0, 0.82, 0, 0.004));
      g.add(rbox(1.0, 0.02, 0.5, std('#c3cad4', { metalness: 0.85, roughness: 0.25 }), 0, 1.06, 0, 0.004));
      g.add(rbox(0.9, 0.01, 0.02, glow('#fff1d0', 2.2), 0, 1.04, 0.15, 0.002));
      break;
    }
    case 'showcaseV': {
      const glassM = new THREE.MeshPhysicalMaterial({ color: '#d6ecff', roughness: 0.04, transparent: true, opacity: 0.25, clearcoat: 1 });
      g.add(rbox(0.5, 0.3, 0.4, std('#f4f6f9', { roughness: 0.4 }), 0, 0, 0, 0.01));
      g.add(rbox(0.48, 1.6, 0.38, glassM, 0, 0.3, 0, 0.004));
      for (const y of [0.7, 1.1, 1.5]) g.add(rbox(0.46, 0.012, 0.36, glassM, 0, y, 0, 0.002));
      g.add(rbox(0.5, 0.06, 0.4, std('#f4f6f9', { roughness: 0.4 }), 0, 1.9, 0, 0.01));
      for (const x of [-0.24, 0.24]) for (const z of [-0.19, 0.19]) g.add(rbox(0.015, 1.6, 0.015, std('#c3cad4', { metalness: 0.85, roughness: 0.25 }), x, 0.3, z, 0.003));
      break;
    }
    case 'glassShelf': {
      const glassM = new THREE.MeshPhysicalMaterial({ color: '#cfe8ff', roughness: 0.04, transparent: true, opacity: 0.4, clearcoat: 1 });
      for (const x of [-0.47, 0.47]) for (const z of [-0.15, 0.15]) g.add(cyl(0.012, 0.012, 1.2, chrome(), x, 0, z, 12));
      for (const y of [0.3, 0.7, 1.1]) g.add(rbox(1.0, 0.012, 0.35, glassM, 0, y, 0, 0.003));
      break;
    }
    case 'garmentRack': {
      for (const x of [-0.45, 0.45]) {
        g.add(cyl(0.014, 0.014, 1.5, chrome(), x, 0, 0, 12));
        g.add(rbox(0.05, 0.02, 0.5, chrome(), x, 0, 0, 0.004));
      }
      const bar = cyl(0.012, 0.012, 0.9, chrome(), 0, 1.5, 0, 12);
      bar.rotation.z = Math.PI / 2;
      g.add(bar);
      const cols = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];
      cols.forEach((c, i) => g.add(rbox(0.1, 0.62, 0.3, std(c, { roughness: 0.9 }), -0.36 + i * 0.145, 0.86, 0, 0.02)));
      break;
    }
    case 'queueManager': {
      for (const x of [-0.55, 0.55]) {
        g.add(cyl(0.025, 0.025, 0.9, chrome(), x, 0, 0, 12));
        g.add(cyl(0.07, 0.07, 0.02, chrome(), x, 0, 0, 24));
        g.add(cyl(0.035, 0.035, 0.03, chrome(), x, 0.9, 0, 16));
      }
      g.add(rbox(1.1, 0.05, 0.008, gloss('#dc2626', { roughness: 0.5 }), 0, 0.72, 0, 0.002));
      break;
    }
    case 'plant': {
      g.add(cyl(0.17, 0.12, 0.32, gloss('#f8fafc'), 0, 0, 0, 40));
      g.add(cyl(0.015, 0.02, 0.35, std('#6b4423'), 0, 0.3, 0, 8));
      const leafM = [std('#1f9d4d', { roughness: 0.6 }), std('#2fb85f', { roughness: 0.6 }), std('#177a3b', { roughness: 0.6 })];
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), leafM[i % 3]);
        leaf.scale.set(0.9, 1.5, 0.35);
        leaf.position.set(Math.cos(a) * 0.12, 0.62 + (i % 3) * 0.09, Math.sin(a) * 0.12);
        leaf.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
        leaf.castShadow = true;
        g.add(leaf);
      }
      break;
    }
  }
  g.position.set(it.x - W / 2, 0, it.y - D / 2);
  g.rotation.y = (-it.rot * Math.PI) / 180;
  return g;
}

function disposeTree(o: THREE.Object3D) {
  o.traverse((c) => {
    if ((c as THREE.Light).isLight) (c as THREE.SpotLight).shadow?.dispose?.();
    const m = c as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mm = m.material as THREE.Material | THREE.Material[] | undefined;
    (Array.isArray(mm) ? mm : mm ? [mm] : []).forEach((x) => {
      const s = x as THREE.MeshStandardMaterial;
      s.map?.dispose();
      s.emissiveMap?.dispose();
      x.dispose();
    });
  });
}

const canvasAspect = (s: StallDef) => Math.min(1.8, Math.max(1, (s.w / s.d) * 0.7));

const Preview3D: React.FC<Preview3DProps> = ({ layout, wallColor, floorColor, brand, stallNo, shell, stall, items }) => {
  const host = useRef<HTMLDivElement>(null);
  const rig = useRef<{ frame: () => void } | null>(null);
  const stallRef = useRef(stall);
  stallRef.current = stall;
  const userMoved = useRef(false);
  const content = useRef<THREE.Group | null>(null);

  // One-time scene setup
  useEffect(() => {
    const el = host.current!;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(HALL);
    scene.fog = new THREE.Fog(HALL, 11, 24);

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);
    camera.position.set(1.0, 2.5, 6.6);

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';

    // soft studio reflections
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new RoomEnvironment();
    scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    scene.environmentIntensity = 0.3;

    // lights: warm key spots from above the open front, cool fill
    scene.add(new THREE.HemisphereLight('#dfe8ff', '#1a1c22', 0.22));

    const rim = new THREE.DirectionalLight('#9db8ff', 0.35);
    rim.position.set(-4, 3, -3);
    scene.add(rim);

    // polished dark hall floor with a soft pool of light
    const gc = document.createElement('canvas');
    gc.width = gc.height = 512;
    const gg = gc.getContext('2d')!;
    const rg = gg.createRadialGradient(256, 256, 20, 256, 256, 256);
    rg.addColorStop(0, '#4a4f5c');
    rg.addColorStop(0.45, '#23262e');
    rg.addColorStop(1, '#14171e');
    gg.fillStyle = rg;
    gg.fillRect(0, 0, 512, 512);
    const gtex = new THREE.CanvasTexture(gc);
    gtex.colorSpace = THREE.SRGBColorSpace;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 26),
      new THREE.MeshStandardMaterial({ map: gtex, roughness: 0.32, metalness: 0.35 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.081;
    ground.receiveShadow = true;
    scene.add(ground);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.95, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.minDistance = 3.2;
    controls.maxDistance = 11;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minAzimuthAngle = -1.5;
    controls.maxAzimuthAngle = 1.5;
    controls.update();

    const group = new THREE.Group();
    scene.add(group);
    content.current = group;
    controls.addEventListener('start', () => {
      userMoved.current = true;
    });

    // Fit the whole stall in view for the current canvas shape
    const frame = () => {
      const s = stallRef.current;
      const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const distW = (s.w * 1.12) / 2 / (tanV * (camera.aspect || 1));
      const distH = (2.9 + s.d * 0.45) / 2 / tanV;
      const dist = Math.max(distW, distH, 3.4) + s.d * 0.3;
      camera.position.set(controls.target.x + dist * 0.17, controls.target.y + dist * 0.3, controls.target.z + dist * 0.94);
      controls.minDistance = 3.2;
      controls.maxDistance = dist * 2.2;
      controls.update();
      ground.scale.setScalar(Math.max(1, dist / 6));
      if (scene.fog instanceof THREE.Fog) {
        scene.fog.near = dist * 1.8;
        scene.fog.far = dist * 4;
      }
    };
    rig.current = { frame };

    // post: MSAA target + gentle bloom for LEDs, screens and fixtures
    const rt = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
    const composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.28, 0.45, 2.0);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h);
      composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (!userMoved.current) rig.current?.frame();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    let raf = 0;
    const loop = () => {
      controls.update();
      composer.render();
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      disposeTree(scene);
      scene.environment?.dispose();
      pmrem.dispose();
      composer.dispose();
      rt.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      content.current = null;
      rig.current = null;
    };
  }, []);

  // Rebuild the stall whenever the design changes
  useEffect(() => {
    const group = content.current;
    if (!group) return;
    while (group.children.length) {
      const c = group.children[0];
      group.remove(c);
      disposeTree(c);
    }

    const W = stall.w;
    const D = stall.d;
    const wallH = shell ? SHELL_WALL_H : CUSTOM_WALL_H;
    const noWalls = !!stall.noWalls;
    group.position.y = stall.riser ? 0.15 : 0;
    const w = hasWall(layout);
    const isWhite = wallColor.toLowerCase() === '#f8fafc';
    const accent = isWhite ? '#2563eb' : wallColor;
    const label = (brand || 'YOUR BRAND').toUpperCase().slice(0, 14);
    const fasciaText = stallNo ? `${label}  \u00b7  ${stallNo.toUpperCase()}` : label;

    // raised carpeted platform with an LED edge
    const carpet = std(floorColor, { roughness: 0.95, map: carpetTexture(floorColor), color: '#ffffff' });
    const platform = new THREE.Mesh(new RoundedBoxGeometry(W + 0.12, 0.08, D + 0.12, 3, 0.012), carpet);
    platform.position.y = -0.04;
    platform.receiveShadow = true;
    group.add(platform);
    if (!shell) {
      group.add(rbox(W + 0.14, 0.012, 0.014, glow('#ffffff', 1.4), 0, -0.07, (D + 0.12) / 2, 0.003));
      group.add(rbox(0.014, 0.012, D + 0.14, glow('#ffffff', 1.4), -(W + 0.12) / 2, -0.07, 0, 0.003));
      group.add(rbox(0.014, 0.012, D + 0.14, glow('#ffffff', 1.4), (W + 0.12) / 2, -0.07, 0, 0.003));
    }

    const alu = std('#c4cad3', { metalness: 0.85, roughness: 0.3 });
    const backZ = -D / 2 + WALL_T / 2;
    const leftX = -W / 2 + WALL_T / 2;
    const rightX = W / 2 - WALL_T / 2;
    const jointsX = Array.from({ length: Math.max(0, Math.ceil(W) - 1) }, (_, k) => -W / 2 + k + 1);
    const jointsZ = Array.from({ length: Math.max(0, Math.ceil(D) - 1) }, (_, k) => -D / 2 + k + 1);

    // walls
    if (shell) {
      // white laminated panels in a 2" aluminium frame, three modules per side
      const panel = std('#f6f7f9', { roughness: 0.35, clearcoat: 0.15, clearcoatRoughness: 0.4 });
      const post = (x: number, z: number, side = false) =>
        group.add(rbox(side ? WALL_T + 0.02 : 0.05, wallH + 0.006, side ? 0.05 : WALL_T + 0.02, alu, x, -0.003, z, 0.004));
      if (w.back) {
        group.add(rbox(W, wallH, WALL_T, panel, 0, 0, backZ, 0.004));
        group.add(rbox(W + 0.004, 0.056, WALL_T + 0.02, alu, 0, wallH - 0.05, backZ, 0.004));
        group.add(rbox(W + 0.004, 0.056, WALL_T + 0.02, alu, 0, -0.003, backZ, 0.004));
        jointsX.forEach((x) => post(x, backZ));
      }
      if (w.left) {
        group.add(rbox(WALL_T, wallH, D, panel, leftX, 0, 0, 0.004));
        group.add(rbox(WALL_T + 0.02, 0.056, D + 0.004, alu, leftX, wallH - 0.05, 0, 0.004));
        group.add(rbox(WALL_T + 0.02, 0.056, D + 0.004, alu, leftX, -0.003, 0, 0.004));
        jointsZ.forEach((z) => post(leftX, z, true));
      }
      if (w.right) {
        group.add(rbox(WALL_T, wallH, D, panel, rightX, 0, 0, 0.004));
        group.add(rbox(WALL_T + 0.02, 0.056, D + 0.004, alu, rightX, wallH - 0.05, 0, 0.004));
        group.add(rbox(WALL_T + 0.02, 0.056, D + 0.004, alu, rightX, -0.003, 0, 0.004));
        jointsZ.forEach((z) => post(rightX, z, true));
      }
      if (w.back) {
        // corner and front posts of the frame
        group.add(rbox(0.1, wallH + 0.006, 0.1, alu, -W / 2 + 0.05, -0.003, backZ, 0.004));
        group.add(rbox(0.1, wallH + 0.006, 0.1, alu, W / 2 - 0.05, -0.003, backZ, 0.004));
        post(-W / 2 + 0.025, D / 2 - 0.025);
        post(W / 2 - 0.025, D / 2 - 0.025);
        if (stall.centrePost) post(0, D / 2 - 0.025);
      }
    } else {
      const wm = std(wallColor, { roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35 });
      const skirt = std('#b8c0cc', { roughness: 0.45 });
      if (w.back) {
        group.add(rbox(W, wallH, WALL_T, wm, 0, 0, backZ, 0.006));
        group.add(rbox(W, 0.08, WALL_T + 0.012, skirt, 0, 0, backZ, 0.004));
      }
      if (w.left) {
        group.add(rbox(WALL_T, wallH, D, wm, leftX, 0, 0, 0.006));
        group.add(rbox(WALL_T + 0.012, 0.08, D, skirt, leftX, 0, 0, 0.004));
      }
      if (w.right) {
        group.add(rbox(WALL_T, wallH, D, wm, rightX, 0, 0, 0.006));
        group.add(rbox(WALL_T + 0.012, 0.08, D, skirt, rightX, 0, 0, 0.004));
      }
    }

    // front fascia
    if (w.back) {
      const fz = D / 2 - (shell ? 0.03 : 0.07);
      if (shell) {
        // 7" high board running across the open front, company name and stall number
        const fh = 0.18;
        const th = Math.max(24, Math.round((2048 * fh) / W));
        const tex = textTexture(fasciaText, 2048, th, '#ffffff', '#1e3a8a', `800 ${Math.round(th * 0.63)}px Arial, sans-serif`);
        const edge = std('#e5e7eb', { roughness: 0.5 });
        const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
        const fascia = new THREE.Mesh(new RoundedBoxGeometry(W, fh, 0.05, 3, 0.008), [edge, edge, edge, edge, face, edge]);
        fascia.position.set(0, wallH - fh / 2, fz);
        group.add(fascia);
      } else {
        const th = Math.max(24, Math.round((1024 * 0.36) / W));
        const tex = textTexture(fasciaText, 1024, th, '#ffffff', accent, `800 ${Math.round(th * 0.66)}px Arial, sans-serif`);
        const fasciaSide = std('#dfe4ec', { roughness: 0.55 });
        const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, color: '#e6eaf0' });
        const geo = new RoundedBoxGeometry(W, 0.36, 0.14, 3, 0.012);
        const fascia = new THREE.Mesh(geo, [fasciaSide, fasciaSide, fasciaSide, fasciaSide, face, fasciaSide]);
        fascia.position.set(0, wallH + 0.18 - 0.02, fz);
        group.add(fascia);
        group.add(rbox(W - 0.1, 0.016, 0.03, glow(accent, 3), 0, wallH - 0.045, fz + 0.04, 0.003));
        for (const x of Array.from({ length: Math.max(3, Math.round(W)) }, (_, k) => -W / 2 + (W * (k + 0.5)) / Math.max(3, Math.round(W)))) group.add(cyl(0.045, 0.045, 0.02, glow('#fff3d6', 4), x, wallH - 0.05, fz - 0.02, 24));
        if (!w.left) group.add(cyl(0.03, 0.03, wallH, chrome(), -W / 2 + 0.05, 0, fz, 20));
        if (!w.right) group.add(cyl(0.03, 0.03, wallH, chrome(), W / 2 - 0.05, 0, fz, 20));
      }
    }

    // overhead lights: booms from the top frame (shell) or a light truss (custom)
    const lights = items.filter((i) => OVERHEAD.includes(i.type));
    if (lights.length) {
      const dark = std('#161a22', { metalness: 0.7, roughness: 0.4 });
      if (shell) {
        lights.forEach((it) => {
          const px = it.x - W / 2;
          const pz = it.y - D / 2;
          const opts: { d: number; axis: 'z' | 'x'; to: number }[] = [];
          if (w.back) opts.push({ d: it.y, axis: 'z', to: backZ });
          if (w.left) opts.push({ d: it.x, axis: 'x', to: leftX });
          if (w.right) opts.push({ d: W - it.x, axis: 'x', to: rightX });
          if (!opts.length) return;
          const o = opts.sort((a, b) => a.d - b.d)[0];
          const y = wallH - 0.045;
          const len = Math.abs((o.axis === 'z' ? pz : px) - o.to);
          const arm = cyl(0.012, 0.012, len, dark, 0, 0, 0, 8);
          if (o.axis === 'z') {
            arm.rotation.x = Math.PI / 2;
            arm.position.set(px, y, (pz + o.to) / 2);
          } else {
            arm.rotation.z = Math.PI / 2;
            arm.position.set((px + o.to) / 2, y, pz);
          }
          group.add(arm);
        });
      } else {
        const ty = wallH - 0.02;
        const hx = W / 2 - 0.03;
        const hz = D / 2 - 0.03;
        group.add(rbox(W - 0.06, 0.04, 0.04, dark, 0, ty, -hz, 0.004));
        group.add(rbox(W - 0.06, 0.04, 0.04, dark, 0, ty, hz - 0.08, 0.004));
        group.add(rbox(0.04, 0.04, D - 0.06, dark, -hx, ty, 0, 0.004));
        group.add(rbox(0.04, 0.04, D - 0.06, dark, hx, ty, 0, 0.004));
      }
    }

    // riser platform (startup booth)
    if (stall.riser) group.add(rbox(W + 0.12, 0.15, D + 0.12, std('#e5e7eb', { roughness: 0.6 }), 0, -0.23, 0, 0.008));

    // key lights: one warm spot per 3 m module from above the open front, plus a back-wall wash
    const nx = Math.max(1, Math.round(W / 3));
    const nz = Math.max(1, Math.round(D / 3));
    const shadows = nx * nz <= 4;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const cx = -W / 2 + ((i + 0.5) * W) / nx;
        const cz = -D / 2 + ((j + 0.5) * D) / nz;
        const k1 = new THREE.SpotLight('#fff1dc', 16, 18, 0.62, 0.85, 2);
        k1.position.set(cx - 1.0, 3.5, cz + 1.5);
        k1.target.position.set(cx, 0.5, cz - 0.3);
        k1.castShadow = shadows;
        k1.shadow.mapSize.set(shadows ? 1024 : 512, shadows ? 1024 : 512);
        k1.shadow.bias = -0.0004;
        k1.shadow.radius = 4;
        group.add(k1, k1.target);
        if (nx * nz === 1) {
          const k2 = new THREE.SpotLight('#ffe9cf', 12, 18, 0.62, 0.85, 2);
          k2.position.set(cx + 1.4, 3.3, cz + 1.2);
          k2.target.position.set(cx, 0.5, cz - 0.5);
          k2.castShadow = true;
          k2.shadow.mapSize.set(1024, 1024);
          k2.shadow.bias = -0.0004;
          k2.shadow.radius = 5;
          group.add(k2, k2.target);
        }
      }
    }
    if (!noWalls) {
      for (let i = 0; i < nx; i++) {
        const cx = -W / 2 + ((i + 0.5) * W) / nx;
        const wash = new THREE.SpotLight('#ffffff', 7, 9, 0.8, 1, 2);
        wash.position.set(cx, wallH - 0.05, -D / 2 + 1.0);
        wash.target.position.set(cx, 1.2, -D / 2);
        group.add(wash, wash.target);
      }
    }

    const anyWall = !noWalls && (w.back || w.left || w.right);
    items.forEach((it) => group.add(buildItem(it, brand, accent, wallH, W, D, anyWall)));
  }, [layout, wallColor, floorColor, brand, stallNo, shell, stall, items]);

  // Re-frame the camera when the stall size changes
  useEffect(() => {
    userMoved.current = false;
    rig.current?.frame();
  }, [stall.id]);


  return (
    <div
      ref={host}
      className="w-full rounded-xl overflow-hidden aspect-[var(--ar)] max-h-[70vh] lg:max-h-none lg:aspect-auto lg:h-full"
      style={{ ['--ar' as string]: String(canvasAspect(stall)), background: HALL } as React.CSSProperties}
    />
  );
};

export default Preview3D;
