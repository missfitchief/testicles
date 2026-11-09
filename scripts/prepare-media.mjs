import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const old='C:/Users/akki/Documents/ChatGPT/sajtovi/testicles';
const destination=path.resolve('public/media');fs.mkdirSync(destination,{recursive:true});
const run=args=>execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{stdio:'inherit'});
const manifest={version:2,images:{},films:{}};
for(const [name,file] of Object.entries({hero:'hero.png',slide:'story-slide-start.png',friends:'story-huddle-end.png',pants:'clean-pants-start-2k.png',sack:'clean-worn-trousers-end-2k.png',girl:'clean-girl-talk-end-2k.png'})){
 const output=path.join(destination,`${name}.webp`);
 if(!fs.existsSync(output))run(['-i',path.join(old,'source-assets',file),'-c:v','libwebp','-quality','96','-compression_level','6',output]);
 manifest.images[name]={file:`/media/${name}.webp`,bytes:fs.statSync(output).size};
}
fs.copyFileSync(path.join(old,'public/assets/hero-2k.mp4'),path.join(destination,'hero.mp4'));
fs.copyFileSync(path.join(old,'public/assets/icon.png'),path.join(destination,'icon.png'));
const scenes=[['slide',0,8.6],['pants',0,5],['girl',14.4,23.416667]];
for(const [name,start,end] of scenes)for(const mobile of [false,true]){
 const source=path.join(old,'public/assets',name==='pants'?(mobile?'lore-pants-mobile-2k.mp4':'lore-pants-2k.mp4'):(mobile?'story-continuous-clean-mobile-2k.mp4':'story-continuous-clean-2k.mp4'));
 const basename=`${name}${mobile?'-phone':''}`;
 const refresh=process.argv.includes(`--refresh=${name}`);
 const output=path.join(destination,`${basename}.mp4`);
 if(!fs.existsSync(output)||refresh)run(['-ss',String(start),'-i',source,'-t',String(end-start),'-an','-c:v','libx264','-threads','4','-preset','medium','-crf','17','-g','48','-keyint_min','24','-pix_fmt','yuv420p','-movflags','+faststart',output]);
 const idle=path.join(destination,`${basename}-idle.mp4`);
 if(!fs.existsSync(idle)||refresh||process.argv.includes('--refresh-idles'))run(['-sseof','-0.75','-i',output,'-filter_complex','[0:v]setpts=PTS-STARTPTS,split[a][b];[a]reverse[r];[b]trim=start_frame=1:end_frame=17,setpts=PTS-STARTPTS[f];[r][f]concat=n=2:v=1:a=0[v]','-map','[v]','-an','-c:v','libx264','-threads','4','-preset','medium','-crf','17','-g','48','-pix_fmt','yuv420p','-movflags','+faststart',idle]);
 for(const [position,time] of [['start',0],['end',end-start-.09]]){
  const poster=path.join(destination,`${basename}-${position}.webp`);
  if(!fs.existsSync(poster)||refresh)run(['-ss',String(time),'-i',output,'-frames:v','1','-c:v','libwebp','-quality','96',poster]);
 }
 manifest.films[basename]={file:`/media/${basename}.mp4`,idle:`/media/${basename}-idle.mp4`,bytes:fs.statSync(output).size,duration:end-start,width:mobile?2048:2560,height:mobile?2048:1440,fps:24};
 console.log(`${basename}: ${(fs.statSync(output).size/1048576).toFixed(1)} MiB, original 2K / 24fps`);
}
fs.writeFileSync(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2));
