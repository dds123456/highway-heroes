/** Optional local visual-QA tools. Never change records or server data. */
export function installArtInspector():void {
 if(!new URLSearchParams(location.search).has('artReview'))return;
 const panel=document.createElement('aside');panel.id='art-inspector';
 panel.style.cssText='position:fixed;top:12px;left:220px;z-index:45;background:#182126eF;color:#e9e5db;padding:12px;font:12px Segoe UI;border:1px solid #7d8a90;border-radius:4px;max-width:620px';
 const title=document.createElement('div');title.textContent='本地美术检查 · F2 显示/隐藏';panel.append(title);
 const row=document.createElement('div');row.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:8px 0';panel.append(row);
 const button=(name:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=name;b.style.cssText='padding:6px;background:#3c4a50;color:white;border:1px solid #8d989a;cursor:pointer';b.onclick=fn;row.append(b);};
 for(const [label,mode] of [['跟车','chase'],['侧面','side'],['环绕','orbit'],['远景','far']] as const)button(label,()=>window.__RACE_DEBUG__?.setCamera(mode));
 for(const [label,mode] of [['晴天','sunny'],['下雨','rain'],['降雪','snow']] as const)button(label,()=>window.__RACE_DEBUG__?.setWeather(mode));
 button('下一路段',()=>{const d=window.__RACE_DEBUG__;if(d)d.jumpTo(d.getState().progress+400);});
 button('查看加速带',()=>window.__RACE_DEBUG__?.inspectRoadSignal('pad'));
 button('查看导弹拾取物',()=>window.__RACE_DEBUG__?.inspectRoadSignal('pickup'));
 button('试驾 10 秒',()=>{
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',key:'w',bubbles:true}));
  setTimeout(()=>window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',key:'w',bubbles:true})),10000);
 });
 const out=document.createElement('output');out.setAttribute('aria-label','实时渲染统计');panel.append(out);document.body.append(panel);
 setInterval(()=>{const d=window.__RACE_DEBUG__?.getState();if(d)out.textContent=JSON.stringify(d);},500);
 out.style.cssText='display:block;max-width:600px;overflow-wrap:anywhere;font:11px monospace';
 window.addEventListener('keydown',e=>{if(e.code==='F2'){e.preventDefault();panel.hidden=!panel.hidden;}});
}
