import * as THREE from 'three';
import { BIKES, ITEM_COLORS, RIDERS, TRACKS, WORLD } from '../core/constants';
import type { ItemKind, TrackId } from '../core/constants';
import { EventBus } from '../core/events';
import { MODES, MODE_ORDER } from '../core/GameMode';
import type { GameModeId } from '../core/GameMode';
import type { UIInputAction } from '../core/Input';
import { BikeEntity } from '../entities/BikeEntity';
import { TrackPath } from '../math/TrackPath';
import { clamp } from '../math/utils';
import { RecordStore } from '../records/RecordStore';
import { settingsStore } from '../settings/SettingsStore';
import { getWrapTexture, WRAP_DEFS } from '../render/wrapTextures';
import { SelectionScene } from './SelectionScene';
import { CharacterEditor } from './CharacterEditor';
import { fetchLeaderboard, type LeaderboardEntry } from '../net';

export interface Selection {
  bike: number;
  rider: number;
  track: number;
  colorway: number;
  mode: GameModeId;
  /** 选车台「车衣预览」开关（仅预览，不进入比赛） */
  wrap: boolean;
}

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
  lapTime: number;
  mode: GameModeId;
}

const ITEM_LABEL: Record<ItemKind, string> = {
  missile: '导弹',
  shield: '护盾',
  boost: '加速',
  mine: '地雷',
};

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

function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const tenth = Math.floor((ms % 1000) / 100);
  return `${s}.${tenth}s`;
}

export class HUD {
  private bus: EventBus;
  private track: TrackPath | null = null;
  private root: HTMLElement;
  private screens = new Map<string, HTMLElement>();
  private currentScreen = '';
  private mode: GameModeId = 'race';
  private lapEl!: HTMLElement;
  private rankEl!: HTMLElement;
  private checkpointEl!: HTMLElement;
  private timeEl!: HTMLElement;
  private ttCurrentEl!: HTMLElement;
  private ttLastEl!: HTMLElement;
  private ttBestEl!: HTMLElement;
  private ttDeltaEl!: HTMLElement;
  private driftScoreEl!: HTMLElement;
  private driftTimeEl!: HTMLElement;
  private driftComboEl!: HTMLElement;
  private boostFill!: HTMLElement;
  private boostLabel!: HTMLElement;
  private driftFlag!: HTMLElement;
  private itemSlot!: HTMLElement;
  private minimap!: HTMLCanvasElement;
  private speedCanvas!: HTMLCanvasElement;
  private bikes: BikeEntity[] = [];
  private lastSpeed = -1;
  private lastCharge = -1;
  private lastRank = -1;
  private lastLap = -1;
  private lastTime = -1;
  private lastMinimap = 0;
  private onSelectStart: ((sel: Selection) => void) | null = null;
  private onRestart: (() => void) | null = null;
  private onResume: (() => void) | null = null;
  private onExitToSelect: (() => void) | null = null;
  private minimapPoints: THREE.Vector2[] = [];
  private mapMinX = 0;
  private mapMaxX = 1;
  private mapMinZ = 0;
  private mapMaxZ = 1;
  private selection: Selection = { bike: 0, rider: 0, track: 0, colorway: 0, mode: 'race', wrap: false };
  private selectionScene: SelectionScene | null = null;
  private characterEditor!: CharacterEditor;
  private turntableHolder!: HTMLElement;
  private bikeNameEl!: HTMLElement;
  private statEls: HTMLElement[] = [];
  private bikeDots!: HTMLElement;
  private stageEl!: HTMLElement;
  private riderButtons: HTMLElement[] = [];
  private trackButtons: HTMLElement[] = [];
  private colorwayButtons: HTMLElement[] = [];
  private modeButtons: HTMLElement[] = [];
  private modePbEl!: HTMLElement;
  private startBtnEl!: HTMLElement;
  private colorwayLabel!: HTMLElement;
  private wrapButton!: HTMLElement;
  private wrapLabel!: HTMLElement;
  private modeNextBtn!: HTMLElement;
  private garagePrevBtn!: HTMLElement;
  private garageNextBtn!: HTMLElement;
  private trackPrevBtn!: HTMLElement;
  private recordTableEl!: HTMLElement;
  private leaderboardEl!: HTMLElement;
  private rotateHint!: HTMLElement;
  private hitFeedback!: HTMLElement;
  private hitArrow!: HTMLElement;
  private raceHint!: HTMLElement;
  private helpBtn!: HTMLElement;
  private finishTitleEl!: HTMLElement;
  private finishRankEl!: HTMLElement;
  private finishTimeEl!: HTMLElement;
  private finishLapsEl!: HTMLElement;
  private finishSubEl!: HTMLElement;
  private minimapFlashIndex = -1;
  private minimapFlashUntil = 0;
  private hitFeedbackTimer = 0;
  private onHelpToggle: (() => void) | null = null;
  private onPauseToggle: (() => void) | null = null;
  private onSettingsToggle: (() => void) | null = null;
  private pauseBtn!: HTMLElement;
  private lastLapMs = 0;
  private ttPbMs: number | null = null;

  constructor(bus: EventBus) {
    this.bus = bus;
    this.root = document.getElementById('hud-root')!;
    this.buildPersistent();
    this.buildScreens();
    this.subscribe();
    this.updateSelectionUi();
    this.showScreen('mode');
    window.addEventListener('resize', () => this.updateRotateHint());
    this.updateRotateHint();
  }

  setBikes(bikes: BikeEntity[]): void {
    this.bikes = bikes;
  }

  setTrack(track: TrackPath): void {
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
  }

