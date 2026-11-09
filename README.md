# Testicles

A clean playback implementation under the original Testicles website. The approved layout, copy, opening and connected scroll story are restored.

`npm ci` installs dependencies. `npm run dev` serves port 5194. `npm test`, `npm run build` and `npm run check` validate the release.

## Motion

The original GSAP timeline controls the continuous journey. Desktop uses two worker-owned 2K canvases, one for the entrance and one for the story. Independently coded H.264 frames avoid the native media seek pipeline. Each worker decodes only the latest requested frame, closes it immediately after drawing, and caps work at 60fps independently of monitor refresh rate. Compressed data is cached within a fixed limit. The desktop prepares the short film in the background with three bounded requests, unless Save-Data is enabled; urgent missing frames have separate small files. Unsupported decoders fall back to the existing native player while retaining the last good picture. The original phone player and final idle loop remain unchanged.

Desktop story footage stays 2560 × 1440 at 60fps; phone footage stays 2048 × 2048 at 24fps. The hero and phone files are untouched by this performance repair. The desktop independent-frame encoding measures SSIM 0.998276 for the story and 0.999155 for the entrance against the preserved desktop masters. No media is downscaled and no new Higgsfield credits are used. These are existing enhanced sources, not new native-2K generation. `node scripts/prepare-desktop-decoder.mjs` reproduces the desktop delivery assets.

## Hosting

The production target is the existing Testicles Vercel project and the dedicated Testicles release on the owner's Windows server. The build is self-contained, including all media; it has no rewrite dependency on another host. Previous source remains in the separate `testicles` directory for rollback.

The desktop investigation and its limitations are documented in `reports/desktop-animation-performance-2026-11-09.md`. `scripts/profile-production.mjs` records Chrome traces and actual source-frame delivery; `scripts/analyze-profile.mjs` summarizes traces, and `scripts/audit-lifecycle.mjs` exercises resize/cleanup and high-rate input. Raw evidence is kept under `.project-state/performance-investigation`.
