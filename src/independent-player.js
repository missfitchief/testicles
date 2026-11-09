import { createScrollVideo } from './scroll-video.js';

export function createIndependentPlayer(video,{manifest,source,count:initialCount,onFrame,onReady=()=>{},workerFactory=url=>new Worker(url,{type:'module'})}){
 const canvas=document.createElement('canvas');canvas.className=`${video.className} independent-surface`;canvas.width=2560;canvas.height=1440;
 canvas.style.opacity='0';canvas.style.pointerEvents='none';canvas.style.willChange='transform, opacity';canvas.setAttribute('aria-hidden','true');video.after(canvas);
 let fps=60,count=initialCount,shown=-1,active=false,desired=0,disposed=false,fallback=null,fallbackVisible=false,worker=null,initialized=false,lastHidden=document.hidden;
 const timeout=setTimeout(()=>switchToNative(),5000);
 function switchToNative(){
  if(disposed||fallback)return;clearTimeout(timeout);worker?.terminate();worker=null;
  fallback=createScrollVideo(video,{source,fps,onFrame(time){if(Math.abs(time-desired/fps)>1/fps)return;fallbackVisible=true;canvas.remove();video.style.visibility='';onFrame(time);},onError(){}});
  fallback.setTime(desired/fps);fallback.setActive(active);
 }
 try{
  worker=workerFactory(new URL('./independent-worker.js',import.meta.url));
  worker.onmessage=({data})=>{
   if(disposed)return;
   if(data.type==='ready'){clearTimeout(timeout);initialized=true;fps=data.fps;count=data.count;worker.postMessage({type:'time',index:desired});worker.postMessage({type:'active',value:active});onReady();}
   else if(data.type==='frame'){shown=data.index;canvas.style.opacity='1';video.style.visibility='hidden';canvas.dispatchEvent(new CustomEvent('framepresented',{detail:{index:shown,at:data.at}}));onFrame(shown/fps);}
   else if(data.type==='error')switchToNative();
  };
  worker.onerror=switchToNative;const surface=canvas.transferControlToOffscreen();
  worker.postMessage({type:'init',canvas:surface,manifest:new URL(manifest,location.href).href,eager:!navigator.connection?.saveData,hidden:document.hidden},[surface]);
 }catch{switchToNative();}
 return {
  get ready(){return fallbackVisible||shown>=0;},get duration(){return fallback?.duration||count/fps;},get currentTime(){return fallbackVisible?fallback.currentTime:Math.max(0,shown)/fps;},
  setTime(time){const next=Math.min(count-1,Math.max(0,Math.round(time*fps)));if(next===desired)return;desired=next;if(fallback)fallback.setTime(time);else if(initialized)worker.postMessage({type:'time',index:desired});},
  setActive(value){if(lastHidden!==document.hidden){lastHidden=document.hidden;worker?.postMessage({type:'visibility',hidden:lastHidden});}if(active===value)return;active=value;if(fallback)fallback.setActive(value);else if(initialized)worker.postMessage({type:'active',value});},
  dispose(){disposed=true;clearTimeout(timeout);worker?.terminate();fallback?.dispose();canvas.remove();video.style.visibility='';},
 };
}
