import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompatibilityPlayer} from '../src/compatibility-player.js';
const settle=async()=>{for(let i=0;i<28;i++)await Promise.resolve();};
function fixture({maskGeometry,failWorker=false,dom=false}={}){
 const saved=Object.fromEntries(['document','location','createImageBitmap','fetch','Image','FileReader'].map(k=>[k,globalThis[k]]));
 const canvases=[],messages=[],frames=[],bitmaps=[],draws=[],classes=new Set();
 const gradient={addColorStop(){}};
 const drawing={drawImage:(b,...r)=>draws.push({b,r,mode:drawing.globalCompositeOperation}),fillRect(){},createLinearGradient:()=>gradient};
 const bitmapRenderer={transferFromImageBitmap:b=>bitmaps.push(b)};
 globalThis.document={hidden:false,createElement(tag){const canvas={tag,children:[],width:0,height:0,className:'',style:{},append(image){this.children.push(image);},setAttribute(){},getContext:type=>type==='bitmaprenderer'?bitmapRenderer:drawing,dispatchEvent:e=>frames.push(e.detail.index),remove(){this.removed=true;}};canvases.push(canvas);return canvas;}};
 globalThis.location={href:'https://example.test/'};
 globalThis.createImageBitmap=dom?undefined:async()=>({close(){}});
 globalThis.Image=class{style={};set src(value){this.source=value;if(value)queueMicrotask(()=>this.onload?.());}async decode(){}replaceWith(image){canvases[0].children=[image];}};
 globalThis.FileReader=class{readAsDataURL(){this.result='data:image/jpeg;base64,AA==';queueMicrotask(()=>this.onload?.());}abort(){}};
 globalThis.fetch=async url=>String(url).endsWith('manifest.json')?{ok:true,json:async()=>({width:2560,height:1440,fps:60,count:300,mime:'image/jpeg',extension:'.jpg',frameBase:'frames/',parts:[{name:'part.bin',bytes:300}],packets:Array.from({length:300},(_,i)=>[0,i,1])})}:String(url).endsWith('part.bin')?{ok:true,body:{getReader:()=>({read:()=>new Promise(()=>{})})}}:{ok:true,arrayBuffer:async()=>new Uint8Array([0]).buffer};
 const worker={postMessage:m=>messages.push(m),terminate(){this.terminated=true;}};
 const video={className:'journey-film',style:{},parentElement:{classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)}},after(){}};
 const player=createCompatibilityPlayer(video,{manifest:'/manifest.json',source:'/fallback.mp4',count:300,maskGeometry,onFrame(){},workerFactory:()=>{if(failWorker)throw Error('No worker');return worker;}});
 return{player,worker,video,canvases,messages,frames,bitmaps,draws,classes,cleanup(){player.dispose();for(const[k,v]of Object.entries(saved))globalThis[k]=v;}};
}
test('compatibility presentation uses 2K bitmaps without native video seeking',()=>{
 const f=fixture();try{f.player.setTime(2);f.player.setActive(true);f.worker.onmessage({data:{type:'ready',fps:60,count:300}});const bitmap={};f.worker.onmessage({data:{type:'frame',index:120,bitmap}});assert.equal(f.player.currentTime,2);assert.equal(f.canvases[0].width,2560);assert.equal(f.canvases[0].height,1440);assert.deepEqual(f.bitmaps,[bitmap]);assert.deepEqual(f.frames,[120]);assert.equal(f.video.src,undefined);assert(f.messages.some(m=>m.type==='presented'));}finally{f.cleanup();}
});
test('the compatibility entrance retains the one-column 2K alpha mask',()=>{
 const geometry={startBox:{y:0,h:100},endBox:{y:0,h:100},startFrame:{y:0,h:100},endFrame:{y:0,h:100}};
 const f=fixture({maskGeometry:geometry});try{f.worker.onmessage({data:{type:'frame',index:20,bitmap:{close(){}}}});assert.equal(f.canvases[1].width,1);assert.equal(f.canvases[1].height,1440);assert.deepEqual(f.draws[1].r,[0,0,2560,1440]);assert.equal(f.draws[1].mode,'destination-in');assert(f.classes.has('frame-mask-ready'));}finally{f.cleanup();}
});
test('blocked workers use the same image sequence on the main thread',async()=>{
 const f=fixture({failWorker:true});try{f.player.setTime(2);f.player.setActive(true);await settle();assert.equal(f.player.currentTime,2);assert.equal(f.video.src,undefined);assert.deepEqual(f.frames,[120]);}finally{f.cleanup();}
});
test('late worker images are closed after disposal',()=>{
 const f=fixture();let closed=false;f.cleanup();f.worker.onmessage({data:{type:'frame',index:10,bitmap:{close(){closed=true;}}}});assert(closed);assert.deepEqual(f.frames,[]);assert(f.worker.terminated);
});
test('browsers without ImageBitmap present one decoded image without canvas readback',async()=>{
 const f=fixture({dom:true});try{f.player.setTime(2);f.player.setActive(true);await settle();assert.equal(f.canvases[0].tag,'div');assert.equal(f.canvases[0].children.length,1);assert.match(f.canvases[0].children[0].source,/^data:image\/jpeg;/);assert.equal(f.player.currentTime,2);assert.equal(f.draws.length,0);assert.equal(f.video.src,undefined);}finally{f.cleanup();}
});
