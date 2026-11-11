// Rebuild the HTML reading room from the per-document source index and reviewed evidence.
// node tools/build-filing-readers.mjs [--check]
import {existsSync, readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {loadData} from './build-seo.mjs';
const root=join(dirname(fileURLToPath(import.meta.url)),'..'), out=join(root,'docs/reading');
const read=p=>JSON.parse(readFileSync(p,'utf8')), seed=f=>read(join(root,'sources/filings',f));
const catalog=read(join(out,'catalog.json')), groups=seed('tenets.json').groups;
const SITE='https://pranava0x0.github.io/FERC-Orders-June-2026/reading/';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const slug=s=>s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const pin=s=>'read-'+slug(s);
const all=Object.assign({},...['pjm-sections.json','new-sections.json','regional-sections.json'].filter(f=>existsSync(join(root,'sources/filings',f))).map(seed));
const voices=seed('perspectives.json'),coverage=seed('refresh-coverage.json');
const bySlug=new Map(catalog.map(r=>[r.slug,r]));
const check=process.argv.includes('--check'), writes=[];
function emit(name,data){const p=join(out,name);if(existsSync(p)&&readFileSync(p,'utf8')===data)return;if(check)throw Error('stale '+name);writeFileSync(p,data);writes.push(name);}
if(!all['compliance-er26-3515-pjm']?.length||!all['refiling-er27-454-pjm-backstop']?.length||!voices.length)throw Error('Missing PJM readings or public perspectives');
for(const k of ['pjm-sections.json','new-sections.json'])if(!Object.keys(seed(k)).length)throw Error('Empty section file '+k);
for(const s of Object.keys(all))if(!bySlug.has(s))throw Error('No original for readings: '+s);
const verifyUrl=s=>{if(!/^https?:\/\//.test(s))throw Error('invalid citation: '+s);return s};
for(const v of voices){verifyUrl(v.url);if(!['direct','related'].includes(v.relation)||!['state','commissioner','coverage','party'].includes(v.kind)||!v.text||!v.locator)throw Error('invalid perspective '+v.title);for(const k of v.slugs)if(!bySlug.has(k))throw Error('unknown perspective document '+k);}
const css=readFileSync(join(root,'docs/css/reading.css'));
const ver=createHash('sha256').update(css).digest('hex').slice(0,10);
function frame(title,desc,content,sub='',extra=''){
  const url=SITE+sub,b=sub.includes('/')?'../../':'../';
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+esc(title)+' | Large Load Interconnection</title><meta name="description" content="'+esc(desc)+'"><link rel="canonical" href="'+esc(url)+'"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(desc)+'"><link rel="stylesheet" href="'+b+'css/reading.css?v='+ver+'">'+extra+'</head><body><a class="skip" href="#main">Skip to content</a><header><nav aria-label="Site"><a href="'+b+'">Large Load Interconnection</a><a href="'+b+'#filings">Filings</a><a href="'+(sub.includes('/')?'../':'./')+'">Reading room</a></nav></header><main id="main">'+content+'</main><footer>Independent analysis of public records. <a href="https://pranavaraparla.com" target="_blank" rel="noopener noreferrer">Pranava Raparla</a> · <a href="https://github.com/pranava0x0/FERC-Orders-June-2026" target="_blank" rel="noopener noreferrer">Source repository</a></footer></body></html>\n';
}
const topics=[
 ['Cost allocation',/\bcost (?:allocation|causation|shift)|\bratepayers?|\bRBP Charges?\b|network upgrade costs?/gi],
 ['Credit and exit',/\bcollateral\b|\bcredit requirements?\b|\bwithdrawal liability\b|\bdefault allocation\b/gi],
 ['Registry access',/\b(?:registry|confidential information|consumer advocates?)\b/gi],
 ['Connecting load and generation',/\b(?:interconnection queue|queue position|LARS|co-located load|interconnection service)\b/gi],
 ['Reliability and curtailment',/\b(?:curtailment|resource adequacy|load shed|capacity shortage|demand flexibility)\b/gi],
 ['Retail and wholesale authority',/\b(?:retail jurisdiction|retail rate|retail service|state jurisdiction|state authority)\b/gi],
 ['Filing procedure',/\b(?:abeyance|rehearing|extension of time|filing deadline)\b/gi],
];
function salient(text){let scores=topics.map(([name,re])=>[name,[...text.matchAll(re)].length]).filter(x=>x[1]);return scores.sort((a,b)=>b[1]-a[1]);}
function short(text,n=300){let t=text.trim().replace(/\s+/g,' ');if(t.length<=n)return t;return t.slice(0,n).replace(/\s+\S*$/,'')+'…';}
function perspective(v){
 const first=/^PDF pp?\.\s*(\d+)/i.exec(v.locator)?.[1],link=new URL(v.url);
 if(first&&/\.pdf$/i.test(link.pathname)&&!link.hash)link.hash='page='+first;
 return '<article class="position"><h4>'+esc(v.title)+'</h4><p class="by">'+esc(v.speaker)+' · '+(v.relation==='related'?'Related public statement':'Direct response')+'</p><p>'+esc(v.text)+'</p><a href="'+esc(link.href)+'">'+esc(v.locator)+'</a></article>';
}
// Python indexes Unicode code points; JavaScript string offsets normally count UTF-16 units.
function span(t,a,b){return /[\uD800-\uDBFF]/.test(t)?Array.from(t).slice(a,b).join(''):t.slice(a,b);}
function sourceFragment(pages,s){
 const a=s.p-1,b=s.endPage-1;
 return a===b?span(pages[a].text,s.at,s.endAt):[span(pages[a].text,s.at),...pages.slice(a+1,b).map(p=>p.text),span(pages[b].text,0,s.endAt)].join('\n');
}
function extract(text){const sentences=text.replace(/\s+/g,' ').split(/(?<=[.!?])\s+(?=[A-Z“])/u);
 const ranked=sentences.map((s,i)=>({s,i,n:(s.length>48&&s.length<720?4:0)+(salient(s)[0]?.[1]||0)*2+(/\b(shall|asks|requests|proposes|must|we find|we grant|we deny|we accept)\b/i.test(s)?5:0)-(/\.{3,}|Respectfully submitted|certificate of service/i.test(s)?8:0)})).sort((a,b)=>b.n-a.n||a.i-b.i);
 return short(ranked[0]?.s||text);}
function ref(pg,paginated){return '<a href="text.html#p-'+pg+'">'+(paginated?'PDF p. '+pg:'Source text')+'</a>';}
// Companion-docket commentary stays distinct from a response to any particular section.
// Only link an excerpt when the same physical page contains the topic and an argument or request.
const filingThread=new Map();
const docketKey=r=>/^[A-Z]{2}\d{2}-\d+/.exec(r.docket)?.[0];
const threadHref=(k,t)=>'discussion-'+k.toLowerCase()+'.html'+(t?'#'+slug(t):'');
for(const r of catalog){
 const k=docketKey(r);if(!k||r.parent||!/(protest|comments|rehearing|statement of position|motion for leave to answer)/i.test(r.kind))continue;
 const entries=filingThread.get(k)||new Map();
 for(const pg of read(join(out,r.slug,'source.json')).pages){
  const text=pg.text.replace(/\s+/g,' '),sentences=text.match(/[^.!?]+(?:[.!?](?=\s|$)|$)/g)||[];
  for(const sent of sentences){
   const str=sent.trim();if(str.length<65||str.length>560||/respectfully submitted|certificate of service|\.{3}|^\d+\s+See /i.test(str)||!(/\b(?:should|would|requests?|asks?|supports?|opposes?|objects?|argues?|recommends?|concerned)\b/i.test(str)))continue;
   for(const [topic] of salient(str)){
    if(!entries.has(topic))entries.set(topic,new Map());
    const byDoc=entries.get(topic);if(!byDoc.has(r.slug))byDoc.set(r.slug,{r,pg:pg.page,text:str});
   }
  }
 }
 if(entries.size)filingThread.set(k,entries);
}
for(const [k,topicsInDocket] of filingThread){
 const body=[...topicsInDocket].sort(([a],[b])=>a.localeCompare(b)).map(([topic,byDoc])=>'<section id="'+slug(topic)+'"><h2>'+esc(topic)+'</h2>'+[...byDoc.values()].map(({r,pg,text})=>'<article class="finding"><h3><a href="'+r.slug+'/">'+esc(r.filer||r.title)+'</a></h3><p class="meta">'+esc(r.docket)+' · '+esc(r.issued)+'</p><blockquote>'+esc(text)+' <cite><a href="'+r.slug+'/text.html#p-'+pg+'">'+(r.pages?'PDF p. '+pg:'Source text')+'</a></cite></blockquote></article>').join('')+'</section>').join('');
 emit(threadHref(k),frame(k+' comments by topic','Topic-matched excerpts from filed comments and protests.','<h1>'+esc(k)+': the filed comments</h1><p>These passages match a topic and a request or argument in the same sentence. A filing can quote another party. Read its page before attributing a position.</p>'+body,threadHref(k)));
}
function discussion(k,text){
 const e=filingThread.get(k);if(!e)return '';
 const topic=salient(text).map(x=>x[0]).find(t=>e.has(t));
 return topic?' <a class="xref" href="../'+threadHref(k,topic)+'">Filed comments: '+esc(topic)+'</a>':'';
}
const guide=[],voiceLinks=new Map();
for(const r of catalog){
 const {pages,sections}=read(join(out,r.slug,'source.json')),paginated=r.pages!==null;
 const local=(all[r.slug]||[]).map(x=>({...x})), verified=groups.flatMap(g=>g.tenets.flatMap(t=>t.quotes.filter(q=>q.d===r.slug).map(q=>({title:t.tenet,take:'',quote:q.q,pg:q.pg||1,start:q.pg||1,end:q.pg||1,theme:''}))));
 const curated=local.length?local:verified;
 const docVoices=voices.filter(v=>v.slugs.includes(r.slug)),shown=new Set(),ids=new Set();
 let claims='';
 for(const c of curated){
   const pg=c.pg||1; const source=pages[pg-1];
   // Older verified tenets can span a page break; their printed citation marks its start.
   // Source quotations may omit a superscript note marker. Only ignore our explicitly
   // generated Word markers for matching; keep all source words, notes and displayed markers.
   const text=source?.text||'',q=norm(c.quote),a=norm(paginated?text:text.replace(/\[(?:fn|en):-?\d+\]/g,''));
   if(local.length&&ids.has(pin(c.title)))throw Error(r.slug+' duplicate section title '+c.title);
   if(!q||!source||c.start<1||c.end>pages.length||pg<c.start||pg>c.end||!(a.includes(q)||(!local.length&&(a+norm(pages[pg]?.text||'')).includes(q))))throw Error(r.slug+' citation does not match page '+pg+': '+c.quote.slice(0,95));
   let id=pin(c.title);if(ids.has(id))id+='-'+pg;if(ids.has(id))id+='-'+ids.size;ids.add(id);
   const selected=docVoices.filter(v=>{let terms=Array.isArray(v.match)?v.match:v.match?[v.match]:[];return terms.some(k=>(c.title+' '+c.theme).toLowerCase().includes(k.toLowerCase()));});
   selected.forEach(v=>{shown.add(v);if(!voiceLinks.has(v))voiceLinks.set(v,[]);voiceLinks.get(v).push([r.slug+'/#'+id,c.title]);});
   claims+='<section class="finding" id="'+id+'"><p class="folio">'+esc(c.theme)+(c.theme?' · ':'')+(paginated?'PDF '+(c.start===c.end?'p. '+c.start:'pp. '+c.start+'–'+c.end):'Unpaginated filing')+'</p><h3>'+esc(c.title)+'</h3>'+(c.take?'<p>'+esc(c.take)+'</p>':'')+'<blockquote>'+esc(c.quote)+' <cite>'+ref(pg,paginated)+'</cite></blockquote>'+selected.map(perspective).join('')+discussion(docketKey(r),c.take+' '+c.quote)+'</section>';
 }
 const overviewTopics=salient(pages.map(p=>p.text).join(' ')).slice(0,3).map(x=>x[0]);
 const related=docVoices.filter(v=>!shown.has(v));
 const sourceBlocks=sections.map((s,i)=>{
   if(local.length)return '<li id="section-'+(i+1)+'"><a href="text.html#section-'+(i+1)+'">'+esc(s.title)+'</a> <span class="meta">'+(paginated?'p. '+s.p:'Source text')+'</span></li>';
   const text=sourceFragment(pages,s),snippet=extract(text),theme=salient(text)[0]?.[0];
   if(!text.trim())return '';
   return '<section id="section-'+(i+1)+'"><h3>'+esc(s.title)+'</h3><p class="folio">'+esc(s.method)+(theme?' · Topic match: '+esc(theme):'')+'</p>'+(snippet?'<blockquote>'+esc(snippet)+'</blockquote>':'')+'<a href="text.html#section-'+(i+1)+'">Read this passage</a>'+discussion(docketKey(r),text)+'</section>';
 }).join('');
 const links=catalog.filter(x=>x.parent===r.slug);
 const evidenceHeading=curated.length?'What the document says':'Passages from the original';
 const raw='https://github.com/pranava0x0/FERC-Orders-June-2026/blob/main/'+r.file.split('/').map(encodeURIComponent).join('/');
 const description=short(curated[0]?.take||curated[0]?.title||r.title);
 const summary='<p class="meta">'+esc(r.docket)+' · '+esc(r.issued)+(r.filer?' · '+esc(r.filer):'')+'</p><h1>'+esc(r.title)+'</h1>';
 const sourceNav='<nav class="tools" aria-label="Source material"><a href="'+esc(r.url)+'">Official source</a><a href="'+raw+'">Archived original</a><a href="text.html">Full text</a><a href="source.json">Page data (JSON)</a></nav>';
 const readings=curated.length?'<h2 id="findings">'+evidenceHeading+'</h2>'+ (local.length>3?'<nav class="contents" aria-label="Section readings">'+local.map(c=>'<a href="#'+pin(c.title)+'">'+esc(c.title)+'</a>').join('')+'</nav>':'')+claims:'';
 const notes=docVoices.length?related.map(perspective).join(''):'<p>No section-specific public response is linked for this document.</p>';
 const article=summary+sourceNav+(r.parent?'<p><a href="../'+r.parent+'/">Read the parent filing</a></p>':'')+
   (links.length?'<nav class="contents" aria-label="Attachments">'+links.map(x=>'<a href="../'+x.slug+'/">'+esc(x.title)+'</a>').join('')+'</nav>':'')+
   (filingThread.has(docketKey(r))?'<p><a href="../'+threadHref(docketKey(r))+'">Read topic-matched comments in '+esc(docketKey(r))+'</a></p>':'')+
   (overviewTopics.length?'<p class="terms">Topics in the text: '+esc(overviewTopics.join(' · '))+'</p>':'')+readings+
   (notes?'<section><h2>Responses and related views</h2>'+notes+'</section>':'')+'<h2>Source sections</h2><p class="muted">Printed headings where available; page ranges otherwise. '+(local.length?'Open a heading to read the original passage. ':'Excerpts below are selected from the text by keyword. ')+''+(r.text_file?'This transcription includes OCR of scanned material; consult the original for exact wording. ':'')+(r.emptyPages.length?'Pages with no text layer: '+r.emptyPages.join(', ')+'. ':'')+'</p>'+(local.length?'<ul class="directory">'+sourceBlocks+'</ul>':'<div class="outline">'+sourceBlocks+'</div>');
 const ld=JSON.stringify({'@context':'https://schema.org','@type':'Article',headline:r.title,description,mainEntityOfPage:SITE+r.slug+'/',citation:r.url,about:r.docket}).replaceAll('<','\\u003c');
 emit(r.slug+'/index.html',frame(r.title,description,article,r.slug+'/','<script type="application/ld+json">'+ld+'</script>'));
 let count=0;
 const noteLinks=t=>t.replace(/\[(fn|en):(-?\d+)\]/g,(m,kind,n,off,html)=>{
   if(off>0 && html[off-1]==='\n' && html.lastIndexOf(kind==='fn'?'Footnotes\n':'Endnotes\n',off)>=0)return '<span id="note-'+kind+'-'+n+'">'+m+'</span>';
   return '<a href="#note-'+kind+'-'+n+'">'+m+'</a>';
 });
 const full=pages.map(p=>{
   let body='',at=0;while(count<sections.length && sections[count].p===p.page){let s=sections[count];body+=esc(span(p.text,at,s.at))+'<span id="section-'+(count+1)+'"></span>';at=s.at;count++;}
   body+=esc(span(p.text,at));return '<section id="p-'+p.page+'"><h2>'+(paginated?'PDF page '+p.page:'Document text')+'</h2><pre>'+ ((!paginated?noteLinks(body):body)||'[No extractable text on this page.]')+'</pre></section>';
 }).join('');
 emit(r.slug+'/text.html',frame(r.title+' · full text',description,summary+'<a href="./">Back to sections and commentary</a>'+(!paginated?'<p>Word notes use stable document IDs, such as [fn:8], which can differ from printed footnote numbers.</p>':'')+full,r.slug+'/text.html'));
 guide.push({...r,topics:overviewTopics,count:curated.length,viewpoints:docVoices.length});
}
const linksFor=g=>g.sort((a,b)=>b.issued.localeCompare(a.issued)||a.title.localeCompare(b.title)).map(x=>'<li><a href="'+x.slug+'/">'+esc(x.title)+'</a><span>'+esc(x.docket)+' · '+esc(x.issued)+(x.count?' · '+x.count+' cited readings':' · source text')+'</span></li>').join('');
const grouped=new Map();for(const r of guide){if(!grouped.has(r.group))grouped.set(r.group,[]);grouped.get(r.group).push(r);}
const names=[...grouped.keys()].sort(),nav=xs=>'<nav class="contents">'+xs.join('')+'</nav>';
const leads=loadData().meta.readingLeads.map(t=>'<a href="'+esc(t.href.replace(/^reading\//,''))+'">'+esc(t.title)+'</a>');
const cover='<h1>The filing record</h1><p class="intro">The June orders, the responses and the documents behind them. Follow a section to the words on the page.</p><p>'+guide.length+' archived originals · '+guide.filter(r=>r.pages).length+' PDFs · <a href="catalog.json">Download the inventory</a></p>';
const D=loadData(),lead=D.meta.stateLead;
const stateLead='<section id="state-commissions"><h2>'+esc(lead.title)+'</h2><p>'+esc(lead.text)+'</p><nav class="tools">'+lead.sources.map(k=>'<a href="'+esc(D.SOURCES[k].url)+'">'+esc(D.SOURCES[k].short)+', p. 1 n. 2</a>').join('')+'</nav></section>';
const issueNames=[...new Set(voices.map(v=>v.theme))].sort();
const stanceGroups=issueNames.map((name,i)=>'<section id="issue-'+(i+1)+'"><h2>'+esc(name)+'</h2>'+voices.filter(v=>v.theme===name).map(v=>{
 const matches=voiceLinks.get(v)||[], covered=new Set(matches.map(([url])=>url.split('/')[0]));
 const destinations=[...matches,...v.slugs.filter(k=>!covered.has(k)).map(k=>[k+'/',bySlug.get(k).title])];
 return perspective(v)+'<nav class="contents" aria-label="Relevant filings">'+destinations.map(([url,label])=>'<a href="'+esc(url)+'">'+esc(label)+'</a>').join('')+'</nav>';
}).join('')+'</section>').join('');
emit('positions.html',frame('Who said what','Filed objections, public testimony and reporting on large-load proposals.','<h1>Who said what</h1><p class="intro">Find the argument, the person who made it and the section it concerns. A state consumer advocate speaks for a different office than a utility commission. Hearing testimony does not establish a vote on a pending filing.</p>'+stateLead+'<details><summary>Browse topics</summary>'+nav(issueNames.map((n,i)=>'<a href="#issue-'+(i+1)+'">'+esc(n)+'</a>'))+'</details>'+stanceGroups,'positions.html'));
const missing=Object.entries(coverage.records).filter(([,v])=>!v.slug||!bySlug.has(v.slug));
const coveragePage='<h1>What the archive covers</h1><p class="intro">'+esc(coverage.scope)+'</p><p>Checked through '+esc(coverage.asOf)+'. '+catalog.length+' originals in the reading room. PDF page numbers count from the first physical page; Word documents have no fixed pagination.</p><h2>Docket sheets</h2><ul class="directory">'+coverage.dockets.map(d=>'<li><a href="'+esc(d.sourceUrl)+'">'+esc(d.docket)+'</a><span>'+esc(d.status)+' · '+d.rowsRead+' of '+d.totalRows+' rows</span></li>').join('')+'</ul><h2>Records without a local original</h2><p>'+missing.length+' listed records. A docket entry establishes that a document was filed; it cannot establish what the document says.</p><ul class="directory">'+missing.map(([acc,v])=>'<li><a href="'+esc(v.sourceUrl)+'">'+esc(acc+' · '+v.description)+'</a><span>'+esc(v.status)+(v.reason?' · '+esc(v.reason):'')+'</span></li>').join('')+'</ul>';
emit('coverage.html',frame('Archive coverage','Dockets checked, original documents acquired and source gaps.',coveragePage,'coverage.html'));
emit('index.html',frame('The filing record','FERC orders, filings, comments and responses by proceeding.',cover+'<p><a href="positions.html">Who said what: testimony, filings and reporting by issue</a> · <a href="coverage.html">Coverage and missing originals</a></p><h2>Inside PJM’s filings</h2>'+nav(leads)+'<h2>Browse the record</h2>'+nav(names.map(n=>'<a href="#group-'+slug(n)+'">'+esc(n)+'</a>'))+names.map(name=>'<section id="group-'+slug(name)+'"><h2>'+esc(name)+'</h2><ul class="directory">'+linksFor(grouped.get(name))+'</ul></section>').join('')));
console.log(check?'Readers verified':'Readers built',catalog.length,'originals,',guide.reduce((a,b)=>a+b.count,0),'page-cited readings;',writes.length,'files changed');
