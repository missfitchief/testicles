# Asset provenance

All artwork and films come from the existing authorized Testicles Higgsfield project, preserved at `C:/Users/akki/Documents/ChatGPT/sajtovi/testicles/source-assets` and its original `ASSETS.md` and credit ledger. No new generation or credit purchase was made. Cumulative project spending remains 398.75 of 400 authorized credits.

The original generated images are 2688 × 1520 and converted to quality-96 WebP without resizing. The hero video is byte-identical to the previously approved 2560 × 1440 file. Story footage uses the existing 2560 × 1440 desktop and 2048 × 2048 phone masters, encoded at CRF 17 and the original 24fps. These masters include enhanced lower-resolution generation; they are not new native-2K renders.

`scripts/prepare-media.mjs` contains the exact source files, chapter boundaries and encoding settings. The action-to-idle transition starts at the action's final pose; idle loops reverse and return across the original tail. No generated intermediate frames or lower-resolution substitution are introduced.

Fonts: Albert Sans, SIL Open Font License via `@fontsource-variable/albert-sans`. Motion: GSAP and ScrollTrigger. All runtime assets are served with the site.
