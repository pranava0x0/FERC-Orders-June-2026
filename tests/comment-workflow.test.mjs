import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
const source = readFileSync(new URL('../tools/summarize-comments.workflow.mjs', import.meta.url), 'utf8').replace('export const meta', 'const meta');
async function run(args, replies) {
  let calls = 0;
  const agent = async () => { calls++; return replies.shift(); };
  const pipeline = async (accs, extract, audit) => Promise.all(accs.map(async acc => audit(await extract(acc), acc)));
  const result = await new AsyncFunction('args','log','agent','pipeline', source)(args,()=>{},agent,pipeline);
  return {result,calls};
}
const acc='20251121-5440';
const good={acc,status:'written',validator:'ok',flagged:false};
test('workflow rejects invalid inputs and batches above five before agent work', async()=>{
  for(const args of [{accs:['bad']},{accs:'bad'},{accs:Array.from({length:6},(_,i)=>`20251121-544${i}`)},{accs:[acc],date:'2026-02-30'}])await assert.rejects(run(args,[]));
});
test('workflow deduplicates accessions and tolerates JSON arguments', async()=>{
  const {result,calls}=await run(JSON.stringify({accs:[acc,acc]}),[{...good}]);
  assert.equal(calls,1); assert.equal(result.total,1);assert.equal(result.complete,true);assert.equal(result.rows[0].aud,null);
});
test('written output with failed or uncertain validation cannot complete or trigger audit',async()=>{
  for(const validator of ['fail','warn',undefined]){
    const {result,calls}=await run({accs:[acc]},[{...good,validator,flagged:true}]);
    assert.equal(calls,1);assert.equal(result.complete,false);assert.deepEqual(result.failedExtract,[acc]);
  }
});
test('independent audit failures are reported separately',async()=>{
  const {result}=await run({accs:[acc]},[{...good,flagged:true},{acc,verdict:'problems',changed:false,validator:'fail'}]);
  assert.equal(result.complete,false);assert.deepEqual(result.failedAudit,[acc]);
});
test('mismatched accession is not accepted as a completed extraction',async()=>{
 const {result}=await run({accs:[acc]},[{...good,acc:'20251121-5441'}]);assert.equal(result.complete,false);
});
test('successful flagged audit completes without claiming human verification',async()=>{
 const {result,calls}=await run({accs:[acc]},[{...good,flagged:true},{acc,verdict:'revised',changed:true,validator:'ok'}]);assert.equal(calls,2);assert.equal(result.complete,true);
});
