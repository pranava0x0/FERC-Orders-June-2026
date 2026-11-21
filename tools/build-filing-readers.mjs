// Rebuild the HTML reading room from the per-document source index and reviewed evidence.
// node tools/build-filing-readers.mjs [--check]
import {filerList} from './build-record-data.mjs';
import {existsSync, readFileSync,writeFileSync,copyFileSync,mkdirSync,readdirSync,unlinkSync} from 'node:fs';
import {basename,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {loadData} from './build-seo.mjs';
const root=join(dirname(fileURLToPath(import.meta.url)),'..'), out=join(root,'docs/reading');
const read=p=>JSON.parse(readFileSync(p,'utf8')), seed=f=>read(join(root,'sources/filings',f));
const catalog=read(join(out,'catalog.json')), groups=seed('tenets.json').groups;
const SITE='https://pranava0x0.github.io/ferc-large-load-proceedings/reading/';
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
// Name the publisher a source link actually goes to: eLibrary for FERC filings, the host otherwise.
const sourceHost=u=>{const h=new URL(u).hostname.replace(/^www\./,'');return h==='elibrary.ferc.gov'?'FERC eLibrary':h;};
const verifyUrl=s=>{if(!/^https?:\/\//.test(s))throw Error('invalid citation: '+s);return s};
for(const v of voices){verifyUrl(v.url);if(!['direct','related'].includes(v.relation)||!['state','commissioner','coverage','party'].includes(v.kind)||!v.text||!v.locator)throw Error('invalid perspective '+v.title);for(const k of v.slugs)if(!bySlug.has(k))throw Error('unknown perspective document '+k);}
// A position's stance and its quote are optional. A quote is the responder's own words and must appear on
// the cited page of the responder's reading, so a stance never rests on a paraphrase alone.
const STANCE_LABEL={'supports':'Supports','supports with changes':'Supports with changes','opposes in part':'Opposes in part','opposes':'Opposes','asks FERC to reject':'Asks FERC to reject','procedural':'Procedural'};
const byAccession=new Map();for(const r of catalog)if(r.accession&&!r.parent&&!byAccession.has(r.accession))byAccession.set(r.accession,r);
const voiceAcc=v=>{try{return new URL(v.url).searchParams.get('accession_number');}catch{return null;}};
for(const v of voices){
 if(v.stance!==undefined&&!STANCE_LABEL[v.stance])throw Error('invalid stance "'+v.stance+'" in '+v.title);
 if(v.quote===undefined)continue;
 const own=byAccession.get(voiceAcc(v));if(!own)throw Error('position quote has no reading: '+v.title);
 const pg=read(join(out,own.slug,'source.json')).pages[(v.quote_page||0)-1];
 if(!pg||!norm(pg.text).includes(norm(v.quote)))throw Error(own.slug+' position quote not on PDF p. '+v.quote_page+': '+v.quote.slice(0,80));
}
// FERC's own notices and requests for more time are procedure, not positions, whatever eLibrary's type says.
const proceduralFiling=r=>/^(?:secretary of the commission|ferc\b|federal energy regulatory commission)/i.test(r.filer||'')||/\bextension\b|\berrata\b|\babeyance\b|^notice\b/i.test(r.title||'');
const css=readFileSync(join(root,'docs/css/reading.css'));
const ver=createHash('sha256').update(css).digest('hex').slice(0,10);
function frame(title,desc,content,sub='',extra=''){
  const url=SITE+sub,b=sub.includes('/')?'../../':'../';
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+esc(title)+' | FERC Large Load Proceedings</title><meta name="description" content="'+esc(desc)+'"><link rel="canonical" href="'+esc(url)+'"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(desc)+'"><link rel="stylesheet" href="'+b+'css/reading.css?v='+ver+'">'+extra+'</head><body><a class="skip" href="#main">Skip to content</a><header><nav aria-label="Site"><a href="'+b+'">FERC Large Load Proceedings</a><a href="'+b+'#filings">Filings</a><a href="'+(sub.includes('/')?'../':'./')+'">Documents</a></nav></header><main id="main">'+content+'</main><footer>Independent analysis of public records. <a href="https://pranavaraparla.com" target="_blank" rel="noopener noreferrer">Pranava Raparla</a> · <a href="https://github.com/pranava0x0/ferc-large-load-proceedings" target="_blank" rel="noopener noreferrer">Source repository</a></footer></body></html>\n';
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
// Display-only cleanup of PDF text. The stored text (source.json) is untouched; quotes are checked
// against the rendered text with whitespace normalized, so rejoining lines changes no words.
// 1. Lines repeated near the top of most pages (letterhead, "Page 16", bare page numbers) are muted.
// 2. A PDF line that runs to the margin is joined to the next one; a short line, a blank line, or a
//    line before a bullet or numbered item ends a paragraph. Address and signature blocks are all
//    short lines, so they keep their breaks.
const lineKey=l=>l.trim().replace(/\d+/g,'#').replace(/\s+/g,' ');
function runningHeads(pages){
 const seen=new Map();
 for(const p of pages){const top=new Set(p.text.split('\n').filter(l=>l.trim()).slice(0,5).map(lineKey));for(const k of top)seen.set(k,(seen.get(k)||0)+1);}
 const min=Math.max(3,Math.ceil(pages.length*0.4));
 return new Set([...seen].filter(([k,n])=>n>=min&&k.length<=90).map(([k])=>k));
}
const plainLen=l=>l.replace(/<[^>]+>/g,'').replace(/&[#a-z0-9]+;/gi,'x').trim().length;
const startsItem=l=>/^\s*(?:<[^>]+>)*\s*(?:[•▪◦●■‒–—-]\s|\(?[0-9]{1,2}[.)]\s|\(?[a-z]{1,2}\)\s|\(?[ivx]{1,4}[.)]\s|[A-H]\.\s|[IVX]{1,4}\.\s)/.test(l);
// 3. A number stuck to the end of a word ("customers.72") is a footnote mark. When the footnote's text
//    is found lower on the same page (a line starting "72 "), the mark links to it and it links back.
// 4. Web addresses in the text become links.
// Glue before a mark: a lowercase word, an all-caps word followed by punctuation ("FERC,10"; never a bare
// "CO2" or "H2", where the digit is part of the name), a closing paren, or a
// dot run ("Tariff....28"), then optional punctuation. Only the lowercase form is raised without a note
// found on the page; the wider forms become marks only when their note is found.
const MARK=/((?:(?:[a-z]{2}|\)|\.\.|\. \.)(?:[.,;:?)”’]|&quot;|&#39;|\.&quot;|\.”)?|[A-Z]{2,}(?:[.,;:?)”’]|&quot;|&#39;|\.&quot;|\.”)))(\d{1,3})(?=\s|$)/g;
const PLAIN_MARK=/[a-z]{2}(?:[.,;:)”’]|&quot;|&#39;|\.&quot;|\.”)$/;
const URL_RE=/(https?:\/\/[^\s<>"]*[^\s<>".,;:)\]])/;
function inline(h,pg,found){
 const linked=new Set();
 return h.split(/(<[^>]+>)/).map((t,i)=>i%2?t:t.split(URL_RE).map((u,j)=>j%2?'<a href="'+u+'">'+u+'</a>':u.replace(MARK,(m,w,n)=>{
  // No note found on this page: raise it only after punctuation ("loads.74"), never inside a bare
  // identifier like Moody's "Baa3", where the digit is part of the word.
  if(!found.has(n))return PLAIN_MARK.test(w)?w+'<sup>'+n+'</sup>':m;
  const id=linked.has(n)?'':' id="fnref-'+pg+'-'+n+'"';linked.add(n);
  return w+'<a class="fnref"'+id+' href="#fn-'+pg+'-'+n+'" aria-label="Footnote '+n+'"><sup>'+n+'</sup></a>';
 })).join('')).join('');
}
function tidyPage(html,heads,pg){
 const lines=html.split('\n'),out=[];
 const full=(()=>{const ls=lines.map(plainLen).filter(n=>n>40).sort((a,b)=>a-b);return ls.length?ls[Math.floor(ls.length*0.75)]:80;})();
 const marks=new Set([...html.matchAll(MARK)].map(m=>m[2])),found=new Set();
 // Line-numbered testimony prints 1, 2, 3 … down the margin as bare lines. A run of five or more bare
 // numbers counting up by one, starting in the top quarter of the page, is line numbering, never a note
 // start ("5\nQ. …" is not note 5). Notes count up too, but their block starts low on the page.
 const bareNum=l=>{const m=l.replace(/<[^>]+>/g,'').match(/^\s*(\d{1,3})\s*$/);return m?+m[1]:null;};
 const lineNo=new Set();{let run=[];const end=()=>{if(run.length>=5&&run[0]<lines.length*0.25)run.forEach(i=>lineNo.add(i));run=[];};
  lines.forEach((l,i)=>{const v=bareNum(l);if(v===null)return;if(run.length&&v!==bareNum(lines[run[run.length-1]])+1)end();run.push(i);});end();}
 const NOTE_TEXT=/^\s*(?:<[^>]+>)*\s*(?:[A-Z“"‘'(§]|\d+\s+\S)/;
 // Some PDFs set a note's number on its own line with the text on the next ("2\nPJM Reliability…").
 // Join them when the number is a mark on this page and the next line starts like note text (a capital,
 // quote, § or citation number; never a lowercase word, and never a bare page-number footer).
 for(let i=lines.length-2;i>=Math.ceil(lines.length*0.25);i--){
  const v=bareNum(lines[i]);
  if(v!==null&&!lineNo.has(i)&&marks.has(String(v))&&NOTE_TEXT.test(lines[i+1])){lines[i]=v+' '+lines[i+1].replace(/^\s+/,'');lines.splice(i+1,1);}
 }
 // The first line on the page that starts with an unclaimed mark number is its note; a later line that
 // starts with the same number is a continuation ("136 FERC ¶ 61,051", "50 MW threshold)"). A number fused to
 // its note ("7IRAS Filing") counts only when a whole word follows, not a wrapped identifier ("10A.2",
 // "20DL/NERC…").
 const fnAt=(l,i)=>{const m=l.replace(/<[^>]+>/g,'').match(/^\s*(\d{1,3})(?:\s+\S|(?=[A-Z“"(§][A-Za-z’']*[\s,]))/);return m&&marks.has(m[1])&&!found.has(m[1])&&i>=lines.length*0.25?m[1]:null;};
 let para='',merged=0,top=true,inFn=false;
 const flush=gap=>{if(para){out.push(para+(inFn?'</span>':'')+(merged>1&&gap&&!inFn?'\n':''));para='';merged=0;inFn=false;}};
 for(let i=0;i<lines.length;i++){
  let l=lines[i].replace(/\s+$/,'');
  // An outline label alone on its line ("I.", "8.", "(a)") belongs to the heading after it.
  const bare=l.replace(/<[^>]+>/g,'').trim();
  if(/^(?:[IVX]{1,4}|[A-H]|\d{1,2}|[a-z]|[ivx]{1,4})[.)]$|^\([a-z0-9ivx]{1,4}\)$/.test(bare)&&plainLen(lines[i+1]??'')){lines[i+1]=l.replace(/\s+$/,'')+' '+lines[i+1].replace(/^\s+/,'');continue;}
  // A table-of-contents dot leader that wrapped onto its own line stays with its entry.
  if(/^[.\s…]{3,}\d*$/.test(bare)&&out.length&&!para){out[out.length-1]+=' '+bare;continue;}
  if(/^[.\s…]{3,}\d*$/.test(bare)&&para){para+=' '+bare;continue;}
  const n=plainLen(l);
  if(top&&n&&heads.has(lineKey(l.replace(/<[^>]+>/g,'')))){flush(false);out.push('<span class="rh">'+l.trim()+'</span>');continue;}
  if(n)top=false;
  if(!n){flush(false);out.push(l);continue;}
  const fn=fnAt(l,i);
  if(fn){flush(true);found.add(fn);para='<span class="fn" id="fn-'+pg+'-'+fn+'"><a class="fnback" href="#fnref-'+pg+'-'+fn+'" aria-label="Back to footnote '+fn+' mark">'+fn+'</a>'+l.replace(/^\s*(?:<[^>]+>)*\s*\d{1,3}/,'');merged=1;inFn=true;}
  else{
   if(para&&startsItem(l))flush(true);
   para=para?para+' '+l.replace(/^\s+/,''):l;merged++;
  }
  const next=lines[i+1]??'';
  if((!inFn&&n<full*0.8)||!plainLen(next)||startsItem(next)||fnAt(next,i+1))flush(plainLen(next)>0);
 }
 flush(false);
 // Marks are linked before dot leaders collapse, so a quoted ellipsis before a mark (". . . .”65") survives.
 return inline(out.join('\n').replace(/\n{3,}/g,'\n\n').replace(/^\n+/,''),pg,found).replace(/(?:[ \t]*\.){4,}[ \t]*(?=\d|$)/gm,' … ');
}
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
 const k=docketKey(r);if(!k||r.parent||proceduralFiling(r)||!/(protest|comments|rehearing|statement of position|motion for leave to answer)/i.test(r.kind))continue;
 const entries=filingThread.get(k)||new Map();
 for(const pg of read(join(out,r.slug,'source.json')).pages){
  const text=pg.text.replace(/\s+/g,' '),sentences=text.match(/[^.!?]+(?:[.!?](?=\s|$)|$)/g)||[];
  for(const sent of sentences){
   const str=sent.trim();if(str.length<65||str.length>560||/respectfully submitted|certificate of service|request for action by|comment (?:period|deadline)|\.{3}|^\d+\s+See /i.test(str)||!(/\b(?:should|would|requests?|asks?|supports?|opposes?|objects?|argues?|recommends?|concerned)\b/i.test(str)))continue;
   for(const [topic] of salient(str)){
    if(!entries.has(topic))entries.set(topic,new Map());
    const byDoc=entries.get(topic);if(!byDoc.has(r.slug))byDoc.set(r.slug,{r,pg:pg.page,text:str});
   }
  }
 }
 if(entries.size)filingThread.set(k,entries);
}
// Positions read for this site lead each docket's page; keyword excerpts follow for everything else.
const positionsIn=k=>voices.filter(v=>v.stance!=='procedural'&&docketKey(byAccession.get(voiceAcc(v))||{})===k);
for(const k of new Set([...filingThread.keys(),...voices.map(v=>docketKey(byAccession.get(voiceAcc(v))||{})).filter(Boolean)])){
 const topicsInDocket=filingThread.get(k)||new Map(),read_=positionsIn(k);
 if(!read_.length&&!topicsInDocket.size)continue;
 const positions=read_.length?'<section id="positions"><h2>Positions read for this site</h2>'+read_.map(v=>{const own=byAccession.get(voiceAcc(v));return '<article class="finding"><h3><a href="'+own.slug+'/">'+esc(v.speaker)+'</a></h3><p class="meta">'+esc(STANCE_LABEL[v.stance])+' · '+esc(own.docket)+' · '+esc(own.issued)+'</p><p>'+esc(v.text)+'</p>'+(v.quote?'<blockquote>'+esc(v.quote)+' <cite><a href="'+own.slug+'/text.html#p-'+v.quote_page+'">PDF p. '+v.quote_page+'</a></cite></blockquote>':'')+'</article>';}).join('')+'</section>':'';
 const body=[...topicsInDocket].sort(([a],[b])=>a.localeCompare(b)).map(([topic,byDoc])=>'<section id="'+slug(topic)+'"><h2>'+esc(topic)+'</h2>'+[...byDoc.values()].map(({r,pg,text})=>'<article class="finding"><h3><a href="'+r.slug+'/">'+esc(r.filer||r.title)+'</a></h3><p class="meta">'+esc(r.docket)+' · '+esc(r.issued)+'</p><blockquote>'+esc(text)+' <cite><a href="'+r.slug+'/text.html#p-'+pg+'">'+(r.pages?'PDF p. '+pg:'Source text')+'</a></cite></blockquote></article>').join('')+'</section>').join('');
 emit(threadHref(k),frame(k+' comments by topic','Topic-matched excerpts from filed comments and protests.','<h1>'+esc(k)+': the filed comments</h1>'+positions+(topicsInDocket.size?(read_.length?'<h2>Other passages, matched by topic</h2>':'')+'<p>These passages match a topic and a request or argument in the same sentence. A filing can quote another party. Read its page before attributing a position.</p>':'')+body,threadHref(k)));
}
function discussion(k,text){
 const e=filingThread.get(k);if(!e)return '';
 const topic=salient(text).map(x=>x[0]).find(t=>e.has(t));
 return topic?' <a class="xref" href="../'+threadHref(k,topic)+'">Filed comments: '+esc(topic)+'</a>':'';
}
const anchorsById=new Map(read(join(root,'sources/filings/order-anchors.json')).orders.flatMap(o=>o.anchors.map(a=>[a.id,{...a,item:o.item,rto:o.rto,pdf:'orders/'+o.slug+'.pdf'}])));
// The per-document reading (sources/filings/documents/<slug>.json), validated by tools/validate-documents.mjs.
function ownReading(r,paginated){
 const f=join(root,'sources/filings/documents',r.slug+'.json');if(!existsSync(f))return '';
 const d=read(f),tl=d.throughLine;
 const chips=tl.anchors.map(id=>{const a=anchorsById.get(id);if(!a)throw Error(r.slug+': unknown anchor '+id);return '<a class="oa" href="../../'+a.pdf+'#page='+a.pg+'">'+esc(a.item+' '+a.rto+': '+a.label)+' ('+(a.para?esc(a.para)+', ':'')+'p. '+a.pg+')</a>';}).join(' ');
 const pts=d.points.map(p=>'<li><strong>'+esc(p.point)+'</strong><blockquote>'+esc(p.quote)+' <cite>'+ref(p.pg||1,paginated)+'</cite></blockquote></li>').join('');
 return '<section class="reading"><p class="intro">'+esc(d.summary)+'</p>'+(d.ask?'<p><strong>Asks FERC to:</strong> '+esc(d.ask)+'</p>':'')+
  '<p>'+esc(tl.text)+'</p>'+(chips?'<p class="anchors">'+chips+'</p>':'')+'<h2>Key points</h2><ol class="points">'+pts+'</ol></section>';
}
const guide=[],voiceLinks=new Map();
// The originals the comparison table cites are served beside the site, so a page link in a transcription
// can open the same page of the PDF itself (#page=N). Other originals stay in the repo and on eLibrary.
const tableCites=new Set();JSON.stringify(seed('reform-matrix.json'),(k,v)=>{if(v&&v.slug&&v.pg)tableCites.add(v.slug);return v;});
if(!tableCites.size)throw Error('reform-matrix.json cites no documents');
const servedPdf=new Map();
for(const r of catalog){
 if(!tableCites.has(r.slug)||!/\.pdf$/i.test(r.file||''))continue;
 const src=join(root,r.file),name=basename(r.file),dst=join(root,'docs/originals',name);
 if(!existsSync(src))throw Error('missing original '+r.file);
 if(!existsSync(dst)||!readFileSync(dst).equals(readFileSync(src))){if(check)throw Error('stale docs/originals/'+name);mkdirSync(dirname(dst),{recursive:true});copyFileSync(src,dst);writes.push('../originals/'+name);}
 servedPdf.set(r.slug,'../../originals/'+name);
}
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
   claims+='<section class="finding" id="'+id+'"><p class="folio">'+esc(c.theme)+(c.theme?' · ':'')+(paginated?'PDF '+(c.start===c.end?'p. '+c.start:'pp. '+c.start+'–'+c.end):'Unpaginated filing')+'</p><h3>'+esc(c.title)+'</h3>'+(c.take?'<p>'+esc(c.take)+'</p>':'')+'<blockquote>'+esc(c.quote)+' <cite>'+ref(pg,paginated)+'</cite></blockquote>'+discussion(docketKey(r),c.take+' '+c.quote)+'</section>';
 }
 const overviewTopics=salient(pages.map(p=>p.text).join(' ')).slice(0,3).map(x=>x[0]);
 const related=docVoices;
 const sourceBlocks=sections.map((s,i)=>{
   if(local.length)return '<li id="section-'+(i+1)+'"><a href="text.html#section-'+(i+1)+'">'+esc(s.title)+'</a> <span class="meta">'+(paginated?'p. '+s.p:'Source text')+'</span></li>';
   const text=sourceFragment(pages,s),snippet=extract(text),theme=salient(text)[0]?.[0];
   if(!text.trim())return '';
   return '<section id="section-'+(i+1)+'"><h3>'+esc(s.title)+'</h3><p class="folio">'+esc(s.method)+(theme?' · Topic match: '+esc(theme):'')+'</p>'+(snippet?'<blockquote>'+esc(snippet)+'</blockquote>':'')+'<a href="text.html#section-'+(i+1)+'">Read this passage</a>'+discussion(docketKey(r),text)+'</section>';
 }).join('');
 const links=catalog.filter(x=>x.parent===r.slug);
 const evidenceHeading=curated.length?'What the document says':'Passages from the original';
 const raw='https://github.com/pranava0x0/ferc-large-load-proceedings/blob/main/'+r.file.split('/').map(encodeURIComponent).join('/');
 const description=short(curated[0]?.take||curated[0]?.title||r.title);
 // eLibrary runs joint filers together with no separator; filerList splits them at name boundaries.
 const who=filerList(r.filer||''),byline=who.length>3?who.slice(0,2).join(', ')+' and '+(who.length-2)+' others':who.join(', ');
 const summary='<p class="meta">'+esc(r.docket)+' · '+esc(r.issued)+(byline?' · '+esc(byline):'')+'</p><h1>'+esc(r.title)+'</h1>';
 // A record-tier document keeps its original on eLibrary only; the page names the hash the text came from.
 const pdf=servedPdf.get(r.slug);
 const originals='<a href="'+esc(r.url)+'">Official source ('+esc(sourceHost(r.url))+')</a>'+(pdf?'<a href="'+pdf+'">Original PDF</a>':r.tier==='record'?'':'<a href="'+raw+'">Archived original</a>')+(r.mirror?'<a href="'+esc(r.mirror)+'">Also at '+esc(sourceHost(r.mirror))+'</a>':'');
 const sourceNav='<nav class="tools" aria-label="Source material">'+originals+'<a href="text.html">Full text</a><a href="source.json">Page data (JSON)</a></nav>'+(r.tier==='record'?'<p class="muted">'+(r.ocr?'Text recognized by OCR from a scanned original with no text layer; quotes may carry recognition errors. ':'Text extracted from the eLibrary original ')+'(SHA-256 <code>'+esc(r.sha256.slice(0,16))+'…</code>). Download the original from the official source.</p>':'');
 const readings=curated.length?'<h2 id="findings">'+evidenceHeading+'</h2>'+ (local.length>3?'<nav class="contents" aria-label="Section readings">'+local.map(c=>'<a href="#'+pin(c.title)+'">'+esc(c.title)+'</a>').join('')+'</nav>':'')+claims:'';
 // Other parties' views stay off this page's text: a reader sees what THIS document says. They are listed
 // as links, by speaker, so the trail to them survives without mixing their words into this reading.
 const notes=related.length?'<ul class="elsewhere">'+related.map(v=>'<li><a href="'+esc(v.url)+'">'+esc(v.title)+'</a> <span class="by">'+esc(v.speaker)+'</span></li>').join('')+'</ul>':'';
 // Contents at the top: the document's own printed headings, so a reader sees its structure and can jump
 // to a section before scrolling. Pages without headings (page ranges only) get no list; it would say nothing.
 const heads=sections.map((s,i)=>({s,i})).filter(({s})=>/heading|bookmark/i.test(s.method)&&!/^(?:certificate of service|table of contents)$/i.test(s.title));
 const toc=heads.length>=2?'<details class="toc"'+(heads.length<=12?' open':'')+'><summary>Contents · '+heads.length+' sections</summary><ol>'+heads.map(({s,i})=>'<li'+(/^[A-H]\.\s/.test(s.title)?' class="sub"':'')+'><a href="'+(local.length||!sourceFragment(pages,s).trim()?'text.html':'')+'#section-'+(i+1)+'">'+esc(s.title)+'</a>'+(paginated?' <span class="meta">p. '+s.p+'</span>':'')+'</li>').join('')+'</ol></details>':'';
 const article=summary+ownReading(r,paginated)+sourceNav+toc+(r.parent?'<p><a href="../'+r.parent+'/">Read the parent filing</a></p>':'')+
   (links.length?'<nav class="contents" aria-label="Attachments">'+links.map(x=>'<a href="../'+x.slug+'/">'+esc(x.title)+'</a>').join('')+'</nav>':'')+
   (filingThread.has(docketKey(r))?'<p><a href="../'+threadHref(docketKey(r))+'">Read topic-matched comments in '+esc(docketKey(r))+'</a></p>':'')+
   (overviewTopics.length?'<p class="terms">Topics in the text: '+esc(overviewTopics.join(' · '))+'</p>':'')+readings+
   (notes?'<section><h2>Elsewhere in the record</h2><p class="muted">Other parties on the same questions, in their own documents.</p>'+notes+'</section>':'')+'<h2>Source sections</h2><p class="muted">Printed headings where available; page ranges otherwise. '+(local.length?'Open a heading to read the original passage. ':'Excerpts below are selected from the text by keyword. ')+''+(r.text_file?'This transcription includes OCR of scanned material; consult the original for exact wording. ':'')+(r.emptyPages.length?'Pages with no text layer: '+r.emptyPages.join(', ')+'. ':'')+'</p>'+(local.length?'<ul class="directory">'+sourceBlocks+'</ul>':'<div class="outline">'+sourceBlocks+'</div>');
 const ld=JSON.stringify({'@context':'https://schema.org','@type':'Article',headline:r.title,description,mainEntityOfPage:SITE+r.slug+'/',citation:r.url,about:r.docket}).replaceAll('<','\\u003c');
 emit(r.slug+'/index.html',frame(r.title,description,article,r.slug+'/','<script type="application/ld+json">'+ld+'</script>'));
 let count=0;
 const noteLinks=t=>t.replace(/\[(fn|en):(-?\d+)\]/g,(m,kind,n,off,html)=>{
   if(off>0 && html[off-1]==='\n' && html.lastIndexOf(kind==='fn'?'Footnotes\n':'Endnotes\n',off)>=0)return '<span id="note-'+kind+'-'+n+'">'+m+'</span>';
   return '<a href="#note-'+kind+'-'+n+'">'+m+'</a>';
 });
 const runHeads=paginated?runningHeads(pages):new Set();
 const full=pages.map(p=>{
   let body='',at=0;while(count<sections.length && sections[count].p===p.page){let s=sections[count];body+=esc(span(p.text,at,s.at))+'<span id="section-'+(count+1)+'"></span>';at=s.at;count++;}
   body+=esc(span(p.text,at));if(paginated)body=tidyPage(body,runHeads,p.page);return '<section id="p-'+p.page+'"><h2>'+(paginated?'PDF page '+p.page:'Document text')+(pdf&&paginated?' <a class="pdf-page" href="'+pdf+'#page='+p.page+'">Open this page in the original PDF</a>':'')+'</h2><pre>'+ ((!paginated?noteLinks(body):body)||'[No extractable text on this page.]')+'</pre></section>';
 }).join('');
 emit(r.slug+'/text.html',frame(r.title+' · full text',description,summary+'<nav class="tools" aria-label="Source material"><a href="./">Back to sections and commentary</a>'+originals+'</nav>'+(!paginated?'<p>Word notes use stable document IDs, such as [fn:8], which can differ from printed footnote numbers.</p>':'')+full,r.slug+'/text.html'));
 guide.push({...r,topics:overviewTopics,count:curated.length,viewpoints:docVoices.length});
}
const linksFor=g=>g.sort((a,b)=>b.issued.localeCompare(a.issued)||a.title.localeCompare(b.title)).map(x=>'<li><a href="'+x.slug+'/">'+esc(x.title)+'</a><span>'+esc(x.docket)+' · '+esc(x.issued)+(x.count?' · '+x.count+' cited readings':' · source text')+'</span></li>').join('');
const grouped=new Map();for(const r of guide){if(!grouped.has(r.group))grouped.set(r.group,[]);grouped.get(r.group).push(r);}
const names=[...grouped.keys()].sort(),nav=xs=>'<nav class="contents">'+xs.join('')+'</nav>';
const leads=loadData().meta.readingLeads.map(t=>'<a href="'+esc(t.href.replace(/^reading\//,''))+'">'+esc(t.title)+'</a>');
const cover='<h1>The filing record</h1><p class="intro">The June orders, the responses and the documents behind them.</p><p>'+guide.length+' archived originals · '+guide.filter(r=>r.pages).length+' PDFs · <a href="catalog.json">Download the inventory</a></p>';
const D=loadData(),lead=D.meta.stateLead;
const stateLead='<section id="state-commissions"><h2>'+esc(lead.title)+'</h2><p>'+esc(lead.text)+'</p><nav class="tools">'+lead.sources.map(k=>'<a href="'+esc(D.SOURCES[k].url)+'">'+esc(D.SOURCES[k].short)+', p. 1 n. 2</a>').join('')+'</nav></section>';
const issueNames=[...new Set(voices.map(v=>v.theme))].sort();
const stanceGroups=issueNames.map((name,i)=>'<section id="issue-'+(i+1)+'"><h2>'+esc(name)+'</h2>'+voices.filter(v=>v.theme===name).map(v=>{
 const matches=voiceLinks.get(v)||[], covered=new Set(matches.map(([url])=>url.split('/')[0]));
 const destinations=[...matches,...v.slugs.filter(k=>!covered.has(k)).map(k=>[k+'/',bySlug.get(k).title])];
 return perspective(v)+'<nav class="contents" aria-label="Relevant filings">'+destinations.map(([url,label])=>'<a href="'+esc(url)+'">'+esc(label)+'</a>').join('')+'</nav>';
}).join('')+'</section>').join('');
emit('positions.html',frame('Who said what','Filed objections, public testimony and reporting on large-load proposals.','<h1>Who said what</h1><p class="intro">A state consumer advocate speaks for a different office than a utility commission. Hearing testimony does not establish a vote on a pending filing.</p>'+stateLead+'<details><summary>Browse topics</summary>'+nav(issueNames.map((n,i)=>'<a href="#issue-'+(i+1)+'">'+esc(n)+'</a>'))+'</details>'+stanceGroups,'positions.html'));
const missing=Object.entries(coverage.records).filter(([,v])=>!v.slug||!bySlug.has(v.slug));
const coveragePage='<h1>What the archive covers</h1><p class="intro">'+esc(coverage.scope)+'</p><p>Checked through '+esc(coverage.asOf)+'. '+catalog.length+' originals in the reading room. PDF page numbers count from the first physical page; Word documents have no fixed pagination.</p><h2>Docket sheets</h2><ul class="directory">'+coverage.dockets.map(d=>'<li><a href="'+esc(d.sourceUrl)+'">'+esc(d.docket)+'</a><span>'+esc(d.status)+' · '+d.rowsRead+' of '+d.totalRows+' rows</span></li>').join('')+'</ul><h2>Records without a local original</h2><p>'+missing.length+' listed records. A docket entry establishes that a document was filed; it cannot establish what the document says.</p><ul class="directory">'+missing.map(([acc,v])=>'<li><a href="'+esc(v.sourceUrl)+'">'+esc(acc+' · '+v.description)+'</a><span>'+esc(v.status)+(v.reason?' · '+esc(v.reason):'')+'</span></li>').join('')+'</ul>';
emit('coverage.html',frame('Archive coverage','Dockets checked, original documents acquired and source gaps.',coveragePage,'coverage.html'));
emit('index.html',frame('The filing record','FERC orders, filings, comments and responses by proceeding.',cover+'<p><a href="positions.html">Who said what: testimony, filings and reporting by issue</a> · <a href="coverage.html">Coverage and missing originals</a></p><h2>Inside PJM’s filings</h2>'+nav(leads)+'<h2>Browse the record</h2>'+nav(names.map(n=>'<a href="#group-'+slug(n)+'">'+esc(n)+'</a>'))+names.map(name=>'<section id="group-'+slug(name)+'"><h2>'+esc(name)+'</h2><ul class="directory">'+linksFor(grouped.get(name))+'</ul></section>').join('')));
// A docket whose only matches were procedure no longer gets a discussion page; drop the old one.
const emittedThreads=new Set([...filingThread.keys(),...voices.map(v=>docketKey(byAccession.get(voiceAcc(v))||{})).filter(Boolean)].filter(k=>positionsIn(k).length||filingThread.has(k)).map(k=>threadHref(k)));
for(const f of readdirSync(out))if(/^discussion-.*\.html$/.test(f)&&!emittedThreads.has(f)){if(check)throw Error('orphan '+f);unlinkSync(join(out,f));writes.push(f);}
console.log(check?'Readers verified':'Readers built',catalog.length,'originals,',guide.reduce((a,b)=>a+b.count,0),'page-cited readings;',writes.length,'files changed');
