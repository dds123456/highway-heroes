import * as THREE from 'three';
import { hexColor } from '../core/constants';
import type { TrackSpec } from '../core/constants';
function makeCloudTexture():THREE.CanvasTexture {
 const c=document.createElement('canvas');c.width=256;c.height=128;const ctx=c.getContext('2d')!;
 for(let i=0;i<9;i++){
  const x=40+i*22,y=60+Math.sin(i*2)*14,r=28+Math.sin(i)*7;
  const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,253,244,.28)');g.addColorStop(1,'rgba(255,253,244,0)');
  ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
 }
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}

const SKY_VERT = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPosition = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  varying vec3 vWorldPosition;

  void main() {
    vec3 dir = normalize(vWorldPosition - cameraPosition);
    float t = clamp(dir.y * 0.78 + 0.28, 0.0, 1.0);
    float band = t;
    vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.32, band));
    col = mix(col, uTop, smoothstep(0.34, 0.82, band));

    float sunDot = dot(dir, normalize(uSunDir));
    float disc = step(0.9996, sunDot);
    float glow = pow(max(sunDot,0.0), 180.0) * (1.0 - disc);
    col += uSunColor * disc * 1.35;
    col += uSunColor * glow * 0.32;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createSky(sunDir: THREE.Vector3, spec: TrackSpec): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: hexColor(spec.skyTop) },
      uMid: { value: hexColor(spec.skyMid) },
      uHorizon: { value: hexColor(spec.skyHorizon) },
      uSunDir: { value: sunDir.clone().normalize() },
      uSunColor: { value: hexColor(spec.sun) },
    },
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2600, 32, 20), material);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  return sky;
}

export class CloudLayer {
  readonly group = new THREE.Group();
  private sprites: THREE.Sprite[] = [];
  private tex: THREE.CanvasTexture;
  private elapsed = 0;

  constructor(count = 24) {
    this.tex = makeCloudTexture();
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.tex,
        transparent: true,
        opacity: 0.46,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      const angle = (i / count) * Math.PI * 2 + Math.sin(i * 7.3) * 0.5;
      const radius = 620 + Math.sin(i * 3.7) * 420;
      sprite.position.set(
        Math.cos(angle) * radius,
        170 + Math.sin(i * 2.1) * 150 + (i % 5) * 38,
        Math.sin(angle) * radius,
      );
      const s = 70 + (i % 7) * 24;
      sprite.scale.set(s * (1.4 + Math.sin(i) * 0.4), s * 0.62, 1);
      sprite.layers.set(2);
      this.sprites.push(sprite);
      this.group.add(sprite);
    }
  }

  update(dt: number, camera: THREE.Camera): void {
    this.elapsed += dt;
    const cam = camera.position;
    for (const sprite of this.sprites) {
      sprite.position.x += dt * 5.2;
      const dx = sprite.position.x - cam.x;
      const dz = sprite.position.z - cam.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > 1700 * 1700) {
        const angle = Math.atan2(dz, dx) + 1.1;
        const radius = 1150;
        sprite.position.x = cam.x + Math.cos(angle) * radius;
        sprite.position.z = cam.z + Math.sin(angle) * radius;
        sprite.position.y = 150 + Math.sin(this.elapsed + sprite.position.x) * 80;
      }
    }
  }
}
