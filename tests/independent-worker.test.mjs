import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../src/independent-worker.js',import.meta.url),'utf8');
const settle=async()=>{for(let i=0;i<18;i++)await Promise.resolve();};

async function fixture({partial=false,throwDraw=false,maskGeometry}={}){
 let now=0,id=0,decoder,urgentAborted=false;
 const timers=new Map(),messages=[],drawn=[],chunks=[],closed=[],gradients=[],fills=[];let canvasOptions;
 const config={width:2560,height:1440,fps:60,count:200,codec:'avc1.640033',frameBase:'frames/',parts:[{name:'part.bin',bytes:200}],packets:Array.from({length:200},(_,i)=>[0,i,1])};
 const never=new Promise(()=>{});
 const fetch=async(url,options={})=>{
  const name=String(url);
  if(name.endsWith('manifest.json'))return {ok:true,json:async()=>config};
  if(name.endsWith('part.bin')){
   let reads=0;
   return {ok:true,body:{getReader:()=>({read:async()=>++reads===1?{done:false,value:new Uint8Array(partial?100:200)}:partial?never:{done:true}})}};
  }
  if(partial&&name.endsWith('0150.bin'))return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>{urgentAborted=true;reject(new Error('aborted'));},{once:true}));
  return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};
 };
 class Decoder{
  constructor(callbacks){this.callbacks=callbacks;decoder=this;}
  static async isConfigSupported(){return {supported:true};}
  configure(){}
  decode(chunk){chunks.push(chunk);}
  flush(){return Promise.resolve();}
  close(){this.closed=true;}
  deliver(index){this.callbacks.output({timestamp:Math.round(index*1e6/60),close:()=>closed.push(index)});}
 }
 const context={self:{},URL,AbortController,ArrayBuffer,Uint8Array,Map,Set,Promise,Error,Math,Number,String,
  performance:{now:()=>now,timeOrigin:100000},fetch,VideoDecoder:Decoder,
  EncodedVideoChunk:class{constructor(value){Object.assign(this,value);}},
  postMessage:message=>messages.push(message),
  setTimeout:(fn,delay)=>{timers.set(++id,{fn,at:now+delay});return id;},
  clearTimeout:timer=>timers.delete(timer),
 };
 vm.runInNewContext(source,context);
 const send=data=>context.self.onmessage({data});
 const advance=async(ms)=>{now+=ms;for(let pass=0;pass<10;pass++){const due=[...timers].filter(([,task])=>task.at<=now);if(!due.length)break;for(const [timer,task] of due){timers.delete(timer);task.fn();}await settle();}};
 const drawing={drawImage:frame=>{if(throwDraw)throw Error('surface lost');drawn.push(Math.round(frame.timestamp*60/1e6));},createLinearGradient:(...points)=>{const gradient={points,stops:[],addColorStop(at,color){this.stops.push([at,color]);}};gradients.push(gradient);return gradient;},fillRect:(...rect)=>fills.push({rect,operation:drawing.globalCompositeOperation})};
 await send({type:'init',manifest:'https://example.test/manifest.json',maskGeometry,canvas:{getContext:(type,options)=>{canvasOptions=options;return drawing;}}});
 await settle();
 return {send,advance,decoder,messages,drawn,chunks,closed,gradients,fills,get canvasOptions(){return canvasOptions;},get urgentAborted(){return urgentAborted;},dispose:()=>send({type:'dispose'})};
}

test('bounds decode work to two frames and follows the latest reversal',async()=>{
 const f=await fixture();try{
  f.decoder.deliver(0);f.send({type:'active',value:true});await f.advance(17);
  f.send({type:'time',index:1});await settle();await f.advance(17);
  f.send({type:'time',index:2});await settle();await f.advance(17);
  for(const index of [90,120,100,80,7])f.send({type:'time',index});await settle();
  assert.deepEqual(f.chunks.map(c=>Math.round(c.timestamp*60/1e6)),[0,1,2]);
  f.decoder.deliver(1);await settle();
  assert.equal(Math.round(f.chunks.at(-1).timestamp*60/1e6),7);
  assert.equal(f.chunks.length,4);
  f.decoder.deliver(2);f.decoder.deliver(7);await settle();
  assert.equal(f.drawn.at(-1),7);assert.equal(f.closed.length,4);
 }finally{f.dispose();}
});