  setMode(mode: GameModeId): void {
    // 关键修复：点选模式卡片时，把选择持久化进 selection.mode。
    // 此前只改了 HUD 的展示态，导致开始按钮仍以默认「竞速赛」启动，
    // 三种模式（计时赛 / 漂移赛 / 沙盒）成了「空有入口」。
    this.selection.mode = mode;
    this.mode = mode;
    document.body.setAttribute('data-mode', mode);
    this.applyModeVisibility();
    this.updateModeButtons();
    this.updateSelectionUi();
  }

  setSelectStartHandler(handler: (sel: Selection) => void): void {
    this.onSelectStart = handler;
  }

  setRestartHandler(handler: () => void): void {
    this.onRestart = handler;
  }

  setResumeHandler(handler: () => void): void {
    this.onResume = handler;
  }

  setExitToSelectHandler(handler: () => void): void {
    this.onExitToSelect = handler;
  }

  setHelpToggleHandler(handler: () => void): void {
    this.onHelpToggle = handler;
  }

  setPauseToggleHandler(handler: () => void): void {
    this.onPauseToggle = handler;
  }

  setSettingsToggleHandler(handler: () => void): void {
    this.onSettingsToggle = handler;
  }

  getSelection(): Selection {
    return { ...this.selection };
  }

  renderSelection(dt: number): void {
    this.selectionScene?.render(dt);
    this.characterEditor?.render(dt);
  }

  // ── 菜单手柄导航 ─────────────────────────────────────────
  handleUiAction(action: UIInputAction): void {
    if (action === 'confirm') {
      const ae = document.activeElement as HTMLElement | null;
      if (ae && ae.tagName === 'BUTTON') ae.click();
      return;
    }
    if (action === 'back') {
      if (this.currentScreen === 'track') {this.showScreen('garage');return;}
      if (this.currentScreen === 'garage') {this.showScreen('mode');return;}
      if (this.currentScreen === 'face') {this.showScreen('mode');return;}
      if (this.currentScreen === 'paused' || this.currentScreen === 'finish') this.onExitToSelect?.();
      else if (this.currentScreen === 'help') this.onHelpToggle?.();
      else if (this.currentScreen === 'settings') this.onSettingsToggle?.();
      return;
    }
    const delta = action === 'down' || action === 'right' ? 1 : -1;
    const active=document.activeElement;
    if(this.currentScreen==='face' && active instanceof HTMLInputElement && active.type==='range' && (action==='left'||action==='right')){
      if(action==='right')active.stepUp();else active.stepDown();active.dispatchEvent(new Event('input',{bubbles:true}));return;
    }
    const screen = this.screens.get(this.currentScreen);
    if (!screen) return;
    const items = Array.from(screen.querySelectorAll<HTMLElement>('button, input')).filter((e) => e.offsetParent !== null);
    if (items.length === 0) return;
    const current = document.activeElement as HTMLElement | null;
    let idx = items.indexOf(current as HTMLElement);
    if (idx < 0) idx = delta > 0 ? -1 : items.length;
    idx = (idx + delta + items.length) % items.length;
    items[idx].focus();
  }

  // ── 持久 HUD ─────────────────────────────────────────────
  private buildPersistent(): void {
    const safe = el('div', 'hud-safe');
    this.root.appendChild(safe);

    const left = el('div', 'hud-left');
    const panel = el('div', 'hud-panel');
    this.lapEl = el('div', 'hud-stat hud-lap');
    this.rankEl = el('div', 'hud-stat hud-rank');
    this.checkpointEl = el('div', 'hud-stat hud-checkpoint');
    this.timeEl = el('div', 'hud-stat hud-time');
    this.ttCurrentEl = el('div', 'hud-stat hud-tt');
    this.ttLastEl = el('div', 'hud-stat hud-tt');
    this.ttBestEl = el('div', 'hud-stat hud-tt');
    this.ttDeltaEl = el('div', 'hud-stat hud-tt hud-delta');
    this.driftScoreEl = el('div', 'hud-stat hud-drift');
    this.driftTimeEl = el('div', 'hud-stat hud-drift');
    this.driftComboEl = el('div', 'hud-stat hud-drift');
    panel.append(
      this.lapEl,
      this.rankEl,
      this.checkpointEl,
      this.timeEl,
      this.ttCurrentEl,
      this.ttLastEl,
      this.ttBestEl,
      this.ttDeltaEl,
      this.driftScoreEl,
      this.driftTimeEl,
      this.driftComboEl,
    );
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

    this.itemSlot = el('div', 'hud-item');
    this.itemSlot.textContent = '道具槽为空 · 驶向发光拾取物';
    bottom.appendChild(this.itemSlot);

    this.speedCanvas = el('canvas', 'hud-speed');
    this.speedCanvas.width = 190;
    this.speedCanvas.height = 190;
    bottom.appendChild(this.speedCanvas);

    safe.append(left, right, bottom);

    this.hitFeedback = el('div', 'hit-feedback');
    this.root.appendChild(this.hitFeedback);
    this.hitArrow = el('div', 'hit-arrow');
    this.hitArrow.textContent = '▶';
    this.root.appendChild(this.hitArrow);

    this.raceHint = el('div', 'race-hint');
    this.root.appendChild(this.raceHint);

    this.pauseBtn = el('button', 'hud-pause');
    this.pauseBtn.textContent = '⏸';
    this.pauseBtn.title = '暂停';
    this.pauseBtn.addEventListener('click', () => this.onPauseToggle?.());
    this.root.appendChild(this.pauseBtn);

    this.helpBtn = el('button', 'hud-help');
    this.helpBtn.textContent = '?';
    this.helpBtn.title = '操作说明';
    this.helpBtn.addEventListener('click', () => this.onHelpToggle?.());
    this.root.appendChild(this.helpBtn);

    this.applyModeVisibility();
  }

