# Desktop stutter follow-up

The remaining 95ms handoff issue was subsequently isolated and repaired; see [the mask-stall follow-up](95ms-mask-stall-2026-11-09.md). This document records the preceding build.

Date: 9 November 2026. Live build: `index-DufBAYER.js`, worker `independent-worker-DsZkhA56.js`. Deployment: `dpl_HsPKzFoYWCtuE6j21Z7trctiiM39`.

Published at [Vercel](https://testicles-xi.vercel.app/) and the [existing Windows host](https://testicles.84.32.214.33.sslip.io/). Both public endpoints returned the expected new bundle.

## Scope preserved

This release changes the desktop frame worker. The first-page markup, artwork, video, CSS, camera geometry, copy and controls remain unchanged. The phone player and its media remain unchanged. No media was re-encoded or regenerated in this release: desktop still uses the existing 2560×1440, 60fps frames, and the phone story still uses its existing 2048×2048, 24fps film.

## Confirmed defects and changes

**An obsolete network request could block a reversal.** Previously, the worker stayed busy awaiting its earlier requested frame, even if the newly requested position was already in a downloaded part. It now races the urgent download against usable buffered data. A reversal into buffered footage immediately selects that footage and cancels the obsolete request. Cancellation happens only when a usable replacement exists; continuous scrolling does not repeatedly cancel every download.

**The whole decode/display operation was serialized behind a flush promise.** The replacement allows at most two independently coded frames in flight, so decoding can overlap the current frame's display work. The newest position replaces obsolete intermediate targets. Every output frame is closed after use. A short drain guard handles decoder implementations that hold their last output; a 750ms watchdog prevents an unresponsive decoder from trapping the player.

**Late frames shifted the rate limiter's clock.** The old limiter restarted its interval from each actual submission. The new limiter keeps the source cadence with bounded timing credit. It can recover one late interval without creating an unbounded catch-up queue or running the film at the monitor's 120/240Hz refresh rate.

**The urgent fetch had no delivery deadline.** It now has a 2.5-second limit. A genuine failure enters the existing native fallback, which retains the last valid picture until the replacement reaches the requested position. Drawing failures are also caught and routed to fallback.

## Measurements

The controlled test is an 18-second route with eight forward/reverse legs at 5120×1440. It uses compiled production files, Chrome Performance traces, CPU profiles, source-frame notifications and compositor events. Each run also allows a short final settling interval. Update rates below are counts divided by the nominal route duration; frame-interval percentiles are the stronger pacing measure.

| Build / test | Source updates per second | Median interval | p95 interval | Largest recorded gap |
|---|---:|---:|---:|---:|
| Previously published build, local production snapshot | 52.9 | 18ms | 27ms | 101ms |
| Selected change, local production build | 59.9 | 17ms | 19ms | 100ms |
| Selected change, public production, cold browser cache | 58.2 | 17ms | 21ms | 95ms |

The public cold run had no reported main-thread long tasks. It recorded five layout operations totaling about 1.3ms in the trace, so a sustained forced-layout loop does not explain the remaining gaps. It still contained 10 compositor dropped-frame markers across 1,074 draws. The existing page has no React rerender loop or application WebGL shader pipeline.

Native wheel testing additionally exercised six rapid forward/reverse legs and seven abrupt position jumps. The final public Chrome run recorded no interval over 150ms without a new story frame during continuous movement, no JavaScript errors, and ready media at all checkpoints. Its median source-frame interval was 17ms and p95 was 22ms. Captured scene checkpoints contained the expected artwork rather than blank surfaces.

Wheel pacing varied between runs. The old local wheel run had a 20ms p95, while several local candidate repeats were 26–29ms; the final public run was 22ms. This is **not** evidence that every wheel-scroll interval improved. The reliable findings are the improved demanding scripted-route cadence and removal of the reproducible obsolete-download blocking condition. A successful build or a healthy requestAnimationFrame counter alone was not treated as proof.

## Verification

- Sixteen regression tests pass, including bounded in-flight work, rapid reversals, retargeting while an old download is stalled, source-rate limiting under 250Hz input, fetch/decoder deadlines, inactive work, teardown and fallback continuity.
- `npm run build` and `npm run check` pass. The visual/source checks compare the approved CSS, opening, camera geometry and media. They supplement the browser measurements.
- The phone-sized production test exercised the unchanged native path at 390×844 with continuous scripted forward/backward scrolling. It retained 2048×2048 video, zero desktop canvases, zero corrupted/dropped video frames reported by the browser, and no main-thread long tasks. This is browser emulation, not a physical iPhone/Android measurement.
- Microsoft Edge also completed the public native wheel/reversal test at 2560×1440 with all checkpoints ready, no JavaScript errors, no main-thread long tasks and no measured moving-scene stall above 150ms.
- Eight phone/desktop breakpoint round trips retained 87/89 rendered DOM nodes, 45/41 registered event listeners and 0/2 live desktop workers respectively. Main-thread heap after collection ranged from approximately 1.3MB to 1.7MB. A fresh high-rate input test sent 1,248 requests in five seconds and displayed 292 updates. The combined lifecycle run's synthetic freeze/resume tail was timer-throttled and is not used as a successful high-rate or background-resume measurement.
- A separate touch-gesture emulation attempt did not move the page and is not counted as successful touch verification. The scripted phone route and captured phone scene checkpoints are the relevant evidence.

## Rejected alternatives

Full decoder scheduling on worker requestAnimationFrame fell to approximately 31 source updates per second. Bitmap-renderer variants and presentation-only requestAnimationFrame variants also regressed the wheel test. Unconditionally flushing an overlapping pipeline and changing the canvas buffering hint were rejected. A native-video test remuxed the exact independent frames without re-encoding; it delivered fewer updates than the selected worker and was also rejected. None of these alternatives is in the published build.

## Limits and remaining evidence

The available test machine is the Windows hosting server. Chrome reports the Microsoft Basic Render Driver / ANGLE WARP software path, not a physical G9-connected consumer GPU. The monitor resolution was used as a test viewport, not assumed to be the cause. The public test still recorded an isolated 95ms gap. This release therefore must not be described as universally frame-perfect or as proof of zero stutters on every PC.

The earlier investigation remains in `reports/desktop-animation-performance-2026-11-09.md`. New raw traces, CPU profiles and frame samples are under `.project-state/performance-investigation/`:

- `stutter-base-local-5120`: unchanged production snapshot.
- `stutter-credit-local-5120`: selected local worker.
- `stutter-final-live-cold-5120`: published cold-cache Performance recording.
- `stutter-final-live-wheel-5120`: published native wheel/jump recording and scene PNGs.
- `stutter-final-live-phone-profile`: unchanged phone-path Performance recording.
- `stutter-final-edge-wheel-2560`: public Edge wheel test.
- `stutter-final-lifecycle.json` and `stutter-final-highrate.json`: lifecycle counts and the separate high-rate test.

Reproduce the desktop trace with `node scripts/profile-production.mjs --url=https://testicles-xi.vercel.app/ --label=repeat --width=5120 --height=1440 --seconds=18 --settle=6000 --cold=yes`. Run native wheel/jump checks with `node scripts/stress-scroll.mjs --url=https://testicles-xi.vercel.app/ --label=wheel-repeat --width=5120 --height=1440`. These commands use the isolated local debugging browser on port 9339; `--port` can select another isolated Chromium session.

## Captured production views

Desktop scene after rapid forward/backward input:

![Desktop production scene](stutter-desktop.png)

Phone-sized production scene, using the unchanged phone media:

![Phone production scene](stutter-phone.png)
