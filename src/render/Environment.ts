import * as THREE from 'three';
import { COLORS, WORLD } from '../core/constants';
import { TrackPath } from '../math/TrackPath';
import { makeBuildingTexture, makeSignTexture, makeTerrainTexture } from '../math/utils';
import { makeToonMaterial } from './ToonMaterial';

export interface EnvironmentChunk {
  group: THREE.Group;
  center: number;
}

function tangentQuaternion(tangent: THREE.Vector3): THREE.Quaternion {
  const flat = tangent.clone();
  flat.y = 0;
  if (flat.lengthSq() < 1e-6) return new THREE.Quaternion();
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), flat.normalize());
}

export function createEnvironmentChunks(track: TrackPath, chunkCount = 24): EnvironmentChunk[] {
  const chunkLength = track.length / chunkCount;
  const barrierMat = makeToonMaterial('#7d858f', { rimColor: COLORS.rimTeal, rimPower: 3 });
  const treeTrunkMat = makeToonMaterial('#6b4a33', { rimColor: null });
  const treeFoliageMat = makeToonMaterial('#3fae6e', { rimColor: COLORS.rimTeal, rimPower: 3.5 });
  const bushMat = makeToonMaterial('#4fae66', { rimColor: COLORS.rimTeal, rimPower: 3 });
  const buildingMat = makeToonMaterial('#ffffff', {
    map: makeBuildingTexture(),
    rimColor: COLORS.rimTeal,
    rimPower: 3,
    specular: 0.28,
  });
  const poleMat = makeToonMaterial('#8b95a3', { specular: 0.7 });
  const lampMat = makeToonMaterial('#ffe08a', { emissive: new THREE.Color(1, 0.85, 0.35), emissiveIntensity: 1.6, rimColor: null });
  const coneMat = makeToonMaterial('#ff7a3d', { rimColor: new THREE.Color(1, 0.5, 0.1), rimPower: 3 });
  const signMats = [
    makeToonMaterial('#ffd23f', { map: makeSignTexture('极速', '#ff4d5e', '#fff6d8'), rimColor: null, specular: 0.2 }),
    makeToonMaterial('#38b6ff', { map: makeSignTexture('弯道', '#14141c', '#bfe8ff'), rimColor: null, specular: 0.2 }),
    makeToonMaterial('#57d68d', { map: makeSignTexture('跳台', '#2d7f55', '#eafff2'), rimColor: null, specular: 0.2 }),
    makeToonMaterial('#ff4fa3', { map: makeSignTexture('GO!', '#fff', '#14141c'), rimColor: null, specular: 0.2 }),
  ];

  const chunks: EnvironmentChunk[] = [];
  const dummy = new THREE.Object3D();

  for (let c = 0; c < chunkCount; c++) {
    const s0 = track.wrap(c * chunkLength);
    const s1 = track.wrap((c + 1) * chunkLength);
    const group = new THREE.Group();

    const barriers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.62, 3.1), barrierMat, 1);
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.32, 3.4, 6), treeTrunkMat, 1);
    const foliage = new THREE.InstancedMesh(new THREE.ConeGeometry(1.9, 4.6, 7), treeFoliageMat, 1);
    const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.13, 7.4, 6), poleMat, 1);
    const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 0.14, 0.14), poleMat, 1);
    const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.26, 8, 6), lampMat, 1);
    const cones = new THREE.InstancedMesh(new THREE.ConeGeometry(0.3, 0.85, 8), coneMat, 1);
    const boards = new THREE.InstancedMesh(new THREE.PlaneGeometry(9, 5), signMats[c % signMats.length], 1);
    const buildings = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), buildingMat, 10);
    const bushes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.75, 7, 6), bushMat, 10);

    let barrierIndex = 0;
    let treeIndex = 0;
    let poleIndex = 0;
    let coneIndex = 0;
    let boardIndex = 0;
    let buildingIndex = 0;
    let bushIndex = 0;
    const isCity = (c >= 3 && c <= 8) || (c >= 14 && c <= 19);

    const addBarrier = (s: number, side: number): void => {
      const f = track.frameAt(s);
      const lateral = WORLD.roadHalfWidth + WORLD.shoulderWidth + 0.4;
      dummy.position.copy(f.position).addScaledVector(f.up, 0.34).addScaledVector(f.right, lateral * side);
      dummy.quaternion.copy(tangentQuaternion(f.tangent));
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      barriers.setMatrixAt(barrierIndex++, dummy.matrix);
    };

    const addTree = (s: number, side: number): void => {
      const f = track.frameAt(s);
      const lateral = WORLD.roadHalfWidth + WORLD.shoulderWidth + 5 + Math.random() * 22;
      const pos = f.position.clone().addScaledVector(f.up, 1.1).addScaledVector(f.right, lateral * side);
      dummy.position.copy(pos);
      dummy.quaternion.copy(tangentQuaternion(f.tangent));
      const scale = 0.9 + Math.random() * 1.1;
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(treeIndex, dummy.matrix);
      foliage.setMatrixAt(treeIndex++, dummy.matrix);
    };

    const addPole = (s: number, side: number): void => {
      const f = track.frameAt(s);
      const lateral = WORLD.roadHalfWidth + WORLD.shoulderWidth + 1.6;
      const base = f.position.clone().addScaledVector(f.up, 3.7).addScaledVector(f.right, lateral * side);
      dummy.position.copy(base);
      dummy.quaternion.copy(tangentQuaternion(f.tangent));
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poles.setMatrixAt(poleIndex, dummy.matrix);

      const armYaw = tangentQuaternion(f.tangent).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), side * Math.PI / 2));
      dummy.position.copy(base).addScaledVector(f.up, 3.7).addScaledVector(f.right, side * 1.2);
      dummy.quaternion.copy(armYaw);
      dummy.updateMatrix();
      arms.setMatrixAt(poleIndex, dummy.matrix);

      dummy.position.copy(base).addScaledVector(f.up, 3.7).addScaledVector(f.right, side * 1.28);
      dummy.quaternion.copy(new THREE.Quaternion());
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      lamps.setMatrixAt(poleIndex++, dummy.matrix);
    };

    const addCone = (s: number, side: number): void => {
      const f = track.frameAt(s);
      dummy.position.copy(f.position).addScaledVector(f.up, 0.45).addScaledVector(f.right, 6.6 * side);
      dummy.quaternion.copy(new THREE.Quaternion());
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      cones.setMatrixAt(coneIndex++, dummy.matrix);
    };

    const addBoard = (s: number, side: number): void => {
      const f = track.frameAt(s);
      const lateral = WORLD.roadHalfWidth + WORLD.shoulderWidth + 7;
      dummy.position.copy(f.position).addScaledVector(f.up, 3.6).addScaledVector(f.right, lateral * side);
      const yaw = tangentQuaternion(f.tangent);
      dummy.quaternion.copy(yaw.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), side * Math.PI / 2)));
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      boards.setMatrixAt(boardIndex++, dummy.matrix);
    };

    const addBuilding = (s: number, side: number): void => {
      const f = track.frameAt(s);
      const lateral = WORLD.roadHalfWidth + WORLD.shoulderWidth + 14 + Math.random() * 26;
      const width = 8 + Math.random() * 10;
      const depth = 8 + Math.random() * 8;
      const height = 9 + Math.random() * 20;
      const base = f.position.clone().addScaledVector(f.right, lateral * side).addScaledVector(f.up, -1.2 + height * 0.5);
      dummy.position.copy(base);
      dummy.quaternion.copy(tangentQuaternion(f.tangent));
      dummy.scale.set(width, height, depth);
      dummy.updateMatrix();
      buildings.setMatrixAt(buildingIndex, dummy.matrix);
      const tint = new THREE.Color().setHSL(0.55 + Math.random() * 0.08, 0.18 + Math.random() * 0.25, 0.55 + Math.random() * 0.25);
      buildings.setColorAt(buildingIndex, tint);
      buildingIndex++;
    };

    const addBush = (s: number, side: number): void => {
      const f = track.frameAt(s);
      const lateral = WORLD.roadHalfWidth + WORLD.shoulderWidth + 4 + Math.random() * 18;
      const pos = f.position.clone().addScaledVector(f.right, lateral * side).addScaledVector(f.up, 0.35);
      dummy.position.copy(pos);
      dummy.quaternion.copy(new THREE.Quaternion());
      const scale = 0.6 + Math.random() * 0.9;
      dummy.scale.set(scale, scale * 0.8, scale);
      dummy.updateMatrix();
      bushes.setMatrixAt(bushIndex++, dummy.matrix);
    };

    const count = Math.floor(chunkLength / 8);
    for (let i = 0; i < count; i++) {
      const s = track.wrap(s0 + (i / count) * chunkLength);
      addBarrier(s, 1);
      addBarrier(s, -1);
    }
    const treeCount = isCity ? 3 : 9;
    for (let i = 0; i < treeCount; i++) {
      const s = track.wrap(s0 + Math.random() * chunkLength);
      addTree(s, Math.random() > 0.5 ? 1 : -1);
    }
    const bushCount = isCity ? 2 : 8;
    for (let i = 0; i < bushCount; i++) {
      const s = track.wrap(s0 + Math.random() * chunkLength);
      addBush(s, Math.random() > 0.5 ? 1 : -1);
    }
    if (isCity) {
      const buildingCount = 6 + (c % 3);
      for (let i = 0; i < buildingCount; i++) {
        const s = track.wrap(s0 + (i / buildingCount) * chunkLength);
        addBuilding(s, i % 2 === 0 ? 1 : -1);
      }
    }
    const poleCount = Math.max(0, Math.floor(chunkLength / 88));
    for (let i = 0; i < poleCount; i++) {
      const s = track.wrap(s0 + (i + 0.5) * (chunkLength / Math.max(1, poleCount)));
      addPole(s, i % 2 === 0 ? 1 : -1);
    }
    const apexes: number[] = [];
    for (let i = 0; i < 24; i++) {
      const s = track.wrap(s0 + (i / 24) * chunkLength);
      apexes.push(s);
    }
    apexes.sort((a, b) => Math.abs(track.curvatureAt(b, 12)) - Math.abs(track.curvatureAt(a, 12)));
    for (let i = 0; i < 4 && i < apexes.length; i++) {
      const side = track.curvatureAt(apexes[i], 12) > 0 ? -1 : 1;
      addCone(apexes[i], side);
    }
    if (c % 3 === 0) {
      addBoard(track.wrap(s0 + chunkLength * 0.5), c % 2 === 0 ? 1 : -1);
    }

    barriers.count = barrierIndex;
    trunks.count = treeIndex;
    foliage.count = treeIndex;
    poles.count = poleIndex;
    arms.count = poleIndex;
    lamps.count = poleIndex;
    cones.count = coneIndex;
    boards.count = boardIndex;
    buildings.count = buildingIndex;
    bushes.count = bushIndex;
    if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
    for (const mesh of [barriers, trunks, foliage, poles, arms, lamps, cones, boards, buildings, bushes]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = true;
      group.add(mesh);
    }

    chunks.push({ group, center: track.wrap((c + 0.5) * chunkLength) });
  }
  return chunks;
}