  private applyModeVisibility(): void {
    const m = this.mode;
    const show = (node: HTMLElement, on: boolean): void => {
      node.style.display = on ? '' : 'none';
    };
    show(this.lapEl, m === 'race' || m === 'time-trial');
    show(this.rankEl, m === 'race');
    show(this.checkpointEl, m === 'race');
    show(this.timeEl, m === 'race' || m === 'sandbox');
    show(this.ttCurrentEl, m === 'time-trial');
    show(this.ttLastEl, m === 'time-trial');
    show(this.ttBestEl, m === 'time-trial');
    show(this.ttDeltaEl, m === 'time-trial');
    show(this.driftScoreEl, m === 'drift');
    show(this.driftTimeEl, m === 'drift');
    show(this.driftComboEl, m === 'drift');
    show(this.itemSlot, m === 'race');
    show(this.driftFlag, m !== 'drift');
  }

  // ── 界面 ─────────────────────────────────────────────────
  private buildScreens(): void {
    this.buildFaceScreen();
    this.buildModeScreen();
    this.buildGarageScreen();
    this.buildTrackScreen();
    this.buildCountdownScreen();
    this.buildFinishScreen();
    this.buildPausedScreen();
    this.buildHelpScreen();
    this.buildSettingsScreen();
    this.renderRecordTables();
  }

  private buildHelpScreen(): void {
    const screen = el('div', 'screen screen-help');
    const card = el('div', 'screen-card');
    const title = el('h2', 'pause-title');
    title.textContent = '操作说明';
    const list = el('div', 'help-list');
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    list.innerHTML = (
      isTouch
        ? '<b>手机（自动油门）</b><br>◀ ▶ 触屏转向<br>漂移 按钮 · 氮气 按钮<br>道具 按钮 = 释放道具'
        : '<b>键盘</b><br>W / ↑ 油门 · S / ↓ 刹车<br>A/D 或 ←/→ 转向<br>Space / X 漂移（蓄氮气）<br>W+Q 氮气冲刺 · E 道具<br><b>手柄</b><br>左摇杆转向 · RT 油门 · LT 刹车<br>A 漂移 · Y 氮气 · X 道具<br>Start 暂停 · B 返回'
    ) +
      '<br><br><b>玩法</b><br>漂移蓄满「氮气」可冲刺<br>撞到赛道上的「礼盒」捡道具<br>导弹 / 地雷可攻击对手<br>护盾可抵挡一次攻击<br>计时赛没有对手与道具，追求最快圈速';
    const close = el('button', 'btn btn-primary');
    close.textContent = '关闭';
    close.addEventListener('click', () => this.onHelpToggle?.());
    card.append(title, list, close);
    screen.appendChild(card);
    this.screens.set('help', screen);
    this.root.appendChild(screen);
  }

  private buildSettingsScreen(): void {
    const screen = el('div', 'screen screen-settings');
    const card = el('div', 'screen-card');
    const title = el('h2', 'pause-title');
    title.textContent = '设置';
    const steerRow = this.buildSteerRow();
    const sfxRow = this.buildVolumeRow('音效音量', 'sfx', 'settings:sfx-volume');
    const engineRow = this.buildVolumeRow('引擎音量', 'engine', 'settings:engine-volume');
    const weatherRow = this.buildVolumeRow('天气音量', 'weather', 'settings:weather-volume');
    const musicRow = this.buildVolumeRow('音乐音量', 'music', 'settings:music-volume');
    const close = el('button', 'btn btn-primary');
    close.textContent = '关闭';
    close.addEventListener('click', () => this.onSettingsToggle?.());
    card.append(title, steerRow, sfxRow, engineRow, weatherRow, musicRow, close);
    screen.appendChild(card);
    this.screens.set('settings', screen);
    this.root.appendChild(screen);
  }

  private buildVolumeRow(
    label: string,
    key: 'sfx' | 'engine' | 'weather' | 'music',
    eventKey: 'settings:sfx-volume' | 'settings:engine-volume' | 'settings:weather-volume' | 'settings:music-volume',
  ): HTMLElement {
    const row = el('div', 'volume-row');
    const lab = el('span', 'volume-label');
    lab.textContent = label;
    const input = el('input', 'volume-slider');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.step = '1';
    const stored = settingsStore.get()[key];
    input.value = String(Math.round(stored * 100));
    input.addEventListener('input', () => this.bus.emit(eventKey, Number(input.value) / 100));
    row.append(lab, input);
    return row;
  }

  private buildSteerRow(): HTMLElement {
    const row = el('div', 'volume-row');
    const lab = el('span', 'volume-label');
    lab.textContent = '转向灵敏度';
    const wrap = el('div', 'steer-value');
    const input = el('input', 'volume-slider');
    input.type = 'range';
    input.min = '50';
    input.max = '250';
    input.step = '10';
    const initial = settingsStore.get().steer;
    input.value = String(Math.round(initial * 100));
    const readout = el('span', 'steer-readout');
    readout.textContent = `${initial.toFixed(1)}×`;
    input.addEventListener('input', () => {
      const v = clamp(Number(input.value) / 100, 0.5, 2.5);
      readout.textContent = `${v.toFixed(1)}×`;
      this.bus.emit('settings:steer-sensitivity', v);
    });
    wrap.append(input, readout);
    row.append(lab, wrap);
    return row;
  }

