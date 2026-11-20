/* ---------- many group lists at once: each file finds its own bus (guide name in the file name, dates), with warnings ---------- */
// "01.11 BAYRAM ALİM 3. GRUP.xlsx" -> date 01.11, name BAYRAM ALİM, group 3
function fileMeta(fn){const base=fn.replace(/\.[^.]+$/,'').replace(/\(\d+\)/g,' ');
  const dm=base.match(/(\d{1,2})[.\-\/](\d{1,2})(?:[.\-\/](\d{2,4}))?/);const gm=base.match(/(\d+)\s*\.?\s*GRUP/i);
  const name=base.replace(/(\d{1,2})[.\-\/](\d{1,2})(?:[.\-\/](\d{2,4}))?/,' ').replace(/\d+\s*\.?\s*GRUP/i,' ').replace(/\b(ABİ|ABI|ABLA|HOCA|BEY|GRUP|GRUBU|KOPYA|COPY|LISTE|LİSTE)\b/gi,' ').replace(/[+_\-.,]+/g,' ').replace(/\s+/g,' ').trim();
  return {date:dm?{d:dm[1].padStart(2,'0'),m:dm[2].padStart(2,'0')}:null,group:gm?+gm[1]:null,name}}
const nameToks=s=>String(s||'').split(/[\s/+]+/).map(nk).filter(t=>t.length>=3);
function nameScore(a,b){const A=nameToks(a),B=nameToks(b);if(!A.length||!B.length)return 0;
  // each word of the file name against the closest word of the guide's name ("TEVFİK"~"TOFİK", "OĞUZ"~"OĞUZHAN")
  const best=A.map(x=>Math.max(...B.map(y=>{const s=sim(x,y);return y.startsWith(x)||x.startsWith(y)?Math.max(s,0.85):s})));
  return best.reduce((p,c)=>p+c,0)/A.length}
// people in the file name ("HALİL HACI + RÜSTEM ASLAN") against the people of the bus ("HALİL/RÜSTEM", kok guide):
// what counts is that every first name in the file belongs to this bus
const persons=s=>String(s||'').split(/\s*[+/&,]\s*|\s+VE\s+/i).map(x=>nameToks(x)).filter(x=>x.length);
function personScore(file,t){const F=persons(file);const B=[...persons(t.guide),...persons(t.kok)];if(!F.length||!B.length)return 0;
  const fm=(a,b)=>{const s=sim(a,b);return a===b||(a.length>=4&&b.length>=4&&(a.startsWith(b)||b.startsWith(a)))?1:s};
  const per=F.map(p=>Math.max(...B.map(q=>{const f=fm(p[0],q[0]);if(f<0.85)return 0;return p[1]&&q[1]?(fm(p[1],q[1])>=0.85?1:0.9):0.92})));
  return per.every(x=>x>0)?per.reduce((a,b)=>a+b,0)/per.length:0}
function tourScore(meta,t){const base=Math.max(personScore(meta.name,t),nameScore(meta.name,t.guide),nameScore(meta.name,t.kok),nameScore(meta.name,t.bus));
  // the group number only helps a name that already fits; alone it proves nothing
  return base+(base>=0.6&&meta.group&&new RegExp('\\b'+meta.group+'\\.?\\s*GRUP','i').test(t.name||'')?0.05:0)}
// the dates of a group: when most guests arrive / fly back (or the date in the file name)
function grpDates(P,meta){const top=k=>{const c={};P.guests.map(x=>x[k]).filter(Boolean).forEach(a=>c[a]=(c[a]||0)+1);const e=Object.entries(c).sort((a,b)=>b[1]-a[1])[0];return e?e[0]:null};
  const y=String(new Date().getFullYear());let a=top('ad');if(!a&&meta.date)a=`${y}-${meta.date.m}-${meta.date.d}`;let b=top('rd');
  if(a&&(!b||b<a||Date.parse(b)-Date.parse(a)>20*864e5))b=isoAdd(a,6);return {a,b}}
// a bus far from the group's dates is not this group's bus, even with the same guide
function dateFits(t,D){if(!D.a)return true;const s=t.days[0].d,e=t.days[t.days.length-1].d;return Date.parse(s)-Date.parse(D.a)<=4*864e5&&Date.parse(D.a)-Date.parse(e)<=0}
// no program loaded yet: the bus is made from the list itself (guides from the file name, days from arrival to return)
function busFromList(it){const D=grpDates(it.P,it.meta);const ppl=String(it.meta.name||'').split(/\s*[+&,]\s*|\s+VE\s+/i).map(x=>x.trim()).filter(Boolean);
  const a=D.a||isoToday(),b=D.b||isoAdd(a,6);const days=[];for(let d=a;d<=b&&days.length<15;d=isoAdd(d,1))days.push({d,s:[]});
  return {id:rid(),bus:(ppl[0]||'BUS').split(' ')[0],name:it.P.code||'',pax:String(it.P.guests.length),guide:ppl.join('/'),kok:'',days,fromList:true}}
