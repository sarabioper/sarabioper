/* ---------- a tour group's guest list (Excel / PDF from the operator): who is in the bus, flights, phones, notes ---------- */
// Row: ID | Ваучер | Фамилия | Имя | Пол | Дата рождения | Телефон | TRNSFR | Паспорт | Рейс | Дата прилёта | Обратный рейс | Дата вылета | Комментарий
const usDate=s=>{const iso=String(s||'').match(/(\d{4})-(\d\d)-(\d\d)(?:[ T](\d{1,2}):(\d\d))?/);if(iso)return {iso:`${iso[1]}-${iso[2]}-${iso[3]}`,t:iso[4]?iso[4].padStart(2,'0')+':'+iso[5]:''};const m=String(s||'').match(/(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})(?:\s+(\d{1,2}):(\d\d))?/);if(!m)return null;
  // "/" lists are month/day/year (11/3/26 = 3 Nov); "." lists are day.month.year
  const us=/\//.test(m[0]);let d=+(us?m[2]:m[1]),mo=+(us?m[1]:m[2]),y=+m[3];if(y<100)y+=y>40?1900:2000;if(mo>12&&d<=12){const x=d;d=mo;mo=x}
  return {iso:`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`,t:m[4]?m[4].padStart(2,'0')+':'+m[5]:''}};
const flNorm=f=>String(f||'').toUpperCase().replace(/[\s-]+/g,'').replace(/^([A-Z0-9]{2})0*(\d+)$/,'$1 $2');
function isGroupList(rows){const S=rows.slice(0,6).map(r=>(r||[]).join(' ')).join(' ');return /Фамилия/i.test(S)&&/(Имя|Name)/i.test(S)&&/(Рейс|Flight)/i.test(S)}
function parseGroupList(rows){
  const lines=rows.map(r=>(r||[]).filter(c=>c!=null&&String(c).trim()!=='').map(c=>String(c).replace(/\s+/g,' ').trim()).join('  ')).filter(Boolean);
  const out={code:'',hotels:[],guests:[]};const loose=[];
  const G=/^(\d{1,3})\s+(?:([A-Z]{2,6}-[A-Z]{1,5}-\d{2,8})\s+)?(.+?)\s+(F|M|CHD|INF|Ж|М)\s+(\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}|\d{4}-\d\d-\d\d)\s*(.*)$/;
  lines.forEach((L,li)=>{
    const g=L.match(G);
    if(g){const rest=g[6];const ph=rest.match(/\+?\d{1,3}\s?\(\d{2,4}\)\s?\d{3}(?:-\d{4}|-\d{2}-\d{2}|\s\d{2}\s\d{2}|\d{4})|\+\d{10,13}/);let r=ph?rest.slice(ph.index+ph[0].length):rest;
      const pr=r.match(/(\d+)\s*(USD|EUR|TL|\$)/i);if(pr)r=r.slice(pr.index+pr[0].length);
      const pp=r.match(/^\s*([A-Z]{0,2}\d{5,10})\b/);if(pp)r=r.slice(pp[0].length);
      const fx=/([A-Z0-9]{2}[\s-]?\d{1,4})\s+(\d{1,2}\/\d{1,2}\/\d{2,4}(?:\s+\d{1,2}:\d\d)?|\d{4}-\d\d-\d\d(?:[ T]\d{1,2}:\d\d(?::\d\d)?)?)/g;const F=[];let m;
      while((m=fx.exec(r)))F.push({f:flNorm(m[1]),d:usDate(m[2]),end:fx.lastIndex});
      let end=F.length?F[F.length-1].end:0;let rd='';
      if(F.length<2){const nx=r.slice(end).match(/^\s*-\s+(ПОТОМ КУПЯТ|ПОТОМ|\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}|-)/i);if(nx){rd=nx[1]==='-'?'':nx[1];end+=nx[0].length}}
      const name=g[3].replace(/\s+/g,' ').trim();const dob=usDate(g[5]);
      out.guests.push({no:+g[1],n:name,sex:g[4].replace('Ж','F').replace('М','M'),dob:dob?dob.iso:'',phone:ph?ph[0].replace(/\s+/g,' ').trim():'',trf:pr?pr[1]+' '+pr[2].toUpperCase():'',pass:pp?pp[1]:'',
        af:F[0]?F[0].f:'',ad:F[0]&&F[0].d?F[0].d.iso:'',at:F[0]&&F[0].d?F[0].d.t:'',rf:F[1]?F[1].f:'',rd:F[1]&&F[1].d?F[1].d.iso:(rd?(usDate(rd)?usDate(rd).iso:rd):''),rt:F[1]&&F[1].d?F[1].d.t:'',
        v:g[2]||'',c:r.slice(end).replace(/^[\s\-]+/,'').trim(),cp:[],li});return}
    const hs=L.match(/^(\d{1,2}\.\d{1,2})\s*-\s*(\d{1,2}\.\d{1,2})\s*-\s*(.+)$/);if(hs){out.hotels.push(`${hs[1]}–${hs[2]} ${hs[3].trim()}`);return}
    if(!out.guests.length&&!/Фамилия|Ваучер|Комментарий/i.test(L)){if(!out.code)out.code=L;return}
    if(/Фамилия|Ваучер|Комментарий/i.test(L))return;
    loose.push({L,li})});
  // a line printed between two rows (voucher, wrapped comment) belongs to the family it sits in:
  // the next guest if he starts a new family, otherwise the previous one
  const fam=x=>x.phone.replace(/\D/g,'')||x.v||String(x.no);
  loose.forEach(({L,li})=>{const prev=[...out.guests].reverse().find(x=>x.li<li),next=out.guests.find(x=>x.li>li);
    const to=!prev?next:!next?prev:(fam(next)!==fam(prev)?next:prev);if(!to)return;
    if(/^[A-Z]{2,6}-[A-Z]{1,5}-\d{2,8}$/.test(L)){const f=fam(to);out.guests.filter(x=>fam(x)===f&&!x.v).forEach(x=>x.v=L);return}
    to.cp.push({L,li})});
  // one family = same phone; the voucher and the comment are shared by the family
  out.guests.forEach(x=>{x.fam=fam(x);// comment parts in the order they are printed
    const parts=[...x.cp,{L:x.c,li:x.li}].filter(p=>p.L).sort((a,b)=>a.li-b.li);x.c=parts.map(p=>p.L).join(' ');delete x.cp;delete x.li});
  return out}
