import * as THREE from 'three';
import { makeGradientTexture, makeMatcapTexture } from '../math/utils';

export interface ToonMaterialOptions {
  color?: THREE.Color | string;
  map?: THREE.Texture | null;
  rimColor?: THREE.Color | null;
  rimPower?: number;
  gloss?: number;
  specular?: number;
  emissive?: THREE.Color | null;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  depthWrite?: boolean;
}

const VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  varying vec3 vViewNormal;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = cameraPosition - wp.xyz;
    vViewNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform sampler2D uGradientMap;
  uniform sampler2D uMatcap;
  uniform sampler2D uMap;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uAmbient;
  uniform vec3 uRimColor;
  uniform float uRimPower;
  uniform float uGloss;
  uniform float uSpecular;
  uniform vec3 uEmissive;
  uniform float uEmissiveIntensity;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  varying vec3 vViewNormal;

  void main() {
    vec3 base = uColor;
    #ifdef USE_MAP
      base *= texture2D(uMap, vUv).rgb;
    #endif
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(vViewDir);
    float ndl = clamp(dot(N, uSunDir), 0.0, 1.0);
    float shade = texture2D(uGradientMap, vec2(ndl * 0.98 + 0.01, 0.5)).r;
    vec3 col = base * (uAmbient + shade * uSunColor);

    vec2 mc = vViewNormal.xy * 0.5 + 0.5;
    float mat = texture2D(uMatcap, mc).r;
    mat = floor(mat * 3.0 + 0.5) / 3.0;
    col += base * uSpecular * mat * uSunColor * 0.9;

    float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), uRimPower);
    fres = smoothstep(0.0, 0.22, fres);
    col += uRimColor * fres;

    #ifdef USE_EMISSIVE
      col += uEmissive * uEmissiveIntensity;
    #endif

    gl_FragColor = vec4(col, 1.0);
  }
`;

let sharedGradient: THREE.DataTexture | null = null;
let sharedMatcap: THREE.CanvasTexture | null = null;

function getGradient(): THREE.DataTexture {
  if (!sharedGradient) sharedGradient = makeGradientTexture([0.14, 0.42, 0.72, 1.0]);
  return sharedGradient;
}

function getMatcap(): THREE.CanvasTexture {
  if (!sharedMatcap) sharedMatcap = makeMatcapTexture();
  return sharedMatcap;
}

export class ToonMaterial extends THREE.ShaderMaterial {
  constructor(options: ToonMaterialOptions = {}) {
    const color = options.color instanceof THREE.Color ? options.color : new THREE.Color(options.color ?? '#ffffff');
    const rimColor = options.rimColor ?? new THREE.Color(0xff4fa3);
    const emissive = options.emissive ?? new THREE.Color(0, 0, 0);
    const defines: Record<string, string> = {};
    if (options.map) defines.USE_MAP = '';
    if (options.emissiveIntensity && options.emissiveIntensity > 0) defines.USE_EMISSIVE = '';
    super({
      vertexShader: VERT,
      fragmentShader: FRAG,
      defines,
      transparent: options.transparent ?? false,
      opacity: options.opacity ?? 1,
      depthWrite: options.depthWrite ?? true,
      uniforms: {
        uColor: { value: color },
        uGradientMap: { value: getGradient() },
        uMatcap: { value: getMatcap() },
        uMap: { value: options.map ?? null },
        uSunDir: { value: new THREE.Vector3(0.42, 0.82, -0.38).normalize() },
        uSunColor: { value: new THREE.Color(1.12, 1.04, 0.86) },
        uAmbient: { value: new THREE.Color(0.42, 0.48, 0.6) },
        uRimColor: { value: rimColor },
        uRimPower: { value: options.rimPower ?? 4.5 },
        uGloss: { value: options.gloss ?? 22 },
        uSpecular: { value: options.specular ?? 0.55 },
        uEmissive: { value: emissive },
        uEmissiveIntensity: { value: options.emissiveIntensity ?? 0 },
      },
    });
  }
}

export function makeToonMaterial(color: THREE.Color | string, options: ToonMaterialOptions = {}): ToonMaterial {
  return new ToonMaterial({ color, ...options });
}
