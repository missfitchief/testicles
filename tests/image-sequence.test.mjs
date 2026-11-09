import test from 'node:test';
import assert from 'node:assert/strict';
import {createImageSequence} from '../src/image-sequence.js';
const settle=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
function fixture(){
 let clock=0,id=0,activeDecodes=0,maxDecodes=0;const timers=new Map(),pending=[],shown=[],closed=[],errors=[],requests=[];
 const config={width:2560,height:1440,fps:60,count:30,mime:'image/jpeg',extension:'.jpg',frameBase:'frames/',parts:[{name:'part.bin',bytes:30}],packets:Array.from({length:30},(_,i)=>[0,i,1])};
 const sequence=createImageSequence({
  now:()=>clock,schedule:(fn,delay)=>{timers.set(++id,{fn,at:clock+delay});return id;},cancel:timer=>timers.delete(timer),
  fetcher:async(url,options={})=>{requests.push(String(url));if(String(url).endsWith('manifest.json'))return{ok:true,json:async()=>config};if(String(url).endsWith('part.bin'))return{ok:true,body:{getReader:()=>({read:()=>new Promise(()=>{})})}};const index=Number(String(url).match(/(\d+)\.jpg$/)[1]);return{ok:true,arrayBuffer:async()=>new Uint8Array([index]).buffer};},
  decode:bytes=>{activeDecodes++;maxDecodes=Math.max(maxDecodes,activeDecodes);return new Promise(resolve=>pending.push({index:bytes[0],finish(){activeDecodes--;resolve({index:bytes[0],close(){closed.push(bytes[0]);}});}}));},
  present:(bitmap,index)=>{shown.push(index);return false;},onError:error=>errors.push(error.message),
 });
 async function advance(ms){clock+=ms;for(let i=0;i<10;i++){const due=[...timers].filter(([,t])=>t.at<=clock);if(!due.length)break;for(const[key,t]of due){timers.delete(key);t.fn();}await settle();}}
 return{sequence,pending,shown,closed,errors,requests,advance,get maxDecodes(){return maxDecodes;},start:async()=>{await sequence.init('https://test.test/manifest.json');await settle();},finish:async()=>{pending.shift().finish();await settle();}};
}
test('compatibility decoder coalesces targets with one bitmap in flight',async()=>{
 const f=fixture();await f.start();f.sequence.setActive(true);await f.finish();f.sequence.setTime(10);await f.advance(17);
 for(const n of[15,21,27])f.sequence.setTime(n);assert.equal(f.pending.length,1);await f.finish();await f.advance(17);
 assert.equal(f.pending[0].index,27);await f.finish();assert.deepEqual(f.shown,[0,10,27]);assert.equal(f.maxDecodes,1);assert.deepEqual(f.closed,[0,10,27]);f.sequence.dispose();
});
test('an obsolete decode cannot flash after reversing across the displayed frame',async()=>{
 const f=fixture();await f.start();f.sequence.setActive(true);await f.finish();f.sequence.setTime(10);await f.advance(17);await f.finish();
 f.sequence.setTime(20);await f.advance(17);f.sequence.setTime(5);await f.finish();assert.deepEqual(f.shown,[0,10]);await f.advance(17);await f.finish();assert.deepEqual(f.shown,[0,10,5]);f.sequence.dispose();
});
test('disposed compatibility work closes the late bitmap without presenting it',async()=>{
 const f=fixture();await f.start();f.sequence.dispose();await f.finish();assert.deepEqual(f.shown,[]);assert.deepEqual(f.closed,[0]);assert.deepEqual(f.errors,[]);
});
test('a hung image decoder has a bounded deadline and releases late output',async()=>{
 const f=fixture();await f.start();await f.advance(1501);assert.deepEqual(f.errors,['Image decoder timed out']);await f.finish();assert.deepEqual(f.shown,[]);assert.deepEqual(f.closed,[0]);f.sequence.dispose();
});
test('inactive frames stop work and resume at the newest bounded target',async()=>{
 const f=fixture();await f.start();await f.finish();f.sequence.setTime(1000);await f.advance(100);assert.equal(f.pending.length,0);f.sequence.setActive(true);await settle();assert.equal(f.pending[0].index,29);await f.finish();assert.equal(f.shown.at(-1),29);f.sequence.dispose();
});
test('hidden decode output is released and resumes when the page becomes visible',async()=>{
 const f=fixture();await f.start();f.sequence.setVisible(false);await f.finish();assert.deepEqual(f.shown,[]);assert.deepEqual(f.closed,[0]);f.sequence.setVisible(true);await f.advance(17);await f.finish();assert.deepEqual(f.shown,[0]);f.sequence.dispose();
});

test('startup preloading finishes every bounded part before reporting complete',async()=>{
 const progress=[],fetched=[];const config={width:2560,height:1440,fps:60,count:3,mime:'image/jpeg',extension:'.jpg',frameBase:'frames/',parts:[0,1,2].map(i=>({name:`part-${i}.bin`,bytes:1})),packets:[0,1,2].map(i=>[i,0,1])};
 const sequence=createImageSequence({fetcher:async url=>{const name=String(url);fetched.push(name);return name.endsWith('manifest.json')?{ok:true,json:async()=>config}:{ok:true,body:{getReader(){let done=false;return{async read(){if(done)return{done:true};done=true;return{done:false,value:new Uint8Array([0])};}};}},arrayBuffer:async()=>new Uint8Array([0]).buffer};},decode:async()=>({close(){}}),present:()=>false,onProgress:value=>progress.push(value)});
 await sequence.init('https://test.test/manifest.json',{preloadAll:true});await settle();
 assert.deepEqual(progress.at(-1),{loaded:3,total:3,complete:true});assert.equal(fetched.filter(url=>url.includes('part-')).length,3);sequence.dispose();
});
