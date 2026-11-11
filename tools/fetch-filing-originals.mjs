// Capture the public attachments for named eLibrary accessions in a staging directory.
// NODE_PATH=<playwright modules> node tools/fetch-filing-originals.mjs --out /tmp/capture 20261109-5216
// Never replaces canonical sources. The file list is evidence even for unsupported file types.
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
const args = process.argv.slice(2);
if (args[0] !== "--out" || !args[1] || !args[2] || !args.slice(2).every(a => /^\d{8}-\d{4}$/.test(a))) {
  console.error("Usage: node tools/fetch-filing-originals.mjs --out STAGING_DIR YYYYMMDD-NNNN [...]"); process.exit(2);
}
const {chromium} = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({channel:"chrome", chromiumSandbox:true});
try {
  for (const acc of new Set(args.slice(2))) {
    const out = resolve(args[1], acc), url = "https://elibrary.ferc.gov/eLibrary/filelist?accession_Number=" + acc;
    const page = await browser.newPage(), files = [];
    await mkdir(out, {recursive:true});
    try {
      await page.goto(url, {waitUntil:"domcontentloaded"});
      const links = page.locator("a.filedownloadlink");
      await links.first().waitFor({state:"attached",timeout:30000});
      const names = (await links.allTextContents()).map(n=>n.trim().replace(/\s*\*$/, ""));
      for (const [i,label] of names.entries()) {
        const restricted = await links.nth(i).evaluate(a => {
          const row=a.closest('tr')?.innerText||'';
          return a.getAttribute('aria-disabled')==='true'||a.hasAttribute('disabled')||a.classList.contains('disabled')||/\b(?:CEII|privileged|non.public|restricted)\b/i.test(row);
        });
        if(restricted){files.push({label,status:"restricted or disabled"});continue;}
        if (!/\.(pdf|docx)$/i.test(label)) { files.push({label,status:"other format"}); continue; }
        const file = String(i+1).padStart(3,"0") + "-" + label.replace(/[^a-zA-Z0-9._-]+/g,"_");
        const temp = join(out, file + ".part");
        try {
          const [dl] = await Promise.all([page.waitForEvent("download",{timeout:45000}),links.nth(i).click()]);
          await dl.saveAs(temp);
          const bytes = await readFile(temp), pdf = /\.pdf$/i.test(file);
          if (!(pdf ? bytes.subarray(0,1024).includes(Buffer.from("%PDF-")) : bytes.subarray(0,2).toString()==="PK")) throw Error("file signature does not match extension");
          const hash = createHash("sha256").update(bytes).digest("hex");
          await rename(temp,join(out,file)); files.push({label,file,bytes:bytes.length,sha256:hash,status:"captured"});
        } catch(e) { await rm(temp,{force:true}); files.push({label,status:"failed",reason:String(e)});process.exitCode=1; }
      }
      if (!files.some(f=>f.status==="captured")) throw Error("no PDF or DOCX captured");
    } catch(e) {files.push({status:"failed",reason:String(e)});process.exitCode=1;}
    finally {await page.close(); await writeFile(join(out,"inventory.json"),JSON.stringify({accession:acc,url,files},null,2)+"\n");}
    console.log(acc,files.filter(f=>f.status==="captured").length,"captured of",files.length,"listed");
  }
} finally {await browser.close();}
