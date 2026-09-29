import * as THREE from 'three';
import { WORLD } from '../core/constants';
import { BikeEntity, BikeInput } from '../entities/BikeEntity';
import { TrackPath } from '../math/TrackPath';
import { clamp, damp } from '../math/utils';

export interface AIPersonality {
  name: string;
  aggression: number;
  consistency: number;
  errorRate: number;
  skill: number;
  driftiness: number;
}

export const AI_PERSONALITIES: AIPersonality[] = [
  { name: '激进型', aggression: 0.9, consistency: 0.9, errorRate: 0.02, skill: 0.97, driftiness: 0.88 },
  { name: '稳定型', aggression: 0.6, consistency: 0.99, errorRate: 0.03, skill: 0.97, driftiness: 0.55 },
  { name: '飘忽型', aggression: 0.78, consistency: 0.88, errorRate: 0.08, skill: 0.96, driftiness: 0.92 },
];

export class AIDriver {
  readonly personality: AIPersonality;
  private targetLateral = 0;
  private mistakeTimer = 0;
  private smoothSteer = 0;

  constructor(personality: AIPersonality) {
    this.personality = personality;
  }

  update(dt: number, time: number, bike: BikeEntity, track: TrackPath, racers: BikeEntity[]): BikeInput {
    const p = this.personality;
    const speed = bike.speed;
    const s = bike.progress;
    const lookahead = clamp(speed * (0.85 + p.aggression * 0.55), 16, 260);
    const curv = track.curvatureAt(track.wrap(s + lookahead), 16);
    const consistencyWave = (1 - p.consistency) * Math.sin(time * 0.7 + bike.index * 2.1) * 6;
    // 位置感知：落后→极限速度/加速度随距离放大（最高 2×）且不失误（只受玩家道具影响）；领先→极限速度 1.2×、恢复失误
    const player = racers[0];
    const playerSpeed = player ? player.speed : 0;
    const playerDist = player ? player.lap * track.length + player.progress : 0;
    const myDist = bike.lap * track.length + bike.progress;
    const gap = playerDist - myDist; // >0 = AI 落后
    if (gap > 0) {
      // 追逐：距离越远极限速度/加速度越快（最高 2×），且不失误
      const chase = clamp(1 + gap / 600, 1, 2);
      bike.maxSpeedMul = chase;
      bike.accelBoost = chase;
      this.mistakeTimer = 0;
    } else {
      // 领先：极限速度为玩家 1.2×，恢复失误
      bike.maxSpeedMul = 1.2;
      bike.accelBoost = 1;
    }
    const cornerSpeed = WORLD.maxSpeed / (1 + Math.abs(curv) * 18) + consistencyWave + p.skill * 5;
    const targetSpeed = clamp(
      Math.min(cornerSpeed, playerSpeed * bike.maxSpeedMul),
      55,
      WORLD.maxSpeed * bike.maxSpeedMul,
    );

    const targetLateral = clamp(-curv * (52 * p.aggression + 18), -7.4, 7.4);
    this.targetLateral = damp(this.targetLateral, targetLateral, 3.5, dt);

    let avoidance = 0;
    for (const other of racers) {
      if (other === bike) continue;
      const raw = other.progress - s;
      const d = Math.min(Math.abs(raw), track.length - Math.abs(raw));
      const side = raw > 0 ? 1 : -1;
      if (d < 10 && Math.abs(other.lateral - bike.lateral) < 3.2) {
        avoidance += bike.lateral > other.lateral ? 0.85 : -0.85;
      }
      if (d < 4) avoidance += side * 0.45;
    }

    const steerTarget = clamp(-((this.targetLateral - bike.lateral) * 0.55 + avoidance), -1, 1);
    this.smoothSteer = damp(this.smoothSteer, steerTarget, 6, dt);

    if (this.mistakeTimer > 0) {
      this.mistakeTimer -= dt;
      return {
        throttle: false,
        brake: speed > 30,
        steer: this.smoothSteer * 0.5 + Math.sin(time * 9) * 0.35,
        drift: false,
        boost: false,
        nitro: false,
      };
    }
    if (gap <= 0 && Math.random() < p.errorRate * dt * 0.85) {
      this.mistakeTimer = 0.5 + Math.random() * 0.6;
    }

    const drifting = p.driftiness > 0.45 && Math.abs(curv) > 0.024 && speed > 44 && Math.random() < 0.5;
    const throttle = bike.speed < targetSpeed;
    const brake = bike.speed > targetSpeed * 1.22;
    const useNitro = bike.charge >= 0.95;

    return {
      throttle: throttle && this.mistakeTimer <= 0,
      brake,
      steer: this.smoothSteer,
      drift: drifting,
      boost: false,
      nitro: useNitro,
    };
  }
}
