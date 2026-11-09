import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const options=Object.fromEntries(process.argv.slice(2).map(v=>v.replace(/^--/,'').split('=')));
const root=path.resolve(options.root||'dist'),port=Number(options.port||5196);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.mp4':'video/mp4','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'};
http.createServer((req,res)=>{
 let name=decodeURIComponent(new URL(req.url,'http://local').pathname);if(name==='/')name='/index.html';const file=path.resolve(root,'.'+name);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 const size=fs.statSync(file).size;let start=0,end=size-1,status=200;
 const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range||'');if(range){start=Number(range[1]);end=range[2]?Math.min(Number(range[2]),end):end;status=206;}
 if(start>end){res.writeHead(416);res.end();return;}
 const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':end-start+1,'Accept-Ranges':'bytes','Cache-Control':'no-cache','Content-Security-Policy':"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; media-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'"};if(status===206)headers['Content-Range']=`bytes ${start}-${end}/${size}`;
 res.writeHead(status,headers);fs.createReadStream(file,{start,end}).pipe(res);
}).listen(port,'127.0.0.1',()=>console.log(`Production files: http://127.0.0.1:${port}`));
