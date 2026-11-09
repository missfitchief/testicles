import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const work='.project-state/compatibility';fs.mkdirSync(work,{recursive:true});
const receipts=[];
for(const [name,version,count] of [['entry','v2',243],['story','v4',1405]]){
 const source=JSON.parse(fs.readFileSync(`public/assets/scroll-frames-${version}/${name}/manifest.json`));
 assert.equal(source.width,2560);assert.equal(source.height,1440);assert.equal(source.fps,60);assert.equal(source.count,count);
 const stream=path.join(work,`${name}.h264`),fd=fs.openSync(stream,'w'),hash=createHash('sha256');
 for(const part of source.parts){const bytes=fs.readFileSync('public'+part.name);fs.writeSync(fd,bytes);hash.update(bytes);}fs.closeSync(fd);
 const output=`public/assets/compatibility-frames-v1/${name}`;fs.mkdirSync(path.join(output,'frames'),{recursive:true});
 console.log(`Encoding ${count} original 2K ${name} frames`);
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-r','60','-f','h264','-i',stream,'-frames:v',String(count),'-c:v','mjpeg','-threads','4','-q:v','2','-huffman','optimal','-pix_fmt','yuvj420p','-start_number','0',path.join(output,'frames/%04d.jpg')],{stdio:'inherit'});
 let pending=[],bytes=0,start=0,total=0;const parts=[],packets=[];
 function flush(){if(!pending.length)return;const filename=`part-${parts.length}.bin`;fs.writeFileSync(path.join(output,filename),Buffer.concat(pending));parts.push({name:`/assets/compatibility-frames-v1/${name}/${filename}`,start,bytes});start+=pending.length;pending=[];bytes=0;}
 // Parts are bounded, frame-aligned prefetch units; individual JPEGs remain
 // available for urgent jumps and reversals outside the retained window.
 for(let i=0;i<count;i++){
  const frame=fs.readFileSync(path.join(output,'frames',String(i).padStart(4,'0')+'.jpg'));
  assert(frame[0]===255&&frame[1]===216&&frame.at(-2)===255&&frame.at(-1)===217);
  if(bytes+frame.length>8*1024*1024)flush();
  packets.push([parts.length,bytes,frame.length]);pending.push(frame);bytes+=frame.length;total+=frame.length;
 }flush();
 const manifest={width:2560,height:1440,fps:60,count,mime:'image/jpeg',frameBase:`/assets/compatibility-frames-v1/${name}/frames/`,extension:'.jpg',parts,packets};
 fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest));
 receipts.push({name,frames:count,bytes:total,parts:parts.length,sourceSha256:hash.digest('hex')});console.log(receipts.at(-1));
}
fs.writeFileSync(path.join(work,'image-assets.json'),JSON.stringify(receipts,null,2));
