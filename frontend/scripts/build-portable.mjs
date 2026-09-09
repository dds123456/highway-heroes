// 生成「单文件离线版」：把 dist 里的 JS / CSS / 背景音乐全部内联进一个 highway-heroes.html
// 用法：npm run build 之后执行  node scripts/build-portable.mjs
// 产物 dist/highway-heroes.html —— 双击即可在浏览器里玩，无需 Node.js / 无需服务器
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const assets = readdirSync(join(dist, 'assets'));
let html = readFileSync(join(dist, 'index.html'), 'utf8');

// 1) 内联 CSS
for (const f of assets.filter((x) => x.endsWith('.css'))) {
  const css = readFileSync(join(dist, 'assets', f), 'utf8');
  const tag = html.match(new RegExp(`<link\\b[^>]*href="\\./assets/${esc(f)}"[^>]*>`))?.[0];
  if (tag) html = html.replace(tag, () => `<style>${css}</style>`);
}

// 2) 内联 JS，并把背景音乐替换为 data URI
for (const f of assets.filter((x) => x.endsWith('.js'))) {
  let js = readFileSync(join(dist, 'assets', f), 'utf8');
  for (const m of readdirSync(join(dist, 'music')).filter((x) => x.endsWith('.mp3'))) {
    const b64 = readFileSync(join(dist, 'music', m)).toString('base64');
    js = js.replaceAll(`music/${m}`, `data:audio/mpeg;base64,${b64}`);
  }
  // 内联 GLB 摩托车模型
  for (const m of readdirSync(join(dist, 'models')).filter((x) => x.endsWith('.glb'))) {
    const b64 = readFileSync(join(dist, 'models', m)).toString('base64');
    js = js.replaceAll(`models/${m}`, `data:model/gltf-binary;base64,${b64}`);
  }
  // 内联引擎 / 天气等 OGG 采样（audio/ 下所有子目录）
  for (const sub of readdirSync(join(dist, 'audio'))) {
    const dir = join(dist, 'audio', sub);
    if (!existsSync(dir)) continue;
    for (const m of readdirSync(dir).filter((x) => x.endsWith('.ogg'))) {
      const b64 = readFileSync(join(dir, m)).toString('base64');
      js = js.replaceAll(`audio/${sub}/${m}`, `data:audio/ogg;base64,${b64}`);
    }
  }
  js = js.replaceAll('</script', '<\\/script');
  const tag = html.match(new RegExp(`<script\\b[^>]*src="\\./assets/${esc(f)}"[^>]*></script>`))?.[0];
  if (tag) html = html.replace(tag, () => `<script type="module">${js}</script>`);
}

const out = join(dist, 'highway-heroes.html');
writeFileSync(out, html);
const mb = (html.length / 1048576).toFixed(1);
console.log(`✔ 单文件离线版已生成：dist/highway-heroes.html（${mb} MB，双击即可游玩）`);