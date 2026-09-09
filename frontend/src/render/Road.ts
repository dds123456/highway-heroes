import * as THREE from 'three';
import { WORLD } from '../core/constants';
import type { TrackSpec } from '../core/constants';
import { TrackPath } from '../math/TrackPath';
import {surfaceTexture, mat} from './Art';

export function ribbonGeometry(
  track: TrackPath,
  s0: number,
  s1: number,
  halfWidth: number,
  yOffset = 0,
  noise = 0.012,
  centerOffset = 0,
): THREE.BufferGeometry {
  const length = track.wrap(s1 - s0);
  const count = Math.max(12, Math.floor(length * 0.75));
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= count; i++) {
    const s = track.wrap(s0 + (i / count) * length);
    const f = track.frameAt(s);
    const p = f.position;
    const right = f.right;
    const up = f.up;
    const wobble = Math.sin(s * 2.7) * 0.35 + Math.sin(s * 7.3 + 1.4) * 0.18;
    const yN = noise * Math.sin(s * 5.1 + i * 0.7) * 0.5;
    positions.push(
      p.x + right.x * (halfWidth + centerOffset) + up.x * (yOffset + yN),
      p.y + right.y * (halfWidth + centerOffset) + up.y * (yOffset + yN),
      p.z + right.z * (halfWidth + centerOffset) + up.z * (yOffset + yN),
      p.x + right.x * (-halfWidth + centerOffset) + up.x * (yOffset - yN + wobble * noise * 2),
      p.y + right.y * (-halfWidth + centerOffset) + up.y * (yOffset - yN + wobble * noise * 2),
      p.z + right.z * (-halfWidth + centerOffset) + up.z * (yOffset - yN + wobble * noise * 2),
    );
    normals.push(up.x, up.y, up.z, up.x, up.y, up.z);
    const u = (s0 + (i / count) * length) / 9;
    uvs.push(u, 0, u, 1);
  }
  for (let i = 0; i < count; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = i * 2 + 2;
    const d = i * 2 + 3;
    indices.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

export interface RoadChunk {
  group: THREE.Group;
  center: number;
}

export function createRoadChunks(track: TrackPath, spec: TrackSpec, chunkCount = 24): RoadChunk[] {
 const asphaltTex=surfaceTexture('asphalt','#54575a');asphaltTex.repeat.set(3,6);
 const asphaltMat=new THREE.MeshStandardMaterial({map:asphaltTex,bumpMap:asphaltTex,bumpScale:.025,roughness:.94});
 const shoulderMat=mat('#77776e',.97);
 const lineMat=mat('#dcd8c7',.9);const yellowMat=mat('#c6a558',.88);
 const c=document.createElement('canvas');c.width=128;c.height=16;
 const ctx=c.getContext('2d')!;ctx.fillStyle='#e7e4d8';ctx.fillRect(0,0,50,16);
 const dashTex=new THREE.CanvasTexture(c);dashTex.colorSpace=THREE.SRGBColorSpace;dashTex.wrapS=THREE.RepeatWrapping;dashTex.anisotropy=8;
 const dashMat=new THREE.MeshStandardMaterial({map:dashTex,transparent:true,alphaTest:.5,roughness:.93,depthWrite:false});
 const groundTex=surfaceTexture('ground',spec.terrain);groundTex.repeat.set(6,15);
 const vergeMat=new THREE.MeshStandardMaterial({map:groundTex,roughness:1,side:THREE.DoubleSide});
 const chunks:RoadChunk[]=[];const chunkLength=track.length/chunkCount;
 for(let c=0;c<chunkCount;c++){
  const s0=c*chunkLength,s1=(c+1)*chunkLength,group=new THREE.Group();
  const add=(half:number,y:number,m:THREE.Material,offset=0)=>{
   const road=new THREE.Mesh(ribbonGeometry(track,s0,s1,half,y,0,offset),m);road.receiveShadow=true;group.add(road);return road;
  };
  add(24,-.22,vergeMat);add(WORLD.roadHalfWidth+WORLD.shoulderWidth,-.045,shoulderMat);
  add(WORLD.roadHalfWidth,0,asphaltMat);
  for(const x of [-8.55,8.55])add(.075,.021,lineMat,x);
  for(const x of [-4.4,4.4])add(.075,.026,dashMat,x);
  for(const x of [-.14,.14])add(.055,.023,yellowMat,x);
  chunks.push({group,center:track.wrap((c+.5)*chunkLength)});
 }
 return chunks;
}

export function updateChunkVisibility(
  chunks: RoadChunk[],
  playerProgress: number,
  trackLength: number,
  radius = WORLD.streamRadius,
): void {
  for (const chunk of chunks) {
    const d = Math.abs(chunk.center - playerProgress);
    const dist = Math.min(d, trackLength - d);
    const visible = dist < radius;
    chunk.group.visible = visible;
  }
}
