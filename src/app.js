
/* ---------- helpers ---------- */
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const toMin=t=>{if(!t||!/\d\d:\d\d/.test(t))return 0;const [h,m]=t.split(':').map(Number);return h*60+m};
const fmt=m=>{m=((Math.round(m)%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')};
const normFl=f=>{const m=String(f).replace(/\s+/g,' ').trim().match(/^([A-Z0-9]{2}) ?0*(\d+)$/);return m?m[1]+' '+m[2]:f};
const store={get(k,d){try{const v=localStorage.getItem('sarabi_'+k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem('sarabi_'+k,JSON.stringify(v))}catch(e){}}};
function toast(t){const el=$('#toast');el.textContent=t;el.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>el.hidden=true,2200)}
async function copy(text){try{await navigator.clipboard.writeText(text);toast('Скопировано')}catch(e){toast('Выделите текст и скопируйте вручную')}}
const termLbl=t=>t==='İÇ'?'İÇ HATLAR':t==='DIŞ'?'DIŞ HATLAR T2':'терминал ?';
const termTr=t=>t==='İÇ'?'İç Hatlar':t==='DIŞ'?'Dış Hatlar T2':'terminal belirsiz';

const DUR={AER:120,SOC:120,FRU:330,UFA:270,SAW:75,IST:75,ESB:70,TZX:80,TBS:150,GYD:180,TSE:330,SVX:300,VKO:225,SVO:225,DME:225,MOW:225,KRR:150,ALA:360,CIT:330,'CİT':330,MRV:150,VNO:180,LED:240,KUF:270,OVB:330,DXB:270,CEK:300,NQZ:330,KGD:240,STR:210,CGN:210,KZN:240,BER:210,AMS:240,REN:270};
const DOMESTIC=new Set(['SAW','IST','ESB','ADB','TZX','ADA','GZT','DIY','ERZ','VAN','KYA','ASR','SZF','GZP','DLM','BJV']);
const CITY={AER:"Сочи",SOC:"Сочи",FRU:"Бишкек",UFA:"Уфа",SAW:"Стамбул SAW",IST:"Стамбул IST",ESB:"Анкара",TZX:"Трабзон",TBS:"Тбилиси",GYD:"Баку",TSE:"Астана",SVX:"Екатеринбург",VKO:"Внуково",SVO:"Шереметьево",DME:"Домодедово",MOW:"Москва",KRR:"Краснодар",ALA:"Алматы",CIT:"Шымкент","CİT":"Шымкент",MRV:"Мин. Воды",VNO:"Вильнюс",LED:"Пулково",KUF:"Самара",OVB:"Новосибирск",DXB:"Дубай",CEK:"Челябинск",NQZ:"Астана",KGD:"Калининград",STR:"Штутгарт",CGN:"Кёльн",KZN:"Казань",BER:"Берлин",AMS:"Амстердам",REN:"Оренбург",GZP:"Газипаша"};
const CITY_TR={AER:"Soçi",SOC:"Soçi",FRU:"Bişkek",UFA:"Ufa",SAW:"İstanbul SAW",IST:"İstanbul",ESB:"Ankara",TZX:"Trabzon",TBS:"Tiflis",GYD:"Bakü",TSE:"Astana",NQZ:"Astana",SVX:"Yekaterinburg",VKO:"Moskova VKO",SVO:"Moskova SVO",DME:"Moskova DME",MOW:"Moskova",KRR:"Krasnodar",ALA:"Almatı",MRV:"Mineralnye Vody",VNO:"Vilnius",LED:"St. Petersburg",KUF:"Samara",OVB:"Novosibirsk",DXB:"Dubai",CEK:"Çelyabinsk",KGD:"Kaliningrad",STR:"Stuttgart",CGN:"Köln",KZN:"Kazan"};
// travel time hotel → AYT, minutes
const TRAVEL=h=>/Doğanay/.test(h)?110:/Antalya/.test(h)?25:75;

/* ---------- days ---------- */
const DAYS={};
function dayFrom14(){
  const arr=ARR.map(t=>({id:'a'+t.id,t:t.t,fl:t.fl,org:t.org,to:'AYT',h:t.h,v:t.v,g:t.g,op:t.op,term:t.term.startsWith('İÇ')?'İÇ':'DIŞ',p:t.p,pax:t.p.filter(p=>p[0]!=='Inf').length||t.p.length,note:t.ind?'Bindir gönder · Cebeci Towers, Mahmutlar':''}));
  const dep=DEP14.map((r,i)=>({id:'d'+i,fl:r[0],dest:r[1],t:r[2],h:r[3],pax:r[4],pu:r[5],g:r[6],v:r[7],term:r[8]==='?'?'':r[8],op:r[9],note:r[10]}));
  return {key:'14.10',title:'14 октября 2026',source:'PDF-списки',arr,dep,self:0,h2h:309,recon:null,
    delays:{"SU 798":35,"J2 25":20,"KC 915":50,"VF 4006":25,"TK 4006":25,"2S 98":15,"DP 859":40,"SU 2144":30},
    extra:[
      ['crit','Межотельные трансферы без машины: 309 человек','В общем списке прибытий шесть трансферов «отель → отель» стоят с пометкой «Araç Yok». Самый большой: 150 человек из Beach Club Doğanay в Casa Fora.'],
      ['crit','Двойная запись гостя: MATSHINA ELVIRA','В трансфере №9 (Casa Fora) она стоит дважды, позиции 2 и 7, обе SNG STD на 14–16.10.'],
      ['warn','Гости в двух трансферах: DUANAYEV YERKINBAY и BEIISBEK KALBIBI','Записаны и в трансфере №3 (до 19.10), и в №4 (до 16.10). Нужно уточнить, какой правильный.'],
      ['warn','4 гостя Doğanay без билета','В списке вылетов: ELDR27, гид Dursun, пометка «Bileti yok».']
    ]};
}
function dayFromKapak(K,key,title){
  const clean=s=>s&&!/\?/.test(s)?s:'';
  const tm=t=>t==='ICHAT'?'İÇ':t==='TER 2'?'DIŞ':'';
  const arr=[],dep=[];let self=0,h2h=0;
  K.recs.forEach((r,i)=>{
    if(r.kind==='self'){self+=r.pax;return}
    if(r.kind==='h2h'){h2h+=r.pax;return}
    if(r.kind==='arr')arr.push({id:key+'a'+i,t:r.time,fl:r.fl,org:clean(r.from),to:r.to,h:r.hotel,v:r.v,g:r.g,op:r.op||'—',term:tm(r.term),p:[],pax:r.pax,note:r.note});
    else dep.push({id:key+'d'+i,fl:r.fl,dest:clean(r.to),t:r.time,h:r.hotel,pax:r.pax,pu:r.pu,g:r.g,v:r.v,term:tm(r.term),op:r.op||'—',note:r.note});
  });
  return {key,title,source:'Excel KAPAK',arr,dep,self,h2h,recon:K.recon,delays:{},extra:[]};
}
const DEMO=typeof ARR!=='undefined';
if(DEMO){DAYS['14.10']=dayFrom14();
DAYS['15.10']=dayFromKapak(KAPAK15,'15.10','15 октября 2026');
DAYS['15.10'].delays={"KC 215":30,"TK 4006":20,"VF 4006":20,"2S 322":45,"SU 2126":25,"PC 5046":60,"DP 955":15,"PC 231":35};
try{const imp=store.get('imported',{});Object.values(imp).forEach(d=>{if(!DAYS[d.key])DAYS[d.key]=d})}catch(e){}}
/* ---------- server mode (Netlify) ---------- */
const SERVER=!DEMO&&/^https?:/.test(location.protocol);
let LIVE=null,followNow=true;
const pass=()=>store.get('pass','');
async function api(method,path,body){
  const r=await fetch(path,{method,headers:{'content-type':'application/json','x-ops-key':pass()},body:body?JSON.stringify(body):undefined});
  if(r.status===401){showLogin('Неверный пароль.');throw new Error('401')}
  if(!r.ok)throw new Error((await r.text())||r.status);
  return r.json();
}
let saveT={};
function saveRemote(kind,data){if(!SERVER)return;clearTimeout(saveT[kind]);const k=dayKey;saveT[kind]=setTimeout(()=>api('PUT','/api/state?d='+encodeURIComponent(k)+'&kind='+kind,data).catch(()=>toast('Нет связи с сервером, изменения сохранены только здесь')),600)}
function saveAssign(){store.set('assign_'+dayKey,assign);saveRemote('assign',assign)}
function saveMet(){store.set('met_'+dayKey,met);saveRemote('met',met)}
function showLogin(err){$('#login').hidden=false;$('#loginErr').textContent=err||'';$('#loginPass').focus()}
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();store.set('pass',$('#loginPass').value.trim());$('#login').hidden=true;await serverBoot()});
async function serverBoot(){
  if(!pass()){showLogin();return}
  try{
    const res=await api('GET','/api/days');
    res.days.forEach(d=>{DAYS[d.key]=d});
    const keys=Object.keys(DAYS).sort();
    if(!DAYS[dayKey])dayKey=keys.includes(todayKey())?todayKey():keys.pop()||null;
    loadDay(dayKey);
    await refreshLive();setInterval(refreshLive,5*60*1000);
  }catch(e){if(e.message!=='401'){$('#modePill').textContent='Сервер недоступен: '+e.message;loadDay(null)}}
}
function todayKey(){const d=new Date();return String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')}
async function refreshLive(){
  try{LIVE=await api('GET','/api/flights')}catch(e){LIVE=null}
  const c=LIVE&&LIVE.coverage;const cov=c&&c.watched?` · найдено ${c.found} из ${c.watched} наших рейсов`:'';
  $('#modePill').textContent=LIVE&&LIVE.updated?`Рейсы: обновлено ${new Date(LIVE.updated).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'})} · ${LIVE.provider}${cov}`:((LIVE&&LIVE.message)||'Живые статусы ещё не подключены')+cov;
  $('#modePill').title=c&&c.missing&&c.missing.length?'Пока без данных: '+c.missing.join(', '):'';
  if(DAY){buildFlights();renderAll()}
}
function liveFor(f){
  if(!LIVE||!LIVE.flights||!DAY||!DAY.iso||LIVE.date!==DAY.iso)return null;
  for(const c of f.codes){const x=LIVE.flights[normFl(c).replace(' ','')];if(x)return x}
  return null;
}

let DAY=null,flights=[];
let dayKey=store.get('day','15.10');if(!DAYS[dayKey])dayKey=Object.keys(DAYS).sort().pop()||null;
let NOW=store.get('now_'+dayKey,540);
let assign={},met={},contacts=null;

function loadDay(k){
  if(!k||!DAYS[k]){DAY=null;$('#dateLbl').textContent='Операционный центр · день ещё не загружен';$('#daySel').innerHTML='';$('#board').innerHTML='<p class="hint">Пока нет ни одного дня. Откройте вкладку «Загрузить день» и перетащите Excel KAPAK.</p>';const tb=document.querySelector('.tab[data-t=data]');if(tb)tb.click();return}
  dayKey=k;DAY=DAYS[k];store.set('day',k);
  assign=store.get('assign_'+k,k==='15.10'?{"BUS 10":{plate:"35 CVL 346",phone:"0553 573 61 69",driver:""},"BUS 12":{plate:"07 CJD 855",phone:"0554 407 82 82",driver:""},"BUS 13":{plate:"07 GLE 03",phone:"0552 169 14 75",driver:""},"BUS 6":{plate:"07 BJH 898",phone:"0533 680 38 05",driver:""},"MİNİ 4":{plate:"34 BK 1708",phone:"0532 515 44 65",driver:""},"MİNİ 10":{plate:"19 TT 077",phone:"0532 177 87 57",driver:""}}:{});
  met=store.get('met_'+k,{});contacts=store.get('contacts_'+k,null);
  if(DAY.assign)assign=Object.assign({},assign,DAY.assign);if(DAY.met)met=Object.assign({},met,DAY.met);
  NOW=SERVER?nowMinutes():store.get('now_'+k,k==='15.10'?nowMinutes():540);followNow=SERVER;
  buildFlights();fillFilters();curGuide=null;
  $('#dateLbl').textContent='Операционный центр · '+DAY.title+' · '+DAY.source;
  renderDaySel();renderVeh();runChecks();renderContacts();renderAll();
}
function nowMinutes(){const d=new Date();return d.getHours()*60+d.getMinutes()}
function renderDaySel(){
  $('#daySel').innerHTML=Object.keys(DAYS).sort().map(k=>`<button type="button" aria-pressed="${k===dayKey}" data-k="${k}">${k}</button>`).join('');
  $('#daySel').querySelectorAll('button').forEach(b=>b.onclick=()=>loadDay(b.dataset.k));
}

function buildFlights(){
  const map=new Map();
  DAY.arr.forEach(t=>{
    const key=normFl(t.fl)+'|'+t.t;
    if(!map.has(key))map.set(key,{key,code:normFl(t.fl),codes:new Set(),t:t.t,org:t.org,to:t.to||'AYT',groups:[]});
    const f=map.get(key);f.codes.add(t.fl);f.groups.push(t);if(!f.org&&t.org)f.org=t.org;
  });
  flights=[...map.values()].sort((a,b)=>toMin(a.t)-toMin(b.t)||a.code.localeCompare(b.code));
  flights.forEach(f=>{
    f.unknown=/^[!?]/.test(f.code);
    f.sched=toMin(f.t);
    const dl=Math.max(0,...[...f.codes].map(c=>(DAY.delays||{})[normFl(c)]||0));
    f.delay=dl;f.eta=f.sched+dl;f.dur=DUR[f.org]||150;f.dep=f.sched-f.dur;
    f.delayKnownAt=f.dep+Math.min(30,f.dur/3);
    f.live=liveFor(f);
    if(f.live){const L=f.live;const e=L.act||L.est;f.eta=e?toMin(e):f.sched;f.delay=Math.max(0,f.eta-f.sched);
      if(L.depAct)f.dep=toMin(L.depAct);else if(L.depEst)f.dep=toMin(L.depEst);
      if(f.eta<f.dep)f.dep-=1440;f.delayKnownAt=Math.max(0,Math.min(f.dep,f.sched-60));}
    f.pax=f.groups.reduce((s,g)=>s+g.pax,0);
  });
}
function fStatus(f,now){
  if(f.unknown)return {k:'sched',lbl:'Рейс не указан',eta:f.sched};
  if(f.live){const L=f.live,d=f.delay;
    if(L.status==='cancelled')return {k:'late',lbl:'Рейс отменён',eta:f.eta};
    if(L.status==='diverted')return {k:'late',lbl:'Ушёл на запасной',eta:f.eta};
    if(L.act||L.status==='landed')return {k:'land',lbl:'Приземлился '+fmt(f.eta),eta:f.eta};
    if(L.status==='active'||L.status==='en-route'){const p=Math.max(0,Math.min(1,(now-f.dep)/Math.max(1,f.eta-f.dep)));return {k:d>=15?'late':'air',lbl:d>=15?'В воздухе, +'+d+' мин':'В воздухе',eta:f.eta,p}}
    return {k:d>=15?'late':'sched',lbl:d>=15?'Задержка +'+d+' мин':'По расписанию',eta:f.eta};
  }
  const vis=now>=f.delayKnownAt;const eta=vis?f.eta:f.sched;
  if(now<f.dep)return {k:'sched',lbl:'По расписанию',eta};
  if(now<f.eta){const p=Math.min(1,(now-f.dep)/(f.eta-f.dep));if(vis&&f.delay)return {k:'late',lbl:'Задержка +'+f.delay+' мин',eta,p};return {k:'air',lbl:'В воздухе',eta,p}}
  return {k:'land',lbl:'Приземлился '+fmt(f.eta),eta:f.eta};
}

/* ---------- board ---------- */
function fillFilters(){
  const opt=(sel,vals)=>{const s=$(sel);s.length=1;vals.forEach(v=>s.add(new Option(v,v)));s.value=''};
  opt('#fVeh',[...new Set(DAY.arr.map(t=>t.v).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr',{numeric:true})));
  opt('#fHotel',[...new Set(DAY.arr.map(t=>t.h))].sort());
  opt('#fOp',[...new Set(DAY.arr.map(t=>t.op))].sort());
}
const metCount=g=>Object.values(met[g.id]||{}).filter(Boolean).length;
function renderBoard(){
  const fv=$('#fVeh').value,fh=$('#fHotel').value,fo=$('#fOp').value,q=$('#fQ').value.trim().toUpperCase();
  let html='',nowPlaced=false,land=0,air=0,late=0,paxLanded=0,paxMet=0;
  flights.forEach(f=>{
    const st=fStatus(f,NOW);
    if(st.k==='land'){land++;paxLanded+=f.pax}else if(st.k==='late')late++;else if(st.k==='air')air++;
    f.groups.forEach(g=>paxMet+=metCount(g));
    const gs=f.groups.filter(g=>(!fv||g.v===fv)&&(!fh||g.h===fh)&&(!fo||g.op===fo)&&(!q||f.code.includes(q)||(g.g||'').includes(q)||g.p.some(p=>p[1].includes(q))));
    if(!gs.length)return;
    if(!nowPlaced&&st.eta>NOW){html+=`<div class="nowline">СЕЙЧАС ${fmt(NOW)}</div>`;nowPlaced=true}
    const expected=DOMESTIC.has(f.org)?'İÇ':'DIŞ';
    const terms=[...new Set(f.groups.map(g=>g.term))];
    const vehs=[...new Set(gs.map(g=>g.v||'—'))];
    const timeCol=st.k!=='sched'&&f.delay&&NOW>=f.delayKnownAt
      ?`<span class="sch struck num">${f.t}</span><span class="eta num">${fmt(f.eta)}</span><span class="hint" style="font-size:11px">расч. посадка</span>`
      :`<span class="sch num">${f.t}</span><span class="hint" style="font-size:11px">${st.k==='land'?'сел':'посадка'}</span>`;
    html+=`<article class="flight">
      <div class="time">${timeCol}</div>
      <div class="mid">
        <div class="fl-head"><span class="fl-code">${esc([...f.codes].join(' / '))}</span><span class="fl-from">${esc(CITY[f.org]||f.org||'город вылета не указан')}</span>
        ${f.to==='GZP'?'<span class="chip gzp">Аэропорт Газипаша</span>':terms.map(t=>{const bad=t&&f.org&&t!==expected;return `<span class="chip term ${bad||!t?'bad':''}">${termLbl(t)}${bad?' ⚠':''}</span>`}).join('')}</div>
        ${gs.map(g=>{const mc=metCount(g);return `<div class="grp"><span class="h">${esc(g.h)} <span class="op">${esc(g.op)}</span>${mc?` <span class="met">встречено ${mc}/${g.p.length}</span>`:''}${g.note?` <span class="op">· ${esc(g.note)}</span>`:''}</span><span class="chip">${esc(g.v||'нет машины')}</span><span class="px">${g.pax} чел</span></div>`}).join('')}
      </div>
      <div class="side">
        <span class="status ${st.k}"><span class="dot"></span>${st.lbl}</span>
        ${st.p!=null?`<div class="prog" aria-hidden="true"><i style="width:${Math.round(st.p*100)}%"></i></div>`:''}
        ${vehs.map(v=>{const a=assign[v]||{};const g=(gs.find(x=>(x.v||'—')===v)||{}).g;return `<div class="veh">${esc(v)} · ${esc(a.plate||'номер не назначен')}<small>${esc(g||'гид не указан')}</small></div>`}).join('')}
      </div>
    </article>`;
  });
  if(!nowPlaced)html+=`<div class="nowline">СЕЙЧАС ${fmt(NOW)}</div>`;
  $('#board').innerHTML=html||'<p class="hint">Ничего не найдено.</p>';
  const totalPax=flights.reduce((s,f)=>s+f.pax,0);
  $('#sumBoard').innerHTML=[
    ['Прилёты',flights.length,`${totalPax} гостей из аэропорта`],
    ['Сели',land,`${paxLanded} гостей прилетело`],
    ['В воздухе',air+late,late?`${late} с задержкой`:'без задержек'],
    ['Встречено',paxMet,'отметки гидов'],
    ['Машин',new Set(DAY.arr.map(t=>t.v).filter(Boolean)).size,'на прилёты'],
    ['Без трансфера',DAY.self+DAY.h2h,`${DAY.self} сами · ${DAY.h2h} межотельные`]
  ].map(([k,v,s])=>`<div class="stat"><div class="k">${k}</div><div class="v num">${v}</div><div class="s">${s}</div></div>`).join('');
}

/* ---------- departures ---------- */
function renderDep(){
  const rows=DAY.dep.slice().sort((a,b)=>toMin(a.pu)-toMin(b.pu)||toMin(a.t)-toMin(b.t));
  $('#depTbl').innerHTML=`<thead><tr><th>Выезд</th><th>Отель</th><th class="n">Чел</th><th>Рейс</th><th>Вылет</th><th>Терминал</th><th>Машина</th><th>Гид</th><th>Опер.</th><th>Примечание</th></tr></thead><tbody>${rows.map(r=>{
    const pu=toMin(r.pu),cls=r.pu&&pu<NOW?'past':(r.pu&&pu-NOW<=60&&pu>=NOW?'soon':'');
    const a=assign[r.v]||{};const unk=/^[!?]/.test(r.fl);
    return `<tr class="${cls}"><td class="t num">${r.pu||'—'}</td><td>${esc(r.h)}</td><td class="n">${r.pax}</td><td class="mono">${unk?'<span class="chip bad">рейс не указан</span>':esc(r.fl)} <span class="hint">${esc(CITY[r.dest]||r.dest)}</span></td><td class="num">${r.t}</td><td><span class="chip term">${r.term==='İÇ'?'İÇ HATLAR':r.term==='DIŞ'?'T2':'?'}</span></td><td class="mono">${esc(r.v||'—')}${a.plate?'<br><span class="hint">'+esc(a.plate)+'</span>':''}</td><td>${esc(r.g||'—')}</td><td class="mono hint">${esc(r.op)}</td><td>${r.note?`<span class="chip">${esc(r.note)}</span>`:''}</td></tr>`}).join('')}</tbody>`;
  const tot=rows.reduce((s,r)=>s+r.pax,0),done=rows.filter(r=>r.pu&&toMin(r.pu)<NOW).reduce((s,r)=>s+r.pax,0);
  const next=rows.find(r=>r.pu&&toMin(r.pu)>=NOW);
  $('#sumDep').innerHTML=[
    ['Гостей на вылет',tot,'по трансферам из отелей'],
    ['Уже выехали',done,'из отелей'],
    ['Следующий выезд',next?next.pu:'—',next?next.h+' · '+next.v:'на сегодня всё'],
    ['Машин',new Set(rows.map(r=>r.v).filter(Boolean)).size,'на вылеты']
  ].map(([k,v,s])=>`<div class="stat"><div class="k">${k}</div><div class="v num">${v}</div><div class="s">${esc(s)}</div></div>`).join('');
}

/* ---------- vehicles ---------- */
function allVehicles(){
  const m=new Map();
  const add=(v,g,kind,leg)=>{if(!v)return;if(!m.has(v))m.set(v,{v,gs:new Set(),kinds:new Set(),legs:[]});const x=m.get(v);if(g)x.gs.add(g);x.kinds.add(kind);x.legs.push(leg)};
  DAY.arr.forEach(t=>add(t.v,t.g,'Прилёты',{t:t.t,pax:t.pax}));
  DAY.dep.forEach(r=>add(r.v,r.g,'Вылеты',{t:r.pu||r.t,pax:r.pax}));
  return [...m.values()].map(x=>({...x,kind:[...x.kinds].join(' + '),g:[...x.gs].join(', ')})).sort((a,b)=>a.kind.localeCompare(b.kind,'ru')||a.v.localeCompare(b.v,'tr',{numeric:true}));
}
function renderVeh(){
  const vs=allVehicles();
  $('#vgrid').innerHTML=vs.map(x=>{const a=assign[x.v]||{};const ts=x.legs.map(l=>toMin(l.t));const pax=x.legs.reduce((s,l)=>s+l.pax,0);const id=x.v.replace(/\W/g,'_');
    return `<div class="vcard"><div class="vh"><span class="vn">${esc(x.v)}</span><span class="vk">${x.kind} · ${pax} чел</span></div>
    <div class="vk">${esc(x.g||'гид не указан')} · ${fmt(Math.min(...ts))}–${fmt(Math.max(...ts))} · ${x.legs.length} заб.</div>
    <div class="vrow"><label>Номер<input id="pl_${id}" data-v="${esc(x.v)}" data-f="plate" value="${esc(a.plate||'')}" placeholder="07 ABC 123"></label>
    <label>Телефон водителя<input id="ph_${id}" data-v="${esc(x.v)}" data-f="phone" value="${esc(a.phone||'')}" placeholder="05xx xxx xx xx"></label></div>
    <label>Водитель<input id="dr_${id}" data-v="${esc(x.v)}" data-f="driver" value="${esc(a.driver||'')}" placeholder="Имя"></label></div>`}).join('');
  $('#vgrid').querySelectorAll('input').forEach(i=>i.addEventListener('input',e=>{const v=e.target.dataset.v,f=e.target.dataset.f;assign[v]=assign[v]||{};assign[v][f]=e.target.value;saveAssign();renderWa()}));
  renderWa();
}
function renderWa(){
  const vs=allVehicles();const line=x=>{const a=assign[x.v]||{};return `${x.v} - ${a.plate||'?'} - ${a.phone||'?'}${a.driver?' - '+a.driver:''}`};
  $('#waMsg').textContent=`*${dayKey}.26*\n\nARRİVAL\n`+vs.filter(x=>x.kind.includes('Прилёты')).map(line).join('\n')+'\n\nDEPARTURE\n'+vs.filter(x=>!x.kind.includes('Прилёты')).map(line).join('\n');
}

/* ---------- checks ---------- */
const gkey=n=>String(n||'').split(/\s+/)[0].normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[.\s]/g,'').replace(/Y/g,'V').replace(/S$/,'Z');
function runChecks(){
  const out=[];const A=DAY.arr,D=DAY.dep;
  // terminals
  flights.forEach(f=>{
    if(!f.org||f.to==='GZP')return;const exp=DOMESTIC.has(f.org)?'İÇ':'DIŞ';
    f.groups.filter(g=>g.term&&g.term!==exp).forEach(g=>out.push(['crit',`Неверный терминал на прилёт: ${g.fl} ${g.t}`,`Рейс из ${CITY[f.org]||f.org} прилетает в ${termLbl(exp)}, а для группы ${g.op} → ${g.h} (${g.pax} чел, ${g.v}) указан ${termLbl(g.term)}. Машина будет ждать не у того терминала.`]));
    if(f.codes.size>1)out.push(['warn',`Один рейс записан по-разному: ${[...f.codes].join(' и ')}`,`Одно время, один маршрут. Программа объединила их в одну встречу на ${f.pax} чел.`]);
  });
  D.forEach(r=>{if(!r.dest||!r.term)return;const exp=DOMESTIC.has(r.dest)?'İÇ':'DIŞ';if(r.term!==exp)out.push(['crit',`Неверный терминал на вылет: ${r.fl} ${r.t}`,`Рейс в ${CITY[r.dest]||r.dest} улетает из ${termLbl(exp)}, а для ${r.op} · ${r.h} (${r.pax} чел, выезд ${r.pu}, ${r.v}) указан ${termLbl(r.term)}.`])});
  // codeshare
  const by={};flights.forEach(f=>{if(f.unknown)return;const k=f.t+'|'+f.org+'|'+f.code.split(' ')[1];(by[k]=by[k]||[]).push(f)});
  Object.values(by).filter(a=>a.length>1).forEach(a=>out.push(['warn',`Скорее всего один самолёт: ${a.map(f=>f.code).join(' и ')}`,`Одинаковые номер, время ${a[0].t} и город вылета (${CITY[a[0].org]||a[0].org}). На табло будет один код. Всего ${a.reduce((s,f)=>s+f.pax,0)} чел.`]));
  // unknown flights with transport
  [...A.map(x=>({...x,dir:'прилёт',when:x.t})),...D.map(x=>({...x,dir:'вылет',when:x.pu||x.t}))].filter(x=>/^[!?]/.test(x.fl)&&x.v).forEach(x=>out.push(['warn',`Нет номера рейса: ${x.pax} чел, ${x.h}`,`${x.dir==='вылет'?'Выезд '+x.when:'Встреча '+x.when}, ${x.v}${x.g?', гид '+x.g:''}${x.note?'. Пометка: «'+x.note+'»':''}. Без номера рейса программа не сможет следить за задержкой.`]));
  // missing vehicle / guide
  [...A,...D].filter(x=>x.pax>0&&!x.v&&!/^[!?]/.test(x.fl)).forEach(x=>out.push(['crit',`Нет машины: ${x.fl} ${x.t}, ${x.pax} чел`,`${x.h} · ${x.op}. Трансфер стоит в списке, но машина не назначена.`]));
  [...A,...D].filter(x=>x.v&&!x.g&&x.v!=='VİTO').forEach(x=>out.push(['warn',`Нет гида: ${x.v}, ${x.fl} ${x.t}`,`${x.h}, ${x.pax} чел${x.pu?', выезд '+x.pu:''}. Некому получить уведомления.`]));
  // Gazipaşa
  A.filter(x=>x.to==='GZP').forEach(x=>out.push(['warn',`Прилёт в Газипашу, не в Анталью: ${x.fl} ${x.t}`,`${x.h}, ${x.pax} чел, ${x.v}, ${x.g}. Дорога другая и дольше. ${x.note?'Пометка: «'+x.note+'».':''}`]));
  // guide spelling variants
  const allG=[...new Set([...A,...D].map(x=>x.g).filter(Boolean))];
  const gk={};allG.forEach(g=>{(gk[gkey(g)]=gk[gkey(g)]||[]).push(g)});
  Object.values(gk).forEach(list=>{
    const full=list.filter(g=>/\s/.test(g)),short=list.filter(g=>!/\s/.test(g));
    if(full.length>1&&short.length)out.push(['warn',`Гид «${short.join('», «')}» не однозначен`,`Работают ${full.join(' и ')}. В части списка указано только имя, и уведомление может уйти не тому человеку.`]);
    else if(list.length>1&&full.length===0)out.push(['info',`Одно имя записано по-разному: ${list.join(', ')}`,`Скорее всего это один гид. Программа объединит записи, если вы подтвердите.`]);
  });
  // guide time conflicts: departure run vs arrival meeting
  const runs={};D.forEach(r=>{if(!r.g||!r.pu)return;const k=r.g+'|'+r.v;(runs[k]=runs[k]||[]).push(r)});
  Object.values(runs).forEach(rs=>{
    const g=rs[0].g,v=rs[0].v;const pus=rs.map(r=>toMin(r.pu));const last=rs.reduce((a,b)=>toMin(b.pu)>toMin(a.pu)?b:a);
    const start=Math.min(...pus),atAirport=toMin(last.pu)+TRAVEL(last.h);
    const meets=A.filter(a=>a.g&&gkey(a.g)===gkey(g)&&a.v!==v&&toMin(a.t)>start&&toMin(a.t)<atAirport-10);
    if(meets.length){const who=[...new Set(meets.map(m=>m.g))].join(' / ');out.push(['warn',`${g}: забор и встреча одновременно`,`На ${v} забирает гостей ${fmt(start)}–${last.pu} и будет в аэропорту около ${fmt(atAirport)}. В это же время ${who} должен встречать ${[...new Set(meets.map(m=>normFl(m.fl)+' в '+m.t))].join(', ')}.`])}
  });
  // pickup gaps
  D.forEach(r=>{if(!r.pu||/^[!?]/.test(r.fl))return;let gap=toMin(r.t)-toMin(r.pu);if(gap<0)gap+=1440;const need=TRAVEL(r.h)+(r.term==='İÇ'?60:110);
    if(gap<need)out.push(['crit',`Поздний выезд: ${r.fl} ${r.t}`,`Выезд из ${r.h} в ${r.pu}, до вылета ${Math.floor(gap/60)} ч ${gap%60} мин. На дорогу и регистрацию нужно около ${Math.floor(need/60)} ч ${need%60} мин.`]);
    else if(gap>420)out.push(['info',`Очень ранний выезд: ${r.fl} ${r.t}`,`Выезд из ${r.h} в ${r.pu}, за ${Math.floor(gap/60)} ч ${gap%60} мин до вылета (${r.pax} чел, ${r.v}). Возможно, так собрана общая машина.`])});
  // free-text notes
  const notes=[...A,...D].filter(x=>x.note&&!/^[!?]/.test(x.fl)&&x.to!=='GZP');
  if(notes.length)out.push(['info','Пометки диспетчера в списке',notes.map(x=>`${x.fl} ${x.t}: «${x.note}»`).join(' · ')]);
  if(DAY.self)out.push(['info',`${DAY.self} гостей едут сами`,'Записи с пометкой «Kendi gider». Машина и гид не нужны.']);
  if(DAY.h2h)out.push(['info',`Межотельные трансферы: ${DAY.h2h} чел`,'Переезды «отель → отель» без рейса. Для них нужно назначить машины и время отдельно.']);
  let sal=0;A.forEach(t=>t.p.forEach(p=>{const s=p[1].split(' ')[0];if(p[0]==='Mrs'&&/(OV|EV|IN)$/.test(s))sal++}));
  if(sal)out.push(['info',`Обращение не совпадает с фамилией: ${sal} гостей`,'Например «Mrs MAMAEV KUBANYCHBEK». На табличке встречи это выглядит неаккуратно.']);
  out.push(...DAY.extra);
  const order={crit:0,warn:1,info:2};out.sort((a,b)=>order[a[0]]-order[b[0]]);
  const lbl={crit:'Срочно',warn:'Проверить',info:'К сведению'};
  $('#checks').innerHTML=out.map(([s,t,d])=>`<div class="chk ${s}"><div class="bar"></div><div class="body"><span class="sev">${lbl[s]}</span><span class="ttl">${esc(t)}</span><span class="det">${esc(d)}</span></div></div>`).join('');
  $('#chkCnt').textContent=out.filter(o=>o[0]!=='info').length;
  const r=DAY.recon;
  $('#reconLbl').className='recon'+(r&&r.bad.length?' bad':'');
  $('#reconLbl').innerHTML=r?`Сверка с итогами файла: <b>${r.ok} из ${r.total}</b> рейсов сходятся по количеству гостей${r.bad.length?' · не сходятся: '+r.bad.map(b=>esc(b.fl)+' ('+b.got+' из '+b.expected+')').join(', '):''}`:'Источник: PDF-списки, сверка по итогам не проводилась.';
}

/* ---------- guide chat ---------- */
let curGuide=null;
const guides=()=>[...new Set([...DAY.arr,...DAY.dep].map(x=>x.g).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));
function renderGuidePick(){
  const gl=guides();if(!curGuide||!gl.includes(curGuide))curGuide=gl[0];
  $('#guidePick').innerHTML=gl.map(g=>`<button type="button" aria-pressed="${g===curGuide}" data-g="${esc(g)}">${esc(g)}</button>`).join('');
  $('#guidePick').querySelectorAll('button').forEach(b=>b.onclick=()=>{curGuide=b.dataset.g;renderGuidePick();renderChat()});
}
function renderChat(){
  const g=curGuide;if(!g){$('#chat').innerHTML='';return}
  const mineA=DAY.arr.filter(t=>t.g===g).sort((a,b)=>toMin(a.t)-toMin(b.t));
  const mineD=DAY.dep.filter(t=>t.g===g).sort((a,b)=>toMin(a.pu)-toMin(b.pu));
  $('#gName').textContent=g;$('#gAv').textContent=g[0];
  const vehs=[...new Set([...mineD,...mineA].map(t=>t.v).filter(Boolean))];
  $('#gSub').textContent='Sarabi Operasyon · '+vehs.join(', ');
  const msgs=[];
  const firsts=[...mineA.map(t=>toMin(t.t)-120),...mineD.map(t=>toMin(t.pu)-90)];
  const planAt=Math.max(0,Math.min(420,...firsts));
  if(NOW>=planAt){
    const lines=[...mineD.map(t=>({m:toMin(t.pu),s:`${t.pu} · <b>${esc(t.h)}</b> → ${esc(t.fl)} ${t.t}`})),...[...new Map(mineA.map(t=>[normFl(t.fl)+t.t,t])).values()].map(t=>({m:toMin(t.t),s:`${t.t} · karşılama <b>${esc(normFl(t.fl))}</b> · ${termTr(t.term)}`}))].sort((a,b)=>a.m-b.m);
    msgs.push({at:planAt,html:`<b>Bugünkü planın · ${dayKey}</b><br>Araç: <b>${esc(vehs.join(', '))}</b>${vehs.map(v=>assign[v]&&assign[v].plate?'<br>'+esc(v)+': '+esc(assign[v].plate)+(assign[v].phone?' · şoför '+esc(assign[v].phone):''):'').join('')}<br><br>${lines.map(l=>l.s).join('<br>')}<br><br>Toplam ${[...mineA,...mineD].reduce((s,t)=>s+t.pax,0)} misafir. İyi çalışmalar!`});
  }
  // departure runs
  const runs={};mineD.forEach(r=>{(runs[r.v]=runs[r.v]||[]).push(r)});
  Object.entries(runs).forEach(([v,rs])=>{const at=toMin(rs[0].pu)-60;if(NOW<at)return;
    msgs.push({at,html:`<b>Alım · ${esc(v)}</b><br>${rs.map(r=>`${r.pu} · ${esc(r.h)} · ${r.pax} kişi<br><span style="color:var(--muted)">→ ${/^[!?]/.test(r.fl)?'uçuş belirsiz':esc(r.fl)} ${r.t} · ${termTr(r.term)}${r.note?' · '+esc(r.note):''}</span>`).join('<br>')}`});
  });
  // arrivals
  const byFl=new Map();mineA.forEach(t=>{const k=normFl(t.fl)+'|'+t.t;if(!byFl.has(k))byFl.set(k,[]);byFl.get(k).push(t)});
  byFl.forEach((gs,k)=>{
    const f=flights.find(x=>x.key===k);if(!f)return;
    const cardAt=f.sched-90;
    if(NOW>=cardAt)msgs.push({at:cardAt,html:`<span class="fl">${esc([...f.codes].join(' / '))}</span> · ${esc(CITY_TR[f.org]||f.org||'')}<br>İniş: <b>${f.t}</b> · ${f.to==='GZP'?'<b>GAZİPAŞA havalimanı</b>':termTr(gs[0].term)}<br>${gs.map(t=>`<br><b>${esc(t.h)}</b> · ${t.pax} kişi · ${esc(t.op)}${t.p.length?`<ul class="plist">${t.p.map((p,i)=>{const on=!!(met[t.id]&&met[t.id][i]);return `<li><button type="button" aria-pressed="${on}" aria-label="Karşılandı" data-tid="${t.id}" data-i="${i}">${on?'✓':''}</button><span>${esc(p[0])} ${esc(p[1])}</span><span class="age">${p[2]||''}</span></li>`}).join('')}</ul>`:`<br><span style="color:var(--muted)">İsim listesi genel listeden gelecek</span>`}`).join('')}<div class="qr"><button type="button" data-all="${gs.map(t=>t.id).join(',')}">Hepsini karşıladım</button><button type="button" data-miss="${esc(f.code)}">Eksik misafir var</button></div>`});
    if(f.delay&&NOW>=f.delayKnownAt&&f.delayKnownAt<f.eta)msgs.push({at:f.delayKnownAt,cls:'alert',html:`<b>Rötar: ${esc(f.code)}</b><br>Yeni tahmini iniş: <b>${fmt(f.eta)}</b> (+${f.delay} dk).<br>Şoföre de bildirildi.`});
    if(!f.unknown&&NOW>=f.eta)msgs.push({at:f.eta,cls:'land',html:`<b>${esc(f.code)} indi</b> · ${fmt(f.eta)}<br>${termTr(gs[0].term)} çıkışında bekleyin. Misafirler ~25 dk içinde çıkar.`});
  });
  msgs.sort((x,y)=>x.at-y.at);
  const chat=$('#chat');
  chat.innerHTML=`<div class="daysep">${dayKey}.2026</div>`+(msgs.length?msgs.map(m=>`<div class="bub ${m.cls||''}">${m.html}<span class="tm">${fmt(m.at)}</span></div>`).join(''):`<div class="daysep">Henüz mesaj yok · ilk mesaj ${fmt(planAt)}</div>`);
  chat.scrollTop=chat.scrollHeight;
  chat.querySelectorAll('.plist button').forEach(b=>b.onclick=()=>{const t=b.dataset.tid,i=b.dataset.i;met[t]=met[t]||{};met[t][i]=!met[t][i];saveMet();renderChat();renderBoard()});
  chat.querySelectorAll('[data-all]').forEach(b=>b.onclick=()=>{b.dataset.all.split(',').forEach(id=>{const t=DAY.arr.find(x=>x.id===id);met[id]={};const n=t.p.length||t.pax;for(let i=0;i<n;i++)met[id][i]=true});saveMet();renderChat();renderBoard();toast('Отметка ушла диспетчеру')});
  chat.querySelectorAll('[data-miss]').forEach(b=>b.onclick=()=>toast('Диспетчер получил: не все гости на '+b.dataset.miss));
}

/* ---------- contacts & log ---------- */
function renderContacts(){
  if(!contacts)contacts=[...guides().map(g=>({name:g,role:'Гид',phone:'',on:true})),{name:'Операционный отдел',role:'Операционщик',phone:'',on:true},{name:'Владелец',role:'Только срочное',phone:'',on:true}];
  $('#ctable').innerHTML=`<thead><tr><th>Кто</th><th>Роль</th><th>Телефон</th><th>Уведомлять</th></tr></thead><tbody>${contacts.map((c,i)=>`<tr><td>${esc(c.name)}</td><td class="hint">${esc(c.role)}</td><td><input id="cp_${i}" data-i="${i}" value="${esc(c.phone)}" placeholder="+90 5xx xxx xx xx"></td><td><input type="checkbox" id="cn_${i}" data-i="${i}" ${c.on?'checked':''} style="width:auto;min-width:0" aria-label="Уведомлять"></td></tr>`).join('')}</tbody>`;
  $('#ctable').querySelectorAll('input').forEach(inp=>inp.addEventListener('input',e=>{const c=contacts[e.target.dataset.i];if(e.target.type==='checkbox')c.on=e.target.checked;else c.phone=e.target.value;store.set('contacts_'+dayKey,contacts);renderLog()}));
  renderLog();
}
function renderLog(){
  const ev=[];const ph=n=>{const c=(contacts||[]).find(x=>x.name===n);return c&&c.phone?c.phone:'номер не указан'};
  flights.forEach(f=>{
    const gs=[...new Set(f.groups.map(g=>g.g).filter(Boolean))],vs=[...new Set(f.groups.map(g=>g.v).filter(Boolean))];
    if(f.delay&&f.delayKnownAt<=NOW&&f.delayKnownAt<f.eta){
      gs.forEach(g=>ev.push([f.delayKnownAt,`${f.code}: задержка +${f.delay} мин, новая посадка ${fmt(f.eta)}`,`Гид ${g} · ${ph(g)}`]));
      vs.forEach(v=>{const a=assign[v]||{};ev.push([f.delayKnownAt,`${f.code}: выезд в аэропорт сдвинуть на ${f.delay} мин`,`Водитель ${v} · ${a.phone||'номер не указан'}`])});
      if(f.delay>=40)ev.push([f.delayKnownAt,`${f.code}: большая задержка, ${f.pax} гостей ждут встречи позже`,`Операционный отдел · ${ph('Операционный отдел')}`]);
    }
    if(!f.unknown&&f.eta<=NOW)gs.forEach(g=>ev.push([f.eta,`${f.code} приземлился, ${f.pax} гостей`,`Гид ${g} · ${ph(g)}`]));
  });
  DAY.dep.forEach(r=>{if(r.pu&&r.g&&toMin(r.pu)-60<=NOW)ev.push([toMin(r.pu)-60,`Через час выезд: ${r.h}, ${r.pax} чел → ${r.fl} ${r.t}`,`Гид ${r.g} · ${ph(r.g)}`])});
  ev.sort((a,b)=>b[0]-a[0]);
  $('#log').innerHTML=ev.length?ev.slice(0,50).map(e=>`<div class="e"><span class="t num">${fmt(e[0])}</span><div><div>${esc(e[1])}</div><div class="to">${esc(e[2])}</div></div></div>`).join(''):'<p class="hint">К этому времени уведомлений ещё не было. Сдвиньте время вперёд.</p>';
}

/* ---------- excel import ---------- */
async function importFile(file){
  const msg=$('#xlsMsg');msg.innerHTML='Читаю файл…';
  try{
    if(typeof XLSX==='undefined')throw new Error('Библиотека Excel не загрузилась, обновите страницу.');
    const wb=XLSX.read(new Uint8Array(await file.arrayBuffer()),{type:'array'});
    let rows=[];wb.SheetNames.forEach(n=>rows=rows.concat(XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:false})));
    const flat=rows.slice(0,40).map(r=>(r||[]).join(' ')).join(' ');
    const dm=flat.match(/Tarih\s*:\s*(\d\d)\/(\d\d)\/(\d{4})/)||file.name.match(/(\d\d)[._](\d\d)[._](\d{4})/);
    const key=dm?dm[1]+'.'+dm[2]:file.name.replace(/\.\w+$/,'').slice(0,10);
    const months=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
    const title=dm?`${+dm[1]} ${months[+dm[2]-1]} ${dm[3]}`:key;
    const K=parseKapak(rows);
    const ok=K.recon.filter(c=>c.expected===c.got).length;
    const pack={recs:K.recs,recon:{ok,total:K.recon.length,bad:K.recon.filter(c=>c.expected!==c.got)}};
    const d=dayFromKapak(pack,key,title);
    if(!d.arr.length&&!d.dep.length)throw new Error('В файле не найдено ни одного рейса.');
    d.iso=dm?`${dm[3]}-${dm[2]}-${dm[1]}`:'';
    DAYS[key]=d;
    let srv=null;if(SERVER){srv=await api('PUT','/api/day?d='+encodeURIComponent(key),d);refreshLive()}else{const imp=store.get('imported',{});imp[key]=d;store.set('imported',imp)}
    loadDay(key);
    msg.innerHTML=`<b>День ${esc(key)} загружен.</b><span>${d.arr.length} групп на прилёт, ${d.dep.length} на вылет, ${d.self} гостей едут сами, ${d.h2h} межотельных.</span>${srv?`<span>Программа следит за ${srv.watched} рейсами из этого Капака${srv.poll&&srv.poll.ok?`, первые данные уже получены (${srv.poll.found})`:''}.</span>`:''}<span>Сверка с итогами файла: ${ok} из ${K.recon.length} рейсов сходятся.${pack.recon.bad.length?' Не сходятся: '+pack.recon.bad.map(b=>esc(b.fl)).join(', ')+'.':''}</span>`;
  }catch(err){msg.innerHTML='<span>Не удалось прочитать файл: '+esc(err.message)+'</span>'}
}
$('#xls').addEventListener('change',e=>{if(e.target.files[0])importFile(e.target.files[0])});
const drop=$('#drop');
['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over')}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over')}));
drop.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)importFile(f)});

