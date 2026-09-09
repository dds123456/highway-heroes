import {describe,it,expect,vi} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {fetchLeaderboard,submitRaceResult} from '../src/net';

describe('Public single-player boundary',()=>{
 it('never fetches or submits online records',async()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  try{
   expect(await fetchLeaderboard()).toEqual([]);
   expect(await submitRaceResult({totalTimeMs:100,bikeId:'bonneville',trackId:'meadow',gameVersion:'2.0.0'})).toBe(false);
   expect(fetch).not.toHaveBeenCalled();
  }finally{vi.unstubAllGlobals();}
 });
 it('both entries are offline and enterprise assets are absent',()=>{
  for(const name of ['index.html','offline.html']){
   const html=readFileSync(name,'utf8');expect(html).toContain('content="offline"');
   expect(html).not.toMatch(/sso-core|user-menu|shizhuang|dewu/i);
  }
  expect(existsSync('../backend')).toBe(false);
  expect(existsSync('public/assets/sso-core.js')).toBe(false);
 });
});
