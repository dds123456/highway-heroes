import { FACE_SLIDERS, slidersToPreset } from './FaceStore';
import type { RiderFacePreset } from '../entities/CharacterAsset';

export type CharacterSection = 'heritage' | 'face' | 'body' | 'style';
export interface CharacterProfile {
  version: 1;
  gender: number;
  shapeA: number; shapeB: number; resemblance: number;
  face: Record<string, number>;
  height: number; shoulders: number; chest: number; waist: number; hips: number;
  muscle: number; armLength: number; legLength: number; headSize: number; neckWidth: number;
  skin: number; hair: number; hairColor: number; eyes: number; beard: number;
  outfit: number; outfitColor: number;
}
export const FACE_BASES = [
  { name: '棱角型', values: { width: .16, JawWidth: .64, CheekFullness: .1, BrowDepth: .35, FaceLength: .2 } },
  { name: '柔和型', values: { width: -.2, JawWidth: .08, CheekFullness: .5, BrowDepth: .02, FaceLength: .14 } },
  { name: '修长型', values: { width: -.32, JawWidth: .24, CheekFullness: .1, BrowDepth: .2, FaceLength: .7 } },
  { name: '宽颧型', values: { width: .34, JawWidth: .28, CheekFullness: .35, BrowDepth: .1, FaceLength: .12 } },
] as const;
export const SKIN_TONES = ['#edc5ab', '#d5aa8a', '#b98665', '#95684b', '#714833', '#4d3025'];
export const HAIR_COLORS = ['#211c19', '#493126', '#785231', '#ae8950', '#777570'];
export const EYE_COLORS = ['#463329', '#688280', '#64768f', '#77653b'];
export const OUTFIT_COLORS = ['#343b42', '#5c6656', '#64484a', '#8a8980'];
export const HAIR_STYLES = ['寸头', '短侧分', '后梳', '光头'];
export const OUTFITS = ['机车夹克', '城市便装'];
export const BODY_SLIDERS = [
  { id:'height', label:'身高', min:165, max:190, step:1, unit:'cm' },
  { id:'shoulders', label:'肩宽', min:-1, max:1, step:.05 },
  { id:'chest', label:'胸廓', min:-1, max:1, step:.05 },
  { id:'waist', label:'腰围', min:-1, max:1, step:.05 },
  { id:'hips', label:'胯宽', min:-1, max:1, step:.05 },
  { id:'muscle', label:'肌肉量', min:0, max:1, step:.05 },
  { id:'armLength', label:'手臂比例', min:-1, max:1, step:.05 },
  { id:'legLength', label:'腿长比例', min:-1, max:1, step:.05 },
  { id:'headSize', label:'头身比例', min:-1, max:1, step:.05 },
  { id:'neckWidth', label:'颈部宽度', min:-1, max:1, step:.05 },
] as const;
export type BodyKey = typeof BODY_SLIDERS[number]['id'];
export function defaultCharacter(): CharacterProfile {
  return {version:1,gender:0,shapeA:0,shapeB:1,resemblance:.35,
    face:Object.fromEntries(FACE_SLIDERS.map(s=>[s.id,s.def])),
    height:178,shoulders:0,chest:0,waist:0,hips:0,muscle:.35,
    armLength:0,legLength:0,headSize:0,neckWidth:0,
    skin:2,hair:1,hairColor:0,eyes:0,beard:0,outfit:0,outfitColor:0};
}
const finite = (v:unknown, fallback:number, min:number, max:number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max,Math.max(min,v)) : fallback;
export function normalizeCharacter(raw:unknown): CharacterProfile {
  const d=defaultCharacter();
  if(!raw || typeof raw!=='object' || Array.isArray(raw))return d;
  const r=raw as Record<string,unknown>;
  d.gender=r.gender===1?1:0;
  for(const s of BODY_SLIDERS)d[s.id]=finite(r[s.id],d[s.id],s.min,s.max);
  for(const [k,max] of Object.entries({shapeA:3,shapeB:3,skin:5,hair:3,hairColor:4,eyes:3,beard:2,outfit:1,outfitColor:3})) {
    const key=k as 'shapeA'; d[key]=Math.round(finite(r[key],d[key],0,max));
  }
  d.resemblance=finite(r.resemblance,d.resemblance,0,1);
  const f=r.face && typeof r.face==='object' ? r.face as Record<string,unknown> : {};
  for(const s of FACE_SLIDERS)d.face[s.id]=finite(f[s.id],s.def,s.min,s.max);
  return d;
}
/** Artistic base-shape blending, not a simulation of genetics or ancestry. */
export function resolvedFace(p:CharacterProfile): RiderFacePreset {
  const out={...p.face},a=FACE_BASES[p.shapeA].values as Record<string,number>,b=FACE_BASES[p.shapeB].values as Record<string,number>;
  for(const s of FACE_SLIDERS){
    const base=(a[s.id]??s.def)*(1-p.resemblance)+(b[s.id]??s.def)*p.resemblance;
    out[s.id]=Math.min(s.max,Math.max(s.min,base+(p.face[s.id]-s.def)));
  }
  return slidersToPreset(out);
}
export function randomCharacter(random:()=>number=Math.random):CharacterProfile {
  const p=defaultCharacter();
  p.gender=random()<.5?0:1;
  p.shapeA=Math.floor(random()*4);p.shapeB=Math.floor(random()*4);p.resemblance=random();
  for(const s of BODY_SLIDERS)p[s.id]=Math.round((s.min+(s.max-s.min)*(.15+random()*.7))/s.step)*s.step;
  for(const s of FACE_SLIDERS)p.face[s.id]=s.min+(s.max-s.min)*random()*.6;
  p.skin=Math.floor(random()*6);p.hair=Math.floor(random()*4);p.hairColor=Math.floor(random()*5);
  p.beard=Math.floor(random()*3);p.eyes=Math.floor(random()*4);p.outfit=Math.floor(random()*2);p.outfitColor=Math.floor(random()*4);
  return normalizeCharacter(p);
}
function availableStorage():Storage|null{try{return typeof localStorage==='undefined'?null:localStorage;}catch{return null;}}
export class CharacterStore {
  private profile:CharacterProfile;
  constructor(private storage:Pick<Storage,'getItem'|'setItem'>|null=availableStorage()){
    let p=defaultCharacter();
    try {
      const saved=storage?.getItem('hh.character.v1');
      if(saved)p=normalizeCharacter(JSON.parse(saved));
      else {const legacy=storage?.getItem('hh.face'); if(legacy)p=normalizeCharacter({...p,face:JSON.parse(legacy)});}
    }catch{/* Unavailable storage and corrupt data use safe defaults. */}
    this.profile=p;
  }
  get():CharacterProfile{return structuredClone(this.profile);}
  save(p:CharacterProfile):boolean {
    this.profile=normalizeCharacter(p);
    try{if(!this.storage)return false;this.storage.setItem('hh.character.v1',JSON.stringify(this.profile));return true;}catch{return false;}
  }
}
export const characterStore=new CharacterStore();
