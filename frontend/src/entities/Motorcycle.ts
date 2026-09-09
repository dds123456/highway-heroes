import * as THREE from 'three';
import type {BikeForm,Colorway} from '../core/constants';
import {createDetailedBike} from './DetailedMotorcycle';
import type {DetailedBike} from './DetailedMotorcycle';
export class MotorcycleModel {
 readonly group=new THREE.Group();
 private model:DetailedBike;
 constructor(form:BikeForm,colorway:Colorway,wrapTexture:THREE.Texture|null=null){
  this.model=createDetailedBike(form,colorway,wrapTexture);this.group.add(this.model.root);
 }
 update(dt:number,speed:number,steer:number,boost:boolean):void{
  for(const wheel of this.model.wheels)wheel.rotation.x+=speed*dt/.33;
  this.model.steering.rotation.y=steer*.07;
  this.model.root.position.y=Math.sin(performance.now()*.018)*Math.min(speed*.00006,.003);
  void boost;
 }
}
