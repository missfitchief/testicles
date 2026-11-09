// Keep a maximum of two independent frames in flight so decode and display can
// overlap. No native media seeks or pixel readback. Work is capped at film FPS.
let config, base, context, decoder, active=false, desired=0, shown=-1;
let busy=false, failed=false, timer=0, nextFrameAt=-Infinity, disposed=false;
let sequence=0, direction=1, hasBeenActive=false, eager=true, pageVisible=true;
let drain=0, watchdog=0, flushing=false;
const pending=new Set();
const parts=new Map(), packetCache=new Map(), requests=new Set(), packetWaiters=new Set();
const MEMORY_LIMIT=128*1024*1024, PACKET_LIMIT=48;
const postError=error=>{if(!failed&&!disposed){failed=true;clearTimeout(timer);clearTimeout(drain);clearTimeout(watchdog);for(const c of requests)c.abort();postMessage({type:'error',message:String(error?.message||error)});}};
function cachedPacket(index){
 const [id,offset,size]=config.packets[index],part=parts.get(id);
 if(part&&part.received>=offset+size){part.used=++sequence;return new Uint8Array(part.buffer,offset,size);}
 return packetCache.get(index);
}
function wakePacketWaiters(){
 for(const waiter of packetWaiters){
  // A reversal into buffered footage must not wait for an obsolete download.
  const latest=cachedPacket(desired);
  if(latest)waiter.resolve({index:desired,bytes:latest});
  else {const bytes=cachedPacket(waiter.index);if(bytes)waiter.resolve({index:waiter.index,bytes});}
 }
}
function trim(){
 let bytes=[...parts.values()].reduce((sum,p)=>sum+p.buffer.byteLength,0);
 const current=config.packets[desired][0];
 for(const [id,part] of [...parts].sort((a,b)=>a[1].used-b[1].used)){
  if(bytes<=MEMORY_LIMIT)break;if(id===current||part.loading)continue;
  bytes-=part.buffer.byteLength;parts.delete(id);
 }
 while(packetCache.size>PACKET_LIMIT)packetCache.delete(packetCache.keys().next().value);
}
function preload(id){
 if(id<0||id>=config.parts.length||parts.has(id)||[...parts.values()].filter(p=>p.loading).length>=3)return;
 const controller=new AbortController(),entry={buffer:new ArrayBuffer(config.parts[id].bytes),received:0,loading:true,used:++sequence,controller};
 parts.set(id,entry);requests.add(controller);
 fetch(new URL(config.parts[id].name,base),{signal:controller.signal,cache:'force-cache',priority:'low'}).then(async response=>{
  if(!response.ok)throw new Error('Frame preload failed');const reader=response.body.getReader();
  for(;;){const {value,done}=await reader.read();if(done)break;if(entry.received+value.length>entry.buffer.byteLength)throw new Error('Invalid frame payload');new Uint8Array(entry.buffer,entry.received,value.length).set(value);entry.received+=value.length;wakePacketWaiters();}
 }).catch(()=>{}).finally(()=>{entry.loading=false;requests.delete(controller);trim();warm();});
}
async function packet(index){
 const cached=cachedPacket(index);if(cached)return {index,bytes:cached};
 const [id,offset,size]=config.packets[index];
 const controller=new AbortController();requests.add(controller);
 let waiter;const buffered=new Promise(resolve=>{waiter={index,resolve};packetWaiters.add(waiter);});
 const deadline=setTimeout(()=>controller.abort(),2500);
 try{
  const download=(async()=>{
  const url=new URL(config.frameBase+String(index).padStart(4,'0')+'.bin',base);
  const response=await fetch(url,{signal:controller.signal,cache:'force-cache',priority:'high'});
  if(!response.ok)throw new Error('Frame request failed');const buffer=await response.arrayBuffer();let view;
  if(buffer.byteLength===size)view=new Uint8Array(buffer);
  else if(buffer.byteLength===config.parts[id].bytes){parts.set(id,{buffer,received:buffer.byteLength,loading:false,used:++sequence});view=new Uint8Array(buffer,offset,size);}
  else throw new Error('Incomplete frame data');
  if(buffer.byteLength===size)packetCache.set(index,view);trim();return {index,bytes:view};
  })();
  return await Promise.race([download,buffered]);
 }finally{clearTimeout(deadline);packetWaiters.delete(waiter);controller.abort();requests.delete(controller);}
}
function watchDecoder(){
 clearTimeout(watchdog);watchdog=0;
 if(pending.size)watchdog=setTimeout(()=>postError(new Error('Frame decoder timed out')),750);
}
function warm(){
 if(!config||failed||disposed||!pageVisible)return;const id=config.packets[desired][0];
 // A fast reversal must not queue its critical frame behind unrelated bulk data.
 // Abort obsolete bulk loads. An urgent request is replaced only when the
 // newer target is already buffered, so rapid input cannot starve downloads.
 const wanted=(active||!hasBeenActive)?[id,id+direction,id+2*direction]:[id];
 if(wanted.some(key=>key>=0&&key<config.parts.length&&!parts.has(key)))for(const [key,part] of parts)if(part.loading&&!wanted.includes(key)){part.controller.abort();parts.delete(key);}
 for(const next of wanted)preload(next);
 if(eager)for(const next of config.parts.map((_,i)=>i).sort((a,b)=>Math.abs(a-id)-Math.abs(b-id)))preload(next);
}
async function pump(){
 if((!active&&shown>=0)||busy||disposed||failed||!decoder||shown===desired||pending.has(desired)||pending.size>=2)return;
 const now=performance.now(),period=1000/config.fps,wait=nextFrameAt-now;
 if(wait>1){if(!timer)timer=setTimeout(()=>{timer=0;pump();},wait);return;}
 busy=true;
 try{
  let {index,bytes}=await packet(desired);if(disposed||failed||(!active&&shown>=0))return;
  const latest=cachedPacket(desired);if(latest){index=desired;bytes=latest;}
  if(pending.has(index)||shown===index)return;
  nextFrameAt=Math.max(performance.now()-period,nextFrameAt)+period;
  pending.add(index);
  decoder.decode(new EncodedVideoChunk({type:'key',timestamp:Math.round(index*1e6/config.fps),duration:Math.round(1e6/config.fps),data:bytes}));
  clearTimeout(drain);drain=setTimeout(()=>{if(pending.size&&!flushing&&!disposed){flushing=true;decoder.flush().catch(postError).finally(()=>{flushing=false;pump();});}},24);
  if(!watchdog)watchDecoder();
 }catch(error){postError(error);}finally{busy=false;warm();pump();}
}
self.onmessage=async({data})=>{
 if(data.type==='init')try{
  eager=data.eager!==false;pageVisible=!data.hidden;
  const response=await fetch(data.manifest,{cache:'force-cache'});if(!response.ok)throw new Error('Frame manifest unavailable');config=await response.json();base=new URL('.',data.manifest);
  if(config.width!==2560||config.height!==1440||config.fps!==60||config.packets.length!==config.count)throw new Error('Unexpected frame format');
  context=data.canvas.getContext('2d',{alpha:false,desynchronized:true});if(!context)throw new Error('Frame surface unavailable');
  const options={codec:config.codec,codedWidth:config.width,codedHeight:config.height,optimizeForLatency:true,hardwareAcceleration:'no-preference'};
  if(!(await VideoDecoder.isConfigSupported(options)).supported)throw new Error('Frame decoder unsupported');
  decoder=new VideoDecoder({output(frame){const index=Math.round(frame.timestamp*config.fps/1e6);try{if((active||shown<0)&&!disposed&&!failed){context.drawImage(frame,0,0,config.width,config.height);shown=index;postMessage({type:'frame',index:shown,at:performance.timeOrigin+performance.now()});}}catch(error){postError(error);}finally{frame.close();pending.delete(index);watchDecoder();pump();}},error:postError});decoder.configure(options);
  postMessage({type:'ready',fps:config.fps,count:config.count});warm();pump();
 }catch(error){postError(error);}
 else if(data.type==='time'){if(data.index!==desired)direction=Math.sign(data.index-desired)||direction;desired=data.index;wakePacketWaiters();warm();pump();}
 else if(data.type==='active'){active=data.value;if(active){hasBeenActive=true;warm();pump();}else{clearTimeout(timer);timer=0;}}
 else if(data.type==='visibility'){pageVisible=!data.hidden;if(pageVisible)warm();}
 else if(data.type==='dispose'){disposed=true;active=false;clearTimeout(timer);clearTimeout(drain);clearTimeout(watchdog);for(const c of requests)c.abort();decoder?.close();parts.clear();packetCache.clear();}
};