let GIMP=null,GIMPW='tours';// review of a batch before anything is saved; shown in Excursions or under the upload box
const gimpEl=()=>$(GIMPW==='data'?'#grpReviewD':'#grpReview');
function checkGroup(it){it.warn=[];if(it.tid==='__new'){const t=busFromList(it);it.note=`будет создан новый автобус: ${t.guide||t.bus} · ${isoDM(t.days[0].d)}–${isoDM(t.days[t.days.length-1].d)} · ${it.P.guests.length} pax (программу можно загрузить потом — она сама ляжет в этот автобус)`;it.note2=it.P.parts>1?`в файле ${it.P.parts} части: ${it.P.code}`:'';it.added=null;return}
  const t=TOURS[it.tid];if(!t){it.warn.push('автобус не выбран');return}
  const start=t.days[0].d,end=t.days[t.days.length-1].d,y=start.slice(0,4);
  if(it.meta.date){const fd=`${y}-${it.meta.date.m}-${it.meta.date.d}`;const diff=Math.round((Date.parse(start)-Date.parse(fd))/864e5);
    if(diff<0||diff>3)it.warn.push(`дата в названии файла ${it.meta.date.d}.${it.meta.date.m}, а программа автобуса ${isoDM(start)}–${isoDM(end)}`)}
  const ads=it.P.guests.map(x=>x.ad).filter(Boolean);if(ads.length){const cnt={};ads.forEach(a=>cnt[a]=(cnt[a]||0)+1);const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0];
    const d=Math.round((Date.parse(start)-Date.parse(top))/864e5);if(d<-1||d>3)it.warn.push(`гости прилетают ${isoDM(top)}, а программа начинается ${isoDM(start)}`)}
  const pax=+t.pax||0,n=it.P.guests.length;if(pax&&Math.abs(pax-n)>2)it.warn.push(`в списке ${n} гостей, а у автобуса PAX ${pax}`);
  if(it.P.parts>1)it.note2=`в файле ${it.P.parts} части: ${it.P.code}`;
  if((t.gx||[]).length){const M=mergeGuests(t.gx,it.P.guests);it.note=`уже загружено ${gxLive(t).length} гостей → ${mergeMsg(M,it.P.guests.length)}`;it.added=M.added}else{it.note='';it.added=null}
  const same=GIMP.items.filter(o=>o!==it&&o.tid===it.tid&&!o.skip);
  if(same.length){const dup=same.find(o=>o.sig===it.sig);if(dup&&GIMP.items.indexOf(dup)<GIMP.items.indexOf(it)){it.skip=true;it.warn.push('копия того же файла — пропущу')}else if(!dup){it.conflict=true;it.warn.push('на этот же автобус выбран ещё один файл — выберите для одного из них другой автобус')}}}
async function importGroupFiles(files,where){GIMPW=where==='data'?'data':'tours';['#grpReview','#grpReviewD'].forEach(s=>{const e=$(s);if(e){e.hidden=true;e.innerHTML=''}});
  const items=[];
  for(const f of files){try{const rows=await readRows(f);if(!isGroupList(rows)){items.push({f,bad:'не похоже на список группы (нужны колонки Фамилия, Имя, Рейс)'});continue}
      const P=parseGroupList(rows);if(!P.guests.length){items.push({f,bad:'гостей в файле не нашёл'});continue}
      const meta=fileMeta(f.name);const D=grpDates(P,meta);const cand=tours().map(t=>({t,s:dateFits(t,D)?tourScore(meta,t):0})).sort((a,b)=>b.s-a.s);
      const best=cand[0]&&cand[0].s>=0.72&&(!cand[1]||cand[0].s-cand[1].s>=0.08)?cand[0].t.id:'__new';
      items.push({f,P,meta,tid:best,score:cand[0]?cand[0].s:0,sig:P.guests.map(x=>x.n).join('|')})}
    catch(e){items.push({f,bad:e.message})}}
  // copies named "… (1)" go after the original; two files that claim the same bus: the better name match keeps it
  items.sort((a,b)=>(/\(\d+\)/.test(a.f.name)-/\(\d+\)/.test(b.f.name))||a.f.name.localeCompare(b.f.name,'tr'));
  const by={};items.forEach(it=>{if(!it.tid||it.tid==='__new')return;(by[it.tid]=by[it.tid]||[]).push(it)});
  Object.values(by).forEach(L=>{if(L.length<2)return;const sig0=L[0].sig;if(L.every(x=>x.sig===sig0))return;L.sort((a,b)=>b.score-a.score);L.slice(1).forEach(x=>{if(x.sig!==L[0].sig){x.hint='похож на '+(TOURS[x.tid].bus||'')+', но этот автобус уже занят файлом «'+L[0].f.name+'»';x.tid=''}})});
  GIMP={items};renderGroupImport();gimpEl().scrollIntoView({behavior:'smooth',block:'start'})}
