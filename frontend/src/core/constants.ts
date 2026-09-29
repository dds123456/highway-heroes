import * as THREE from 'three';

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

// 「洛克王国」漫画风 —— 高对比 / 高亮度 / 高饱和的童话色板。
export const PALETTE = {
  ink: '#211e2e',
  inkSoft: '#3a3550',
  asphalt: '#6b7078',
  asphaltDark: '#4b4f57',
  lane: '#fffbe8',
  shoulder: '#8a909a',
  curb: '#ff4f6b',
  rim: '#ff5fb0',
  rimTeal: '#5cf2e3',
  sun: '#fff4c0',
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

export function hexColor(hex: string): THREE.Color {
  return hexToLinear(hex);
}

export const COLORS = Object.fromEntries(
  Object.entries(PALETTE).map(([k, v]) => [k, hexToLinear(v)]),
) as Record<keyof typeof PALETTE, THREE.Color>;

// ─────────────────────────────────────────────────────────────
// 摩托车 ×3（经典复古写实向）
// ─────────────────────────────────────────────────────────────
export type BikeForm = 'bonneville' | 'dt1' | 'flh';

/** 一套配色：primary 车身主色 / accent 副色(拉花·号码牌·侧包) / trim 镶边线·贴花字色 / seat 座垫皮色 */
export interface Colorway {
  id: string;
  name: string;
  primary: string;
  accent: string;
  trim: string;
  seat: string;
}

export interface BikeSpec {
  id: string;
  name: string;
  form: BikeForm;
  colorways: Colorway[];
  stats: { speed: number; accel: number; handling: number; nitro: number };
}

export const BIKES: BikeSpec[] = [
  {
    id: 'bonneville',
    name: '凯旋 Bonneville',
    form: 'bonneville',
    colorways: [
      { id: 'bon-gem', name: '宝石蓝', primary: '#2f6fd6', accent: '#c9d6e6', trim: '#e8eef6', seat: '#5a3d26' },
      { id: 'bon-gold', name: '黑金', primary: '#26282e', accent: '#3a3d46', trim: '#d8b13b', seat: '#2b2d33' },
      { id: 'bon-olive', name: '橄榄绿', primary: '#5b6b3a', accent: '#c9d6e6', trim: '#e8eef6', seat: '#6b4a2b' },
      { id: 'bon-titan', name: '钛银', primary: '#aeb6bf', accent: '#d9dee4', trim: '#8a929c', seat: '#3a3d42' },
    ],
    stats: { speed: 82, accel: 78, handling: 78, nitro: 72 },
  },
  {
    id: 'dt1',
    name: '雅马哈 DT-1',
    form: 'dt1',
    colorways: [
      { id: 'dt-pearl', name: '珍珠白', primary: '#f2f1ea', accent: '#e8492f', trim: '#e8492f', seat: '#26282d' },
      { id: 'dt-desert', name: '沙漠黄', primary: '#d8b45a', accent: '#26282c', trim: '#26282c', seat: '#26282d' },
      { id: 'dt-army', name: '军绿', primary: '#4f5d3a', accent: '#f2f1ea', trim: '#f2f1ea', seat: '#26282d' },
      { id: 'dt-racer', name: '赛车橙', primary: '#e8492f', accent: '#26282c', trim: '#f5f5f2', seat: '#26282d' },
    ],
    stats: { speed: 72, accel: 92, handling: 96, nitro: 66 },
  },
  {
    id: 'flh',
    name: '哈雷 Electra Glide',
    form: 'flh',
    colorways: [
      { id: 'flh-hifi', name: 'Hi-Fi蓝', primary: '#34569c', accent: '#22242a', trim: '#e8eef6', seat: '#22242a' },
      { id: 'flh-amber', name: '午夜琥珀', primary: '#b06a2f', accent: '#22242a', trim: '#d8b13b', seat: '#22242a' },
      { id: 'flh-black', name: '纯黑', primary: '#16181d', accent: '#2b2e35', trim: '#e8eef6', seat: '#22242a' },
      { id: 'flh-ivory', name: '象牙白', primary: '#f2ead8', accent: '#e8492f', trim: '#e8492f', seat: '#22242a' },
    ],
    stats: { speed: 91, accel: 68, handling: 56, nitro: 92 },
  },
];

// ─────────────────────────────────────────────────────────────
// 角色（车手）×2
// ─────────────────────────────────────────────────────────────
export interface RiderSpec {
  id: string;
  name: string;
  suit: string;
  suitLight: string;
  helmet: string;
  visor: string;
}

export const RIDERS: RiderSpec[] = [
  { id: 'roco', name: '洛克少年', suit: '#ff5a4e', suitLight: '#fff3ef', helmet: '#ff2d3f', visor: '#16131f' },
  { id: 'starla', name: '星辉少女', suit: '#ff7ac8', suitLight: '#fff0f9', helmet: '#b45bff', visor: '#17121f' },
];

// ─────────────────────────────────────────────────────────────
// 地图 ×3
// ─────────────────────────────────────────────────────────────
export type TrackId = 'meadow' | 'canyon' | 'snowfield';

export interface TrackSpec {
  id: TrackId;
  name: string;
  weather: 'sunny' | 'rain' | 'snow' | 'storm';
  music: string;
  skyTop: string;
  skyMid: string;
  skyHorizon: string;
  sun: string;
  terrain: string;
  terrainTones: string[];
  tree: string;
  treeDark: string;
  mountain: string;
  mountainFar: string;
  guide: string;
}

export const TRACKS: TrackSpec[] = [
  {
    id: 'meadow',
    name: '洛克草原',
    weather: 'sunny',
    music: 'music/bgm-meadow.mp3',
    skyTop: '#2f86ff',
    skyMid: '#7ecbff',
    skyHorizon: '#fff3b8',
    sun: '#fff7c8',
    terrain: '#6dd86a',
    terrainTones: ['#7fe07a', '#59c96b', '#e6c86a', '#8ce068', '#d9a85e'],
    tree: '#43c96a',
    treeDark: '#2fa254',
    mountain: '#6a7fe0',
    mountainFar: '#a9b9f2',
    guide: '#ff8a3d',
  },
  {
    id: 'canyon',
    name: '星辉峡谷',
    weather: 'sunny',
    music: 'music/bgm-canyon.mp3',
    skyTop: '#5a3fd9',
    skyMid: '#b06bff',
    skyHorizon: '#ffb36b',
    sun: '#ffd98a',
    terrain: '#d9a05b',
    terrainTones: ['#e0a86a', '#c98a52', '#e6c06a', '#d9829a', '#c9705e'],
    tree: '#5bc9a0',
    treeDark: '#3a9a78',
    mountain: '#7a5bd9',
    mountainFar: '#bba9f0',
    guide: '#ff6bd6',
  },
  {
    id: 'snowfield',
    name: '冰雪王国',
    weather: 'snow',
    music: 'music/bgm-snowfield.mp3',
    skyTop: '#7cc7ff',
    skyMid: '#c9e9ff',
    skyHorizon: '#f4fbff',
    sun: '#ffffff',
    terrain: '#eef5ff',
    terrainTones: ['#ffffff', '#e6f0fb', '#d5e6f5', '#c3dcee', '#eef7ff'],
    tree: '#5bc9d9',
    treeDark: '#3a9aa8',
    mountain: '#9fc3e8',
    mountainFar: '#d6e6f5',
    guide: '#5cf2e3',
  },
];

// ─────────────────────────────────────────────────────────────
// 道具
// ─────────────────────────────────────────────────────────────
export type ItemKind = 'missile' | 'shield' | 'boost' | 'mine';

export const ITEM_KINDS: ItemKind[] = ['missile', 'shield', 'boost', 'mine'];

export const ITEM_COLORS: Record<ItemKind, string> = {
  missile: '#ff2d3f',
  shield: '#2fb6ff',
  boost: '#ffd23f',
  mine: '#ff7a3d',
};