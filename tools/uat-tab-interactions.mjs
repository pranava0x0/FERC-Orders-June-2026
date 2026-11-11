// Physical pointer paths from a fresh Overview. Usage: node tools/uat-tab-interactions.mjs URL OUT
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const {chromium}=createRequire(import.meta.url)('playwright');
const [base,out]=process.argv.slice(2);
if(!base||!out)throw Error('Supply the site URL and an output directory.');
const browser=await chromium.launch({...process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{channel:'chrome'},chromiumSandbox:true});
const tab=name=>['Open '+name,'#tab-'+name], comments=tab('comments');
const paths=[
 ['Overview','Registry access: original page',[['Registry access','#panel-overview .reader-leads a'],['Cited page','section:target cite a']],'section:target pre',/Authorized Commissions/i],
 ['Timeline','Latest event in the show-cause track',[tab('timeline'),['Show-cause track','.trk-card[data-track="sc6"]'],['Latest event','#tl-jump']],'.tl-item[data-track="sc6"]:focus .tl-title',/\S/],
 ['Reforms','Cost-shifting mandate',[tab('reforms'),['Cost-shifting category','details.cat:has(.cat-title:text("Cost-shifting")) > summary']],'details.cat[open]:has(.cat-title:text("Cost-shifting")) .cat-ferc',/cost/i],
 ['Dockets','PJM E-7 order page',[tab('dockets'),['PJM docket page','a.docket-page-link[href*="el26-67-000"]']],'h1',/PJM/i],
 ['Filings','Google’s MISO protest: original cited page',[tab('filings'),['MISO LARS','.fg-nav [data-jump="#fg-miso-lars"]:visible, #fg-miso-lars > summary'],['Google','#fg-miso-lars [data-filer="Google"]'],['Cited page','#fg-miso-lars .tenet:visible .tq-cite:visible a[href*="protest-er27-25-google/text.html#"]']],'section:target pre',/\S/],
 ['Commissioners','Rosner’s timestamped statement',[tab('commissioners'),['Rosner','.who-chip[data-who="rosner"]']],'.appear:visible .sq[data-who="rosner"]:visible .sq-cite a[href*="&t="]',/\d+:\d{2}/],
 ['Comments · Themes','PJM regional comment record',[comments,['PJM region','#cmsec-overview .cm-region[href*="pjm" i]']],'#cm-issue-reader .cm-issue-readtitle',/PJM/i],
 ['Comments · By issue','An issue and its first verbatim quote',[comments,['By issue','#cmsub-issue'],['Issue in policy map','.cm-pm-gridrow'],['Verbatim quotes','#cm-issue-reader .cm-issue-quotes > summary:visible']],'#cm-issue-reader .cm-issue-quotes[open] .cm-bq',/\S{3}/],
 ['Comments · Types','Expand a respondent roster',[comments,['Respondent types','#cmsub-types'],['Show all','#cmsec-types .cm-showmore']],'#cmsec-types .cm-type:has(.cm-showmore[aria-expanded="true"]) .cm-eg-rest .cm-eg',/\S/],
 ['Comments · All','Find Constellation and read a quoted position',[comments,['All comments','#cmsub-summaries'],['Search','#cm-search','Constellation'],['Read analysis','.cm-row:visible:has(.cm-row-org:text("Constellation")) details.cm-analysis > summary']],'details.cm-analysis[open] .cm-bq',/\S{3}/],
 ['Discourse','OPSI’s commission roll calls',[tab('news'),['State commissions','#panel-news .state-lead h2 a']],'#state-commissions p',/abstained/],
];
const results=[];
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
try{
 for(const [device,width,height] of [['phone',375,812],['tablet',768,1024],['desktop',1280,800]]){
  for(const [area,goal,steps,target,expected] of paths){
   const ctx=await browser.newContext({viewport:{width,height},hasTouch:device!=='desktop',isMobile:device!=='desktop'}),p=await ctx.newPage();
   try{
    const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.url()+' '+r.status())});
    await p.goto(base);await p.locator('#panel-overview .filing-brief').waitFor();
    let scroll=0,horizontal=0,entries=0,citedQuote;const actions=[];
    async function reach(loc){const pos=await expose(loc);scroll+=pos.scroll;horizontal+=pos.horizontal;return pos;}
    for(const [name,selector,value] of steps){
     const loc=p.locator(selector).first(),pt=await reach(loc);
     if(area==='Discourse' && name==='State commissions'){
      assert.ok(await p.locator('#panel-news .reader-leads article').evaluateAll(els=>els.length>0&&els.every((el,i)=>el.querySelector('.src-chip')?.href===window.FERC_DATA.SOURCES[window.FERC_DATA.meta.readingLeads[i].cite].url)));
     }
     if(area==='Filings' && name==='Cited page')citedQuote=await loc.evaluate(e=>e.closest('li').querySelector('blockquote').innerText);
     if(device==='desktop')await p.mouse.click(pt.x,pt.y);else await p.touchscreen.tap(pt.x,pt.y);
     actions.push(name);
     if(value){assert.ok(await loc.evaluate(e=>e===document.activeElement));await p.keyboard.insertText(value);entries++;}
    }
    const leaf=p.locator(target).first();await reach(leaf);
    assert.match(await leaf.innerText(),expected);assert.deepEqual(errors,[]);
    if(area==='Discourse')assert.equal(new URL(p.url()).hash,'#state-commissions');
    if(area==='Filings'){
     assert.match(p.url(),/protest-er27-25-google\/text\.html#p-\d+$/);
     const norm=s=>s.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
     assert.ok(norm(await leaf.innerText()).includes(norm(citedQuote)),'Wrong original page for the quoted protest');
    }
    assert.ok(await p.evaluate(()=>innerWidth>0&&document.documentElement.scrollWidth<=innerWidth));
    results.push({device,area,goal,clicks:steps.length,entries,horizontal,scroll:+scroll.toFixed(2),actions,target:new URL(p.url()).pathname+new URL(p.url()).hash});
   }catch(e){throw Error(device+' / '+area+': '+e.message,{cause:e});}finally{await ctx.close();}
  }
 }
 await checkIssueSwitches();
}finally{await browser.close();}
mkdirSync(out,{recursive:true});
writeFileSync(join(out,'interactions.json'),JSON.stringify(results,null,2)+'\n');
const label=r=>r.clicks+' clicks'+(r.entries?', '+r.entries+' text entry':'')+'; '+r.scroll.toFixed(2)+' screens; '+r.horizontal+' horizontal';
const rows=paths.map(([area,goal])=>'| '+area+' | '+goal+' | '+results.filter(r=>r.area===area).map(label).join(' | ')+' |');
const md=['| Tab | Destination | Phone | Tablet | Desktop |','|---|---|---|---|---|',...rows].join('\n');
writeFileSync(join(out,'interactions.md'),md+'\n');console.log(md);
// The human-readable view uses the same observed results as the machine-readable log.
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const reports=['phone','tablet','desktop'].map((device,index)=>{
 const cards=results.filter(r=>r.device===device).map(r=>'<tr><th scope="row">'+escape(r.area)+'</th><td>'+escape(r.goal)+'<small>'+r.actions.map(escape).join(' → ')+'</small></td><td>'+r.clicks+(r.entries?' + 1 entry':'')+'</td><td>'+r.scroll.toFixed(2)+'</td><td>'+r.horizontal+'</td></tr>').join('');
 return '<details '+(index===0?'open':'')+'><summary>'+['Phone · 375 × 812','Tablet · 768 × 1024','Desktop · 1280 × 800'][index]+'</summary><div><table><thead><tr><th>Tab</th><th>Destination and actions</th><th>Taps / clicks</th><th>Scroll¹</th><th>Sideways²</th></tr></thead><tbody>'+cards+'</tbody></table></div></details>';
}).join('');
writeFileSync(join(out,'interactions.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FERC tracker: tab interactions</title><style>*{box-sizing:border-box}body{max-width:64rem;margin:2rem auto;padding:0 1rem;color:#172b39;background:#faf9f5;font:1rem/1.55 system-ui}h1{font:700 clamp(2rem,5vw,3.5rem)/1.1 Georgia,serif}summary{cursor:pointer;font-weight:700;padding:.85rem 0}details{border-top:1px solid #647981}details div{overflow-x:auto}table{border-collapse:collapse;width:100%;text-align:left}th,td{padding:.65rem;vertical-align:top;border-bottom:1px solid #ccc}thead{background:#e0e9eb}small{display:block;color:#405660}</style><main><h1>From Overview to the evidence</h1><p>Eleven paths through all eight tabs. Each starts from a fresh Overview and ends when the named destination is readable. Expand a screen size to see the actual route.</p>'+reports+'<p>¹ Vertical scroll in viewport heights, accumulated when moving a control or destination into view. Automatic navigation jumps are excluded. ² Number of horizontal scroll adjustments. A search entry is counted separately from tapping the field. The commissioner test ends at the timestamp link; it does not play the video.</p></main></html>');
