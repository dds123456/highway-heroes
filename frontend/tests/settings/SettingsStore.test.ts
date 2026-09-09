import { describe, expect, it } from 'vitest';
import { clamp01, clampSteer, SettingsStore } from '../../src/settings/SettingsStore';

describe('SettingsStore 校验', () => {
  it('clamp01 把 0~1 之外的值夹回范围，非法值回退默认', () => {
    expect(clamp01('0.7', 0.4)).toBeCloseTo(0.7);
    expect(clamp01('2.5', 0.4)).toBe(1);
    expect(clamp01('-1', 0.4)).toBe(0);
    expect(clamp01('not-a-number', 0.4)).toBe(0.4);
    expect(clamp01(null, 0.4)).toBe(0.4);
  });

  it('clampSteer 把转向灵敏度夹到 0.5~2.5', () => {
    expect(clampSteer('1', 1)).toBe(1);
    expect(clampSteer('99', 1)).toBe(2.5);
    expect(clampSteer('0', 1)).toBe(0.5);
    expect(clampSteer('abc', 1.2)).toBe(1.2);
  });

  it('无 localStorage 时使用默认值，set/get 正常往返', () => {
    const store = new SettingsStore();
    const s = store.get();
    expect(s.sfx).toBeCloseTo(0.4);
    expect(s.steer).toBeCloseTo(1);
    store.set({ music: 0.8, steer: 2 });
    expect(store.get().music).toBeCloseTo(0.8);
    expect(store.get().steer).toBe(2);
  });
});