test('a buffered reversal bypasses an obsolete, stalled network frame',async()=>{
 const f=await fixture({partial:true});try{
  f.decoder.deliver(0);f.send({type:'active',value:true});await f.advance(17);
  f.send({type:'time',index:150});await settle();assert.equal(f.chunks.length,1);
  f.send({type:'time',index:10});await settle();
  assert.equal(f.urgentAborted,true);
  assert.equal(Math.round(f.chunks.at(-1).timestamp*60/1e6),10);
  assert.equal(f.messages.some(m=>m.type==='error'),false);
 }finally{f.dispose();}
});

test('inactive work is bounded and resumes at the newest requested position',async()=>{
 const f=await fixture();try{
  f.decoder.deliver(0);f.send({type:'time',index:40});await f.advance(100);
  assert.equal(f.chunks.length,1);
  f.send({type:'active',value:true});await settle();
  assert.equal(Math.round(f.chunks.at(-1).timestamp*60/1e6),40);
  f.send({type:'active',value:false});f.decoder.deliver(40);await f.advance(100);
  assert.deepEqual(f.drawn,[0]);assert.deepEqual(f.closed,[0,40]);
 }finally{f.dispose();}
});

test('surface errors close the decoded frame and report fallback',async()=>{
 const f=await fixture({throwDraw:true});try{
  f.decoder.deliver(0);await settle();
  assert.deepEqual(f.closed,[0]);assert.equal(f.messages.filter(m=>m.type==='error').length,1);
 }finally{f.dispose();}
});

test('a decoder that stops returning frames fails within the bounded deadline',async()=>{
 const f=await fixture();try{
  await f.advance(751);
  assert.equal(f.messages.filter(m=>m.type==='error').length,1);
 }finally{f.dispose();}
});

test('high-rate input cannot multiply decode work above the source cadence',async()=>{
 const f=await fixture();try{
  f.decoder.deliver(0);f.send({type:'active',value:true});let delivered=1;
  for(let tick=0;tick<1000;tick++){
   f.send({type:'time',index:1+(tick%198)});await f.advance(4);
   while(delivered<f.chunks.length){const chunk=f.chunks[delivered++];f.decoder.deliver(Math.round(chunk.timestamp*60/1e6));await settle();}
  }
  assert(f.chunks.length>225,`Only ${f.chunks.length} frames scheduled`);
  assert(f.chunks.length<=243,`${f.chunks.length} decodes exceeded the bounded 60fps cadence`);
 }finally{f.dispose();}
});

test('a stalled urgent download also has a deadline',async()=>{
 const f=await fixture({partial:true});try{
  f.decoder.deliver(0);f.send({type:'active',value:true});await f.advance(17);
  f.send({type:'time',index:150});await settle();await f.advance(2501);
  assert.equal(f.urgentAborted,true);assert.equal(f.messages.filter(m=>m.type==='error').length,1);
 }finally{f.dispose();}
});

test('entry mask follows the same crop geometry without reducing frame dimensions',async()=>{
 const geometry={startBox:{y:100,h:600},startFrame:{y:-200,h:1200},endBox:{y:0,h:1000},endFrame:{y:0,h:1000}};
 const f=await fixture({maskGeometry:geometry});try{
  assert.equal(f.canvasOptions.alpha,true);f.decoder.deliver(0);
  assert.deepEqual(f.gradients[0].points,[0,360,0,1080]);
  assert.deepEqual(f.gradients[0].stops,[[0,'rgba(0,0,0,0)'],[.12,'rgba(0,0,0,1)'],[.83,'rgba(0,0,0,1)'],[1,'rgba(0,0,0,0)']]);
  assert.deepEqual(f.fills,[{rect:[0,0,2560,1440],operation:'destination-in'}]);
  assert.equal(f.messages.find(m=>m.type==='frame').masked,true);
  f.send({type:'active',value:true});f.send({type:'time',index:199});await f.advance(17);f.decoder.deliver(199);
  assert.deepEqual(f.gradients.at(-1).points,[0,0,0,1440]);assert.deepEqual(f.closed,[0,199]);
 }finally{f.dispose();}
});

test('ordinary story frames remain opaque and do not run the entry mask pass',async()=>{
 const f=await fixture();try{f.decoder.deliver(0);assert.equal(f.canvasOptions.alpha,false);assert.equal(f.gradients.length,0);assert.equal(f.fills.length,0);}finally{f.dispose();}
});
