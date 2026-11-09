import {createImageSequence} from './image-sequence.js';
import {createScrollVideo} from './scroll-video.js';

/** Direct image frames avoid HTMLMediaElement seek flushing on desktop. */
export function createCompatibilityPlayer(video,{manifest,source,count:initialCount,maskGeometry,onFrame,onReady=()=>{},onVisible=()=>{},workerFactory=()=>new Worker(new URL('./image-worker.js',import.meta.url),{type:'module'})}){
 const domMode=typeof createImageBitmap!=='function';let currentImage;
 const canvas=document.createElement(domMode?'div':'canvas');canvas.className=`${video.className} independent-surface compatibility-surface`;canvas.width=2560;canvas.height=1440;
 canvas.style.opacity='0';canvas.style.pointerEvents='none';canvas.style.willChange='transform, opacity';canvas.setAttribute('aria-hidden','true');video.after(canvas);
 const context=domMode?null:maskGeometry?canvas.getContext('2d',{alpha:true,desynchronized:true}):canvas.getContext('bitmaprenderer')||canvas.getContext('2d',{alpha:false,desynchronized:true});
 const mask=maskGeometry&&!domMode?document.createElement('canvas'):null;if(mask){mask.width=1;mask.height=1440;}
 const maskContext=mask?.getContext('2d',{alpha:true,willReadFrequently:true});
 const host=maskGeometry?video.parentElement:null;
 let worker,sequence,fallback,shown=-1,desired=0,active=false,fps=60,count=initialCount,disposed=false,main=false,visible=false,hidden=document.hidden,lastMask=JSON.stringify(maskGeometry);
 const startup=setTimeout(useMain,5000);
 function loading(data){video.dataset??={};video.dataset.mediaLoaded=String(data.loaded);video.dataset.mediaTotal=String(data.total);video.dataset.mediaReady=String(data.complete);}
 loading({loaded:0,total:0,complete:false});
 function draw(bitmap,index){
  if(disposed){bitmap.close?.();return;}
  try{
   if(domMode){
    bitmap.style.cssText=`position:absolute;inset:0;width:100%;height:100%;object-fit:${maskGeometry?'fill':'cover'};object-position:center;pointer-events:none;transition:none`;
    if(currentImage){currentImage.replaceWith(bitmap);currentImage.close?.();}else canvas.append(bitmap);
    currentImage=bitmap;host?.classList.remove('frame-mask-ready');
   }else if(context.transferFromImageBitmap)context.transferFromImageBitmap(bitmap);
   else{
    context.globalCompositeOperation='copy';context.drawImage(bitmap,0,0,2560,1440);
    if(maskGeometry){
     const p=index/(count-1),ease=p*p*(3-2*p),mix=(a,b)=>a+(b-a)*ease;
     const boxY=mix(maskGeometry.startBox.y,maskGeometry.endBox.y),boxH=mix(maskGeometry.startBox.h,maskGeometry.endBox.h),frameY=mix(maskGeometry.startFrame.y,maskGeometry.endFrame.y),frameH=mix(maskGeometry.startFrame.h,maskGeometry.endFrame.h);
     const top=(boxY-frameY)*1440/frameH,height=boxH*1440/frameH,gradient=maskContext.createLinearGradient(0,top,0,top+height);
     gradient.addColorStop(0,'rgba(0,0,0,0)');gradient.addColorStop(.12,'rgba(0,0,0,1)');gradient.addColorStop(.83,'rgba(0,0,0,1)');gradient.addColorStop(1,'rgba(0,0,0,0)');
     maskContext.globalCompositeOperation='copy';maskContext.fillStyle=gradient;maskContext.fillRect(0,0,1,1440);
     context.globalCompositeOperation='destination-in';context.drawImage(mask,0,0,2560,1440);context.globalCompositeOperation='source-over';host.classList.add('frame-mask-ready');
    }
    bitmap.close?.();
   }
   shown=index;canvas.style.opacity='1';video.style.visibility='hidden';if(!visible){visible=true;onVisible();}
   canvas.dispatchEvent(new CustomEvent('framepresented',{detail:{index,at:performance.timeOrigin+performance.now()}}));onFrame(index/fps);
  }catch(error){bitmap.close?.();throw error;}
 }
 function ready(data){clearTimeout(startup);fps=data.fps;count=data.count;onReady();}
 async function decode(bytes,mime){
  if(!domMode)return createImageBitmap(new Blob([bytes],{type:mime}));
  // Production permits self/data images, not blob URLs. Keep that policy intact.
  // Avoid a FileReader task followed by a load event before decoding. Those
  // serial event-loop waits can consume several display frames on older PCs.
  let binary='';for(let offset=0;offset<bytes.length;offset+=16384)binary+=String.fromCharCode(...bytes.subarray(offset,offset+16384));
  const image=new Image();image.decoding='async';let timeout;
  try{await new Promise((resolve,reject)=>{timeout=setTimeout(()=>{image.src='';reject(Error('Image decode timed out'));},1500);image.onerror=()=>reject(Error('Image decode failed'));if(!image.decode)image.onload=resolve;image.src=`data:${mime};base64,${btoa(binary)}`;if(image.decode)image.decode().then(resolve,reject);});image.close=()=>{image.onload=null;image.onerror=null;image.src='';};return image;}finally{clearTimeout(timeout);}
 }
 function useNative(){
  if(disposed||fallback)return;sequence?.dispose();worker?.terminate();worker=null;clearTimeout(startup);
  fallback=createScrollVideo(video,{source,fps,onFrame(time){if(disposed||Math.abs(time-desired/fps)>1/fps)return;canvas.remove();host?.classList.remove('frame-mask-ready');video.style.visibility='';shown=Math.round(time*fps);onVisible();onFrame(time);}});
  fallback.setTime(desired/fps);fallback.setActive(active);
 }
 function useMain(){
  if(disposed||main||fallback)return;main=true;clearTimeout(startup);worker?.terminate();worker=null;
  sequence=createImageSequence({decode,present:(bitmap,index)=>{draw(bitmap,index);return true;},onReady:ready,onProgress:loading,onError:useNative});
  sequence.setTime(desired);sequence.setActive(active);sequence.init(new URL(manifest,location.href).href,{hidden,preloadAll:true});
 }
 try{
  if(domMode||!context)throw Error('Use the document image decoder');
  worker=workerFactory();
  worker.onmessage=({data})=>{
   if(disposed){data.bitmap?.close?.();return;}
   if(data.type==='ready'){ready(data);worker.postMessage({type:'time',index:desired});worker.postMessage({type:'active',value:active});}
   else if(data.type==='progress')loading(data);
   else if(data.type==='frame'){try{draw(data.bitmap,data.index);worker?.postMessage({type:'presented'});}catch{useMain();}}
   else if(data.type==='error')useMain();
  };
  worker.onerror=useMain;worker.postMessage({type:'init',manifest:new URL(manifest,location.href).href,hidden,preloadAll:true});
 }catch{useMain();}
 return{
  get ready(){return fallback?.ready||shown>=0;},get currentTime(){return fallback?.currentTime??Math.max(0,shown)/fps;},get duration(){return fallback?.duration||count/fps;},
  setTime(time){const index=Math.min(count-1,Math.max(0,Math.round(time*fps)));if(index===desired)return;desired=index;if(fallback)fallback.setTime(time);else if(sequence)sequence.setTime(index);else worker?.postMessage({type:'time',index});},
  setActive(value){if(hidden!==document.hidden){hidden=document.hidden;sequence?.setVisible(!hidden);worker?.postMessage({type:'visibility',hidden});}if(active===value)return;active=value;if(fallback)fallback.setActive(value);else if(sequence)sequence.setActive(value);else worker?.postMessage({type:'active',value});},
  setMaskGeometry(value){const next=JSON.stringify(value);if(next===lastMask)return;lastMask=next;maskGeometry=value;sequence?.redraw();worker?.postMessage({type:'redraw'});},
  dispose(){disposed=true;clearTimeout(startup);sequence?.dispose();worker?.terminate();fallback?.dispose();currentImage?.close?.();canvas.remove();host?.classList.remove('frame-mask-ready');video.style.visibility='';},
 };
}
