/* ---------- excursions: multi-day bus programs, stops, lunches and shops ---------- */
// TOURS[id] = {id,bus,name,pax,hotel,guide,kok,plate,driver,dphone,days:[{d:'2026-10-22',s:[{id,t,n,k,m}]}]}
// TOURS['~places'] = {places:{"COLESSAI":{cap:120}}}   (restaurant capacities)
// TM['tid|sid'] = {a:minutes arrived, d:minutes left, s:'shop sale'}
let TOURS=store.get('tours',{}),TM=store.get('tourmarks',{});
let tDate=null,tEdit=null,tLastSave=0;
const TK={start:['🚌','Выезд'],sight:['📍','Объект'],shop:['🛍','Магазин'],lunch:['🍽','Обед'],break:['☕','Остановка'],hamam:['🧖','Хамам'],hotel:['🏨','В отель'],transfer:['✈️','Трансфер']};
const isoToday=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const isoAdd=(iso,n)=>{const [y,m,d]=iso.split('-').map(Number);const x=new Date(y,m-1,d+n);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
const isoDM=iso=>iso?iso.slice(8,10)+'.'+iso.slice(5,7):'';
const isoWd=iso=>{const [y,m,d]=iso.split('-').map(Number);return (LANG==='tr'?['Paz','Pzt','Sal','Çar','Per','Cum','Cmt']:['Вс','Пн','Вт','Ср','Чт','Пт','Сб'])[new Date(y,m-1,d).getDay()]};
const rid=()=>Math.random().toString(36).slice(2,8);
const tours=()=>Object.values(TOURS).filter(t=>t&&t.id&&t.days).sort((a,b)=>String(a.bus).localeCompare(String(b.bus),'tr',{numeric:true}));
const upTR=s=>String(s||'').toLocaleUpperCase('tr');

function stopKind(n,m){const u=upTR(n);
  if(/YEME[ĞG]|RESTORAN|RESTAURANT|LUNCH|ОБЕД/.test(u))return 'lunch';
  if(/TRANSFER/.test(u))return 'transfer';
  if(/OTELE\b|OTEL(E)? G[İI]R[İI]Ş|OTELE D[ÖO]N[ÜU]Ş/.test(u))return 'hotel';
  if(/[ÇC]IKIŞ|ÇIKIS|HAREKET/.test(u))return 'start';
  if(/HAMAM/.test(u))return 'hamam';
  if(/MOLA|PETROL|CAFE|KAFE|\d+\s*MIN/.test(u))return 'break';
  if(m||/V[İI]OLA|PONTO|D[İI]ON[İI]S|MODAL|DERV[İI]Ş|SAYAN|ONEX|KURUYEM|SERAM|BAZAR|ÇITIR|DEVEL[İI]|HALI|ALTIN|DER[İI]|JEWEL|LEATHER|GOLD|TEKST|ŞARAP|WINE/.test(u))return 'shop';
  return 'sight'}
// "ÖĞLE YEMEĞİ COLESSAI" -> "COLESSAI"; the place key used for restaurant load
// one key per real place, so "COLLESAI" and "COLESSAI", "DİONİS" and "DIONIS" meet in the same restaurant/shop
const placeKey=s=>placeOf(s).replace(/[İI]/g,'I').replace(/Ş/g,'S').replace(/Ğ/g,'G').replace(/Ü/g,'U').replace(/Ö/g,'O').replace(/Ç/g,'C').replace(/[^A-Z0-9 ]/g,' ').replace(/(.)\1+/g,'$1').replace(/\s+/g,' ').trim();
const STAY={lunch:60,shop:45,sight:40,break:15,hamam:90};
const isStay=k=>k in STAY;
const placeCfg=key=>((TOURS['~places']||{}).places||{})[key]||{};
const stayOf=(key,k)=>+placeCfg(key).stay||STAY[k]||30;
function setPlaceCfg(key,patch){const P=Object.assign({places:{}},TOURS['~places']);P.id='~places';P.places=Object.assign({},P.places);const c=Object.assign({},P.places[key],patch);Object.keys(c).forEach(k=>{if(!c[k])delete c[k]});if(Object.keys(c).length)P.places[key]=c;else delete P.places[key];saveTour('~places',P)}
function placeOf(s){const u=upTR(s.n).replace(/\s+\d+\s*MIN.*$/,'');if(s.k==='lunch'){const r=u.replace(/ÖĞLE(N)?\s*YEME[ĞG][İI]|AKŞAM\s*YEME[ĞG][İI]|YEME[ĞG][İI]|RESTORAN(I)?/g,'').trim();return r||u.trim()}return u.trim()}

/* ---- server sync ---- */
let tSaveQ={},tSaveT=null,mSaveQ={},mSaveT=null;
function tPut(kind,q){if(!SERVER)return;api('PUT','/api/state?d=00.00&kind='+kind,q).catch(()=>toast('Нет связи с сервером, изменения сохранены только здесь'))}
function saveTour(id,obj){if(obj)TOURS[id]=obj;else delete TOURS[id];store.set('tours',TOURS);tLastSave=Date.now();tSaveQ[id]=obj||null;clearTimeout(tSaveT);tSaveT=setTimeout(()=>{const q=tSaveQ;tSaveQ={};tPut('tours',q)},400)}
function saveTM(key,v){if(v)TM[key]=v;else delete TM[key];store.set('tourmarks',TM);tLastSave=Date.now();mSaveQ[key]=v||null;clearTimeout(mSaveT);mSaveT=setTimeout(()=>{const q=mSaveQ;mSaveQ={};tPut('tourmarks',q)},300)}
async function pullTours(force){if(!SERVER)return;if(!force&&($('#v-tours').hidden||Date.now()-tLastSave<8000))return;
  try{const [a,b]=await Promise.all([api('GET','/api/state?d=00.00&kind=tours'),api('GET','/api/state?d=00.00&kind=tourmarks')]);
    const s1=JSON.stringify(TOURS),s2=JSON.stringify(TM);TOURS=a.data||{};TM=b.data||{};
    if(JSON.stringify(TOURS)!==s1||JSON.stringify(TM)!==s2||force){store.set('tours',TOURS);store.set('tourmarks',TM);if(!tEdit&&!(document.activeElement&&document.activeElement.closest&&document.activeElement.closest('#tourList')))renderTours()}}catch(e){}}
setInterval(()=>pullTours(),20000);

/* ---- day view ---- */
const dayOfTour=(t,iso)=>{const i=t.days.findIndex(d=>d.d===iso);return i<0?null:{i,day:t.days[i]}};
function stopState(t,s){const m=TM[t.id+'|'+s.id]||{};return m}
function tourNow(t,day){const st=day.s;let last=-1;st.forEach((s,i)=>{if(stopState(t,s).a!=null)last=i});
  if(last<0)return {txt:'Ещё не выехали',cls:''};
  const s=st[last],m=stopState(t,s),stay=s.k!=='start'&&s.k!=='hotel'&&s.k!=='transfer';
  if(stay&&m.d==null)return {txt:`Сейчас: ${s.n} · с ${fmt(m.a)}`,cls:'here'};
  if(last===st.length-1)return {txt:'День закончен',cls:'done'};
  const nx=st[last+1];return {txt:`Едут → ${nx.n}${nx.t?' (план '+nx.t+')':''}`,cls:'go'}}
function placeLoad(iso){
  const P={};const caps=(TOURS['~places']||{}).places||{};
  tours().forEach(t=>{const x=dayOfTour(t,iso);if(!x)return;x.day.s.forEach(s=>{if(s.k!=='lunch'&&s.k!=='shop')return;const key=placeKey(s);
    (P[key]=P[key]||{key,name:placeOf(s),k:s.k,rows:[]}).rows.push({t,s,min:s.t?toMin(s.t):(s.m?toMin(s.m):null),pax:+t.pax||0})})});
  return Object.values(P).map(p=>{p.rows.sort((a,b)=>(a.min??9999)-(b.min??9999));p.pax=p.rows.reduce((a,r)=>a+r.pax,0);p.cap=+placeCfg(p.key).cap||0;
    const win=p.k==='lunch'?60:30;let peak=0,clash=0;
    p.rows.forEach(r=>{if(r.min==null)return;const same=p.rows.filter(o=>o.min!=null&&Math.abs(o.min-r.min)<win);const sum=same.reduce((a,o)=>a+o.pax,0);if(sum>peak)peak=sum;if(same.length>1)clash=Math.max(clash,same.length)});
    p.peak=peak;p.clash=clash;p.noTime=p.rows.filter(r=>r.min==null).length;
    p.warn=p.cap&&peak>p.cap?`перегруз: ${peak} чел. на ${p.cap} мест`:p.k==='shop'&&clash>1?`${clash} автобуса в одно время`:'';return p})
    .sort((a,b)=>(a.k===b.k?0:a.k==='lunch'?-1:1)||a.key.localeCompare(b.key,'tr'))}

/* ---- live coordination between buses on the same places ---- */
function busPos(t,day){const st=day.s;let lastA=-1;st.forEach((s,i)=>{if(stopState(t,s).a!=null)lastA=i});
  const cur=lastA>=0?st[lastA]:null,cm=cur?stopState(t,cur):{};
  const here=cur&&isStay(cur.k)&&cm.d==null?lastA:-1;
  const moving=lastA>=0&&here<0&&lastA<st.length-1;
  return {lastA,here,moving,next:lastA+1<st.length?lastA+1:-1,since:moving?(cm.d??cm.a):null}}
function liveBoard(iso){const P={},now=nowMinutes(),ev=[];
  const get=(s)=>{const key=placeKey(s);return P[key]=P[key]||{key,name:placeOf(s),k:s.k,here:[],coming:[],later:[],done:[]}};
  tours().forEach(t=>{const x=dayOfTour(t,iso);if(!x)return;const st=x.day.s,ps=busPos(t,x.day);const pax=+t.pax||0;
    st.forEach((s,i)=>{const m=stopState(t,s);
      if(m.a!=null)ev.push({t,s,at:m.a,what:s.k==='start'?'выехал':'прибыл в'});if(m.d!=null)ev.push({t,s,at:m.d,what:'уехал из'});
      if(!isStay(s.k))return;const p=get(s);
      if(i===ps.here)p.here.push({t,pax,since:m.a,until:m.a+stayOf(p.key,s.k)});
      else if(m.d!=null||m.a!=null&&i<ps.lastA)p.done.push({t,pax,a:m.a,d:m.d});
      else if(ps.moving&&i===ps.next)p.coming.push({t,pax,since:ps.since});
      else if(i>ps.lastA)p.later.push({t,pax,plan:s.t||s.m||''})})});
  ev.sort((a,b)=>b.at-a.at);return {P,ev}}
function busyFor(LB,t,s){const p=LB.P[placeKey(s)];if(!p)return null;const now=nowMinutes();
  const here=p.here.filter(r=>r.t.id!==t.id),coming=p.coming.filter(r=>r.t.id!==t.id);
  const until=Math.max(0,...here.map(r=>Math.max(r.until,now+10)),...coming.map(r=>Math.max(now,r.since+20)+stayOf(p.key,p.k)));
  const pax=[...here,...coming].reduce((a,r)=>a+r.pax,0);const cap=+placeCfg(p.key).cap||0;
  const busy=here.length+coming.length>0&&!(cap&&pax+(+t.pax||0)<=cap);
  return {p,here,coming,until,pax,cap,busy}}
const busNm=t=>t.bus||(t.guide||'?').split(' ')[0];
function coordHint(LB,t,x){if(tDate!==isoToday())return '';const st=x.day.s,ps=busPos(t,x.day),now=nowMinutes();
  const out=[];const who=(arr,f)=>arr.map(r=>`<b>${esc(busNm(r.t))}</b> (${r.pax})${f(r)}`).join(', ');
  // where I am now: who is heading here after me
  if(ps.here>=0){const p=LB.P[placeKey(st[ps.here])];const c=p?p.coming.filter(r=>r.t.id!==t.id):[];if(c.length)out.push(`<div class="ch info">🟡 Сюда за вами едут: ${who(c,r=>r.since!=null?' · выехал '+fmt(r.since):'')}</div>`)}
  const ni=ps.here>=0?ps.here+1:Math.max(ps.next,0);const nx=st[ni];
  if(!nx||!isStay(nx.k))return out.join('');
  const b=busyFor(LB,t,nx);
  if(!b||!b.busy){out.push(`<div class="ch ok">🟢 Следующая точка <b>${esc(nx.n)}</b> свободна${b&&b.cap?` · занято ${b.pax} из ${b.cap} мест`:''}</div>`);return out.join('')}
  const wait=Math.max(0,b.until-now);
  let h=`<div class="ch warn">🔴 В <b>${esc(nx.n)}</b> ${b.here.length?'сейчас '+who(b.here,r=>' с '+fmt(r.since)):''}${b.here.length&&b.coming.length?'; ':''}${b.coming.length?'едут '+who(b.coming,()=>''):''}${b.cap?` · ${b.pax} из ${b.cap} мест`:''}. Освободится ≈ <b>${fmt(b.until)}</b>.`;
  if(ps.here>=0&&wait>5)h+=`<br>⏳ Можно задержаться здесь ещё ~${wait} мин.`;
  // free stops later in the day that could go first
  const alt=st.map((s,i)=>({s,i})).filter(o=>o.i>ni&&isStay(o.s.k)&&o.s.k!=='lunch'&&stopState(t,o.s).a==null&&!(busyFor(LB,t,o.s)||{}).busy).slice(0,2);
  if(alt.length)h+=`<div class="ch-alt">${alt.map(o=>`<button type="button" class="btn sm" data-tswap="${esc(t.id)}|${x.i}|${o.i}|${ni}">↪ Сначала ${esc(o.s.n)} — свободно</button>`).join('')}</div>`;
  out.push(h+'</div>');return out.join('')}
function renderLive(LB){const el=$('#tourLive');if(!el)return;
  if(tDate!==isoToday()){el.innerHTML='';return}
  const act=Object.values(LB.P).filter(p=>p.here.length||p.coming.length).sort((a,b)=>b.here.length-a.here.length||b.coming.length-a.coming.length);
  const now=nowMinutes();
  el.innerHTML=`<h3>🧭 Где сейчас автобусы <small class="hint">обновляется само каждые 20 сек</small></h3>${act.length?`<div class="tplaces">${act.map(p=>`<div class="tpl ${p.here.length>1||p.here.length&&p.coming.length?'warn':''}"><div class="tpl-h"><span>${TK[p.k][0]} <b>${esc(p.name)}</b></span><span class="num">${p.here.reduce((a,r)=>a+r.pax,0)} чел.</span></div>
    <div class="tpl-r">${p.here.map(r=>`<span class="chip lv-here">🔴 ${esc(busNm(r.t))} с ${fmt(r.since)} · ${r.until<now?'дольше плана на '+(now-r.until)+' мин':'до ≈'+fmt(r.until)}</span>`).join('')}${p.coming.map(r=>`<span class="chip lv-come">🟡 ${esc(busNm(r.t))} едет${r.since!=null?' с '+fmt(r.since):''}</span>`).join('')}</div>
    ${p.later.length?`<div class="hint">потом ещё: ${p.later.map(r=>esc(busNm(r.t))).join(', ')}</div>`:''}${p.done.length?`<div class="hint">уже были: ${p.done.map(r=>esc(busNm(r.t))).join(', ')}</div>`:''}</div>`).join('')}</div>`:'<p class="hint">Пока никто не отметился на точках. Как только гид нажмёт «📍 Прибыли» или «🚌 Уехали», здесь увидят все.</p>'}
  ${LB.ev.length?`<details class="tfeed"><summary>Лента отметок (${LB.ev.length})</summary><ul>${LB.ev.slice(0,30).map(e=>`<li><span class="num">${fmt(e.at)}</span> <b>${esc(busNm(e.t))}</b> ${e.what} ${esc(e.s.n)}</li>`).join('')}</ul></details>`:''}`}

function renderTours(){
  const el=$('#tourList');if(!el)return;
  if(!tDate)tDate=isoToday();
  renderSampleBtn();
  $('#tDateLbl').innerHTML=`<b>${isoDM(tDate)}</b> <small>${tDate===isoToday()?'сегодня':isoWd(tDate)}</small>`;
  if(tEdit){$('#tourEd').hidden=false;el.hidden=true;$('#tourPlaces').hidden=true;$('#tourSum').hidden=true;return}
  $('#tourEd').hidden=true;el.hidden=false;$('#tourPlaces').hidden=false;$('#tourSum').hidden=false;
  const all=tours(),today=all.filter(t=>dayOfTour(t,tDate));
  const busSel=$('#tBus');const cur=store.get('tourBus','');
  busSel.innerHTML=`<option value="">Все автобусы</option>`+today.map(t=>`<option value="${esc(t.id)}"${cur===t.id?' selected':''}>${esc(t.bus||'?')} · ${esc(t.guide||'')}</option>`).join('');
  const list=cur&&today.some(t=>t.id===cur)?today.filter(t=>t.id===cur):today;
  const pax=today.reduce((a,t)=>a+(+t.pax||0),0);
  $('#tourSum').innerHTML=today.length?`<span class="chip">🚌 Автобусов: <b>${today.length}</b></span><span class="chip">👥 Гостей: <b>${pax}</b></span>${all.length>today.length?`<span class="hint">ещё программ в другие дни: ${all.length-today.length}</span>`:''}`:'';
  // restaurants and shops of the day
  const PL=placeLoad(tDate);
  $('#tourPlaces').innerHTML=PL.length&&!cur?`<h3>Рестораны и магазины на ${isoDM(tDate)}</h3><div class="tplaces">${PL.map(p=>`<div class="tpl ${p.warn?'warn':''}"><div class="tpl-h"><span>${TK[p.k][0]} <b>${esc(p.name)}</b></span><span class="num">${p.pax} чел.</span></div>
    <div class="tpl-r">${p.rows.map(r=>`<span class="chip">${esc(r.t.bus||'?')} · ${r.min!=null?fmt(r.min):'время ?'} · ${r.pax}</span>`).join('')}</div>
    <div class="tpl-cfg">${p.k==='lunch'?`<label class="tpl-cap">Мест <input type="number" min="0" inputmode="numeric" value="${p.cap||''}" data-cap="${esc(p.key)}" placeholder="—"></label>`:''}<label class="tpl-cap">Стоянка, мин <input type="number" min="0" inputmode="numeric" value="${+placeCfg(p.key).stay||''}" data-stay="${esc(p.key)}" placeholder="${STAY[p.k]}"></label></div>
    ${p.warn?`<div class="tpl-w">⚠ ${esc(p.warn)}</div>`:''}${p.noTime?`<div class="hint">без времени: ${p.noTime}</div>`:''}</div>`).join('')}</div>`:'';
  $('#tourPlaces').querySelectorAll('[data-cap]').forEach(i=>i.onchange=()=>{setPlaceCfg(i.dataset.cap,{cap:+i.value||0});renderTours()});
  $('#tourPlaces').querySelectorAll('[data-stay]').forEach(i=>i.onchange=()=>{setPlaceCfg(i.dataset.stay,{stay:+i.value||0});renderTours()});
  if(!today.length){renderLive({P:{},ev:[]});$('#tourLive').innerHTML='';el.innerHTML=`<p class="hint">На ${isoDM(tDate)} экскурсий нет.${all.length?' Листайте даты стрелками.':' Нажмите «+ Программа» или загрузите Excel с программой.'}</p>`;return}
  const isToday=tDate===isoToday(),now=nowMinutes();const LB=liveBoard(tDate);renderLive(LB);
  el.innerHTML=list.map(t=>tourCardHtml(t,tDate,LB)).join('');
  bindTourCards(el);
}
function tourCardHtml(t,iso,LB,o={}){const tDateSave=tDate;tDate=iso;try{const isToday=iso===isoToday(),now=nowMinutes();
const x=dayOfTour(t,iso);const st=tourNow(t,x.day);let lastA=-1;x.day.s.forEach((s,i)=>{if(stopState(t,s).a!=null)lastA=i});const firstOpen=lastA+1;
    const rows=x.day.s.map((s,i)=>{const m=stopState(t,s);const key=t.id+'|'+s.id;const plan=s.t?toMin(s.t):null;
      const late=isToday&&i===firstOpen&&plan!=null&&now>plan+10;
      return `<li class="tst k-${s.k} ${m.a!=null?(m.d!=null?'done':'here'):''} ${late?'late':''}">
        <span class="tt num">${s.t||'—'}${s.m?`<small>маг. ${esc(s.m)}</small>`:''}</span>
        <span class="tn"><span class="ti">${TK[s.k][0]}</span> ${esc(s.n)}${late?`<small class="lt">опаздывают ${now-plan} мин</small>`:''}
          ${m.a!=null?`<small class="ok">📍 ${fmt(m.a)}${m.d!=null?' → 🚌 '+fmt(m.d):''}</small>`:''}
          ${s.k==='shop'&&m.a!=null?`<label class="sale">Продажа <input value="${esc(m.s||'')}" data-sale="${key}" placeholder="сумма"></label>`:''}</span>
        <span class="tb">${m.a==null?`<button type="button" class="btn sm" data-ta="${key}">📍 ${s.k==='start'?'Выехали':'Прибыли'}</button>`:m.d==null&&s.k!=='start'&&s.k!=='hotel'&&s.k!=='transfer'?`<button type="button" class="btn sm primary" data-td="${key}">🚌 Уехали</button>`:''}${m.a!=null?`<button type="button" class="btn sm ghost" data-tu="${key}" title="Отменить">↺</button>`:''}</span></li>`}).join('');
    return `<article class="tcard"><header class="tch"><div><b class="tbus">${esc(t.bus||'BUS ?')}</b> ${t.name?`<span>${esc(t.name)}</span>`:''} <span class="chip">день ${x.i+1}/${t.days.length}</span> <span class="chip">👥 ${esc(t.pax||'?')}</span></div>
      <div class="tst-now ${st.cls}">${esc(st.txt)}</div></header>
      <div class="tppl">${t.guide?`<span>Гид отеля: ${gTag(t.guide)}</span>`:''}${t.kok?`<span>Кок гид: ${gTag(t.kok)}</span>`:''}${t.plate||t.driver?`<span>🚌 ${esc(t.plate||'')} ${esc(t.driver||'')}${t.dphone?` · <a class="tel" href="tel:${esc(t.dphone.replace(/\s/g,''))}">${esc(t.dphone)}</a>`:''}</span>`:''}${t.hotel?`<span>🏨 ${esc(t.hotel)}</span>`:''}</div>
      ${coordHint(LB,t,x)}
      <ol class="tstops">${rows}</ol>
      <div class="tact"><button type="button" class="btn sm" data-twa="${esc(t.id)}" data-tiso="${iso}">📋 Программа дня в WhatsApp</button>${o.guide?'':`<button type="button" class="btn sm" data-tedit="${esc(t.id)}">✎ Изменить</button><button type="button" class="btn sm" data-tcopy="${esc(t.id)}">⧉ Копия для другого автобуса</button>`}</div></article>`}finally{tDate=tDateSave}}
function tourRefresh(){renderTours();if(typeof renderGuide==='function'&&!$('#v-guide').hidden)renderGuide()}
function bindTourCards(el){
  el.querySelectorAll('[data-ta]').forEach(b=>b.onclick=()=>{saveTM(b.dataset.ta,Object.assign({},TM[b.dataset.ta],{a:nowMinutes()}));tourRefresh()});
  el.querySelectorAll('[data-td]').forEach(b=>b.onclick=()=>{saveTM(b.dataset.td,Object.assign({},TM[b.dataset.td],{d:nowMinutes()}));tourRefresh()});
  el.querySelectorAll('[data-tu]').forEach(b=>b.onclick=()=>{const m=Object.assign({},TM[b.dataset.tu]);if(m.d!=null)delete m.d;else delete m.a;saveTM(b.dataset.tu,Object.keys(m).length&&(m.a!=null||m.s)?m:null);tourRefresh()});
  el.querySelectorAll('[data-sale]').forEach(i=>i.onchange=()=>{saveTM(i.dataset.sale,Object.assign({},TM[i.dataset.sale],{s:i.value.trim()}));toast('Продажа записана')});
  el.querySelectorAll('[data-tedit]').forEach(b=>b.onclick=()=>openTourEd(JSON.parse(JSON.stringify(TOURS[b.dataset.tedit]))));
  el.querySelectorAll('[data-tcopy]').forEach(b=>b.onclick=()=>{const c=JSON.parse(JSON.stringify(TOURS[b.dataset.tcopy]));c.id=rid();c.bus='';c.guide='';c.kok='';c.plate='';c.driver='';c.dphone='';c.days.forEach(d=>d.s.forEach(s=>s.id=rid()));openTourEd(c,true)});
  el.querySelectorAll('[data-tswap]').forEach(b=>b.onclick=()=>{const [id,di,from,to]=b.dataset.tswap.split('|');const t=JSON.parse(JSON.stringify(TOURS[id]));const a=t.days[+di].s;const [mv]=a.splice(+from,1);a.splice(+to,0,mv);saveTour(id,t);toast(`Порядок изменён: сначала ${mv.n}`);tourRefresh()});
  el.querySelectorAll('[data-twa]').forEach(b=>b.onclick=()=>copy(tourWa(TOURS[b.dataset.twa],b.dataset.tiso||tDate),true));
}
function tourWa(t,iso){const x=dayOfTour(t,iso);if(!x)return '';const tr=LANG==='tr';
  const L=[`*${isoDM(iso)} · ${t.bus||'BUS'}${t.name?' · '+t.name:''}*`,`${tr?'Rehber':'Гид'}: ${t.guide||'-'}${gPhone(t.guide)?' ('+gPhone(t.guide)+')':''}`,t.kok?`${tr?'Kok rehber':'Кок гид'}: ${t.kok}${gPhone(t.kok)?' ('+gPhone(t.kok)+')':''}`:'',`PAX: ${t.pax||'-'}`,''];
  x.day.s.forEach(s=>{const m=stopState(t,s);L.push(`${s.t||'--:--'} ${TK[s.k][0]} ${s.n}${s.m?(tr?' · mağaza ':' · магазин ')+s.m:''}${m.a!=null?' ✓ '+fmt(m.a):''}${m.s?' · '+(tr?'satış':'продажа')+' '+m.s:''}`)});
  return L.filter((l,i)=>l||i===4).join('\n')}

/* ---- editor ---- */
function blankTour(){const d=tDate||isoToday();return {id:rid(),bus:'',name:'',pax:'',hotel:'',guide:'',kok:'',plate:'',driver:'',dphone:'',days:[{d,s:[{id:rid(),t:'08:00',n:'OTELDEN ÇIKIŞ',k:'start',m:''}]}]}}
function openTourEd(t,isCopy){tEdit=t;tEdit._copy=!!isCopy;renderTourEd();renderTours();window.scrollTo({top:$('#v-tours').offsetTop-60,behavior:'smooth'})}
function renderTourEd(){const t=tEdit;const box=$('#tourEd');
  const kinds=Object.entries(TK).map(([k,v])=>`<option value="${k}">${v[0]} ${v[1]}</option>`).join('');
  const f=(k,l,ph,type)=>`<label>${l}<input data-tf="${k}" value="${esc(t[k]||'')}" placeholder="${ph||''}"${type?` type="${type}" inputmode="numeric"`:''}></label>`;
  box.innerHTML=`<h3>${t._copy?'Копия программы — впишите автобус и гидов':TOURS[t.id]?'Изменить программу':'Новая программа'}</h3>
    <div class="ted-g">${f('bus','Автобус','BUS 3')}${f('name','Программа','Kapadokya 6 gün')}${f('pax','PAX','39','number')}${f('hotel','Отель','')}${f('guide','Гид отеля (Otel rehberi)','CAVİT MUHAMED OĞLU')}${f('kok','Кок гид (Kok rehber)','ELMİRA ARIKAN')}${f('plate','Номер машины','07 ABC 123')}${f('driver','Водитель','')}${f('dphone','Телефон водителя','05xx')}</div>
    ${t.days.map((d,di)=>`<fieldset class="ted-day"><legend>День ${di+1} <input type="date" data-dd="${di}" value="${d.d}"> <button type="button" class="btn sm ghost" data-ddel="${di}">✕ день</button></legend>
      <div class="ted-hd"><span>Время</span><span>Место</span><span>Тип</span><span>Вход в магазин</span><span></span></div>
      ${d.s.map((s,si)=>`<div class="ted-row" data-r="${di}|${si}"><input type="time" data-sf="t" value="${esc(s.t||'')}"><input data-sf="n" value="${esc(s.n)}" placeholder="Название"><select data-sf="k">${kinds.replace(`value="${s.k}"`,`value="${s.k}" selected`)}</select><input type="time" data-sf="m" value="${esc(s.m||'')}" ${s.k==='shop'?'':'disabled'}><span class="ted-b"><button type="button" class="btn sm ghost" data-sup="${di}|${si}" aria-label="Выше">↑</button><button type="button" class="btn sm ghost" data-sdel="${di}|${si}" aria-label="Удалить">✕</button></span></div>`).join('')}
      <button type="button" class="btn sm" data-sadd="${di}">+ точка</button></fieldset>`).join('')}
    <p class="ted-act"><button type="button" class="btn" id="tedAddDay">+ день</button><span class="sp"></span>${TOURS[t.id]&&!t._copy?`<button type="button" class="btn ghost" id="tedDel">🗑 Удалить программу</button>`:''}<button type="button" class="btn" id="tedCancel">Отмена</button><button type="button" class="btn primary" id="tedSave">Сохранить</button></p>`;
  box.querySelectorAll('[data-tf]').forEach(i=>i.oninput=()=>t[i.dataset.tf]=i.value);
  box.querySelectorAll('[data-dd]').forEach(i=>i.onchange=()=>{const di=+i.dataset.dd;const old=t.days[di].d;t.days[di].d=i.value;
    if(di===0&&old&&i.value&&t.days.length>1&&confirm(T('Сдвинуть и остальные дни программы?'))){const diff=Math.round((Date.parse(i.value)-Date.parse(old))/864e5);t.days.forEach((d,j)=>{if(j)d.d=isoAdd(d.d,diff)});renderTourEd()}});
  box.querySelectorAll('.ted-row').forEach(r=>{const [di,si]=r.dataset.r.split('|').map(Number);const s=t.days[di].s[si];
    r.querySelectorAll('[data-sf]').forEach(i=>{i.oninput=i.onchange=()=>{s[i.dataset.sf]=i.value;
      if(i.dataset.sf==='n'&&!s._k){s.k=stopKind(i.value,s.m);r.querySelector('[data-sf=k]').value=s.k}
      if(i.dataset.sf==='k'){s._k=1;r.querySelector('[data-sf=m]').disabled=s.k!=='shop'}}})});
  box.querySelectorAll('[data-sadd]').forEach(b=>b.onclick=()=>{t.days[+b.dataset.sadd].s.push({id:rid(),t:'',n:'',k:'sight',m:''});renderTourEd();const rs=box.querySelectorAll(`[data-r^="${b.dataset.sadd}|"] [data-sf=n]`);rs[rs.length-1].focus()});
  box.querySelectorAll('[data-sdel]').forEach(b=>b.onclick=()=>{const [di,si]=b.dataset.sdel.split('|').map(Number);t.days[di].s.splice(si,1);renderTourEd()});
  box.querySelectorAll('[data-sup]').forEach(b=>b.onclick=()=>{const [di,si]=b.dataset.sup.split('|').map(Number);if(!si)return;const a=t.days[di].s;[a[si-1],a[si]]=[a[si],a[si-1]];renderTourEd()});
  box.querySelectorAll('[data-ddel]').forEach(b=>b.onclick=()=>{if(t.days.length<2)return toast('В программе должен остаться хотя бы один день');t.days.splice(+b.dataset.ddel,1);renderTourEd()});
  $('#tedAddDay').onclick=()=>{const last=t.days[t.days.length-1];t.days.push({d:last&&last.d?isoAdd(last.d,1):isoToday(),s:[{id:rid(),t:'08:00',n:'OTELDEN ÇIKIŞ',k:'start',m:''}]});renderTourEd()};
  $('#tedCancel').onclick=()=>{tEdit=null;renderTours()};
  const del=$('#tedDel');if(del)del.onclick=()=>{if(!confirm(T('Удалить программу этого автобуса?')))return;saveTour(t.id,null);tEdit=null;toast('Программа удалена');renderTours()};
  $('#tedSave').onclick=()=>{
    if(!t.bus.trim())return toast('Впишите автобус (например BUS 3)');
    if(t.days.some(d=>!/^\d{4}-\d\d-\d\d$/.test(d.d)))return toast('У каждого дня должна быть дата');
    const clash=tours().find(o=>o.id!==t.id&&upTR(o.bus).replace(/\s/g,'')===upTR(t.bus).replace(/\s/g,'')&&o.days.some(d=>t.days.some(e=>e.d===d.d)));
    if(clash&&!confirm(T('В эти дни у этого автобуса уже есть программа. Всё равно сохранить?')))return;
    t.days.forEach(d=>{d.s=d.s.filter(s=>s.n.trim()).map(s=>({id:s.id||rid(),t:s.t||'',n:s.n.trim(),k:s.k||stopKind(s.n,s.m),m:s.k==='shop'?(s.m||''):''}))});
    t.days.sort((a,b)=>a.d<b.d?-1:1);
    const out=Object.assign({},t);delete out._copy;out.pax=String(out.pax||'').trim();
    saveTour(out.id,out);tEdit=null;if(!out.days.some(d=>d.d===tDate))tDate=out.days[0].d;toast('Программа сохранена');renderTours()};
}

/* ---- Excel program import (layout: date | stop | ÇIKIŞ | MAĞAZA GİRİŞ | OTEL REHBERİ | KOK REHBER | MAĞAZA SATIŞ | PAX) ---- */
const xTime=v=>{if(v==null||v==='')return '';if(typeof v==='number'&&v<1){const m=Math.round(v*1440);return fmt(m)}const m=String(v).match(/(\d{1,2})[:.](\d\d)/);return m?m[1].padStart(2,'0')+':'+m[2]:''};
const xDate=v=>{if(typeof v==='number'&&v>30000){const d=new Date(Math.round((v-25569)*864e5));return d.toISOString().slice(0,10)}const m=String(v||'').match(/(\d{1,2})\s*[./]+\s*(\d{1,2})\s*[./]+\s*(\d{4})/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:''};
function parseTourSheet(rows,name){
  let hdr=-1,col={};
  for(let r=0;r<Math.min(rows.length,15);r++){const u=(rows[r]||[]).map(upTR);if(u.some(c=>/ÇIKIŞ|CIKIS/.test(c))&&u.some(c=>/PAX|REHBER/.test(c))){hdr=r;u.forEach((c,i)=>{if(/^ÇIKIŞ|^CIKIS/.test(c.trim()))col.out=i;else if(/MA[ĞG]AZA.*G[İI]R/.test(c))col.shop=i;else if(/OTEL.*REHBER/.test(c))col.guide=i;else if(/KOK/.test(c))col.kok=i;else if(/SATI/.test(c))col.sale=i;else if(/PAX/.test(c))col.pax=i});break}}
  if(hdr<0)return null;
  const first=Math.min(...Object.values(col));const t={id:rid(),bus:/^(sheet|sayfa|лист)\s*\d*$/i.test(name||'')?'':String(name||''),name:'',pax:'',hotel:'',guide:'',kok:'',plate:'',driver:'',dphone:'',days:[]};
  let day=null;
  for(let r=hdr+1;r<rows.length;r++){const row=rows[r]||[];
    const dt=xDate(row[0]);if(dt&&(!day||day.d!==dt)){day={d:dt,s:[]};t.days.push(day)}
    if(col.guide!=null&&row[col.guide]&&!t.guide)t.guide=String(row[col.guide]).replace(/\s+/g,' ').trim();
    if(col.kok!=null&&row[col.kok]&&!t.kok)t.kok=String(row[col.kok]).replace(/\s+/g,' ').trim();
    if(col.pax!=null&&row[col.pax]&&!t.pax&&/\d/.test(row[col.pax]))t.pax=String(row[col.pax]).replace(/\D/g,'');
    let n='';for(let c=1;c<first;c++){const v=row[c];if(v!=null&&String(v).trim()&&!xDate(v)){n=String(v).replace(/\s+/g,' ').trim();break}}
    if(!n||!day)continue;
    const tm=xTime(row[col.out]),mg=col.shop!=null?xTime(row[col.shop]):'';const k=stopKind(n,mg);
    day.s.push({id:rid(),t:tm||(k==='shop'?mg:''),n,k,m:k==='shop'?mg:''})}
  t.days=t.days.filter(d=>d.s.length);return t.days.length?t:null}
async function importTourFiles(files){
  let n=0;for(const f of files){try{const wb=XLSX.read(await f.arrayBuffer(),{cellDates:false});
    for(const sn of wb.SheetNames){const rows=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,raw:true,defval:''});const t=parseTourSheet(rows,wb.SheetNames.length>1?sn:'');if(t){n++;if(n===1){openTourEd(t);toast('Программа прочитана — проверьте, впишите автобус и сохраните')}else saveTour(t.id,t)}}}catch(e){toast('Не удалось прочитать '+f.name+': '+e.message)}}
  if(!n)toast('В файле не нашёл программу (нужны колонки ÇIKIŞ, MAĞAZA GİRİŞ, PAX)');else if(n>1)toast(`Прочитано программ: ${n}. Первая открыта для проверки, остальные сохранены`)}

