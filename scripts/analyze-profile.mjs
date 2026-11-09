import fs from 'node:fs';
import path from 'node:path';
const dir=process.argv[2];
const trace=JSON.parse(fs.readFileSync(path.join(dir,'trace.json'),'utf8')).traceEvents;
const threads=trace.filter(e=>e.name==='thread_name').map(e=>({pid:e.pid,tid:e.tid,name:e.args.name}));
const sums=new Map();
for(const e of trace){if(e.ph!=='X'||!e.dur)continue;const key=`${e.pid}:${e.tid}:${e.name}`;const a=sums.get(key)||{pid:e.pid,tid:e.tid,name:e.name,count:0,totalMs:0,maxMs:0};a.count++;a.totalMs+=e.dur/1000;a.maxMs=Math.max(a.maxMs,e.dur/1000);sums.set(key,a);}
const main=threads.filter(t=>t.name==='CrRendererMain');
const mainKeys=new Set(main.map(t=>`${t.pid}:${t.tid}`));
const longTasks=trace.filter(e=>e.ph==='X'&&/RunTask$/.test(e.name)&&mainKeys.has(`${e.pid}:${e.tid}`)&&e.dur>50000).map(e=>({name:e.name,ms:e.dur/1000,at:e.ts/1000}));
const layouts=trace.filter(e=>e.name==='Layout'&&e.ph==='X').map(e=>({ms:e.dur/1000,args:e.args}));
const frameEvents={};for(const e of trace.filter(e=>/DrawFrame|DroppedFrame|PipelineReporter|BeginMainThreadFrame|BeginFrame$/.test(e.name))){frameEvents[e.name]??={count:0,examples:[]};frameEvents[e.name].count++;if(frameEvents[e.name].examples.length<3)frameEvents[e.name].examples.push(e.args);}
const profile=JSON.parse(fs.readFileSync(path.join(dir,'cpu.cpuprofile'),'utf8'));const sampleCounts=new Map();for(let i=0;i<(profile.samples||[]).length;i++)sampleCounts.set(profile.samples[i],(sampleCounts.get(profile.samples[i])||0)+(profile.timeDeltas?.[i]||0));
const hotFunctions=profile.nodes.map(n=>({name:n.callFrame.functionName,url:n.callFrame.url,line:n.callFrame.lineNumber+1,selfMs:(sampleCounts.get(n.id)||0)/1000})).sort((a,b)=>b.selfMs-a.selfMs).slice(0,24);
const media=JSON.parse(fs.readFileSync(path.join(dir,'media-events.json'),'utf8'));
const properties=media.filter(e=>e.method==='Media.playerPropertiesChanged').flatMap(e=>e.params.properties.map(p=>({player:e.params.playerId,...p})));
const result={threads,topEvents:[...sums.values()].sort((a,b)=>b.totalMs-a.totalMs).slice(0,45),longTasks,layouts,frameEvents,hotFunctions,decoderProperties:properties.filter(p=>/decoder|video|resolution|frame|kIsPlatform/i.test(p.name))};
fs.writeFileSync(path.join(dir,'trace-analysis.json'),JSON.stringify(result,null,2));if(!process.argv.includes('--quiet'))console.log(JSON.stringify(result,null,2));
