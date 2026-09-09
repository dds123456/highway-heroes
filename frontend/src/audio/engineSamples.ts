/**
 * 摩托车四阶段引擎采样（start / rev / idle / stop）的预加载与缓存。
 * 音频用临时 AudioContext 解码后缓存为 AudioBuffer，可在游戏 AudioContext 中直接复用。
 */
export type EngineSampleKey = 'start' | 'rev' | 'idle' | 'stop';

const FILES: Record<EngineSampleKey, string> = {
  start: 'audio/engine/01-start.ogg',
  rev: 'audio/engine/02-rev-ups.ogg',
  idle: 'audio/engine/03-idle.ogg',
  stop: 'audio/engine/04-stop-onboard.ogg',
};

const cache: Partial<Record<EngineSampleKey, AudioBuffer>> = {};

export async function preloadEngineSamples(): Promise<void> {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  const ctx = new Ctor();
  const keys = Object.keys(FILES) as EngineSampleKey[];
  await Promise.all(
    keys.map(async (k) => {
      try {
        const res = await fetch(FILES[k]);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const bytes = await res.arrayBuffer();
        // 解码加超时，避免个别环境（如无音频后端）解码 OGG 永不返回而卡住启动
        const decoded = await Promise.race([
          ctx.decodeAudioData(bytes),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('decode timeout')), 5000)),
        ]);
        cache[k] = decoded;
      } catch (err) {
        console.warn(`[engineSamples] 解码失败 ${FILES[k]}：`, err);
      }
    }),
  );
  await ctx.close().catch(() => {});
}

export function getEngineSample(key: EngineSampleKey): AudioBuffer | null {
  return cache[key] ?? null;
}

export function hasEngineSamples(): boolean {
  return cache.idle != null || cache.rev != null;
}