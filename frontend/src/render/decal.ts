import * as THREE from 'three';

type Ctx = CanvasRenderingContext2D;

/** 透明底 Canvas 贴花纹理（Nearest 像素风，与项目其余 canvas 纹理一致） */
function canvasTex(w: number, h: number, draw: (ctx: Ctx) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

export interface TextDecalOptions {
  color?: string;
  font?: string;
  italic?: boolean;
  size?: number;
  stroke?: string;
  strokeWidth?: number;
  /** 水平镜像（贴左侧面时用，避免文字左右颠倒） */
  flip?: boolean;
}

/** 单词 / 花体文字贴花（斜体衬线近似「草书 script」） */
export function makeTextDecal(text: string, opts: TextDecalOptions = {}): THREE.CanvasTexture {
  const size = opts.size ?? 48;
  const font = opts.font ?? '"Georgia", "Times New Roman", serif';
  const w = Math.max(64, Math.ceil(text.length * size * 0.62) + 28);
  const h = Math.ceil(size * 1.7);
  return canvasTex(w, h, (ctx) => {
    if (opts.flip) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.font = `${opts.italic ? 'italic ' : ''}bold ${size}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    if (opts.stroke) {
      ctx.strokeStyle = opts.stroke;
      ctx.lineWidth = opts.strokeWidth ?? Math.max(2, size * 0.12);
      ctx.strokeText(text, w / 2, h / 2);
    }
    ctx.fillStyle = opts.color ?? '#ffffff';
    ctx.fillText(text, w / 2, h / 2);
  });
}

export interface RoundBadgeOptions {
  size?: number;
  bg?: string;
  ring?: string;
  fg?: string;
  sub?: string;
}

/** 圆形徽章：底 + 外圈 + 中心字（油箱侧徽 / 表盘 / 号码牌） */
export function makeRoundBadge(text: string, opts: RoundBadgeOptions = {}): THREE.CanvasTexture {
  const s = opts.size ?? 64;
  return canvasTex(s, s, (ctx) => {
    const cx = s / 2;
    const cy = s / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.47, 0, Math.PI * 2);
    ctx.fillStyle = opts.bg ?? '#ffffff';
    ctx.fill();
    if (opts.ring) {
      ctx.strokeStyle = opts.ring;
      ctx.lineWidth = Math.max(2, s * 0.09);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.34, 0, Math.PI * 2);
    ctx.strokeStyle = opts.ring ?? '#333333';
    ctx.lineWidth = Math.max(1, s * 0.035);
    ctx.stroke();
    ctx.fillStyle = opts.fg ?? '#222222';
    ctx.font = `bold ${Math.round(s * 0.3)}px "Georgia", "Times New Roman", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, opts.sub ? cy - s * 0.1 : cy);
    if (opts.sub) {
      ctx.font = `bold ${Math.round(s * 0.16)}px "Georgia", "Times New Roman", serif`;
      ctx.fillText(opts.sub, cx, cy + s * 0.24);
    }
  });
}

export interface PlateOptions {
  w?: number;
  h?: number;
  bg?: string;
  fg?: string;
  ring?: string;
}

/** 圆角矩形号码牌 / 标牌 */
export function makeRectPlate(text: string, opts: PlateOptions = {}): THREE.CanvasTexture {
  const w = opts.w ?? 96;
  const h = opts.h ?? 72;
  return canvasTex(w, h, (ctx) => {
    const r = Math.min(w, h) * 0.18;
    const path = new Path2D();
    path.moveTo(r, 0);
    path.lineTo(w - r, 0);
    path.arcTo(w, 0, w, r, r);
    path.lineTo(w, h - r);
    path.arcTo(w, h, w - r, h, r);
    path.lineTo(r, h);
    path.arcTo(0, h, 0, h - r, r);
    path.lineTo(0, r);
    path.arcTo(0, 0, r, 0, r);
    path.closePath();
    ctx.fillStyle = opts.bg ?? '#e8492f';
    ctx.fill(path);
    if (opts.ring) {
      ctx.strokeStyle = opts.ring;
      ctx.lineWidth = Math.max(2, h * 0.08);
      ctx.stroke(path);
    }
    ctx.fillStyle = opts.fg ?? '#ffffff';
    ctx.font = `bold ${Math.round(h * 0.5)}px "Arial Black", "Georgia", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + h * 0.02);
  });
}

export interface ShieldOptions {
  size?: number;
  bg?: string;
  fg?: string;
  accent?: string;
}

/** 鹰标盾徽（bar-and-shield + 双翼挥扫，近似即可） */
export function makeShieldBadge(text: string, opts: ShieldOptions = {}): THREE.CanvasTexture {
  const s = opts.size ?? 96;
  const w = Math.round(s * 0.92);
  const h = s;
  return canvasTex(w, h, (ctx) => {
    const cx = w / 2;
    const top = h * 0.06;
    const bottom = h * 0.94;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.32, top);
    ctx.lineTo(cx + w * 0.32, top);
    ctx.lineTo(cx + w * 0.32, top + h * 0.2);
    ctx.lineTo(cx + w * 0.18, h * 0.52);
    ctx.lineTo(cx, bottom);
    ctx.lineTo(cx - w * 0.18, h * 0.52);
    ctx.lineTo(cx - w * 0.32, top + h * 0.2);
    ctx.closePath();
    ctx.fillStyle = opts.bg ?? '#14141c';
    ctx.fill();
    ctx.strokeStyle = opts.accent ?? '#d8b13b';
    ctx.lineWidth = Math.max(2, s * 0.055);
    ctx.stroke();
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx, h * 0.34);
      ctx.quadraticCurveTo(cx + dir * w * 0.44, h * 0.1, cx + dir * w * 0.48, h * 0.42);
      ctx.quadraticCurveTo(cx + dir * w * 0.3, h * 0.3, cx, h * 0.52);
      ctx.stroke();
    }
    ctx.fillStyle = opts.fg ?? '#ffffff';
    ctx.font = `bold ${Math.round(s * 0.13)}px "Georgia", "Times New Roman", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, h * 0.66);
  });
}

/** 把纹理包成一张贴片 Mesh（双面透明，renderOrder 抬高避免与表面 z-fight） */
export function decalPlane(tex: THREE.Texture, w: number, h: number): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.renderOrder = 2;
  return mesh;
}
