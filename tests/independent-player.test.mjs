import test from 'node:test';
import assert from 'node:assert/strict';
import { createIndependentPlayer } from '../src/independent-player.js';

function fixture(){
 const previous={document:globalThis.document,location:globalThis.location};let surface;
 globalThis.document={createElement(){surface={className:'',style:{},setAttribute(){},transferControlToOffscreen(){return{};},dispatchEvent(){},remove(){this.removed=true;}};return surface;}};
 globalThis.location={href:'https://example.test/'};
 const callbacks=new Map(),messages=[],frames=[];
 const video={className:'journey-film',style:{},readyState:4,duration:24,currentTime:0,addEventListener(t,fn){callbacks.set(t,fn);},removeEventListener(t){callbacks.delete(t);},after(){},pause(){},load(){},removeAttribute(){}};
 const worker={postMessage(m){messages.push(m);},terminate(){this.terminated=true;}};
 const player=createIndependentPlayer(video,{manifest:'/frames/manifest.json',source:'/fallback.mp4',count:1440,onFrame:t=>frames.push(t),workerFactory:()=>worker});
 const cleanup=()=>{player.dispose();globalThis.document=previous.document;globalThis.location=previous.location;};
 return {player,worker,video,messages,frames,surface,callbacks,cleanup};
}
test('starts at the latest requested frame and coalesces duplicate input',()=>{
 const f=fixture();try{f.player.setTime(5);f.player.setActive(true);f.worker.onmessage({data:{type:'ready',fps:60,count:1440}});for(let i=0;i<20;i++)f.player.setTime(5);assert.equal(f.messages.filter(m=>m.type==='time').length,1);assert.equal(f.messages.find(m=>m.type==='time').index,300);f.worker.onmessage({data:{type:'frame',index:300,at:0}});assert.equal(f.player.currentTime,5);assert.equal(f.frames[0],5);}finally{f.cleanup();}
});
test('decoder failure releases the worker and switches to one native fallback',()=>{
 const f=fixture();try{f.player.setTime(4);f.player.setActive(true);f.worker.onmessage({data:{type:'error'}});assert(f.worker.terminated);assert.equal(f.video.src,'/fallback.mp4');f.video.currentTime=4;f.callbacks.get('loadeddata')();assert(f.surface.removed);assert.equal(f.video.style.visibility,'');}finally{f.cleanup();}
});
test('disposal removes the surface and prevents later frame delivery',()=>{
 const f=fixture();try{f.player.dispose();f.worker.onmessage({data:{type:'frame',index:500,at:0}});assert.equal(f.frames.length,0);assert(f.surface.removed);assert(f.worker.terminated);}finally{f.cleanup();}
});
test('fallback keeps the last good picture until its matching frame is decoded',()=>{
 const f=fixture();try{f.player.setTime(4);f.player.setActive(true);f.worker.onmessage({data:{type:'frame',index:240,at:0}});f.worker.onmessage({data:{type:'error'}});f.video.currentTime=0;f.callbacks.get('loadeddata')();assert.equal(f.player.currentTime,4);assert(!f.surface.removed);f.video.currentTime=4;f.callbacks.get('seeked')();assert(f.surface.removed);}finally{f.cleanup();}
});
