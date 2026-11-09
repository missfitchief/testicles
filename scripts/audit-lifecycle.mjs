import fs from 'node:fs/promises';import {once} from 'node:events';
const version=await(await fetch('http://127.0.0.1:9339/json/version')).json(),ws=new WebSocket(version.webSocketDebuggerUrl);await once(ws,'open');let id=0;const pending=new Map();
ws.addEventListener('message',e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}});
const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const serial=++id;pending.set(serial,{resolve,reject});ws.send(JSON.stringify({id:serial,method,params,...(sessionId?{sessionId}:{})}));});
await call('Target.setDiscoverTargets',{discover:true});
const {targetId}=await call('Target.createTarget',{url:'about:blank'}),{sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});const run=(m,p={})=>call(m,p,sessionId);
const evalJS=async(expression,awaitPromise=false)=>{const result=await run('Runtime.evaluate',{expression,returnByValue:true,awaitPromise});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
await run('Page.enable');await run('Performance.enable');
await run('Page.addScriptToEvaluateOnNewDocument',{source:`{const Original=Worker;let active=0,total=0;const refs=[];window.Worker=class extends Original{constructor(...args){super(...args);active++;total++;refs.push(new WeakRef(this));const send=this.postMessage.bind(this),stop=this.terminate.bind(this);let stopped=false;this.postMessage=(data,...rest)=>{if(data.type==='init')this.__role=data.manifest;return send(data,...rest)};this.terminate=()=>{if(!stopped){stopped=true;active--;this.__stopped=true;}return stop();};}};window.__workerCounts=()=>({active,total});window.__workerRefs=refs;}`});
await run('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await run('Page.navigate',{url:'http://127.0.0.1:5199/'});await run('Page.bringToFront');await new Promise(r=>setTimeout(r,2500));
const checks=[],rapidOnly=process.argv.includes('--rapid-only');
for(let cycle=0;cycle<(rapidOnly?0:8);cycle++)for(const width of [390,1280]){
 await run('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
 await evalJS(`scrollTo(0,document.documentElement.scrollHeight*.8)`);await new Promise(r=>setTimeout(r,1100));await run('HeapProfiler.collectGarbage');
 const dom=await run('Memory.getDOMCounters'),metrics=await run('Performance.getMetrics'),targets=await call('Target.getTargets');
 checks.push({cycle,width,dom,jsHeap:metrics.metrics.find(m=>m.name==='JSHeapUsedSize')?.value,...await evalJS(`({workers:__workerCounts(),canvases:document.querySelectorAll('canvas').length,nodes:document.querySelectorAll('*').length,ready:document.querySelector('.story-canvas').style.opacity})`)});
}
if(!rapidOnly){await run('Page.setWebLifecycleState',{state:'frozen'});await new Promise(r=>setTimeout(r,100));await run('Page.setWebLifecycleState',{state:'active'});await new Promise(r=>setTimeout(r,300));}
checks.push({resume:await evalJS(`({ready:document.querySelector('.story-canvas').style.opacity,canvases:document.querySelectorAll('canvas').length})`)});
await run('Page.bringToFront');
if(rapidOnly){await evalJS(`scrollTo(0,document.documentElement.scrollHeight*.5)`);await new Promise(r=>setTimeout(r,1500));}
const rapid=await evalJS(`(async()=>{const worker=__workerRefs.map(r=>r.deref()).find(w=>w&&!w.__stopped&&w.__role?.includes('/story/')),canvas=document.querySelector('.journey-film.independent-surface');if(!worker)return {error:'Worker not observed'};let inputs=0,frames=0;const onFrame=()=>frames++;canvas.addEventListener('framepresented',onFrame);const start=performance.now();await new Promise(resolve=>{const timer=setInterval(()=>{const age=performance.now()-start;if(age>=5000){clearInterval(timer);resolve();return;}worker.postMessage({type:'time',index:Math.round(650+500*Math.sin(age/900))});inputs++;},4);});canvas.removeEventListener('framepresented',onFrame);return {inputEvents:inputs,frameUpdates:frames,durationMs:performance.now()-start};})()`,true);checks.push({highRateInput:rapid});
await fs.writeFile(`.project-state/performance-investigation/${rapidOnly?'highrate':'lifecycle'}.json`,JSON.stringify(checks,null,2));console.log(JSON.stringify(checks,null,2));await call('Target.closeTarget',{targetId});ws.close();
