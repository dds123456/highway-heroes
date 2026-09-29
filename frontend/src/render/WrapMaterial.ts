import * as THREE from 'three';
import { hexColor } from '../core/constants';
import { getGradient, getMatcap } from './ToonMaterial';

/**
 * 车衣材质：与 ToonMaterial 同一套 NPR 明暗（渐变分阶 + matcap 高光 + 描边光），
 * 但把「底色」换成三平面采样的车衣贴图——沿法线加权混合三个轴向的投影，
 * 让贴图无需 UV 也能无缝包裹 GLB 外壳曲面。
 */
const VERT = /* glsl */ `
  varying vec3 vObjectPos;
  varying vec3 vObjectNormal;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  varying vec3 vViewNormal;
  void main() {
    vObjectPos = position;
    vObjectNormal = normal;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = cameraPosition - wp.xyz;
    vViewNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uWrapMap;
  uniform float uWrapScale;
  uniform sampler2D uGradientMap;
  uniform sampler2D uMatcap;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uAmbient;
  uniform vec3 uRimColor;
  uniform float uRimPower;
  uniform float uSpecular;

  varying vec3 vObjectPos;
  varying vec3 vObjectNormal;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  varying vec3 vViewNormal;

  void main() {
    vec3 blend = pow(abs(normalize(vObjectNormal)), vec3(4.0));
    blend /= max(dot(blend, vec3(1.0)), 0.0001);
    vec3 wp = vObjectPos * uWrapScale;
    vec3 sx = texture2D(uWrapMap, wp.zy).rgb;
    vec3 sy = texture2D(uWrapMap, wp.xz).rgb;
    vec3 sz = texture2D(uWrapMap, wp.xy).rgb;
    vec3 base = sx * blend.x + sy * blend.y + sz * blend.z;

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

    gl_FragColor = vec4(col, 1.0);
  }
`;

export interface WrapMaterialOptions {
  wrapScale?: number;
  rimColor?: THREE.Color | string;
  rimPower?: number;
  specular?: number;
}

export class WrapMaterial extends THREE.ShaderMaterial {
  constructor(texture: THREE.Texture, options: WrapMaterialOptions = {}) {
    const rimColor = options.rimColor
      ? options.rimColor instanceof THREE.Color
        ? options.rimColor
        : hexColor(options.rimColor)
      : hexColor('#ff4fa3');
    super({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uWrapMap: { value: texture },
        uWrapScale: { value: options.wrapScale ?? 2.25 },
        uGradientMap: { value: getGradient() },
        uMatcap: { value: getMatcap() },
        uSunDir: { value: new THREE.Vector3(0.42, 0.82, -0.38).normalize() },
        uSunColor: { value: new THREE.Color(1.18, 1.1, 0.92) },
        uAmbient: { value: new THREE.Color(0.42, 0.48, 0.6) },
        uRimColor: { value: rimColor },
        uRimPower: { value: options.rimPower ?? 4.5 },
        uSpecular: { value: options.specular ?? 0.55 },
      },
    });
  }
}

export function makeWrapMaterial(texture: THREE.Texture, options: WrapMaterialOptions = {}): WrapMaterial {
  return new WrapMaterial(texture, options);
}