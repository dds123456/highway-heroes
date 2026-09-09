import {describe,it,expect} from 'vitest';
import {WeatherCycle} from '../../src/render/WeatherCycle';
describe('Gradual random showers',()=>{
 it('starts dry and ramps up and down without discontinuity',()=>{
  const w=new WeatherCycle(()=>.5);let peak=0,previous=0,wet=false,dried=false;
  for(let i=0;i<200*60;i++){const v=w.update(1/60);if(i<54*60)expect(v).toBe(0);expect(Math.abs(v-previous)).toBeLessThan(.001);peak=Math.max(peak,v);if(v>.3)wet=true;if(wet&&v===0)dried=true;previous=v;}
  expect(peak).toBeCloseTo(.6);expect(dried).toBe(true);
 });
 it('manual rain and clearing also interpolate; pause freezes weather',()=>{
  const w=new WeatherCycle(()=>0);w.force(.8);expect(w.update(1)).toBeCloseTo(1/18);const p=w.intensity;w.update(0);expect(w.intensity).toBe(p);w.force(0);expect(w.update(.1)).toBeLessThan(p);expect(w.intensity).toBeGreaterThan(0);
 });
});
