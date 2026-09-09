// 生成 PWA 图标与分享封面（纯 Node，仅用内置 zlib，无外部依赖）。
// 产物为简单的渐变 + 道路条 PNG 占位图；正式上线前可替换为真实截图。
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

function mix(a, b, t) {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
}

function paintCover(width, height) {
  const top = hex('#2f86ff');
  const mid = hex('#5a3fd9');
  const bottom = hex('#211e2e');
  const road = hex('#ffd23f');
  const ink = [33, 30, 46, 255];
  const buf = Buffer.alloc(width * height * 4);
  const roadStart = Math.floor(height * 0.78);
  for (let y = 0; y < height; y++) {
    let c;
    if (y < height * 0.45) c = mix(top, mid, y / (height * 0.45));
    else c = mix(mid, bottom, (y - height * 0.45) / (height * 0.55));
    let r = c[0];
    let g = c[1];
    let b = c[2];
    if (y >= roadStart) {
      const inLane = y >= roadStart + 14 && y < height - 8;
      if (inLane) {
        r = road[0];
        g = road[1];
        b = road[2];
      } else {
        r = ink[0];
        g = ink[1];
        b = ink[2];
      }
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      buf[o] = r;
      buf[o + 1] = g;
      buf[o + 2] = b;
      buf[o + 3] = 255;
    }
  }
  return buf;
}

function write(dir, file, size, ratio) {
  mkdirSync(dir, { recursive: true });
  const buf = paintCover(size, Math.round(size * ratio));
  writeFileSync(join(dir, file), encodePng(size, Math.round(size * ratio), buf));
  console.log(`generated ${join(dir, file)}`);
}

write(join(root, 'public', 'icons'), 'icon-192.png', 192, 1);
write(join(root, 'public', 'icons'), 'icon-512.png', 512, 1);
write(join(root, 'public', 'social'), 'og-cover.png', 1200, 630 / 1200);