  private buildFaceScreen(): void {
    this.characterEditor = new CharacterEditor(() => this.showScreen('mode'));
    this.screens.set('face', this.characterEditor.element);
    this.root.appendChild(this.characterEditor.element);
  }

  // ── 首页：模式选择 + 最高纪录 ─────────────────────────────
  private buildModeScreen(): void {
    const screen = el('div', 'screen screen-mode');
    const card = el('div', 'screen-card mode-card-panel');
    const title = el('h1', 'game-title');
    title.textContent = '极速公路';
    const sub = el('div', 'game-sub');
    sub.textContent = 'PACIFIC MOTOR FESTIVAL / 01 选择玩法 → 02 车库 → 03 出发';

    // 模式卡片（4 种，均匀网格）
    const modeGrid = el('div', 'mode-grid');
    this.modeButtons = [];
    MODE_ORDER.forEach((id) => {
      const m = MODES[id];
      const c = el('button', 'btn glass mode-card');
      c.type = 'button';
      c.style.setProperty('--mode-accent', m.accent);
      const name = el('span', 'mode-name');
      name.textContent = m.name;
      const tagline = el('span', 'mode-tagline');
      tagline.textContent = m.tagline;
      const meta = el('span', 'mode-meta');
      meta.textContent = m.meta;
      c.append(name, tagline, meta);
      c.addEventListener('click', () => this.setMode(id));
      modeGrid.appendChild(c);
      this.modeButtons.push(c);
    });

    // 最高纪录表（圈速 / 总用时 / 漂移分）
    this.recordTableEl = el('div', 'record-table');

    // 全服排行榜（竞速赛总用时前十）
    this.leaderboardEl = el('div', 'leaderboard');

    const next = el('button', 'btn btn-primary glass');
    next.textContent = '进入车库 →';
    next.addEventListener('click', () => this.showScreen('garage'));
    this.modeNextBtn = next;

    const actionRow = el('div', 'select-row');
    const faceBtn = el('button', 'btn glass');
    faceBtn.textContent = '角色定制 · 捏脸与体型';
    faceBtn.addEventListener('click', () => this.showScreen('face'));
    const helpBtn = el('button', 'btn glass');
    helpBtn.textContent = '操作说明';
    helpBtn.addEventListener('click', () => this.onHelpToggle?.());
    const settingsBtn = el('button', 'btn glass');
    settingsBtn.textContent = '设置';
    settingsBtn.addEventListener('click', () => this.onSettingsToggle?.());
    actionRow.append(faceBtn, helpBtn, settingsBtn);

    const intro = el('p', 'festival-intro');
    intro.textContent = '向公路出发。选择一场赛事，或放慢节奏，自由巡航。';
    const records = document.createElement('details');records.className='festival-records';
    const summary = document.createElement('summary');summary.textContent='成绩与排行榜';
    records.append(summary,this.recordTableEl,this.leaderboardEl);
    card.append(sub, title, intro, modeGrid, next, actionRow, records);
    screen.appendChild(card);
    this.screens.set('mode', screen);
    this.root.appendChild(screen);
  }

  // ── 第二步：选车（车手 / 配色 / 车衣） ─────────────────────
  private buildGarageScreen(): void {
    const screen = el('div', 'screen screen-garage');
    const layout = el('div', 'select-layout');

    this.stageEl = el('div', 'select-stage');
    this.turntableHolder = el('div', 'turntable-holder');
    this.bikeNameEl = el('div', 'select-bike-name');
    const stats = el('div', 'select-stats');
    this.statEls = [];
    for (const label of ['速度', '加速', '操控', '氮气']) {
      const row = el('div', 'stat-row');
      const lab = el('span', 'stat-label');
      lab.textContent = label;
      const bar = el('span', 'stat-bar');
      const fill = el('span', 'stat-fill');
      bar.appendChild(fill);
      row.append(lab, bar);
      stats.appendChild(row);
      this.statEls.push(fill);
    }
    this.bikeDots = el('div', 'select-dots');
    const prev = el('button', 'btn btn-mini glass');
    prev.textContent = '◀';
    prev.addEventListener('click', () => this.cycleBike(-1));
    const next = el('button', 'btn btn-mini glass');
    next.textContent = '▶';
    next.addEventListener('click', () => this.cycleBike(1));
    const arrows = el('div', 'select-arrows');
    arrows.append(prev, this.bikeDots, next);
    this.stageEl.append(this.turntableHolder, this.bikeNameEl, stats, arrows);

    const side = el('div', 'select-side');
    const title = el('h1', 'game-title');
    title.textContent = '你的车库';
    const sub = el('div', 'game-sub');
    sub.textContent = '02 / 03 · 拖动模型查看 · 车手 / 配色 / 车衣';

    const riderRow = el('div', 'select-row');
    const riderLab = el('span', 'select-row-label');
    riderLab.textContent = '车手';
    riderRow.appendChild(riderLab);
    this.riderButtons = [];
    RIDERS.forEach((r, i) => {
      const b = el('button', 'btn btn-chip glass');
      b.textContent = r.name;
      b.addEventListener('click', () => this.setRider(i));
      riderRow.appendChild(b);
      this.riderButtons.push(b);
    });

    const colorRow = el('div', 'select-row');
    const colorLab = el('span', 'select-row-label');
    colorLab.textContent = '配色';
    colorRow.appendChild(colorLab);
    const swatches = el('div', 'colorway-swatches');
    for (let i = 0; i < 4; i++) {
      const b = el('button', 'btn btn-chip colorway-swatch glass');
      b.type = 'button';
      b.addEventListener('click', () => this.setColorway(i));
      swatches.appendChild(b);
      this.colorwayButtons.push(b);
    }
    this.colorwayLabel = el('span', 'colorway-label');
    colorRow.append(swatches, this.colorwayLabel);

    const wrapRow = el('div', 'select-row');
    const wrapLab = el('span', 'select-row-label');
    wrapLab.textContent = '车衣';
    const wrapToggle = el('button', 'btn btn-chip wrap-toggle glass');
    wrapToggle.type = 'button';
    wrapToggle.textContent = '预览';
    wrapToggle.addEventListener('click', () => this.toggleWrap());
    this.wrapButton = wrapToggle;
    this.wrapLabel = el('span', 'wrap-label');
    wrapRow.append(wrapLab, wrapToggle, this.wrapLabel);

    const nav = el('div', 'select-row');
    const back = el('button', 'btn glass');
    back.textContent = '上一步';
    back.addEventListener('click', () => this.showScreen('mode'));
    const go = el('button', 'btn btn-primary glass');
    go.textContent = '下一步：地图';
    go.addEventListener('click', () => this.showScreen('track'));
    nav.append(back, go);

    side.append(title, sub, riderRow, colorRow, wrapRow, nav);
    layout.append(this.stageEl, side);
    screen.appendChild(layout);
    this.screens.set('garage', screen);
    this.root.appendChild(screen);
  }

