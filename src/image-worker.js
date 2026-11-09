import {createImageSequence} from './image-sequence.js';
let sequence,resolvePresentation,timer;
self.onmessage=({data})=>{
 if(data.type==='init'){
  if(typeof createImageBitmap!=='function'){postMessage({type:'error',message:'Worker image decoder unavailable'});return;}
  sequence=createImageSequence({
   decode:(bytes,mime)=>createImageBitmap(new Blob([bytes],{type:mime})),
   present:(bitmap,index)=>new Promise((resolve,reject)=>{resolvePresentation=resolve;timer=setTimeout(()=>reject(Error('Image presentation timed out')),1500);postMessage({type:'frame',index,bitmap},[bitmap]);}),
   onReady:details=>postMessage({type:'ready',...details}),onProgress:details=>postMessage({type:'progress',...details}),onError:error=>postMessage({type:'error',message:String(error?.message||error)}),
  });
  sequence.init(data.manifest,{hidden:data.hidden,preloadAll:data.preloadAll});
 }else if(data.type==='time')sequence?.setTime(data.index);
 else if(data.type==='active')sequence?.setActive(data.value);
 else if(data.type==='visibility')sequence?.setVisible(!data.hidden);
 else if(data.type==='redraw')sequence?.redraw();
 else if(data.type==='presented'){clearTimeout(timer);resolvePresentation?.(true);resolvePresentation=null;}
 else if(data.type==='dispose'){clearTimeout(timer);sequence?.dispose();resolvePresentation?.(true);resolvePresentation=null;}
};
