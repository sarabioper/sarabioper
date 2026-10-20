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
  if(m||/V[İI]OLA|PONTO|D[İI]ON[İI]S|MODAL|DERV[İI]Ş|SAYAN|ONEX|KURUYEM|SERAM|BAZAR|ÇITIR|DEVEL[İI]|HALI|ALTIN|DER[İI]|JEWEL|LEATHER|GOLD|TEKST/.test(u))return 'shop';
  return 'sight'}
// "ÖĞLE YEMEĞİ COLESSAI" -> "COLESSAI"; the place key used for restaurant load
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
setInterval(()=>pullTours(),30000);

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
  tours().forEach(t=>{const x=dayOfTour(t,iso);if(!x)return;x.day.s.forEach(s=>{if(s.k!=='lunch'&&s.k!=='shop')return;const key=placeOf(s);
    (P[key]=P[key]||{key,k:s.k,rows:[]}).rows.push({t,s,min:s.t?toMin(s.t):(s.m?toMin(s.m):null),pax:+t.pax||0})})});
  return Object.values(P).map(p=>{p.rows.sort((a,b)=>(a.min??9999)-(b.min??9999));p.pax=p.rows.reduce((a,r)=>a+r.pax,0);p.cap=+(caps[p.key]||{}).cap||0;
    const win=p.k==='lunch'?60:30;let peak=0,clash=0;
    p.rows.forEach(r=>{if(r.min==null)return;const same=p.rows.filter(o=>o.min!=null&&Math.abs(o.min-r.min)<win);const sum=same.reduce((a,o)=>a+o.pax,0);if(sum>peak)peak=sum;if(same.length>1)clash=Math.max(clash,same.length)});
    p.peak=peak;p.clash=clash;p.noTime=p.rows.filter(r=>r.min==null).length;
    p.warn=p.cap&&peak>p.cap?`перегруз: ${peak} чел. на ${p.cap} мест`:p.k==='shop'&&clash>1?`${clash} автобуса в одно время`:'';return p})
    .sort((a,b)=>(a.k===b.k?0:a.k==='lunch'?-1:1)||a.key.localeCompare(b.key,'tr'))}

