// Read complete public docket sheets before filtering dates. Reuse the page parser exercised by the
// Chrome-bridge workflow. Save one checkpoint per docket; never turn an unrendered grid into zero.
import {createRequire} from "node:module";
import {mkdir, readFile, writeFile, rename} from "node:fs/promises";
import {join, resolve} from "node:path";
const {chromium} = createRequire(import.meta.url)("playwright");
const [out,start="2026-06-18",end=new Date().toISOString().slice(0,10),...named]=process.argv.slice(2);
const docketPattern=/^(?:EL|ER|AD)\d{2}-\d+-\d{3}$/;
if (!out || ![start,end].every(s=>/^\d{4}-\d\d-\d\d$/.test(s) && new Date(s+"T12:00:00Z").toISOString().startsWith(s)) || start>end || !named.every(d=>docketPattern.test(d))) {
  console.error("Usage: node tools/sweep-show-cause.mjs OUT_DIR [SINCE THROUGH [DOCKET ...]]");process.exit(2);
}
const dockets=named.length?named:[...Array(6)].flatMap((_,i)=>["000","001"].map(s=>"EL26-"+(67+i)+"-"+s));
const snippet=(await readFile(new URL("./elibrary-sweep.js",import.meta.url),"utf8")).split("/* Reading a filing")[0].replace(/const CUTOFF = "\d{4}-\d\d-\d\d"/,"const CUTOFF = "+JSON.stringify(start));
const prior=JSON.parse(await readFile(new URL("../sources/filings/refresh-coverage.json",import.meta.url),"utf8"));
const floors=new Map(prior.dockets.map(d=>[d.docket,d.totalRows]));
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:"chrome",chromiumSandbox:true});
try {
  for (const docket of new Set(dockets)) {
    const page=await browser.newPage();
    const url="https://elibrary.ferc.gov/eLibrary/docketsheet?docket_number="+docket.slice(0,-4)+"&sub_docket="+docket.slice(-3);
    const result={docket,url,since:start,through:end};
    try {
      const [response]=await Promise.all([
        page.waitForResponse(r=>r.request().method()==="POST" && r.url().includes("/api/Docket/GetSingleDocketSheet"),{timeout:45000}),
        page.goto(url,{waitUntil:"domcontentloaded"})
      ]);
      const data=await response.json();
      if(!response.ok() || data.ErrorList?.length || !Array.isArray(data.DataList)) throw Error("Docket-sheet API did not return records");
      if(data.DataList.length) await page.waitForFunction(()=>/\d+\s*[–-]\s*\d+\s*of\s*[1-9]/.test(document.body.innerText));
      await page.waitForFunction(()=>/\d+\s*[–-]\s*\d+\s*of\s*\d+|0\s*of\s*0|No data was found/i.test(document.body.innerText),null,{timeout:45000});
      await page.evaluate(snippet);
      await page.waitForFunction(()=>window.__sweep?.status==="done",null,{timeout:90000});
      const sweep=await page.evaluate(()=>window.__sweep);
      if(sweep.rowsSeen!==sweep.total || (sweep.total && sweep.docket!==docket.slice(0,-4))) throw Error("Incomplete or mismatched docket: "+JSON.stringify([sweep.docket,sweep.rowsSeen,sweep.total]));
      // The portal can return 200/empty for a docket with a known history. Its
      // own "no data" banner on such a response is insufficient evidence.
      if(sweep.total<(floors.get(docket)??0)) throw Error("Official row count "+sweep.total+" below prior verified "+floors.get(docket)+"; retry later or review deletions.");
      if(!sweep.total && !/0\s*of\s*0|No data was found/i.test(await page.locator("body").first().innerText()))throw Error("No explicit empty result");
      Object.assign(result,{status:"checked",total:sweep.total,rowsSeen:sweep.rowsSeen,records:sweep.rows.filter(r=>r.filed<=end)});
    }catch(error){Object.assign(result,{status:"incomplete",error:String(error)});process.exitCode=1;}
    finally{await page.close();}
    const path=join(resolve(out),docket+".json");await writeFile(path+".part",JSON.stringify(result,null,2)+"\n");await rename(path+".part",path);
    console.log(docket,result.status,result.records?.length??result.error);
  }
}finally{await browser.close();}
