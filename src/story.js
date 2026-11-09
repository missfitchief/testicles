import { createEntrance } from './entry.js';
import { createScrollVideo } from './scroll-video.js';
import { createIndependentPlayer } from './independent-player.js';
const clamp = value => Math.max(0, Math.min(1, value));

/** The approved connected stage, with one native decoder per shot. */
export function mountStory(root, reduce, narrow, gsap, ScrollTrigger) {
  const media = root.querySelector('.journey-media');
  const film = media.querySelector('.journey-film');
  const idle = media.querySelector('.journey-idle');
  const captions = [...root.querySelectorAll('[data-beat-start]')];
  const dialogue = [...root.querySelectorAll('[data-dialogue-at]')];
  const anchors = [...root.querySelectorAll('[data-anchor-time]')];
  const duration = Number(root.dataset.duration);
  const entrance = createEntrance(root, narrow, duration, reduce);
  const share = entrance.share, span = .985;
  const at = seconds => share + (1 - share) * span * seconds / duration;
  const listeners = [], captionState = new WeakMap();
  let players, disposed = false, visible = true, overall = 0, progress = 0;
  let context, timeline, idleReady = false, idleRevision = 0;
  function listen(node, event, fn) { node.addEventListener(event, fn); listeners.push(() => node.removeEventListener(event, fn)); }
  function updateEntrance() {
    if (overall === 0) { entrance.update(0); return; }
    const entryEnd = players?.entry.duration - 1 / (narrow.matches ? 24 : 60);
    if (!players?.entry.ready || !(entryEnd > 0)) { entrance.update(0); return; }
    // Switch surfaces only after the matching final entrance frame is decoded.
    const p = clamp(players.entry.currentTime / entryEnd);
    entrance.update(p > .997 && overall >= share && players.story.ready ? overall : p * share);
  }
  function showStory(time) {
    media.dataset.ready = 'true';
    if (progress < .98) media.dataset.phase = 'action';
    updateEntrance();
    if (progress >= span && Math.abs(time - (players.story.duration - 1 / (narrow.matches ? 24 : 60))) < .08) playIdle();
  }
  function load() {
    players?.entry.dispose(); players?.story.dispose();
    idleRevision++; idle.pause(); idle.removeAttribute('src'); idle.load(); idleReady = false;
    media.dataset.ready = 'false'; media.dataset.phase = 'action'; entrance.layer.dataset.ready = 'false';
    const source = video => (narrow.matches && video.dataset.mobileSrc) || (!narrow.matches && video.dataset.desktopSrc) || video.dataset.src;
    const independent = !narrow.matches && typeof VideoDecoder !== 'undefined' && 'transferControlToOffscreen' in HTMLCanvasElement.prototype;
    players = {
      entry: independent ? createIndependentPlayer(entrance.video,{manifest:'/assets/scroll-frames-v2/entry/manifest.json',source:source(entrance.video),count:243,onReady:sync,onFrame:()=>{entrance.layer.dataset.ready='true';updateEntrance();}}) : createScrollVideo(entrance.video, { source: source(entrance.video), fps: narrow.matches ? 24 : 60, onFrame: () => { entrance.layer.dataset.ready = 'true'; updateEntrance(); } }),
      story: independent ? createIndependentPlayer(film,{manifest:'/assets/scroll-frames-v2/story/manifest.json',source:source(film),count:1405,onReady:sync,onFrame:showStory}) : createScrollVideo(film, { source: source(film), fps: narrow.matches ? 24 : 60, onFrame: showStory }),
    };
    sync();
  }
  function playIdle() {
    if (disposed || document.hidden || !visible || progress < span) return;
    if (!idle.getAttribute('src')) { idle.src = (narrow.matches && idle.dataset.mobileSrc) || idle.dataset.src; idle.preload = 'auto'; idle.load(); }
    const revision = idleRevision;
    if (idle.paused) idle.play().then(() => { if (disposed || revision !== idleRevision || progress < span || document.hidden || !visible) idle.pause(); }).catch(() => {});
  }
  function sync() {
    if (!players) return;
    const running = !disposed && visible && !document.hidden;
    if (progress < span) idleReady = false;
    players.entry.setTime(clamp(overall / share) * Math.max(0, players.entry.duration - 1 / (narrow.matches ? 24 : 60)));
    players.story.setTime(clamp(progress / span) * Math.max(0, players.story.duration - 1 / (narrow.matches ? 24 : 60)));
    // An active controller has no continuous loop. Keeping the entrance ready
    // lets an in-flight reversal finish and then reach the newest target.
    players.entry.setActive(running);
    players.story.setActive(running && overall >= share * .88 && !(progress >= span && idleReady));
    if (!running || progress < span) { idleRevision++; idle.pause(); media.dataset.phase = 'action'; }
    else if (players.story.ready && Math.abs(players.story.currentTime - (players.story.duration - 1 / (narrow.matches ? 24 : 60))) < .08) playIdle();
  }
  function update(value) {
    overall = clamp(value); progress = clamp((overall - share) / (1 - share));
    const seconds = clamp(progress / span) * duration;
    for (const caption of captions) {
      const active = overall >= share && seconds >= Number(caption.dataset.beatStart) && seconds < Number(caption.dataset.beatEnd ?? Infinity);
      if (captionState.get(caption) !== active) { captionState.set(caption, active); caption.inert = !active; caption.style.pointerEvents = active ? 'auto' : 'none'; caption.setAttribute('aria-hidden', String(!active)); }
    }
    if (overall === 0) entrance.update(0);
    sync(); updateEntrance();
  }
  function configure() {
    context?.revert(); entrance.measure();
    context = gsap.context(() => {
      const state = { value: 0 };
      gsap.set(captions, { opacity: 0, y: reduce.matches ? 0 : 14 });
      gsap.set(dialogue, { opacity: 0, y: reduce.matches ? 0 : 6 });
      timeline = gsap.timeline({ defaults: { ease: 'none' }, onUpdate: () => update(state.value), scrollTrigger: {
        trigger: root, start: () => `top top-=${entrance.start()}`, end: 'bottom bottom', scrub: reduce.matches ? .4 : narrow.matches ? .3 : .15,
        onRefreshInit: () => entrance.measure(), invalidateOnRefresh: true, onRefresh: () => update(state.value),
      } });
      timeline.to(state, { value: 1, duration: 1 }, 0);
      for (const caption of captions) {
        const start = Number(caption.dataset.beatStart), end = Number(caption.dataset.beatEnd ?? Infinity);
        if (start === 0) gsap.set(caption, { opacity: 1, y: 0 });
        else timeline.to(caption, { opacity: 1, y: 0, duration: .014, ease: 'sine.out' }, at(start));
        if (Number.isFinite(end)) timeline.to(caption, { opacity: 0, y: reduce.matches ? 0 : -10, duration: .014, ease: 'sine.inOut' }, at(end));
      }
      for (const line of dialogue) timeline.to(line, { opacity: 1, y: 0, duration: .012, ease: 'sine.out' }, at(Number(line.dataset.dialogueAt)));
    }, root);
    for (const anchor of anchors) { const p = at(Number(anchor.dataset.anchorTime)); anchor.style.top = `calc(${p * 100}% - ${p * 100}svh + ${(1 - p) * entrance.start()}px)`; }
    ScrollTrigger.refresh(); update(timeline?.progress() || 0);
  }
  listen(idle, 'playing', () => { if (progress >= span && visible && !document.hidden) { idleReady = true; media.dataset.phase = 'idle'; players.story.setActive(false); } else idle.pause(); });
  listen(film, 'loadedmetadata', sync);
  listen(entrance.video, 'loadedmetadata', sync);
  listen(document, 'visibilitychange', sync);
  listen(window, 'pagehide', () => { visible = false; sync(); });
  listen(window, 'pageshow', () => { visible = true; sync(); });
  listen(reduce, 'change', configure);
  listen(narrow, 'change', () => { load(); configure(); });
  const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, { threshold: 0 }); observer.observe(root);
  load(); configure();
  const followHash = () => { const anchor = anchors.find(node => `#${node.id || node.dataset.anchorAlias}` === location.hash); if (anchor) requestAnimationFrame(() => anchor.scrollIntoView({ behavior: 'instant' })); };
  listen(window, 'hashchange', followHash); followHash();
  return { dispose() { disposed = true; sync(); context.revert(); players.entry.dispose(); players.story.dispose(); idle.pause(); observer.disconnect(); entrance.dispose(); for (const remove of listeners) remove(); } };
}
