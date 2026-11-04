/* ---------- season plan (director): the departure board "20.09.2026 - 31.12.2026" — dates, buses, guides, PAX, status ---------- */
// The sheet: blocks that start with a "TARIH" row; each date is a pair of columns:
//   sources (ELDAR-RIXSOS) | route (ANT-PAM-KAP)
//   "1 GRUP : 32+2 PAX BUS" | guide            <- a bus
//   route or "PAKETLI GRUP"  | "MİKAİL KOK"     <- its kok guide
//   "Toplam : 110+3 PAX"     | "STOP" / "240,000 TL" / "40 PAX YER VAR"
// Stored for the administrator only: state/00.00/season = {file, at, deps:[...]}
var SEASON=store.get('season',null),szFilter=store.get('szFilter','future'),szQ='';
const SZ_GRP=/^\s*(\d+)\s*GR[UI][PB]\w*\s*:?\s*(\d+)\s*(?:\+\s*(\d+))?\s*PAX\w*\s*(BUS|M[İI]N[İI]|MIDI|M[İI]D[İI])?/i;
const SZ_TOT=/^\s*TOPLAM\s*:?\s*(\d+)\s*(?:\+\s*(\d+))?\s*PAX/i;
const szDate=s=>{const m=String(s||'').match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:null};
const szKok=s=>String(s||'').replace(/\s+KOK$/i,'').trim();
const isSeason=rows=>{const n=rows.filter(r=>(r||[]).some(c=>/^\s*TAR[İI]H\s*$/i.test(String(c||'')))).length;const g=rows.filter(r=>(r||[]).some(c=>SZ_GRP.test(String(c||'')))).length;return n>=2&&g>=2};
function parseSeason(rows){const R=rows.map(r=>(r||[]).map(c=>String(c==null?'':c).replace(/\s+/g,' ').trim()));
  const starts=R.map((r,i)=>r.some(c=>/^TAR[İI]H$/i.test(c))?i:-1).filter(i=>i>=0);const deps=[];let prev=null;
  starts.forEach((st,bi)=>{const end=bi+1<starts.length?starts[bi+1]:R.length;const W=Math.max(...R.slice(st,end).map(r=>r.length));
    for(let c0=0;c0+1<W;c0+=2){const c1=c0+1;let date=szDate(R[st][c1]);if(!date)continue;
      // a wrong year typed by hand (02.10.2025 between dates of 2026): keep the season in order
      if(prev&&Date.parse(date)<Date.parse(prev)-60*864e5)date=(+date.slice(0,4)+1)+date.slice(4);prev=date;
      const d={date,src:(R[st+1]||[])[c0]||'',route:(R[st+1]||[])[c1]||'',groups:[],tags:[],total:null,status:''};let last=null,pend='';
      for(let i=st+2;i<end;i++){const a=(R[i]||[])[c0]||'',b=(R[i]||[])[c1]||'';if(!a&&!b)continue;
        const g=a.match(SZ_GRP);if(g){const gr={n:+g[1],pax:+g[2],plus:+(g[3]||0),type:(g[4]||'BUS').toUpperCase().replace('İ','I'),guide:'',kok:'',kind:''};
          if(pend){gr.guide=pend;gr.kok=szKok(b);pend='';gr.kokSet=true}else gr.guide=b;d.groups.push(gr);last=gr;continue}
        const t=a.match(SZ_TOT);if(t){d.total={pax:+t[1],plus:+(t[2]||0)};d.status=b;continue}
        if(!a&&b&&(!last||last.kokSet)){pend=b;continue}
        if(last&&!last.kokSet){last.kind=a;last.kok=szKok(b);last.kokSet=true;continue}
        if(a)d.tags.push(a);if(b)d.tags.push(b)}
      d.groups.forEach(g=>delete g.kokSet);
      if(!d.total)d.total={pax:d.groups.reduce((s,g)=>s+g.pax,0),plus:d.groups.reduce((s,g)=>s+g.plus,0)};
      if(d.groups.length||d.total.pax)deps.push(d)}});
  return deps.sort((a,b)=>a.date.localeCompare(b.date))}
// what the status cell says
function szStatus(s){s=String(s||'').trim();if(!s)return {k:'',t:''};if(/^STOP$/i.test(s))return {k:'stop',t:'STOP — мест нет'};
  const fr=s.match(/(\d+)\s*PAX\s*YER\s*VAR/i);if(fr)return {k:'free',t:`есть места: ${fr[1]}`,n:+fr[1]};
  const tl=s.match(/([\d.,]+)\s*TL/i);if(tl)return {k:'money',t:s.replace(/,/g,' ')};return {k:'',t:s}}
