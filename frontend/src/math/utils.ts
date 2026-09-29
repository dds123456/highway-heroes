import * as THREE from 'three';

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function wrapAngle(a: number): number {
  const twoPi = Math.PI * 2;
  return ((a % twoPi) + twoPi) % twoPi;
}

export function rand(min: number, max: number, seed = 1): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  const y = Math.sin(seed * 269.5 + 183.3) * 24635.129;
  const r = (x - Math.floor(x)) * 0.618 + (y - Math.floor(y)) * 0.382;
  return min + (r - Math.floor(r)) * (max - min);
}

export function makeGradientTexture(levels: number[]): THREE.DataTexture {
  const data = new Uint8Array(levels.length);
  for (let i = 0; i < levels.length; i++) data[i] = Math.round(clamp(levels[i], 0, 1) * 255);
  const tex = new THREE.DataTexture(data, levels.length, 1, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export function makeMatcapTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2;
  const rings: Array<[number, number, string]> = [
    [0.12, 1, 'rgba(255,255,255,0.95)'],
    [0.2, 0.42, 'rgba(255,255,255,0.42)'],
    [0.45, 0.58, 'rgba(255,255,255,0.18)'],
    [0.66, 0.72, 'rgba(255,255,255,0.08)'],
  ];
  for (const [r0, r1, color] of rings) {
    ctx.beginPath();
    ctx.arc(cx, cy, r1 * cx, 0, Math.PI * 2);
    ctx.arc(cx, cy, r0 * cx, 0, Math.PI * 2, true);
    ctx.fillStyle = color;
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

export function makeAsphaltTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#4a5058';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 1600; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const g = 52 + Math.random() * 30;
    ctx.fillStyle = `rgb(${g + 18},${g + 20},${g + 26})`;
    ctx.fillRect(x, y, 2 + Math.random() * 3, 1 + Math.random() * 2);
  }
  const wear = ctx.createLinearGradient(0, 0, 0, size);
  wear.addColorStop(0, 'rgba(0,0,0,0)');
  wear.addColorStop(0.5, 'rgba(12,12,16,0.26)');
  wear.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = wear;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.anisotropy = 2;
  return tex;
}

export function makeDashedLineTexture(): THREE.CanvasTexture {
  const w = 32;
  const h = 96;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(244,241,231,0.95)';
  ctx.fillRect(0, h * 0.08, w, h * 0.42);
  ctx.fillRect(0, h * 0.62, w, h * 0.2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

export function makeCloudTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  const blobs: Array<[number, number, number]> = [
    [82, 122, 62],
    [128, 96, 82],
    [172, 124, 58],
    [108, 152, 48],
    [152, 164, 44],
  ];
  ctx.fillStyle = '#14141c';
  for (const [x, y, r] of blobs) {
    ctx.beginPath();
    ctx.arc(x, y, r + 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  for (const [x, y, r] of blobs) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

export function makeSignTexture(label: string, bg: string, fg: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#14141c';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 246, 118);
  ctx.fillStyle = fg;
  ctx.font = 'bold 46px "Arial Black", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

export function makeTerrainTexture(tones: string[] = ['#5aa860', '#3fae6e', '#d8b36a', '#74b45c', '#c89a5e']): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = tones[0];
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 420; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 10 + Math.random() * 46;
    ctx.fillStyle = tones[Math.floor(Math.random() * tones.length)];
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

export function makeBuildingTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 256);
  const cols = 4;
  const rows = 8;
  const cw = 128 / cols;
  const ch = 256 / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = Math.random() < 0.24;
      ctx.fillStyle = lit ? '#ffe9a8' : '#232833';
      ctx.fillRect(c * cw + 7, r * ch + 7, cw - 14, ch - 14);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

export function makePadTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 64);
  ctx.fillStyle = '#fff6d8';
  for (let i = 0; i < 3; i++) {
    const x = 18 + i * 34;
    ctx.beginPath();
    ctx.moveTo(x + 14, 8);
    ctx.lineTo(x, 32);
    ctx.lineTo(x + 14, 56);
    ctx.lineTo(x + 26, 56);
    ctx.lineTo(x + 12, 32);
    ctx.lineTo(x + 26, 8);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}
