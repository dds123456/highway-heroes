import * as THREE from 'three';

const NORMAL_VERT = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const NORMAL_FRAG = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    gl_FragColor = vec4(vNormal * 0.5 + 0.5, 1.0);
  }
`;

const OUTLINE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const OUTLINE_FRAG = /* glsl */ `
  uniform sampler2D tColor;
  uniform sampler2D tNormal;
  uniform sampler2D tDepth;
  uniform vec2 uTexel;
  uniform vec3 uEdgeColor;
  uniform float uNormalThreshold;
  uniform float uDepthThreshold;
  uniform float uColorThreshold;
  uniform float uEdgeStrength;
  varying vec2 vUv;

  vec3 sampleColor(vec2 o) { return texture2D(tColor, vUv + uTexel * o).rgb; }
  vec3 sampleNormal(vec2 o) { return texture2D(tNormal, vUv + uTexel * o).rgb * 2.0 - 1.0; }
  float sampleDepth(vec2 o) { return texture2D(tDepth, vUv + uTexel * o).x; }
  float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  void main() {
    vec3 base = sampleColor(vec2(0.0, 0.0));

    float cL = lum(sampleColor(vec2(-1.0, 0.0)));
    float cR = lum(sampleColor(vec2(1.0, 0.0)));
    float cU = lum(sampleColor(vec2(0.0, 1.0)));
    float cD = lum(sampleColor(vec2(0.0, -1.0)));
    float cEdge = length(vec2(cR - cL, cU - cD));

    vec3 nL = sampleNormal(vec2(-1.0, 0.0));
    vec3 nR = sampleNormal(vec2(1.0, 0.0));
    vec3 nU = sampleNormal(vec2(0.0, 1.0));
    vec3 nD = sampleNormal(vec2(0.0, -1.0));
    vec3 nEdge = (nR - nL) + (nU - nD);

    float dL = sampleDepth(vec2(-1.0, 0.0));
    float dR = sampleDepth(vec2(1.0, 0.0));
    float dU = sampleDepth(vec2(0.0, 1.0));
    float dD = sampleDepth(vec2(0.0, -1.0));
    float dEdge = abs(dR - dL) + abs(dU - dD);

    float edge = 0.0;
    edge = max(edge, smoothstep(uColorThreshold, uColorThreshold + 0.14, cEdge));
    edge = max(edge, smoothstep(uNormalThreshold, uNormalThreshold + 0.28, length(nEdge)));
    edge = max(edge, smoothstep(uDepthThreshold, uDepthThreshold + 0.012, dEdge));
    edge *= uEdgeStrength;

    vec3 col = mix(base, uEdgeColor, clamp(edge, 0.0, 1.0));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  direct = false;
  private colorTarget: THREE.WebGLRenderTarget;
  private normalTarget: THREE.WebGLRenderTarget;
  private normalMaterial: THREE.ShaderMaterial;
  private outlineMaterial: THREE.ShaderMaterial;
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.colorTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
    });
    this.normalTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      depthTexture: new THREE.DepthTexture(1, 1),
      stencilBuffer: false,
    });

    this.normalMaterial = new THREE.ShaderMaterial({
      vertexShader: NORMAL_VERT,
      fragmentShader: NORMAL_FRAG,
    });

    this.outlineMaterial = new THREE.ShaderMaterial({
      vertexShader: OUTLINE_VERT,
      fragmentShader: OUTLINE_FRAG,
      uniforms: {
        tColor: { value: this.colorTarget.texture },
        tNormal: { value: this.normalTarget.texture },
        tDepth: { value: this.normalTarget.depthTexture },
        uTexel: { value: new THREE.Vector2(1, 1) },
        uEdgeColor: { value: new THREE.Color(0x14141c) },
        uNormalThreshold: { value: 0.16 },
        uDepthThreshold: { value: 0.004 },
        uColorThreshold: { value: 0.26 },
        uEdgeStrength: { value: 0.9 },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.outlineMaterial);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    const w = Math.max(1, Math.floor(width * pixelRatio));
    const h = Math.max(1, Math.floor(height * pixelRatio));
    this.colorTarget.setSize(w, h);
    this.normalTarget.setSize(w, h);
    const uTexel = this.outlineMaterial.uniforms.uTexel.value as THREE.Vector2;
    uTexel.set(1 / w, 1 / h);
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    const r = this.renderer;
    if (this.direct) {
      camera.layers.enableAll();
      r.setRenderTarget(null);
      r.setClearColor(0x000000, 1);
      r.clear(true, true, false);
      scene.overrideMaterial = null;
      r.render(scene, camera);
      return;
    }
    const originalLayers = camera.layers.mask;

    camera.layers.enableAll();
    r.setRenderTarget(this.colorTarget);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, false);
    scene.overrideMaterial = null;
    r.render(scene, camera);

    camera.layers.set(1);
    r.setRenderTarget(this.normalTarget);
    r.setClearColor(0x8080ff, 1);
    r.clear(true, true, false);
    scene.overrideMaterial = this.normalMaterial;
    r.render(scene, camera);
    scene.overrideMaterial = null;

    camera.layers.mask = originalLayers;
    r.setRenderTarget(null);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, false);
    r.render(this.quadScene, this.quadCamera);
  }
}
