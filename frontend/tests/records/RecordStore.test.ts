import { beforeEach, describe, expect, it } from 'vitest';
import { RecordStore } from '../../src/records/RecordStore';

function installLocalStorageMock(): void {
  const store = new Map<string, string>();
  const mock = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  (globalThis as Record<string, unknown>).localStorage = mock;
}

describe('RecordStore', () => {
  beforeEach(() => installLocalStorageMock());

  it('保存并按 track + mode 查询最佳圈速', () => {
    RecordStore.save(
      RecordStore.makeResult({ mode: 'time-trial', trackId: 'meadow', bikeId: 'bonneville', totalTimeMs: 90000, lapTimesMs: [32000, 31000, 30500], bestLapMs: 30500 }),
    );
    RecordStore.save(
      RecordStore.makeResult({ mode: 'time-trial', trackId: 'meadow', bikeId: 'bonneville', totalTimeMs: 88000, lapTimesMs: [31000, 30000, 29800], bestLapMs: 29800 }),
    );
    expect(RecordStore.getBestLapMs('meadow', 'time-trial')).toBe(29800);
    expect(RecordStore.list('meadow', 'time-trial').length).toBe(2);
  });

  it('漂移模式按最高分取最佳', () => {
    RecordStore.save(
      RecordStore.makeResult({ mode: 'drift', trackId: 'canyon', bikeId: 'flh', totalTimeMs: 0, lapTimesMs: [], bestLapMs: 0, driftScore: 4200 }),
    );
    RecordStore.save(
      RecordStore.makeResult({ mode: 'drift', trackId: 'canyon', bikeId: 'flh', totalTimeMs: 0, lapTimesMs: [], bestLapMs: 0, driftScore: 8800 }),
    );
    expect(RecordStore.getBest('canyon', 'drift')?.driftScore).toBe(8800);
  });

  it('竞速模式按总用时最短取最佳', () => {
    RecordStore.save(RecordStore.makeResult({ mode: 'race', trackId: 'snowfield', bikeId: 'dt1', position: 2, totalTimeMs: 92000, lapTimesMs: [30000, 31000, 31000], bestLapMs: 30000 }));
    RecordStore.save(RecordStore.makeResult({ mode: 'race', trackId: 'snowfield', bikeId: 'dt1', position: 1, totalTimeMs: 89000, lapTimesMs: [29000, 30000, 30000], bestLapMs: 29000 }));
    expect(RecordStore.getBest('snowfield', 'race')?.totalTimeMs).toBe(89000);
  });
});