// programs from the photos sent on 21.10, so the screen is not empty on day one (bus = guide's first name until renamed)
function samplePrograms(){const S=x=>{const [t,n,m]=Array.isArray(x)?x:['',x,''];const k=stopKind(n,m);return {id:rid(),t:t||'',n,k,m:k==='shop'?(m||''):''}};
  const D=(d,arr)=>({d,s:arr.map(S)});
  const d19=(t,a,b,l,cafe)=>[[t,'OTELDEN ÇIKIŞ'],...(cafe?['KAFE MOLA']:[]),a,b,'ÖĞLE YEMEĞİ '+l,'DERVİŞ','OTELE GİRİŞ'];
  const d20=onex=>['OTEL ÇIKIŞ',...(onex?['DOĞAN ONEX']:[]),'KERVANSARAY','AKDENİZ MOLA','ÖĞLE YEMEĞİ ÖZKAN RESTORAN','PETROL OFİS 15 MIN','OTEL GİRİŞ'];
  const d21=pan=>["Otel'den Çıkış Saati",...(pan?['PANORAMA','GÜVERCİNLİK YER ALTI ŞEHRİ','CAPAZAR KURUYEMİŞ']:['SAYAN ONEX','ÇARDAK YER ALTI ŞEHRİ','BEYZADE KURUYEMİŞ']),'ORTA HİSAR','DEVELİ','HİTİT SERAMİK','ÖĞLEN YEMEĞİ FLORYA','OTELE DÖNÜŞ'];
  const d22=["ANTALYA'YA HAREKET",'ANATOLYA BAZAR 15 MIN AKSARAY','BAY ÇITIR','CAFE MOLA AKSEKİ','HAMAM BİLDİRİLECEK','OTELE GİRİŞ'];
  const K=(bus,guide,kok,pax,d18,a19,pan,onex,end23)=>({id:rid(),bus,name:'Kapadokya',pax:String(pax),hotel:'',guide,kok,plate:'',driver:'',dphone:'',
    days:[D('2026-10-18',d18),D('2026-10-19',a19),D('2026-10-20',d20(onex)),D('2026-10-21',d21(pan)),D('2026-10-22',d22),...(end23?[D('2026-10-23',['DÖNÜŞ TRANSFER'])]:[])]});
  const CITY='City Şehir Turu Üçkapılar';
  return [
    K('RAŞİD','RAŞİD CULFA','ADİLHAN ŞEVKET',39,[['08:30','OTELDEN ÇIKIŞ'],'PORTAKAL BAHÇE',['','PONTO VIP','11:00'],'ŞELALE','ÖĞLE YEMEĞİ BOHOMI',['','VIOLA','14:00'],CITY],d19('05:15','METİS ŞARAP','VAROL TEKSTİL','COLLESAI'),true,true),
    K('KEMRAN','KEMRAN EYUP','İBRAHİM ASLAN',39,[['08:30','OTELDEN ÇIKIŞ'],'PORTAKAL BAHÇE',['','PONTO ANTALYA','11:30'],'ŞELALE','ÖĞLE YEMEĞİ BOHOMI',['','VIOLA','13:30'],CITY],d19('05:15','METİS ŞARAP','VAROL TEKSTİL','COLLESAI'),true,true,true),
    K('MUSA','MUSA OSMANLI','BULENT AYAN',35,[['08:00','OTELDEN ÇIKIŞ'],CITY,['','PONTO ANTALYA','12:00'],'ÖĞLE YEMEĞİ BOHOMI','ŞELALE','PORTAKAL BAHÇE'],d19('05:30','METİS ŞARAP','VAROL TEKSTİL','OKALIPTUS'),false,false),
    K('RAİM','RAİM YAHYA YASİN','RUSTEM ALİŞOĞLU',35,[['08:00','OTELDEN ÇIKIŞ'],CITY,['','PONTO VİP','12:15'],'ÖĞLE YEMEĞİ BOHOMI','ŞELALE','PORTAKAL BAHÇE'],d19('05:30','DİONİS ŞARAP','MODAL TEKSTİL','OKALIPTUS'),false,false),
    K('ASLAN İ.','ASLAN İSMAİL','FERMAN YAĞMUR',38,[['08:00','OTELDEN ÇIKIŞ'],['','PONTO ANTALYA','09:30'],['','VIOLA','11:00'],'ŞELALE','ÖĞLE YEMEĞİ BOHOMI',CITY,'PORTAKAL BAHÇE'],d19('04:45','DIONIS','MODAL TEKSTİL','COLLESAI',true),true,true),
    K('ASLAN A.','ASLAN ALISOY','RÜSTEM ALİGİL',37,[['08:00','OTELDEN ÇIKIŞ'],['','VIOLA','09:30'],['','PONTO ANTALYA','10:15'],'ÖĞLE YEMEĞİ BOHOMI','ŞELALE',CITY],d19('05:00','DIONIS ŞARAP','MODAL TEKSTİL','COLLESAI',true),true,true),
    K('BALABEK','BALABEK DURSUN','MUHAMMED KİBAR',38,[['08:30','OTELDEN ÇIKIŞ'],['','VIOLA','10:00'],['','PONTO VİP','10:45'],'ÖĞLE YEMEĞİ BOHOMI','ŞELALE',CITY],d19('05:00','METİS ŞARAP','VAROL TEKSTİL','COLLESAI'),true,true),
    K('BARIŞ','BARIŞ ÖZSOY','MİKAİL GÜLER',37,[['08:00','OTELDEN ÇIKIŞ'],['','PONTO VIP','09:30'],['','VIOLA','10:30'],'ŞELALE','ÖĞLE YEMEĞİ BOHOMI',CITY,'PORTAKAL BAHÇE'],d19('04:45','DIONIS','MODAL TEKSTİL','COLLESAI',true),true,true),
    {id:rid(),bus:'CAVİT',name:'Kapadokya 6 gün',pax:'39',hotel:'',guide:'CAVİT MUHAMED OĞLU',kok:'ELMİRA ARIKAN',plate:'',driver:'',dphone:'',days:[
      D('2026-10-22',[['08:00','OTELDEN ÇIKIŞ'],['','VIOLA','10:00'],['','PONTO ANTALYA','11:00'],'ÖĞLE YEMEĞİ BOHOMI','ŞELALE',CITY,'PORTAKAL BAHÇE']),
      D('2026-10-23',[['05:00','OTELDEN ÇIKIŞ'],'DIONIS','MODAL','ÖĞLE YEMEĞİ COLESSAI','DERVİŞ','OTELE GİRİŞ']),
      D('2026-10-24',d20(false)),D('2026-10-25',d21(false)),D('2026-10-26',d22),D('2026-10-27',['DÖNÜŞ TRANSFER'])]}]}
