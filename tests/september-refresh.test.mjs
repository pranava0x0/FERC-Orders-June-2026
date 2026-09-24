import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const c={window:{}};vm.runInNewContext(readFileSync(new URL('../docs/js/data.js',import.meta.url),'utf8'),c);const D=c.window.FERC_DATA;
const evidence=JSON.parse(readFileSync(new URL('../sources/refresh-2026-09-24.json',import.meta.url),'utf8'));
test('September dismissal sources trace to five downloaded order bodies',()=>{
 assert.equal(evidence.orders_read.length,5);
 for(const row of evidence.orders_read){
  const body=readFileSync(new URL('../'+row.text,import.meta.url),'utf8');
  assert.match(body,/Issued September 21, 2026/);
  assert.match(body,/ORDER DISMISSING REQUESTS? FOR REHEARING AND CLARIFICATION/);
  assert.match(body,/not final/);assert.match(body,/November 16, 2026/);
  assert.ok(Object.values(D.SOURCES).some(s=>s.url.includes(row.accession)));
 }
});
test('refresh keeps comment coverage separate from the current docket check',()=>{
 assert.equal(D.meta.newsCapture,'2026-09-24');
 assert.equal(evidence.dockets.length,10);
 assert.match(D.tracks.rm264.status.line,/June 24/);
 assert.match(D.tracks.rm264.status.line,/does not include/);
 assert.match(D.tracks.context.next.label,/Proposed/);
 assert.equal(D.tracks.gov.next.date,null);
});