export function updateEnvironmentVisibility(
  chunks: EnvironmentChunk[],
  playerProgress: number,
  trackLength: number,
  radius = WORLD.streamRadius * 1.25,
): void {
  for (const chunk of chunks) {
    const d = Math.abs(chunk.center - playerProgress);
    const dist = Math.min(d, trackLength - d);
    chunk.group.visible = dist < radius;
  }
}

export function createMountains(): THREE.Group {
  const group = new THREE.Group();
  const nearMat = makeToonMaterial('#2f5b8f', { rimColor: COLORS.rimTeal, rimPower: 2.5, specular: 0.15 });
  const farMat = makeToonMaterial('#8fa9c9', { rimColor: COLORS.rim, rimPower: 2, specular: 0.1 });
  const near = new THREE.InstancedMesh(new THREE.ConeGeometry(150, 260, 5), nearMat, 34);
  const far = new THREE.InstancedMesh(new THREE.ConeGeometry(190, 220, 4), farMat, 40);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 34; i++) {
    const angle = (i / 34) * Math.PI * 2 + Math.sin(i * 2.7) * 0.24;
    const radius = 1500 + Math.sin(i * 5.1) * 260;
    dummy.position.set(Math.cos(angle) * radius, -40 + Math.sin(i * 3.3) * 22, Math.sin(angle) * radius);
    dummy.rotation.set(0, angle + Math.PI / 2, 0);
    const h = 0.7 + Math.abs(Math.sin(i * 2.1)) * 1.1;
    dummy.scale.set(1, h, 1);
    dummy.updateMatrix();
    near.setMatrixAt(i, dummy.matrix);
  }
  for (let i = 0; i < 40; i++) {
    const angle = (i / 40) * Math.PI * 2 + Math.sin(i * 1.9) * 0.3;
    const radius = 1850 + Math.sin(i * 3.7) * 320;
    dummy.position.set(Math.cos(angle) * radius, -70, Math.sin(angle) * radius);
    dummy.rotation.set(0, angle + Math.PI / 2, 0);
    const h = 0.6 + Math.abs(Math.sin(i * 2.7 + 1)) * 1.3;
    dummy.scale.set(1.6, h, 1);
    dummy.updateMatrix();
    far.setMatrixAt(i, dummy.matrix);
  }
  near.instanceMatrix.needsUpdate = true;
  far.instanceMatrix.needsUpdate = true;
  near.frustumCulled = false;
  far.frustumCulled = false;
  group.add(near, far);
  return group;
}

