import * as THREE from 'three';
import { COLORS, WORLD } from '../core/constants';
import { EventBus } from '../core/events';
import { BikeEntity } from '../entities/BikeEntity';
import { TrackPath } from '../math/TrackPath';
import { clamp, makePadTexture } from '../math/utils';
import { makeToonMaterial } from './ToonMaterial';
import {radialGlowTexture,signalMaterial} from './VisibilityFX';

export interface BoostPad {
  group: THREE.Group;
  progress: number;
  lateral: number;
  cooldownUntil: number;
  material: THREE.MeshPhysicalMaterial;
  arrows:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>[];
  edgeMaterial:THREE.MeshBasicMaterial;
}

export interface RoadObstacle {
  group: THREE.Group;
  progress: number;
  lateral: number;
  radius: number;
}

function yawQuaternion(tangent: THREE.Vector3): THREE.Quaternion {
  const flat = tangent.clone();
  flat.y = 0;
  if (flat.lengthSq() < 1e-6) return new THREE.Quaternion();
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), flat.normalize());
}

function signedDelta(a: number, b: number, length: number): number {
  let d = a - b;
  if (d > length / 2) d -= length;
  if (d < -length / 2) d += length;
  return d;
}

export function createBoostPads(track: TrackPath, count = 12): BoostPad[] {
  const pads:BoostPad[]=[];
  for(let i=0;i<count;i++){
    const progress=track.wrap(((i+.65)/count)*track.length),lateral=[-4.5,0,4.5][i%3],f=track.frameAt(progress);
    const group=new THREE.Group();group.name='AnimatedBoostPad';
    const material=makeToonMaterial('#145363',{emissive:new THREE.Color('#28dce8'),emissiveIntensity:.6,specular:.5});
    const body=new THREE.Mesh(new THREE.BoxGeometry(5.6,.10,8.6),material);body.position.y=.05;group.add(body);
    const edgeMaterial=signalMaterial('#78f6ff',.95);
    for(const x of [-2.7,2.7]){
      const edge=new THREE.Mesh(new THREE.BoxGeometry(.10,.055,8.5),edgeMaterial);edge.position.set(x,.13,0);group.add(edge);
      for(const z of [-4.15,4.15]){const post=new THREE.Mesh(new THREE.BoxGeometry(.10,.8,.1),edgeMaterial);post.position.set(x,.42,z);group.add(post);}
    }
    const glow=new THREE.Mesh(new THREE.PlaneGeometry(9,13),new THREE.MeshBasicMaterial({map:radialGlowTexture(),color:'#35e8fa',transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));
    glow.rotation.x=-Math.PI/2;glow.position.y=.012;group.add(glow);
    const arrows:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>[]=[];
    const shape=new THREE.Shape();shape.moveTo(-1.95,-.55);shape.lineTo(0,.55);shape.lineTo(1.95,-.55);shape.lineTo(1.95,-.08);shape.lineTo(0,1.02);shape.lineTo(-1.95,-.08);shape.closePath();
    for(let j=0;j<4;j++){
      const geometry=new THREE.ShapeGeometry(shape);geometry.rotateX(Math.PI/2);
      const arrow=new THREE.Mesh(geometry,signalMaterial('#d5ffff',.9));arrow.name='FlowChevron';arrow.position.set(0,.15,-3+j*2);
      group.add(arrow);arrows.push(arrow);
    }
    group.position.copy(f.position).addScaledVector(f.right,lateral).addScaledVector(f.up,.045);
    // Follow grade and banking rather than burying the pad on sloped road.
    group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.right,f.up,f.tangent));
    pads.push({group,progress,lateral,cooldownUntil:0,material,arrows,edgeMaterial});
  }
  return pads;
}
export function animatePads(pads:BoostPad[],time:number):void{
  for(const pad of pads){
    const triggered=time<pad.cooldownUntil;
    pad.material.emissiveIntensity=triggered?1.3:.48;
    pad.edgeMaterial.opacity=triggered?1:.72+Math.sin(time*2)*.12;
    pad.arrows.forEach((arrow,i)=>{const z=((time*3+i*2)%8)-4;arrow.position.z=z;arrow.material.opacity=.28+.65*Math.max(0,1-Math.abs(z)/4);});
  }
}

