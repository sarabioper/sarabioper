/* ---------- the period report (administrator only): transfers, buses, excursion sales, hotel nights, income and expenses in one Excel ---------- */
// The server keeps full KAPAK days only for a short time, so every 40 days the administrator is reminded to download it.
// Who downloaded which period is kept on the server (/api/exportlog), so the reminder is the same on every device.
let EXLOG=null,RPLATER=false;
const RP_EVERY=40;
const rpD=iso=>iso?isoDM(iso)+'.'+iso.slice(0,4):'';
async function rpLoadLog(){if(!SERVER||!isAdmin())return;try{const r=await api('GET','/api/exportlog');EXLOG=r.data||{}}catch(e){}rpRemind();rpRender()}
function rpDefault(){const y=isoAdd(isoToday(),-1);const last=EXLOG&&EXLOG.last&&EXLOG.last.to;const from=last&&last<y?isoAdd(last,1):isoAdd(y,-44);return {from,to:y}}
function rpDue(){if(!isAdmin()||!EXLOG)return false;const l=EXLOG.last;if(!l||!l.at)return true;return (Date.now()-Date.parse(l.at))/864e5>=RP_EVERY}
function rpRemind(){const el=$('#rpBanner');if(!el)return;const due=rpDue()&&!RPLATER;el.hidden=!due;if(!due)return;const P=rpDefault();
  el.innerHTML=`<span><b>📥 Пора скачать итог</b> за ${rpD(P.from)} – ${rpD(P.to)}. ${EXLOG.last?`Последний раз итог скачан ${rpD(EXLOG.last.at.slice(0,10))}.`:'Итог ещё ни разу не скачивался.'} Старые дни сервер удаляет — в итоге останутся доходы, расходы, продажи, трансферы, автобусы и ночи в отелях.</span>
    <span class="rp-b"><button type="button" class="btn sm primary" id="rpGo">⬇ Скачать итог</button><button type="button" class="btn sm" id="rpLater">Позже</button></span>`;
  $('#rpGo').onclick=()=>rpExport(P.from,P.to);$('#rpLater').onclick=()=>{RPLATER=true;el.hidden=true}}
function rpRender(){const el=$('#rpBox');if(!el||!isAdmin())return;const P=rpDefault();const L=((EXLOG&&EXLOG.list)||[]).slice().reverse();
  el.innerHTML=`<div class="rp-card${rpDue()?' due':''}"><h3 class="st-h">📥 Итог за период</h3>
    <p class="hint">Один Excel со всем, что было за период: доходы и расходы (из выгрузок бухгалтера), продажи экскурсий, трансферы по дням, автобусы, сколько гостей прожили в каждом отеле и сколько уезжали в тур. Скачивайте его каждые ${RP_EVERY}–45 дней: старые дни сервер удаляет.</p>
    <div class="st-acf"><label>С <input type="date" id="rpFrom" value="${P.from}"></label><label>По <input type="date" id="rpTo" value="${P.to}"></label><button type="button" class="btn sm primary" id="rpXls">⬇ Скачать итог</button></div>
    ${L.length?`<details><summary class="hint">Уже скачано: ${L.length}</summary>${L.slice(0,12).map(x=>`<div class="hint">${rpD(x.at.slice(0,10))} — период ${rpD(x.from)} – ${rpD(x.to)}</div>`).join('')}</details>`:'<p class="hint st-w">Итог ещё ни разу не скачивался.</p>'}</div>`;
  $('#rpXls').onclick=()=>{const f=$('#rpFrom').value,t=$('#rpTo').value;if(!f||!t||f>t){toast('Проверьте даты');return}rpExport(f,t)}}
