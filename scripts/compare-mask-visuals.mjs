import fs from 'node:fs/promises';import {once} from 'node:events';
const root='.project-state/95ms/visuals';await fs.mkdir(root,{recursive:true});
const version=await(await fetch('http://127.0.0.1:9339/json/version')).json(),ws=new WebSocket(version.webSocketDebuggerUrl);await once(ws,'open');let serial=0;const pending=new Map();
ws.addEventListener('message',e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}});
const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
for(const [name,url] of [['before','http://127.0.0.1:5201/'],['after','http://127.0.0.1:5202/']]){
 const {targetId}=await call('Target.createTarget',{url:'about:blank'}),{sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});const run=(m,p={})=>call(m,p,sessionId);
 await run('Page.enable');await run('Emulation.setDeviceMetricsOverride',{width:5120,height:1440,deviceScaleFactor:1,mobile:false});await run('Page.navigate',{url});await new Promise(r=>setTimeout(r,1200));
 await run('Runtime.evaluate',{expression:`new Promise(resolve=>{const video=document.querySelector('.hero video');video.pause();video.currentTime=0;video.addEventListener('seeked',resolve,{once:true});setTimeout(resolve,500);})`,awaitPromise:true});
 for(const position of [0,.055,.11,.14]){
  await run('Runtime.evaluate',{expression:`scrollTo(0,${position}*(document.documentElement.scrollHeight-innerHeight))`});await new Promise(r=>setTimeout(r,500));
  const frame=await run('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(`${root}/${name}-${position}.png`,Buffer.from(frame.data,'base64'));
  const state=await run('Runtime.evaluate',{expression:`JSON.stringify({y:scrollY,mask:document.querySelector('.entry-crop').className})`,returnByValue:true});console.log(name,position,state.result.value);
 }
 await call('Target.closeTarget',{targetId});
}
ws.close();
