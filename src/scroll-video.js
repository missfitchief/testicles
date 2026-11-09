/** A single browser decoder. Keep the latest scroll target, never queue old frames. */
export function createScrollVideo(video, { source, fps = 60, onFrame, onError = () => {}, now = () => performance.now() }) {
  let active = false, disposed = false, target = 0, seeking = false;
  let shown = -1, startedAt = 0, seeks = 0, maxSeekMs = 0;
  const removers = [];
  const listen = (event, callback) => { video.addEventListener(event, callback); removers.push(() => video.removeEventListener(event, callback)); };
  const end = () => Number.isFinite(video.duration) ? Math.max(0, video.duration - 1 / fps) : Infinity;
  const clamp = value => Math.min(end(), Math.max(0, Math.round(value * fps) / fps));
  function schedule() {
    // Input already arrives on GSAP's animation frame. A second RAF here adds
    // a full frame of delay to every native decoder completion.
    if (active && !disposed && !seeking && video.readyState >= 2) flush();
  }
  function present() {
    if (disposed || video.readyState < 2) return;
    const time = video.currentTime;
    if (time !== shown) { shown = time; onFrame(time); }
  }
  function flush() {
    if (!active || disposed || seeking || video.seeking || video.readyState < 2) return;
    target = clamp(target);
    if (Math.abs(video.currentTime - target) < .45 / fps) { present(); return; }
    seeking = true; startedAt = now(); seeks++;
    try { video.currentTime = target; } catch (error) { seeking = false; onError(error); }
  }
  listen('loadeddata', () => { present(); schedule(); });
  listen('canplay', schedule);
  listen('seeked', () => {
    if (seeking) maxSeekMs = Math.max(maxSeekMs, now() - startedAt);
    seeking = false; present(); schedule();
  });
  listen('error', () => { seeking = false; onError(video.error); });
  video.muted = true; video.defaultMuted = true; video.playsInline = true;
  video.preload = 'auto'; video.src = source; video.load();
  return {
    get ready() { return shown >= 0; },
    get currentTime() { return Math.max(0, shown); },
    get duration() { return Number.isFinite(video.duration) ? video.duration : 0; },
    get metrics() { return { target, shown, seeks, maxSeekMs, pending: seeking }; },
    setTime(time) { target = clamp(time); schedule(); },
    setActive(value) { active = value; if (active) schedule(); },
    dispose() { disposed = true; for (const remove of removers) remove(); video.pause(); video.removeAttribute('src'); video.load(); },
  };
}
