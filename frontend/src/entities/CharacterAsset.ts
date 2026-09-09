import * as THREE from 'three';
import {createCharacterBody} from './CharacterBody';
import {createCharacterHead} from './CharacterGeometry';
import {bakeGroup,disposeObject} from '../render/Art';
import {defaultCharacter,normalizeCharacter} from '../settings/CharacterStore';
import {presetToSliders} from '../settings/FaceStore';
import type {CharacterProfile} from '../settings/CharacterStore';
export const RIDER_ASSET_URL='assets/characters/rider-lightweight-morph.glb';
export type FaceMorphName='FaceWidth'|'FaceNarrow'|'FaceLength'|'JawWidth'|'ChinLength'|'CheekFullness'|'ForeheadHeight'|'BrowDepth'|'EyeRegionWidth'|'MouthRegionWidth'|'NoseWidth'|'NoseProjection'|'LipFullness';
export type RiderFacePreset=Partial<Record<FaceMorphName,number>>;
export const DEFAULT_FACE:RiderFacePreset={FaceLength:.1,JawWidth:.12,CheekFullness:.08,EyeRegionWidth:.05};
export const RIDER_HIP_Y=.94;
export interface RiderSuitColors {suit:string;panel:string;accent:string;}
/** Retained boot contract. New anatomy is native geometry; the original GLB remains as source reference. */
export async function preloadRiderCharacter(_url=RIDER_ASSET_URL):Promise<void>{}
export class RiderAssetLoadError extends Error {}
export interface RiderHead {group:THREE.Group;setFace(preset:RiderFacePreset):void;dispose():void;}
export function createRiderHead():RiderHead{
 const group=new THREE.Group();
 const setFace=(preset:RiderFacePreset)=>{disposeObject(group);group.clear();const p=defaultCharacter();p.face=presetToSliders(preset);const head=createCharacterHead(p);bakeGroup(head);group.add(head);};
 setFace(DEFAULT_FACE);return{group,setFace,dispose:()=>disposeObject(group)};
}
export interface RiderFigure {
 group:THREE.Group; bones:Record<string,THREE.Bone>;readonly hipHeight:number;
 setFace(preset:RiderFacePreset):void;setAppearance(profile:CharacterProfile):void;
 setHelmet(visible:boolean):void;stand():void;dispose():void;
}
export function createRiderFigure(colors:RiderSuitColors,initial:CharacterProfile=defaultCharacter()):RiderFigure{
 const group=new THREE.Group();let profile=normalizeCharacter(initial),model=createCharacterBody(profile,colors),helmet=false;
 group.add(model.group);
 const figure:RiderFigure={
  group,bones:model.bones,get hipHeight(){return model.hipHeight;},
  setFace(preset){figure.setAppearance({...profile,face:presetToSliders(preset)});},
  setAppearance(next){
   const rotations=Object.fromEntries(Object.entries(model.bones).map(([key,b])=>[key,b.rotation.clone()]));
   model.dispose();group.clear();profile=normalizeCharacter(next);model=createCharacterBody(profile,colors);
   model.setHelmet(helmet);for(const [key,r] of Object.entries(rotations))model.bones[key]?.rotation.copy(r);
   figure.bones=model.bones;group.add(model.group);
  },
  setHelmet(visible){helmet=visible;model.setHelmet(visible);},
  stand(){model.stand();},
  dispose(){model.dispose();}
 };
 return figure;
}
