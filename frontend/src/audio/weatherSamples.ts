/**
 * 天气采样（近距离雷击 SFX / 强降雨环境声）的预加载与缓存。
 * 与引擎采样一致：临时 AudioContext 解码后缓存 AudioBuffer，供游戏 AudioContext 复用。
 */
export type WeatherSampleKey = 'thunder' | 'rain';

const FILES: Record<WeatherSampleKey, string> = {
  thunder: 'audio/weather/01-thunder-close-clap.ogg',
  rain: 'audio/weather/02-rain-strong-consistent.ogg',
};

const cache: Partial<Record<WeatherSampleKey, AudioBuffer>> = {};

export async function preloadWeatherSamples(): Promise<void> {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  const ctx = new Ctor();
  const keys = Object.keys(FILES) as WeatherSampleKey[];
  await Promise.all(
    keys.map(async (k) => {
      try {
        const res = await fetch(FILES[k]);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const bytes = await res.arrayBuffer();
        // 解码加超时，避免个别环境解码 OGG 永不返回而卡住
        const decoded = await Promise.race([
          ctx.decodeAudioData(bytes),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('decode timeout')), 5000)),
        ]);
        cache[k] = decoded;
      } catch (err) {
        console.warn(`[weatherSamples] 解码失败 ${FILES[k]}：`, err);
      }
    }),
  );
  await ctx.close().catch(() => {});
}

export function getWeatherSample(key: WeatherSampleKey): AudioBuffer | null {
  return cache[key] ?? null;
}
