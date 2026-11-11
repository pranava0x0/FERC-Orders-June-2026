// Reader UAT: node tools/uat-filing-readers.mjs BASE [BASELINE] [ARTIFACT_DIRECTORY]
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {join} from 'node:path';
const {chromium}=createRequire(import.meta.url)('playwright'),[base,baseline,out='/tmp/ferc-reading-uat']=process.argv.slice(2);
if(!base)throw Error('Provide a local site URL, optionally the previous version and output directory.');
const browser=await chromium.launch({...process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{channel:'chrome'},chromiumSandbox:true});
const results=[];mkdirSync(out,{recursive:true});
async function home(ctx,url){
 const page=await ctx.newPage(),responses=[],errors=[];page.on('response',r=>{if(r.url().startsWith(url))responses.push(r);if(r.status()>=400)errors.push(r.url())});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url,{waitUntil:'networkidle'});
 const count=await page.locator('#panel-overview h2').count();assert.ok(count,'Overview never rendered');
 const bytes=await Promise.all(responses.map(async r=>({bytes:(await r.body()).length,gz:gzipSync(await r.body()).length,url:r.url().slice(url.length)})));
 assert.ok(!bytes.some(r=>r.url.startsWith('reading/')),'Overview downloads a reader before navigation');
 assert.deepEqual(errors,[]);return {page,stats:{requests:bytes.length,gzipBytes:bytes.reduce((n,r)=>n+r.gz,0),rawBytes:bytes.reduce((n,r)=>n+r.bytes,0)}};
}
try{for(const [width,height] of [[375,812],[768,1024],[1280,800]]){
 const viewport={width,height},ctx=await browser.newContext({viewport,hasTouch:width<1000}),record={width,height};
 if(baseline){const b=await home(ctx,baseline);record.baseline=b.stats;await b.page.close();}
 const {page,stats}=await home(ctx,base);record.overview=stats;
 const leads=page.locator('#panel-overview .reader-leads a'),names=await leads.allTextContents();assert.ok(names.length>=3);
 const requests=[];page.on('response',r=>{if(r.status()>=400)throw Error('Bad response '+r.status()+' '+r.url());requests.push(r.url())});
 record.paths=[];for(const name of names){
 await page.getByRole('link',{name,exact:true}).first().click();await page.waitForLoadState();
 const id=decodeURIComponent(new URL(page.url()).hash.slice(1)),section=page.locator('[id="'+id+'"]');assert.equal(await section.count(),1);
 const pos=await section.evaluate(e=>({w:innerWidth,top:e.getBoundingClientRect().top,overflow:document.documentElement.scrollWidth>innerWidth}));
 assert.ok(pos.w>0&&!pos.overflow&&pos.top>=-1&&pos.top<height,'Fragment landed outside viewport');
 const cite=section.locator('cite a').first();const text=await cite.innerText();
 const target=await cite.getAttribute('href');assert.ok(target.startsWith('text.html#p-'));
 if(record.paths.length===0&&width!==768)await page.screenshot({path:join(out,'source-'+width+'.png')});
 await cite.click();const pageId=new URL(page.url()).hash.slice(1);assert.ok((await page.locator('#'+pageId+' pre').innerText()).length>20);
 record.paths.push({name,actionsToClause:1,actionsToPage:2,page:text});await page.goto(base);await leads.first().waitFor();
 }
 assert.ok(!requests.some(u=>u.endsWith('source.json')),'HTML reader fetched machine data');
 await page.locator('#tab-news').click();
 const state=page.locator('#panel-news .state-lead h2 a');await state.click();
 assert.equal(new URL(page.url()).hash,'#state-commissions');
 assert.ok((await page.locator('#state-commissions').innerText()).includes('abstained'));
 assert.ok(await page.locator('.position').count()>0);record.newsToStateRollCall=2;
 const x=await page.evaluate(()=>[innerWidth,document.documentElement.scrollWidth]);assert.ok(x[0]>0&&x[1]<=x[0]);

 const staticCtx=await browser.newContext({viewport,javaScriptEnabled:false});const staticPage=await staticCtx.newPage();
 await staticPage.goto(base);await staticPage.getByRole('link',{name:names[0],exact:true}).first().focus();await staticPage.keyboard.press('Enter');await staticPage.locator('section:target cite a').focus();await staticPage.keyboard.press('Enter');await staticPage.waitForURL('**/text.html#p-*');
 assert.ok(await staticPage.locator('section:target pre').isVisible(),'No-JS route failed');
 await staticPage.goto(new URL('reading/order-el26-69-001-nyiso-rehearing/text.html',base).href);
 await staticPage.locator('a[href="#note-fn-8"]').first().focus();await staticPage.keyboard.press('Enter');await staticPage.waitForURL('**/text.html#note-fn-8');
 assert.ok(await staticPage.locator('#note-fn-8').evaluate(e=>(e.nextSibling?.textContent||'').includes('NYISO could propose Tariff revisions establishing its own definition')));
 record.noJs=true;record.wordNote=true; if(record.baseline)assert.ok(stats.requests<=record.baseline.requests,'Extra initial request');
 results.push(record);await staticCtx.close();await ctx.close();
}}finally{await browser.close();}
writeFileSync(join(out,'results.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));
