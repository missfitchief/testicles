# Testicles

A clean playback implementation under the original Testicles website. The approved layout, copy, opening and connected scroll story are restored.

`npm ci` installs dependencies. `npm run dev` serves port 5194. `npm test`, `npm run build` and `npm run check` validate the release.

## Motion

The original GSAP timeline controls the continuous journey. Desktop uses two worker-owned 2K canvases, one for the entrance and one for the story. Independently coded H.264 frames avoid native media seeking. Each worker decodes the latest requested frame and caps work at 60fps. Browsers without that path use independently decodable JPEG frames; the oldest compatibility path starts image decoding before the load event. Failed decoders retain a native-video fallback.

The animated startup screen waits for the selected story's complete compressed media, decoded opening frames, fonts and posters. Native videos use complete in-memory copies of the original files, so playback cannot outrun a partial network download. The first page and phone animation code are preserved; `src/startup.js` prepares the experience before revealing it. The loader has reduced-motion styling, a stalled-load recovery path and direct-section link restoration. Desktop compressed caches are bounded at 128MiB for H.264 and at most 192MiB for compatibility images. Only the active media variant is prepared.

Desktop story footage stays 2560 × 1440 at 60fps; phone footage stays 2048 × 2048 at 24fps. The hero and phone files are untouched by this performance repair. The desktop independent-frame encoding measures SSIM 0.998276 for the story and 0.999155 for the entrance against the preserved desktop masters. No media is downscaled and no new Higgsfield credits are used. These are existing enhanced sources, not new native-2K generation. `node scripts/prepare-desktop-decoder.mjs` reproduces the desktop delivery assets.

## Hosting

Production is [the dedicated Testicles site on the owner's Windows server](https://testicles.84.32.214.33.sslip.io/). The build is self-contained. The proxy's media policy permits same-origin files and browser-owned blob URLs for fully loaded native videos. Vercel is not the deployment target. Previous source remains in the separate `testicles` directory for rollback.

The desktop investigation and its limitations are documented in `reports/desktop-animation-performance-2026-11-09.md`. `scripts/profile-production.mjs` records Chrome traces and actual source-frame delivery; `scripts/analyze-profile.mjs` summarizes traces, and `scripts/audit-lifecycle.mjs` exercises resize/cleanup and high-rate input. Raw evidence is kept under `.project-state/performance-investigation`.

The loader and latest measurements are in `reports/remaining-49ms-stutter-2026-11-09.md`. Successful compilation is not an animation-performance result; the report retains measured timing limits.
