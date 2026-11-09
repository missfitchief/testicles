import fs from 'node:fs/promises';
import path from 'node:path';
import {once} from 'node:events';

const args=Object.fromEntries(process.argv.slice(2).map(value=>{const [key,...rest]=value.replace(/^--/,'').split('=');return [key,rest.join('=')||true];}));
const url=args.url||'http://127.0.0.1:5202/',width=Number(args.width||2560),height=Number(args.height||1440);
const out=path.resolve('.project-state/performance-investigation',args.label||'wheel-stress');
await fs.mkdir(out,{recursive:true});
const version=await (await fetch(`http://127.0.0.1:${args.port||9339}/json/version`)).json();
const ws=new WebSocket(version.webSocketDebuggerUrl);await once(ws,'open');
let serial=0;const pending=new Map();
ws.addEventListener('message',event=>{const result=JSON.parse(event.data),job=pending.get(result.id);if(job){pending.delete(result.id);result.error?job.reject(new Error(JSON.stringify(result.error))):job.resolve(result.result);}});
const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
const {targetId}=await call('Target.createTarget',{url:'about:blank'}),{sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});
const run=(method,params={})=>call(method,params,sessionId);
const evaluate=async expression=>{const value=await run('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(value.exceptionDetails)throw Error(JSON.stringify(value.exceptionDetails));return value.result.value;};
await run('Page.enable');await run('Runtime.enable');
if(args.native)await run('Page.addScriptToEvaluateOnNewDocument',{source:'globalThis.VideoDecoder=undefined;'});
await run('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=700});
if(width<=700)await run('Emulation.setTouchEmulationEnabled',{enabled:true});
await run('Page.navigate',{url});await run('Page.bringToFront');
await new Promise(resolve=>setTimeout(resolve,5000));
await evaluate(`(()=>{
 const frames=[],stalls=[],samples=[],errors=[],tasks=[];let alive=true,lastFrame=performance.now(),lastMotion=lastFrame,motionStart=lastFrame,lastY=scrollY;
 const listeners=[];
 for(const surface of document.querySelectorAll('.independent-surface')){const handler=event=>{frames.push({at:performance.now(),index:event.detail.index,entry:surface.classList.contains('entry-film')});if(surface.classList.contains('journey-film'))lastFrame=performance.now();};surface.addEventListener('framepresented',handler);listeners.push(()=>surface.removeEventListener('framepresented',handler));}
 const film=document.querySelector('.journey-film:not(canvas)');let frameCallback;
 if(!document.querySelector('.journey-film.independent-surface')&&film?.requestVideoFrameCallback){const tick=(_,meta)=>{lastFrame=performance.now();frames.push({at:lastFrame,index:meta.mediaTime*24});if(alive)frameCallback=film.requestVideoFrameCallback(tick);};frameCallback=film.requestVideoFrameCallback(tick);}
 const po=new PerformanceObserver(list=>tasks.push(...list.getEntries().map(e=>({at:e.startTime,duration:e.duration}))));po.observe({entryTypes:['longtask']});
 const onError=e=>errors.push(e.message||e.reason?.message||String(e.reason));window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onError);
 function tick(now){if(!alive)return;const moving=Math.abs(scrollY-lastY)>2;if(moving){if(now-lastMotion>100)motionStart=now;lastMotion=now;}const stage=document.querySelector('.story-canvas'),visible=Number(getComputedStyle(stage).opacity)>.99;
  const gap=now-Math.max(lastFrame,motionStart);if(visible&&moving&&gap>150)stalls.push({at:now,gap,y:scrollY});
  samples.push({at:now,y:scrollY,visible,age:now-lastFrame});lastY=scrollY;requestAnimationFrame(tick);
 }requestAnimationFrame(tick);
 window.__stress={snapshot:()=>({y:scrollY,ready:document.querySelector('.journey-media').dataset.ready,phase:document.querySelector('.journey-media').dataset.phase,canvas:document.querySelectorAll('canvas').length,visible:Number(getComputedStyle(document.querySelector('.story-canvas')).opacity),source:film?.currentSrc,width:film?.videoWidth,height:film?.videoHeight}),finish:()=>{alive=false;po.disconnect();listeners.forEach(fn=>fn());if(frameCallback)film.cancelVideoFrameCallback(frameCallback);window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onError);return {frames,stalls,samples,errors,tasks};}};
})()`);
const checkpoints=[];
// Native compositor input, including an abrupt direction reversal in each leg.
for(const [i,distance] of [height*7.5,-height*6.5,height*7,-height*5.5,height*7.5,-height*8].entries()){
 await run('Input.synthesizeScrollGesture',{x:Math.round(width*.65),y:Math.round(height*.65),yDistance:-distance,speed:height*5,gestureSourceType:width<=700?'touch':'mouse'});
 await new Promise(resolve=>setTimeout(resolve,120));checkpoints.push({leg:i,...await evaluate('__stress.snapshot()')});
}
// Separate discontinuous jumps verify that no old request traps the new target.
for(const [i,position] of [.17,.88,.28,.98,.18,.76,.4].entries()){
 await evaluate(`scrollTo(0,${position}*(document.documentElement.scrollHeight-innerHeight))`);
 await new Promise(resolve=>setTimeout(resolve,350));
 checkpoints.push({jump:i,...await evaluate('__stress.snapshot()')});
 if([1,3,6].includes(i)){
  const screenshot=await run('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await fs.writeFile(path.join(out,`checkpoint-${i}.png`),Buffer.from(screenshot.data,'base64'));
 }
}
const measurements=await evaluate('__stress.finish()');
const summary={url,width,height,checkpoints,frames:measurements.frames.length,stalledSamples:measurements.stalls.length,maxMovingStall:Math.max(0,...measurements.stalls.map(s=>s.gap)),errors:measurements.errors,longTasks:measurements.tasks};
await fs.writeFile(path.join(out,'stress.json'),JSON.stringify({summary,...measurements},null,2));
console.log(JSON.stringify(summary,null,2));await call('Target.closeTarget',{targetId});ws.close();
