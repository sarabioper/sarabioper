/* ---------- hotels: how many guests sleep in which hotel tonight, who is on a tour and where ---------- */
// Guests and dates come from what is already loaded:
//   KAPAK days — arrival to a hotel (date, hotel, names) and departure from a hotel;
//   excursion buses — the group list (arrival / departure dates per guest) and the program days.
// A bus program like "2 nights in the hotel → 1 night Pamukkale → 2 nights Cappadocia → back to the same hotel"
// gives the tour nights: on those nights the guest is counted in the tour hotel, otherwise in his own hotel.
// The office can correct the tour nights and the tour hotels of every bus, and mark a guest who did not go.
// t.stay = {n:{'2026-10-23':'PAM','2026-10-24':'KAP',...}, h:{PAM:'hotel name',KAP:'hotel name'}}
// TM[tid+'|sthome|'+i] = {home:1}  — this guest stays in his hotel during the tour
let STD=null,STOPEN=new Set(),STQ='',STHOPEN=new Set(),STA=null;
// the long archive from the server (days that are no longer in DAYS, programs that moved to the archive): loaded on demand
let STARCH=null,STARCHQ=null;
const stTM=k=>TM[k]||(STARCH&&STARCH.tm[k])||null;
async function stLoadArch(from,to){if(!SERVER||!isOps())return false;if(STARCH&&STARCH.from<=from&&STARCH.to>=to)return false;
  const f=STARCH&&STARCH.from<from?STARCH.from:from,t=STARCH&&STARCH.to>to?STARCH.to:to;
  if(STARCHQ&&STARCHQ.f<=f&&STARCHQ.t>=t)return STARCHQ.p;
  const p=api('GET',`/api/arch?from=${f}&to=${t}`).then(r=>{STARCH={from:f,to:t,days:r.days||[],tours:r.tours||{},tm:r.tm||{}};STARCHQ=null;return true}).catch(()=>{STARCHQ=null;return false});
  STARCHQ={f,t,p};return p}
// all KAPAK days: the loaded ones plus the archived ones that are no longer loaded
function stAllDays(){const out=[],have=new Set();Object.keys(DAYS||{}).forEach(k=>{const iso=dayIso(k);if(!/^\d{4}-/.test(iso))return;have.add(iso);out.push({iso,arr:DAYS[k].arr||[],dep:DAYS[k].dep||[]})});
  if(STARCH)STARCH.days.forEach(d=>{if(!d||have.has(d.iso))return;const g=x=>({h:x.h,fl:x.fl,pax:x.pax,p:(x.n||[]).map(n=>['',n])});out.push({iso:d.iso,arr:(d.arr||[]).map(g),dep:(d.dep||[]).map(g),h2h:d.h2h||[]})});
  return out}
const ST_PL={PAM:'Памуккале',KAP:'Каппадокия'};
const stKey=n=>fdKey(n);
function stBuses(){const seen=new Map();[...tours(),...(STARCH?Object.values(STARCH.tours).filter(t=>t&&t.days&&!TOURS[t.id]):[])].forEach(t=>{if(!t.days||!t.days.length)return;const k=tourKey(t);const o=seen.get(k);if(!o||(t.gx||[]).length>(o.gx||[]).length)seen.set(k,t)});
  return [...seen.values()].sort((a,b)=>a.days[0].d.localeCompare(b.days[0].d)||String(a.bus).localeCompare(String(b.bus),'tr',{numeric:true}))}
// tour nights guessed from the program: the first early start after day 1 (or Pamukkale in the stops) leaves the hotel,
// the day of the drive "ANTALYA'YA" brings the bus back; the first night away is Pamukkale, the rest Cappadocia
function stGuess(t){const D=t.days,out={};if(D.length<3)return out;
  const txt=d=>(d.s||[]).map(s=>upTR(s.n)).join(' | ');
  const early=d=>{const s=(d.s||[])[0];const m=s&&String(s.t||'').match(/^(\d\d?):(\d\d)/);return !!m&&(+m[1]*60+ +m[2])<=7*60};
  let r=D.findIndex((d,i)=>i>0&&/ANTALYA.?YA\b|ANTALYAYA|ANTALYA.{0,3}HAREKET|ANTALYA.{0,3}D[ÖO]N[ÜU]Ş/.test(txt(d)));
  const s=D.findIndex((d,i)=>i>0&&(r<0||i<r)&&(/PAMUKK?ALE|HİERAPOL|HIERAPOL|DERV[İI]Ş/.test(txt(d))||early(d)));
  if(s<0)return out;
  if(r<0){if(!/KAPADOK|KAPPADOK|CAPPADOC/.test(upTR(t.name)+' '+D.map(txt).join(' ')))return out;r=Math.min(D.length-1,s+3)}
  for(let i=s;i<r;i++)out[D[i].d]=i===s?'PAM':'KAP';return out}
