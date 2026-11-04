/* ---------- a tour group's guest list (Excel / PDF from the operator): who is in the bus, flights, phones, notes ---------- */
// Row: ID | Ваучер | Фамилия | Имя | Пол | Дата рождения | Телефон | TRNSFR | Паспорт | Рейс | Дата прилёта | Обратный рейс | Дата вылета | Комментарий
const usDate=s=>{const iso=String(s||'').match(/(\d{4})-(\d\d)-(\d\d)(?:[ T](\d{1,2}):(\d\d))?/);if(iso)return {iso:`${iso[1]}-${iso[2]}-${iso[3]}`,t:iso[4]?iso[4].padStart(2,'0')+':'+iso[5]:''};const m=String(s||'').match(/(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})(?:\s+(\d{1,2}):(\d\d))?/);if(!m)return null;
  // "/" lists are month/day/year (11/3/26 = 3 Nov); "." lists are day.month.year
  const us=/\//.test(m[0]);let d=+(us?m[2]:m[1]),mo=+(us?m[1]:m[2]),y=+m[3];if(y<100)y+=y>40?1900:2000;if(mo>12&&d<=12){const x=d;d=mo;mo=x}
  return {iso:`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`,t:m[4]?m[4].padStart(2,'0')+':'+m[5]:''}};
