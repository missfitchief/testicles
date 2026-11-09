# Asset provenance

All artwork and films come from the existing authorized Testicles Higgsfield project, preserved at `C:/Users/akki/Documents/ChatGPT/sajtovi/testicles/source-assets` and its original `ASSETS.md` and credit ledger. No new generation or credit purchase was made. Cumulative project spending remains 398.75 of 400 authorized credits.

The opening, posters, entrance and desktop story use the preserved original assets. Desktop story footage is 2560 × 1440 at 60fps. The original hero remains byte-identical at 2560 × 1440. These masters include previously enhanced generation; they are not new native-2K renders.

The phone story is encoded from `../testicles/public/assets/story-continuous-clean-mobile-2k.mp4` without trimming, resizing or changing its 24fps timing: libx264, CRF 17, preset fast, GOP 2, no B frames, one reference frame, yuv420p and faststart. The full-film SSIM is 0.998148. This removes frame-reordering overhead without changing the original composition. The original final idle loops are retained. `scripts/prepare-media.mjs` belongs to the rejected panel version and is not used by this release.

Fonts: Albert Sans, SIL Open Font License via `@fontsource-variable/albert-sans`. Motion: GSAP and ScrollTrigger. All runtime assets are served with the site.

Desktop performance repair: the preserved 2560×1440 / 60fps entrance and story are re-encoded with libx264, CRF 18, preset fast, GOP 1, no B frames, one reference frame and yuv420p. Annex-B packets are split on frame boundaries into files no larger than 12 MiB. Story: 1,405 frames, SSIM 0.998276. Entrance: 243 frames, SSIM 0.999155. `scripts/prepare-desktop-decoder.mjs` and `scripts/package-intra.mjs` reproduce the assets. The original MP4s remain the compatibility fallback. No artwork, timings or camera frames are regenerated.

Delivery v2 also stores each compressed frame separately for urgent cold requests. Its manifests reference the existing bulk parts as background preloading, so a missing frame does not require a range from a large cold CDN object. Three directional bulk preloads are allowed, stale preloads abort, and compressed memory remains capped. These are alternative delivery forms of identical encoded bytes.
