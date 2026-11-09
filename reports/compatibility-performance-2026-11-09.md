# Desktop compatibility performance — 9 November 2026

The compatibility renderer previously scrubbed an HTML video element. It serialized asynchronous media seeks, so fast scrolling could leave the picture behind the scroll position even while the main thread remained responsive. A fresh public baseline recorded a 289ms moving-picture age with no long JavaScript tasks. This was a frame-delivery bottleneck, not evidence that the monitor resolution was the cause.

## Changes

- Added a direct image-frame renderer for desktop browsers without the preferred WebCodecs/OffscreenCanvas path. The same 1,405 story frames and 243 entrance frames are independently decodable, at the same 2560×1440 dimensions and 60fps timestamps.
- Decoding normally runs in a worker. Browsers that cannot create workers use the same coalescing decoder on the main thread. Browsers lacking ImageBitmap display already-decoded image elements directly; an initial implementation that copied those images through a 2D canvas was rejected after it produced 51–75ms tasks.
- Only one image decode can be in flight. New scroll positions replace obsolete targets, and frames from an abandoned direction are discarded. Worker presentation uses an acknowledgement before transferring another bitmap.
- Compressed data uses bounded caches: 128MiB of parts per active sequence plus at most 48 individual urgent frames. Up to three nearby parts load at once. No unbounded decoded-frame cache or download-all loop is used.
- Kept the last good picture visible during startup, worker failure and ultimate native-video fallback. Network/decode failures have deadlines. Hidden/inactive work stops, and disposal cancels requests and releases bitmaps, workers and surfaces.
- Preserved the existing one-column entrance alpha mask and scroll geometry. No new blur, CSS image filter, camera move or transition was added.

A production-only validation failure in the first candidate exposed one additional cause: the existing image security policy blocks blob URLs. That made the no-ImageBitmap path fall back to native video and show a 352ms gap. The corrected decoder uses data-image URLs allowed by the existing policy; the security policy was not relaxed. The local production server now reproduces that policy, and the stress harness asserts that image surfaces really exist before accepting a compatibility result.

The preferred desktop H264 renderer is unchanged. The first-page code/media, entrance code, CSS and phone media match the protected hashes from before this change. Phone playback retains its original native-video route and creates no desktop worker/canvas.

## Quality

Compatibility JPEG frames were generated from the current approved desktop frame streams, not an older video. Their source hashes are recorded in source-assets/compatibility-images.json and checked against the source streams. No frame was resized, dropped, added or retimed. Seven representative comparisons measured RGB PSNR 43.08–44.18dB and luminance SSIM 0.9952–0.9965. These are high-quality compressed copies, not mathematically lossless pixels. The existing H264 and all phone/opening files were not recompressed.

The complete story was reviewed at 29 forward/backward checkpoints, all ready with visible content. The compatibility sequence retains the previously repaired background and interpolation frames.

## Repeatable verification

The production build is served by the same static server used for the local candidate. Tests use native compositor wheel input, rapid reversals and abrupt jumps. Performance numbers below are measured moving-picture age (time since the last delivered frame while visibly scrolling), separately from requestAnimationFrame cadence. This avoids calling a responsive JS loop proof that the actual picture is moving.

Local candidate results:

| Path | Viewport | Ready checkpoints | Largest moving-picture age | rAF p95 / max | Long tasks / errors |
|---|---|---:|---:|---:|---:|
| Old public native-video baseline | 2560×1440 | 13/13 | 289ms | 16.8 / 50ms | 0 / 0 |
| Direct-image worker | 2560×1440 | 13/13 | 29ms | 16.8 / 33.4ms | 0 / 0 |
| No WebCodecs or OffscreenCanvas | 5120×1440 | 19/19 | 34ms | 16.8 / 33.3ms | 0 / 0 |
| No worker | 2560×1440 | 19/19 | 27ms | 16.7 / 49.9ms | 0 / 0 |
| Preferred worker deliberately fails | 2560×1440 | 13/13 | 25ms | 16.7 / 33.4ms | 0 / 0 |
| No worker or ImageBitmap, production CSP applied | 2560×1440 | 13/13 | 46ms | 16.8 / 50ms | 0 / 0 |

