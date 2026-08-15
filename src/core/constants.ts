export const WORLD = {
  maxSpeed: 94.44,
  accel: 6.8,
  brake: 48,
  drag: 0.0001,
  coastDrag: 0.0009,
  gravity: 34,
  roadHalfWidth: 9,
  shoulderWidth: 2.4,
  chunkSize: 24,
  streamRadius: 620,
  laps: 3,
} as const;

import * as THREE from 'three';

export const PALETTE = {
  ink: '#14141c',
  inkSoft: '#23232f',
  asphalt: '#34383f',
  asphaltDark: '#24272d',
  lane: '#f4f1e7',
  shoulder: '#4a5057',
  curb: '#d94f3d',
  guide: '#ff8a3d',
  player: '#ff4d5e',
  playerAccent: '#ffd23f',
  aiA: '#38b6ff',
  aiB: '#57d68d',
  aiC: '#c86dff',
  rim: '#ff4fa3',
  rimTeal: '#4ff5e3',
  skyTop: '#3d7df0',
  skyMid: '#8ec8ff',
  skyHorizon: '#ffe6a3',
  sun: '#fff3b0',
  mountain: '#2f5b8f',
  mountainFar: '#8fa9c9',
  tree: '#3fae6e',
  treeDark: '#2d7f55',
} as const;

function hexToLinear(hex: string): THREE.Color {
  const n = parseInt(hex.slice(1), 16);
  return new THREE.Color().setRGB(
    ((n >> 16) & 255) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255,
    THREE.LinearSRGBColorSpace,
  );
}

export const COLORS = Object.fromEntries(
  Object.entries(PALETTE).map(([k, v]) => [k, hexToLinear(v)]),
) as Record<keyof typeof PALETTE, THREE.Color>;
