import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../docs/reading/',import.meta.url);
test('NYISO’s qualification about its own definition is reachable at the reference in the Word body',()=>{
 const p=new URL('order-el26-69-001-nyiso-rehearing/',root);
 const data=JSON.parse(readFileSync(new URL('source.json',p))).pages[0].text;
 const [body,notes]=data.split('\n\nFootnotes\n');
 assert.ok(body.includes('[fn:8]'));assert.match(notes,/\[fn:8\][^\n]+NYISO could propose Tariff revisions establishing its own definition/);
 const html=readFileSync(new URL('text.html',p),'utf8');assert.match(html,/href="#note-fn-8"/);assert.match(html,/id="note-fn-8"/);
});
test('each Word reference has one note target even when a printed number restarts',()=>{
 let refs=0,documents=0;
 for(const r of JSON.parse(readFileSync(new URL('catalog.json',root)))){
  if(r.pages!==null)continue;
  const html=readFileSync(new URL(r.slug+'/text.html',root),'utf8');
  const targets=[...html.matchAll(/ id="(note-(?:fn|en)--?\d+)"/g)].map(m=>m[1]),set=new Set(targets);
  const links=[...html.matchAll(/href="#(note-(?:fn|en)--?\d+)"/g)].map(m=>m[1]);
  assert.equal(targets.length,set.size,r.slug);for(const link of links)assert.ok(set.has(link),r.slug+' '+link);
  refs+=links.length;if(links.length)documents++;
 }
 assert.ok(refs>=425&&documents>=15,'Expected the notes in the signed Word originals');
});