/* ---------- wiring ---------- */
function renderAll(){if(!DAY)return;$('#nowLbl').textContent=fmt(NOW);$('#slider').value=NOW;renderBoard();renderDep();renderGuidePick();renderChat();renderLog()}
$('#slider').addEventListener('input',e=>{followNow=false;NOW=+e.target.value;store.set('now_'+dayKey,NOW);renderAll()});
let play=null;
$('#playBtn').onclick=()=>{if(play){clearInterval(play);play=null;$('#playBtn').textContent='▶ Проиграть день';return}
  $('#playBtn').textContent='❚❚ Пауза';play=setInterval(()=>{NOW+=5;if(NOW>1440)NOW=0;renderAll()},350)};
setInterval(()=>{if(followNow&&DAY&&!play){NOW=nowMinutes();renderAll()}},60000);
$('#nowBtn').onclick=()=>{followNow=true;NOW=nowMinutes();store.set('now_'+dayKey,NOW);renderAll()};
['#fVeh','#fHotel','#fOp'].forEach(s=>$(s).addEventListener('change',()=>DAY&&renderBoard()));$('#fQ').addEventListener('input',()=>DAY&&renderBoard());
$('#copyWa').onclick=()=>copy($('#waMsg').textContent);
const views=['board','dep','veh','guide','checks','contacts','data'];
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('.tab');if(!b)return;
  document.querySelectorAll('.tab').forEach(t=>t.setAttribute('aria-selected',t===b));
  views.forEach(v=>$('#v-'+v).hidden=v!==b.dataset.t);store.set('tab',b.dataset.t)});
if(SERVER)serverBoot();else loadDay(dayKey);
const lastTab=store.get('tab','board');const tb=document.querySelector(`.tab[data-t="${lastTab}"]`);if(tb)tb.click();
