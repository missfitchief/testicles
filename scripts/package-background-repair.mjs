import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const work=path.resolve('.project-state/seam-repair');
const segment=path.join(work,'repaired-segment-tagged.mp4');
const native='public/assets/story-desktop-seek-60-2k.mp4';
const output='public/assets/scroll-frames-v3/story';
const first=585,last=1050,count=1405;
function annex(input,name){
 const file=path.join(work,name+'.h264');
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',input,'-an','-c:v','copy','-bsf:v','h264_mp4toannexb','-f','h264',file]);
 const packets=JSON.parse(execFileSync('ffprobe',['-v','error','-show_packets','-show_entries','packet=pos,size,flags','-of','json',file],{encoding:'utf8',maxBuffer:4e6})).packets;
 const bytes=fs.readFileSync(file);
 return {packets,frame:i=>bytes.subarray(+packets[i].pos,+packets[i].pos+(+packets[i].size))};
}
const repair=annex(segment,'repaired-segment');
const originalNative=annex(native,'original-native');
assert.equal(repair.packets.length,last-first+1);assert.equal(originalNative.packets.length,count);
assert(repair.packets.every(p=>p.flags.includes('K')));
assert(originalNative.packets[first].flags.includes('K'));assert(originalNative.packets[last].flags.includes('K'));
fs.mkdirSync(path.join(output,'frames'),{recursive:true});
let pending=[],bytes=0,start=0,total=0;const parts=[],packets=[],nativeFrames=[];
function flush(){if(!pending.length)return;const name=`part-${parts.length}.bin`;fs.writeFileSync(path.join(output,name),Buffer.concat(pending));parts.push({name:`/assets/scroll-frames-v3/story/${name}`,start,bytes});start+=pending.length;pending=[];bytes=0;}
for(let i=0;i<count;i++){
 const changed=i>first&&i<last;
 const frame=changed?repair.frame(i-first):fs.readFileSync(`public/assets/scroll-frames-v1/story/frames/${String(i).padStart(4,'0')}.bin`);
 if(bytes+frame.length>12*1024*1024)flush();
 packets.push([parts.length,bytes,frame.length]);pending.push(frame);bytes+=frame.length;total+=frame.length;
 fs.writeFileSync(path.join(output,'frames',String(i).padStart(4,'0')+'.bin'),frame);
 nativeFrames.push(changed?repair.frame(i-first):originalNative.frame(i));
}
flush();assert(total<128*1024*1024,'Repaired stream exceeds the existing frame-cache budget');
const manifest={width:2560,height:1440,fps:60,count,codec:'avc1.640033',frameBase:'/assets/scroll-frames-v3/story/frames/',parts,packets};
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest));
const joined=path.join(work,'repaired-native.h264');fs.writeFileSync(joined,Buffer.concat(nativeFrames));
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-fflags','+genpts','-r','60','-f','h264','-i',joined,'-an','-c:v','copy','-movflags','+faststart','public/assets/story-desktop-clean-60-2k.mp4']);
const receipt={frames:count,repairedFrames:last-first-1,unchangedFrames:count-(last-first-1),width:2560,height:1440,fps:60,bytes:total,parts:parts.length,first,last,nativeBytes:fs.statSync('public/assets/story-desktop-clean-60-2k.mp4').size};
fs.writeFileSync(path.join(work,'package-receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