export function createTerrain(): THREE.Mesh {
  const tex = makeTerrainTexture();
  tex.repeat.set(16, 16);
  const material = makeToonMaterial('#5aa860', {
    map: tex,
    rimColor: COLORS.rimTeal,
    rimPower: 3,
    specular: 0.08,
  });
  const geo = new THREE.CircleGeometry(2200, 56);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = -52;
  mesh.frustumCulled = false;
  return mesh;
}

export function createStartGantry(track: TrackPath): THREE.Group {
  const group = new THREE.Group();
  const pillarMat = makeToonMaterial('#e8e2d2', { rimColor: COLORS.rim, rimPower: 3 });
  const bannerMat = makeToonMaterial('#ff4d5e', { emissive: new THREE.Color(1, 0.15, 0.22), emissiveIntensity: 0.5, rimColor: COLORS.rim });
  const pillarGeo = new THREE.BoxGeometry(0.9, 13, 0.9);
  const bannerGeo = new THREE.BoxGeometry(0.55, 2.8, 24);
  const f0 = track.frameAt(0);
  const f1 = track.frameAt(track.length * 0.004);
  const yaw = Math.atan2(f1.tangent.x, f1.tangent.z);
  for (const side of [-1, 1]) {
    const p = new THREE.Mesh(pillarGeo, pillarMat);
    p.position.copy(f0.position).addScaledVector(f0.right, 13.2 * side).addScaledVector(f0.up, 6.5);
    p.rotation.y = yaw;
    group.add(p);
  }
  const banner = new THREE.Mesh(bannerGeo, bannerMat);
  banner.position.copy(f0.position).addScaledVector(f0.up, 13.6);
  banner.rotation.y = yaw;
  group.add(banner);
  group.position.set(0, 0, 0);
  return group;
}

export function createCheckpointGates(track: TrackPath, count = 8): THREE.Group {
  const group = new THREE.Group();
  const mat = makeToonMaterial('#38b6ff', { rimColor: COLORS.rimTeal, rimPower: 3 });
  const topMat = makeToonMaterial('#ffd23f', { emissive: new THREE.Color(1, 0.72, 0.1), emissiveIntensity: 0.8, rimColor: null });
  const pillarGeo = new THREE.BoxGeometry(0.55, 8.2, 0.55);
  const topGeo = new THREE.BoxGeometry(0.4, 1.6, 22);
  for (let i = 0; i < count; i++) {
    const s = track.wrap((i / count) * track.length + track.length * 0.02);
    const f = track.frameAt(s);
    const yaw = Math.atan2(f.tangent.x, f.tangent.z);
    for (const side of [-1, 1]) {
      const p = new THREE.Mesh(pillarGeo, mat);
      p.position.copy(f.position).addScaledVector(f.right, 12.2 * side).addScaledVector(f.up, 4.1);
      p.rotation.y = yaw;
      group.add(p);
    }
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.copy(f.position).addScaledVector(f.up, 8.7);
    top.rotation.y = yaw;
    group.add(top);
  }
  return group;
}
