import * as THREE from 'three';

/**
 * 统一设置存取：集中 localStorage 的读取、校验、默认值与持久化，
 * 避免 Game/HUD 中散落 parseFloat 导致 NaN 或超范围值进入音频 / 转向系统。
 *
 * 兼容旧版独立键（hh.sfx / hh.engine / hh.weather / hh.music / hh.steer）。
 */
export interface GameSettings {
  sfx: number;
  engine: number;
  weather: number;
  music: number;
  /** 转向灵敏度倍率，范围 0.5 ~ 2.5 */
  steer: number;
}

const DEFAULT_SETTINGS: GameSettings = {
  sfx: 0.4,
  engine: 1.0,
  weather: 0.3,
  music: 0.55,
  steer: 1.0,
};

const KEYS = {
  sfx: 'hh.sfx',
  engine: 'hh.engine',
  weather: 'hh.weather',
  music: 'hh.music',
  steer: 'hh.steer',
} as const;

export function clamp01(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? THREE.MathUtils.clamp(number, 0, 1) : fallback;
}

export function clampSteer(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? THREE.MathUtils.clamp(number, 0.5, 2.5) : fallback;
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 隐私模式等场景下写入失败时静默忽略 */
  }
}

export class SettingsStore {
  private settings: GameSettings;

  constructor() {
    this.settings = {
      sfx: clamp01(readRaw(KEYS.sfx), DEFAULT_SETTINGS.sfx),
      engine: clamp01(readRaw(KEYS.engine), DEFAULT_SETTINGS.engine),
      weather: clamp01(readRaw(KEYS.weather), DEFAULT_SETTINGS.weather),
      music: clamp01(readRaw(KEYS.music), DEFAULT_SETTINGS.music),
      steer: clampSteer(readRaw(KEYS.steer), DEFAULT_SETTINGS.steer),
    };
  }

  get(): GameSettings {
    return { ...this.settings };
  }

  set(patch: Partial<GameSettings>): void {
    this.settings = { ...this.settings, ...patch };
    if (patch.sfx !== undefined) writeRaw(KEYS.sfx, String(this.settings.sfx));
    if (patch.engine !== undefined) writeRaw(KEYS.engine, String(this.settings.engine));
    if (patch.weather !== undefined) writeRaw(KEYS.weather, String(this.settings.weather));
    if (patch.music !== undefined) writeRaw(KEYS.music, String(this.settings.music));
    if (patch.steer !== undefined) writeRaw(KEYS.steer, String(this.settings.steer));
  }
}

export const settingsStore = new SettingsStore();
