import {describe,it,expect,vi} from 'vitest';
import {RaceManager} from '../../src/race/Race';
import {TrackPath} from '../../src/math/TrackPath';
import {EventBus} from '../../src/core/events';
import type {BikeEntity,BikeInput} from '../../src/entities/BikeEntity';
describe('Finish lifecycle',()=>{
 it('freezes player on crossing, settles within 3 seconds and never simulates behind results',()=>{
  const track=new TrackPath(),bus=new EventBus(),finish=vi.fn(),states=vi.fn();bus.on('race:finish',finish);bus.on('race:state',states);
  const bike={progress:track.length-.1,lap:2,speed:50,finished:false,finishTime:0,index:0,rank:1,charge:0,boostActive:false,isDrifting:false,update:vi.fn(function(this:{progress:number}){this.progress=.1;})} as unknown as BikeEntity;
  const race=new RaceManager(bike,[],track,bus);race.state='racing';const input={throttle:true,brake:false,steer:0,drift:false,boost:false,nitro:false} satisfies BikeInput;
  race.update(1/60,input,0);expect(bike.finished).toBe(true);expect(bike.speed).toBe(0);expect(finish).toHaveBeenCalledTimes(1);expect(finish.mock.calls[0][0].rank).toBe(1);
  const crossing=race.raceTime;for(let i=0;i<150;i++)race.update(1/60,input,i/60);
  expect(race.state).toBe('finished');expect(race.raceTime-crossing).toBeLessThan(3);expect(bike.update).toHaveBeenCalledTimes(1);
  const total=race.raceTime;for(let i=0;i<300;i++)race.update(1/60,input,5+i/60);expect(race.raceTime).toBe(total);expect(finish).toHaveBeenCalledTimes(1);expect(states).toHaveBeenCalledTimes(1);
 });
});