const ageOn=(dob,iso)=>{if(!dob)return '';const [y,m,d]=dob.split('-').map(Number),[Y,M,D]=(iso||isoToday()).split('-').map(Number);return Y-y-((M<m||M===m&&D<d)?1:0)};
const gxDm=iso=>iso&&/^\d{4}-/.test(iso)?iso.slice(8,10)+'.'+iso.slice(5,7):(iso||'');
function groupGuestsHtml(t,iso){
  const X=t.gx||[];const reps=(()=>{try{return repList(iso)}catch(e){return []}})();
  const days=new Set(t.days.map(d=>d.d.slice(5)));
  const fams=[];X.forEach((x,i)=>{let f=fams.find(f=>f.k===x.fam);if(!f){f={k:x.fam,rows:[]};fams.push(f)}f.rows.push({x,i})});
  const bd=X.filter(x=>x.dob&&days.has(x.dob.slice(5)));const pay=fams.filter(f=>f.rows.some(r=>/ОПЛАТ|ДОПЛАТ|USD|ДОЛГ|НА МЕСТЕ/i.test(r.x.c)));
  const kids=X.filter(x=>/CHD|INF/.test(x.sex)||ageOn(x.dob,iso)!==''&&ageOn(x.dob,iso)<12);
  const q=(TGQ[t.id]||'').toLocaleUpperCase('tr').replace(/[\s-]+/g,'');
  const show=f=>!q||f.rows.some(r=>(r.x.n+r.x.phone+r.x.af+r.x.rf+r.x.c+r.x.v).toLocaleUpperCase('tr').replace(/[\s\-()]+/g,'').includes(q));
  const note=i=>((TM[t.id+'|gn|'+i]||{}).note)||'';
  const row=({x,i})=>{const a=ageOn(x.dob,iso);const bday=x.dob&&days.has(x.dob.slice(5));const nr=reps.filter(r=>r.guest&&r.guest.toLocaleUpperCase('tr')===x.n.toLocaleUpperCase('tr')).length;const nt=note(i);
    return `<div class="gx"><div class="gx-h"><span class="gx-n">${x.no}. <b>${esc(x.n)}</b></span><span class="hint">${esc(x.sex)}${a!==''?' · '+a+' лет':''}${bday?` · <b class="bday">🎂 ДР ${gxDm(x.dob)}</b>`:''}</span>${nr?`<span class="chip rep-t">📝 ${nr}</span>`:''}</div>
      <div class="gx-d">${x.af?`<span>🛬 ${esc(x.af)} ${gxDm(x.ad)} ${esc(x.at)}</span>`:''}${x.rf||x.rd?`<span>🛫 ${esc(x.rf||'—')} ${gxDm(x.rd)} ${esc(x.rt)}</span>`:''}${x.pass?`<span class="hint">паспорт ${esc(x.pass)}</span>`:''}</div>
      ${nt?`<div class="gnote">📝 ${esc(nt)}</div>`:''}
      <div class="gx-b"><button type="button" class="btn sm" data-gxnote="${esc(t.id)}|${i}">✎ Заметка</button><button type="button" class="btn sm" data-trep="${esc(t.id)}|${i}">📝 Рапорт</button></div></div>`};
  return `<div class="tguests">
    <div class="gx-top">${t.gcode?`<b>${esc(t.gcode)}</b>`:''}<span class="chip">👥 ${X.length}</span>${kids.length?`<span class="chip">👶 детей ${kids.length}</span>`:''}${bd.length?`<span class="chip bday">🎂 ДР в туре: ${bd.map(x=>esc(x.n.split(' ')[0])+' '+gxDm(x.dob)).join(', ')}</span>`:''}${pay.length?`<span class="chip rep-t">💵 оплата / комментарий: ${pay.length} семей</span>`:''}</div>
    ${(t.ghotels||[]).length?`<div class="gx-hot">🏨 ${t.ghotels.map(esc).join(' · ')}</div>`:''}
    <input class="gx-q" data-gxq="${esc(t.id)}" value="${esc(TGQ[t.id]||'')}" placeholder="Поиск: фамилия, телефон, рейс, комментарий" aria-label="Поиск гостя">
    ${fams.filter(show).map(f=>{const r0=f.rows[0].x;const cm=[...new Set(f.rows.map(r=>r.x.c).filter(Boolean))].join(' · ');const ph=r0.phone;
      return `<div class="gx-fam"><div class="gx-fh">${ph?`<a class="tel" href="tel:${esc(ph.replace(/[^\d+]/g,''))}">📞 ${esc(ph)}</a> <a class="wa" target="_blank" rel="noopener" href="https://wa.me/${esc(ph.replace(/\D/g,''))}">WhatsApp</a>`:''}${r0.v?`<span class="hint">ваучер ${esc(r0.v)}</span>`:''}${r0.trf?`<span class="hint">трансфер ${esc(r0.trf)}</span>`:''}</div>
        ${cm?`<div class="gx-c ${/ОПЛАТ|ДОПЛАТ|USD|ДОЛГ|НА МЕСТЕ/i.test(cm)?'pay':''}">💬 ${esc(cm)}</div>`:''}${f.rows.map(row).join('')}</div>`}).join('')}
    <div class="tact"><label class="btn sm">⬆ Заменить список<input type="file" data-tgfile="${esc(t.id)}" accept=".xlsx,.xls,.pdf" hidden></label><button type="button" class="btn sm" data-trep="${esc(t.id)}|-1">📝 Рапорт (без имени)</button><button type="button" class="btn sm" data-tglist="${esc(t.id)}">📋 Список гостей в WhatsApp</button></div></div>`}
