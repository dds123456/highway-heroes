import { WORLD } from '../core/constants';
import type { GameModeId } from '../core/GameMode';
import { EventBus } from '../core/events';
import { BikeEntity, BikeInput } from '../entities/BikeEntity';
import { AIDriver, AI_PERSONALITIES } from '../ai/AIDriver';
import { TrackPath } from '../math/TrackPath';

export type RaceState = 'title' | 'countdown' | 'racing' | 'finished';

export interface LapResult {
  lap: number;
  timeMs: number;
  valid: boolean;
}

export class RaceManager {
  readonly player: BikeEntity;
  readonly opponents: BikeEntity[];
  readonly track: TrackPath;
  readonly bus: EventBus;
  readonly gateProgresses: number[];
  readonly laps: number;
  readonly mode: GameModeId;

  state: RaceState = 'title';
  countdown = 0;
  raceTime = 0;
  playerRank = 0;
  playerCheckpoint = 0;
  playerLapTime = 0;
  playerTotal = 0;
  playerLapTimes: number[] = [];
  playerLapValid: boolean[] = [];
  finishOrder: number[] = [];

  private aiDrivers: AIDriver[];
  private prevProgress: number[] = [];
  private gateCursor: number[] = [];
  private lastLapStart: number[] = [];
  private allBikes: BikeEntity[];
  private lastEmittedLap = -1;

  constructor(
    player: BikeEntity,
    opponents: BikeEntity[],
    track: TrackPath,
    bus: EventBus,
    laps: number = WORLD.laps,
    mode: GameModeId = 'race',
  ) {
    this.player = player;
    this.opponents = opponents;
    this.track = track;
    this.bus = bus;
    this.laps = laps;
    this.mode = mode;
    this.allBikes = [player, ...opponents];
    this.aiDrivers = opponents.map((_, i) => new AIDriver(AI_PERSONALITIES[i % AI_PERSONALITIES.length]));
    this.gateProgresses = Array.from({ length: 8 }, (_, i) => track.wrap(track.length * (i + 0.5) / 8));
    for (const bike of this.allBikes) {
      this.prevProgress.push(bike.progress);
      this.gateCursor.push(0);
      this.lastLapStart.push(0);
    }
  }

  startRace(): void {
    this.state = 'countdown';
    this.countdown = 3.0;
    this.raceTime = 0;
    this.bus.emit('race:state', { state: this.state, countdown: this.countdown });
  }

  reset(startProgresses: number[], startLaterals: number[]): void {
    this.state = 'title';
    this.countdown = 0;
    this.raceTime = 0;
    this.playerRank = 0;
    this.playerCheckpoint = 0;
    this.playerLapTime = 0;
    this.playerTotal = 0;
    this.playerLapTimes = [];
    this.playerLapValid = [];
    this.finishOrder = [];
    this.prevProgress = [];
    this.gateCursor = [];
    this.lastLapStart = [];
    this.lastEmittedLap = -1;
    this.allBikes.forEach((bike, i) => {
      bike.reset(startProgresses[i] ?? 0, startLaterals[i] ?? 0);
      this.prevProgress.push(bike.progress);
      this.gateCursor.push(0);
      this.lastLapStart.push(0);
    });
  }

  getRaceDistance(bike: BikeEntity): number {
    return bike.lap * this.track.length + bike.progress;
  }

  /** 玩家最佳圈速（毫秒）；无有效圈时返回 0 */
  get bestLapMs(): number {
    let best = 0;
    this.playerLapTimes.forEach((t, i) => {
      if (t > 0 && (best === 0 || t < best)) best = t;
    });
    return best;
  }

  /** 玩家最佳有效圈速（毫秒）；无有效圈时返回 0 */
  get bestValidLapMs(): number {
    let best = 0;
    this.playerLapTimes.forEach((t, i) => {
      if (this.playerLapValid[i] && t > 0 && (best === 0 || t < best)) best = t;
    });
    return best;
  }