const flNorm=f=>String(f||'').toUpperCase().replace(/[\s-]+/g,'').replace(/^([A-Z0-9]{2})0*(\d+)$/,'$1 $2');
function isGroupList(rows){const S=rows.slice(0,6).map(r=>(r||[]).join(' ')).join(' ');return /Фамилия/i.test(S)&&/(Имя|Name)/i.test(S)&&/(Рейс|Flight)/i.test(S)||isGroupListTR(rows)}
// the Turkish layout: № | voucher | phone | booking | "Adı, Soyadı" (surname | name) | sex | Doğum Tarihi | passport (series | number | valid) |
// Geliş Tarihi | Geliş Yeri (flight) | Geliş saatı ("13:00-15:00") | Transfer ucreti | Dönüş Tarihi | Dönüş Yeri | Dönüş Saatı | Diğer odeme | comment
const isHdrTR=r=>{const u=(r||[]).map(c=>upTR(c)).join('|');return /ADI|ФАМИЛИЯ ИМЯ/.test(u)&&/GEL[İI]Ş/.test(u)&&/(DÖNÜ[ŞS]|DONUS)/.test(u)};
const isHdrRU=r=>{const u=(r||[]).map(c=>upTR(c)).join('|');return /ФАМИЛИЯ/.test(u)&&/ИМЯ/.test(u)&&/РЕЙС/.test(u)};
const grpHdrTR=rows=>rows.slice(0,8).findIndex(isHdrTR);
function isGroupListTR(rows){return grpHdrTR(rows)>=0}
const lat=s=>String(s||'').replace(/[АВЕКМНОРСТХУ]/g,c=>({А:'A',В:'B',Е:'E',К:'K',М:'M',Н:'H',О:'O',Р:'P',С:'C',Т:'T',Х:'X',У:'Y'})[c]);
function parseGroupListTR(rows){const h=grpHdrTR(rows),H=(rows[h]||[]).map(c=>upTR(c).replace(/\s+/g,' ').trim());const col=re=>H.findIndex(c=>re.test(c));
  const ni=col(/^ADI|^ФАМИЛИЯ/),sx=col(/SEX|CİNS|CINS|ПОЛ/),db=col(/DOĞUM|DOGUM/),ps=col(/ASAPORT|PASAPORT|PASSPORT/),ad=col(/GEL[İI]Ş TAR/),af=col(/GEL[İI]Ş (YER|UÇA|UCA)/),at=col(/GEL[İI]Ş SAAT/),tf=col(/TRANSFER/),rd=col(/(DÖNÜ[ŞS]|DONUS) TAR/),rf=col(/(DÖNÜ[ŞS]|DONUS) (YER|UÇA|UCA)/),rt=col(/(DÖNÜ[ŞS]|DONUS) SAAT/),ot=col(/D[İI]ĞER|DIGER/);
  // "Фамилия Имя" in one cell (the next column has its own title) or surname | name in two cells ("Adı, Soyadı" over both)
  const one=ni>=0&&!!H[ni+1];
  const data=rows.slice(h+1).filter(r=>r&&r.some(c=>String(c||'').trim()));
  // the phone column: in the old layout two columns before the name, otherwise the untitled column that holds phone numbers
  const isPh=v=>/^\+?[\d\s()-]{10,}$/.test(String(v||'').trim())&&String(v).replace(/\D/g,'').length>=10;
  let pc=-1;{let best=0;H.forEach((t,i)=>{if(t&&i!==ni-2)return;const n=data.filter(r=>isPh(r[i])).length;if(n>best){best=n;pc=i}})}
  const out={code:'',hotels:[],guests:[]};const cell=(r,i)=>i>=0&&r[i]!=null?String(r[i]).replace(/\s+/g,' ').trim():'';
  rows.slice(0,h).forEach(r=>{const L=(r||[]).map(c=>String(c||'').trim()).filter(Boolean).join(' ');if(L&&!out.code&&!/^\d+\.?$/.test(L))out.code=L});
  let fam=null;
  rows.slice(h+1).forEach(r=>{r=r||[];const L=r.map(c=>String(c==null?'':c).trim()).filter(Boolean).join(' ');if(!L)return;
    const hs=L.match(/^(\d{1,2}\.\d{1,2})\s*-\s*(\d{1,2}\.\d{1,2})\s*(?:-\s*|\s+)([A-ZÇĞİÖŞÜa-z].*)$/);if(hs){out.hotels.push(`${hs[1]}–${hs[2]} ${hs[3].trim()}`);return}
    let sur,nm;if(one){const w=cell(r,ni).replace(/\s+\d+$/,'').split(' ');sur=w[0]||'';nm=w.slice(1).join(' ')}else{sur=cell(r,ni);nm=cell(r,ni+1).replace(/\s+\d+$/,'')}if(!sur&&!nm)return;
    // column 1: a voucher (has digits or a dash) — or a room type (DBL, TRIPLE), which is not a voucher
    const no=+cell(r,0)||out.guests.length+1,c1=cell(r,1),v=/\d|-/.test(c1)?c1:'',room=v?'':c1,ph=pc>=0?cell(r,pc):'';
    // the first row of a family has the voucher / phone / booking; the rows under it are the same family
    if(v||ph||(!one&&cell(r,3))||!fam)fam={v,phone:ph.replace(/\D/g,'').length>=10?'+'+ph.replace(/\D/g,'').replace(/^8(\d{10})$/,'7$1'):ph,code:one?'':cell(r,3),c:''};
    const fl=lat(cell(r,af).toUpperCase()),self=/KEND[İI]|KENDI/i.test(fl);const tm=cell(r,at).match(/(\d{1,2}:\d\d)\s*$/);
    const pass=ps>=0?[cell(r,ps),cell(r,ps+1)].filter(Boolean).join(' '):'';
    const fee=cell(r,tf),oth=cell(r,ot),com=cell(r,ot>=0?ot+1:-1);if(com)fam.c=fam.c?fam.c+' '+com:com;
    const A=usDate(cell(r,ad)),R=usDate(cell(r,rd));const rfl=lat(cell(r,rf).toUpperCase());
    out.guests.push({no,n:(sur+' '+nm).trim(),sex:cell(r,sx).toUpperCase().replace(/^W$/,'F'),room,dob:(usDate(cell(r,db))||{}).iso||'',phone:fam.phone,trf:[fee?fee+(/\D/.test(fee)?'':' USD'):'',oth].filter(Boolean).join(' · '),pass,
      af:self?'':flNorm(fl),ad:A?A.iso:'',at:tm?tm[1].padStart(5,'0'):'',rf:/^[A-Z0-9]{2}[\s-]?\d/.test(rfl)?flNorm(rfl):'',rd:R?R.iso:'',rt:(cell(r,rt).match(/\d{1,2}:\d\d/)||[''])[0].padStart(5,'0').replace(/^0+$/,''),
      v:fam.v||fam.code,c:'',self,_f:fam})});
  // comments and the family key are shared by the family (same layout as the Russian lists)
  out.guests.forEach(x=>{const f=x._f;delete x._f;x.fam=f.phone.replace(/\D/g,'')||f.v||f.code||String(x.no);x.c=[x.self?'До отеля сами (KENDİ GİDER).':'',f.c].filter(Boolean).join(' ');delete x.self});
  return out}
