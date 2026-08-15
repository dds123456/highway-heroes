import { WORLD } from '../core/constants';
import { EventBus } from '../core/events';
import { BikeEntity, BikeInput } from '../entities/BikeEntity';
import { AIDriver, AI_PERSONALITIES } from '../ai/AIDriver';
import { TrackPath } from '../math/TrackPath';

export type RaceState = 'title' | 'countdown' | 'racing' | 'finished';

export class RaceManager {
  readonly player: BikeEntity;
  readonly opponents: BikeEntity[];
  readonly track: TrackPath;
  readonly bus: EventBus;
  readonly gateProgresses: number[];

  state: RaceState = 'title';
  countdown = 0;
  raceTime = 0;
  playerRank = 0;
  playerCheckpoint = 0;
  playerLapTime = 0;
  playerTotal = 0;
  playerLapTimes: number[] = [];
  finishOrder: number[] = [];

  private aiDrivers: AIDriver[];
  private prevProgress: number[] = [];
  private gateBits: number[] = [];
  private lastLapStart: number[] = [];
  private allBikes: BikeEntity[];

  constructor(player: BikeEntity, opponents: BikeEntity[], track: TrackPath, bus: EventBus) {
    this.player = player;
    this.opponents = opponents;
    this.track = track;
    this.bus = bus;
    this.allBikes = [player, ...opponents];
    this.aiDrivers = opponents.map((_, i) => new AIDriver(AI_PERSONALITIES[i % AI_PERSONALITIES.length]));
    this.gateProgresses = Array.from({ length: 8 }, (_, i) => track.wrap(track.length * (i + 0.5) / 8));
    for (const bike of this.allBikes) {
      this.prevProgress.push(bike.progress);
      this.gateBits.push(0);
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
    this.finishOrder = [];
    this.prevProgress = [];
    this.gateBits = [];
    this.lastLapStart = [];
    this.allBikes.forEach((bike, i) => {
      bike.reset(startProgresses[i] ?? 0, startLaterals[i] ?? 0);
      this.prevProgress.push(bike.progress);
      this.gateBits.push(0);
      this.lastLapStart.push(0);
    });
  }

  getRaceDistance(bike: BikeEntity): number {
    return bike.lap * this.track.length + bike.progress;
  }

  update(dt: number, playerInput: BikeInput, time: number): void {
    if (this.state === 'title') return;

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

    if (this.state === 'racing' && this.player.finished && this.raceTime - this.player.finishTime > 4) {
      this.state = 'finished';
      this.bus.emit('race:state', { state: this.state, countdown: 0 });
    }
  }

  private checkProgress(bike: BikeEntity, index: number, time: number): void {
    const L = this.track.length;
    const prev = this.prevProgress[index];
    const next = bike.progress;
    const crossedFinish = prev > L * 0.97 && next < L * 0.03;

    if (crossedFinish) {
      bike.lap += 1;
      const lapTime = time - this.lastLapStart[index];
      this.lastLapStart[index] = time;
      if (bike === this.player) {
        this.playerLapTimes.push(lapTime);
        this.bus.emit('race:lap', { index, lap: bike.lap, time: lapTime });
      }
      if (bike.lap >= WORLD.laps && !bike.finished) {
        bike.finished = true;
        bike.finishTime = time;
        this.finishOrder.push(index);
        if (bike === this.player) {
          this.playerTotal = time;
          this.bus.emit('race:finish', { rank: this.playerRank, total: time, laps: [...this.playerLapTimes] });
        }
      }
    }

    for (let g = 0; g < this.gateProgresses.length; g++) {
      const gate = this.gateProgresses[g];
      const crossed = prev < gate && next >= gate;
      if (crossed && (this.gateBits[index] & (1 << g)) === 0) {
        this.gateBits[index] |= 1 << g;
        if (bike === this.player) {
          this.playerCheckpoint = g + 1;
          this.bus.emit('race:checkpoint', { index: g + 1, time });
        }
      }
    }
    if (bike.lap >= WORLD.laps) this.gateBits[index] = 0;
  }

  private updateRanking(): void {
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
      lap: Math.min(this.player.lap + 1, WORLD.laps),
      laps: WORLD.laps,
      rank: this.playerRank,
      checkpoint: this.playerCheckpoint,
      charge: this.player.charge,
      boost: this.player.boostActive,
      drifting: this.player.isDrifting,
      time: this.raceTime,
    });
  }
}
