import type { ItemKind } from './constants';
import type { GameModeId } from './GameMode';

export type EventMap = {
  'race:state': { state: string; countdown: number };
  'race:lap': { index: number; lap: number; time: number; valid: boolean };
  'race:checkpoint': { index: number; time: number };
  'race:finish': { rank: number; total: number; laps: number[]; lapValid: boolean[]; bestLapMs: number };
  'vehicle:collision': { index: number; strength: number };
  'vehicle:landing': { index: number; strength: number };
  'vehicle:drift': { index: number; active: boolean };
  'vehicle:boost': { index: number; active: boolean };
  'vehicle:pickup': { index: number };
  'item:pickup': { index: number; kind: ItemKind };
  'item:fire': { index: number; kind: ItemKind };
  'item:hit': { index: number; kind: ItemKind; owner: number };
  'item:block': { index: number; owner: number };
  'hud:item': { kind: ItemKind | null };
  'settings:sfx-volume': number;
  'settings:engine-volume': number;
  'settings:weather-volume': number;
  'settings:music-volume': number;
  'settings:steer-sensitivity': number;
  'weather:change': { mode: 'sunny' | 'rain' | 'snow' | 'storm' };
  'weather:thunder': void;
  'hud:snapshot': {
    speed: number;
    lap: number;
    laps: number;
    rank: number;
    checkpoint: number;
    charge: number;
    boost: boolean;
    drifting: boolean;
    time: number;
    lapTime: number;
    mode: GameModeId;
  };
  'hud:drift': { score: number; combo: number; timeLeft: number };
  'drift:finish': { score: number; best: number; isBest: boolean };
  'screen:show': { screen: string };
  'audio:init': void;
};

type Handler<T> = (payload: T) => void;

export class EventBus {
  private handlers = new Map<keyof EventMap, Set<Handler<any>>>();

  on<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<any>);
    return () => set?.delete(handler as Handler<any>);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of set) (handler as Handler<EventMap[K]>)(payload);
  }
}
