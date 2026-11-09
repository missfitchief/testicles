# Testicles

A clean rebuild of the Testicles character website. The original mint palette, Albert Sans, oversized opening and four story beats are preserved.

`npm ci` installs dependencies. `npm run dev` serves port 5194. `npm test`, `npm run build` and `npm run check` validate the release.

## Motion

Normal page scrolling controls small transform/opacity transitions only. Native, muted, inline videos play the character actions at their original 24fps. There is no video scrubbing, variable playback speed, frame pipeline, canvas or decoder worker. Only the active chapter plays; hidden and distant media pause or unload. Each action ends in a matching idle loop. The 2K images remain visible while media loads or if playback fails.

All footage is delivered at 2560 × 1440 on desktop and 2048 × 2048 on portrait phones. The original hero video is preserved byte for byte. Existing Higgsfield artwork remains at its original generated dimensions, generally 2688 × 1520. These videos are the project's existing enhanced sources, not newly generated native 2K footage. No new Higgsfield credits were used.

## Hosting

The production target is the existing Testicles Vercel project and the dedicated Testicles release on the owner's Windows server. The build is self-contained, including all media; it has no rewrite dependency on another host. Previous source remains in the separate `testicles` directory for rollback.
