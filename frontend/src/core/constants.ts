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

// Pacific Edition — natural daylight and protective street equipment.
export const PALETTE = {
  ink: '#211e2e',
  inkSoft: '#3a3550',
  asphalt: '#6b7078',
  asphaltDark: '#4b4f57',
  lane: '#fffbe8',
  shoulder: '#8a909a',
  curb: '#ff4f6b',
  rim: '#b9c7ce',
  rimTeal: '#a2bfc5',
  sun: '#fff4c0',
} as const;

function hexToLinear(hex: string): THREE.Color {
  return new THREE.Color(hex);
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
    name: 'Cafe Custom 88',
    form: 'bonneville',
    colorways: [
      { id: 'bon-gem', name: '哑光黑红', primary: '#24282c', accent: '#a92b32', trim: '#e8eef6', seat: '#5a3d26' },
      { id: 'bon-gold', name: '黑金', primary: '#26282e', accent: '#3a3d46', trim: '#d8b13b', seat: '#2b2d33' },
      { id: 'bon-olive', name: '橄榄绿', primary: '#5b6b3a', accent: '#c9d6e6', trim: '#e8eef6', seat: '#6b4a2b' },
      { id: 'bon-titan', name: '钛银', primary: '#aeb6bf', accent: '#d9dee4', trim: '#8a929c', seat: '#3a3d42' },
    ],
    stats: { speed: 82, accel: 78, handling: 78, nitro: 72 },
  },
  {
    id: 'dt1',
    name: 'Desert Scrambler',
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
    name: 'RS Sport 200',
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
  { id: 'roco', name: '公路车手', suit: '#292c30', suitLight: '#4a4d4b', helmet: '#8c292e', visor: '#16131f' },
  { id: 'starla', name: '街头车手', suit: '#3c4245', suitLight: '#8c8b7f', helmet: '#d2cab5', visor: '#17121f' },
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
    name: '海岸都会环线',
    weather: 'sunny',
    music: 'music/bgm-meadow.mp3',
    skyTop: '#4a9bc1',
    skyMid: '#9ebaca',
    skyHorizon: '#d7d6c9',
    sun: '#fff7c8',
    terrain: '#8c9b6a',
    terrainTones: ['#9aab76', '#7e925e', '#aca579', '#748951', '#a3956d'],
    tree: '#586547',
    treeDark: '#3f4c35',
    mountain: '#7c898d',
    mountainFar: '#9aa8ae',
    guide: '#ff8a3d',
  },
  {
    id: 'canyon',
    name: '荒漠州际公路',
    weather: 'sunny',
    music: 'music/bgm-canyon.mp3',
    skyTop: '#658fa9',
    skyMid: '#b3bfc1',
    skyHorizon: '#ddd0b6',
    sun: '#fff1d3',
    terrain: '#b29a78',
    terrainTones: ['#b89f7a', '#a78b69', '#c1ad8a', '#998468', '#c1b193'],
    tree: '#7a8260',
    treeDark: '#555e45',
    mountain: '#978573',
    mountainFar: '#b7aea0',
    guide: '#c5ab71',
  },
  {
    id: 'snowfield',
    name: '高山隘口',
    weather: 'snow',
    music: 'music/bgm-snowfield.mp3',
    skyTop: '#849fb1',
    skyMid: '#b7c8d2',
    skyHorizon: '#f4fbff',
    sun: '#ffffff',
    terrain: '#eef5ff',
    terrainTones: ['#ffffff', '#e6f0fb', '#d5e6f5', '#c3dcee', '#eef7ff'],
    tree: '#425b50',
    treeDark: '#2e443c',
    mountain: '#919fa8',
    mountainFar: '#b9c6ce',
    guide: '#a2bfc5',
  },
];

// ─────────────────────────────────────────────────────────────
// 道具
// ─────────────────────────────────────────────────────────────
export type ItemKind = 'missile' | 'shield' | 'boost' | 'mine';

export const ITEM_KINDS: ItemKind[] = ['missile', 'shield', 'boost', 'mine'];

export const ITEM_COLORS: Record<ItemKind, string> = {
  missile: '#ffab55',
  shield: '#64bbff',
  boost: '#50edf1',
  mine: '#fb5796',
};
