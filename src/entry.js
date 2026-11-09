const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
const mix=(a,b,p)=>a+(b-a)*p;
const rect=r=>({x:r.left,y:r.top,w:r.width,h:r.height});

/** Keep the original opening intact, then carry its camera into the story. */
export function createEntrance(root,narrow,storyDuration,reduce){
  const wrapper=root.closest('.connected-experience');
  const hero=wrapper?.querySelector('.hero');
  const video=root.querySelector('.entry-film');
  if(!wrapper||!hero||!video)return null;
  const heroVideo=hero.querySelector('video');
  const art=hero.querySelector('.hero-art');
  const layer=root.querySelector('.entry-layer');
  const crop=root.querySelector('.entry-crop');
  const poster=root.querySelector('.entry-poster');
  const canvas=root.querySelector('.story-canvas');
  const captions=root.querySelector('.story-captions');
  const chrome=[...hero.querySelectorAll('h1,.hero-intro,.hero-note')];
  const storyVideo=root.querySelector('.journey-film');
  const duration=Number(root.dataset.entryDuration);
  const share=duration/(duration+storyDuration);
  let geometry=null,last=-1,departed=false,aligned=false,disposed=false;
  wrapper.classList.add('is-connected');

  function measure(){
    const height=hero.offsetHeight;
    wrapper.style.setProperty('--hero-height',`${height}px`);
    const viewportHeight=narrow.matches?root.querySelector('.story-stage').clientHeight:innerHeight;
    const pinnedTop=-Math.max(0,height-viewportHeight);
    const heroRect=hero.getBoundingClientRect();
    const start=rect(art.getBoundingClientRect());
    start.y+=pinnedTop-heroRect.top;
    const position=getComputedStyle(heroVideo).objectPosition.split(' ').map(parseFloat);
    const scale=Math.max(start.w/2560,start.h/1440);
    const startFrame={w:2560*scale,h:1440*scale};
    startFrame.x=start.x+(start.w-startFrame.w)*(position[0]/100||.5);
    startFrame.y=start.y+(start.h-startFrame.h)*(position[1]/100||.5);
    const storySurface=root.dataset.renderer==='frames'?root.querySelector('.journey-frames'):storyVideo;
    const end=rect(storySurface.getBoundingClientRect());
    const style=getComputedStyle(storySurface);
    const endScale=(style.objectFit==='contain'?Math.min:Math.max)(end.w/2560,end.h/1440);
    const endPosition=style.objectPosition.split(' ').map(value=>Number.parseFloat(value));
    const endFrame={w:2560*endScale,h:1440*endScale};
    endFrame.x=end.x+(end.w-endFrame.w)*(Number.isFinite(endPosition[0])?endPosition[0]/100:.5);
    endFrame.y=end.y+(end.h-endFrame.h)*(Number.isFinite(endPosition[1])?endPosition[1]/100:.5);
    if(narrow.matches){
      // Match the existing square phone composition, including its safe padding.
      endFrame.w=end.w*2560/1728;endFrame.h=end.h*1440/1728;
      const cropX=Math.max(0,Math.min(2560-1728,2560*.33-864));
      endFrame.x=end.x-cropX*end.w/1728;
      endFrame.y=end.y+end.h*144/1728;
    }
    const base={w:innerWidth,h:viewportHeight};
    crop.style.width=`${base.w}px`;crop.style.height=`${base.h}px`;
    geometry={start,startFrame,end,endFrame,base};last=-1;
  }

  function update(overall){
    if(!geometry||disposed)return;
    const raw=Math.min(1.12,Math.max(0,overall/share)),p=clamp(raw);
    if(raw===last)return;last=raw;
    const move=smooth(p);
    const box={},frame={};
    for(const k of ['x','y','w','h']){
      box[k]=mix(geometry.start[k],geometry.end[k],move);
      frame[k]=mix(geometry.startFrame[k],geometry.endFrame[k],move);
    }
    const base=geometry.base;
    crop.style.transform=`translate3d(${box.x}px,${box.y}px,0) scale(${box.w/base.w},${box.h/base.h})`;
    const transform=`translate3d(${(frame.x-box.x)*base.w/box.w}px,${(frame.y-box.y)*base.h/box.h}px,0) scale(${frame.w*base.w/(2560*box.w)},${frame.h*base.h/(1440*box.h)})`;
    video.style.transform=transform;poster.style.transform=transform;
    const frameCanvas=root.querySelector('.entry-frames');
    if(frameCanvas&&root.dataset.renderer==='frames')frameCanvas.style.transform=transform;
    const enter=smooth(p/.12),leave=!narrow.matches&&root.dataset.renderer==='frames'?(raw>=1?1:0):smooth((raw-1)/.022);
    layer.style.opacity=String(enter*(1-leave));
    // Both shots keep moving through the matching frame; there is no hold zone.
    canvas.style.opacity=String(raw>=1?1:0);
    if(captions)captions.style.opacity=String(smooth((raw-1)/.12));
    canvas.inert=raw<1;
    for(const node of chrome)node.style.opacity=String(1-smooth(p/.22));
    // Keep the original artwork beneath the incoming film until it is opaque.
    hero.style.opacity=String(1-smooth((p-.12)/.12));
    hero.inert=p>=.23;
    const nextDeparted=p>.015;
    if(nextDeparted!==departed){
      departed=nextDeparted;hero.dataset.departed=String(departed);
      hero.style.pointerEvents=departed?'none':'';
      if(departed)heroVideo.pause();
      else if(!document.hidden){
        if(!heroVideo.getAttribute('src')){heroVideo.src=(narrow.matches&&heroVideo.dataset.mobileSrc)||heroVideo.dataset.src;heroVideo.load();}
        heroVideo.playbackRate=reduce.matches ? .55 : 1;
        heroVideo.play().then(()=>{if(disposed||departed||document.hidden)heroVideo.pause();}).catch(()=>{});
      }
    }
    if(p>.25&&!aligned){
      aligned=true;
      // Reset only after the original artwork is fully hidden, for a matching return.
      try{heroVideo.currentTime=0;}catch{/* Retain its current composed frame. */}
    }else if(p===0)aligned=false;
    root.style.pointerEvents=p>=.9?'auto':'none';
  }

  return {video,layer,share,duration,measure,update,
    start(){return Math.max(0,hero.offsetHeight-(narrow.matches?root.querySelector('.story-stage').clientHeight:innerHeight));},
    dispose(){disposed=true;wrapper.classList.remove('is-connected');wrapper.style.removeProperty('--hero-height');hero.style.removeProperty('opacity');hero.style.removeProperty('pointer-events');root.style.removeProperty('pointer-events');for(const node of chrome)node.style.removeProperty('opacity');captions?.style.removeProperty('opacity');hero.inert=false;canvas.inert=false;delete hero.dataset.departed;}
  };
}
