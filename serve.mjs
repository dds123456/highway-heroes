import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const base=fileURLToPath(new URL('./frontend/dist/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.ogg':'audio/ogg','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,'http://localhost');
  if(process.argv.includes('--portable')){
   if(url.pathname!=='/' && url.pathname!=='/offline.html'){res.writeHead(404);res.end('Not found');return;}
   const data=await readFile(new URL('./Highway-Heroes-Pacific.html',import.meta.url));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});res.end(data);return;
  }
  const pathname=decodeURIComponent(url.pathname==='/'?'/offline.html':url.pathname);
  const full=resolve(base,'.'+pathname);
  if(!full.startsWith(resolve(base)+sep)){res.writeHead(403);res.end('Forbidden');return;}
  if(!(await stat(full)).isFile())throw Error('not found');
  const data=await readFile(full);res.writeHead(200,{'Content-Type':types[extname(full)]??'application/octet-stream','Cache-Control':'no-cache'});res.end(data);
 }catch {res.writeHead(404);res.end('Not found');}
});
const port=Number(process.env.HIGHWAY_PORT??5189);
server.listen(port,'127.0.0.1',()=>{
 const url='http://127.0.0.1:'+port+'/offline.html';console.log('\nHIGHWAY HEROES / PACIFIC EDITION\n'+url+'\nClose this window or Ctrl+C to stop.\n');
 if(!process.argv.includes('--no-open'))spawn('cmd.exe',['/c','start','',url],{windowsHide:true,stdio:'ignore'});
});
server.on('error',err=>{console.error(err.message+'\nTry another port: set HIGHWAY_PORT=5190');process.exitCode=1;});