var TGQ=TGQ||{};
async function importGroupList(tid,file){
  try{const rows=await readRows(file);if(!isGroupList(rows))throw new Error('это не похоже на список группы (нужны колонки Фамилия, Имя, Рейс)');
    const P=parseGroupList(rows);if(!P.guests.length)throw new Error('не нашёл гостей в файле');
    const t=JSON.parse(JSON.stringify(TOURS[tid]));t.gx=P.guests;t.guests=P.guests.map(x=>x.n);t.gcode=P.code;t.ghotels=P.hotels;if(!+t.pax)t.pax=String(P.guests.length);
    saveTour(tid,t);TGOPEN.add(tid);tourRefresh();
    toast(`Список группы загружен: ${P.guests.length} гостей${P.hotels.length?', отели: '+P.hotels.length:''}`)}
  catch(e){toast('Не удалось прочитать список: '+e.message)}}
function bindGroupGuests(el){
  el.querySelectorAll('[data-tgfile]').forEach(i=>i.onchange=e=>{const f=e.target.files[0];if(f)importGroupList(i.dataset.tgfile,f);e.target.value=''});
  el.querySelectorAll('[data-gxq]').forEach(i=>i.oninput=()=>{TGQ[i.dataset.gxq]=i.value;const pos=i.selectionStart;tourRefresh();const n=document.querySelector(`[data-gxq="${CSS.escape(i.dataset.gxq)}"]`);if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch(e){}}});
  el.querySelectorAll('[data-gxnote]').forEach(b=>b.onclick=()=>{const [tid,i]=b.dataset.gxnote.split('|');const t=TOURS[tid];const x=(t.gx||[])[+i];if(!x)return;const k=tid+'|gn|'+i;
    const v=prompt(trText(`Заметка про ${x.n} (видят офис и гиды). Пусто — удалить.`),(TM[k]||{}).note||'');if(v===null)return;saveTM(k,v.trim()?{note:v.trim(),at:nowMinutes()}:null);tourRefresh();toast(v.trim()?'Заметка сохранена':'Заметка удалена')})}
