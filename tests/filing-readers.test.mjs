import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadData} from '../tools/build-seo.mjs';
const base=new URL('../docs/reading/',import.meta.url),read=(f)=>readFileSync(new URL(f,base),'utf8'),catalog=JSON.parse(read('catalog.json'));
const tier=new Map(JSON.parse(readFileSync(new URL('../../sources/filings/record-tier.json',base),'utf8')).map(e=>[e.accession,e]));
test('every inventory row maps to its original bytes; sections and pages cover all tokens',()=>{
 const hub=read('index.html'),sitemap=read('../sitemap.xml'); assert.ok(catalog.length>0);
 for(const r of catalog){assert.ok(hub.includes('href="'+r.slug+'/"')&&sitemap.includes('/reading/'+r.slug+'/'),r.slug);
 const src=JSON.parse(read(r.slug+'/source.json'));assert.deepEqual(src.document,r);if(r.tier==='record'){const e=tier.get(r.accession),f=e&&e.files.find(f=>f.text===r.file);assert.ok(f&&f.sha256===r.sha256&&/^[0-9a-f]{64}$/.test(r.sha256),r.slug+' record-tier hash');assert.match(readFileSync(new URL('../../'+r.file,base),'utf8').replace(/--- PAGE \d+ ---/g,''),/[A-Za-z]{3}/,r.slug+' has words, not blank page markers');assert.equal(Boolean(r.ocr),Boolean(f.ocr),r.slug+' OCR flag');assert.match(r.url,/^https:\/\/elibrary\.ferc\.gov\//);}
 else assert.equal(createHash('sha256').update(readFileSync(new URL('../../'+r.file,base))).digest('hex'),r.sha256);
 for(const part of [src.pages,src.sections]){let at=0;assert.ok(part.length);
 for(const row of part){assert.equal(row.startToken,at,r.slug);assert.ok(row.endToken>=at,r.slug);at=row.endToken;}assert.equal(at,r.tokens,r.slug);}
 const html=read(r.slug+'/index.html'),full=read(r.slug+'/text.html');let anchors=new Set([...full.matchAll(/ id="([^"]+)"/g)].map(x=>x[1]));
 for(const [,a] of html.matchAll(/href="text\.html#([^"]+)"/g))assert.ok(anchors.has(a),r.slug+' '+a);
 const own=new Set([...html.matchAll(/ id="([^"]+)"/g)].map(x=>x[1]));
 for(const [,a] of html.matchAll(/href="#([^"]+)"/g))assert.ok(own.has(a),r.slug+' in-page #'+a);
 if(html.includes('class="toc"'))assert.match(html,/<summary>Contents · \d+ sections<\/summary>/,r.slug);
 }});
test('public leads reach cited source sections without any script',()=>{
 for(const row of loadData().meta.readingLeads){let [doc,id]=row.href.slice('reading/'.length).split('/#');assert.ok(read(doc+'/index.html').includes('id="'+id+'"'));assert.ok(read('../index.html').includes(row.href));assert.ok(read('../llms.txt').includes(row.href));}
 const positions=read('positions.html');assert.match(positions,/Direct response/);assert.match(positions,/Related public statement/);
 for(const [,path,id] of positions.matchAll(/href="([a-z0-9-]+)\/#([^"]+)"/g))assert.ok(read(path+'/index.html').includes('id="'+id+'"'),id);
});

test('a docket topic index links actual filing text on the stated page',()=>{
 const html=read('discussion-er26-3380.html');
 assert.ok(html.includes('filing can quote another party'));
 const samples=[...html.matchAll(/<blockquote>([^<]+) <cite><a href="([a-z0-9-]+)\/text\.html#p-(\d+)"/g)];
 assert.ok(samples.length>0);
 for(const [,q,doc,pg] of samples){
  const decoded=q.replace(/&(?:amp|lt|gt|quot|#39);/g,c=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[c]));
  assert.ok(JSON.parse(read(doc+'/source.json')).pages[Number(pg)-1].text.replace(/\s+/g,' ').includes(decoded),doc+' p. '+pg);
 }
});

test('every verified matrix cell links to the same accession in the reader',()=>{
 const map=new Map(catalog.map(r=>[r.slug,r]));
 const verified=loadData().procedural.filings.rows.filter(r=>r.status==='filed-verified');assert.ok(verified.length>=13);
 for(const r of verified)assert.equal(map.get(r.reader)?.accession,r.accession,r.docket+' '+r.step);
});

test('record-tier filings keep a hash for every original and a reason for every file left on eLibrary',()=>{
 assert.ok(tier.size>0,'the record tier is empty');
 for(const e of tier.values()){
  assert.ok(e.files.some(f=>f.text),e.accession+' has no extracted text');
  for(const f of e.files){assert.ok(f.text||f.skipped,e.accession+' '+f.label);if(f.text||f.sha256)assert.match(f.sha256,/^[0-9a-f]{64}$/);}
  const shown=read('rec-'+e.accession+'/index.html');
  assert.ok(shown.includes('href="'+e.url+'"')&&!shown.includes('Archived original'),e.accession+' must point to eLibrary for the original');
 }
});
