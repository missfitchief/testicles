import test from 'node:test';
import assert from 'node:assert/strict';
import {mountMedia} from '../src/media.js';

class Node{
  constructor(){this.dataset={};this.listeners=new Map();}
  addEventListener(name,fn){const list=this.listeners.get(name)||[];list.push(fn);this.listeners.set(name,list);}
  removeEventListener(name,fn){this.listeners.set(name,(this.listeners.get(name)||[]).filter(item=>item!==fn));}
  emit(name){for(const fn of this.listeners.get(name)||[])fn();}
  setAttribute(name,value){this[name]=value;}
}
class Movie extends Node{
  constructor(name){super();this.dataset={wide:`/${name}-2k.mp4`,phone:`/${name}-phone-2k.mp4`};this.paused=true;this.src='';this.pending=[];this.playbackRate=1;}
  getAttribute(name){return this[name]||null;}
  removeAttribute(name){this[name]='';}
  load(){}
  pause(){this.paused=true;}
  play(){return new Promise(resolve=>this.pending.push(()=>{this.paused=false;this.emit('playing');resolve();}));}
  settle(){for(const fn of this.pending.splice(0))fn();}
}
function fixture(){
  const doc=new Node();doc.hidden=false;const phone=new Node();phone.matches=false;
  const chapters=Array.from({length:4},(_,i)=>{const node=new Node();node.dataset.scene=`scene${i}`;node.action=new Movie(`${i}-action`);node.idle=new Movie(`${i}-idle`);node.surface=new Node();node.querySelector=s=>s==='.action-film'?node.action:s==='.idle-film'?node.idle:node.surface;return node;});
  const controller=mountMedia(chapters,{phone,document:doc});
  return {chapters,controller,doc,phone};
}
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
test('fast forward and backward selection cannot leave stale play requests running',async()=>{
  const f=fixture();for(const i of [0,1,3,2,0,3])f.controller.select(i);
  for(const chapter of f.chapters)chapter.action.settle();await flush();
  assert.equal(f.chapters.filter(c=>!c.action.paused).length,1);assert(!f.chapters[3].action.paused);f.controller.dispose();
});
test('a hidden tab pauses everything and resumes only its current chapter',async()=>{
  const f=fixture();f.controller.select(2);f.chapters[2].action.settle();await flush();
  f.doc.hidden=true;f.doc.emit('visibilitychange');assert(f.chapters.every(c=>c.action.paused&&c.idle.paused));
  f.doc.hidden=false;f.doc.emit('visibilitychange');f.chapters[2].action.settle();await flush();assert(!f.chapters[2].action.paused);f.controller.dispose();
});
test('finished action hands off to a matching idle without simultaneous playback',async()=>{
  const f=fixture();f.controller.select(1);const chapter=f.chapters[1];chapter.action.settle();await flush();chapter.action.pause();chapter.action.emit('ended');chapter.idle.settle();await flush();
  assert(chapter.action.paused);assert(!chapter.idle.paused);assert.equal(chapter.surface.dataset.ready,'idle');f.controller.dispose();
});
test('responsive changes choose the phone file and keep native playback speed',async()=>{
  const f=fixture();f.controller.select(1);f.phone.matches=true;f.phone.emit('change');f.chapters[1].action.settle();await flush();
  assert.equal(f.chapters[1].action.src,'/1-action-phone-2k.mp4');assert.equal(f.chapters[1].action.playbackRate,1);f.controller.dispose();
});
test('errors retain the still image and teardown stops late playback',async()=>{
  const f=fixture();f.controller.select(1);f.chapters[1].action.emit('error');assert.equal(f.chapters[1].surface.dataset.ready,undefined);
  f.controller.select(2);f.controller.dispose();f.chapters[2].action.settle();await flush();assert(f.chapters.every(c=>c.action.paused&&c.idle.paused));
});