// a file can hold several parts (the first group, then guests added later with another layout and their own code):
// each part is read with its own columns and the guests are put together
function parseGroupList(rows){
  const hs=[];rows.forEach((r,i)=>{if(isHdrRU(r)||isHdrTR(r))hs.push(i)});
  if(hs.length>1){const out={code:'',hotels:[],guests:[]};
    hs.forEach((h,k)=>{const beg=k===0?0:(rows[h-1]||[]).some(c=>String(c||'').trim())?h-1:h;const end=k+1<hs.length?hs[k+1]-1:rows.length;
      const P=parseGroupList1(rows.slice(beg,end));const n0=out.guests.length;
      P.guests.forEach(x=>{if(out.guests.some(y=>y.n===x.n&&y.dob===x.dob))return;out.guests.push(x)});
      if(P.code)out.code=out.code?out.code+' + '+P.code:P.code;P.hotels.forEach(x=>{if(!out.hotels.includes(x))out.hotels.push(x)})});
    out.parts=hs.length;return out}
  return parseGroupList1(rows)}
function parseGroupList1(rows){if(isGroupListTR(rows))return parseGroupListTR(rows);
  const lines=rows.map(r=>(r||[]).filter(c=>c!=null&&String(c).trim()!=='').map(c=>String(c).replace(/\s+/g,' ').trim()).join('  ')).filter(Boolean);
  const out={code:'',hotels:[],guests:[]};const loose=[];
  const G=/^(\d{1,3})\s+(?:([A-Z]{2,6}-[A-Z]{1,5}-\d{2,8}|[A-Z]{2,6}\d{2,8})\s+)?(.+?)\s+(F|M|CHD|INF|Ж|М)\s+(\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}|\d{4}-\d\d-\d\d)\s*(.*)$/;
  lines.forEach((L,li)=>{
    const g=L.match(G);
    if(g){const rest=g[6];const ph=rest.match(/\+?\d{1,3}\s?\(\d{2,4}\)\s?\d{3}(?:-\d{4}|-\d{2}-\d{2}|\s\d{2}\s\d{2}|\d{4})|\+\d{1,3}(?:\s\d{2,4}){3,5}(?=\s|$)|\+\d{10,13}/);let r=ph?rest.slice(ph.index+ph[0].length):rest;
      const pr=r.match(/(\d+)\s*(USD|EUR|TL|\$)/i);if(pr)r=r.slice(pr.index+pr[0].length);
      const pp=r.match(/^\s*([A-Z]{0,2}\d{5,10})\b/);if(pp)r=r.slice(pp[0].length);
      const fx=/([A-Z0-9]{2}[\s-]?\d{1,4})\s+(\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}(?:\s+\d{1,2}:\d\d)?|\d{4}-\d\d-\d\d(?:[ T]\d{1,2}:\d\d(?::\d\d)?)?)/g;const F=[];let m;
      while((m=fx.exec(r)))F.push({f:flNorm(m[1]),d:usDate(m[2]),end:fx.lastIndex});
      let end=F.length?F[F.length-1].end:0;let rd='';
      if(F.length<2){const nx=r.slice(end).match(/^\s*-\s+(ПОТОМ КУПЯТ|ПОТОМ|\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}|-)/i);if(nx){rd=nx[1]==='-'?'':nx[1];end+=nx[0].length}}
      const name=g[3].replace(/^[^A-ZÇĞİÖŞÜa-zА-Яа-я]+/,'').replace(/\s+/g,' ').trim();const dob=usDate(g[5]);
      out.guests.push({no:+g[1],n:name,sex:g[4].replace('Ж','F').replace('М','M'),dob:dob?dob.iso:'',phone:ph?ph[0].replace(/\s+/g,' ').trim():'',trf:pr?pr[1]+' '+pr[2].toUpperCase():'',pass:pp?pp[1]:'',
        af:F[0]?F[0].f:'',ad:F[0]&&F[0].d?F[0].d.iso:'',at:F[0]&&F[0].d?F[0].d.t:'',rf:F[1]?F[1].f:'',rd:F[1]&&F[1].d?F[1].d.iso:(rd?(usDate(rd)?usDate(rd).iso:rd):''),rt:F[1]&&F[1].d?F[1].d.t:'',
        v:g[2]||'',c:r.slice(end).replace(/^[\s\-]+/,'').trim(),cp:[],li});return}
    const hs=L.match(/^(\d{1,2}\.\d{1,2})\s*-\s*(\d{1,2}\.\d{1,2})\s*(?:-\s*|\s+)([A-ZÇĞİÖŞÜa-z].*)$/);if(hs){out.hotels.push(`${hs[1]}–${hs[2]} ${hs[3].trim()}`);return}
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
  const ALL=t.gx||[];const X=ALL.filter(x=>!x.gone);const reps=(()=>{try{return repList(iso)}catch(e){return []}})();
  const days=new Set(t.days.map(d=>d.d.slice(5)));
  const fams=[];ALL.forEach((x,i)=>{if(x.gone)return;let f=fams.find(f=>f.k===x.fam);if(!f){f={k:x.fam,rows:[]};fams.push(f)}f.rows.push({x,i})});
  const fresh=x=>x.add&&isoAdd(x.add,3)>=isoToday();const nNew=X.filter(fresh).length;const goneL=ALL.map((x,i)=>({x,i})).filter(r=>r.x.gone);
  const bd=X.filter(x=>x.dob&&days.has(x.dob.slice(5)));const pay=fams.filter(f=>f.rows.some(r=>/ОПЛАТ|ДОПЛАТ|USD|ДОЛГ|НА МЕСТЕ/i.test(r.x.c)));
  const kids=X.filter(x=>/CHD|INF/.test(x.sex)||ageOn(x.dob,iso)!==''&&ageOn(x.dob,iso)<12);
  const q=(TGQ[t.id]||'').toLocaleUpperCase('tr').replace(/[\s-]+/g,'');
  const show=f=>!q||f.rows.some(r=>(r.x.n+r.x.phone+r.x.af+r.x.rf+r.x.c+r.x.v).toLocaleUpperCase('tr').replace(/[\s\-()]+/g,'').includes(q));
  const note=i=>((TM[t.id+'|gn|'+i]||{}).note)||'';
  // one short line per guest; a tap opens flights, voucher and the Note / Report buttons. A written note stays visible.
  const row=({x,i},f)=>{const a=ageOn(x.dob,iso);const bday=x.dob&&days.has(x.dob.slice(5));const nr=reps.filter(r=>r.guest&&r.guest.toLocaleUpperCase('tr')===x.n.toLocaleUpperCase('tr')).length;const nt=note(i);
    const kid=/CHD|INF/.test(x.sex)||a!==''&&a<12;const r0=f.rows[0].x;
    return `<details class="gx" data-gxo="${esc(t.id)}|${i}"${GXOPEN.has(t.id+'|'+i)||q&&f.rows.length>1&&(x.n.toLocaleUpperCase('tr').replace(/[\s-]+/g,'').includes(q))?' open':''}><summary><span class="gx-n"><span class="hint">${x.no}.</span> <b>${esc(x.n)}</b>${fresh(x)?` <span class="chip gx-new" title="Добавлен ${gxDm(x.add)}">🆕</span>`:''}${x.room?` <span class="hint">${esc(x.room)}</span>`:''}</span><span class="gx-m">${a!==''?(a===0?(LANG==='tr'?'<1 yaş':'<1 г.'):a+' '+(LANG==='tr'?'yaş':'л.')):''}${kid?' 👶':''}${bday?` <b class="bday">🎂 ${gxDm(x.dob)}</b>`:''}${nr?` <span class="chip rep-t">📝 ${nr}</span>`:''}${slBadge(t.id,i)}</span><span class="gx-x">▾</span>
      ${nt?`<span class="gnote">✎ ${esc(nt)}</span>`:''}</summary>
      <div class="gx-body"><div class="gx-d">${x.af?`<span>🛬 ${esc(x.af)} ${gxDm(x.ad)} ${esc(x.at)}</span>`:''}${x.rf||x.rd?`<span>🛫 ${esc(x.rf||'—')} ${gxDm(x.rd)} ${esc(x.rt)}</span>`:''}<span class="hint">${esc(x.sex)}${x.dob?' · '+gxDm(x.dob)+'.'+x.dob.slice(0,4):''}</span></div>
        <div class="gx-d hint">${r0.v?`<span>ваучер ${esc(r0.v)}</span>`:''}${x.trf&&isOps()?`<span>трансфер ${esc(x.trf)}</span>`:''}${x.pass&&isOps()?`<span>паспорт ${esc(x.pass)}</span>`:''}</div>
        ${guestSaleHtml(t,i)}
        <div class="gx-b"><button type="button" class="btn sm" data-gxnote="${esc(t.id)}|${i}">✎ ${nt?'Изменить заметку':'Заметка'}</button><button type="button" class="btn sm" data-trep="${esc(t.id)}|${i}">📝 Рапорт</button></div></div></details>`};
  return `<div class="tguests">
    <div class="gx-top">${t.gcode?`<b>${esc(t.gcode)}</b>`:''}<span class="chip">👥 ${X.length}</span>${nNew?`<span class="chip gx-new">🆕 +${nNew}</span>`:''}${kids.length?`<span class="chip">👶 ${kids.length}</span>`:''}${bd.length?`<span class="chip bday">🎂 ${bd.map(x=>esc(x.n.split(' ')[0])+' '+gxDm(x.dob)).join(', ')}</span>`:''}${pay.length&&isOps()?`<span class="chip rep-t">💵 ${pay.length} семей</span>`:''}</div>
    ${(t.ghotels||[]).length?`<div class="gx-hot">🏨 ${t.ghotels.map(esc).join(' · ')}</div>`:''}
    <input class="gx-q" data-gxq="${esc(t.id)}" value="${esc(TGQ[t.id]||'')}" placeholder="Поиск: фамилия, телефон, рейс" aria-label="Поиск гостя">
    <div class="gx-list">${fams.filter(show).map(f=>{const r0=f.rows[0].x;const cm=[...new Set(f.rows.map(r=>r.x.c).filter(Boolean))].join(' · ');const ph=r0.phone;
      return `<div class="gx-fam"><div class="gx-fh">${ph?`<a class="tel" href="tel:${esc(ph.replace(/[^\d+]/g,''))}">📞 ${esc(ph)}</a><a class="wa" target="_blank" rel="noopener" href="https://wa.me/${esc(ph.replace(/\D/g,''))}">WhatsApp</a>`:'<span class="hint">без телефона</span>'}${cm?`<span class="gx-c ${/ОПЛАТ|ДОПЛАТ|USD|ДОЛГ|НА МЕСТЕ/i.test(cm)?'pay':''}" title="${esc(cm)}">💬 ${esc(cm)}</span>`:''}</div>
        ${f.rows.map(r=>row(r,f)).join('')}</div>`}).join('')}</div>
    ${goneL.length?`<details class="gx-gone"><summary>Нет в последнем списке: ${goneL.length}</summary>${goneL.map(r=>`<div class="hint"><s>${r.x.no}. ${esc(r.x.n)}</s> · убран ${gxDm(r.x.gone)}</div>`).join('')}</details>`:''}
    <div class="tact"><label class="btn sm">⬆ Заменить список<input type="file" data-tgfile="${esc(t.id)}" accept=".xlsx,.xls,.csv,.pdf" hidden></label><button type="button" class="btn sm" data-trep="${esc(t.id)}|-1">📝 Рапорт (без имени)</button><button type="button" class="btn sm" data-tglist="${esc(t.id)}">📋 Список гостей в WhatsApp</button></div></div>`}
