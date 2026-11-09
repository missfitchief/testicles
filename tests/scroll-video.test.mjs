import test from 'node:test';
import assert from 'node:assert/strict';
import { createScrollVideo } from '../src/scroll-video.js';
function fixture() {
  let value = 0, clock = 0, serial = 0;
  const listeners = new Map(), queue = new Map(), writes = [];
  const video = { readyState: 4, duration: 24, seeking: false,
    get currentTime() { return value; },
    set currentTime(next) { value = next; this.seeking = true; writes.push(next); },
    addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name) { listeners.delete(name); },
    load() {}, pause() {}, removeAttribute(name) { delete this[name]; },
  };
  const player = createScrollVideo(video, { source: '/movie.mp4', fps: 60, onFrame() {}, requestFrame: fn => { queue.set(++serial, fn); return serial; }, cancelFrame: id => queue.delete(id), now: () => clock });
  const flush = () => { const pending = [...queue.values()]; queue.clear(); pending.forEach(fn => fn()); };
  const finish = () => { clock += 12; video.seeking = false; listeners.get('seeked')?.(); };
  return { player, video, writes, flush, finish, listeners };
}
test('scroll reversals discard obsolete targets and permit one outstanding seek', () => {
  const f = fixture(); f.player.setActive(true); f.player.setTime(3); f.flush();
  for (const t of [12, 9, 17, 4]) { f.player.setTime(t); f.flush(); }
  assert.deepEqual(f.writes, [3]); f.finish(); f.flush(); assert.deepEqual(f.writes, [3, 4]);
  f.finish(); f.flush(); assert.equal(f.player.metrics.pending, false); assert.equal(f.player.currentTime, 4);
});
test('hidden state cancels scheduled work and resumes at latest position', () => {
  const f = fixture(); f.player.setActive(false); f.player.setTime(3); f.flush();
  f.player.setTime(14); f.flush(); assert.deepEqual(f.writes, []);
  f.player.setActive(true); f.flush(); assert.deepEqual(f.writes, [14]);
});
test('identical source frames do not cause repeated decoding', () => {
  const f = fixture(); f.player.setActive(true); f.player.setTime(3); f.flush(); f.finish(); f.flush();
  for (let i = 0; i < 30; i++) { f.player.setTime(3.001); f.flush(); }
  assert.deepEqual(f.writes, [3]);
});
test('large scroll jumps clamp to a valid frame at either boundary', () => {
  const f = fixture(); f.player.setActive(true); f.player.setTime(1000); f.flush();
  assert.equal(f.writes[0], 24 - 1 / 60); f.finish(); f.player.setTime(-10); f.flush(); assert.equal(f.writes[1], 0);
});
test('disposing cancels callbacks and removes the media source', () => {
  const f = fixture(); f.player.setTime(10); f.player.dispose(); f.player.setActive(true); f.flush();
  assert.deepEqual(f.writes, []); assert.equal(f.listeners.size, 0); assert.equal(f.video.src, undefined);
});