Eight desktop/phone breakpoint cycles kept exactly two active workers and two canvases on desktop, zero on phone; listener counts stayed at 41 desktop / 45 phone. Main-thread heap settled near 1.7MB after GC. A separate active-worker stress test delivered 291 frames from 1,249 input updates over five seconds, confirming that input is coalesced rather than multiplying decode work.

The lifecycle test's high-rate sample immediately after simulated freezing was not used as a performance result: its background timer was throttled and the story was idle. The separate active-story run above avoids those confounders.

## Live verification

Published to the main website at 12:16:14 UTC. The public index and final index-CF2I29Sq.js bundle matched the built files byte for byte; the existing content-security policy remained unchanged. The following native-wheel runs tested the production renderer; only the DOM decoder changed between the initial four runs and the final run.

| Public path | Ready checkpoints | Largest moving-picture age | rAF p95 / max | Long tasks / errors |
|---|---:|---:|---:|---:|
| Chrome 5120×1440, no WebCodecs/OffscreenCanvas | 19/19 | 40ms | 16.8 / 33.4ms | 0 / 0 |
| Edge 2560×1440, no workers | 19/19 | 33ms | 16.7 / 50.0ms | 0 / 0 |
| Chrome 2560×1440, normal renderer | 13/13 | 31ms | 16.8 / 33.4ms | 0 / 0 |
| Chrome entrance, no WebCodecs/OffscreenCanvas | 15/15 | 24ms | 16.8 / 33.4ms | 0 / 0 |
| Edge 2560×1440, no workers or ImageBitmap, final public bundle | 19/19 | 49ms | 16.8 / 50.1ms | 0 / 0 |

A separate 16-second Chrome Performance recording of the public image-worker path delivered 910 story frames with zero media seeks and no main-thread long tasks. Its rAF p95 was 16.8ms and maximum 33.3ms. The trace had three layout events (maximum 0.325ms), not continuous layout thrashing; script time was 0.964 seconds over the recorded interval. It recorded two dropped-frame markers among 981 BeginFrame events, with no missing-content, checkerboarding or high-latency flags. These are measured isolated frame misses, not a claim of zero dropped frames.

The final legacy run confirmed two DIV image surfaces, no native video source, no startup/security-policy errors and no moving-frame age above 60ms. Across the public runs, all 85 checkpoints reached a ready state. No desktop blank checkpoint or sustained freeze was observed. The recorded Chrome trace still contains the two isolated dropped-frame markers described above.

The actual public desktop opening, trousers scene and ending were inspected, along with the phone opening and ending. The phone still uses its original 2048×2048 native film and has zero desktop canvases. All 12 protected first-page, phone, CSS and preferred-worker hashes still match. The 34 focused tests and connected-media checks pass. No service restart, proxy change, new dependency or paid generation was required.

### Files changed

| File | Purpose |
|---|---|
| src/image-sequence.js | Bounded compressed cache, latest-target decoding, reversal/visibility handling |
| src/image-worker.js | Off-main-thread image decoding and presentation acknowledgement |
| src/compatibility-player.js | Canvas/DOM presentation, data-URI CSP support, fallback cleanup |
| src/story.js and src/independent-player.js | Automatic compatibility selection and decoder-failure handoff |
| scripts/prepare-compatibility-images.mjs | Reproducible full-resolution compatibility media |
| scripts/serve-production.mjs and scripts/stress-scroll.mjs | Matching local CSP and verifying the actual renderer, including startup errors |
| tests/image-sequence.test.mjs and tests/compatibility-player.test.mjs | Coalescing, reversal, disposal, timeout, mask and legacy-path regressions |

![Final compatibility renderer on the public website](compatibility-public.png)

## Limits

The test host uses Microsoft software graphics. Capability-disabled tests exercise fallback routes in modern Chromium, not every historical browser or physical phone. No tested route is a universal zero-stutter guarantee for arbitrary hardware or network conditions. Slow networks, failed image decoding and unsupported canvas APIs can ultimately fall back to native video; that final failure path is bounded but cannot promise the same timing. Compatibility images cost more transfer than the preferred H264 stream (about 180.2MB for the entire story, requested in nearby parts with caching). They are only fetched when the compatibility path is needed.

Raw evidence: .project-state/performance-investigation/compatibility-* and .project-state/compatibility/. Browser profiles and traces are diagnostic artifacts, not shipped assets.