const sampleMissing=()=>samplePrograms().filter(p=>!tours().some(t=>upTR(t.guide)===upTR(p.guide)&&t.days[0]&&t.days[0].d===p.days[0].d));
function renderSampleBtn(){const b=$('#tSamples');if(!b)return;const n=sampleMissing().length;b.hidden=!n;b.textContent=`📥 Программы с фото (${n})`}
/* ---- wiring ---- */
$('#tPrev').onclick=()=>{tDate=isoAdd(tDate||isoToday(),-1);renderTours()};
$('#tNext').onclick=()=>{tDate=isoAdd(tDate||isoToday(),1);renderTours()};
$('#tToday').onclick=()=>{tDate=isoToday();renderTours()};
$('#tNew').onclick=()=>openTourEd(blankTour());
$('#tSamples').onclick=()=>{const add=sampleMissing();if(!add.length)return;if(!confirm(T('Добавить программы с фото')+`: ${add.map(p=>p.bus).join(', ')}?`))return;add.forEach(p=>saveTour(p.id,p));toast(`Добавлено программ: ${add.length}. Переименуйте их в номера автобусов через «✎ Изменить»`);renderTours()};
$('#tBus').onchange=e=>{store.set('tourBus',e.target.value);renderTours()};
$('#tXls').onchange=e=>{importTourFiles([...e.target.files]);e.target.value=''};
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('.tab');if(b&&b.dataset.t==='tours'){renderTours();pullTours(true)}});
setInterval(()=>{if(!$('#v-tours').hidden&&!tEdit&&!(document.activeElement&&document.activeElement.closest&&document.activeElement.closest('#tourList')))renderTours()},60000);
if(!$('#v-tours').hidden){renderTours();pullTours(true)}

// guide screen, "Экскурсия" mode: today's bus programs where this person is the hotel guide or the kok guide
function tourGuidesOn(iso){const S=new Set();tours().forEach(t=>{if(dayOfTour(t,iso)){if(t.guide)S.add(t.guide);if(t.kok)S.add(t.kok)}});return [...S]}
function toursOfGuide(g,iso){const k=gKey(g);return tours().filter(t=>dayOfTour(t,iso)&&(gKey(t.guide||'')===k||gKey(t.kok||'')===k))}
function guideTourHtml(g){const iso=isoToday();const list=toursOfGuide(g,iso);
  if(!list.length)return `<p class="hint">Сегодня (${isoDM(iso)}) экскурсий у ${esc(g)} нет.</p>`;
  const LB=liveBoard(iso);return list.map(t=>tourCardHtml(t,iso,LB,{guide:true})).join('')}
if(!$('#v-guide').hidden){renderGuidePick();renderGuide()}
