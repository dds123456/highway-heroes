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
  { name: '激进型', aggression: 0.95, consistency: 0.72, errorRate: 0.32, skill: 0.92, driftiness: 0.86 },
  { name: '稳定型', aggression: 0.5, consistency: 0.95, errorRate: 0.07, skill: 0.82, driftiness: 0.3 },
  { name: '飘忽型', aggression: 0.72, consistency: 0.52, errorRate: 0.5, skill: 0.74, driftiness: 0.95 },
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
    const lookahead = clamp(speed * (0.85 + p.aggression * 0.55), 16, 105);
    const curv = track.curvatureAt(track.wrap(s + lookahead), 16);
    const consistencyWave = (1 - p.consistency) * Math.sin(time * 0.7 + bike.index * 2.1) * 6;
    const targetSpeed = clamp(
      WORLD.maxSpeed / (1 + Math.abs(curv) * 21) + consistencyWave + p.skill * 4,
      42,
      WORLD.maxSpeed * (0.9 + p.skill * 0.1),
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
    if (Math.random() < p.errorRate * dt * 0.85) {
      this.mistakeTimer = 0.7 + Math.random() * 0.8;
    }

    const drifting = p.driftiness > 0.55 && Math.abs(curv) > 0.03 && speed > 48 && Math.random() < 0.35;
    const throttle = bike.speed < targetSpeed;
    const brake = bike.speed > targetSpeed * 1.28;
    const boost = bike.charge >= 0.98 && Math.random() < 0.03;

    return {
      throttle: throttle && this.mistakeTimer <= 0,
      brake,
      steer: this.smoothSteer,
      drift: drifting,
      boost,
      nitro: false,
    };
  }
}
