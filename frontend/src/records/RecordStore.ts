import type { TrackId } from '../core/constants';
import type { GameModeId } from '../core/GameMode';
import { GAME_VERSION } from '../core/version';

/**
 * 一局比赛的统一结果快照：结算页、本地记录、排行榜提交、分享卡片共用。
 */
export interface RaceResult {
  id: string;
  mode: GameModeId;
  trackId: TrackId;
  bikeId: string;
  /** 竞速名次，1 为冠军；计时赛 / 漂移 / 沙盒为 undefined */
  position?: number;
  totalTimeMs: number;
  lapTimesMs: number[];
  bestLapMs: number;
  driftScore?: number;
  valid: boolean;
  gameVersion: string;
  createdAt: string;
}

const STORE_KEY = 'hh.records.v1';
const MAX_RECORDS = 400;

function readAll(): RaceResult[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is RaceResult => !!r && typeof r === 'object' && typeof (r as RaceResult).id === 'string',
    );
  } catch {
    return [];
  }
}

function writeAll(list: RaceResult[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(0, MAX_RECORDS)));
  } catch {
    /* 隐私/容量不足时忽略 */
  }
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 本地成绩存储：先落在 localStorage，未来可替换 / 组合 Supabase 实现同名接口。 */
export const RecordStore = {
  getBest(trackId: TrackId, mode: GameModeId): RaceResult | null {
    const entries = this.list(trackId, mode);
    if (entries.length === 0) return null;
    if (mode === 'drift') {
      return entries.reduce((best, r) => ((r.driftScore ?? 0) > (best.driftScore ?? 0) ? r : best));
    }
    return entries.reduce((best, r) => (r.totalTimeMs < best.totalTimeMs ? r : best));
  },

  /** 计时赛的最佳圈速（毫秒），无记录时为 null */
  getBestLapMs(trackId: TrackId, mode: GameModeId): number | null {
    const entries = this.list(trackId, mode);
    const valid = entries.filter((r) => r.valid && r.bestLapMs > 0).map((r) => r.bestLapMs);
    if (valid.length === 0) return null;
    return Math.min(...valid);
  },

  save(result: RaceResult): void {
    const list = readAll();
    list.push(result);
    writeAll(list);
  },

  list(trackId: TrackId, mode: GameModeId): RaceResult[] {
    return readAll()
      .filter((r) => r.trackId === trackId && r.mode === mode)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  listAll(): RaceResult[] {
    return readAll().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  makeResult(partial: Omit<RaceResult, 'id' | 'gameVersion' | 'createdAt' | 'valid'> & { valid?: boolean }): RaceResult {
    return {
      id: makeId(),
      gameVersion: GAME_VERSION,
      createdAt: new Date().toISOString(),
      valid: true,
      ...partial,
    };
  },
};