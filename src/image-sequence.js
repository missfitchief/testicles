/** Shared worker/main-thread transport for the non-WebCodecs desktop path. */
export function createImageSequence({decode,present,onReady=()=>{},onProgress=()=>{},onError=()=>{},fetcher=(...args)=>fetch(...args),now=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout}){
 let config,base,desired=0,shown=-1,active=false,visible=true,disposed=false,failed=false,busy=false,direction=1,serial=0,nextAt=0,timer=0;
 const parts=new Map(),packets=new Map(),requests=new Set(),waiters=new Set();
 let memoryLimit=128*1024*1024,primeAll=false,progressAt=-Infinity;
 const PACKETS=48;
 function progress(force=false){if(!config||disposed)return;const at=now();if(!force&&at-progressAt<100)return;progressAt=at;const loaded=[...parts.values()].reduce((n,p)=>n+p.received,0),total=config.parts.reduce((n,p)=>n+p.bytes,0);onProgress({loaded,total,complete:loaded===total});}
 const fail=error=>{if(disposed||failed)return;failed=true;cancel(timer);for(const request of requests)request.abort();onError(error);};
 function cached(index){
  const [id,offset,size]=config.packets[index],part=parts.get(id);
  if(part&&part.received>=offset+size){part.used=++serial;return new Uint8Array(part.buffer,offset,size);}
  const value=packets.get(index);if(value){packets.delete(index);packets.set(index,value);}return value;
 }
 function wake(){for(const waiter of waiters){const latest=cached(desired);if(latest)waiter.resolve({index:desired,bytes:latest});else{const bytes=cached(waiter.index);if(bytes)waiter.resolve({index:waiter.index,bytes});}}}
 function trim(){
  let size=[...parts.values()].reduce((sum,p)=>sum+p.buffer.byteLength,0);const current=config.packets[desired][0];
  for(const [id,part] of [...parts].sort((a,b)=>a[1].used-b[1].used)){if(size<=memoryLimit)break;if(id===current||part.loading)continue;size-=part.buffer.byteLength;parts.delete(id);}
  while(packets.size>PACKETS)packets.delete(packets.keys().next().value);
 }
 function preload(id){
  if(id<0||id>=config.parts.length||parts.has(id)||[...parts.values()].filter(p=>p.loading).length>=3)return;
  const controller=new AbortController(),part={buffer:new ArrayBuffer(config.parts[id].bytes),received:0,loading:true,used:++serial,controller};parts.set(id,part);requests.add(controller);
  fetcher(new URL(config.parts[id].name,base),{signal:controller.signal,cache:'force-cache',priority:'low'}).then(async response=>{
   if(!response.ok)throw Error('Image preload failed');const reader=response.body.getReader();
   for(;;){const {value,done}=await reader.read();if(done)break;if(part.received+value.length>part.buffer.byteLength)throw Error('Invalid image part');new Uint8Array(part.buffer,part.received,value.length).set(value);part.received+=value.length;wake();progress();}
   if(part.received!==part.buffer.byteLength)throw Error('Incomplete image part');
  }).catch(error=>{if(!controller.signal.aborted)fail(error);}).finally(()=>{part.loading=false;requests.delete(controller);trim();progress(true);if(primeAll)warm();});
 }
 function warm(){
  if(!config||disposed||failed||!visible)return;const id=config.packets[desired][0];
  const wanted=primeAll?config.parts.map((_,i)=>i).sort((a,b)=>Math.abs(a-id)-Math.abs(b-id)):active?[id,id+direction,id-direction,id+2*direction,id-2*direction]:[id];
  for(const [key,part] of parts)if(part.loading&&!wanted.includes(key)){part.controller.abort();parts.delete(key);}
  for(const key of wanted)preload(key);
 }
 async function packet(index){
  const ready=cached(index);if(ready)return{index,bytes:ready};
  const controller=new AbortController();requests.add(controller);let waiter;
  const streamed=new Promise(resolve=>{waiter={index,resolve};waiters.add(waiter);});
  const deadline=schedule(()=>controller.abort(),2500);
  try{
   const download=(async()=>{
    const response=await fetcher(new URL(config.frameBase+String(index).padStart(4,'0')+config.extension,base),{signal:controller.signal,cache:'force-cache',priority:'high'});
    if(!response.ok)throw Error('Image frame unavailable');const buffer=await response.arrayBuffer();
    if(buffer.byteLength!==config.packets[index][2])throw Error('Incomplete image frame');const bytes=new Uint8Array(buffer);packets.set(index,bytes);trim();return{index,bytes};
   })();
   return await Promise.race([streamed,download]);
  }finally{cancel(deadline);waiters.delete(waiter);controller.abort();requests.delete(controller);}
 }
 async function pump(){
  if(!config||busy||disposed||failed||!visible||(!active&&shown>=0)||shown===desired)return;
  const wait=nextAt-now();if(wait>1){if(!timer)timer=schedule(()=>{timer=0;pump();},wait);return;}
  busy=true;let bitmap;
  try{
   let result=await packet(desired);if(disposed||failed||!visible)return;
   const latest=cached(desired);if(latest)result={index:desired,bytes:latest};
   nextAt=now()+1000/config.fps;
   let expired=false,deadline;
   const decoded=Promise.resolve(decode(result.bytes,config.mime));decoded.then(value=>{if(expired)value.close?.();},()=>{});
   try{bitmap=await Promise.race([decoded,new Promise((_,reject)=>{deadline=schedule(()=>{expired=true;reject(Error('Image decoder timed out'));},1500);})]);}finally{cancel(deadline);}
   if(disposed||failed||!visible||(!active&&shown>=0))return;
   // Never flash a frame from the abandoned direction after a reversal.
   if(shown>=0&&(result.index-shown)*(desired-shown)<0)return;
   const consumed=await present(bitmap,result.index);if(consumed)bitmap=null;
   shown=result.index;
  }catch(error){if(visible&&(active||shown<0))fail(error);}finally{bitmap?.close?.();busy=false;warm();pump();}
 }
 return{
  async init(manifest,{hidden=false,preloadAll=false}={}){
   try{visible=!hidden;const response=await fetcher(manifest,{cache:'force-cache'});if(!response.ok)throw Error('Image manifest unavailable');config=await response.json();base=new URL('.',manifest);
    if(config.width!==2560||config.height!==1440||config.fps!==60||config.packets.length!==config.count||config.mime!=='image/jpeg')throw Error('Invalid image sequence');
    primeAll=preloadAll;if(primeAll){const total=config.parts.reduce((n,p)=>n+p.bytes,0);if(total>192*1024*1024)throw Error('Image preload exceeds memory budget');memoryLimit=Math.max(memoryLimit,total);}
    if(disposed)return;desired=Math.max(0,Math.min(config.count-1,desired));onReady({fps:config.fps,count:config.count});progress(true);warm();pump();
   }catch(error){fail(error);}
  },
  setTime(index){index=Math.max(0,Math.round(index));if(config)index=Math.min(config.count-1,index);if(index!==desired)direction=Math.sign(index-desired)||direction;desired=index;if(config){wake();warm();pump();}},
  setActive(value){active=value;if(value){warm();pump();}else{cancel(timer);timer=0;}},
  setVisible(value){visible=value;if(value){warm();pump();}else{for(const request of requests)request.abort();for(const [id,part]of parts)if(part.loading)parts.delete(id);}},
  redraw(){shown=-1;pump();},
  dispose(){disposed=true;active=false;cancel(timer);for(const request of requests)request.abort();parts.clear();packets.clear();waiters.clear();},
 };
}