var TGQ=TGQ||{};
const gxKey=x=>String(x.n||'').toLocaleUpperCase('tr').replace(/[^A-ZÇĞİÖŞÜ]/g,'')+'|'+(x.dob||'');
const gxNameKey=x=>String(x.n||'').toLocaleUpperCase('tr').replace(/[^A-ZÇĞİÖŞÜ]/g,'');
// returns the merged list and what changed; new guests are marked with today's date, missing ones with "gone" (kept, shown apart)
function mergeGuests(old,nw){old=old||[];const out=old.map(x=>Object.assign({},x));const used=new Set();const added=[],gone=[];let upd=0;
  nw.forEach(x=>{let i=out.findIndex((o,j)=>!used.has(j)&&gxKey(o)===gxKey(x));if(i<0)i=out.findIndex((o,j)=>!used.has(j)&&gxNameKey(o)===gxNameKey(x)&&(!o.dob||!x.dob));
    if(i>=0){used.add(i);const o=out[i];const keep={add:o.add};out[i]=Object.assign({},x,keep);delete out[i].gone;if(JSON.stringify(Object.assign({},o,{gone:undefined}))!==JSON.stringify(out[i]))upd++}
    else{out.push(old.length?Object.assign({},x,{add:isoToday()}):Object.assign({},x));used.add(out.length-1);added.push(x)}});
  out.forEach((o,j)=>{if(!used.has(j)&&!o.gone){o.gone=isoToday();gone.push(o)}});
  return {gx:out,added,gone,upd,first:!old.length}}
