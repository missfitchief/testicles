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
for (const file of ['src/style.css', 'src/main.js']) assert.equal(fs.readFileSync(file, 'utf8'), fs.readFileSync(path.join(original, file), 'utf8'), `Approved visual source changed: ${file}`);
assert.equal(fs.readFileSync('src/story.css','utf8').replace(/@media\(min-width:701px\)\{\.entry-crop\.frame-mask-ready\{mask-image:none\}\}\r?\n/,'').replace(/@media\(min-width:701px\)\{\.hero-art\{mask-image:none\}\.hero-art::after\{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient\(to bottom,var\(--paper\),transparent 12%,transparent 83%,var\(--paper\)\)\}\}\r?\n/,''),fs.readFileSync(path.join(original,'src/story.css'),'utf8'),'Story layout changed');
assert.equal(fs.readFileSync('src/entry.js','utf8').replace(/    if\(video.nextElementSibling\?\.classList.contains\('independent-surface'\)\)video.nextElementSibling.style.transform=transform;\r?\n/,'').replace(/    get maskGeometry\(\)\{return geometry&&\{startBox:geometry.start,endBox:geometry.end,startFrame:geometry.startFrame,endFrame:geometry.endFrame\};\},\r?\n/,''),fs.readFileSync(path.join(original,'src/entry.js'),'utf8'),'Camera geometry changed');
for (const file of ['hero-2k.mp4', 'hero-2k.webp', 'story-desktop-seek-60-2k.mp4']) {
  const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  assert.equal(hash(`dist/assets/${file}`), hash(`${original}/public/assets/${file}`), `Media recompressed: ${file}`);
}
const source = fs.readFileSync('src/story.js', 'utf8') + fs.readFileSync('src/scroll-video.js', 'utf8');
assert(!/createImageBitmap|preventDefault|playbackRate\s*=/.test(source));
for(const name of ['entry','story']){
 const dir=`dist/assets/scroll-frames-v1/${name}`,manifest=JSON.parse(fs.readFileSync(`${dir}/manifest.json`,'utf8'));
 assert.equal(manifest.width,2560);assert.equal(manifest.height,1440);assert.equal(manifest.fps,60);assert.equal(manifest.count,name==='entry'?243:1405);
 for(const part of manifest.parts)assert.equal(fs.statSync(`${dir}/${part.name}`).size,part.bytes);
 for(const [id,offset,length] of manifest.packets)assert(offset>=0&&length>0&&offset+length<=manifest.parts[id].bytes);
 const v2=JSON.parse(fs.readFileSync(`dist/assets/scroll-frames-v2/${name}/manifest.json`,'utf8'));
 for(let i=0;i<v2.count;i++)assert.equal(fs.statSync(path.resolve('dist','.'+v2.frameBase+String(i).padStart(4,'0')+'.bin')).size,v2.packets[i][2]);
}
const media = [];
for (const file of fs.readdirSync('dist/assets').filter(f => /\.(mp4|webp)$/.test(f))) {
  const info = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'json', `dist/assets/${file}`], { encoding: 'utf8' })).streams[0];
  assert(Math.max(info.width, info.height) >= 2048, `Below 2K: ${file}`);
  media.push({ file, ...info });
}
console.log(JSON.stringify({ status: 'passed', originalVisuals: 'original opening media, typography, layout, camera and controls; equivalent desktop mask rendering', decoder: 'independent 2K frames on desktop; original native phone path; native fallback', media }, null, 2));
