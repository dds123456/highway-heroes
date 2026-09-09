import * as THREE from 'three';
import {WORLD} from '../core/constants';
import type {TrackSpec} from '../core/constants';
import {TrackPath} from '../math/TrackPath';
import {mat,box,mesh,tube,bakeGroup,labelTexture,surfaceTexture,rng} from './Art';

export interface EnvironmentChunk {group:THREE.Group;center:number;}
function at(track:TrackPath,s:number,lateral:number):THREE.Group {
 const f=track.frameAt(track.wrap(s));const g=new THREE.Group();
 g.position.copy(f.position).addScaledVector(f.right,lateral);g.position.y-=.2;
 g.rotation.y=Math.atan2(f.tangent.x,f.tangent.z);return g;
}
function frond():THREE.BufferGeometry {
 const positions:number[]=[],uv:number[]=[],indices:number[]=[];
 for(let i=0;i<=14;i++){
  const t=i/14,x=t*3.4,y=Math.sin(t*Math.PI)*.85-t*t*.8;
  const width=Math.sin(Math.PI*t)*.48*(i%2?.7:1);
  positions.push(x,y,-width,x,y+.05,0,x,y,width);uv.push(t,0,t,.5,t,1);
  if(i<14)for(let k=0;k<2;k++){const a=i*3+k;indices.push(a,a+3,a+1,a+1,a+3,a+4);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function tree(snow:boolean,bark:THREE.Material,leaf:THREE.Material,height:number):THREE.Group {
 const g=new THREE.Group();
 if(snow){
  mesh(g,new THREE.CylinderGeometry(.12,.25,height,9),bark,0,height*.5);
  for(let level=0;level<8;level++){
   const length=(1-level/9)*2.8;
   for(let branch=0;branch<7;branch++){
    const geo=new THREE.PlaneGeometry(length*.8,length);geo.translate(0,length*.5,0);geo.rotateX(Math.PI/2+.18);
    const crown=mesh(g,geo,leaf,0,height*(.18+level*.105),0);crown.rotation.y=branch*Math.PI*2/7+level*.75;
   }
  }
 }else{
  tube(g,[[0,0,0],[.12,height*.35,0],[.42,height*.72,.1],[.62,height,.2]],.18,bark,14);
  for(let i=0;i<9;i++){
   const leafMesh=mesh(g,frond(),leaf,.62,height,.2);leafMesh.rotation.y=i*Math.PI*2/9;leafMesh.rotation.z=(i%3)*.13;
  }
  mesh(g,new THREE.SphereGeometry(.35,9,6),bark,.62,height-.12,.2);
 }
 return g;
}
function pineTexture():THREE.CanvasTexture {
 const c=document.createElement('canvas');c.width=128;c.height=256;const ctx=c.getContext('2d')!;
 const rand=rng(48);ctx.lineCap='round';
 ctx.strokeStyle='#aaa';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(64,250);ctx.lineTo(64,8);ctx.stroke();
 for(let i=0;i<44;i++){
  const y=18+i*5,width=10+(y/256)*45;
  for(const side of [-1,1]){
   const endX=64+side*width,endY=y-14-rand()*12;
   ctx.strokeStyle=rand()>.5?'#dddddd':'#a8a8a8';ctx.lineWidth=1.8;
   ctx.beginPath();ctx.moveTo(64,y+8);ctx.lineTo(endX,endY);ctx.stroke();
   for(let n=1;n<7;n++){
    const t=n/7,x=64+(endX-64)*t,yy=y+8+(endY-y-8)*t;
    ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(x+side*7,yy-10);ctx.stroke();
   }
  }
 }
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
export function createEnvironmentChunks(track:TrackPath,spec:TrackSpec,chunkCount=24):EnvironmentChunk[]{
 const rand=rng(spec.id==='meadow'?88:spec.id==='canyon'?200:500);
 const steel=mat('#777f80',.5,.65),dark=mat('#343b3c',.68,.25),stone=mat('#c0b9a7',.96),white=mat('#d9d8cc',.9);
 const bark=mat('#79705a',.97),leaf=mat(spec.tree,1),bush=mat(spec.treeDark,1);leaf.side=THREE.DoubleSide;
 const pine=new THREE.MeshStandardMaterial({map:pineTexture(),color:spec.tree,alphaTest:.35,side:THREE.DoubleSide,roughness:1});
 const facade=mat('#c6beb0',.95);facade.map=surfaceTexture('concrete','#d0c7b5');facade.bumpMap=facade.map;facade.bumpScale=.1;
 const glass=new THREE.MeshStandardMaterial({color:'#445a63',roughness:.25,metalness:.45});
 const roof=mat('#746f65',.92),yellow=mat('#b49b5d',.82),stripe=mat('#a65037',.85);
 const tones=['#bcb5a4','#a6aba8','#b5a58e','#c1bcae','#9b9e95','#b7a48b'].map(c=>{const m=mat(c,.94);m.bumpMap=facade.map;m.bumpScale=.06;return m;});
 const pavement=mat('#858783',.98),soil=mat('#817c65',1),parking=mat('#656967',.95);
 const chunks:EnvironmentChunk[]=[];const length=track.length/chunkCount;
 for(let c=0;c<chunkCount;c++){
  const group=new THREE.Group();const s0=c*length;
  // Correctly sized geometry batches replace v2's one-element instance buffers.
  for(let i=0;i<Math.ceil(length/6);i++){
   const s=s0+i*6;
   for(const side of [-1,1]){
    const kit=at(track,s,side*11.8);group.add(kit);
    box(kit,[.12,.95,.12],[0,.48,0],steel);
    box(kit,[.1,.32,6.08],[0,.83,0],steel);
    box(kit,[.14,.055,6.08],[0,.7,0],steel);
    if(i%4===0)box(kit,[.14,.09,.16],[-side*.02,1.02,0],white);
   }
  }
  const city=spec.id==='meadow';const snow=spec.id==='snowfield';
  const treeCount=city?12:snow?15:6;
  for(let i=0;i<treeCount;i++){
   const side=i%2?1:-1;const kit=at(track,s0+(i+.3)/treeCount*length,side*(17+rand()*30));group.add(kit);
   const t=tree(snow,bark,snow?pine:leaf,city?7+rand()*4:snow?6+rand()*5:3+rand()*3);
   t.rotation.y=rand()*Math.PI*2;kit.add(t);
   const bed=mesh(kit,new THREE.CircleGeometry(1.3,16),soil,0,.025,0);bed.rotation.x=-Math.PI/2;bed.castShadow=false;
   for(let j=0;j<3;j++){
    const shrub=mesh(kit,new THREE.IcosahedronGeometry(.5+rand()*.5,1),bush,(rand()-.5)*4,.4,(rand()-.5)*3);
    shrub.scale.set(1,.6,1.3);
   }
  }
  const buildingCount=city?4:spec.id==='canyon'?(c%3===0?2:0):(c%4===0?2:0);
  for(let i=0;i<buildingCount;i++){
   const side=i%2?1:-1,s=s0+(i+.5)/buildingCount*length;
   const kit=at(track,s,side*(25+rand()*9));group.add(kit);
   const w=8+rand()*7,d=8+rand()*8,floors=city?(c%4===0?1:2+Math.floor(rand()*4)):1+Math.floor(rand()*2),h=floors*3.2;
   box(kit,[w+3,.2,d+3],[0,-.05,0],pavement);
   const apron=box(kit,[7,.04,d+3],[-side*(w/2+4.8),-.14,0],parking);void apron;
   for(let bay=0;bay<Math.floor(d/2.5);bay++){
    box(kit,[4,.008,.07],[-side*(w/2+4.4),-.113,-d/2+bay*2.5],white);
   }
   if((c+i)%3===0){
    // A lower side wing breaks the repeated tower silhouette.
    box(kit,[w*.7,3.2,d*.55],[w*.65,1.6,d*.2],tones[(c+i+2)%tones.length]);
    box(kit,[w*.72,.16,d*.57],[w*.65,3.25,d*.2],roof);
   }
   box(kit,[w,h,d],[0,h/2,0],tones[(c+i)%tones.length]);
   box(kit,[w+.5,.28,d+.5],[0,h+.1,0],white);
   for(let level=0;level<floors;level++){
    const y=1.7+level*3.2;
    for(const face of [-1,1]){
     for(let col=0;col<Math.floor(d/2.2);col++){
      const z=-d/2+1.15+col*2.2;
      box(kit,[.09,1.66,1.35],[face*(w/2+.04),y,z],dark);
      box(kit,[.1,1.4,1.13],[face*(w/2+.06),y,z],glass);
      box(kit,[.18,.09,1.5],[face*(w/2+.12),y-.88,z],white);
     }
     for(let col=0;col<Math.floor(w/2.3);col++){
      const x=-w/2+1.2+col*2.3;
      box(kit,[1.35,1.66,.08],[x,y,face*(d/2+.04)],dark);
      box(kit,[1.13,1.4,.1],[x,y,face*(d/2+.06)],glass);
     }
    }
    if(level>0)box(kit,[w+.1,.1,d+.1],[0,level*3.2,0],white);
   }
   // Rooftop plant, coping, storefront canopy and supported entrance.
   box(kit,[2.4,.9,1.7],[w*.19,h+.55,0],steel);
   for(let vent=0;vent<5;vent++)box(kit,[2,.06,.05],[w*.19,h+.65,-.55+vent*.25],dark);
   box(kit,[1.6,.6,1.4],[-w*.24,h+.4,d*.2],roof);
   box(kit,[2.4,.15,d*.7],[side*(-w/2-.85),2.7,0],c%2?stripe:yellow);
   for(const z of [-d*.3,d*.3])box(kit,[.09,2.6,.09],[side*(-w/2-1.8),1.3,z],dark);
   const name=city?['PACIFIC MOTEL','AUTO SERVICE','COAST MARKET'][i%3]:snow?'ALPINE LODGE':'DESERT FUEL';
   if(i===0){
    const sign=mesh(kit,new THREE.PlaneGeometry(d*.66,.9),new THREE.MeshStandardMaterial({map:labelTexture(name,'OPEN / 24 HOURS','#343c3b'),roughness:.8}),-side*(w/2+.13),3.1,0);
    sign.rotation.y=-side*Math.PI/2;
   }
   if(snow){
    const r=mesh(kit,new THREE.ConeGeometry(w*.78,3,4),roof,0,h+1.5);r.rotation.y=Math.PI/4;r.scale.z=d/w;
   }
  }
  for(let i=0;i<Math.max(1,Math.floor(length/65));i++){
   const side=i%2?1:-1,kit=at(track,s0+(i+.5)*65,side*13.5);group.add(kit);
   tube(kit,[[0,0,0],[0,7.4,0],[-side*.5,8,0],[-side*2.7,8,0]],.065,steel,10);
   box(kit,[.75,.12,.33],[-side*2.6,7.94,0],dark,.025);
   box(kit,[.58,.025,.23],[-side*2.6,7.87,0],white);
   box(kit,[.3,.6,.3],[0,.3,0],stone);
  }
  if(c%3===0){
   const kit=at(track,s0+length*.7,-15);group.add(kit);
   for(const x of [-1.8,1.8])box(kit,[.1,4.8,.12],[x,2.4,0],steel);
   const names=spec.id==='meadow'?['PACIFIC COAST','DOWNTOWN  /  NORTH']:spec.id==='canyon'?['DESERT HIGHWAY','NEXT SERVICES  12 MI']:['ALPINE PASS','CHAINS REQUIRED'];
   const signMat=new THREE.MeshStandardMaterial({map:labelTexture(names[0],names[1]),roughness:.8,side:THREE.DoubleSide});
   mesh(kit,new THREE.PlaneGeometry(5.4,2),signMat,0,4.8,0).rotation.y=Math.PI;
  }
  bakeGroup(group);chunks.push({group,center:track.wrap((c+.5)*length)});
 }
 return chunks;
}
export function updateEnvironmentVisibility(chunks:EnvironmentChunk[],playerProgress:number,trackLength:number,radius:number=WORLD.streamRadius*1.25):void{
 for(const chunk of chunks){const d=Math.abs(chunk.center-playerProgress);chunk.group.visible=Math.min(d,trackLength-d)<radius;}
}
export function createMountains(spec:TrackSpec):THREE.Group {
 const group=new THREE.Group();const material=mat(spec.mountain,.98);const snow=spec.id==='snowfield';
 for(let i=0;i<20;i++){
  const geo=new THREE.SphereGeometry(1,24,14,0,Math.PI*2,0,Math.PI/2);
  const p=geo.getAttribute('position');
  for(let v=0;v<p.count;v++){
   const x=p.getX(v),y=p.getY(v),z=p.getZ(v),n=1+.15*Math.sin(x*12+i)*Math.cos(z*9-i)+.08*Math.sin(z*24);
   p.setXYZ(v,x*310,y*(snow?240:145)*n,z*270);
  }
  geo.computeVertexNormals();
  const a=i/20*Math.PI*2,r=1150+Math.sin(i*7)*180;
  const hill=mesh(group,geo,material,Math.cos(a)*r,-51,Math.sin(a)*r);
  hill.castShadow=false;
 }
 return group;
}
export function createTerrain(spec:TrackSpec,track?:TrackPath):THREE.Mesh{
 const tex=surfaceTexture('ground',spec.terrain);tex.repeat.set(90,90);
 const material=new THREE.MeshStandardMaterial({map:tex,roughness:1,side:THREE.DoubleSide});
 const geo=new THREE.PlaneGeometry(5000,5000);geo.rotateX(-Math.PI/2);
 const terrain=new THREE.Mesh(geo,material);terrain.position.y=-52;terrain.receiveShadow=true;
 if(track){
  // Graded shoulders connect the elevated original track to the surrounding ground.
  const pos:number[]=[],uv:number[]=[],index:number[]=[];const count=Math.ceil(track.length/12);
  const widths=[-160,-65,-24,24,65,160];
  for(let i=0;i<=count;i++){
   const f=track.frameAt(track.wrap(i/count*track.length));
   for(let j=0;j<widths.length;j++){
    const lateral=widths[j],p=f.position.clone().addScaledVector(f.right,lateral);
    p.y=Math.abs(lateral)>100?-51.8:f.position.y-.28;
    pos.push(p.x,p.y+52,p.z);uv.push(p.x/5000+.5,p.z/5000+.5);
   }
   if(i<count)for(let j=0;j<5;j++){const a=i*6+j;index.push(a,a+6,a+1,a+1,a+6,a+7);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();
  const verge=new THREE.Mesh(g,material);verge.receiveShadow=true;terrain.add(verge);
 }
 return terrain;
}
function gantry(track:TrackPath,s:number,title:string,sub:string):THREE.Group{
 const kit=at(track,s,0),steel=mat('#707978',.5,.6),concrete=mat('#b5b1a4',.94);
 for(const side of [-1,1]){
  box(kit,[.7,.65,.8],[side*12.4,.32,0],concrete);
  tube(kit,[[side*12.4,0,0],[side*12.4,7.2,0],[side*11.8,7.7,0]],.11,steel,4);
 }
 for(const y of [7.5,8.25])box(kit,[25,.1,.12],[0,y,0],steel);
 for(let i=0;i<20;i++)tube(kit,[[-12.5+i*1.25,7.5,0],[-11.875+i*1.25,8.25,0]],.025,steel,1);
 const signMat=new THREE.MeshStandardMaterial({map:labelTexture(title,sub),roughness:.75,side:THREE.DoubleSide});
 const sign=mesh(kit,new THREE.PlaneGeometry(9,2.4),signMat,0,7.7,-.14);sign.rotation.y=Math.PI;
 return kit;
}
export function createStartGantry(track:TrackPath):THREE.Group{return gantry(track,0,'HIGHWAY HEROES','PACIFIC EDITION  /  START - FINISH');}
export function createCheckpointGates(track:TrackPath,count=8):THREE.Group{
 const group=new THREE.Group();
 for(let i=0;i<count;i++)group.add(gantry(track,track.wrap((i/count+.02)*track.length),'ROUTE  88','CHECKPOINT  '+String(i+1).padStart(2,'0')+'   ↑'));
 bakeGroup(group);return group;
}