  // ── 第三步：地图 + 开跑 ──────────────────────────────────
  private buildTrackScreen(): void {
    const screen = el('div', 'screen screen-track');
    const card = el('div', 'screen-card');
    const title = el('h1', 'game-title');
    title.textContent = '选择地图';
    const sub = el('div', 'game-sub');
    sub.textContent = '03 / 03 · 选择路线 · 确认出发';

    const trackRow = el('div', 'select-row');
    const trackLab = el('span', 'select-row-label');
    trackLab.textContent = '地图';
    trackRow.appendChild(trackLab);
    this.trackButtons = [];
    TRACKS.forEach((t, i) => {
      const b = el('button', 'btn btn-chip glass');
      b.textContent = t.name;
      b.classList.add('festival-route');
      b.dataset.route=t.id;
      const description=el('span','route-description');
      description.textContent=i===0?'海岸公路 · 晴空与城镇':i===1?'荒漠峡谷 · 岩壁与弯道':'高山隘口 · 雪景与山路';
      b.appendChild(description);
      b.addEventListener('click', () => this.selectTrack(i));
      trackRow.appendChild(b);
      this.trackButtons.push(b);
    });

    this.modePbEl = el('div', 'mode-pb');

    this.startBtnEl = el('button', 'btn btn-primary btn-start glass');
    this.startBtnEl.addEventListener('click', () => {
      this.bus.emit('audio:init', undefined);
      this.onSelectStart?.(this.getSelection());
    });

    const nav = el('div', 'select-row');
    const back = el('button', 'btn glass');
    back.textContent = '上一步';
    back.addEventListener('click', () => this.showScreen('garage'));
    nav.append(back, this.startBtnEl);

    card.append(title, sub, trackRow, this.modePbEl, nav);
    screen.appendChild(card);
    this.screens.set('track', screen);
    this.root.appendChild(screen);
  }

  /** 渲染首页最高纪录表（展示三张地图各模式最佳成绩） */
  private renderRecordTables(): void {
    if (!this.recordTableEl) return;
    this.recordTableEl.innerHTML = '';
    const title = el('div', 'record-title');
    title.textContent = '最高纪录';
    this.recordTableEl.appendChild(title);

    const wrap = el('div', 'record-tracks');
    for (const track of TRACKS) {
      const block = el('div', 'record-track');
      const head = el('div', 'record-track-name');
      head.textContent = track.name;
      block.appendChild(head);

      const rows: Array<[string, string]> = [];
      const raceBest = RecordStore.getBest(track.id, 'race');
      rows.push(['竞速', raceBest ? fmtTime(raceBest.totalTimeMs / 1000) : '—']);
      const ttBest = RecordStore.getBestLapMs(track.id, 'time-trial');
      rows.push(['圈速', ttBest ? fmtMs(ttBest) : '—']);
      const driftBest = RecordStore.getBest(track.id, 'drift');
      rows.push(['漂移分', driftBest?.driftScore ? String(driftBest.driftScore) : '—']);
      for (const [label, value] of rows) {
        const cell = el('div', 'record-cell');
        const k = el('span', 'record-key');
        k.textContent = label;
        const v = el('span', 'record-value');
        v.textContent = value;
        cell.append(k, v);
        block.appendChild(cell);
      }
      wrap.appendChild(block);
    }
    this.recordTableEl.appendChild(wrap);
  }

  /** 渲染首页全服排行榜（竞速赛总用时前十，含头像）。异步拉取，失败显示占位。 */
  private async renderLeaderboard(): Promise<void> {
    if (!this.leaderboardEl) return;
    this.leaderboardEl.innerHTML = '';
    const title = el('div', 'leaderboard-title');
    title.textContent = '🏆 全服竞速排行榜 · 前十';
    this.leaderboardEl.appendChild(title);

    const list = el('div', 'leaderboard-list');
    list.textContent = '加载中…';
    this.leaderboardEl.appendChild(list);

    if (document.querySelector('meta[name="app-mode"][content="offline"]')) {
      title.textContent = '本地单机版';
      list.textContent = '成绩保存在此浏览器，不连接在线排行榜。';
      return;
    }

    const entries = await fetchLeaderboard();

    if (entries.length === 0) {
      list.textContent = '暂无上榜记录，快去跑一局吧！';
      return;
    }

    list.textContent = '';
    entries.forEach((entry) => {
      const row = el('div', 'leaderboard-row');
      const rankEl = el('span', 'leaderboard-rank');
      rankEl.textContent = String(entry.rank);
      if (entry.rank <= 3) rankEl.classList.add('top');

      const avatar = el('img', 'leaderboard-avatar');
      if (entry.avatar) avatar.src = entry.avatar;
      else avatar.classList.add('fallback');
      avatar.alt = '';

      const name = el('span', 'leaderboard-name');
      name.textContent = entry.realname || entry.username;

      const timeEl = el('span', 'leaderboard-time');
      timeEl.textContent = fmtTime(entry.totalTimeMs / 1000);

      row.append(rankEl, avatar, name, timeEl);
      list.appendChild(row);
    });
  }


