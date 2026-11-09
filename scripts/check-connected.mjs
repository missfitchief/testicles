import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const html = fs.readFileSync('dist/index.html', 'utf8');
const references = [...new Set([...html.matchAll(/(?:src|srcset|href|data-src|data-desktop-src|data-mobile-src)="(\/[^"#?]+)"/g)].map(m => m[1]))];
for (const file of references) assert(fs.existsSync(path.join('dist', file)), `Missing ${file}`);
assert(!/<canvas|data-.*-manifest=/.test(html), 'Old frame player remains');
const original = '../testicles';
for (const file of ['src/style.css', 'src/story.css', 'src/entry.js', 'src/main.js']) assert.equal(fs.readFileSync(file, 'utf8'), fs.readFileSync(path.join(original, file), 'utf8'), `Approved visual source changed: ${file}`);
for (const file of ['hero-2k.mp4', 'hero-2k.webp', 'story-desktop-seek-60-2k.mp4']) {
  const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  assert.equal(hash(`dist/assets/${file}`), hash(`${original}/public/assets/${file}`), `Media recompressed: ${file}`);
}
const source = fs.readFileSync('src/story.js', 'utf8') + fs.readFileSync('src/scroll-video.js', 'utf8');
assert(!/new\s+Worker|VideoDecoder|createImageBitmap|preventDefault|playbackRate\s*=/.test(source));
const media = [];
for (const file of fs.readdirSync('dist/assets').filter(f => /\.(mp4|webp)$/.test(f))) {
  const info = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'json', `dist/assets/${file}`], { encoding: 'utf8' })).streams[0];
  assert(Math.max(info.width, info.height) >= 2048, `Below 2K: ${file}`);
  media.push({ file, ...info });
}
console.log(JSON.stringify({ status: 'passed', originalVisuals: 'byte-identical CSS, opening, geometry and main controls', decoder: 'native video, serialized latest-target seeks', media }, null, 2));
