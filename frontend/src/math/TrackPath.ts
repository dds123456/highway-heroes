import * as THREE from 'three';
import type { TrackId } from '../core/constants';
import { clamp, wrapAngle } from './utils';

export interface TrackFrame {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
}

export interface TrackSample extends TrackFrame {
  distance: number;
}

function buildControlPoints(shape: TrackId): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const count = 22;
  const seed = shape === 'meadow' ? 0 : shape === 'canyon' ? 127 : 251;
  const delta = (a: number, b: number): number => {
    const d = wrapAngle(a - b);
    return d > Math.PI ? d - Math.PI * 2 : d;
  };
  const hills = shape === 'canyon' ? 1.45 : shape === 'snowfield' ? 1.2 : 1;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const radius = 520
      + (shape === 'meadow' ? 130 : shape === 'snowfield' ? 155 : 175) * Math.sin(a * 2 + 1.1 + seed)
      + (shape === 'meadow' ? 92 : shape === 'snowfield' ? 70 : 60) * Math.cos(a * 3 + 2.6 + seed)
      + (shape === 'meadow' ? 46 : shape === 'snowfield' ? 105 : 120) * Math.sin(a * 5 + 4.2 + seed);
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    const y = 3 * Math.sin(a * 2 + 0.8 + seed)
      + 4 * Math.sin(a * 3 + 2.3 + seed)
      + 6 * Math.sin(a * 5 + 5.1 + seed)
      + 18 * hills * Math.exp(-Math.pow(delta(a, 4.4), 2) / 0.055)
      + 12 * Math.exp(-Math.pow(delta(a, 11.2 + seed), 2) / 0.08);
    const p = new THREE.Vector3(x, y, z);
    points.push(p);
  }
  return points;
}

export class TrackPath {
  readonly curve: THREE.CatmullRomCurve3;
  readonly length: number;
  readonly samples: TrackSample[];
  readonly step: number;
  readonly shape: TrackId;

  constructor(shape: TrackId = 'meadow') {
    this.shape = shape;
    this.curve = new THREE.CatmullRomCurve3(buildControlPoints(this.shape), true, 'catmullrom', 0.5);
    this.length = this.curve.getLength();
    this.samples = this.buildSamples(2600);
    this.step = this.length / (this.samples.length - 1);
  }

  private buildSamples(count: number): TrackSample[] {
    const up0 = new THREE.Vector3(0, 1, 0);
    const tmp = new THREE.Vector3();
    const samples: TrackSample[] = [];
    const positions: THREE.Vector3[] = [];
    const tangents: THREE.Vector3[] = [];
    const rights: THREE.Vector3[] = [];
    const ups: THREE.Vector3[] = [];
    const distances: number[] = [];

    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const position = this.curve.getPointAt(t);
      positions.push(position.clone());
      distances.push(i === 0 ? 0 : distances[i - 1] + positions[i].distanceTo(positions[i - 1]));
    }
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const tangent = this.curve.getTangentAt(t).normalize();
      const flat = tangent.clone();
      flat.y = 0;
      if (flat.lengthSq() < 1e-6) flat.set(1, 0, 0);
      flat.normalize();
      const right0 = up0.clone().cross(flat).normalize();
      const up0v = tmp.copy(tangent).cross(right0).normalize();
      let right = right0;
      let up = up0v;
      if (up.dot(up0) < 0) {
        up = up.clone().negate().normalize();
        right = up.clone().cross(tangent).normalize();
      }
      tangents.push(tangent.clone());
      rights.push(right.clone());
      ups.push(up.clone());
    }
    const total = distances[count];
    for (let i = 0; i <= count; i++) {
      samples.push({
        position: positions[i].clone(),
        tangent: tangents[i].clone(),
        right: rights[i].clone(),
        up: ups[i].clone(),
        distance: (distances[i] / total) * this.length,
      });
    }
    return samples;
  }

  wrap(s: number): number {
    const v = s % this.length;
    return v < 0 ? v + this.length : v;
  }

  frameAt(s: number): TrackFrame {
    const wrapped = this.wrap(s);
    const scaled = (wrapped / this.length) * (this.samples.length - 1);
    const i = Math.min(this.samples.length - 2, Math.floor(scaled));
    const t = clamp(scaled - i, 0, 1);
    const a = this.samples[i];
    const b = this.samples[i + 1];
    const tangent = a.tangent.clone().lerp(b.tangent, t).normalize();
    const right = a.right.clone().lerp(b.right, t).normalize();
    const up = a.up.clone().lerp(b.up, t).normalize();
    return {
      position: a.position.clone().lerp(b.position, t),
      tangent,
      right,
      up,
    };
  }

  slopeAt(s: number): number {
    const f = this.frameAt(s - 1.2);
    const g = this.frameAt(s + 1.2);
    const dy = g.position.y - f.position.y;
    const dx = f.position.distanceTo(g.position);
    return dx > 1e-5 ? dy / dx : 0;
  }

  curvatureAt(s: number, lookahead = 18): number {
    const f = this.frameAt(s);
    const g = this.frameAt(s + lookahead);
    const dt = g.tangent.clone().sub(f.tangent);
    const cross = dt.clone().cross(f.up);
    const sign = Math.sign(cross.dot(f.right));
    return (sign * dt.length()) / lookahead;
  }

  nearestProgress(point: THREE.Vector3, hint = 0, scanRadius = 900): number {
    const n = this.samples.length;
    const idxHint = Math.round((this.wrap(hint) / this.length) * (n - 1));
    const window = Math.max(8, Math.ceil((scanRadius / this.length) * n));
    let best = idxHint;
    let bestDist = Infinity;
    for (let step = -window; step <= window; step++) {
      const idx = ((idxHint + step) % n + n) % n;
      const d = point.distanceToSquared(this.samples[idx].position);
      if (d < bestDist) {
        bestDist = d;
        best = idx;
      }
    }
    for (let step = -2; step <= 2; step++) {
      const idx = ((best + step) % n + n) % n;
      const d = point.distanceToSquared(this.samples[idx].position);
      if (d < bestDist) {
        bestDist = d;
        best = idx;
      }
    }
    return this.samples[best].distance;
  }

  pointsForMinimap(count: number): THREE.Vector2[] {
    const out: THREE.Vector2[] = [];
    for (let i = 0; i < count; i++) {
      const f = this.frameAt((i / count) * this.length);
      out.push(new THREE.Vector2(f.position.x, f.position.z));
    }
    return out;
  }
}
