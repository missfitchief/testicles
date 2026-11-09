# Testicles

A clean playback implementation under the original Testicles website. The approved layout, copy, opening and connected scroll story are restored.

`npm ci` installs dependencies. `npm run dev` serves port 5194. `npm test`, `npm run build` and `npm run check` validate the release.

## Motion

The original GSAP timeline controls the continuous journey. A native video decoder accepts one seek at a time, coalescing every new scroll input to the latest target instead of building a queue. There are no software frame packs, canvas transfers, reverse tracks or variable playback-rate loops. Only the final scene plays freely as an idle loop. Hidden tabs stop work.

Desktop story footage is 2560 × 1440 at 60fps; phone footage is 2048 × 2048 at 24fps. The original hero and desktop story are byte-identical. The phone story uses short two-frame groups without B-frame reordering for quicker seeking; its full-film SSIM against the original is 0.998148. No media is downscaled and no new Higgsfield credits are used. These are the existing enhanced sources, not newly generated native 2K footage.

## Hosting

The production target is the existing Testicles Vercel project and the dedicated Testicles release on the owner's Windows server. The build is self-contained, including all media; it has no rewrite dependency on another host. Previous source remains in the separate `testicles` directory for rollback.
