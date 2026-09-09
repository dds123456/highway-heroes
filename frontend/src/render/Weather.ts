import * as THREE from 'three';
import {EventBus} from '../core/events';
import {WeatherCycle} from './WeatherCycle';
export type WeatherMode='sunny'|'rain'|'snow'|'storm';
export class WeatherSystem {
 readonly group=new THREE.Group();baseMode:WeatherMode='sunny';mode:WeatherMode='sunny';flash=0;
 readonly cycle=new WeatherCycle();
 get intensity():number{return this.cycle.intensity;}
 private count=1400;
 private drops=new Float32Array(this.count*3);
 private lines=new Float32Array(this.count*6);
 private rain:THREE.LineSegments;
 private snow:THREE.Points;
 private snowPositions=new Float32Array(650*3);
 private snowLevel=0;
 constructor(private bus:EventBus){
  for(let i=0;i<this.count;i++){this.drops[i*3]=(Math.random()-.5)*48;this.drops[i*3+1]=Math.random()*30-10;this.drops[i*3+2]=(Math.random()-.5)*48;}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(this.lines,3));
  this.rain=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#c0d3df',transparent:true,opacity:0,depthWrite:false}));
  this.rain.frustumCulled=false;
  for(let i=0;i<650;i++){this.snowPositions[i*3]=(Math.random()-.5)*90;this.snowPositions[i*3+1]=Math.random()*60-15;this.snowPositions[i*3+2]=(Math.random()-.5)*90;}
  const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(this.snowPositions,3));
  const pixels=new Uint8Array(16*16*4);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const k=(y*16+x)*4;pixels[k]=pixels[k+1]=pixels[k+2]=255;pixels[k+3]=Math.round(Math.max(0,1-Math.hypot(x-7.5,y-7.5)/7.5)*255);}
  const map=new THREE.DataTexture(pixels,16,16);map.needsUpdate=true;
  this.snow=new THREE.Points(sg,new THREE.PointsMaterial({map,size:.20,color:'white',transparent:true,opacity:0,depthWrite:false}));this.snow.frustumCulled=false;
  this.rain.layers.set(2);this.snow.layers.set(2);this.group.layers.set(2);this.group.add(this.rain,this.snow);this.group.visible=false;
 }
 setMode(mode:WeatherMode):void{
  this.baseMode=mode;this.cycle.force(mode==='snow'?0:mode==='rain'?.65:mode==='storm'?.9:null);this.flash=0;
 }
 setStorm(active:boolean):void{this.cycle.force(active?.85:null);}
 update(dt:number,camera:THREE.Camera,time:number):void{
  this.group.position.copy(camera.position);const level=this.cycle.update(dt);
  this.snowLevel+=Math.max(-dt/12,Math.min(dt/12,(this.baseMode==='snow'?1:0)-this.snowLevel));
  const next:WeatherMode=this.snowLevel>.01?'snow':level>.005?'rain':'sunny';
  if(next!==this.mode){this.mode=next;this.bus.emit('weather:change',{mode:next});}
  const wind=.5+Math.sin(time*.17)*.18;
  for(let i=0;i<this.count;i++){
   const k=i*3,j=i*6;this.drops[k]+=wind*dt*2;this.drops[k+1]-=(19+(i%7))*dt;
   if(this.drops[k+1]<-12){this.drops[k+1]=20;this.drops[k]=(Math.random()-.5)*48;this.drops[k+2]=(Math.random()-.5)*48;}
   const length=.25+(i%5)*.07;
   this.lines[j]=this.drops[k];this.lines[j+1]=this.drops[k+1];this.lines[j+2]=this.drops[k+2];
   this.lines[j+3]=this.drops[k]-wind*.05;this.lines[j+4]=this.drops[k+1]+length;this.lines[j+5]=this.drops[k+2];
  }
  this.rain.geometry.attributes.position.needsUpdate=true;this.rain.geometry.setDrawRange(0,Math.floor(this.count*level)*2);
  (this.rain.material as THREE.LineBasicMaterial).opacity=.12+level*.30;this.rain.visible=level>.001;
  for(let i=0;i<650;i++){const k=i*3;this.snowPositions[k]+=Math.sin(time*.6+i)*dt*.5;this.snowPositions[k+1]-=dt*2.6;if(this.snowPositions[k+1]<-15)this.snowPositions[k+1]=45;}
  this.snow.geometry.attributes.position.needsUpdate=true;(this.snow.material as THREE.PointsMaterial).opacity=this.snowLevel*.75;this.snow.visible=this.snowLevel>.001;
  this.group.visible=this.rain.visible||this.snow.visible;
 }
}