function renderTours(){
  const el=$('#tourList');if(!el)return;
  if(!tDate)tDate=isoToday();
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
  $('#tourPlaces').innerHTML=PL.length&&!cur?`<h3>Рестораны и магазины на ${isoDM(tDate)}</h3><div class="tplaces">${PL.map(p=>`<div class="tpl ${p.warn?'warn':''}"><div class="tpl-h"><span>${TK[p.k][0]} <b>${esc(p.key)}</b></span><span class="num">${p.pax} чел.</span></div>
    <div class="tpl-r">${p.rows.map(r=>`<span class="chip">${esc(r.t.bus||'?')} · ${r.min!=null?fmt(r.min):'время ?'} · ${r.pax}</span>`).join('')}</div>
    ${p.k==='lunch'?`<label class="tpl-cap">Мест в ресторане <input type="number" min="0" inputmode="numeric" value="${p.cap||''}" data-cap="${esc(p.key)}" placeholder="—"></label>`:''}
    ${p.warn?`<div class="tpl-w">⚠ ${esc(p.warn)}</div>`:''}${p.noTime?`<div class="hint">без времени: ${p.noTime}</div>`:''}</div>`).join('')}</div>`:'';
  $('#tourPlaces').querySelectorAll('[data-cap]').forEach(i=>i.onchange=()=>{const P=Object.assign({places:{}},TOURS['~places']);P.id='~places';P.places=Object.assign({},P.places);const v=+i.value||0;if(v)P.places[i.dataset.cap]={cap:v};else delete P.places[i.dataset.cap];saveTour('~places',P);renderTours()});
  if(!today.length){el.innerHTML=`<p class="hint">На ${isoDM(tDate)} экскурсий нет.${all.length?' Листайте даты стрелками.':' Нажмите «+ Программа» или загрузите Excel с программой.'}</p>${!all.length?`<p><button class="btn" type="button" id="tSample">Добавить программу с фото 22–27.10 (CAVİT / ELMİRA, 39 pax)</button></p>`:''}`;
    const sb=$('#tSample');if(sb)sb.onclick=()=>{const t=sampleTour();saveTour(t.id,t);tDate=t.days[0].d;renderTours()};return}
  const isToday=tDate===isoToday(),now=nowMinutes();
  el.innerHTML=list.map(t=>{const x=dayOfTour(t,tDate);const st=tourNow(t,x.day);let lastA=-1;x.day.s.forEach((s,i)=>{if(stopState(t,s).a!=null)lastA=i});const firstOpen=lastA+1;
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
      <ol class="tstops">${rows}</ol>
      <div class="tact"><button type="button" class="btn sm" data-twa="${esc(t.id)}">📋 Программа дня в WhatsApp</button><button type="button" class="btn sm" data-tedit="${esc(t.id)}">✎ Изменить</button><button type="button" class="btn sm" data-tcopy="${esc(t.id)}">⧉ Копия для другого автобуса</button></div></article>`}).join('');
  el.querySelectorAll('[data-ta]').forEach(b=>b.onclick=()=>{saveTM(b.dataset.ta,Object.assign({},TM[b.dataset.ta],{a:nowMinutes()}));renderTours()});
  el.querySelectorAll('[data-td]').forEach(b=>b.onclick=()=>{saveTM(b.dataset.td,Object.assign({},TM[b.dataset.td],{d:nowMinutes()}));renderTours()});
  el.querySelectorAll('[data-tu]').forEach(b=>b.onclick=()=>{const m=Object.assign({},TM[b.dataset.tu]);if(m.d!=null)delete m.d;else delete m.a;saveTM(b.dataset.tu,Object.keys(m).length&&(m.a!=null||m.s)?m:null);renderTours()});
  el.querySelectorAll('[data-sale]').forEach(i=>i.onchange=()=>{saveTM(i.dataset.sale,Object.assign({},TM[i.dataset.sale],{s:i.value.trim()}));toast('Продажа записана')});
  el.querySelectorAll('[data-tedit]').forEach(b=>b.onclick=()=>openTourEd(JSON.parse(JSON.stringify(TOURS[b.dataset.tedit]))));
  el.querySelectorAll('[data-tcopy]').forEach(b=>b.onclick=()=>{const c=JSON.parse(JSON.stringify(TOURS[b.dataset.tcopy]));c.id=rid();c.bus='';c.guide='';c.kok='';c.plate='';c.driver='';c.dphone='';c.days.forEach(d=>d.s.forEach(s=>s.id=rid()));openTourEd(c,true)});
  el.querySelectorAll('[data-twa]').forEach(b=>b.onclick=()=>copy(tourWa(TOURS[b.dataset.twa],tDate),true));
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

// the program from the photo sent on 21.10 (CAVİT / ELMİRA, 39 pax), so the screen is not empty on day one
function sampleTour(){const S=(t,n,m)=>{const k=stopKind(n,m);return {id:rid(),t:t||'',n,k,m:k==='shop'?(m||''):''}};
  return {id:rid(),bus:'BUS ?',name:'Kapadokya 6 gün',pax:'39',hotel:'',guide:'CAVİT MUHAMED OĞLU',kok:'ELMİRA ARIKAN',plate:'',driver:'',dphone:'',days:[
    {d:'2026-10-22',s:[S('08:00','OTELDEN ÇIKIŞ'),S('10:00','VIOLA','10:00'),S('11:00','PONTO ANTALYA','11:00'),S('','ÖĞLE YEMEĞİ BOHOMI'),S('','ŞELALE'),S('','City Şehir Turu Üçkapılar'),S('','PORTAKAL BAHÇE')]},
    {d:'2026-10-23',s:[S('05:00','OTELDEN ÇIKIŞ'),S('','DIONIS'),S('','MODAL'),S('','ÖĞLE YEMEĞİ COLESSAI'),S('','DERVİŞ'),S('','OTELE GİRİŞ')]},
    {d:'2026-10-24',s:[S('','OTEL ÇIKIŞ'),S('','KERVANSARAY'),S('','AKDENİZ MOLA'),S('','ÖĞLE YEMEĞİ ÖZKAN RESTORAN'),S('','PETROL OFİS 15 MIN'),S('','OTEL GİRİŞ')]},
    {d:'2026-10-25',s:[S('','Otel\'den Çıkış Saati'),S('','SAYAN ONEX'),S('','ÇARDAK YER ALTI ŞEHİR'),S('','BEYZADE KURUYEMİŞ'),S('','ORTA HİSAR'),S('','DEVELİ'),S('','HİTİT SERAMİK'),S('','ÖĞLEN YEMEĞİ FLORYA'),S('','OTELE DÖNÜŞ')]},
    {d:'2026-10-26',s:[S('','ANTALYA\'YA HAREKET'),S('','ANATOLYA BAZAR 15 MIN AKSARAY'),S('','BAY ÇITIR'),S('','CAFE MOLA AKSEKİ'),S('','HAMAM BİLDİRİLECEK'),S('','OTELE GİRİŞ')]},
    {d:'2026-10-27',s:[S('','DÖNÜŞ TRANSFER')]}]}}

/* ---- wiring ---- */
$('#tPrev').onclick=()=>{tDate=isoAdd(tDate||isoToday(),-1);renderTours()};
$('#tNext').onclick=()=>{tDate=isoAdd(tDate||isoToday(),1);renderTours()};
$('#tToday').onclick=()=>{tDate=isoToday();renderTours()};
$('#tNew').onclick=()=>openTourEd(blankTour());
$('#tBus').onchange=e=>{store.set('tourBus',e.target.value);renderTours()};
$('#tXls').onchange=e=>{importTourFiles([...e.target.files]);e.target.value=''};
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('.tab');if(b&&b.dataset.t==='tours'){renderTours();pullTours(true)}});
setInterval(()=>{if(!$('#v-tours').hidden&&!tEdit&&!(document.activeElement&&document.activeElement.closest&&document.activeElement.closest('#tourList')))renderTours()},60000);
if(!$('#v-tours').hidden){renderTours();pullTours(true)}
