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
function tourScore(meta,t){return Math.max(nameScore(meta.name,t.guide),nameScore(meta.name,t.kok),nameScore(meta.name,t.bus),meta.group&&new RegExp('\\b'+meta.group+'\\.?\\s*GRUP','i').test(t.name||'')?0.9:0)}
let GIMP=null;// review of a batch before anything is saved
function checkGroup(it){const t=TOURS[it.tid];it.warn=[];if(!t){it.warn.push('автобус не найден — выберите вручную или сначала загрузите программу');return}
  const start=t.days[0].d,end=t.days[t.days.length-1].d,y=start.slice(0,4);
  if(it.meta.date){const fd=`${y}-${it.meta.date.m}-${it.meta.date.d}`;const diff=Math.round((Date.parse(start)-Date.parse(fd))/864e5);
    if(diff<0||diff>3)it.warn.push(`дата в названии файла ${it.meta.date.d}.${it.meta.date.m}, а программа автобуса ${isoDM(start)}–${isoDM(end)}`)}
  const ads=it.P.guests.map(x=>x.ad).filter(Boolean);if(ads.length){const cnt={};ads.forEach(a=>cnt[a]=(cnt[a]||0)+1);const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0];
    const d=Math.round((Date.parse(start)-Date.parse(top))/864e5);if(d<-1||d>3)it.warn.push(`гости прилетают ${isoDM(top)}, а программа начинается ${isoDM(start)}`)}
  const pax=+t.pax||0,n=it.P.guests.length;if(pax&&Math.abs(pax-n)>2)it.warn.push(`в списке ${n} гостей, а у автобуса PAX ${pax}`);
  if((t.gx||[]).length)it.note=`заменит текущий список (${t.gx.length} гостей)`;else it.note='';
  const same=GIMP.items.filter(o=>o!==it&&o.tid===it.tid&&!o.skip);
  if(same.length){const dup=same.find(o=>o.sig===it.sig);if(dup&&GIMP.items.indexOf(dup)<GIMP.items.indexOf(it)){it.skip=true;it.warn.push('копия того же файла — пропущу')}else if(!dup){it.conflict=true;it.warn.push('на этот же автобус выбран ещё один файл — выберите для одного из них другой автобус')}}}
async function importGroupFiles(files){
  const items=[];
  for(const f of files){try{const rows=await readRows(f);if(!isGroupList(rows)){items.push({f,bad:'не похоже на список группы (нужны колонки Фамилия, Имя, Рейс)'});continue}
      const P=parseGroupList(rows);if(!P.guests.length){items.push({f,bad:'гостей в файле не нашёл'});continue}
      const meta=fileMeta(f.name);const cand=tours().map(t=>({t,s:tourScore(meta,t)})).sort((a,b)=>b.s-a.s);
      const best=cand[0]&&cand[0].s>=0.72&&(!cand[1]||cand[0].s-cand[1].s>=0.08)?cand[0].t.id:'';
      items.push({f,P,meta,tid:best,score:cand[0]?cand[0].s:0,sig:P.guests.map(x=>x.n).join('|')})}
    catch(e){items.push({f,bad:e.message})}}
  // copies named "… (1)" go after the original; two files that claim the same bus: the better name match keeps it
  items.sort((a,b)=>(/\(\d+\)/.test(a.f.name)-/\(\d+\)/.test(b.f.name))||a.f.name.localeCompare(b.f.name,'tr'));
  const by={};items.forEach(it=>{if(!it.tid)return;(by[it.tid]=by[it.tid]||[]).push(it)});
  Object.values(by).forEach(L=>{if(L.length<2)return;const sig0=L[0].sig;if(L.every(x=>x.sig===sig0))return;L.sort((a,b)=>b.score-a.score);L.slice(1).forEach(x=>{if(x.sig!==L[0].sig){x.hint='похож на '+(TOURS[x.tid].bus||'')+', но этот автобус уже занят файлом «'+L[0].f.name+'»';x.tid=''}})});
  GIMP={items};renderGroupImport();$('#grpReview').scrollIntoView({behavior:'smooth',block:'start'})}
function renderGroupImport(){const el=$('#grpReview');if(!el)return;if(!GIMP){el.hidden=true;el.innerHTML='';return}
  GIMP.items.forEach(it=>{if(!it.bad){it.skip=false;it.conflict=false}});GIMP.items.forEach(it=>{if(!it.bad)checkGroup(it)});
  const all=tours();const opts=sel=>`<option value="">— выберите автобус —</option>`+all.map(t=>`<option value="${esc(t.id)}"${t.id===sel?' selected':''}>${esc(t.bus||'?')} · ${esc(t.guide||'')} · ${isoDM(t.days[0].d)}–${isoDM(t.days[t.days.length-1].d)}${t.pax?' · '+esc(t.pax)+' pax':''}</option>`).join('');
  const ok=GIMP.items.filter(it=>!it.bad&&!it.skip&&!it.conflict&&it.tid);
  el.hidden=false;el.innerHTML=`<h3>📋 Списки групп: проверьте, кто куда</h3>
    <div class="gi-list">${GIMP.items.map((it,i)=>`<div class="gi ${it.bad?'bad':it.warn&&it.warn.length?'warn':'ok'}"><div class="gi-f"><b>${esc(it.f.name)}</b>${it.P?` <span class="chip">👥 ${it.P.guests.length}</span>${it.P.code?` <span class="hint">${esc(it.P.code)}</span>`:''}`:''}</div>
      ${it.bad?`<div class="gi-w">✗ ${esc(it.bad)}</div>`:`<label class="gi-sel">→ <select data-gisel="${i}">${opts(it.tid)}</select>${it.tid&&it.score>=0.72&&it.score<1.01?'<span class="hint"> найдено по имени гида</span>':''}</label>
      ${it.warn.map(w=>`<div class="gi-w">⚠ ${esc(w)}</div>`).join('')}${it.hint&&!it.tid?`<div class="hint">${esc(it.hint)}</div>`:''}${it.note?`<div class="hint">${esc(it.note)}</div>`:''}`}</div>`).join('')}</div>
    <p class="xact"><span class="hint">Будет загружено: ${ok.length} из ${GIMP.items.length}</span><span class="sp"></span><button type="button" class="btn" id="giCancel">Отмена</button><button type="button" class="btn primary" id="giGo"${ok.length?'':' disabled'}>Загрузить ${ok.length}</button></p>`;
  el.querySelectorAll('[data-gisel]').forEach(s=>s.onchange=()=>{GIMP.items[+s.dataset.gisel].tid=s.value;GIMP.items[+s.dataset.gisel].score=1;renderGroupImport()});
  $('#giCancel').onclick=()=>{GIMP=null;renderGroupImport()};
  $('#giGo').onclick=()=>{const warned=ok.filter(it=>it.warn.length);if(warned.length&&!confirm(T('Есть предупреждения')+` (${warned.length}). `+T('Всё равно загрузить?')))return;
    ok.forEach(it=>{const t=JSON.parse(JSON.stringify(TOURS[it.tid]));t.gx=it.P.guests;t.guests=it.P.guests.map(x=>x.n);t.gcode=it.P.code;t.ghotels=it.P.hotels;if(!+t.pax)t.pax=String(it.P.guests.length);saveTour(t.id,t)});
    toast(`Списки загружены: ${ok.length}`);GIMP=null;renderGroupImport();renderTours()}}