export function updatePads(
  pads: BoostPad[],
  bikes: BikeEntity[],
  track: TrackPath,
  bus: EventBus,
  time: number,
): void {
  for (const pad of pads) {
    if (time < pad.cooldownUntil) continue;
    for (const bike of bikes) {
      const d = signedDelta(bike.progress, pad.progress, track.length);
      if (Math.abs(d) < 4.6 && Math.abs(bike.lateral - pad.lateral) < 4.2 && bike.speed > 2) {
        pad.cooldownUntil = time + 2.6;
        bike.applyPickupBoost();
        bus.emit('vehicle:pickup', { index: bike.index });
      }
    }
  }
}

export function createRoadObstacles(track: TrackPath, count = 14): RoadObstacle[] {
  const redMat = makeToonMaterial('#9a4b35', { rimColor: COLORS.rim, rimPower: 3, specular: 0.35 });
  const whiteMat = makeToonMaterial('#f4f1e7', { rimColor: COLORS.rimTeal, rimPower: 3 });
  const darkMat = makeToonMaterial('#20242d', { rimColor: COLORS.rimTeal, rimPower: 3 });
  const orangeMat = makeToonMaterial('#b76b35', { rimColor: COLORS.rim, rimPower: 3 });
  const obstacles: RoadObstacle[] = [];
  const laterals = [-5.4, 5.4, -1.2, 3.4];
  for (let i = 0; i < count; i++) {
    const progress = track.wrap(((i + 0.82) / count) * track.length);
    const lateral = laterals[i % laterals.length];
    const f = track.frameAt(progress);
    const group = new THREE.Group();
    const kind = i % 3;
    if (kind === 0) {
      const tireA = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.25, 12, 32), darkMat);
      tireA.position.set(-0.7, 0.28, 0); tireA.rotation.x = Math.PI / 2;
      const tireB = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.25, 12, 32), darkMat);
      tireB.position.set(0.7, 0.28, 0); tireB.rotation.x = Math.PI / 2;
      const tireTop = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.23, 12, 32), darkMat);
      tireTop.position.set(0, 0.76, 0); tireTop.rotation.x = Math.PI / 2;
      group.add(tireA, tireB, tireTop);
    } else if (kind === 1) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.7, 16), redMat);
      barrel.position.y = 0.85;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.93, 0.93, 0.4, 16), whiteMat);
      band.position.y = 1.15;
      group.add(barrel, band);
      for (const y of [0.15, 0.55, 1.45, 1.69]) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.025, 8, 32), darkMat);
        hoop.rotation.x = Math.PI / 2; hoop.position.y = y; group.add(hoop);
      }
      const bung = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,0.025,12),darkMat);
      bung.position.set(.4,1.713,.2); group.add(bung);
    } else {
      const barrier = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.2, 0.65), whiteMat);
      barrier.position.y = 0.78;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.42, 0.36, 0.36), redMat);
      stripe.position.y = 1.05;
      group.add(barrier, stripe);
      for (const x of [-1.7, 0, 1.7]) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.1, 8), orangeMat);
        cone.position.set(x, 0.55, 1.7);
        group.add(cone);
      }
    }
    group.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    group.position.copy(f.position).addScaledVector(f.right, lateral).addScaledVector(f.up, 0.03);
    group.quaternion.copy(yawQuaternion(f.tangent));
    obstacles.push({ group, progress, lateral, radius: 1.7 });
  }
  return obstacles;
}

export function updateObstacles(
  obstacles: RoadObstacle[],
  bikes: BikeEntity[],
  track: TrackPath,
  bus: EventBus,
  time: number,
): void {
  void time;
  for (const obstacle of obstacles) {
    for (const bike of bikes) {
      if (!bike.canBeHit) continue;
      const d = signedDelta(bike.progress, obstacle.progress, track.length);
      if (Math.abs(d) < 2.7 && Math.abs(bike.lateral - obstacle.lateral) < obstacle.radius + 0.7) {
        const strength = clamp(bike.speed / WORLD.maxSpeed, 0.3, 1);
        const push = bike.lateral >= obstacle.lateral ? 1 : -1;
        bike.applyObstacleHit(push);
        bus.emit('vehicle:collision', { index: bike.index, strength });
      }
    }
  }
}