const gxLive=t=>(t.gx||[]).filter(x=>!x.gone);
function applyGuests(t,P){const M=mergeGuests(t.gx,P.guests);t.gx=M.gx;t.guests=gxLive(t).map(x=>x.n);t.gcode=P.code||t.gcode;t.ghotels=P.hotels&&P.hotels.length?P.hotels:t.ghotels;if(!+t.pax)t.pax=String(gxLive(t).length);return M}
const mergeMsg=(M,n)=>M.first?`загружено ${n} гостей`:`${M.added.length?'+'+M.added.length+' новых':'новых нет'}${M.gone.length?', '+M.gone.length+' нет в новом списке':''}${M.upd?', обновлено '+M.upd:''}`;
async function importGroupList(tid,file){
  try{const rows=await readRows(file);if(!isGroupList(rows))throw new Error('это не похоже на список группы (нужны колонки Фамилия, Имя, Рейс)');
    const P=parseGroupList(rows);if(!P.guests.length)throw new Error('не нашёл гостей в файле');
    const t=JSON.parse(JSON.stringify(TOURS[tid]));const M=applyGuests(t,P);
    saveTour(tid,t);TGOPEN.add(tid);tourRefresh();
    toast(`Список группы: ${mergeMsg(M,P.guests.length)}`)}
  catch(e){toast('Не удалось прочитать список: '+e.message)}}
