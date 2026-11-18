// How many interactions it takes to answer each question in tools/nav-questions.json, from a fresh
// home page, at phone, tablet and desktop size. Cost = taps or clicks + typed entries + screens scrolled
// + sideways scroll adjustments.
//   node tools/nav-budget.mjs URL OUT            measure; write OUT/nav.json, nav.md, nav.html
//   node tools/nav-budget.mjs URL OUT --check    also fail if any question costs more than tools/nav-baseline.json
//   node tools/nav-budget.mjs URL OUT --update   measure and rewrite the baseline (commit it with the change)
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const {chromium}=createRequire(import.meta.url)('playwright');
const [base,out,mode]=process.argv.slice(2);
if(!base||!out)throw Error('Usage: node tools/nav-budget.mjs URL OUT [--check|--update]');
const here=new URL('.',import.meta.url),baselineFile=new URL('nav-baseline.json',here);
const {questions}=JSON.parse(readFileSync(new URL('nav-questions.json',here),'utf8'));
assert.ok(questions.length>0,'no questions');
// A regression is a question that costs at least this much more than its recorded baseline.
const SLACK=0.3;
const browser=await chromium.launch({...process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{channel:'chrome'},chromiumSandbox:true});
// Use hit testing, including sticky overlays. Count only scrolling required to reveal a control
// or readable leaf. App-driven jumps are free. Report horizontal adjustments, not finger distance.
async function expose(loc){
 await loc.waitFor({state:'visible',timeout:10000});
 return loc.evaluate(el=>{
  const viewport=window.visualViewport; const w=viewport?.width||innerWidth,h=viewport?.height||innerHeight;
  if(!(w>0&&h>0))throw Error('Empty viewport');
  const hit=()=>{
   const r=el.getBoundingClientRect(), l=Math.max(0,r.left),t=Math.max(0,r.top),rr=Math.min(w,r.right),bb=Math.min(h,r.bottom,t+48);
   if(rr-l<2||bb-t<Math.min(12,r.height))return null;
   for(const f of [.5,.25,.75]){const x=l+(rr-l)*f,y=t+(bb-t)*.5;const a=document.elementFromPoint(x,y);if(a&&(a===el||el.contains(a)))return {x,y};}
   return null;
  };
  let point=hit(),pixels=0,horizontal=0;
  if(!point){
   const scrolls=[document.scrollingElement];for(let e=el.parentElement;e;e=e.parentElement)if(e!==document.scrollingElement&&(e.scrollWidth>e.clientWidth||e.scrollHeight>e.clientHeight))scrolls.push(e);
   const before=scrolls.map(e=>[e.scrollTop,e.scrollLeft]);
   el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
   // Center a long paragraph's opening line, rather than its midpoint.
   const r=el.getBoundingClientRect();if(r.height>h*.65)window.scrollBy({top:r.top-h*.35,behavior:'instant'});
   for(let i=0;i<scrolls.length;i++){
    pixels+=Math.abs(scrolls[i].scrollTop-before[i][0]);if(Math.abs(scrolls[i].scrollLeft-before[i][1])>1)horizontal++;
   }
   point=hit();
  }
  if(!point)throw Error('No unobscured pointer target: '+el.outerHTML.slice(0,140));
  return {...point,scroll:pixels/h,horizontal};
 });
}
// Hold the first issue response, then change selection. Late data or an error for the
// previous issue must never overwrite the chosen record or replace the policy map.
async function checkIssueSwitches(){
 const page=await browser.newPage({viewport:{width:375,height:812}});
 try{
  for(const [first,next,fail] of [['threshold','aq:deposits',false],['protection','',true]]){
   await page.goto(new URL('#comments/issue',base).href);
   const picker=page.locator('#cm-issue-picker');await picker.waitFor();
   let release,started;
   const gate=new Promise(r=>{release=r}),intercepted=new Promise(r=>{started=r});
   const pattern='**/data/comments/issues/aq-'+first+'.json*';
   await page.route(pattern,async route=>{started();await gate;if(fail)await route.fulfill({status:503,body:''});else await route.continue();},{times:1});
   try {
    await picker.selectOption('aq:'+first);
    const timeout=AbortSignal.timeout(10000);
    await Promise.race([intercepted,new Promise((_,reject)=>timeout.addEventListener('abort',()=>reject(Error('First issue was never requested')),{once:true}))]);
    await picker.selectOption(next);
    const expected=next?'.cm-issue-readtitle':'.cm-pm-landing-h';
    await page.locator(expected).waitFor();
    const title=await page.locator(expected).innerText();
    const returned=page.waitForResponse(r=>r.url().includes('/aq-'+first+'.json'));
    release();await (await returned).finished();
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    assert.equal(await picker.inputValue(),next);assert.equal(await page.locator(expected).innerText(),title);
    assert.equal(page.url().split('#')[1],next?'comments/issue?id='+encodeURIComponent(next):'comments/issue');
   }finally{release();}
  }
 }finally{await page.close();}
}
const results=[],failures=[];
const cost=r=>+(r.clicks+r.entries+r.scroll+r.horizontal).toFixed(2);
try{
 for(const [device,width,height] of [['phone',375,812],['tablet',768,1024],['desktop',1280,800]]){
  for(const {id,q,steps,leaf:[target,pattern]} of questions){
   const ctx=await browser.newContext({viewport:{width,height},hasTouch:device!=='desktop',isMobile:device!=='desktop'}),p=await ctx.newPage();
   try{
    const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.url()+' '+r.status())});
    await p.goto(base);await p.locator('#panel-overview .filing-brief').waitFor();
    let scroll=0,horizontal=0,entries=0;const actions=[];
    async function reach(loc){const pos=await expose(loc);scroll+=pos.scroll;horizontal+=pos.horizontal;return pos;}
    for(const [name,selector,value] of steps){
     const loc=p.locator(selector).first(),pt=await reach(loc);
     if(device==='desktop')await p.mouse.click(pt.x,pt.y);else await p.touchscreen.tap(pt.x,pt.y);
     actions.push(name);
     if(value){assert.ok(await loc.evaluate(e=>e===document.activeElement),'typing target is not focused');await p.keyboard.insertText(value);entries++;}
    }
    const leaf=p.locator(target).first();await reach(leaf);
    assert.match(await leaf.innerText(),new RegExp(pattern,'i'));assert.deepEqual(errors,[]);
    assert.ok(await p.evaluate(()=>innerWidth>0&&document.documentElement.scrollWidth<=innerWidth),'page scrolls sideways');
    const r={device,id,q,clicks:steps.length,entries,horizontal,scroll:+scroll.toFixed(2),actions};
    results.push({...r,cost:cost(r)});
   }catch(e){failures.push(device+' / '+id+': '+e.message.split('\n')[0]);results.push({device,id,q,cost:null,error:e.message.split('\n')[0]});}
   finally{await ctx.close();}
  }
 }
 await checkIssueSwitches();
}finally{await browser.close();}
const devices=['phone','tablet','desktop'],baseline=existsSync(baselineFile)?JSON.parse(readFileSync(baselineFile,'utf8')):{};
const regressions=[];
for(const r of results){const was=baseline[r.device]?.[r.id];if(r.cost!==null&&was!=null&&r.cost>=was+SLACK)regressions.push(r.device+' / '+r.id+': '+was+' -> '+r.cost);}
mkdirSync(out,{recursive:true});
writeFileSync(join(out,'nav.json'),JSON.stringify(results,null,2)+'\n');
const cell=(id,d)=>{const r=results.find(x=>x.id===id&&x.device===d);if(!r||r.cost===null)return 'FAILS';const was=baseline[d]?.[id];return r.cost+(was!=null&&was!==r.cost?' ('+(r.cost>was?'+':'')+(r.cost-was).toFixed(2)+')':'');};
const total=d=>results.filter(r=>r.device===d&&r.cost!==null).reduce((a,r)=>a+r.cost,0).toFixed(1);
const md=['| Question | Phone | Tablet | Desktop |','|---|---|---|---|',...questions.map(({id,q})=>'| '+q+' | '+devices.map(d=>cell(id,d)).join(' | ')+' |'),'| **Total** | '+devices.map(total).join(' | ')+' |'].join('\n');
writeFileSync(join(out,'nav.md'),md+'\n');console.log(md);
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
writeFileSync(join(out,'nav.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Navigation budget</title><style>body{max-width:64rem;margin:2rem auto;padding:0 1rem;font:1rem/1.5 system-ui}table{border-collapse:collapse;width:100%}th,td{padding:.5rem;border-bottom:1px solid #ccc;text-align:left;vertical-align:top}small{display:block;color:#555}</style><h1>Interactions to answer each question</h1><p>Cost = taps or clicks + typed entries + screens scrolled + sideways adjustments, from a fresh home page. Lower is better.</p><table><tr><th>Question</th>'+devices.map(d=>'<th>'+d+'</th>').join('')+'</tr>'+questions.map(({id,q})=>'<tr><td>'+esc(q)+'<small>'+esc((results.find(r=>r.id===id&&r.actions)?.actions||[]).join(' → ')||'on the home page')+'</small></td>'+devices.map(d=>'<td>'+esc(cell(id,d))+'</td>').join('')+'</tr>').join('')+'</table></html>');
if(mode==='--update'){
 if(failures.length)throw Error('Not writing a baseline while questions fail:\n'+failures.join('\n'));
 const next={};for(const d of devices){next[d]={};for(const {id} of questions)next[d][id]=results.find(r=>r.id===id&&r.device===d).cost;}
 writeFileSync(baselineFile,JSON.stringify(next,null,1)+'\n');console.log('wrote tools/nav-baseline.json');
}
if(failures.length){console.error('Unanswerable:\n'+failures.join('\n'));process.exit(1);}
if(mode==='--check'){
 const unbaselined=questions.filter(({id})=>devices.some(d=>baseline[d]?.[id]==null)).map(x=>x.id);
 if(unbaselined.length){console.error('No baseline for: '+unbaselined.join(', ')+'. Run with --update and commit tools/nav-baseline.json.');process.exit(1);}
 if(regressions.length){console.error('Costs more than the baseline:\n'+regressions.join('\n'));process.exit(1);}
 console.log('✓ '+results.length+' routes within budget ('+questions.length+' questions × 3 sizes)');
}
