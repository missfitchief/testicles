import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
const work='.project-state/desktop-decoder-build';fs.mkdirSync(work,{recursive:true});
for(const name of ['entry','story']){
 const input=`public/assets/${name}-desktop-seek-60-2k.mp4`,movie=path.join(work,`${name}.mp4`),pack=path.join(work,name),output=`public/assets/scroll-frames-v1/${name}`;
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',input,'-an','-c:v','libx264','-threads','4','-preset','fast','-crf','18','-g','1','-keyint_min','1','-sc_threshold','0','-bf','0','-refs','1','-pix_fmt','yuv420p','-movflags','+faststart',movie],{stdio:'inherit'});
 execFileSync(process.execPath,['scripts/package-intra.mjs',movie,pack],{stdio:'inherit'});fs.mkdirSync(output,{recursive:true});
 for(const file of fs.readdirSync(pack))if(/\.(bin|json)$/.test(file))fs.copyFileSync(path.join(pack,file),path.join(output,file));
 fs.cpSync(path.join(pack,'frames'),path.join(output,'frames'),{recursive:true});
 const v2=`public/assets/scroll-frames-v2/${name}`;fs.mkdirSync(v2,{recursive:true});
 const manifest=JSON.parse(fs.readFileSync(path.join(pack,'manifest.json'),'utf8'));
 manifest.frameBase=`/assets/scroll-frames-v1/${name}/frames/`;
 manifest.parts=manifest.parts.map(p=>({...p,name:`/assets/scroll-frames-v1/${name}/${p.name}`}));
 fs.writeFileSync(path.join(v2,'manifest.json'),JSON.stringify(manifest));
}
