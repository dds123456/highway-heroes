import { WORLD } from '../core/constants';
import { getEngineSample, type EngineSampleKey } from './engineSamples';
import { getWeatherSample, type WeatherSampleKey } from './weatherSamples';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineOscA: OscillatorNode | null = null;
  private engineOscB: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private skidGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private snowGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private rainLevel = 0;
  private snowLevel = 0;
  private windLevel = 0;
  private muted = false;
  private bgm: HTMLAudioElement | null = null;
  private bgmSrc = '';
  // 初始响度层级：引擎最大 > 背景音乐 > 音效（道具/UI）> 天气环境声
  private sfxVolume = 0.4;
  private engineVolume = 1;
  private weatherVolume = 0.3;
  private musicVolume = 0.55;
  // 独立音量总线：道具/UI → sfxBus，引擎 → engineBus，天气 → weatherBus，三者汇入 master
  private sfxBus: GainNode | null = null;
  private engineBus: GainNode | null = null;
  private weatherBus: GainNode | null = null;
  // 采样引擎（四阶段）：怠速 / 轰油两路循环 + 启动 / 熄火一次性采样
  private engineIdleNode: AudioBufferSourceNode | null = null;
  private engineRevNode: AudioBufferSourceNode | null = null;
  private engineIdleGain: GainNode | null = null;
  private engineRevGain: GainNode | null = null;
  private engineRunning = false;
  private engineRevLevel = 0;
  // 天气采样：强降雨环境循环 + 近距离雷击 SFX
  private rainSampleNode: AudioBufferSourceNode | null = null;
  private rainSampleGain: GainNode | null = null;
  private rainSampleLevel = 0;

  init(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(ctx.destination);

    // 三路独立音量总线
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxVolume;
    this.sfxBus.connect(this.master);
    this.engineBus = ctx.createGain();
    this.engineBus.gain.value = this.engineVolume;
    this.engineBus.connect(this.master);
    this.weatherBus = ctx.createGain();
    this.weatherBus.gain.value = this.weatherVolume;
    this.weatherBus.connect(this.master);

    this.setupSampleEngine();

    this.engineOscA = ctx.createOscillator();
    this.engineOscB = ctx.createOscillator();
    this.engineOscA.type = 'sawtooth';
    this.engineOscB.type = 'square';
    this.engineOscB.detune.value = 9;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 520;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOscA.connect(this.engineFilter);
    this.engineOscB.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.engineBus!);
    this.engineOscA.start();
    this.engineOscB.start();

    this.noiseBuffer = this.makeNoiseBuffer(2);
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 900;
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = this.noiseBuffer;
    windSrc.loop = true;
    windSrc.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.weatherBus!);
    windSrc.start();

    this.skidGain = ctx.createGain();
    this.skidGain.gain.value = 0;
    const skidFilter = ctx.createBiquadFilter();
    skidFilter.type = 'bandpass';
    skidFilter.frequency.value = 1500;
    const skidSrc = ctx.createBufferSource();
    skidSrc.buffer = this.noiseBuffer;
    skidSrc.loop = true;
    skidSrc.connect(skidFilter);
    skidFilter.connect(this.skidGain);
    this.skidGain.connect(this.engineBus!);
    skidSrc.start();

    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'lowpass';
    rainFilter.frequency.value = 1100;
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = this.noiseBuffer;
    rainSrc.loop = true;
    rainSrc.connect(rainFilter);
    rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.weatherBus!);
    rainSrc.start();

    this.snowGain = ctx.createGain();
    this.snowGain.gain.value = 0;
    const snowFilter = ctx.createBiquadFilter();
    snowFilter.type = 'bandpass';
    snowFilter.frequency.value = 2600;
    snowFilter.Q.value = 0.8;
    const snowSrc = ctx.createBufferSource();
    snowSrc.buffer = this.noiseBuffer;
    snowSrc.loop = true;
    snowSrc.connect(snowFilter);
    snowFilter.connect(this.snowGain);
    this.snowGain.connect(this.weatherBus!);
    snowSrc.start();

    this.setupSampleWeather();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.85, this.ctx.currentTime, 0.05);
    }
    if (this.bgm) this.bgm.muted = muted;
  }

  /** 暂停全部音频：挂起 Web Audio（引擎/天气/音效）+ 暂停背景音乐 */
  pauseAll(): void {
    if (this.bgm) this.bgm.pause();
    if (this.ctx) void this.ctx.suspend();
  }

  /** 恢复全部音频：恢复 Web Audio + 续播背景音乐 */
  resumeAll(): void {
    if (this.ctx) void this.ctx.resume();
    if (this.bgm) this.bgm.play().catch(() => {});
  }

  /** 道具/UI 音效响度 0..1 */
  setSfxVolume(v: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxBus && this.ctx) {
      this.sfxBus.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.05);
    }
  }

  getSfxVolume(): number {
    return this.sfxVolume;
  }

  /** 引擎音效响度 0..1 */
  setEngineVolume(v: number): void {
    this.engineVolume = Math.max(0, Math.min(1, v));
    if (this.engineBus && this.ctx) {
      this.engineBus.gain.setTargetAtTime(this.engineVolume, this.ctx.currentTime, 0.05);
    }
  }

  getEngineVolume(): number {
    return this.engineVolume;
  }

  /** 天气音效响度 0..1 */
  setWeatherVolume(v: number): void {
    this.weatherVolume = Math.max(0, Math.min(1, v));
    if (this.weatherBus && this.ctx) {
      this.weatherBus.gain.setTargetAtTime(this.weatherVolume, this.ctx.currentTime, 0.05);
    }
  }

  getWeatherVolume(): number {
    return this.weatherVolume;
  }

  /** 背景音乐响度 0..1 */
  setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.bgm) this.bgm.volume = this.musicVolume;
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  /** 背景音乐：播放指定曲目（可无缝循环） */
  playMusic(src: string): void {
    if (this.bgmSrc === src && this.bgm && !this.bgm.paused) return;
    this.stopMusic();
    this.bgmSrc = src;
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = this.musicVolume;
    audio.muted = this.muted;
    audio.play().catch(() => {
      /* 自动播放被浏览器拦截时静默忽略 */
    });
    this.bgm = audio;
  }

  stopMusic(): void {
    if (this.bgm) {
      this.bgm.pause();
      this.bgm = null;
    }
    this.bgmSrc = '';
  }

  /** 暂停背景音乐（暂停菜单用，保留播放位置） */
  pauseMusic(): void {
    if (this.bgm) this.bgm.pause();
  }

  /** 恢复背景音乐 */
  resumeMusic(): void {
    if (this.bgm) this.bgm.play().catch(() => {});
  }

  /** 静默引擎 / 风声 / 胎噪 / 天气循环音（返回选关时用），并播放熄火采样 */
  stopEngine(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain?.gain.setTargetAtTime(0, t, 0.12);
    this.windGain?.gain.setTargetAtTime(0, t, 0.15);
    this.skidGain?.gain.setTargetAtTime(0, t, 0.08);
    this.rainGain?.gain.setTargetAtTime(0, t, 0.2);
    this.snowGain?.gain.setTargetAtTime(0, t, 0.2);
    this.rainSampleGain?.gain.setTargetAtTime(0, t, 0.4);
    this.silenceSampleEngine();
    this.playSample('stop', 0.5);
  }

  /** 重置采样引擎循环（重开一局前用，不播放熄火声） */
  resetEngine(): void {
    this.silenceSampleEngine();
  }

  /** 启动引擎：播放启动采样；怠速 / 轰油循环由 update() 持续驱动 */
  startEngine(): void {
    if (!this.ctx) return;
    if (this.engineRunning) return;
    this.engineRunning = true;
    this.playSample('start', 0.75);
  }

  private silenceSampleEngine(): void {
    this.engineRunning = false;
    this.engineRevLevel = 0;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineIdleGain?.gain.setTargetAtTime(0, t, 0.1);
    this.engineRevGain?.gain.setTargetAtTime(0, t, 0.1);
  }

  private setupSampleEngine(): void {
    const ctx = this.ctx!;
    const idle = getEngineSample('idle');
    const rev = getEngineSample('rev');
    this.engineIdleGain = ctx.createGain();
    this.engineIdleGain.gain.value = 0;
    this.engineIdleGain.connect(this.engineBus!);
    this.engineRevGain = ctx.createGain();
    this.engineRevGain.gain.value = 0;
    this.engineRevGain.connect(this.engineBus!);
    if (idle) {
      const node = ctx.createBufferSource();
      node.buffer = idle;
      node.loop = true;
      node.connect(this.engineIdleGain);
      node.start();
      this.engineIdleNode = node;
    }
    if (rev) {
      const node = ctx.createBufferSource();
      node.buffer = rev;
      node.loop = true;
      node.connect(this.engineRevGain);
      node.start();
      this.engineRevNode = node;
    }
  }

  private setupSampleWeather(): void {
    const ctx = this.ctx!;
    const rain = getWeatherSample('rain');
    this.rainSampleGain = ctx.createGain();
    this.rainSampleGain.gain.value = 0;
    this.rainSampleGain.connect(this.weatherBus!);
    if (rain) {
      const node = ctx.createBufferSource();
      node.buffer = rain;
      node.loop = true;
      node.connect(this.rainSampleGain);
      node.start();
      this.rainSampleNode = node;
    }
  }

  private playWeatherSample(key: WeatherSampleKey, volume: number, toMaster = false): boolean {
    const ctx = this.ctx;
    if (!ctx || !this.master) return false;
    const buf = getWeatherSample(key);
    if (!buf) return false;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    const dur = Math.max(0.2, buf.duration);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), t + 0.06);
    g.gain.setValueAtTime(Math.max(0.001, volume), t + dur - 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(g);
    g.connect(toMaster ? this.master : (this.weatherBus ?? this.master));
    src.start(t);
    src.stop(t + dur + 0.05);
    return true;
  }

  private playSample(key: EngineSampleKey, volume: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const buf = getEngineSample(key);
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    const dur = Math.max(0.2, buf.duration);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), t + 0.08);
    g.gain.setValueAtTime(Math.max(0.001, volume), t + dur - 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(g);
    g.connect(this.engineBus ?? this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  private driveSampleEngine(speed: number, throttle: boolean, boost: boolean): void {
    if (!this.ctx || !this.engineIdleGain || !this.engineRevGain) return;
    const t = this.ctx.currentTime;
    // 轰油量：速度 + 油门 + 冲刺叠加，平滑过渡
    const target = Math.min(
      1,
      (speed / WORLD.maxSpeed) * 0.55 + (throttle ? 0.5 : 0) + (boost ? 0.3 : 0),
    );
    this.engineRevLevel += (target - this.engineRevLevel) * 0.18;
    const idleLevel = this.engineRunning ? 1 - this.engineRevLevel : 0;
    const revLevel = this.engineRunning ? this.engineRevLevel : 0;
    this.engineIdleGain.gain.setTargetAtTime(idleLevel * 1.0, t, 0.12);
    this.engineRevGain.gain.setTargetAtTime(revLevel * 1.0, t, 0.12);
    if (this.engineRevNode) {
      const rate = 0.86 + (speed / WORLD.maxSpeed) * 0.38 + (boost ? 0.1 : 0);
      this.engineRevNode.playbackRate.setTargetAtTime(rate, t, 0.15);
    }
  }

  update(speed: number, throttle: boolean, drift: boolean, boost: boolean): void {
    if (!this.ctx || !this.engineGain || !this.windGain || !this.skidGain || !this.rainGain || !this.snowGain) return;
    const t = this.ctx.currentTime;

    // 采样迟到补齐：init 时若采样尚未解码完成，就绪后在此补建采样节点
    if (!this.engineIdleNode && !this.engineRevNode && (getEngineSample('idle') || getEngineSample('rev'))) {
      this.setupSampleEngine();
    }
    if (!this.rainSampleNode && getWeatherSample('rain')) {
      this.setupSampleWeather();
    }

    // 引擎声：有采样就用四阶段采样，否则退回程序化振荡引擎
    if (this.engineIdleNode || this.engineRevNode) {
      this.engineGain.gain.setTargetAtTime(0, t, 0.1);
      this.driveSampleEngine(speed, throttle, boost);
    } else if (this.engineOscA && this.engineOscB && this.engineFilter) {
      const rpm = 700 + speed * 30 + (throttle ? 520 : 0) + (boost ? 260 : 0);
      this.engineOscA.frequency.setTargetAtTime(rpm, t, 0.06);
      this.engineOscB.frequency.setTargetAtTime(rpm * 0.5, t, 0.06);
      this.engineFilter.frequency.setTargetAtTime(420 + speed * 16 + (throttle ? 500 : 0), t, 0.1);
      this.engineGain.gain.setTargetAtTime(0.16 + (throttle ? 0.32 : 0.07) + (boost ? 0.16 : 0), t, 0.1);
    }

    this.windGain.gain.setTargetAtTime((speed / WORLD.maxSpeed) * 0.32 + this.windLevel, t, 0.15);
    this.skidGain.gain.setTargetAtTime(drift ? 0.16 : 0, t, 0.08);
    if (this.rainSampleNode) {
      // 有强降雨采样时用采样，程序化雨声静音
      this.rainGain.gain.setTargetAtTime(0, t, 0.35);
      this.rainSampleGain?.gain.setTargetAtTime(this.rainSampleLevel, t, 0.4);
    } else {
      this.rainGain.gain.setTargetAtTime(this.rainLevel, t, 0.35);
    }
    this.snowGain.gain.setTargetAtTime(this.snowLevel, t, 0.6);
  }

  setWeather(mode: 'sunny' | 'rain' | 'snow' | 'storm'): void {
    if (mode === 'storm') {
      this.rainLevel = 0.5;
      this.rainSampleLevel = 0.5;
      this.snowLevel = 0;
      this.windLevel = 0.16;
    } else if (mode === 'rain') {
      this.rainLevel = 0.34;
      this.rainSampleLevel = 0.4;
      this.snowLevel = 0;
      this.windLevel = 0.06;
    } else if (mode === 'snow') {
      this.rainLevel = 0;
      this.rainSampleLevel = 0;
      this.snowLevel = 0.12;
      this.windLevel = 0.1;
    } else {
      this.rainLevel = 0;
      this.rainSampleLevel = 0;
      this.snowLevel = 0;
      this.windLevel = 0;
    }
    // Natural transitions no longer play a sudden synthetic weather whoosh.
  }

  setRainIntensity(value:number):void{
    const rain=Math.max(0,Math.min(1,value));this.rainLevel=rain*.4;this.rainSampleLevel=rain*.45;
    this.windLevel=Math.max(this.snowLevel>0?.1:0,rain*.12);
  }

  private weatherWhoosh(mode: string): void {
    if (!this.ctx || !this.noiseBuffer || !this.master) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(mode === 'storm' ? 180 : 320, t);
    filter.frequency.exponentialRampToValueAtTime(mode === 'storm' ? 900 : 1400, t + 0.7);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.weatherBus ?? this.master);
    src.start(t);
    src.stop(t + 1);
  }

  thunder(): void {
    // 暂停时（AudioContext 挂起）不排队雷声，避免恢复瞬间集中炸响
    if (!this.ctx || this.ctx.state === 'suspended') return;
    // 间断性强烈雷声：只播放雷击采样的前段瞬态（约 3s），强增益直通主输出，
    // 避免 32s 长尾循环叠加变成闷雷。
    const buf = getWeatherSample('thunder');
    if (buf && this.master) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      const t = ctx.currentTime;
      const dur = Math.min(3.2, buf.duration);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(1.0, t + 0.03);
      g.gain.setValueAtTime(1.0, t + Math.max(0.05, dur - 0.55));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(g);
      g.connect(this.master);
      src.start(t);
      src.stop(t + dur + 0.05);
      return;
    }
    if (!this.ctx || !this.noiseBuffer || !this.master) return;
    const t = this.ctx.currentTime;
    // 低频轰鸣（程序化兜底也走主输出，保证强度）
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 90;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t + 0.2);
    gain.gain.linearRampToValueAtTime(1.0, t + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t + 0.2);
    src.stop(t + 2.7);
    // 高频爆裂声
    const crack = this.ctx.createBufferSource();
    crack.buffer = this.noiseBuffer;
    const crackFilter = this.ctx.createBiquadFilter();
    crackFilter.type = 'bandpass';
    crackFilter.frequency.value = 2800;
    const crackGain = this.ctx.createGain();
    crackGain.gain.setValueAtTime(0.55, t + 0.2);
    crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    crack.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(this.weatherBus ?? this.master);
    crack.start(t + 0.45);
    crack.stop(t + 0.75);
  }

  private makeNoiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  countdownBeep(step: number): void {
    this.tone(step === 0 ? 880 : 440, 0.22, 0.24);
  }

  go(): void {
    this.tone(880, 0.5, 0.32);
    this.tone(1320, 0.4, 0.2);
  }

  finish(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    notes.forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.34, 0.24), i * 140);
    });
  }

  boost(): void {
    this.tone(220, 0.7, 0.2, true);
  }

  itemPickup(): void {
    this.tone(523, 0.1, 0.22);
    this.tone(784, 0.12, 0.2);
    this.tone(1046, 0.16, 0.2);
  }

  itemFire(kind: string): void {
    if (kind === 'missile') this.tone(180, 0.5, 0.28, true);
    else if (kind === 'mine') this.tone(140, 0.22, 0.24);
    else if (kind === 'boost') this.boost();
    else this.tone(520, 0.3, 0.18);
  }

  itemHit(kind: string): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = kind === 'missile' ? 1600 : 900;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.42, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus ?? this.master!);
    src.start(t);
    src.stop(t + 0.35);
    if (kind === 'missile') this.tone(90, 0.4, 0.32, true);
    else this.tone(300, 0.22, 0.26);
  }

  shieldBlock(): void {
    this.tone(740, 0.16, 0.2);
    this.tone(1180, 0.2, 0.16);
  }

  confirmHit(): void {
    this.tone(1046, 0.12, 0.26);
    this.tone(1568, 0.18, 0.22);
  }

  collision(strength: number): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.28 * Math.max(0.25, strength), this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus ?? this.master!);
    src.start();
    src.stop(this.ctx.currentTime + 0.4);
  }

  private tone(freq: number, duration: number, volume: number, slide = false): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slide) osc.frequency.exponentialRampToValueAtTime(freq * 2.2, this.ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.sfxBus ?? this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + duration + 0.05);
  }
}
