# Asset provenance

All artwork and films come from the existing authorized Testicles Higgsfield project, preserved at `C:/Users/akki/Documents/ChatGPT/sajtovi/testicles/source-assets` and its original `ASSETS.md` and credit ledger. No new generation or credit purchase was made. Cumulative project spending remains 398.75 of 400 authorized credits.

The opening, posters, entrance and desktop story use the preserved original assets. Desktop story footage is 2560 × 1440 at 60fps. The original hero remains byte-identical at 2560 × 1440. These masters include previously enhanced generation; they are not new native-2K renders.

The phone story is encoded from `../testicles/public/assets/story-continuous-clean-mobile-2k.mp4` without trimming, resizing or changing its 24fps timing: libx264, CRF 17, preset fast, GOP 2, no B frames, one reference frame, yuv420p and faststart. The full-film SSIM is 0.998148. This removes frame-reordering overhead without changing the original composition. The original final idle loops are retained. `scripts/prepare-media.mjs` belongs to the rejected panel version and is not used by this release.

Fonts: Albert Sans, SIL Open Font License via `@fontsource-variable/albert-sans`. Motion: GSAP and ScrollTrigger. All runtime assets are served with the site.