// the hotel plan printed under the group list: "22.11-24.11-PORT", "24.11-25.11-COLOSSAE", "25.11-27.11-FLORIA", "27.11-29.11-PORT"
// the first hotel is the guest's own hotel; the other ones are the tour nights (the first one Pamukkale, the next ones Cappadocia)
const stClean=h=>String(h||'').split(/\s{2,}|[А-Яа-яЁё]|\s\d+\s*\$/)[0].replace(/[\s\-–]+$/,'').replace(/\s+\d{1,2}$/,'').trim();
const STPLAN=new WeakMap();
function stPlan(t){const key=(t.ghotels||[]).join('|')+'#'+((t.days[0]||{}).d||'');const c=STPLAN.get(t);if(c&&c.key===key)return c.v;
  const y=((t.days[0]||{}).d||isoToday()).slice(0,4);const iso=(d,m)=>`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const L=(t.ghotels||[]).map(x=>{const m=String(x).match(/^(\d{1,2})\.(\d{1,2})\s*[–-]\s*(\d{1,2})\.(\d{1,2})\s*[-–]?\s*(.+)$/);if(!m)return null;return {a:iso(m[1],m[2]),b:iso(m[3],m[4]),h:stClean(m[5])}}).filter(x=>x&&x.h&&x.a<x.b).sort((x,y)=>x.a.localeCompare(y.a));
  let v=null;if(L.length>=2){const base=L[0].h,same=h=>fdN(h)===fdN(base);const n={},hn={},at={};let k=0;
    L.forEach(e=>{if(same(e.h))return;const pl=k===0?'PAM':'KAP';k++;for(let d=e.a;d<e.b;d=isoAdd(d,1)){n[d]=pl;at[d]=e.h}if(!hn[pl])hn[pl]=e.h});v={base,n,h:hn,at,L}}
  STPLAN.set(t,{key,v});return v}
const stNights=t=>t.stay&&t.stay.n?t.stay.n:(stPlan(t)?stPlan(t).n:stGuess(t));
// the tour hotel: typed by the office, or the "18.10–19.10 HOTEL" line of the group list
function stTourHotel(t,pl,iso){const h=t.stay&&t.stay.h&&t.stay.h[pl];if(h)return h;const P=stPlan(t);if(P)return P.at[iso]||P.h[pl]||'';try{const g=stClean(fdHotelOn(t,iso));if(g)return g}catch(e){}return ''}
function stHome(t,i){return !!((stTM(t.id+'|sthome|'+i)||{}).home)}
// every guest once: {n,k,a,d,base,t,i,flags}
function stPeople(){
  const A=new Map(),Dp=new Map();let first='';
  stAllDays().forEach(d=>{const iso=d.iso;if(!first||iso<first)first=iso;
    (d.arr||[]).forEach(g=>(g.p||[]).forEach(p=>{if(!p||!p[1])return;const key=stKey(p[1]);if(!A.has(key))A.set(key,[]);A.get(key).push({iso,h:g.h||'',n:p[1]})}));
    (d.dep||[]).forEach(g=>(g.p||[]).forEach(p=>{if(!p||!p[1])return;const key=stKey(p[1]);if(!Dp.has(key))Dp.set(key,[]);Dp.get(key).push({iso,h:g.h||'',n:p[1]})}))});
  const near=(L,iso,after)=>{if(!L||!L.length)return null;let best=null,bd=1e9;L.forEach(x=>{const dd=(Date.parse(x.iso)-Date.parse(iso||x.iso))/864e5;if(after&&iso&&dd<0)return;const v=Math.abs(dd);if(v<bd){bd=v;best=x}});return bd<=21?best:null};
  const out=[],usedA=new Set(),usedD=new Set();
  // a date that is far from the rest of the group (a typo in the list: 1999, or a departure on the arrival day) takes the group's date
  const mode=L=>{const c={};L.filter(Boolean).forEach(v=>c[v]=(c[v]||0)+1);return Object.keys(c).sort((a,b)=>c[b]-c[a])[0]||''};
  const far=(a,b)=>!a||!b||Math.abs(Date.parse(a)-Date.parse(b))>10*864e5;
  stBuses().forEach(t=>{const X=(t.gx||[]).filter(x=>!x.gone);const mA=mode(X.map(x=>x.ad)),mD=mode(X.map(x=>x.rd));const plan=stPlan(t);
    (t.gx||[]).forEach((x,i)=>{if(x.gone)return;const key=stKey(x.n);
    let xa=x.ad,xd=x.rd,fix=false;if(mA&&xa&&far(xa,mA)){xa=mA;fix=true}if(mD&&xd&&(far(xd,mD)||xd<=(xa||mA))){xd=mD;fix=true}
    const a=near(A.get(key),xa||t.days[0].d),dp=near(Dp.get(key),xd||t.days[t.days.length-1].d);if(a)usedA.add(a);if(dp)usedD.add(dp);
    const ad=xa||(a&&a.iso)||'',rd=xd||(dp&&dp.iso)||'';
    out.push({n:x.n,k:key,fam:x.fam,ph:x.phone||'',a:ad||t.days[0].d,d:rd,noA:!ad,fix,base:(a&&a.h)||(dp&&dp.h)||(plan&&plan.base)||'',t,i,home:stHome(t,i)})})});
  A.forEach((L,key)=>L.forEach(a=>{if(usedA.has(a))return;usedA.add(a);
    const dp=(Dp.get(key)||[]).filter(x=>!usedD.has(x)&&x.iso>=a.iso).sort((x,y)=>x.iso.localeCompare(y.iso))[0];if(dp)usedD.add(dp);
    out.push({n:a.n,k:key,a:a.iso,d:dp?dp.iso:'',base:a.h||(dp&&dp.h)||'',t:null})}));
  // left before the first loaded KAPAK day: in the hotel from that day on
  Dp.forEach((L,key)=>L.forEach(dp=>{if(usedD.has(dp))return;out.push({n:dp.n,k:key,a:first,noA:true,d:dp.iso,base:dp.h,t:null})}));
  return out}
// where the guest sleeps the night that starts on iso: null = not with us
function stWhere(p,iso){if(iso<p.a)return null;if(p.d?iso>=p.d:iso>isoAdd(p.a,30))return null;
  if(p.t&&!p.home){const pl=stNights(p.t)[iso];if(pl)return {pl,h:stTourHotel(p.t,pl,iso)||'отель не указан · '+(p.t.bus||'автобус')}}
  return {pl:'',h:p.base||'— отель не известен —'}}
function stDay(P,iso){const prev=isoAdd(iso,-1);const H=new Map();const hot=h=>{if(!H.has(h.h))H.set(h.h,{h:h.h,pl:h.pl,night:[],arr:[],dep:[],out:[],back:[]});return H.get(h.h)};
  P.forEach(p=>{const w=stWhere(p,iso),w0=stWhere(p,prev);
    if(w)hot(w).night.push(p);
    if(w&&p.a===iso&&!w0)hot(w).arr.push(p);
    if(!w&&w0&&p.d===iso)hot(w0).dep.push(p);
    if(w&&w0&&!w0.pl&&w.pl)hot(w0).out.push(p);
    if(w&&w0&&w0.pl&&!w.pl)hot(w).back.push(p)});
  return [...H.values()].sort((a,b)=>(a.pl?1:0)-(b.pl?1:0)||b.night.length-a.night.length||a.h.localeCompare(b.h,'tr'))}
const stNames=L=>{const fams=new Map();L.forEach(p=>{const f=p.fam||p.k;if(!fams.has(f))fams.set(f,[]);fams.get(f).push(p)});
  return [...fams.values()].map(F=>`<div class="st-fam">${F.map(p=>`<span>${esc(p.n)}${p.t?` <span class="hint">🚌 ${esc(p.t.bus||'')}</span>`:''}${p.home?' <span class="chip">не поехал в тур</span>':''}${!p.d?' <span class="chip st-w">выезд ?</span>':''}</span>`).join('')}</div>`).join('')};
function stBusState(t){const N=stNights(t);const nights=Object.keys(N).sort();if(!nights.length)return null;
  const s0=t.days.find(d=>d.d===nights[0]),back=isoAdd(nights[nights.length-1],1),r=t.days.find(d=>d.d===back);
  const st0=s0&&s0.s[0],stR=r&&[...r.s].reverse().find(s=>s.k==='hotel');
  const ms=x=>{const m=stTM(t.id+'|'+x.id)||{};return {a:m.ga!=null?m.ga:m.a,d:m.gd!=null?m.gd:m.d}};const m0=st0?ms(st0):{},mR=stR?ms(stR):{};
  return {nights,N,out:nights[0],back,st0,stR,left:m0.a!=null||m0.d!=null,leftT:m0.d!=null?m0.d:m0.a,ret:mR.a!=null,retT:mR.a}}
function stBusHtml(t,P,iso){const S=stBusState(t);const G=P.filter(p=>p.t===t);const home=G.filter(p=>p.home);const N=stNights(t);const today=isoToday();
  const pax=G.length?G.length-home.length:+t.pax||0;const w=N[iso];
  const where=w?`${ST_PL[w]}: <b>${esc(stTourHotel(t,w,iso)||'отель не указан')}</b>`:S&&iso<S.out?`ещё в своих отелях · выезд ${isoDM(S.out)}`:S&&iso>=S.back?`вернулись ${isoDM(S.back)}`:'в своих отелях';
  const mk=(ok,tm,lbl,d,act)=>ok?`<span class="chip st-ok">✓ ${lbl}${tm!=null?' '+fmt(tm):''}</span>`:d<=today?`<button type="button" class="btn sm" data-stmark="${esc(t.id)}|${act}">${lbl}?</button>`:'';
  const open=STOPEN.has(t.id);
  return `<article class="st-bus${w?' away':''}"><div class="st-bh"><b>🚌 ${esc(t.bus||'Автобус')}</b><span class="hint">${esc(t.name||'')} ${isoDM(t.days[0].d)}–${isoDM(t.days[t.days.length-1].d)}</span><span class="chip">👥 ${pax}</span>${home.length?`<span class="chip">остались в отеле: ${home.length}</span>`:''}</div>
    <div class="st-where">${where}</div>
    ${S&&!S.st0&&!S.stR?'<div class="hint">Отметки «выехали / вернулись» появятся, когда у автобуса будет программа с остановками.</div>':S?`<div class="st-marks">${mk(S.left,S.leftT,'Выехали из отелей',S.out,'out')}${mk(S.ret,S.retT,'Вернулись в отели',S.back,'back')}</div>`:'<div class="hint">В программе нет ночёвок вне Анталии. Если они есть — отметьте ночи ниже.</div>'}
    <details class="st-ed"${open?' open':''} data-stopen="${esc(t.id)}"><summary>Ночи и отели тура${t.stay&&t.stay.n?'':stPlan(t)?' <span class="hint">(по отелям из списка группы)</span>':' <span class="hint">(определены по программе)</span>'}</summary>
      <div class="st-nights">${t.days.slice(0,-1).map(d=>`<label><span>${isoDM(d.d)}</span><select data-stn="${esc(t.id)}|${d.d}"><option value="">свой отель</option><option value="PAM"${N[d.d]==='PAM'?' selected':''}>Памуккале</option><option value="KAP"${N[d.d]==='KAP'?' selected':''}>Каппадокия</option></select></label>`).join('')}</div>
      <div class="st-hn"><label>Отель в Памуккале <input data-sth="${esc(t.id)}|PAM" value="${esc((t.stay&&t.stay.h&&t.stay.h.PAM)||'')}" placeholder="${esc(stTourHotel(t,'PAM',Object.keys(N).find(k=>N[k]==='PAM')||'')||'название')}"></label><label>Отель в Каппадокии <input data-sth="${esc(t.id)}|KAP" value="${esc((t.stay&&t.stay.h&&t.stay.h.KAP)||'')}" placeholder="${esc(stTourHotel(t,'KAP',Object.keys(N).find(k=>N[k]==='KAP')||'')||'название')}"></label></div>
      ${G.length?`<div class="st-gl"><div class="hint">Снимите галочку, если гость не поехал в тур и остаётся в своём отеле:</div>${G.map(p=>`<label class="st-g"><input type="checkbox" data-sthome="${esc(t.id)}|${p.i}"${p.home?'':' checked'}> ${esc(p.n)} <span class="hint">${esc(p.base||'отель ?')}</span></label>`).join('')}</div>`:'<div class="hint">Списка гостей у автобуса нет — загрузите список группы во вкладке «Экскурсии».</div>'}
    </details></article>`}
function stCalHtml(P,iso,n){const dates=[...Array(n)].map((_,i)=>isoAdd(iso,i));const rows=new Map();
  dates.forEach((d,j)=>P.forEach(p=>{const w=stWhere(p,d);if(!w)return;const k=(w.pl?ST_PL[w.pl]+': ':'')+w.h;if(!rows.has(k))rows.set(k,{k,pl:w.pl,c:Array(n).fill(0)});rows.get(k).c[j]++}));
  const PO={'':0,PAM:1,KAP:2};const R=[...rows.values()].sort((a,b)=>PO[a.pl]-PO[b.pl]||a.k.localeCompare(b.k,'tr'));const tot=dates.map((_,j)=>R.reduce((s,r)=>s+r.c[j],0));
  return {dates,R,tot,html:`<div class="tbl-wrap"><table class="st-cal"><thead><tr><th>Отель</th>${dates.map(d=>`<th class="n">${isoDM(d)}</th>`).join('')}</tr></thead><tbody>
    ${R.map(r=>`<tr${r.pl?' class="st-tour"':''}><td>${esc(r.k)}</td>${r.c.map(c=>`<td class="n">${c||''}</td>`).join('')}</tr>`).join('')}
    <tr class="st-tot"><td>Всего гостей</td>${tot.map(c=>`<td class="n">${c}</td>`).join('')}</tr></tbody></table></div>`}}
// the guest's hotel on a day: the night that starts that day; "until" = the day he moves on (tour, back, flight)
function stNext(p,iso){const w=stWhere(p,iso);const key=x=>x?x.pl+'|'+x.h:'';for(let i=1;i<=40;i++){const d=isoAdd(iso,i);const x=stWhere(p,d);if(key(x)!==key(w))return {d,to:x}}return null}
const stLbl=w=>w?(w.pl?ST_PL[w.pl]+': ':'')+w.h:'';
let stCache={t:0,P:null};
function stPeopleFast(){if(!stCache.P||Date.now()-stCache.t>3000)stCache={t:Date.now(),P:stPeople()};return stCache.P}
// for the guest search card: where this person sleeps today
function stNowHtml(k){try{const iso=isoToday();const L=stPeopleFast().filter(p=>p.k===k);if(!L.length)return '';
  return L.map(p=>{const w=stWhere(p,iso),w0=stWhere(p,isoAdd(iso,-1));if(!w&&!w0)return '';const nx=w&&stNext(p,iso);
    const mv=w0&&w&&stLbl(w0)!==stLbl(w)?` <span class="hint">(сегодня переезд из ${esc(stLbl(w0))})</span>`:!w&&w0?' <span class="hint">сегодня выезжает</span>':'';
    return `<div class="fd-r">🏨 <b>${w?'Сейчас: '+esc(stLbl(w)):'Был: '+esc(stLbl(w0))}</b>${mv}${nx?` · до ${isoDM(nx.d)}${nx.to?' → '+esc(stLbl(nx.to)):' (вылет)'}`:''}</div>`}).join('')}catch(e){return ''}}
function stWhoHtml(P,iso){const q=fdN(STQ).split(' ').filter(Boolean),dg=STQ.replace(/\D/g,'');const qOn=q.length||dg.length>=4;
  const L=P.map(p=>({p,w:stWhere(p,iso)})).filter(r=>r.w).filter(r=>{if(!qOn)return true;if(dg.length>=4&&String(r.p.ph||'').replace(/\D/g,'').includes(dg))return true;
    const W=(r.p.k+' '+fdN(stLbl(r.w))+' '+fdN(r.p.t?r.p.t.bus:'')).split(' ');return q.length&&q.every(t=>W.some(w=>w.startsWith(t)))});
  // one block per hotel: Antalya hotels first (biggest first), then the tour hotels
  const G=new Map();L.forEach(r=>{const k=stLbl(r.w);if(!G.has(k))G.set(k,{k,pl:r.w.pl,L:[]});G.get(k).L.push(r)});
  const PO={'':0,PAM:1,KAP:2};const H=[...G.values()].sort((a,b)=>PO[a.pl]-PO[b.pl]||b.L.length-a.L.length||a.k.localeCompare(b.k,'tr'));
  const row=({p})=>{const nx=stNext(p,iso);const ph=p.ph;return `<tr><td><b>${esc(p.n)}</b>${p.home?' <span class="chip">не поехал в тур</span>':''}</td><td>${nx?isoDM(nx.d)+(nx.to?' → '+esc(stLbl(nx.to)):' вылет'):'?'}</td><td>${p.t?'🚌 '+esc(p.t.bus||''):''}</td><td>${ph?`<a class="tel" href="tel:${esc(ph.replace(/[^\d+]/g,''))}">${esc(ph)}</a>`:''}</td></tr>`};
  const fams=R=>{const F=new Map();R.forEach(r=>{const f=r.p.fam||r.p.k;if(!F.has(f))F.set(f,[]);F.get(f).push(r)});return [...F.values()].sort((a,b)=>a[0].p.n.localeCompare(b[0].p.n,'tr'))};
  return `<input class="gx-q" id="stQ" value="${esc(STQ)}" placeholder="Фамилия, телефон, отель или автобус" aria-label="Поиск гостя по отелям">
    <div class="hint">${L.length} гостей в ${H.length} отелях${qOn?' (по поиску)':''}</div>
    <div class="st-hotels">${H.map(h=>{const open=qOn||STHOPEN.has(h.k);return `<details class="st-hot${h.pl?' tour':''}" data-sthopen="${esc(h.k)}"${open?' open':''}><summary><b>🏨 ${esc(h.k)}</b><span class="chip">👥 ${h.L.length}</span></summary>
      <div class="tbl-wrap"><table class="st-who"><thead><tr><th>Гость</th><th>До</th><th>Автобус</th><th>Телефон</th></tr></thead><tbody>
      ${fams(h.L).map(F=>F.map(row).join('').replace('<tr>','<tr class="st-f1">')).join('')}</tbody></table></div></details>`}).join('')}</div>`}
// tour trips: who left his hotel on which day and came back on which day, per hotel
function stTrips(P){const T=new Map();
  P.forEach(p=>{if(!p.t||p.home)return;const N=stNights(p.t);const ns=Object.keys(N).filter(d=>stWhere(p,d)).sort();if(!ns.length)return;
    const out=ns[0],back=isoAdd(ns[ns.length-1],1);const k=out+'|'+back;if(!T.has(k))T.set(k,{out,back,H:new Map(),n:0});const tr=T.get(k);tr.n++;
    const h=p.base||'— отель не известен —';if(!tr.H.has(h))tr.H.set(h,{h,L:[],B:new Set()});const x=tr.H.get(h);x.L.push(p);x.B.add(p.t)});
  return [...T.values()].sort((a,b)=>a.out.localeCompare(b.out)||a.back.localeCompare(b.back))}
function stTripsHtml(P,iso){const today=isoToday();const all=stTrips(P);const L=all.filter(t=>t.back>=isoAdd(iso,-10)&&t.out<=isoAdd(iso,10));
  if(!L.length)return '<p class="hint">В эти дни (±10 дней) выездов в тур нет.</p>';
  const st=t=>{const S=stBusState(t);return S||{}};
  return `<div class="st-hotels">${L.map(tr=>{const buses=[...new Set([...tr.H.values()].flatMap(x=>[...x.B]))];
    const left=buses.every(b=>st(b).left),ret=buses.every(b=>st(b).ret);const nowIn=tr.out<=iso&&iso<tr.back;
    const status=ret?'<span class="chip st-ok">✓ вернулись</span>':tr.back<=today&&left?'<span class="chip st-w">возврат не отмечен</span>':left?'<span class="chip">в туре</span>':tr.out<=today?'<span class="chip st-w">выезд не отмечен</span>':'<span class="chip">ожидается</span>';
    const H=[...tr.H.values()].sort((a,b)=>b.L.length-a.L.length||a.h.localeCompare(b.h,'tr'));
    return `<details class="st-hot tour" data-sthopen="trip|${tr.out}|${tr.back}"${nowIn||STHOPEN.has('trip|'+tr.out+'|'+tr.back)?' open':''}><summary><b>Уехали ${isoDM(tr.out)} → вернулись ${isoDM(tr.back)}</b><span class="chip">👥 ${tr.n}</span>${status}<span class="hint">🚌 ${buses.map(b=>esc(b.bus||'')).join(', ')}</span></summary>
      <div class="tbl-wrap"><table class="st-who"><thead><tr><th>Из отеля</th><th class="n">Уехали ${isoDM(tr.out)}</th><th class="n">Вернулись ${isoDM(tr.back)}</th><th>Автобус</th></tr></thead><tbody>
      ${H.map(x=>{const bs=[...x.B];const r=bs.every(b=>st(b).ret);return `<tr><td><details class="st-nm"><summary>${esc(x.h)}</summary>${stNames(x.L)}</details></td><td class="n"><b>${x.L.length}</b></td><td class="n">${r?'✓ '+x.L.length:tr.back>today?'<span class="hint">'+x.L.length+' ожид.</span>':'<span class="st-w">'+x.L.length+' · не отмечено</span>'}</td><td>${bs.map(b=>esc(b.bus||'')).join(', ')}</td></tr>`}).join('')}
      <tr class="st-tot"><td>Всего</td><td class="n">${tr.n}</td><td class="n">${ret?'✓ ':''}${tr.n}</td><td></td></tr></tbody></table></div></details>`}).join('')}</div>`}
// accounting with the hotels for a period: per guest the nights booked in his hotel, the nights he really slept there
// and the nights he was away on the tour; per tour hotel the nights slept there
function stRanges(D){const R=[];D.forEach(d=>{const l=R[R.length-1];if(l&&isoAdd(l[1],1)===d)l[1]=d;else R.push([d,d])});return R.map(r=>r[0]===r[1]?isoDM(r[0]):isoDM(r[0])+'–'+isoDM(r[1])).join(', ')}
// only nights already lived count (up to last night); a guest without a known departure is counted only until then
function stAcct(P,from,to){const B=new Map(),T=new Map();const last=isoAdd(isoToday(),-1);const end=to<last?to:last;const days=[];for(let d=from;d<=end&&days.length<400;d=isoAdd(d,1))days.push(d);
  P.forEach(p=>{let r=null;days.forEach(d=>{const w=stWhere(p,d);if(!w)return;
      if(!r)r={p,hotel:p.base||'— отель не известен —',inH:[],away:[]};
      if(w.pl){r.away.push(d);const k=ST_PL[w.pl]+': '+w.h;if(!T.has(k))T.set(k,{h:k,pl:w.pl,G:new Set(),n:0});const x=T.get(k);x.n++;x.G.add(p)}else r.inH.push(d)});
    if(!r)return;if(!B.has(r.hotel))B.set(r.hotel,{h:r.hotel,L:[]});B.get(r.hotel).L.push(r)});
  const H=[...B.values()].map(h=>Object.assign(h,{g:h.L.filter(r=>r.inH.length).length,inH:h.L.reduce((s,r)=>s+r.inH.length,0),left:h.L.filter(r=>r.away.length).length,away:h.L.reduce((s,r)=>s+r.away.length,0)}))
    .filter(h=>h.g||h.left).sort((a,b)=>b.inH-a.inH||a.h.localeCompare(b.h,'tr'));
  return {H,T:[...T.values()].sort((a,b)=>a.pl.localeCompare(b.pl)||a.h.localeCompare(b.h,'tr')),days,end}}
function stAcctHtml(P){const A=stAcct(P,STA.from,STA.to);const sum=k=>A.H.reduce((s,h)=>s+h[k],0);
  return `<div class="st-acf"><label>С <input type="date" id="staFrom" value="${STA.from}"></label><label>По <input type="date" id="staTo" value="${STA.to}"></label>
    <button type="button" class="btn sm" id="staMonth">Весь месяц</button><button type="button" class="btn sm primary" id="staXls">⬇ Сверка в Excel</button></div>
    <div class="hint">Считаются только прожитые ночи: с ${isoDM(STA.from)} по ночь на ${isoDM(A.end)}${A.end<STA.to?' (будущие ночи не считаются)':''}. Ночь на 05.11 — это с 05.11 на 06.11. Ночи в Памуккале и Каппадокии в отель не входят.</div>
    ${A.H.length?`<div class="tbl-wrap"><table class="st-who st-acct"><thead><tr><th>Отель</th><th class="n">Прожили, чел.</th><th class="n">Ночей прожили</th><th class="n">Уезжали в тур, чел.</th><th class="n">Ночей в туре</th></tr></thead><tbody>
    ${A.H.map(h=>`<tr><td><details class="st-nm"><summary><b>${esc(h.h)}</b></summary><table class="st-in"><tr><th>Гость</th><th>Заезд</th><th>Выезд</th><th class="n">Ночей в отеле</th><th class="n">В туре</th><th>Даты тура</th></tr>
      ${h.L.slice().sort((a,b)=>a.p.n.localeCompare(b.p.n,'tr')).map(r=>`<tr><td>${esc(r.p.n)}${r.p.t?` <span class="hint">🚌 ${esc(r.p.t.bus||'')}</span>`:''}${r.p.home?' <span class="chip">не поехал</span>':''}</td><td>${isoDM(r.p.a)}${r.p.noA?' ?':''}</td><td>${r.p.d?isoDM(r.p.d):'?'}</td><td class="n">${r.inH.length}</td><td class="n">${r.away.length||''}</td><td>${r.away.length?stRanges(r.away):''}</td></tr>`).join('')}</table></details></td>
      <td class="n">${h.g}</td><td class="n"><b>${h.inH}</b></td><td class="n">${h.left||''}</td><td class="n">${h.away||''}</td></tr>`).join('')}
    <tr class="st-tot"><td>Всего по отелям Анталии</td><td class="n">${sum('g')}</td><td class="n">${sum('inH')}</td><td class="n">${sum('left')}</td><td class="n">${sum('away')}</td></tr></tbody></table></div>`:'<p class="hint">За этот период прожитых ночей нет.</p>'}
    ${A.T.length?`<h4 class="st-h4">Отели тура</h4><div class="tbl-wrap"><table class="st-who"><thead><tr><th>Отель</th><th class="n">Прожили, чел.</th><th class="n">Ночей</th></tr></thead><tbody>
      ${A.T.map(t=>`<tr><td>${esc(t.h)}</td><td class="n">${t.G.size}</td><td class="n">${t.n}</td></tr>`).join('')}</tbody></table></div>`:''}`}
function stAcctXls(P){const A=stAcct(P,STA.from,STA.to);const per=`${isoDM(STA.from)}.${STA.from.slice(0,4)}–${isoDM(A.end)}.${A.end.slice(0,4)}`;
  const s1=[['Отель','Прожили, чел.','Ночей прожили','Уезжали в тур, чел.','Ночей в туре'],...A.H.map(h=>[h.h,h.g,h.inH,h.left,h.away]),
    ['Всего',...['g','inH','left','away'].map(k=>A.H.reduce((s,h)=>s+h[k],0))],[],['Прожитые ночи '+per],[],['Отель тура','Прожили, чел.','Ночей'],...A.T.map(t=>[t.h,t.G.size,t.n])];
  const s2=[['Отель','Гость','Заезд','Выезд','Ночей в отеле','Ночей в туре','Даты тура','Автобус','Примечание']];
  A.H.forEach(h=>h.L.forEach(r=>s2.push([h.h,r.p.n,isoDM(r.p.a)+'.'+r.p.a.slice(0,4),r.p.d?isoDM(r.p.d)+'.'+r.p.d.slice(0,4):'',r.inH.length,r.away.length,r.away.length?stRanges(r.away):'',r.p.t?r.p.t.bus||'':'',[r.p.home?'не поехал в тур':'',r.p.fix?'дата в списке группы исправлена по группе':'',r.p.noA?'заезд до начала данных':'',r.p.d?'':'дата выезда неизвестна'].filter(Boolean).join('; ')])));
  const s3=[['Дата ночи',...A.H.map(h=>h.h)],...A.days.map(d=>[isoDM(d)+'.'+d.slice(0,4),...A.H.map(h=>h.L.filter(r=>r.inH.includes(d)).length)])];
  const wb=XLSX.utils.book_new();const ws=a=>{const w=XLSX.utils.aoa_to_sheet(a);w['!cols']=a[0].map((_,i)=>({wch:i===0||i===1?28:14}));return w};
  XLSX.utils.book_append_sheet(wb,ws(s1),'Итог');XLSX.utils.book_append_sheet(wb,ws(s2),'Гости');XLSX.utils.book_append_sheet(wb,ws(s3),'По ночам');XLSX.writeFile(wb,`sverka_hotels_${STA.from}_${A.end}.xlsx`)}
// the archive around the reconciliation period (guests who arrived before it or leave after it)
function stArchFor(){if(!STA)return;Promise.resolve(stLoadArch(isoAdd(STA.from,-35),isoAdd(STA.to,35))).then(ch=>{if(ch&&!$('#v-stays').hidden)renderStays()})}
function renderStays(){const el=$('#staysBox');if(!el)return;const iso=STD||isoToday();const P=stPeople();if(!STA){const m=iso.slice(0,8);STA={from:m+'01',to:isoAdd(isoAdd(m+'28',4).slice(0,8)+'01',-1)}}stArchFor();const H=stDay(P,iso);
  const sum=k=>H.reduce((s,h)=>s+h[k].length,0);const inBase=H.filter(h=>!h.pl).reduce((s,h)=>s+h.night.length,0);
  const pam=H.filter(h=>h.pl==='PAM').reduce((s,h)=>s+h.night.length,0),kap=H.filter(h=>h.pl==='KAP').reduce((s,h)=>s+h.night.length,0);
  const unk=P.filter(p=>stWhere(p,iso)&&!p.d),noH=(H.find(h=>/не известен/.test(h.h))||{night:[]}).night;
  const buses=stBuses().filter(t=>t.days[0].d<=iso&&t.days[t.days.length-1].d>=iso);
  const cal=stCalHtml(P,iso,14);
  el.innerHTML=`<div class="tbar"><span class="tdate"><button type="button" class="btn sm" id="stPrev" aria-label="Предыдущий день">‹</button><b>${isoDM(iso)}.${iso.slice(0,4)}</b><button type="button" class="btn sm" id="stNext" aria-label="Следующий день">›</button><button type="button" class="btn sm" id="stToday">Сегодня</button></span><span class="sp"></span><button type="button" class="btn sm" id="stXls">⬇ Календарь в Excel</button></div>
    <div class="st-sum">
      <div class="st-k"><span>Ночуют в отелях Анталии</span><b>${inBase}</b></div>
      <div class="st-k tour"><span>В туре: Памуккале</span><b>${pam}</b></div>
      <div class="st-k tour"><span>В туре: Каппадокия</span><b>${kap}</b></div>
      <div class="st-k"><span>Заезд / вылет сегодня</span><b>${sum('arr')} / ${sum('dep')}</b></div>
      <div class="st-k"><span>Уезжают в тур / возвращаются</span><b>${sum('out')} / ${sum('back')}</b></div>
    </div>
    ${unk.length||noH.length?`<p class="hint st-w">⚠ ${noH.length?`${noH.length} гостей без отеля (нет в KAPAK). `:''}${unk.length?`${unk.length} гостей без даты выезда — считаются в отеле до 30 дней от заезда.`:''}</p>`:''}
    <h3 class="st-h">Кто где живёт · ночь на ${isoDM(iso)}</h3><div id="stWho">${stWhoHtml(P,iso)}</div>
    <h3 class="st-h">Автобусы в туре</h3>
    ${buses.length?`<div class="st-buses">${buses.map(t=>stBusHtml(t,P,iso)).join('')}</div>`:'<p class="hint">В этот день автобусов в туре нет.</p>'}
    <h3 class="st-h">Выезды в тур и возвраты</h3><div class="hint">Сколько гостей уехали из каждого отеля и в какой день вернулись. Показаны туры ±10 дней от выбранной даты.</div>${stTripsHtml(P,iso)}
    <h3 class="st-h">По отелям в ночь на ${isoDM(iso)}</h3>
    ${H.length?`<div class="tbl-wrap"><table class="st-tbl"><thead><tr><th>Отель</th><th class="n">Ночуют</th><th class="n">Заезд</th><th class="n">Вылет</th><th class="n">В тур</th><th class="n">Из тура</th></tr></thead><tbody>
      ${H.map((h,j)=>`<tr class="${h.pl?'st-tour':''}" data-strow="${j}"><td><button type="button" class="st-hb">${h.pl?ST_PL[h.pl]+': ':''}${esc(h.h)} ▾</button></td><td class="n"><b>${h.night.length}</b></td><td class="n">${h.arr.length||''}</td><td class="n">${h.dep.length||''}</td><td class="n">${h.out.length||''}</td><td class="n">${h.back.length||''}</td></tr>
        <tr class="st-det" data-stdet="${j}" hidden><td colspan="6">${[['Ночуют',h.night],['Заезд',h.arr],['Вылет (выезд из отеля)',h.dep],['Уезжают в тур',h.out],['Вернулись из тура',h.back]].filter(x=>x[1].length).map(x=>`<div class="st-dl"><b>${x[0]}: ${x[1].length}</b>${stNames(x[1])}</div>`).join('')}</td></tr>`).join('')}
    </tbody></table></div>`:'<p class="hint">На эту дату гостей нет. Гости берутся из загруженных KAPAK и списков групп экскурсий.</p>'}
    <h3 class="st-h">Сверка с отелями (бухгалтерия)</h3><div id="stAcct">${stAcctHtml(P)}</div>
    <h3 class="st-h">Календарь на 14 ночей</h3>${cal.html}
    <p class="hint">Отель гостя — из KAPAK (прилёт / вылет) или из строк «22.11-24.11-PORT» под списком группы. Ночи в Памуккале и Каппадокии — из этих строк, а если их нет — из программы автобуса; их можно поправить в карточке автобуса. Межотельные переезды без фамилий не учитываются.</p>`;
  const bindQ=()=>{document.querySelectorAll('[data-sthopen]').forEach(d=>d.addEventListener('toggle',()=>{if(STQ.trim())return;d.open?STHOPEN.add(d.dataset.sthopen):STHOPEN.delete(d.dataset.sthopen)}));const q=$('#stQ');if(q)q.oninput=()=>{STQ=q.value;const pos=q.selectionStart;$('#stWho').innerHTML=stWhoHtml(P,iso);bindQ();const n=$('#stQ');n.focus();try{n.setSelectionRange(pos,pos)}catch(e){}}};bindQ();
  $('#stPrev').onclick=()=>{STD=isoAdd(iso,-1);renderStays()};$('#stNext').onclick=()=>{STD=isoAdd(iso,1);renderStays()};$('#stToday').onclick=()=>{STD=null;renderStays()};
  const bindA=()=>{const f=$('#staFrom'),t=$('#staTo');const go=()=>{if(f.value&&t.value&&f.value<=t.value){STA={from:f.value,to:t.value};$('#stAcct').innerHTML=stAcctHtml(P);bindA();stArchFor()}};f.onchange=go;t.onchange=go;
    $('#staMonth').onclick=()=>{const m=(f.value||iso).slice(0,8);STA={from:m+'01',to:isoAdd(isoAdd(m+'28',4).slice(0,8)+'01',-1)};$('#stAcct').innerHTML=stAcctHtml(P);bindA();stArchFor()};
    $('#staXls').onclick=()=>{try{stAcctXls(P)}catch(e){toast('Не получилось сохранить Excel')}}};bindA();
  $('#stXls').onclick=()=>{try{const C=stCalHtml(P,iso,31);const aoa=[['Отель',...C.dates.map(isoDM)],...C.R.map(r=>[r.k,...r.c]),['Всего',...C.tot]];
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(aoa),'Ночи');XLSX.writeFile(wb,`hotels_${iso}.xlsx`)}catch(e){toast('Не получилось сохранить Excel')}};
  el.querySelectorAll('[data-strow]').forEach(r=>r.querySelector('.st-hb').onclick=()=>{const d=el.querySelector(`[data-stdet="${r.dataset.strow}"]`);d.hidden=!d.hidden});
  el.querySelectorAll('[data-stopen]').forEach(d=>d.addEventListener('toggle',()=>{d.open?STOPEN.add(d.dataset.stopen):STOPEN.delete(d.dataset.stopen)}));
  const upd=(tid,f)=>{const t=JSON.parse(JSON.stringify(TOURS[tid]));const N=stNights(t);t.stay=Object.assign({h:{}},t.stay||{});t.stay.n=Object.assign({},N);f(t.stay);saveTour(tid,t);renderStays()};
  el.querySelectorAll('[data-stn]').forEach(s=>s.onchange=()=>{const [tid,d]=s.dataset.stn.split('|');upd(tid,S=>{if(s.value)S.n[d]=s.value;else delete S.n[d]})});
  el.querySelectorAll('[data-sth]').forEach(i=>i.onchange=()=>{const [tid,pl]=i.dataset.sth.split('|');upd(tid,S=>{S.h=Object.assign({},S.h);const v=i.value.trim();if(v)S.h[pl]=v;else delete S.h[pl]})});
  el.querySelectorAll('[data-sthome]').forEach(c=>c.onchange=()=>{const [tid,i]=c.dataset.sthome.split('|');saveTM(tid+'|sthome|'+i,c.checked?null:{home:1});renderStays()});
  el.querySelectorAll('[data-stmark]').forEach(b=>b.onclick=()=>{const [tid,act]=b.dataset.stmark.split('|');const t=TOURS[tid];const S=stBusState(t);const s=act==='out'?S.st0:S.stR;if(!s)return;
    const k=tid+'|'+s.id;const m=Object.assign({},TM[k]||{});const now=nowMinutes();if(act==='out'){if(m.a==null)m.a=now;m.d=now}else m.a=now;saveTM(k,m);renderStays()})}
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('.tab');if(b&&b.dataset.t==='stays'){renderStays();Promise.resolve(pullTours(true)).then(()=>{if(!$('#v-stays').hidden)renderStays()}).catch(()=>{})}});
