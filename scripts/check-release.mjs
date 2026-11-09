import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const html=fs.readFileSync('dist/index.html','utf8');
const paths=[...new Set([...html.matchAll(/(?:src|srcset|href|data-wide|data-phone)="(\/[^"#?]+)"/g)].map(match=>match[1]))];
for(const file of paths)assert(fs.existsSync(path.join('dist',file)),`Missing asset ${file}`);
const source=fs.readFileSync('src/media.js','utf8')+fs.readFileSync('src/main.js','utf8');
for(const expression of [/currentTime\s*=/,/playbackRate\s*=/,/new\s+Worker\s*\(/,/VideoDecoder/,/createImageBitmap/,/preventDefault\s*\(/])assert(!expression.test(source),`Forbidden playback complexity: ${expression}`);
const media=[];
for(const file of fs.readdirSync('dist/media')){
 if(!/\.(mp4|webp)$/.test(file))continue;
 const info=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate','-of','json',path.join('dist/media',file)],{encoding:'utf8'})).streams[0];
 assert(Math.max(info.width,info.height)>=2048,`Not 2K: ${file}`);
 if(file.endsWith('.mp4'))assert.equal(info.r_frame_rate,'24/1',`Changed source timing: ${file}`);
 media.push({file,width:info.width,height:info.height});
}
assert.equal(createHash('sha256').update(fs.readFileSync('dist/media/hero.mp4')).digest('hex'),'c411ed27a685fcf9cebb80b4ae9dec3102e8e6cd455ab93c0ee9382c06f0567a');
const files=fs.readdirSync('dist',{recursive:true}).map(file=>path.join('dist',file)).filter(file=>fs.statSync(file).isFile());
const bytes=files.reduce((sum,file)=>sum+fs.statSync(file).size,0);assert(bytes<100_000_000,'Deployment is too large');
console.log(JSON.stringify({status:'passed',bytes,files:files.length,media,hero:'original 2K bytes preserved',scroll:'native; no media seeking'},null,2));
