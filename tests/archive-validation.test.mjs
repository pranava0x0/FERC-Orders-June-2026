import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cwd = fileURLToPath(new URL('../', import.meta.url));
const py = code => spawnSync('python3',['-c',code],{cwd,encoding:'utf8'});
const ready = py('import fitz').status === 0;
test('an unchanged page count cannot conceal shuffled markers, a blank citation page or a changed decimal', {skip: !ready},()=>{
  const result=py(`import runpy
audit=runpy.run_path('tools/revalidate-archive.py')
cmp=audit['pdf_comparison']
original=['PJM   2.5 MW.', '', 'Third page']
markers='--- PAGE 1 ---\\nPJM 2.5 MW.\\n--- PAGE 2 ---\\n\\n--- PAGE 3 ---\\nThird page\\n'
assert cmp(original,markers)=={'status':'matches','pages':3,'emptyTextLayerPages':[2]}
assert cmp([''],'--- PAGE 1 ---\\n')['status']=='no-text-layer'
assert cmp(original,markers.replace('PAGE 2','PAGE 1'))['status']=='invalid-page-markers'
assert cmp(original,markers.replace('PJM 2.5','pjm 2,5'))['differingPages']==[1]
assert cmp(original,markers.replace('PAGE 3 ---\\nThird page','PAGE 3 ---'))['differingPages']==[3]
assert audit['match_name']('File (002).PDF')==audit['match_name']('File.pdf')
assert audit['match_name']('Another.pdf')!=audit['match_name']('File.pdf')
assert audit['problems']({'nested':[{'status':'scan-without-ocr'}],'checks':[{'exit':2}]})==2`);
  assert.equal(result.status,0,result.stderr);
});

test('each flagship shows its audited quotation, on the cited page or in an unpaginated filing', async () => {
  const {readFileSync} = await import('node:fs');
  const vm = await import('node:vm');
  const {join} = await import('node:path');
  const text = file => readFileSync(join(cwd,file), 'utf8');
  const ctx = {window:{}};
  vm.runInNewContext(text('docs/js/data.js'),ctx);
  const digest = JSON.parse(text('sources/comments/rm26-4-flagships-digest.json'));
  const clean = s => s.trim().replace(/\s+/g,' ');
  for (const card of ctx.window.FERC_DATA.comments.flagships) {
    const seed=JSON.parse(text('sources/comments/summaries/'+card.acc+'.json'));
    const q=seed.quotes[0];
    assert.equal(card.quote||null,q?.text||null,card.acc);
    assert.equal(digest.find(row=>row.acc===card.acc)?.quote,q?.text||null,card.acc);
    if (!q) continue;
    const cited=seed.files.flatMap(f=>{
      const body=text(f.text), matches=[...body.matchAll(/^--- PAGE (\d+) ---[ \t]*$/gm)];
      if (!matches.length) return q.page==null?[body]:[];
      return matches.flatMap((m,i)=>+m[1]===q.page?[body.slice(m.index+m[0].length,matches[i+1]?.index)]:[]);
    });
    assert.ok(cited.some(body=>clean(body).includes(clean(q.text))),card.acc);
  }
});
