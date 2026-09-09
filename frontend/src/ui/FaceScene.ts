import * as THREE from 'three';
import {configureLighting,disposeObject,mat,mesh} from '../render/Art';
import type {LightingRig} from '../render/Art';
import {createRiderFigure} from '../entities/CharacterAsset';
import type {RiderFigure} from '../entities/CharacterAsset';
import type {CharacterProfile} from '../settings/CharacterStore';
export type CharacterView='full'|'torso'|'face';
/** Full-body studio. Editor and race construct exactly the same parameterized anatomy. */
export class FaceScene {
 readonly canvas:HTMLCanvasElement;
 private renderer:THREE.WebGLRenderer;
 private lighting:LightingRig;
 private scene=new THREE.Scene();
 private camera=new THREE.PerspectiveCamera(32,1,.02,30);
 private turntable=new THREE.Group();
 private figure:RiderFigure;
 private pending:CharacterProfile|null=null;
 private yaw=-.18;
 private dragging=false;
 private lastX=0;
 private view:CharacterView='full';
 private disposed=false;
 private spin=false;
 private helmet=false;
 private idleTime=0;
 constructor(container:HTMLElement,profile:CharacterProfile){
  this.canvas=document.createElement('canvas');this.canvas.className='face-canvas';
  this.canvas.setAttribute('aria-label','三维全身角色预览，可拖动旋转');container.appendChild(this.canvas);
  this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
  this.scene.background=new THREE.Color('#aab0b0');
  this.lighting=configureLighting(this.scene,this.renderer,true);
  this.figure=createRiderFigure({suit:'#343b42',panel:'#454c52',accent:'#963e39'},profile);
  this.figure.group.rotation.y=Math.PI;this.figure.stand();this.turntable.add(this.figure.group);this.scene.add(this.turntable);
  const floor=mesh(this.scene,new THREE.CircleGeometry(5,64),mat('#777f81',.95));floor.rotation.x=-Math.PI/2;floor.position.y=-.01;
  const ring=mesh(this.scene,new THREE.TorusGeometry(.52,.003,6,64),mat('#c6c8bb'));ring.rotation.x=Math.PI/2;ring.position.y=.001;
  this.canvas.addEventListener('pointerdown',e=>{this.dragging=true;this.lastX=e.clientX;this.spin=false;this.canvas.setPointerCapture(e.pointerId);});
  this.canvas.addEventListener('pointermove',e=>{if(this.dragging){this.yaw+=(e.clientX-this.lastX)*.008;this.lastX=e.clientX;}});
  const end=()=>{this.dragging=false;};this.canvas.addEventListener('pointerup',end);this.canvas.addEventListener('pointercancel',end);
 }
 setAppearance(profile:CharacterProfile):void{this.pending=structuredClone(profile);}
 setView(view:CharacterView):void{this.view=view;}
 setAngle(angle:number):void{this.yaw=angle;this.spin=false;}
 setSpin(value:boolean):void{this.spin=value;}
 setHelmet(value:boolean):void{this.helmet=value;this.figure.setHelmet(value);}
 render(dt:number):void{
  if(this.disposed)return;
  if(this.pending){this.figure.setAppearance(this.pending);this.figure.stand();this.figure.setHelmet(this.helmet);this.pending=null;}
  this.idleTime+=dt;
  this.figure.bones.chest.rotation.x=Math.sin(this.idleTime*1.4)*.006;
  this.figure.bones.head.rotation.y=-.025+Math.sin(this.idleTime*.45)*.014;
  if(this.spin&&!this.dragging)this.yaw+=dt*.32;this.turntable.rotation.y=this.yaw;
  const w=Math.max(1,this.canvas.clientWidth),h=Math.max(1,this.canvas.clientHeight);
  if(this.canvas.width!==Math.floor(w*this.renderer.getPixelRatio())||this.canvas.height!==Math.floor(h*this.renderer.getPixelRatio())){
   this.renderer.setSize(Math.floor(w),Math.floor(h),false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
  }
  this.figure.group.updateWorldMatrix(true,true);
  const headY=this.figure.bones.head.getWorldPosition(new THREE.Vector3()).y;
  const top=headY+.19;
  const y=this.view==='face'?headY+.042:this.view==='torso'?top-.39:top*.49;
  const distance=(this.view==='face'?(this.helmet?.91:.72):this.view==='torso'?1.6:3.6)*Math.max(1,.70/this.camera.aspect);
  this.camera.position.set(0,y,distance);this.camera.lookAt(0,y,0);
  this.renderer.render(this.scene,this.camera);
 }
 dispose():void{this.disposed=true;this.lighting.dispose();disposeObject(this.scene);this.renderer.dispose();this.canvas.remove();}
}