  private buildCountdownScreen(): void {
    const countdown = el('div', 'screen screen-countdown');
    const count = el('div', 'count-number');
    count.textContent = '3';
    countdown.appendChild(count);
    this.screens.set('countdown', countdown);
    this.root.appendChild(countdown);
  }

  private buildFinishScreen(): void {
    const finish = el('div', 'screen screen-finish');
    const card = el('div', 'screen-card');
    this.finishTitleEl = el('h2', 'finish-title');
    this.finishTitleEl.textContent = '比赛结束';
    this.finishRankEl = el('div', 'finish-rank');
    this.finishTimeEl = el('div', 'finish-time');
    this.finishLapsEl = el('div', 'lap-list');
    this.finishSubEl = el('div', 'finish-sub');
    const again = el('button', 'btn btn-primary');
    again.textContent = '再来一局';
    again.addEventListener('click', () => this.onRestart?.());
    const back = el('button', 'btn');
    back.textContent = '返回选关';
    back.addEventListener('click', () => this.onExitToSelect?.());
    card.append(this.finishTitleEl, this.finishRankEl, this.finishTimeEl, this.finishLapsEl, this.finishSubEl, again, back);
    finish.appendChild(card);
    this.screens.set('finish', finish);
    this.root.appendChild(finish);
  }

  private buildPausedScreen(): void {
    const paused = el('div', 'screen screen-paused');
    const card = el('div', 'screen-card');
    const title = el('h2', 'pause-title');
    title.textContent = '暂停';
    const resume = el('button', 'btn btn-primary');
    resume.textContent = '继续';
    resume.addEventListener('click', () => this.onResume?.());
    const restart = el('button', 'btn');
    restart.textContent = '重新开始';
    restart.addEventListener('click', () => this.onRestart?.());
    const settings = el('button', 'btn');
    settings.textContent = '设置';
    settings.addEventListener('click', () => this.onSettingsToggle?.());
    const back = el('button', 'btn');
    back.textContent = '返回选关';
    back.addEventListener('click', () => this.onExitToSelect?.());
    card.append(title, resume, restart, settings, back);
    paused.appendChild(card);
    this.screens.set('paused', paused);
    this.root.appendChild(paused);
  }

  // ── 选择逻辑 ─────────────────────────────────────────────
  private cycleBike(delta: number): void {
    this.selection.bike = (this.selection.bike + delta + BIKES.length) % BIKES.length;
    this.selection.colorway = 0;
    this.updateSelectionUi();
  }

  private setColorway(i: number): void {
    this.selection.colorway = i;
    this.updateSelectionUi();
  }

  private toggleWrap(): void {
    this.selection.wrap = !this.selection.wrap;
    this.updateSelectionUi();
  }

  private setRider(i: number): void {
    this.selection.rider = i;
    this.updateSelectionUi();
  }

  private selectTrack(i: number): void {
    this.selection.track = i;
    this.updateSelectionUi();
  }

  private updateModeButtons(): void {
    this.modeButtons.forEach((b, i) => b.classList.toggle('active', MODE_ORDER[i] === this.mode));
  }

  private refreshPb(): void {
    const track = TRACKS[this.selection.track];
    const best = RecordStore.getBest(track.id, this.mode);
    let text = '';
    if (this.mode === 'drift') {
      text = best && best.driftScore ? `最佳漂移分：${best.driftScore}` : '最佳漂移分：暂无';
    } else if (this.mode === 'time-trial') {
      const pb = RecordStore.getBestLapMs(track.id, this.mode);
      text = pb ? `个人最佳圈速：${fmtMs(pb)}` : '个人最佳圈速：暂无';
    } else {
      text = best ? `个人最佳总用时：${fmtTime(best.totalTimeMs / 1000)}` : '个人最佳总用时：暂无';
    }
    this.modePbEl.textContent = `${BIKES[this.selection.bike].name} · ${track.name} · ${MODES[this.mode].name} ｜ ${this.mode==='sandbox'?'无计时 / 无道具':text}`;
  }

