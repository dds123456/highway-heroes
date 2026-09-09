import * as THREE from 'three';
import {configureLighting} from './Art';
import type {LightingRig} from './Art';
export class GameRenderer {
 readonly renderer:THREE.WebGLRenderer;direct=false;
 private scene:THREE.Scene|null=null;private lighting:LightingRig|null=null;
 constructor(canvas:HTMLCanvasElement){
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',stencil:false});
 }
 resize(width:number,height:number,pixelRatio:number):void{
  this.renderer.setPixelRatio(Math.min(pixelRatio,1.75));this.renderer.setSize(width,height,false);
 }
 render(scene:THREE.Scene,camera:THREE.PerspectiveCamera):void{
  if(this.scene!==scene){
   this.lighting?.dispose();this.scene=scene;this.lighting=configureLighting(scene,this.renderer);
   scene.fog=new THREE.Fog('#b9c4c8',160,850);
  }
  const sun=this.lighting!.sun;
  sun.target.position.set(Math.round(camera.position.x/2)*2,camera.position.y-3,Math.round(camera.position.z/2)*2);
  sun.position.copy(sun.target.position).add(new THREE.Vector3(-35,65,30));
  camera.layers.enableAll();this.renderer.toneMapping=this.direct?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;
  this.renderer.setRenderTarget(null);this.renderer.render(scene,camera);
 }
}
