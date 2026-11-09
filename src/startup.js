import './startup.css';
import './style.css';
import './story.css';
import {gsap} from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';

const screen=document.getElementById('loading-screen');
const root=document.documentElement;
const warm=new Map(),blobs=new Map();let shown=0,finished=false,initialComplete=false;
const hero=document.querySelector('.hero video');
const narrow=matchMedia('(max-width:700px)').matches;
const blocked=[document.querySelector('header'),document.querySelector('main')].filter(Boolean);
let mainPromise;
const ensureMain=()=>mainPromise??=(import('./main.js'));
blocked.forEach(node=>node.inert=true);
gsap.globalTimeline.pause();

function update(value){
 const percent=Math.max(shown,Math.min(99,Math.floor(value*100)));if(percent===shown)return;shown=percent;
 screen.style.setProperty('--loaded',String(percent/100));screen.querySelector('.loading-percent').textContent=percent+'%';screen.querySelector('[role="progressbar"]').setAttribute('aria-valuenow',String(percent));document.dispatchEvent(new Event('testicles:load-progress'));
}
async function cacheMedia(url){
 const absolute=new URL(url,location.href).href;if(warm.has(absolute))return warm.get(absolute).promise;
 const state={loaded:0,total:1,done:false,promise:null,url:null};warm.set(absolute,state);
 state.promise=(async()=>{const response=await fetch(absolute,{cache:'force-cache'});if(!response.ok)throw Error('Media is unavailable');state.total=Number(response.headers.get('Content-Length'))||1;const reader=response.body.getReader(),chunks=[];for(;;){const {value,done}=await reader.read();if(done)break;state.loaded+=value.length;chunks.push(value);document.dispatchEvent(new Event('testicles:load-progress'));}if(state.total>1&&state.loaded!==state.total)throw Error('Incomplete media');state.url=URL.createObjectURL(new Blob(chunks,{type:'video/mp4'}));blobs.set(state.url,state);state.done=true;state.loaded=state.total;return state.url;})();
 return state.promise;
}
function mediaRatio(){const list=[...warm.values()];return list.length?list.reduce((n,s)=>n+(s.done?1:Math.min(.99,s.loaded/s.total)),0)/list.length:0;}
function completeVideo(video){return blobs.get(video.currentSrc)?.done&&video.readyState>=2;}
function frameRatio(video){
 if(video.dataset.mediaReady==='true')return 1;
 if(video.currentSrc){const state=blobs.get(video.currentSrc)||warm.get(video.currentSrc);return completeVideo(video)?1:Math.min(.98,(state?.loaded||0)/(state?.total||1));}
 return Math.min(.99,Number(video.dataset.mediaLoaded||0)/Math.max(1,Number(video.dataset.mediaTotal||0)));
}
function stopHero(){if(root.classList.contains('is-preparing')){hero.pause();try{hero.currentTime=0;}catch{}}}
async function reveal(){
 if(finished)return;finished=true;clearInterval(poll);document.dispatchEvent(new Event('testicles:load-complete'));
 screen.style.setProperty('--loaded','1');screen.querySelector('.loading-percent').textContent='100%';screen.querySelector('[role="progressbar"]').setAttribute('aria-valuenow','100');
 hero.removeEventListener('playing',stopHero);gsap.globalTimeline.resume();
 const rect=hero.getBoundingClientRect();if(rect.bottom>0&&rect.top<innerHeight)hero.play().catch(()=>{});
 screen.classList.add('is-leaving');
 await new Promise(resolve=>setTimeout(resolve,matchMedia('(prefers-reduced-motion:reduce)').matches?320:620));
 root.classList.remove('is-preparing');blocked.forEach(node=>node.inert=false);screen.remove();ScrollTrigger.refresh();
 const hash=decodeURIComponent(location.hash.slice(1));const anchor=hash&&(document.getElementById(hash)||document.querySelector(`[data-anchor-alias="${CSS.escape(hash)}"]`));if(anchor)anchor.scrollIntoView({behavior:'instant'});performance.mark('testicles:ready');
}
document.addEventListener('testicles:load-skipped',()=>{finished=true;clearInterval(poll);hero.removeEventListener('playing',stopHero);gsap.globalTimeline.resume();ensureMain().then(()=>hero.play().catch(()=>{}));},{once:true});
let poll=setInterval(()=>{
 if(finished)return;
 if(!initialComplete){update(mediaRatio()*.35);return;}
 const films=[...document.querySelectorAll('video.entry-film,video.journey-film')];
 for(const video of [...films,hero])if(video.currentSrc&&!blobs.has(video.currentSrc)&&!warm.has(video.currentSrc)){const original=video.currentSrc;cacheMedia(original).then(url=>{video.src=url;video.load();}).catch(fail);}
 const values=films.map(frameRatio);const artwork=[...document.querySelectorAll('.stage-poster,.entry-poster,.journey-poster')].every(img=>img.complete&&img.naturalWidth>0);
 const ready=films.length===2&&values.every(n=>n===1)&&[...warm.values()].every(s=>s.done)&&completeVideo(hero)&&completeVideo(document.querySelector('.journey-idle'))&&document.fonts.status==='loaded'&&artwork&&document.querySelector('.journey-media').dataset.ready==='true'&&document.querySelector('.entry-layer').dataset.ready==='true';
 update(.35+.6*(values.reduce((a,b)=>a+b,0)/2)+.04*(artwork?1:0));if(ready)reveal();
},80);
function fail(){screen.dataset.state='error';document.dispatchEvent(new Event('testicles:load-error'));}
async function start(){
 const idle=document.querySelector('.journey-idle');
 const sources=[hero.dataset.src,narrow?idle.dataset.mobileSrc:idle.dataset.src];
 if(narrow)sources.push(document.querySelector('.entry-film').dataset.src,document.querySelector('.journey-film').dataset.mobileSrc);
 await Promise.all(sources.map(cacheMedia));
 for(const video of document.querySelectorAll('video'))for(const key of ['src','desktopSrc','mobileSrc'])if(video.dataset[key]){const state=warm.get(new URL(video.dataset[key],location.href).href);if(state?.done)video.dataset[key]=state.url;}
 await ensureMain();
 hero.preload='auto';hero.addEventListener('playing',stopHero);stopHero();
 idle.preload='auto';idle.src=narrow?idle.dataset.mobileSrc:idle.dataset.src;idle.load();
 await Promise.all([...document.querySelectorAll('.stage-poster,.entry-poster,.journey-poster')].map(img=>{img.loading='eager';return img.decode?.().catch(()=>{});}));
 await document.fonts.ready;initialComplete=true;
}
start().catch(fail);
window.addEventListener('pagehide',event=>{if(!event.persisted)for(const url of blobs.keys())URL.revokeObjectURL(url);});