  private updateSelectionUi(): void {
    const bike = BIKES[this.selection.bike];
    this.bikeNameEl.textContent = bike.name;
    const stats = [bike.stats.speed, bike.stats.accel, bike.stats.handling, bike.stats.nitro];
    this.statEls.forEach((fill, i) => {
      fill.style.width = `${stats[i]}%`;
    });
    this.bikeDots.innerHTML = '';
    BIKES.forEach((_, i) => {
      const dot = el('span', 'dot' + (i === this.selection.bike ? ' active' : ''));
      this.bikeDots.appendChild(dot);
    });
    this.riderButtons.forEach((b, i) => b.classList.toggle('active', i === this.selection.rider));
    this.trackButtons.forEach((b, i) => b.classList.toggle('active', i === this.selection.track));
    const colorways = bike.colorways;
    this.colorwayButtons.forEach((b, i) => {
      const cw = colorways[i];
      if (!cw) return;
      b.style.background = cw.primary;
      b.title = cw.name;
      b.classList.toggle('active', i === this.selection.colorway);
    });
    this.colorwayLabel.textContent = colorways[this.selection.colorway]?.name ?? '';
    const wrapDef = WRAP_DEFS[bike.form];
    this.wrapButton.classList.toggle('active', this.selection.wrap);
    this.wrapButton.style.background = this.selection.wrap ? wrapDef.accent : '';
    this.wrapLabel.textContent = this.selection.wrap ? wrapDef.name : '原厂配色';
    const track = TRACKS[this.selection.track];
    this.stageEl.style.background = `linear-gradient(${track.skyTop}, ${track.skyMid} 45%, ${track.skyHorizon})`;
    const mode = MODES[this.selection.mode];
    this.startBtnEl.textContent = `开始 · ${mode.name.split(' ')[0]}`;
    this.updateModeButtons();
    this.refreshPb();
    const wrapTexture = this.selection.wrap ? getWrapTexture(bike.form) : null;
    this.selectionScene?.show(BIKES[this.selection.bike], RIDERS[this.selection.rider], colorways[this.selection.colorway], wrapTexture);
  }

  private ensureSelectionScene(): void {
    if (this.selectionScene) return;
    this.turntableHolder.innerHTML = '';
    this.selectionScene = new SelectionScene(this.turntableHolder);
    this.updateSelectionUi();
  }

  private disposeSelectionScene(): void {
    this.selectionScene?.dispose();
    this.selectionScene = null;
    this.turntableHolder.innerHTML = '';
  }

  private ensureFaceScene(): void { this.characterEditor.open(); }
  private disposeFaceScene(): void { this.characterEditor.dispose(); }

