// Keep data.js as the editorial source. Omit the four News-only tables from the initial script.
import {readFileSync, writeFileSync} from 'node:fs';
import {loadData} from './build-seo.mjs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const dir=new URL('../docs/js/',import.meta.url),full=readFileSync(new URL('data.js',dir),'utf8'),d=loadData(),names=['reception','media','voices','voiceThemes'];
const start=full.indexOf('  const reception = '),end=full.indexOf('  const comments = ',start),block=full.slice(start,end);
assert.deepEqual([...block.matchAll(/^  const (\w+) = /gm)].map(m=>m[1]),names,'News-only declarations have moved');
const core=full.slice(0,start)+full.slice(end).replace('regional, reception, media, voices, voiceThemes, comments','regional, comments');
const extra='Object.assign(window.FERC_DATA,'+JSON.stringify(Object.fromEntries(names.map(n=>[n,d[n]])))+');\n';
const ctx=vm.createContext({window:{}});vm.runInContext(core,ctx);for(const n of names)assert.ok(!(n in ctx.window.FERC_DATA));
vm.runInContext(extra,ctx);for(const [key,value] of Object.entries(d)){
 const encode=v=>JSON.stringify(v,(k,x)=>typeof x==='function'?x.toString():x);
 assert.equal(encode(ctx.window.FERC_DATA[key]),encode(value),'Payload differs for '+key);
}
for(const [n,t] of [['core-data.js',core],['news-data.js',extra]]){const url=new URL(n,dir);if(process.argv.includes('--check'))assert.equal(readFileSync(url,'utf8'),t,n+' needs rebuilding');else writeFileSync(url,t);}
console.log('Verified initial and News data against data.js.');
