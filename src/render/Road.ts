import * as THREE from 'three';
import { COLORS, WORLD } from '../core/constants';
import { TrackPath } from '../math/TrackPath';
import { makeAsphaltTexture, makeDashedLineTexture } from '../math/utils';

const ROAD_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = cameraPosition - wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const ROAD_FRAG = /* glsl */ `
  uniform vec3 uBase;
  uniform sampler2D uMap;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uAmbient;
  uniform vec3 uRimColor;
  uniform float uGloss;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    vec3 mapColor = texture2D(uMap, vUv).rgb;
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(vViewDir);
    float ndl = clamp(dot(N, uSunDir), 0.0, 1.0);
    float shade = step(0.02, ndl) * 0.5 + step(0.48, ndl) * 0.32 + step(0.82, ndl) * 0.18;
    vec3 col = uBase * mapColor * (uAmbient + shade * uSunColor);
    float spec = pow(clamp(dot(reflect(-uSunDir, N), V), 0.0, 1.0), uGloss);
    col += uSunColor * step(0.88, spec) * 0.18;
    float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);
    col += uRimColor * smoothstep(0.4, 0.8, fres) * 0.12;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const GUIDE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float pulse = 0.78 + 0.22 * sin(uTime * 3.0 + vUv.x * 18.0);
    gl_FragColor = vec4(uColor * pulse, 0.34);
  }
`;

function ribbonGeometry(
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
    const u = (s / 9) % 1;
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

export function createRoadChunks(track: TrackPath, chunkCount = 24): RoadChunk[] {
  const asphaltTex = makeAsphaltTexture();
  const dashTex = makeDashedLineTexture();
  const chunks: RoadChunk[] = [];
  const chunkLength = track.length / chunkCount;
  const sunDir = new THREE.Vector3(0.42, 0.82, -0.38).normalize();

  const asphaltMat = new THREE.ShaderMaterial({
    vertexShader: ROAD_VERT,
    fragmentShader: ROAD_FRAG,
    uniforms: {
      uBase: { value: new THREE.Color(1, 1, 1) },
      uMap: { value: asphaltTex },
      uSunDir: { value: sunDir },
      uSunColor: { value: new THREE.Color(1.08, 1.02, 0.9) },
      uAmbient: { value: new THREE.Color(0.38, 0.42, 0.5) },
      uRimColor: { value: new THREE.Color(0.32, 0.35, 0.42) },
      uGloss: { value: 16 },
    },
  });
  asphaltTex.repeat.set(1, 1);

  const shoulderMat = new THREE.ShaderMaterial({
    vertexShader: ROAD_VERT,
    fragmentShader: ROAD_FRAG,
    uniforms: {
      uBase: { value: new THREE.Color(0.32, 0.35, 0.39) },
      uMap: { value: asphaltTex },
      uSunDir: { value: sunDir },
      uSunColor: { value: new THREE.Color(1.08, 1.02, 0.9) },
      uAmbient: { value: new THREE.Color(0.42, 0.46, 0.54) },
      uRimColor: { value: new THREE.Color(0.25, 0.28, 0.34) },
      uGloss: { value: 10 },
    },
  });

  const laneMat = new THREE.ShaderMaterial({
    vertexShader: ROAD_VERT,
    fragmentShader: ROAD_FRAG,
    transparent: true,
    alphaTest: 0.45,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -1,
    uniforms: {
      uBase: { value: new THREE.Color(1, 1, 1) },
      uMap: { value: dashTex },
      uSunDir: { value: sunDir },
      uSunColor: { value: new THREE.Color(1.08, 1.02, 0.9) },
      uAmbient: { value: new THREE.Color(0.9, 0.9, 0.9) },
      uRimColor: { value: new THREE.Color(0, 0, 0) },
      uGloss: { value: 8 },
    },
  });

  const guideMat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: GUIDE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: COLORS.guide },
      uTime: { value: 0 },
    },
  });

  for (let c = 0; c < chunkCount; c++) {
    const s0 = track.wrap(c * chunkLength);
    const s1 = track.wrap((c + 1) * chunkLength);
    const group = new THREE.Group();
    const asphalt = new THREE.Mesh(ribbonGeometry(track, s0, s1, WORLD.roadHalfWidth), asphaltMat);
    const shoulderL = new THREE.Mesh(
      ribbonGeometry(track, s0, s1, WORLD.roadHalfWidth + WORLD.shoulderWidth, -0.02),
      shoulderMat,
    );
    const shoulderR = new THREE.Mesh(
      ribbonGeometry(track, s0, s1, WORLD.roadHalfWidth + WORLD.shoulderWidth, -0.02),
      shoulderMat,
    );
    const guide = new THREE.Mesh(ribbonGeometry(track, s0, s1, 0.48, 0.055, 0), guideMat);
    guide.layers.set(2);
    group.add(asphalt, shoulderL, shoulderR, guide);

    for (const offset of [-5.2, 0, 5.2]) {
      const line = new THREE.Mesh(ribbonGeometry(track, s0, s1, 0.17, 0.052, 0, offset), laneMat);
      group.add(line);
    }

    const center = track.wrap((c + 0.5) * chunkLength);
    chunks.push({ group, center });
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