async function rpExport(from,to){if(!isAdmin())return;if(typeof XLSX==='undefined'){toast('Excel ещё не загрузился, попробуйте через минуту');return}
  toast('Собираю итог…');
  try{await Promise.all([acLoaded?null:loadAcct(),pullSales(),pullTours(true),stLoadArch(isoAdd(from,-35),isoAdd(to,35))].map(p=>Promise.resolve(p).catch(()=>{})))}catch(e){}
  const inP=d=>d&&d>=from&&d<=to;const per=`${rpD(from)} – ${rpD(to)}`;
  // transfers by day
  const days=stAllDays().filter(d=>inP(d.iso)).sort((a,b)=>a.iso.localeCompare(b.iso));
  const h2hOf=d=>{const k=Object.keys(DAYS).find(k=>dayIso(k)===d.iso);return k?(DAYS[k].h2hList||[]):(d.h2h||[])};
  const paxOf=L=>L.reduce((s,g)=>s+(+g.pax||(g.p||[]).length),0);
  const TR=days.map(d=>{const H=h2hOf(d);return [rpD(d.iso),d.arr.length,paxOf(d.arr),d.dep.length,paxOf(d.dep),H.length,H.reduce((s,x)=>s+(+x.pax||0),0)]});
  const trSum=i=>TR.reduce((s,r)=>s+r[i],0);
  // buses
  const B=stBuses().filter(t=>t.days[0].d<=to&&t.days[t.days.length-1].d>=from);
  const salesP=Object.values(SALES||{}).filter(s=>s&&inP(s.date));
  const busSales=t=>salesP.filter(s=>s.tid===t.id).reduce((a,s)=>a+(+s.sum||0),0);
  const N=t=>stNights(t);const BU=B.map(t=>{const G=(t.gx||[]).filter(x=>!x.gone);const n=N(t);const pam=Object.keys(n).filter(k=>n[k]==='PAM'),kap=Object.keys(n).filter(k=>n[k]==='KAP');
    return [t.bus||'',t.name||'',rpD(t.days[0].d),rpD(t.days[t.days.length-1].d),t.guide||'',t.kok||'',G.length||+t.pax||0,pam.length?stTourHotel(t,'PAM',pam[0])||'не указан':'',kap.length?stTourHotel(t,'KAP',kap[0])||'не указан':'',Math.round(busSales(t))]});
  // hotels
  const P=stPeople();const A=stAcct(P,from,to);
  // income and expenses (the accountant's exports), without KDV
  const tx=(ACCT&&ACCT.tx||[]).filter(t=>inP(t[0])).sort((a,b)=>a[0].localeCompare(b[0]));
  const inc=tx.filter(t=>t[1]>0).reduce((s,t)=>s+t[1],0),exp=tx.filter(t=>t[1]<0).reduce((s,t)=>s-t[1],0);
  const kin=tx.filter(t=>t[1]>0).reduce((s,t)=>s+Math.abs(t[2]||0),0),kout=tx.filter(t=>t[1]<0).reduce((s,t)=>s+Math.abs(t[2]||0),0);
  const months=[...new Set(tx.map(t=>t[0].slice(0,7)))].sort();
  const salesSum=salesP.reduce((s,x)=>s+(+x.sum||0),0);const sum=k=>A.H.reduce((s,h)=>s+h[k],0);
  const S1=[['Итог за период',per],['Скачан',rpD(isoToday())],[],
    ['ДОХОДЫ И РАСХОДЫ (из выгрузок бухгалтера, без KDV)'],['Доходы, ₺',Math.round(inc)],['Расходы, ₺',Math.round(exp)],['Прибыль, ₺',Math.round(inc-exp)],['KDV начислено, ₺',Math.round(kin)],['KDV к зачёту, ₺',Math.round(kout)],['Операций',tx.length],
    tx.length?[]:['','Выгрузок бухгалтера за этот период нет — загрузите их во вкладке «Бухгалтерия»'],[],
    ['ПРОДАЖИ ЭКСКУРСИЙ'],['Продаж',salesP.length],['Сумма, $',Math.round(salesSum)],[],
    ['ТРАНСФЕРЫ'],['Дней с KAPAK',days.length],['Прилёты: групп / человек',trSum(1),trSum(2)],['Вылеты: групп / человек',trSum(3),trSum(4)],['Межотельные: переездов / человек',trSum(5),trSum(6)],[],
    ['АВТОБУСЫ'],['Экскурсионных автобусов',B.length],['Гостей в них',BU.reduce((s,r)=>s+r[6],0)],[],
    ['ОТЕЛИ (прожитые ночи)'],['Прожили в отелях Анталии, чел.',sum('g')],['Ночей прожили',sum('inH')],['Уезжали в тур, чел.',sum('left')],['Ночей в туре',sum('away')],
    ...(days.length?[]:[[],['⚠ За этот период на сервере нет дней KAPAK: трансферы и отели посчитаны не будут.']])];
  const S2=[['Месяц','Доходы, ₺','Расходы, ₺','Прибыль, ₺'],...months.map(m=>{const T=tx.filter(t=>t[0].startsWith(m));const i=T.filter(t=>t[1]>0).reduce((s,t)=>s+t[1],0),e=T.filter(t=>t[1]<0).reduce((s,t)=>s-t[1],0);return [m.slice(5)+'.'+m.slice(0,4),Math.round(i),Math.round(e),Math.round(i-e)]}),
    [],['Дата','Доход, ₺','Расход, ₺','KDV, ₺','Контрагент','Описание'],...tx.map(t=>[rpD(t[0]),t[1]>0?Math.round(t[1]*100)/100:'',t[1]<0?Math.round(-t[1]*100)/100:'',t[2]?Math.round(Math.abs(t[2])*100)/100:'',t[4]||'',t[3]||''])];
  const busOf=id=>{const t=B.find(x=>x.id===id)||TOURS[id]||(STARCH&&STARCH.tours[id]);return t?t.bus||'':''};
  const S3=[['Дата','Автобус','Гость','Что','Кол-во','Цена, $','Сумма, $','Продал','Кто привёл'],...salesP.sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(x=>[rpD(x.date),busOf(x.tid),x.n||'',x.name||x.item||'',+x.qty||1,+x.price||0,+x.sum||0,x.by||'',x.ref||''])];
  const S4=[['Дата','Прилёты: групп','Прилёты: чел.','Вылеты: групп','Вылеты: чел.','Межотельные: переездов','Межотельные: чел.'],...TR,['Всего',...[1,2,3,4,5,6].map(trSum)]];
  const S5=[['Автобус','Программа','Начало','Конец','Гид','Кок гид','Гостей','Отель Памуккале','Отель Каппадокия','Продажи, $'],...BU];
  const S6=[['Отель','Прожили, чел.','Ночей прожили','Уезжали в тур, чел.','Ночей в туре'],...A.H.map(h=>[h.h,h.g,h.inH,h.left,h.away]),['Всего',sum('g'),sum('inH'),sum('left'),sum('away')],[],['Отель тура','Прожили, чел.','Ночей'],...A.T.map(t=>[t.h,t.G.size,t.n])];
  const S7=[['Отель','Гость','Заезд','Выезд','Ночей в отеле','Ночей в туре','Даты тура','Автобус','Примечание']];
  A.H.forEach(h=>h.L.forEach(r=>S7.push([h.h,r.p.n,rpD(r.p.a),r.p.d?rpD(r.p.d):'',r.inH.length,r.away.length,r.away.length?stRanges(r.away):'',r.p.t?r.p.t.bus||'':'',[r.p.home?'не поехал в тур':'',r.p.fix?'дата в списке группы исправлена по группе':'',r.p.noA?'заезд до начала данных':'',r.p.d?'':'дата выезда неизвестна'].filter(Boolean).join('; ')])));
  const wb=XLSX.utils.book_new();const ws=(a,w)=>{const x=XLSX.utils.aoa_to_sheet(a);x['!cols']=w.map(n=>({wch:n}));return x};
  XLSX.utils.book_append_sheet(wb,ws(S1,[44,16,16]),'Сводка');
  XLSX.utils.book_append_sheet(wb,ws(S2,[12,14,14,14,30,40]),'Доходы и расходы');
  XLSX.utils.book_append_sheet(wb,ws(S3,[12,12,28,28,8,10,10,18,18]),'Продажи экскурсий');
  XLSX.utils.book_append_sheet(wb,ws(S4,[12,14,14,14,14,16,16]),'Трансферы по дням');
  XLSX.utils.book_append_sheet(wb,ws(S5,[14,22,12,12,24,24,10,24,24,12]),'Автобусы');
  XLSX.utils.book_append_sheet(wb,ws(S6,[34,14,14,16,14]),'Отели');
  XLSX.utils.book_append_sheet(wb,ws(S7,[30,28,12,12,12,12,18,12,28]),'Гости в отелях');
  XLSX.writeFile(wb,`itog_${from}_${to}.xlsx`);
  try{await api('PUT','/api/exportlog',{from,to});EXLOG=null;RPLATER=false;await rpLoadLog()}catch(e){}
  toast('Итог скачан: '+per)}
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('.tab');if(!b)return;if(b.dataset.t==='acct')rpRender();if(isAdmin()&&!EXLOG)rpLoadLog();else rpRemind()});
// check once after login and then every 6 hours
setTimeout(()=>{if(isAdmin())rpLoadLog()},4000);setInterval(()=>{if(isAdmin())rpLoadLog()},6*3600e3);