var GXOPEN=GXOPEN||new Set();// guest lines left open stay open when the list is redrawn (after a sale, a note)
function bindGroupGuests(el){bindSales(el);
  el.querySelectorAll('[data-gxo]').forEach(d=>d.ontoggle=()=>{d.open?GXOPEN.add(d.dataset.gxo):GXOPEN.delete(d.dataset.gxo)});
  el.querySelectorAll('[data-gso]').forEach(d=>d.ontoggle=()=>{d.open?GXOPEN.add('s:'+d.dataset.gso):GXOPEN.delete('s:'+d.dataset.gso)});
  el.querySelectorAll('[data-tgfile]').forEach(i=>i.onchange=e=>{const f=e.target.files[0];if(f)importGroupList(i.dataset.tgfile,f);e.target.value=''});
  el.querySelectorAll('[data-gxq]').forEach(i=>i.oninput=()=>{TGQ[i.dataset.gxq]=i.value;const pos=i.selectionStart;tourRefresh();const n=[...document.querySelectorAll(`[data-gxq="${CSS.escape(i.dataset.gxq)}"]`)].find(n=>n.offsetParent)||document.querySelector(`[data-gxq="${CSS.escape(i.dataset.gxq)}"]`);if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch(e){}}});
  el.querySelectorAll('[data-gxnote]').forEach(b=>b.onclick=()=>{const [tid,i]=b.dataset.gxnote.split('|');const t=TOURS[tid];const x=(t.gx||[])[+i];if(!x)return;const k=tid+'|gn|'+i;
    const v=prompt(trText(`Заметка про ${x.n} (видят офис и гиды). Пусто — удалить.`),(TM[k]||{}).note||'');if(v===null)return;saveTM(k,v.trim()?{note:v.trim(),at:nowMinutes()}:null);tourRefresh();toast(v.trim()?'Заметка сохранена':'Заметка удалена')})}
