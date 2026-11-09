import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

// Offline only. Preserve the approved camera, 60fps timing, 2K dimensions,
// phone files and opening; add a restrained luma-only clarity pass to the story.
const work='.project-state/quality-audit';
const source='public/assets/story-desktop-clean-60-2k.mp4';
const idle='public/assets/story-idle-desktop-60-2k.mp4';
const output='public/assets/scroll-frames-v4/story';
const intra=path.join(work,'sharp-all-intra.mp4');
const packageOnly=process.argv.includes('--package-only');
// The old optical-flow rejection produced torn silhouettes in these eight
// high-speed in-betweens. Retain the nearest clean source pose for that tick.
const cleanPoses={636:635,637:638,1161:1160,1162:1163,1164:1165,1166:1165,1167:1168,1169:1170};
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const probe=file=>JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,nb_frames','-of','json',file],{encoding:'utf8'})).streams[0];
const encode=args=>execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{stdio:'inherit'});
const codec=['-an','-c:v','libx264','-threads','4','-preset','fast','-crf','18','-profile:v','high','-level:v','5.1','-bf','0','-refs','1','-pix_fmt','yuv420p','-colorspace','bt470bg','-color_range','tv','-movflags','+faststart'];
const filter='[0:v]split[original][detail];[detail]unsharp=5:5:0.35:3:3:0[sharp];[sharp][original]blend=all_expr=\'A+(B-A)*(1-min(1,T/0.75))\':enable=\'lt(t,0.75)\'[out]';
fs.mkdirSync(work,{recursive:true});
const original=probe(source);
assert.equal(original.width,2560);assert.equal(original.height,1440);assert.equal(original.r_frame_rate,'60/1');assert.equal(+original.nb_frames,1405);
if(!packageOnly){console.log('Encoding 2K desktop clarity stream');encode(['-i',source,'-filter_complex_threads','2','-filter_complex',filter,'-map','[out]',...codec,'-g','1','-keyint_min','1','-sc_threshold','0',intra]);}
console.log('Packaging independently seekable frames');
execFileSync(process.execPath,['scripts/package-intra.mjs',intra,output],{stdio:'inherit'});
fs.renameSync(path.join(output,'stream.h264'),path.join(work,'sharp-all-intra.h264'));
const manifestFile=path.join(output,'manifest.json');
const manifest=JSON.parse(fs.readFileSync(manifestFile));
// The exact original first packet protects the entrance-to-story match.
const first=fs.readFileSync('public/assets/scroll-frames-v3/story/frames/0000.bin');
fs.writeFileSync(path.join(output,'frames/0000.bin'),first);
const frames=Array.from({length:manifest.count},(_,i)=>fs.readFileSync(path.join(output,'frames',String(i).padStart(4,'0')+'.bin')));
for(const [target,clean] of Object.entries(cleanPoses)){frames[target]=frames[clean];fs.writeFileSync(path.join(output,'frames',String(target).padStart(4,'0')+'.bin'),frames[clean]);}
let pending=[],bytes=0,start=0,total=0;const parts=[],packets=[];
function flush(){if(!pending.length)return;const name=`part-${parts.length}.bin`;fs.writeFileSync(path.join(output,name),Buffer.concat(pending));parts.push({name:`/assets/scroll-frames-v4/story/${name}`,start,bytes});start+=pending.length;pending=[];bytes=0;}
for(const frame of frames){if(bytes+frame.length>12*1024*1024)flush();packets.push([parts.length,bytes,frame.length]);pending.push(frame);bytes+=frame.length;total+=frame.length;}flush();
assert(total<128*1024*1024,'Clarity stream must stay within the existing cache limit');
Object.assign(manifest,{frameBase:'/assets/scroll-frames-v4/story/frames/',parts,packets});
fs.writeFileSync(manifestFile,JSON.stringify(manifest));
const patchedStream=path.join(work,'final-all-intra.h264');fs.writeFileSync(patchedStream,Buffer.concat(frames));
// Native fallback uses short GOPs; its playback timing is identical.
console.log('Encoding matching native fallback and ending loop');
const native='public/assets/story-desktop-crisp-60-2k.mp4';
const ending='public/assets/story-idle-crisp-desktop-60-2k.mp4';
encode(['-r','60','-f','h264','-i',patchedStream,...codec,'-g','3','-keyint_min','3','-sc_threshold','0',native]);
if(!packageOnly)encode(['-i',idle,'-vf','unsharp=5:5:0.35:3:3:0',...codec,'-g','12','-keyint_min','12','-sc_threshold','0',ending]);
for(const [file,count] of [[native,1405],[ending,95]]){const p=probe(file);assert.equal(p.width,2560);assert.equal(p.height,1440);assert.equal(p.r_frame_rate,'60/1');assert.equal(+p.nb_frames,count);}
const receipt={source,sourceSha256:hash(source),idleSha256:hash(idle),filter,cleanPoses,frames:manifest.count,width:2560,height:1440,fps:60,bytes:total,previousBytes:119370353,parts:parts.length,nativeBytes:fs.statSync(native).size,endingBytes:fs.statSync(ending).size,unchangedFirstPacket:true};
fs.writeFileSync(path.join(work,'clarity-receipt.json'),JSON.stringify(receipt,null,2));
console.log(JSON.stringify(receipt,null,2));
