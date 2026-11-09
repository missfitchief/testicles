import fs from 'node:fs';
const root='.project-state/performance-investigation';
const read=name=>JSON.parse(fs.readFileSync(`${root}/${name}/measurements.json`,'utf8'));
const before=read('baseline-local-5120-r1'),small=read('baseline-local-1280-r1'),after=read('published-buffered-cold-5120'),warm=read('published-buffered-warm-5120');
const lifecycle=JSON.parse(fs.readFileSync(`${root}/lifecycle.json`,'utf8'));
const high=JSON.parse(fs.readFileSync(`${root}/highrate.json`,'utf8')).find(x=>x.highRateInput).highRateInput;
const row=(name,data)=>{const s=data.summary,m=s.media[1];return `| ${name} | ${(m.presented/s.seconds).toFixed(1)} | ${m.presentationIntervals.p50.toFixed(1)} ms | ${m.presentationIntervals.p95.toFixed(1)} ms | ${m.presentationIntervals.max.toFixed(1)} ms | ${s.metrics.ProcessTime.toFixed(2)} s |`;};
const reduction=(1-warm.summary.metrics.ProcessTime/before.summary.metrics.ProcessTime)*100;
const doc=`# Desktop animation performance investigation

Date: 2026-11-09. Project: Testicles. Production: https://testicles-xi.vercel.app/ and https://testicles.84.32.214.33.sslip.io/.

## Findings

The principal measured bottleneck was desktop frame delivery through repeated HTML video seeks. It was not an oversized React component, a runaway GSAP timeline, a per-frame layout loop, or a WebGL shader. Shrinking the desktop viewport did not change the selected 2560×1440, 60fps source or its decoder work.

The original desktop path repeatedly set currentTime, waited for seeked, and started another seek. In the 5120×1440 baseline, Chrome decoded about 2,975 video frames but presented only 642 new source images during the 18-second motion test. That is roughly 4.6 decoded frames per visible update. The main page continued ticking at around 60Hz while the character updated at about 36Hz. This explains why an apparently healthy requestAnimationFrame counter did not prove smooth character animation.

A second bottleneck appeared only when testing the public deployment with a cold browser cache: obtaining an urgent frame from a large ranged CDN object could produce a long pause. Urgent frames now have their own small objects; larger objects are used only for background preloading. Obsolete background preloads are cancelled on reversals, while the current frame request is allowed to finish to avoid starvation.

## Test environment and limits

Tests used installed Google Chrome 156.0.8078.80 with real Chrome DevTools Protocol Performance traces, CPU profiles, media events and frame-presentation measurements. The original live production build was measured before changes, and its compiled files were preserved for controlled local before/after tests. The final public build was then tested again. Vite development mode and Lighthouse scores were not used as performance evidence.

The available machine is the Windows hosting server, not the owner's G9 workstation. Chrome reported Microsoft Basic Render Driver / ANGLE D3D11 WARP, software compositing, software video decoding and no hardware video decoder. These are therefore software-rendered Chrome measurements, not proof of performance on a particular NVIDIA/AMD/Intel GPU. The virtual browser display runs around 60Hz; the separate high-rate input test is not a physical 240Hz display measurement.

## Repeatable benchmark

Each main run used the same 18-second route, with eight forward/reverse legs through the connected story. Browser viewport, source media and timing were fixed. Baseline runs were captured at 1280×900 and 5120×1440. Several candidate runs were repeated at both widths. Chrome traces include main-thread work, media threads, compositor frames, layout, painting and worker work. Video frame callbacks measured actual delivered source images before the change; worker frame commits and Chrome compositor traces measured the replacement.

The cold test clears the browser cache; it does not claim to clear every geographic CDN edge. Frame gaps include first-use and final settling. They are not all dropped compositor frames, and an inactive chapter's intentional held image is not counted as a moving-scene freeze.

| Main story run | Source frame updates / s | Median frame interval | p95 interval | Largest observed gap | Renderer CPU time* |
|---|---:|---:|---:|---:|---:|
${row('Baseline, 1280×900',small)}
${row('Baseline, 5120×1440',before)}
${row('Final public build, 5120×1440, cold browser cache',after)}
${row('Final public build, 5120×1440, warm repeat',warm)}

*CPU time is renderer-process CPU-seconds across the profiling interval, including capture overhead; it is not a percentage or a physical GPU utilization reading. The warm final run used about ${reduction.toFixed(0)}% less renderer CPU time than the matching baseline. Exact distributions, all samples and traces are retained with the report.

Earlier repeat tests of the same independent-frame core produced approximately 56–59 source updates per second, with p95 intervals around 19–21ms. A file marked 60fps is not a promise that every screen refresh receives a new image. The measured values above take precedence over the media metadata.

## Main thread, GSAP and GPU inspection

- The baseline has no React runtime and no React rerender loop. The production package contains GSAP/ScrollTrigger and the site's own modules.
- A single connected-story timeline owns progress and captions. Its context is reverted before a breakpoint rebuild. There are no competing independent timelines writing the same scene camera.
- Entrance geometry is measured during setup/refresh, not on every animation frame. The matched baseline trace contained five layout events totaling about 0.97ms, with the largest around 0.40ms. There was no costly forced-layout loop capable of explaining the sustained 30–35ms character cadence.
- The baseline main-thread JavaScript total was about 0.90 CPU-seconds during the profiling interval. Much more work occurred in the media pipeline. PerformanceObserver did not report application long tasks during the main benchmark.
- Compositor dropped-frame markers and occasional startup hitches were not universally zero. They are preserved in the raw recordings rather than hidden by a single average. A healthy main-thread frame rate was explicitly separated from the character-frame rate.
- In the matched 5120 traces, compositor dropped-frame markers were 10 before, 14 in the final cold run and 13 in the final warm run, across roughly 1,070 compositor draws. That metric did not improve; the large improvement is the number and cadence of new character frames. This is why the result is not described as universally frame-perfect.
- There was no application WebGL renderer or shader compilation path in the baseline. The replacement uses worker-owned 2D OffscreenCanvas surfaces, with no pixel readback and no custom WebGL shader. Browser-level compositing and texture allocation still exist.

## Code and delivery changes

1. **src/independent-worker.js:** decode one independently coded H.264 frame at a time. Close every VideoFrame immediately after drawing. Keep only the newest requested position, cap work at the source's 60fps, and keep compressed storage bounded. This avoids native seek flushing and retained decoder surfaces.
2. **src/independent-player.js:** own exactly one worker/surface per desktop shot. Clean up on replacement and disposal. If initialization or decoding fails, switch to the existing native player while keeping the last good image until its matching replacement is decoded.
3. **src/story.js:** select the desktop worker path only where supported. Preserve the original native phone path, caption timing, scroll mapping and idle behavior. Both paths share the original story state.
4. **src/entry.js:** mirror the existing entrance transform onto its prepared surface. Camera geometry and the first page are unchanged. The first frame is prepared before entry to reduce first-use allocation work.
5. **Desktop assets:** keep 2560×1440, 60fps and every original frame. Encode independent frames, split bulk data on frame boundaries, and serve small urgent-frame objects separately from bulk preloading. A reversal aborts obsolete preloading, not every unfinished useful frame.
6. **Verification tooling:** add reproducible Chrome profiling, trace analysis, lifecycle auditing, asset validation and decoder/fallback tests.

## Lifecycle and memory checks

Eight phone/desktop round trips kept the visible DOM at 87 nodes on phone and 89 on desktop. Registered event listeners remained at 45 and 41 respectively. Live desktop workers returned to two; phone returned to zero. Main-thread heap after forced collection remained around 1.3–1.7MB across the test. This found no accumulating listeners or renderer instances; it is not a claim that every browser's long-term GPU memory behavior was measured.

The synthetic high-rate test sent ${high.inputEvents} requests in ${(high.durationMs/1000).toFixed(1)} seconds and committed ${high.frameUpdates} frames, about ${(high.frameUpdates*1000/high.durationMs).toFixed(1)} per second. Input frequency therefore does not multiply decode work to the monitor's refresh rate. Nine unit tests cover latest-target behavior, hidden/inactive work, teardown, fallback and retaining the last good picture.

## Visual quality and unchanged behavior

The first-page media, original CSS, text, links, full-body actions and connected scene order are retained. Phone media and its native player are unchanged by this repair. Desktop remains 2K and 60fps. Full-film SSIM against the prior desktop masters is 0.998276 for the story and 0.999155 for the entrance. These are high-similarity re-encodings, not claims of mathematically lossless conversion or new native-2K artwork.

## Remaining limits

The new path removes the confirmed desktop seek bottleneck and substantially improves measured frame consistency. It does not justify a claim of zero hitches on every computer, browser, refresh rate or connection. First-use network and compositor work can still produce isolated gaps; see the cold-run maximum above. The owner's actual GPU/driver and physical G9 refresh behavior were not accessible in this session. The compatibility fallback retains functionality, but does not promise the same frame rate as supported worker decoding.

## Evidence and reproduction

- Before: .project-state/performance-investigation/baseline-local-5120-r1/trace.json and cpu.cpuprofile.
- Final cold: .project-state/performance-investigation/published-buffered-cold-5120/trace.json and cpu.cpuprofile.
- Final warm: .project-state/performance-investigation/published-buffered-warm-5120/trace.json and cpu.cpuprofile.
- All frame samples: each run's measurements.json. Lifecycle: lifecycle.json. High-rate input: highrate.json.
- Start the isolated Chrome profiling session on loopback port 9339, then run node scripts/profile-production.mjs --url=https://testicles-xi.vercel.app/ --label=repeat --width=5120 --height=1440 --seconds=18. Add --cold=yes to clear the browser cache. Use --route=entrance for the opening handoff.
- Run node scripts/analyze-profile.mjs <run-directory> --quiet to extract trace statistics. The raw trace can be loaded in Chrome's Performance panel. The capture uses the official [Chrome DevTools tracing protocol](https://chromedevtools.github.io/devtools-protocol/tot/Tracing/).
- npm test, npm run build and npm run check verify the implementation and 2K asset contract; these checks supplement, and do not replace, browser profiling.
`;
fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/desktop-animation-performance-2026-11-09.md',doc);console.log('Wrote performance report.');
