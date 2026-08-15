import { WORLD } from '../core/constants';

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
  private noiseBuffer: AudioBuffer | null = null;
  private rainLevel = 0;
  private muted = false;

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
    this.engineGain.connect(this.master);
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
    this.windGain.connect(this.master);
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
    this.skidGain.connect(this.master);
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
    this.rainGain.connect(this.master);
    rainSrc.start();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.85, this.ctx.currentTime, 0.05);
    }
  }

  update(speed: number, throttle: boolean, drift: boolean, boost: boolean): void {
    if (!this.ctx || !this.engineOscA || !this.engineOscB || !this.engineFilter || !this.engineGain || !this.windGain || !this.skidGain || !this.rainGain) return;
    const t = this.ctx.currentTime;
    const rpm = 700 + speed * 30 + (throttle ? 520 : 0) + (boost ? 260 : 0);
    this.engineOscA.frequency.setTargetAtTime(rpm, t, 0.06);
    this.engineOscB.frequency.setTargetAtTime(rpm * 0.5, t, 0.06);
    this.engineFilter.frequency.setTargetAtTime(420 + speed * 16 + (throttle ? 500 : 0), t, 0.1);
    this.engineGain.gain.setTargetAtTime(0.045 + (throttle ? 0.15 : 0.035) + (boost ? 0.09 : 0), t, 0.1);
    this.windGain.gain.setTargetAtTime((speed / WORLD.maxSpeed) * 0.32, t, 0.15);
    this.skidGain.gain.setTargetAtTime(drift ? 0.16 : 0, t, 0.08);
    this.rainGain.gain.setTargetAtTime(this.rainLevel, t, 0.35);
  }

  setWeather(mode: 'sunny' | 'rain' | 'snow' | 'storm'): void {
    this.rainLevel = mode === 'storm' ? 0.4 : mode === 'rain' ? 0.22 : mode === 'snow' ? 0.06 : 0;
  }

  thunder(): void {
    if (!this.ctx || !this.noiseBuffer || !this.master) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 90;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t + 0.45);
    gain.gain.linearRampToValueAtTime(0.5, t + 0.55);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 2.4);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t + 0.45);
    src.stop(t + 2.5);
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
    gain.connect(this.master!);
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
    gain.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + duration + 0.05);
  }
}
