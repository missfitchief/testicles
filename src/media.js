export function mountMedia(
  chapters,
  { phone, document: doc = globalThis.document } = {},
) {
  let selected = -1,
    disposed = false;
  const states = chapters.map((chapter) => ({
    chapter,
    surface: chapter.querySelector(".media-surface"),
    action: chapter.querySelector(".action-film"),
    idle: chapter.querySelector(".idle-film"),
    phase: "action",
    failed: false,
  }));
  const listeners = [];
  const listen = (node, name, callback) => {
    node.addEventListener(name, callback);
    listeners.push(() => node.removeEventListener(name, callback));
  };
  const source = (video) =>
    phone.matches && video.dataset.phone
      ? video.dataset.phone
      : video.dataset.wide;
  function load(video) {
    if (video && !video.getAttribute("src")) {
      video.src = source(video);
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.load();
    }
  }
  function pauseAll() {
    for (const state of states) {
      state.action?.pause();
      state.idle?.pause();
    }
  }
  function play(state) {
    if (disposed || doc.hidden || state.failed) return;
    const video = state.phase === "idle" ? state.idle : state.action;
    if (!video) return;
    load(video);
    video
      .play()
      .then(() => {
        if (
          disposed ||
          doc.hidden ||
          states[selected] !== state ||
          (state.phase === "idle" ? state.idle : state.action) !== video
        )
          video.pause();
      })
      .catch(() => {});
  }
  function select(index) {
    if (disposed || index < 0 || index >= states.length) return;
    if (index !== selected) {
      pauseAll();
      selected = index;
    }
    play(states[index]);
    for (let i = 0; i < states.length; i++)
      if (Math.abs(i - index) > 1) {
        const state = states[i];
        for (const video of [state.action, state.idle])
          if (video?.getAttribute("src")) {
            video.removeAttribute("src");
            video.load();
          }
        delete state.surface.dataset.ready;
      }
  }
  states.forEach((state) => {
    for (const [phase, video] of [
      ["action", state.action],
      ["idle", state.idle],
    ])
      if (video) {
        listen(video, "playing", () => {
          if (
            disposed ||
            doc.hidden ||
            states[selected] !== state ||
            state.phase !== phase
          ) {
            video.pause();
            return;
          }
          state.surface.dataset.ready = phase;
        });
        listen(video, "error", () => {
          if (!video.getAttribute("src")) return;
          state.failed = true;
          delete state.surface.dataset.ready;
        });
      }
    if (state.idle)
      listen(state.action, "ended", () => {
        state.phase = "idle";
        state.surface.dataset.phase = "idle";
        if (states[selected] === state) play(state);
      });
    if (state.chapter.dataset.captionAt)
      listen(state.action, "timeupdate", () => {
        const late =
          state.action.currentTime > Number(state.chapter.dataset.captionAt);
        if (state.chapter.dataset.late === String(late)) return;
        state.chapter.dataset.late = String(late);
        for (const node of state.chapter.querySelectorAll(".early-copy"))
          node.setAttribute("aria-hidden", String(late));
        for (const node of state.chapter.querySelectorAll(".late-copy"))
          node.setAttribute("aria-hidden", String(!late));
      });
  });
  listen(doc, "visibilitychange", () => {
    if (doc.hidden) pauseAll();
    else if (selected >= 0) play(states[selected]);
  });
  listen(phone, "change", () => {
    pauseAll();
    for (const state of states) {
      state.failed = false;
      delete state.surface.dataset.ready;
      for (const video of [state.action, state.idle])
        if (video) {
          video.removeAttribute("src");
          video.load();
        }
    }
    if (selected >= 0) play(states[selected]);
  });
  return {
    select,
    pause: pauseAll,
    resume() {
      if (selected >= 0) play(states[selected]);
    },
    dispose() {
      disposed = true;
      pauseAll();
      for (const remove of listeners) remove();
      for (const state of states)
        for (const video of [state.action, state.idle])
          if (video) {
            video.removeAttribute("src");
            video.load();
          }
    },
  };
}
