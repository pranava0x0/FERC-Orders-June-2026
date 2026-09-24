import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync(new URL('../docs/js/app.js',import.meta.url),'utf8');
const start=app.indexOf('var selectIssue = function');
const end=app.indexOf('    var picker = document.getElementById',start);
const select=app.slice(start,end);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){
 const requests=[],rendered=[],box={setAttribute(){},innerHTML:''};
 const c={selectedIssueKey:null,issueByKey:{a:{slug:'a'},b:{slug:'b'}},issueCache:{},ASSET_VER:'test',document:{getElementById:()=>box},writeCommentsHash(){},renderIssueReader:(_box,d)=>rendered.push(d.key),markActiveIssue:key=>{c.selectedIssueKey=key;},fetch:()=>new Promise((resolve,reject)=>requests.push({resolve,reject}))};
 vm.createContext(c);vm.runInContext(select,c);return {c,requests,rendered,box};
}
test('slow previous issue cannot replace the latest selected issue',async()=>{
 const {c,requests,rendered}=harness();c.selectIssue('a');c.selectIssue('b');
 requests[1].resolve({ok:true,json:async()=>({key:'b'})});await tick();
 requests[0].resolve({ok:true,json:async()=>({key:'a'})});await tick();
 assert.deepEqual(rendered,['b']);assert.equal(c.issueCache.a.key,'a');
});
test('old request failure cannot replace the issue map after reset',async()=>{
 const {c,requests,box}=harness();c.selectIssue('a');c.markActiveIssue(null);box.innerHTML='Issue map';
 requests[0].reject(new Error('offline'));await tick();assert.equal(box.innerHTML,'Issue map');
});
