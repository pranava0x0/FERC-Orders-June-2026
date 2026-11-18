// The footer went dark in PR #34 while light-footer link colors still applied later in the cascade,
// leaving links at about 1.4:1. The last rule wins, so check the last `.footer a` color against the
// last footer background.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../docs/css/styles.css',import.meta.url),'utf8');
const vars=Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map(m=>[m[1],m[2]]));
const last=(re)=>{const all=[...css.matchAll(re)];assert.ok(all.length,'rule not found: '+re);return all.at(-1)[1].trim();};
const resolve=v=>{const m=v.match(/var\(--([\w-]+)\)/);return m?vars[m[1]]:v;};
const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(x=>x<=0.03928?x/12.92:((x+0.055)/1.055)**2.4);return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];};
const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+0.05)/(y+0.05);};
test('footer links and emphasis keep at least 4.5:1 contrast on the footer background',()=>{
 const bg=resolve(last(/\.footer\s*\{[^}]*?background:\s*([^;]+);/g));
 for(const sel of ['\\.footer a','\\.footer a:hover','\\.footer strong']){
  const fg=resolve(last(new RegExp(sel+'\\s*\\{[^}]*?color:\\s*([^;]+);','g')));
  assert.match(fg,/^#[0-9a-f]{6}$/i,sel+' color is not a hex value');
  assert.ok(ratio(fg,bg)>=4.5,sel.replace(/\\\\/g,'')+' contrast '+ratio(fg,bg).toFixed(2)+' on '+bg);
 }
});
