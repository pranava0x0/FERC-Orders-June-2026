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

test('every reform-matrix bullet quotes its reading’s page verbatim, and SPP is empty until it files',()=>{
 const m=JSON.parse(readFileSync(new URL('../../sources/filings/reform-matrix.json',base),'utf8')).cells,norm=s=>s.replace(/\s+/g,' ').trim();
 const cells=Object.entries(m).flatMap(([rto,row])=>Object.entries(row).map(([k,c])=>[rto,k,c])).filter(([, ,c])=>c);
 assert.ok(cells.length>=25,'matrix is nearly empty');
 for(const [rto,k,c] of cells){
  assert.ok(Array.isArray(c)&&c.length>=2,rto+' '+k+': a cell lists at least two bullets');
  for(const x of c){
   assert.ok(x.t.split(/\s+/).length<=18,rto+' '+k+' bullet too long: '+x.t);
   // The reader's text.html holds each PDF page in <section id="p-N"><pre>…</pre>.
   const m2=read(x.slug+'/text.html').match(new RegExp('<section id="p-'+x.pg+'">[\\s\\S]*?<pre>([\\s\\S]*?)</pre>'));
   assert.ok(m2,rto+' '+k+': no page '+x.pg+' in '+x.slug);
   const page=m2[1].replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
   assert.ok(norm(page).includes(norm(x.quote)),rto+' '+k+': quote not on p. '+x.pg+': '+x.quote.slice(0,50));
  }
 }
 assert.ok(Object.values(m.SPP).every(c=>c===null));
});
test('transcription footnotes: every mark and back-link resolves, and identifiers keep their digits',()=>{
 let links=0;
 for(const r of catalog){
  const full=read(r.slug+'/text.html'),ids=new Set([...full.matchAll(/ id="([^"]+)"/g)].map(x=>x[1]));
  for(const [,a] of full.matchAll(/href="#((?:fn|fnref)-\d+-\d+)"/g)){links++;assert.ok(ids.has(a),r.slug+' #'+a);}
 }
 assert.ok(links>1000,'footnote links were generated ('+links+')');
 // Notes whose number sits alone on its line, text below ("4  \nThe cities of Anaheim…"), or is fused to
 // the text ("7IRAS Filing"), still link: these documents linked none before.
 for(const s of ['filing-er27-506-caiso-large-loads','protest-er27-25-acp-srea','report-el26-68-spp']){
  const h=read(s+'/text.html'),marks=(h.match(/<sup>/g)||[]).length,linked=(h.match(/class="fnref"/g)||[]).length;
  assert.ok(marks>20&&linked>=marks*0.95,s+': '+linked+' of '+marks+' footnote marks linked');
 }
 // A bare number inside body text ("findings on cost recovery \n7 \nagreement") is not a note; the real note 7 is.
 assert.match(read('rec-20261116-5346/text.html'),/id="fn-410-7"><a class="fnback"[^>]*>7<\/a>\s*Id\. at P 8\./);
 // Testimony line number 5 ("5\nQ. …") is not note 5; the note at the foot of the page is (PR #43 review).
 assert.match(read('rec-20261116-5257-3/text.html'),/id="fn-7-5"><a class="fnback"[^>]*>5<\/a>\s*OSC at P 59/);
 // A page-number footer that matches a note number does not displace the note (PR #43 review).
 assert.match(read('rec-20250423-5125/text.html'),/id="fn-2-2"><a class="fnback"[^>]*>2<\/a>\s*18 C\.F\.R\. § 385\.213/);
 assert.match(read('filing-20260812-5036/text.html'),/id="fn-1-1"><a class="fnback"/);
 // A chemical formula is not a mark, even when a note 2 sits on the page (PR #43 review).
 assert.ok(read('rec-20250423-5162-2/text.html').includes('CO2 and water savings'));
 // A continuation line that starts with a note's number ("136 FERC ¶ 61,051", "50 MW threshold)") is not that note.
 assert.match(read('e-8-miso-el26-70-000/text.html'),/id="fn-31-136"><a class="fnback"[^>]*>136<\/a>\s*See, e\.g\./);
 assert.match(read('pjm-september-iras-answer/text.html'),/id="fn-15-50"><a class="fnback"[^>]*>50<\/a>\s*IMM Comments/);
 // A quoted ellipsis before a mark is not a table-of-contents leader.
 assert.match(read('e-2-pjm-el25-49-002/text.html'),/\. \. \. \.”<a class="fnref" id="fnref-22-65"/);
 assert.match(read('rec-20260903-5204/text.html'),/id="fn-3-7"><a class="fnback"[^>]*>7<\/a>IRAS Filing/);
 // Moody's "Baa3": a digit inside a word with no note on the page is not a footnote mark (PR #42 review).
 const zgia=read('filing-er26-3552-miso-zgia-attachment-2/text.html');
 assert.ok(zgia.includes('Baa3')&&!/Baa(?:<a[^>]*>)?<sup>3/.test(zgia));
});
