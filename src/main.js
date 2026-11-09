import './style.css';
import './story.css';
import {gsap} from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import {mountStory} from './story.js';
gsap.registerPlugin(ScrollTrigger);

const CONTRACT=document.querySelector('[data-contract]').dataset.contract;
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const narrow=matchMedia('(max-width: 700px)');
let toastTimer,toast=document.querySelector('#toast');
const notify=(message)=>{toast.textContent=message;toast.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('visible'),2600);};

for(const button of document.querySelectorAll('[data-copy-contract]')) button.addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(CONTRACT);notify('Contract copied. The right pair.');}
  catch{const el=document.createElement('textarea');el.value=CONTRACT;el.style.cssText='position:fixed;top:-1000px';document.body.append(el);el.select();const ok=document.execCommand('copy');el.remove();notify(ok?'Contract copied. The right pair.':'Copy failed. Please try again.');}
});

const stages=[...document.querySelectorAll('[data-video-stage]')];
const active=new Set();
function speed(video){video.playbackRate=reduce.matches ? .55 : 1;}
function play(stage){if(stage.closest('.hero')?.dataset.departed==='true')return;const video=stage.querySelector('video');video.muted=true;video.defaultMuted=true;video.playsInline=true;if(!video.src){video.src=(narrow.matches&&video.dataset.mobileSrc)?video.dataset.mobileSrc:video.dataset.src;video.load();}speed(video);video.play().then(()=>{if(!active.has(stage)||document.hidden||stage.closest('.hero')?.dataset.departed==='true')video.pause();}).catch(()=>{});}
const io=new IntersectionObserver(entries=>{for(const e of entries){const v=e.target.querySelector('video');if(e.isIntersecting){active.add(e.target);if(!document.hidden)play(e.target);}else{active.delete(e.target);v.pause();}}},{rootMargin:'100px',threshold:.02});
for(const stage of stages){const video=stage.querySelector('video');video.addEventListener('playing',()=>stage.classList.add('video-ready'));video.addEventListener('error',()=>stage.classList.remove('video-ready'));io.observe(stage);}
document.addEventListener('visibilitychange',()=>{for(const stage of active)document.hidden?stage.querySelector('video').pause():play(stage);});
reduce.addEventListener('change',()=>{for(const stage of stages)speed(stage.querySelector('video'));});
narrow.addEventListener('change',()=>{for(const stage of stages){const video=stage.querySelector('video');video.pause();video.removeAttribute('src');stage.classList.remove('video-ready');if(active.has(stage)&&!document.hidden)play(stage);}});

const motionMedia=gsap.matchMedia();
document.fonts.ready.then(()=>{
  motionMedia.add('(prefers-reduced-motion: no-preference)',()=>{
    gsap.from('.hero h1',{opacity:0,duration:1.1,ease:'power3.out'});
    gsap.from('.hero-intro',{y:15,opacity:0,duration:.7,delay:.18,ease:'power3.out'});
  });
  motionMedia.add('(min-width: 701px) and (prefers-reduced-motion: no-preference)',()=>{
    // The connected departure owns this camera movement; do not stack the old parallax over it.
    if(document.querySelector('.connected-experience.is-connected'))return;
    gsap.to('.hero h1',{y:-70,ease:'none',scrollTrigger:{trigger:'.hero',start:'top top',end:'bottom top',scrub:1}});
    gsap.to('.hero-art',{y:40,scale:1.035,ease:'none',scrollTrigger:{trigger:'.hero',start:'top top',end:'bottom top',scrub:1}});
  });
});

const stories=[...document.querySelectorAll('.story')].map(root=>mountStory(root,reduce,narrow,gsap,ScrollTrigger));
window.addEventListener('pagehide',event=>{if(event.persisted){for(const stage of active)stage.querySelector('video').pause();return;}for(const story of stories)story.dispose();motionMedia.revert();io.disconnect();clearTimeout(toastTimer);});
window.addEventListener('pageshow',event=>{if(event.persisted){for(const stage of active)if(!document.hidden)play(stage);}});