  update(dt: number, playerInput: BikeInput, time: number): void {
    if (this.state === 'title' || this.state === 'finished') return;

    if (this.state === 'countdown') {
      const prevCeil = Math.ceil(this.countdown);
      this.countdown -= dt;
      const ceil = Math.ceil(this.countdown);
      if (ceil !== prevCeil && ceil >= 0) {
        this.bus.emit('race:state', { state: this.state, countdown: this.countdown });
      }
      if (ceil <= 0) {
        this.state = 'racing';
        this.bus.emit('race:state', { state: this.state, countdown: 0 });
      }
      for (const bike of this.allBikes) bike.update(dt, this.track, { throttle: true, brake: false, steer: 0, drift: false, boost: false, nitro: false }, this.bus, time, false);
      return;
    }

    this.raceTime += dt;

    for (let i = 0; i < this.allBikes.length; i++) {
      const bike = this.allBikes[i];
      if(bike.finished) continue;
      let input: BikeInput;
      if (bike === this.player) {
        input = playerInput;
      } else {
        input = this.aiDrivers[i - 1].update(dt, time, bike, this.track, this.allBikes);
      }
      this.prevProgress[i] = bike.progress;
      bike.update(dt, this.track, input, this.bus, time, true);
      this.checkProgress(bike, i, time);
    }

    this.updateRanking();
    this.emitSnapshot();

    if (this.state === 'racing' && this.player.finished && this.raceTime - this.player.finishTime >= 2) {
      this.finishRace();
    }
  }

  /** 漂移等计时模式由外部在时间耗尽时调用 */
  finishRace(): void {
    if (this.state === 'finished') return;
    this.state = 'finished';
    for(const bike of this.allBikes){bike.speed=0;bike.finished=true;}
    this.bus.emit('race:state', { state: this.state, countdown: 0 });
  }

  private checkProgress(bike: BikeEntity, index: number, time: number): void {
    const L = this.track.length;
    const prev = this.prevProgress[index];
    const next = bike.progress;
    const crossedFinish = prev > L * 0.97 && next < L * 0.03;

    if (crossedFinish) {
      bike.lap += 1;
      const lapTime = this.raceTime - this.lastLapStart[index];
      this.lastLapStart[index] = this.raceTime;
      const gatesPassed = this.gateCursor[index];
      const lapValid = gatesPassed >= this.gateProgresses.length;
      this.gateCursor[index] = 0;
      if (bike === this.player) {
        this.playerLapTimes.push(lapTime);
        this.playerLapValid.push(lapValid);
        this.playerLapTime = lapTime;
        this.bus.emit('race:lap', { index, lap: bike.lap, time: lapTime, valid: lapValid });
      }
      if (this.laps > 0 && bike.lap >= this.laps && !bike.finished) {
        bike.finished = true;
        bike.speed = 0;
        bike.finishTime = this.raceTime;
        this.finishOrder.push(index);
        if (bike === this.player) {
          this.playerRank=this.finishOrder.length;this.player.rank=this.playerRank;
          this.playerTotal = this.raceTime;
          this.bus.emit('race:finish', {
            rank: this.playerRank,
            total: this.raceTime,
            laps: [...this.playerLapTimes],
            lapValid: [...this.playerLapValid],
            bestLapMs: this.bestValidLapMs,
          });
        }
      }
    }

    // 顺序检查点：只有按序通过才推进游标，防止逆行刷圈。
    for (let g = 0; g < this.gateProgresses.length; g++) {
      const gate = this.gateProgresses[g];
      const crossed = prev < gate && next >= gate;
      if (crossed && this.gateCursor[index] === g) {
        this.gateCursor[index] = g + 1;
        if (bike === this.player) {
          this.playerCheckpoint = g + 1;
          this.bus.emit('race:checkpoint', { index: g + 1, time });
        }
      }
    }
  }

  private updateRanking(): void {
    if(this.player.finished)return;
    if (this.opponents.length === 0) {
      this.playerRank = 1;
      this.player.rank = 1;
      return;
    }
    const sorted = [...this.allBikes].sort((a, b) => {
      const da = this.getRaceDistance(a);
      const db = this.getRaceDistance(b);
      if (da !== db) return db - da;
      return (a.finished ? 1 : 0) - (b.finished ? 1 : 0);
    });
    sorted.forEach((bike, rank) => {
      bike.rank = rank + 1;
      if (bike === this.player) this.playerRank = rank + 1;
    });
  }

  private emitSnapshot(): void {
    this.bus.emit('hud:snapshot', {
      speed: this.player.speed,
      lap: Math.min(this.player.lap + 1, Math.max(1, this.laps)),
      laps: this.laps,
      rank: this.playerRank,
      checkpoint: this.playerCheckpoint,
      charge: this.player.charge,
      boost: this.player.boostActive,
      drifting: this.player.isDrifting,
      time: this.raceTime,
      lapTime: this.raceTime - this.lastLapStart[0],
      mode: this.mode,
    });
  }
}
