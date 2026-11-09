# Scroll story quality audit — 9 November 2026

The desktop story received a restrained sharpness pass and eight damaged interpolation frames were replaced with clean nearby poses. The first page, entrance film, phone films, layout, timing and scroll renderer remain unchanged. The release stays at 2560×1440 and 60fps.

## Findings and changes

| Before | After | Reason |
|---|---|---|
| Soft fine edges in the rendered desktop art | A 0.35-strength, luma-only 5×5 sharpening pass, baked into the media | Adds a little definition to hair, facial details and clothing without adding browser filters or changing the palette |
| Torn silhouettes in a few old optical-flow in-betweens | Eight affected frames use the closest clean pose | Removes the fragmented outlines during the man's entrance and the mascot's landing |
| Existing entrance and phone compositions | Byte-identical protected assets and unchanged animation code | Preserves the approved first page and phone motion |

The sharpness pass blends in over the first 0.75 seconds of the desktop story. Its first frame is the exact original encoded packet, preserving the entrance match. The ending loop receives the same light sharpening. The repaired dune from the prior release remains in place.

Affected interpolation frame mappings: 636→635, 637→638, 1161→1160, 1162→1163, 1164→1165, 1166→1165, 1167→1168 and 1169→1170. These are brief clean-pose holds inside the existing 60fps timing, not newly generated motion. No scene was removed, retimed or reframed.

The independently seekable stream is 115,679,293 bytes, 3.09% smaller than the preceding version and within the same 128MiB cache budget. Its 1,405-frame count, 2K dimensions and 60fps timestamps are unchanged. The native fallback keeps a maximum three-frame keyframe interval for seeking. The worker, GSAP timelines and scroll event handling are unchanged.

## Review scope

- Inspected a timed contact sheet of the complete entrance, slide, group, trousers and girl scenes, plus the ending loop.
- Decoded all 1,405 frames and checked for blank images. Examined the highest temporal-change frames separately; this exposed the interpolation damage that ordinary half-second sampling missed.
- Compared mild and stronger sharpening at full resolution. Chose the mild setting to preserve the existing soft lighting and avoid pronounced halos.
- Captured 29 browser checkpoints through the complete story in both directions. Repeated the review after correcting the damaged frames. All checkpoints reached the requested scene and ready state.
- Verified the first frame match and all eight corrected packet mappings. Protected asset hashes are recorded in `source-assets/desktop-clarity-preserved.json`.
- Production build, the existing 23 regression tests and the connected-media checks pass. The native fallback decodes without errors.

## Performance and publication

Published on [the main website](https://testicles.84.32.214.33.sslip.io/) at 11:53:44 UTC. Public JavaScript, frame manifest and a corrected frame were fetched and matched to the built files. The native fallback returned the expected 60,150,361-byte file. No service restart or proxy change was needed.

Each normal desktop run used twelve fast native-wheel legs with reversals and seven abrupt jumps:

| Public build | Ready checkpoints | Frame notifications | Largest moving-frame age | rAF p95 / max | Long tasks / JS errors |
|---|---:|---:|---:|---:|---:|
| Chrome, 5120×1440 | 19/19 | 1,202 | 35ms | 16.7 / 33.3ms | 0 / 0 |
| Edge, 2560×1440 | 19/19 | 1,190 | 50ms | 16.8 / 33.4ms | 0 / 0 |

No blank checkpoint or moving-frame age above 60ms was recorded in these runs. The worker path remained active in both browsers. The public phone inspection confirmed the original 2048×2048 film and no desktop canvases. Its temporary viewport was reset and the browser returned to the unchanged opening.

A forced native-video compatibility test also reached all 13 checkpoints, but retained slower seek delivery on this software-rendered host: 327ms maximum moving-frame age. The prior video reproduced a comparable 339ms maximum in a local baseline. This compatibility path is not as smooth as the normal Chrome/Edge worker path; it is a remaining limitation, not a resolved performance result. The fallback's original three-frame keyframe cadence was retained.

Update later on 9 November: this remaining compatibility seek bottleneck was replaced with direct 2K image-frame delivery. See [the compatibility performance report](compatibility-performance-2026-11-09.md) for the separate change and new production measurements.

Raw evidence lives in `.project-state/quality-audit/` and `.project-state/performance-investigation/quality-*`. The pre-release full-resolution frame review, final 29-point visual review, default-browser stress runs, forced fallback comparison and protected-file hashes are retained separately.

![Sharper desktop story on the live website](sharper-story-live.png)

The test host uses Microsoft's software graphics path. Results describe the measured routes in that environment; they are not a claim of perfect frame delivery on every device. The sharpening adds no runtime rendering pass, and the original motion blur during fast action remains part of the artwork.
