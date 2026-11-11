// Validate authored readings separately from verbatim filings and printed headings.
import {readFileSync,existsSync} from 'node:fs';
import {loadData} from './build-seo.mjs';
import {lintProse} from './validate-summaries.mjs';
const base=new URL('../sources/filings/',import.meta.url),texts=[];
for(const f of ['pjm-sections','new-sections','regional-sections','perspectives']){
 const u=new URL(f+'.json',base);if(!existsSync(u))continue;
 const d=JSON.parse(readFileSync(u));
 if(Array.isArray(d)) for(const v of d)texts.push([v.speaker+': '+v.title,v.text]);
 else for(const [slug,rows] of Object.entries(d))for(const r of rows) texts.push([slug+': '+r.title,r.take]);
}
for(const l of [...loadData().meta.readingLeads,loadData().meta.stateLead]) texts.push([l.title,l.text]);
if(!texts.length)throw Error('No readings to review');
if(process.argv.includes('--print')) process.stdout.write(texts.map(([,text])=>text).join('\n\n')+'\n');
else {
 const errors=texts.flatMap(([id,t])=>lintProse(id,t));
 if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
 console.log(texts.length+' authored passages, '+errors.length+' style errors');
}