  private updateRotateHint(): void {
    const show = window.innerHeight > window.innerWidth && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);
    if (!this.rotateHint) {
      this.rotateHint = el('div', 'rotate-hint');
      this.rotateHint.textContent = '建议横屏游玩';
      document.body.appendChild(this.rotateHint);
    }
    this.rotateHint.classList.toggle('visible', show);
  }

  // ── 事件 ─────────────────────────────────────────────────
  private subscribe(): void {
    this.bus.on('race:state', ({ state, countdown }) => {
      if (state === 'countdown') {
        this.showScreen('countdown');
        this.updateCountdown(countdown);
      } else if (state === 'racing') {
        this.showScreen('');
        this.showRaceHint();
      } else if (state === 'finished') {
        this.showScreen('finish');
      }
    });
    this.bus.on('race:finish', ({ rank, total, laps, lapValid, bestLapMs }) => {
      if (this.mode === 'time-trial') {
        this.finishTitleEl.textContent = '计时赛结束';
        this.finishRankEl.textContent = '';
        const best = this.ttPbMs;
        this.finishTimeEl.textContent = `本局最佳圈：${fmtMs(bestLapMs)}`;
        this.finishLapsEl.textContent = laps.length
          ? `单圈：${laps.map((t, i) => `${fmtTime(t)}${lapValid[i] ? '' : '（无效）'}`).join(' · ')}`
          : '';
        this.finishSubEl.textContent = best ? `个人最佳：${fmtMs(best)}（${bestLapMs <= best ? '追平 / 刷新' : `差 ${fmtMs(bestLapMs - best)}`}）` : '个人最佳：暂无';
      } else {
        this.finishTitleEl.textContent = '比赛结束';
        this.finishRankEl.textContent = `最终名次：${rank === 1 ? '冠军' : `第 ${rank} 名`}`;
        this.finishTimeEl.textContent = `总用时：${fmtTime(total)}`;
        this.finishLapsEl.textContent = laps.length ? `单圈：${laps.map((t) => fmtTime(t)).join(' · ')}` : '';
        this.finishSubEl.textContent = '';
      }
    });
    this.bus.on('drift:finish', ({ score, best, isBest }) => {
      this.finishTitleEl.textContent = '漂移赛结束';
      this.finishRankEl.textContent = isBest ? '🏆 新纪录！' : '';
      this.finishTimeEl.textContent = `漂移得分：${score}`;
      this.finishLapsEl.textContent = '';
      this.finishSubEl.textContent = `个人最佳：${best}`;
    });
    this.bus.on('race:lap', ({ time, valid }) => {
      if (this.mode !== 'time-trial') return;
      this.lastLapMs = Math.round(time * 1000);
      this.ttLastEl.textContent = `上一圈：${fmtMs(this.lastLapMs)}${valid ? '' : '（无效）'}`;
      this.refreshPb();
      this.updateTtBest();
    });
    this.bus.on('hud:snapshot', (snap) => this.updatePersistent(snap));
    this.bus.on('hud:item', ({ kind }) => this.updateItem(kind));
    this.bus.on('hud:drift', ({ score, combo, timeLeft }) => {
      this.driftScoreEl.textContent = `漂移分 ${score}`;
      this.driftTimeEl.textContent = `剩余 ${Math.ceil(timeLeft)}s`;
      this.driftComboEl.textContent = `连击 ${combo.toFixed(1)}s`;
    });
    this.bus.on('screen:show', ({ screen }) => this.showScreen(screen));
  }

  private updateTtBest(): void {
    const track = TRACKS[this.selection.track];
    this.ttPbMs = RecordStore.getBestLapMs(track.id, 'time-trial');
    this.ttBestEl.textContent = `个人最佳：${this.ttPbMs ? fmtMs(this.ttPbMs) : '--'}`;
  }

  private updateItem(kind: ItemKind | null): void {
    if (!kind) {
      this.itemSlot.textContent = '道具槽为空 · 驶向发光拾取物';
      this.itemSlot.style.color = '#cedce5';
      return;
    }
    this.itemSlot.textContent = `${ITEM_LABEL[kind]} · E / 手柄 X 使用`;
    this.itemSlot.style.color = ITEM_COLORS[kind];
  }

  showHitFeedback(text: string, type: 'positive' | 'negative' | 'shield'): void {
    this.hitFeedback.textContent = text;
    this.hitFeedback.setAttribute('data-type', type);
    this.hitFeedback.classList.remove('show');
    void this.hitFeedback.offsetWidth;
    this.hitFeedback.classList.add('show');
    window.clearTimeout(this.hitFeedbackTimer);
    this.hitFeedbackTimer = window.setTimeout(() => this.hitFeedback.classList.remove('show'), 1400);
  }

  updateHitArrow(angleRad: number, visible: boolean): void {
    this.hitArrow.style.transform = `translate(-50%, -50%) rotate(${angleRad}rad) translateY(-120px)`;
    this.hitArrow.classList.toggle('show', visible);
  }

  flashMinimapTarget(index: number): void {
    this.minimapFlashIndex = index;
    this.minimapFlashUntil = performance.now() + 2200;
  }

  private showRaceHint(): void {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (this.mode === 'time-trial') {
      this.raceHint.textContent = isTouch ? '自动油门 · 追逐你的最快圈速' : 'W 油门 · A/D 转向 · 漂移蓄氮气冲刺';
    } else if (this.mode === 'drift') {
      this.raceHint.textContent = isTouch ? '持续漂移累积连击与分数' : 'Space/X 漂移 · 保持连击拿高分';
    } else if (this.mode === 'sandbox') {
      this.raceHint.textContent = '自由驾驶 · 无计时';
    } else {
      this.raceHint.textContent = isTouch ? '自动油门 · 触屏转向 · 漂移 / 氮气 / 道具' : 'W 油门 · A/D 转向 · 空格 漂移 · Q 氮气 · E 道具';
    }
    this.raceHint.classList.remove('show');
    void this.raceHint.offsetWidth;
    this.raceHint.classList.add('show');
  }

  showScreen(name: string): void {
    this.currentScreen = name;
    this.screens.forEach((node, key) => {
      node.classList.toggle('visible', key === name);
    });
    const safe = this.root.querySelector('.hud-safe') as HTMLElement | null;
    const dimmed = name === 'mode' || name === 'garage' || name === 'track' || name === 'face' || name === 'finish' || name === 'paused' || name === 'help' || name === 'settings';
    if (safe) {
      safe.classList.toggle('hidden', name === 'mode' || name === 'garage' || name === 'track' || name === 'face');
      safe.classList.toggle('dimmed', dimmed);
    }
    const ingame = name === '' || name === 'countdown';
    document.body.classList.toggle('ingame', ingame);
    document.body.classList.toggle('character-open', name === 'face');
    document.body.classList.toggle('festival-menu', ['mode','garage','track'].includes(name));
    if (name === 'garage') this.ensureSelectionScene();
    else this.disposeSelectionScene();
    if (name === 'face') this.ensureFaceScene();
    else this.disposeFaceScene();
    if (name === 'mode') {
      this.renderRecordTables();
      void this.renderLeaderboard();
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
    if (this.mode === 'time-trial') {
      const currentMs = Math.round(snap.lapTime * 1000);
      this.ttCurrentEl.textContent = `当前圈：${fmtMs(currentMs)}`;
      if (this.ttPbMs === null) this.updateTtBest();
      if (this.ttPbMs) {
        const delta = currentMs - this.ttPbMs;
        const sign = delta > 0 ? '+' : '';
        this.ttDeltaEl.textContent = `差值：${sign}${fmtMs(Math.abs(delta))}`;
        this.ttDeltaEl.classList.toggle('ahead', delta <= 0);
      }
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
    if (now - this.lastMinimap > 100 && this.track) {
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
    ctx.strokeStyle = '#e1e5df';
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
      ctx.strokeStyle = major ? '#e1e5df' : '#8b95a3';
      ctx.lineWidth = major ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8));
      ctx.lineTo(cx + Math.cos(a) * (r - (major ? 18 : 14)), cy + Math.sin(a) * (r - (major ? 18 : 14)));
      ctx.stroke();
    }
    const kmh = Math.round(speed * 3.6);
    const angle = Math.PI * 0.75 + (clamp(speed / WORLD.maxSpeed, 0, 1.1) / 1.1) * Math.PI * 1.5;
    ctx.strokeStyle = '#ceb374';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * (r - 24), cy + Math.sin(angle) * (r - 24));
    ctx.stroke();
    ctx.fillStyle = '#e1e5df';
    ctx.font = '500 34px "Bahnschrift", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(kmh), cx, cy - 8);
    ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
    ctx.fillText('km/h', cx, cy + 26);
  }

  private drawMinimap(): void {
    if (!this.track) return;
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
    ctx.strokeStyle = '#211e2e';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const colors = ['#ff4d5e', '#38b6ff', '#ffd23f', '#b06bff'];
    for (let i = 0; i < this.bikes.length; i++) {
      const bike = this.bikes[i];
      if (!bike.group || !this.track) continue;
      const f = this.track.frameAt(bike.progress);
      const x = ox + (f.position.x - minX) * scale;
      const y = oz + (f.position.z - minZ) * scale;
      const flashing = i === this.minimapFlashIndex && performance.now() < this.minimapFlashUntil;
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.arc(x, y, i === 0 ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#211e2e';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (flashing) {
        ctx.strokeStyle = '#ff2d3f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, 9 + Math.sin(performance.now() * 0.02) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
}
