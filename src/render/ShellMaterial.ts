import * as THREE from 'three';

export interface ShellOptions {
  color?: THREE.Color;
  width?: number;
}

const VERT = /* glsl */ `
  uniform float uWidth;
  uniform float uProjectionScale;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(mat3(modelViewMatrix) * normal);
    float worldOffset = uWidth * -mv.z / uProjectionScale;
    mv.xyz += n * worldOffset;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  void main() {
    gl_FragColor = vec4(uColor, 1.0);
  }
`;

export class ShellMaterial extends THREE.ShaderMaterial {
  constructor(options: ShellOptions = {}) {
    super({
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.BackSide,
      uniforms: {
        uWidth: { value: options.width ?? 0.09 },
        uProjectionScale: { value: 720 },
        uColor: { value: options.color ?? new THREE.Color(0x14141c) },
      },
    });
  }
}

export function addShell(
  mesh: THREE.Mesh,
  options: ShellOptions = {},
): THREE.Mesh {
  const shell = new THREE.Mesh(mesh.geometry, new ShellMaterial(options));
  shell.frustumCulled = false;
  mesh.add(shell);
  return shell;
}