const szPax=d=>d.total.pax+d.total.plus;
const szMonth=iso=>['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'][+iso.slice(5,7)-1];
const szMonthN=iso=>['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][+iso.slice(5,7)-1]+' '+iso.slice(0,4);
function szStats(deps){const buses=deps.reduce((s,d)=>s+d.groups.length,0);const pax=deps.reduce((s,d)=>s+szPax(d),0);
  const G={},K={},S={},M={};
  const spell=(o,p)=>{o.v[p]=(o.v[p]||0)+1;o.n=Object.entries(o.v).sort((a,b)=>b[1]-a[1])[0][0]};
  deps.forEach(d=>{d.groups.forEach(g=>{if(g.guide){for(const p of g.guide.split(/\s*\+\s*/)){const k=gKey(p);if(!k)continue;G[k]=G[k]||{n:p,v:{},g:0,pax:0,last:''};spell(G[k],p);G[k].g++;G[k].pax+=g.pax+g.plus;G[k].last=d.date}}
      if(g.kok){const k=gKey(g.kok);K[k]=K[k]||{n:g.kok,v:{},g:0};spell(K[k],g.kok);K[k].g++}});
    String(d.src).split(/\s*-\s*/).filter(Boolean).forEach(x=>{const k=x.replace(/\s*\(.*\)/,'').trim().toUpperCase();if(k)S[k]=(S[k]||0)+1});
    const m=d.date.slice(0,7);M[m]=M[m]||{m,deps:0,buses:0,pax:0};M[m].deps++;M[m].buses+=d.groups.length;M[m].pax+=szPax(d)});
  return {deps:deps.length,buses,pax,avg:buses?pax/buses:0,G:Object.values(G).sort((a,b)=>b.g-a.g||b.pax-a.pax),K:Object.values(K).sort((a,b)=>b.g-a.g),S:Object.entries(S).sort((a,b)=>b[1]-a[1]),M:Object.values(M).sort((a,b)=>a.m.localeCompare(b.m))}}

async function loadSeason(){if(!SERVER||!isAdmin())return;try{const r=await api('GET','/api/state?d=00.00&kind=season');if(r.data&&r.data.deps){SEASON=r.data;store.set('season',SEASON)}renderSeason()}catch(e){}}
async function importSeason(file){try{const rows=await readRows(file);if(!isSeason(rows))throw new Error('не похоже на план сезона (нужны строки TARIH и «1 GRUP : 44 PAX BUS»)');
    const deps=parseSeason(rows);if(!deps.length)throw new Error('не нашёл ни одного выезда');
    SEASON={file:file.name,at:new Date().toISOString(),deps};store.set('season',SEASON);
    if(SERVER)await api('PUT','/api/state?d=00.00&kind=season',SEASON);
    toast(`План сезона загружен: ${deps.length} выездов`);renderSeason()}catch(e){toast('План сезона: '+e.message)}}

function renderSeason(){const el=$('#seasonBox');if(!el)return;
  if(!SEASON||!SEASON.deps||!SEASON.deps.length){el.innerHTML=`<div class="panel sz-empty"><h2>📅 План сезона</h2><p class="hint">Загрузите файл плана выездов (Excel или CSV, например «20.09.2026 - 31.12.2026») — здесь появятся даты, автобусы, гиды, загрузка по месяцам, и всё можно скачать обратно в Excel.</p><label class="btn primary">⬆ Загрузить план<input type="file" data-szfile accept=".xlsx,.xls,.xlsm,.csv" hidden></label></div>`;bindSeason(el);return}
  const all=SEASON.deps,today=isoToday();
  const next=all.find(d=>d.date>=today);
  const shown=all.filter(d=>szFilter==='all'||(szFilter==='future'?d.date>=today:d.date<today)).filter(d=>!szQ||JSON.stringify(d).toLocaleUpperCase('tr').includes(szQ.toLocaleUpperCase('tr')));
  const A=szStats(all),F=szStats(all.filter(d=>d.date>=today)),P=szStats(all.filter(d=>d.date<today));
  const noGuide=all.filter(d=>d.date>=today).reduce((s,d)=>s+d.groups.filter(g=>!g.guide).length,0);
  const free=all.filter(d=>d.date>=today).map(d=>({d,s:szStatus(d.status)})).filter(x=>x.s.k==='free');
  const maxM=Math.max(1,...A.M.map(m=>m.pax));
  const byMonth={};shown.forEach(d=>{(byMonth[d.date.slice(0,7)]=byMonth[d.date.slice(0,7)]||[]).push(d)});
  el.innerHTML=`<div class="sz-head"><div><h2>📅 План сезона</h2><span class="hint">${esc(SEASON.file||'')} · загружен ${new Date(SEASON.at).toLocaleString('ru',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} · ${isoDM(all[0].date)}–${isoDM(all[all.length-1].date)}</span></div>
      <span class="sp"></span><label class="btn">⬆ Обновить план<input type="file" data-szfile accept=".xlsx,.xls,.xlsm,.csv" hidden></label><button type="button" class="btn primary" data-szxls>⬇ Скачать Excel</button></div>
    <div class="sz-kpi">
      <div><small>Выездов за сезон</small><b>${A.deps}</b><span>прошло ${P.deps} · впереди ${F.deps}</span></div>
      <div><small>Туристов</small><b>${A.pax.toLocaleString('ru')}</b><span>прошло ${P.pax.toLocaleString('ru')} · впереди ${F.pax.toLocaleString('ru')}</span></div>
      <div><small>Автобусов</small><b>${A.buses}</b><span>в среднем ${Math.round(A.avg)} чел. в автобусе</span></div>
      <div class="${next?'sz-next':''}"><small>Ближайший выезд</small><b>${next?isoDM(next.date)+' · '+isoWd(next.date):'—'}</b><span>${next?`${next.groups.length} авт. · ${szPax(next)} чел.${next.date===today?' · <b>сегодня</b>':''}`:'сезон закончен'}</span></div>
      <div class="${noGuide?'sz-warn':''}"><small>Без гида (впереди)</small><b>${noGuide}</b><span>${noGuide?'автобусов ещё без гида':'все автобусы с гидами'}</span></div>
      <div class="${free.length?'sz-ok':''}"><small>Есть свободные места</small><b>${free.reduce((s,x)=>s+(x.s.n||0),0)}</b><span>${free.length?free.slice(0,3).map(x=>isoDM(x.d.date)).join(', ')+(free.length>3?' …':''):'везде STOP'}</span></div>
    </div>
    <div class="sz-grid">
      <section class="panel"><h3>Туристы по месяцам</h3><div class="sz-bars">${A.M.map(m=>`<div class="sz-bar"><span class="l">${szMonthN(m.m+'-01')}</span><span class="b"><i style="width:${Math.round(m.pax/maxM*100)}%"></i></span><span class="v"><b>${m.pax.toLocaleString('ru')}</b> чел · ${m.deps} выезд. · ${m.buses} авт.</span></div>`).join('')}</div></section>
      <section class="panel"><h3>Гиды за сезон</h3><div class="sz-rank">${A.G.slice(0,12).map((g,i)=>`<div><span class="hint">${i+1}.</span> <b>${esc(g.n)}</b><span class="sp"></span>${g.g} авт. · ${g.pax} чел.</div>`).join('')}</div>${A.G.length>12?`<details><summary class="hint">ещё ${A.G.length-12}</summary><div class="sz-rank">${A.G.slice(12).map((g,i)=>`<div><span class="hint">${i+13}.</span> ${esc(g.n)}<span class="sp"></span>${g.g} · ${g.pax}</div>`).join('')}</div></details>`:''}</section>
      <section class="panel"><h3>Откуда группы</h3><div class="sz-chips">${A.S.slice(0,16).map(([k,n])=>`<span class="chip">${esc(k)} <b>${n}</b></span>`).join('')}</div><h3 style="margin-top:12px">Кок-гиды</h3><div class="sz-chips">${A.K.slice(0,16).map(k=>`<span class="chip">${esc(k.n)} <b>${k.g}</b></span>`).join('')}</div></section>
    </div>
    <div class="sz-bar2"><div class="seg">${[['future','Впереди'],['past','Прошедшие'],['all','Весь сезон']].map(([k,l])=>`<button type="button" aria-pressed="${szFilter===k}" data-szf="${k}">${l}</button>`).join('')}</div>
      <input data-szq value="${esc(szQ)}" placeholder="Поиск: гид, отель, дата…" aria-label="Поиск"><span class="hint">${shown.length} выездов</span></div>
    ${Object.entries(byMonth).map(([m,L])=>`<h3 class="sz-mh">${szMonthN(m+'-01')} <span class="hint">${L.length} выездов · ${L.reduce((s,d)=>s+szPax(d),0)} чел.</span></h3><div class="sz-list">${L.map(d=>{const st=szStatus(d.status);
      return `<article class="sz-d${d.date===today?' today':''}${d.date<today?' past':''}"><header><div class="sz-date"><b>${d.date.slice(8,10)}</b><span>${szMonth(d.date).slice(0,3)} · ${isoWd(d.date)}</span></div>
        <div class="sz-src">${String(d.src).split(/\s*-\s*/).filter(Boolean).map(x=>`<span class="chip">${esc(x)}</span>`).join('')}<span class="hint">${esc(d.route)}</span></div>
        <div class="sz-tot"><b>${d.total.pax}${d.total.plus?'+'+d.total.plus:''}</b><small>PAX</small>${st.t?`<span class="sz-st ${st.k}">${esc(st.t)}</span>`:''}</div></header>
        <div class="sz-gs">${d.groups.map(g=>`<div class="sz-g${g.guide?'':' nog'}"><span class="num">${g.n}</span><span><b>${g.pax}${g.plus?'+'+g.plus:''}</b> ${esc(g.type==='BUS'?'🚌':'🚐')}</span><span class="gd">${g.guide?esc(g.guide):'<i>гид не назначен</i>'}</span><span class="hint">${g.kok?'кок: '+esc(g.kok):''}${g.kind&&!/^ANT-/.test(g.kind)?' · '+esc(g.kind):''}</span></div>`).join('')}${d.tags.length?`<div class="hint">${d.tags.map(esc).join(' · ')}</div>`:''}</div></article>`}).join('')}</div>`).join('')||'<p class="hint">Ничего не найдено.</p>'}`;
  bindSeason(el)}
function bindSeason(el){
  el.querySelectorAll('[data-szfile]').forEach(i=>i.onchange=()=>{if(i.files[0])importSeason(i.files[0]);i.value=''});
  el.querySelectorAll('[data-szf]').forEach(b=>b.onclick=()=>{szFilter=b.dataset.szf;store.set('szFilter',szFilter);renderSeason()});
  const q=el.querySelector('[data-szq]');if(q)q.oninput=()=>{szQ=q.value.trim();const p=q.selectionStart;renderSeason();const n=$('#seasonBox [data-szq]');if(n){n.focus();n.setSelectionRange(p,p)}};
  const x=el.querySelector('[data-szxls]');if(x)x.onclick=seasonXlsx}

// Excel for the director: every bus on its own row, plus days, months, guides and sources
function seasonXlsx(){if(typeof XLSX==='undefined')return toast('Библиотека Excel не загрузилась, обновите страницу');
  const deps=SEASON.deps,A=szStats(deps);const wb=XLSX.utils.book_new();
  const sheet=(name,rows,widths)=>{const ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=widths.map(w=>({wch:w}));ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows.length-1,c:rows[0].length-1}})};ws['!freeze']={xSplit:0,ySplit:1};XLSX.utils.book_append_sheet(wb,ws,name)};
  const dt=iso=>({t:'n',v:(Date.UTC(+iso.slice(0,4),+iso.slice(5,7)-1,+iso.slice(8,10))-Date.UTC(1899,11,30))/864e5,z:'dd.mm.yyyy'});
  sheet('Автобусы',[['Дата','День','Откуда (отели/партнёры)','Маршрут','Группа','PAX','Доп.','Всего','Транспорт','Гид','Кок-гид','Пакет / примечание','Статус дня'],
    ...deps.flatMap(d=>d.groups.map(g=>[dt(d.date),isoWd(d.date),d.src,d.route,g.n,g.pax,g.plus,g.pax+g.plus,g.type,g.guide||'— не назначен —',g.kok,/^ANT-/.test(g.kind)?'':g.kind,d.status]))],[11,5,26,14,7,6,6,7,9,24,20,18,16]);
  sheet('По дням',[['Дата','День','Откуда','Маршрут','Автобусов','PAX','Доп.','Всего','Статус','Без гида'],
    ...deps.map(d=>[dt(d.date),isoWd(d.date),d.src,d.route,d.groups.length,d.total.pax,d.total.plus,szPax(d),d.status,d.groups.filter(g=>!g.guide).length])],[11,5,26,14,10,7,6,7,18,9]);
  sheet('По месяцам',[['Месяц','Выездов','Автобусов','Туристов','Среднее в автобусе'],...A.M.map(m=>[szMonthN(m.m+'-01'),m.deps,m.buses,m.pax,m.buses?Math.round(m.pax/m.buses):0]),['ИТОГО',A.deps,A.buses,A.pax,Math.round(A.avg)]],[16,9,10,10,18]);
  sheet('Гиды',[['Гид','Автобусов','Туристов','Последний выезд'],...A.G.map(g=>[g.n,g.g,g.pax,dt(g.last)])],[26,10,10,16]);
  sheet('Кок-гиды',[['Кок-гид','Автобусов'],...A.K.map(k=>[k.n,k.g])],[26,10]);
  sheet('Откуда',[['Отель / партнёр','Выездов'],...A.S],[24,10]);
  XLSX.writeFile(wb,`Plan sezona ${isoDM(deps[0].date)}-${isoDM(deps[deps.length-1].date)}.xlsx`)}
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('.tab');if(b&&b.dataset.t==='season'){renderSeason();loadSeason()}});
