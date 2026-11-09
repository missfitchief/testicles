import fs from 'node:fs/promises';
import path from 'node:path';
import {once} from 'node:events';

const args=Object.fromEntries(process.argv.slice(2).map(value=>{const [key,...rest]=value.replace(/^--/,'').split('=');return [key,rest.join('=')||true];}));
const url=args.url||'http://127.0.0.1:5202/',width=Number(args.width||2560),height=Number(args.height||1440);
const out=path.resolve('.project-state/performance-investigation',args.label||'wheel-stress');
await fs.mkdir(out,{recursive:true});
const version=await (await fetch(`http://127.0.0.1:${args.port||9339}/json/version`)).json();
const ws=new WebSocket(version.webSocketDebuggerUrl);await once(ws,'open');
let serial=0;const pending=new Map(),startupErrors=[];
ws.addEventListener('message',event=>{const result=JSON.parse(event.data),job=pending.get(result.id);if(job){pending.delete(result.id);result.error?job.reject(new Error(JSON.stringify(result.error))):job.resolve(result.result);}else if(result.method==='Log.entryAdded'&&result.params.entry.level==='error')startupErrors.push(result.params.entry.text.slice(0,1000));});
const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
const {targetId}=await call('Target.createTarget',{url:'about:blank'}),{sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});
const run=(method,params={})=>call(method,params,sessionId);
const evaluate=async expression=>{const value=await run('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(value.exceptionDetails)throw Error(JSON.stringify(value.exceptionDetails));return value.result.value;};
await run('Page.enable');await run('Runtime.enable');await run('Log.enable');
if(args.native)await run('Page.addScriptToEvaluateOnNewDocument',{source:'globalThis.VideoDecoder=undefined;'});
if(args.compat==='basic')await run('Page.addScriptToEvaluateOnNewDocument',{source:'globalThis.VideoDecoder=undefined;globalThis.OffscreenCanvas=undefined;HTMLCanvasElement.prototype.transferControlToOffscreen=undefined;'});
if(args.compat==='main')await run('Page.addScriptToEvaluateOnNewDocument',{source:'globalThis.VideoDecoder=undefined;globalThis.Worker=undefined;'});
if(args.compat==='dom')await run('Page.addScriptToEvaluateOnNewDocument',{source:'globalThis.VideoDecoder=undefined;globalThis.Worker=undefined;globalThis.createImageBitmap=undefined;'});
if(args.compat==='decoder-error')await run('Page.addScriptToEvaluateOnNewDocument',{source:'const OriginalWorker=globalThis.Worker;globalThis.Worker=class extends OriginalWorker{constructor(url,options){if(String(url).includes("independent-worker"))throw new Error("Simulated decoder worker unavailable");super(url,options);}};'});
await run('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=700});
if(width<=700)await run('Emulation.setTouchEmulationEnabled',{enabled:true});
await run('Page.navigate',{url});await run('Page.bringToFront');
await new Promise(resolve=>setTimeout(resolve,5000));
const renderer=await evaluate(`({surfaces:[...document.querySelectorAll('.compatibility-surface')].map(s=>s.tagName),videos:[...document.querySelectorAll('video.entry-film,video.journey-film')].map(v=>v.currentSrc)})`);
if(args.compat&&renderer.surfaces.length!==2){await call('Target.closeTarget',{targetId});ws.close();throw Error('Expected direct-image compatibility surfaces; native fallback was active: '+JSON.stringify({renderer,startupErrors}));}
await evaluate(`(()=>{
 const frames=[],stalls=[],samples=[],errors=[],tasks=[],raf=[];let alive=true,lastFrame=performance.now(),lastEntryFrame=lastFrame,lastMotion=lastFrame,motionStart=lastFrame,lastY=scrollY,surface='',surfaceStart=lastFrame,lastTick=0;
 const listeners=[];
 for(const surface of document.querySelectorAll('.independent-surface')){const handler=event=>{frames.push({at:performance.now(),index:event.detail.index,entry:surface.classList.contains('entry-film')});if(surface.classList.contains('journey-film'))lastFrame=performance.now();else lastEntryFrame=performance.now();};surface.addEventListener('framepresented',handler);listeners.push(()=>surface.removeEventListener('framepresented',handler));}
 const film=document.querySelector('.journey-film:not(canvas)');let frameCallback;
 if(!document.querySelector('.journey-film.independent-surface')&&film?.requestVideoFrameCallback){const tick=(_,meta)=>{lastFrame=performance.now();frames.push({at:lastFrame,index:meta.mediaTime*24});if(alive)frameCallback=film.requestVideoFrameCallback(tick);};frameCallback=film.requestVideoFrameCallback(tick);}
 const po=new PerformanceObserver(list=>tasks.push(...list.getEntries().map(e=>({at:e.startTime,duration:e.duration}))));po.observe({entryTypes:['longtask']});
 const onError=e=>errors.push(e.message||e.reason?.message||String(e.reason));window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onError);
 function tick(timestamp){if(!alive)return;if(lastTick)raf.push(timestamp-lastTick);lastTick=timestamp;const now=performance.now(),moving=Math.abs(scrollY-lastY)>2;if(moving){if(now-lastMotion>100)motionStart=now;lastMotion=now;}const stage=document.querySelector('.story-canvas'),visible=Number(getComputedStyle(stage).opacity)>.99,phase=document.querySelector('.journey-media').dataset.phase;
  const next=visible?(phase==='idle'?'':'story'):Number(getComputedStyle(document.querySelector('.entry-layer')).opacity)>.02?'entry':'';if(next!==surface){surface=next;surfaceStart=now;}
  const gap=now-Math.max(surface==='entry'?lastEntryFrame:lastFrame,motionStart,surfaceStart);if(surface&&moving&&gap>${Number(args['stall-ms']||150)})stalls.push({at:now,gap,y:scrollY,surface});
  samples.push({at:now,y:scrollY,visible,phase,age:now-lastFrame,surface,gap,moving});lastY=scrollY;requestAnimationFrame(tick);
 }requestAnimationFrame(tick);
 window.__stress={snapshot:()=>({y:scrollY,ready:document.querySelector('.journey-media').dataset.ready,phase:document.querySelector('.journey-media').dataset.phase,canvas:document.querySelectorAll('canvas').length,visible:Number(getComputedStyle(document.querySelector('.story-canvas')).opacity),source:film?.currentSrc,width:film?.videoWidth,height:film?.videoHeight}),finish:()=>{alive=false;po.disconnect();listeners.forEach(fn=>fn());if(frameCallback)film.cancelVideoFrameCallback(frameCallback);window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onError);return {frames,stalls,samples,errors,tasks,raf};}};
})()`);
const checkpoints=[];
// Native compositor input, including an abrupt direction reversal in each leg.
const entrance=args.route==='entrance';
const legs=entrance?[height*2,-height*2,height*2,-height*2,height*2,-height*2,height*2,-height*2]:[height*7.5,-height*6.5,height*7,-height*5.5,height*7.5,-height*8];
const distances=Array.from({length:Number(args.repeat||1)},()=>legs).flat();
for(const [i,distance] of distances.entries()){
 await run('Input.synthesizeScrollGesture',{x:Math.round(width*.65),y:Math.round(height*.65),yDistance:-distance,speed:height*(entrance ? .8 : 5),gestureSourceType:width<=700?'touch':'mouse'});
 await new Promise(resolve=>setTimeout(resolve,120));checkpoints.push({leg:i,...await evaluate('__stress.snapshot()')});
}
// Separate discontinuous jumps verify that no old request traps the new target.
for(const [i,position] of [.17,.88,.28,.98,.18,.76,.4].entries()){
 await evaluate(`scrollTo(0,${position}*(document.documentElement.scrollHeight-innerHeight))`);
 await new Promise(resolve=>setTimeout(resolve,350));
 checkpoints.push({jump:i,...await evaluate('__stress.snapshot()')});
 if(args.screenshots!=='no'&&[1,3,6].includes(i)){
  const screenshot=await run('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await fs.writeFile(path.join(out,`checkpoint-${i}.png`),Buffer.from(screenshot.data,'base64'));
 }
}
const measurements=await evaluate('__stress.finish()');
const sorted=measurements.raf.toSorted((a,b)=>a-b);
const summary={url,width,height,route:args.route||'story',repeat:Number(args.repeat||1),compatibility:args.compat||null,renderer,startupErrors,checkpoints,frames:measurements.frames.length,stalledSamples:measurements.stalls.length,maxMovingStall:Math.max(0,...measurements.stalls.map(s=>s.gap)),movingGaps:{over50:measurements.samples.filter(s=>s.surface&&s.moving&&s.gap>50).length,over80:measurements.samples.filter(s=>s.surface&&s.moving&&s.gap>80).length},raf:{p95:sorted[Math.floor(sorted.length*.95)],max:Math.max(0,...sorted)},errors:measurements.errors,longTasks:measurements.tasks};
await fs.writeFile(path.join(out,'stress.json'),JSON.stringify({summary,...measurements},null,2));
console.log(JSON.stringify(summary,null,2));await call('Target.closeTarget',{targetId});ws.close();