function renderGroupImport(){const el=gimpEl();if(!el)return;if(!GIMP){el.hidden=true;el.innerHTML='';return}
  GIMP.items.forEach(it=>{if(!it.bad){it.skip=false;it.conflict=false}});GIMP.items.forEach(it=>{if(!it.bad)checkGroup(it)});
  const all=tours();const opts=(sel,it)=>`<option value="__new"${sel==='__new'?' selected':''}>➕ новый автобус из этого списка${it&&it.meta&&it.meta.name?' ('+esc(it.meta.name)+')':''}</option><option value=""${sel===''?' selected':''}>— не загружать —</option>`+all.map(t=>`<option value="${esc(t.id)}"${t.id===sel?' selected':''}>${esc(t.bus||'?')} · ${esc(t.guide||'')} · ${isoDM(t.days[0].d)}–${isoDM(t.days[t.days.length-1].d)}${t.pax?' · '+esc(t.pax)+' pax':''}</option>`).join('');
  const ok=GIMP.items.filter(it=>!it.bad&&!it.skip&&!it.conflict&&it.tid);
  el.hidden=false;el.innerHTML=`<h3>📋 Списки групп: проверьте, кто куда</h3>
    <div class="gi-list">${GIMP.items.map((it,i)=>`<div class="gi ${it.bad?'bad':it.warn&&it.warn.length?'warn':'ok'}"><div class="gi-f"><b>${esc(it.f.name)}</b>${it.P?` <span class="chip">👥 ${it.P.guests.length}</span>${it.P.code?` <span class="hint">${esc(it.P.code)}</span>`:''}`:''}</div>
      ${it.bad?`<div class="gi-w">✗ ${esc(it.bad)}</div>`:`<label class="gi-sel">→ <select data-gisel="${i}">${opts(it.tid,it)}</select>${it.tid&&it.tid!=='__new'&&it.score>=0.72&&it.score<1.01?'<span class="hint"> найдено по имени гида и датам</span>':''}</label>
      ${it.warn.map(w=>`<div class="gi-w">⚠ ${esc(w)}</div>`).join('')}${it.hint&&!it.tid?`<div class="hint">${esc(it.hint)}</div>`:''}${it.note?`<div class="hint">${esc(it.note)}</div>`:''}${it.note2?`<div class="hint">${esc(it.note2)}</div>`:''}${it.added&&it.added.length?`<div class="hint">🆕 ${it.added.map(x=>esc(x.n)).join(', ')}</div>`:''}`}</div>`).join('')}</div>
    <p class="xact"><span class="hint">Будет загружено: ${ok.length} из ${GIMP.items.length}</span><span class="sp"></span><button type="button" class="btn" id="giCancel">Отмена</button><button type="button" class="btn primary" id="giGo"${ok.length?'':' disabled'}>Загрузить ${ok.length}</button></p>`;
  el.querySelectorAll('[data-gisel]').forEach(s=>s.onchange=()=>{GIMP.items[+s.dataset.gisel].tid=s.value;GIMP.items[+s.dataset.gisel].score=1;renderGroupImport()});
  $('#giCancel').onclick=()=>{GIMP=null;renderGroupImport()};
  $('#giGo').onclick=()=>{const warned=ok.filter(it=>it.warn.length);if(warned.length&&!confirm(T('Есть предупреждения')+` (${warned.length}). `+T('Всё равно загрузить?')))return;
    const msgs=ok.map(it=>{const t=it.tid==='__new'?busFromList(it):JSON.parse(JSON.stringify(TOURS[it.tid]));t.ghotels=t.ghotels||[];const M=applyGuests(t,it.P);saveTour(t.id,t);return `${t.bus}: ${it.tid==='__new'?'новый автобус, ':''}${mergeMsg(M,it.P.guests.length)}`});
    toast(`Списки загружены: ${msgs.join(' · ')}`);GIMP=null;renderGroupImport();renderTours()}}
