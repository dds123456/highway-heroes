import * as THREE from 'three';
import { WORLD } from '../core/constants';
import { EventBus } from '../core/events';
import { BikeEntity } from '../entities/BikeEntity';
import { TrackPath } from '../math/TrackPath';
import { clamp } from '../math/utils';

interface HudSnapshot {
  speed: number;
  lap: number;
  laps: number;
  rank: number;
  checkpoint: number;
  charge: number;
  boost: boolean;
  drifting: boolean;
  time: number;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function fmtTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const ms = Math.floor((t % 1) * 100);
  return `${String(m).padStart(1, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

export class HUD {
  private bus: EventBus;
  private track: TrackPath;
  private root: HTMLElement;
  private screens = new Map<string, HTMLElement>();
  private lapEl!: HTMLElement;
  private rankEl!: HTMLElement;
  private checkpointEl!: HTMLElement;
  private timeEl!: HTMLElement;
  private boostFill!: HTMLElement;
  private boostLabel!: HTMLElement;
  private driftFlag!: HTMLElement;
  private minimap!: HTMLCanvasElement;
  private speedCanvas!: HTMLCanvasElement;
  private bikes: BikeEntity[] = [];
  private lastSpeed = -1;
  private lastCharge = -1;
  private lastRank = -1;
  private lastLap = -1;
  private lastTime = -1;
  private lastMinimap = 0;
  private onRestart: (() => void) | null = null;
  private minimapPoints: THREE.Vector2[];
  private mapMinX = 0;
  private mapMaxX = 1;
  private mapMinZ = 0;
  private mapMaxZ = 1;

  constructor(bus: EventBus, track: TrackPath) {
    this.bus = bus;
    this.track = track;
    this.minimapPoints = track.pointsForMinimap(140);
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of this.minimapPoints) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.y);
      maxZ = Math.max(maxZ, p.y);
    }
    this.mapMinX = minX;
    this.mapMaxX = maxX;
    this.mapMinZ = minZ;
    this.mapMaxZ = maxZ;
    this.root = document.getElementById('hud-root')!;
    this.buildPersistent();
    this.buildScreens();
    this.subscribe();
    this.showScreen('title');
  }

  setBikes(bikes: BikeEntity[]): void {
    this.bikes = bikes;
  }

  setRestartHandler(handler: () => void): void {
    this.onRestart = handler;
  }

  private buildPersistent(): void {
    const safe = el('div', 'hud-safe');
    this.root.appendChild(safe);

    const left = el('div', 'hud-left');
    const panel = el('div', 'hud-panel');
    this.lapEl = el('div', 'hud-stat hud-lap');
    this.rankEl = el('div', 'hud-stat hud-rank');
    this.checkpointEl = el('div', 'hud-stat hud-checkpoint');
    this.timeEl = el('div', 'hud-stat hud-time');
    panel.append(this.lapEl, this.rankEl, this.checkpointEl, this.timeEl);
    left.appendChild(panel);

    const right = el('div', 'hud-right');
    this.minimap = el('canvas', 'hud-minimap');
    this.minimap.width = 170;
    this.minimap.height = 170;
    right.appendChild(this.minimap);

    const bottom = el('div', 'hud-bottom');
    const boost = el('div', 'hud-boost');
    this.boostLabel = el('div', 'hud-boost-label');
    const track = el('div', 'hud-boost-track');
    this.boostFill = el('div', 'hud-boost-fill');
    this.driftFlag = el('div', 'hud-drift');
    track.appendChild(this.boostFill);
    boost.append(this.boostLabel, track, this.driftFlag);
    bottom.appendChild(boost);

    this.speedCanvas = el('canvas', 'hud-speed');
    this.speedCanvas.width = 190;
    this.speedCanvas.height = 190;
    bottom.appendChild(this.speedCanvas);

    safe.append(left, right, bottom);
  }

  private buildScreens(): void {
    const title = el('div', 'screen screen-title');
    const titleCard = el('div', 'screen-card');
    const heading = el('h1', 'game-title');
    heading.textContent = '极速公路';
    const sub = el('div', 'game-sub');
    sub.textContent = 'HIGHWAY HEROES';
    const desc = el('div', 'game-desc');
    desc.textContent = '3 圈环道竞速 · 漂移蓄能 · 四车同场';
    const start = el('button', 'btn btn-primary');
    start.textContent = '开始比赛';
    start.addEventListener('click', () => this.bus.emit('audio:init', undefined));
    start.addEventListener('click', () => {
      if (this.onRestart) this.onRestart();
    });
    const controls = el('div', 'controls');
    controls.textContent = 'W/↑ 油门 · S/↓ 刹车 · A/D 转向 · Space 漂移 · W+Q 氮气';
    titleCard.append(heading, sub, desc, start, controls);
    title.appendChild(titleCard);

    const countdown = el('div', 'screen screen-countdown');
    const count = el('div', 'count-number');
    count.textContent = '3';
    countdown.appendChild(count);

    const finish = el('div', 'screen screen-finish');
    const finishCard = el('div', 'screen-card');
    const finishTitle = el('h2', 'finish-title');
    finishTitle.textContent = '比赛结束';
    const finishRank = el('div', 'finish-rank');
    const finishTime = el('div', 'finish-time');
    const lapList = el('div', 'lap-list');
    const again = el('button', 'btn btn-primary');
    again.textContent = '再来一局';
    again.addEventListener('click', () => {
      if (this.onRestart) this.onRestart();
    });
    finishCard.append(finishTitle, finishRank, finishTime, lapList, again);
    finish.appendChild(finishCard);

    const paused = el('div', 'screen screen-paused');
    const pausedCard = el('div', 'screen-card');
    const pausedTitle = el('h2', 'pause-title');
    pausedTitle.textContent = '暂停';
    const resume = el('button', 'btn btn-primary');
    resume.textContent = '继续';
    resume.addEventListener('click', () => {
      if (this.onRestart) this.onRestart();
    });
    pausedCard.append(pausedTitle, resume);
    paused.appendChild(pausedCard);

    this.screens.set('title', title);
    this.screens.set('countdown', countdown);
    this.screens.set('finish', finish);
    this.screens.set('paused', paused);
    this.root.append(title, countdown, finish, paused);
  }

  private subscribe(): void {
    this.bus.on('race:state', ({ state, countdown }) => {
      if (state === 'countdown') {
        this.showScreen('countdown');
        this.updateCountdown(countdown);
      } else if (state === 'racing') {
        this.showScreen('');
      } else if (state === 'finished') {
        this.showScreen('finish');
      }
    });
    this.bus.on('race:finish', ({ rank, total, laps }) => {
      const title = this.screens.get('finish')!;
      const rankEl = title.querySelector('.finish-rank') as HTMLElement;
      const timeEl = title.querySelector('.finish-time') as HTMLElement;
      const lapEl = title.querySelector('.lap-list') as HTMLElement;
      const rankText = rank === 1 ? '冠军' : `第 ${rank} 名`;
      rankEl.textContent = `最终名次：${rankText}`;
      timeEl.textContent = `总用时：${fmtTime(total)}`;
      lapEl.textContent = laps.length ? `单圈：${laps.map((t) => fmtTime(t)).join(' · ')}` : '';
    });
    this.bus.on('hud:snapshot', (snap) => this.updatePersistent(snap));
    this.bus.on('screen:show', ({ screen }) => this.showScreen(screen));
  }

  showScreen(name: string): void {
    this.screens.forEach((node, key) => {
      node.classList.toggle('visible', key === name);
    });
    if (name === 'title' || name === 'finish') {
      this.root.querySelector('.hud-safe')?.classList.toggle('dimmed', true);
    } else {
      this.root.querySelector('.hud-safe')?.classList.toggle('dimmed', false);
    }
  }

  private updateCountdown(countdown: number): void {
    const num = this.screens.get('countdown')!.querySelector('.count-number') as HTMLElement;
    const value = Math.max(0, Math.ceil(countdown));
    num.textContent = value > 0 ? String(value) : 'GO!';
    num.classList.toggle('go', value <= 0);
  }

  private updatePersistent(snap: HudSnapshot): void {
    if (snap.lap !== this.lastLap) {
      this.lapEl.textContent = `圈数 ${snap.lap} / ${snap.laps}`;
      this.lastLap = snap.lap;
    }
    if (snap.rank !== this.lastRank) {
      this.rankEl.textContent = `名次 ${snap.rank} 位`;
      this.lastRank = snap.rank;
    }
    this.checkpointEl.textContent = `检查点 ${Math.max(0, snap.checkpoint)}`;
    const time = Math.floor(snap.time * 10);
    if (time !== this.lastTime) {
      this.timeEl.textContent = `计时 ${fmtTime(snap.time)}`;
      this.lastTime = time;
    }
    if (Math.abs(snap.charge - this.lastCharge) > 0.005) {
      this.boostFill.style.width = `${Math.round(snap.charge * 100)}%`;
      this.boostLabel.textContent = snap.boost ? '氮气冲刺' : snap.charge >= 0.98 ? '氮气就绪' : '漂移能量';
      this.boostFill.classList.toggle('ready', snap.charge >= 0.98);
      this.lastCharge = snap.charge;
    }
    this.driftFlag.classList.toggle('active', snap.drifting);
    if (Math.abs(snap.speed - this.lastSpeed) > 0.35) {
      this.drawSpeed(snap.speed);
      this.lastSpeed = snap.speed;
    }
    const now = performance.now();
    if (now - this.lastMinimap > 100) {
      this.drawMinimap();
      this.lastMinimap = now;
    }
  }

  private drawSpeed(speed: number): void {
    const ctx = this.speedCanvas.getContext('2d')!;
    const cx = 95;
    const cy = 95;
    const r = 76;
    ctx.clearRect(0, 0, 190, 190);
    ctx.strokeStyle = '#14141c';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 5, Math.PI * 0.75, Math.PI * 2.25);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, Math.PI * 0.75, Math.PI * 2.25);
    ctx.stroke();
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * 0.75 + (i / 12) * Math.PI * 1.5;
      const major = i % 3 === 0;
      ctx.strokeStyle = major ? '#14141c' : '#5b6472';
      ctx.lineWidth = major ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8));
      ctx.lineTo(cx + Math.cos(a) * (r - (major ? 18 : 14)), cy + Math.sin(a) * (r - (major ? 18 : 14)));
      ctx.stroke();
    }
    const kmh = Math.round(speed * 3.6);
    const angle = Math.PI * 0.75 + (clamp(speed / WORLD.maxSpeed, 0, 1.1) / 1.1) * Math.PI * 1.5;
    ctx.strokeStyle = '#ff4d5e';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * (r - 24), cy + Math.sin(angle) * (r - 24));
    ctx.stroke();
    ctx.fillStyle = '#14141c';
    ctx.font = 'bold 34px "Arial Black", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(kmh), cx, cy - 8);
    ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
    ctx.fillText('km/h', cx, cy + 26);
  }

  private drawMinimap(): void {
    const ctx = this.minimap.getContext('2d')!;
    ctx.clearRect(0, 0, 170, 170);
    const pts = this.minimapPoints;
    const minX = this.mapMinX;
    const maxX = this.mapMaxX;
    const minZ = this.mapMinZ;
    const maxZ = this.mapMaxZ;
    const pad = 12;
    const scaleX = (170 - pad * 2) / Math.max(1, maxX - minX);
    const scaleZ = (170 - pad * 2) / Math.max(1, maxZ - minZ);
    const scale = Math.min(scaleX, scaleZ);
    const ox = (170 - (maxX - minX) * scale) / 2;
    const oz = (170 - (maxZ - minZ) * scale) / 2;
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const x = ox + (pts[i].x - minX) * scale;
      const y = oz + (pts[i].y - minZ) * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = '#14141c';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const colors = ['#ff4d5e', '#38b6ff', '#57d68d', '#c86dff'];
    for (let i = 0; i < this.bikes.length; i++) {
      const bike = this.bikes[i];
      if (!bike.group) continue;
      const f = this.track.frameAt(bike.progress);
      const x = ox + (f.position.x - minX) * scale;
      const y = oz + (f.position.z - minZ) * scale;
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.arc(x, y, i === 0 ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#14141c';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}
