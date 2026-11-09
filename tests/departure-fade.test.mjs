import test from 'node:test';
import assert from 'node:assert/strict';
import { createDepartureFade } from '../src/departure-fade.js';

function fixture(matches=false) {
  const children=[], narrow={matches};
  const hero={style:{},append(node){children.push(node);},ownerDocument:{createElement(){return {style:{},setAttribute(){},remove(){children.splice(children.indexOf(this),1);}};}}};
  return {hero,narrow,children,fade:createDepartureFade(hero,narrow)};
}

test('desktop keeps the opening opaque and reuses one cover through reversals',()=>{
  const {hero,children,fade}=fixture();
  fade.setOpacity(1);assert.equal(hero.style.opacity,'1');assert.equal(children[0].style.opacity,'0');
  const cover=children[0];fade.setOpacity(.2);fade.setOpacity(.8);
  assert.equal(children.length,1);assert.equal(children[0],cover);
  assert(Math.abs(Number(cover.style.opacity)-.2)<1e-10);
  fade.dispose();assert.equal(children.length,0);
});

test('phone preserves the original opacity path without creating a cover',()=>{
  const {hero,children,fade}=fixture(true);
  fade.setOpacity(.45);assert.equal(hero.style.opacity,'0.45');assert.equal(children.length,0);
  fade.setOpacity(1);assert.equal(hero.style.opacity,'1');assert.equal(children.length,0);
});

test('switching to the phone breakpoint removes the desktop cover',()=>{
  const {hero,narrow,children,fade}=fixture();
  fade.setOpacity(.4);assert.equal(children.length,1);
  narrow.matches=true;fade.setOpacity(.4);
  assert.equal(children.length,0);assert.equal(hero.style.opacity,'0.4');
  narrow.matches=false;fade.setOpacity(1);assert.equal(children.length,1);
  fade.dispose();fade.dispose();assert.equal(children.length,0);
});
