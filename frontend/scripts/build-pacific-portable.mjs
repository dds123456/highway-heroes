// Build a truly self-contained single-player artifact. Platform index/SSO remain unchanged.
import {readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dist=join(root,'dist');
let html=readFileSync(join(dist,'offline.html'),'utf8');
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const files=[];
function walk(dir){for(const name of readdirSync(dir)){const p=join(dir,name);if(statSync(p).isDirectory())walk(p);else files.push(p);}}
walk(dist);
const mime={'.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
const matches=[...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g)];
for(const match of matches){
 let js=readFileSync(join(dist,match[1].replace(/^\.\//,'')),'utf8');
 // Only encode assets that the actual bundle references. Legacy CAD/sprite files are not loaded.
 for(const file of files){
  const rel=file.slice(dist.length+1).replaceAll('\\','/');
  const ext=rel.slice(rel.lastIndexOf('.'));
  if(!mime[ext]||!js.includes(rel))continue;
  const data='data:'+mime[ext]+';base64,'+readFileSync(file).toString('base64');
  js=js.replaceAll(rel,data);
 }
 if(/from\s*["']\.\//.test(js))throw Error('Unexpected split JS dependency: update bundling before shipping.');
 js=js.replaceAll('</script','<\\/script');
 html=html.replace(match[0],()=>'<script type="module">'+js+'</script>');
}
for(const match of [...html.matchAll(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/g)]){
 html=html.replace(match[0],()=>'<style>'+readFileSync(join(dist,match[1].replace(/^\.\//,'')),'utf8')+'</style>');
}
html=html.replace(/<link\b[^>]*rel="modulepreload"[^>]*>/g,'');
if(/<(script|link)\b[^>]*(src|href)="(?:\.\/)?assets\//.test(html))throw Error('Unbundled asset reference');
const out=resolve(root,'../Highway-Heroes-Pacific.html');writeFileSync(out,html);
console.log('Portable offline game: '+out+' ('+(Buffer.byteLength(html)/1048576).toFixed(1)+' MB)');
void escape;

