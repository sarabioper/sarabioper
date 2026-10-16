
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
function saveMet(){lastLocalMark=Date.now();store.set('met_'+dayKey,met);saveRemote('met',met)}
function showLogin(err){$('#login').hidden=false;$('#loginErr').textContent=err||'';$('#loginPass').focus()}
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();store.set('pass',$('#loginPass').value.trim());$('#login').hidden=true;await serverBoot()});
async function serverBoot(){
  if(!pass()){showLogin();return}
  try{
    const res=await api('GET','/api/days');
    res.days.forEach(d=>{DAYS[d.key]=d});
    try{const gp=await api('GET','/api/state?d=00.00&kind=guides');GP=Object.assign({},GP,gp.data||{});store.set('guidePhones',GP)}catch(e){}
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
let GP=store.get('guidePhones',{});
function saveGP(){store.set('guidePhones',GP);if(SERVER)api('PUT','/api/state?d=00.00&kind=guides',GP).catch(()=>{})}
const gPhone=n=>GP[n]||'';

function loadDay(k){
  if(!k||!DAYS[k]){DAY=null;$('#dateLbl').textContent='Операционный центр · день ещё не загружен';$('#daySel').innerHTML='';$('#board').innerHTML='<p class="hint">Пока нет ни одного дня. Откройте вкладку «Загрузить день» и перетащите Excel KAPAK.</p>';const tb=document.querySelector('.tab[data-t=data]');if(tb)tb.click();renderDayStatus();return}
  dayKey=k;DAY=DAYS[k];store.set('day',k);
  assign=store.get('assign_'+k,k==='15.10'?{"BUS 10":{plate:"35 CVL 346",phone:"0553 573 61 69",driver:""},"BUS 12":{plate:"07 CJD 855",phone:"0554 407 82 82",driver:""},"BUS 13":{plate:"07 GLE 03",phone:"0552 169 14 75",driver:""},"BUS 6":{plate:"07 BJH 898",phone:"0533 680 38 05",driver:""},"MİNİ 4":{plate:"34 BK 1708",phone:"0532 515 44 65",driver:""},"MİNİ 10":{plate:"19 TT 077",phone:"0532 177 87 57",driver:""}}:{});
  met=store.get('met_'+k,{});contacts=store.get('contacts_'+k,null);SENT=store.get('sent_'+k,{});SENTD=store.get('sentd_'+k,{});
  if(DAY.assign)assign=Object.assign({},assign,DAY.assign);if(DAY.met)met=Object.assign({},met,DAY.met);
  NOW=SERVER?nowMinutes():store.get('now_'+k,k==='15.10'?nowMinutes():540);followNow=SERVER;
  buildFlights();fillFilters();
  $('#dateLbl').textContent='Операционный центр · '+DAY.title+' · '+DAY.source;
  renderDaySel();renderVeh();runChecks();renderContacts();renderAll();renderDayStatus();
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
const metCount=g=>marked(g);
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
        ${gs.map(g=>{const mc=metCount(g);return `<div class="grp"><span class="h">${esc(g.h)} <span class="op">${esc(g.op)}</span>${mc?` <span class="met">вышли ${mc}/${groupTotal(g)}</span>`:''}${g.note?` <span class="op">· ${esc(g.note)}</span>`:''}</span><span class="chip">${esc(g.v||'нет машины')}</span><span class="px">${g.pax} чел</span></div>`}).join('')}
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
  $('#depTbl').innerHTML=`<thead><tr><th>Выезд</th><th>Отель</th><th class="n">Чел</th><th>Рейс</th><th>Вылет</th><th>Терминал</th><th>Машина</th><th>Гид</th><th>Опер.</th><th>Сели</th><th>Примечание</th></tr></thead><tbody>${rows.map(r=>{
    const pu=toMin(r.pu),cls=r.pu&&pu<NOW?'past':(r.pu&&pu-NOW<=60&&pu>=NOW?'soon':'');
    const a=assign[r.v]||{};const unk=/^[!?]/.test(r.fl);
    return `<tr class="${cls}"><td class="t num">${r.pu||'—'}</td><td>${esc(r.h)}</td><td class="n">${r.pax}</td><td class="mono">${unk?'<span class="chip bad">рейс не указан</span>':esc(r.fl)} <span class="hint">${esc(CITY[r.dest]||r.dest)}</span></td><td class="num">${r.t}</td><td><span class="chip term">${r.term==='İÇ'?'İÇ HATLAR':r.term==='DIŞ'?'T2':'?'}</span></td><td class="mono">${esc(r.v||'—')}${a.plate?'<br><span class="hint">'+esc(a.plate)+'</span>':''}</td><td>${esc(r.g||'—')}</td><td class="mono hint">${esc(r.op)}</td><td class="num">${marked(r)?`<span class="met">${marked(r)}/${groupTotal(r)}</span>`:'—'}</td><td>${r.note?`<span class="chip">${esc(r.note)}</span>`:''}</td></tr>`}).join('')}</tbody>`;
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
const CAP=v=>/^BUS/.test(v)?46:/^MİDİ/.test(v)?27:/^VİTO/.test(v)?7:16;
const capOf=v=>+((assign[v]||{}).cap)||CAP(v);
const flightOfGroup=g=>flights.find(f=>f.groups.includes(g));
// Each vehicle's legs: arrival = meet at airport then drive to hotel; departure = pick up at hotel then drive to AYT.
function vehicleLegs(){
  const m=new Map();
  const add=(v,leg)=>{if(!v)return;if(!m.has(v))m.set(v,{v,legs:[],gs:new Set()});const x=m.get(v);x.legs.push(leg);if(leg.g)x.gs.add(leg.g)};
  DAY.arr.forEach(g=>{const f=flightOfGroup(g);const eta=f?f.eta:toMin(g.t);
    add(g.v,{kind:'arr',start:eta-20,meet:eta,end:eta+45+TRAVEL(g.h),t:fmt(eta),sch:g.t,late:f&&f.delay>=15?f.delay:0,fl:g.fl,h:g.h,pax:+g.pax||0,g:g.g,term:g.term,org:g.org,to:g.to,op:g.op,gid:g.id,st:f?fStatus(f,NOW):null})});
  DAY.dep.forEach(r=>{const pu=toMin(r.pu||r.t);
    add(r.v,{kind:'dep',start:pu,meet:pu,end:pu+TRAVEL(r.h)+15,t:r.pu||r.t,fl:r.fl,ft:r.t,h:r.h,pax:+r.pax||0,g:r.g,term:r.term,dest:r.dest,op:r.op,note:r.note,gid:r.id})});
  return [...m.values()].map(x=>{
    x.legs.sort((a,b)=>a.start-b.start);
    // legs that overlap in time ride together: one trip
    const trips=[];x.legs.forEach(l=>{const t=trips[trips.length-1];if(t&&l.start<=t.end&&l.kind===t.kind){t.legs.push(l);t.end=Math.max(t.end,l.end);t.pax+=l.pax}else trips.push({kind:l.kind,start:l.start,end:l.end,pax:l.pax,legs:[l]})});
    x.trips=trips;x.cap=capOf(x.v);x.pax=x.legs.reduce((s,l)=>s+l.pax,0);
    x.over=trips.filter(t=>t.pax>x.cap);
    trips.forEach(t=>{t.over=t.pax>x.cap;t.legs.forEach(l=>l.over=t.over)});
    x.kind=[...new Set(x.legs.map(l=>l.kind))];
    return x;
  }).sort((a,b)=>a.legs[0].start-b.legs[0].start);
}
function vehNow(x){
  const cur=x.legs.find(l=>NOW>=l.start&&NOW<l.end);
  if(cur){if(cur.kind==='arr')return {busy:true,txt:NOW<cur.meet?`Ждёт ${normFl(cur.fl)} в ${cur.t}${cur.late?' (+'+cur.late+')':''}`:`Везёт ${cur.pax} чел в ${cur.h}`};
    return {busy:true,txt:NOW<cur.start+15?`Забор: ${cur.h}, ${cur.pax} чел`:`Едет в аэропорт к ${normFl(cur.fl)} ${cur.ft}`}}
  const next=x.legs.find(l=>l.start>=NOW);
  if(next)return {busy:false,txt:`Свободна до ${fmt(next.start)}`};
  return {busy:false,done:true,txt:'Работа на сегодня закончена'};
}
const legPlace=l=>l.kind==='arr'?`${/^[!?]/.test(l.fl)?'рейс не указан':normFl(l.fl)} · ${CITY[l.org]||l.org||''} → ${l.h}`:`${l.h} → ${/^[!?]/.test(l.fl)?'рейс не указан':normFl(l.fl)} ${l.ft}`;
function renderVeh(){
  if(!DAY)return;
  const vs=vehicleLegs();
  // summary
  const noPlate=vs.filter(x=>!(assign[x.v]||{}).plate).length;
  const busy=vs.filter(x=>vehNow(x).busy).length;
  $('#sumVeh').innerHTML=[['Машин',vs.length,`${vs.filter(x=>x.kind.includes('arr')).length} на прилёт · ${vs.filter(x=>x.kind.includes('dep')).length} на вылет`],['Сейчас в работе',busy,'по расписанию Капака'],['Без номера',noPlate,noPlate?'нужно назначить':'все назначены'],['Перегруз',vs.reduce((s,x)=>s+x.over.length,0),'поездок больше мест']].map(([k,v,s])=>`<div class="stat"><div class="k">${k}</div><div class="v num">${v}</div><div class="s">${s}</div></div>`).join('');
  // gantt
  const lo=Math.floor(Math.min(...vs.map(x=>x.legs[0].start))/60)*60,hi=Math.ceil(Math.max(...vs.map(x=>Math.max(...x.legs.map(l=>l.end))))/60)*60;
  const pos=t=>((t-lo)/(hi-lo)*100).toFixed(2)+'%';const w=(a,b)=>((b-a)/(hi-lo)*100).toFixed(2)+'%';
  let ticks='';for(let h=lo;h<=hi;h+=60)if((h-lo)%120===0)ticks+=`<span style="left:${pos(h)}">${fmt(h)}</span>`;
  $('#gantt').innerHTML=`<div class="g-ticks"><div></div><div class="t">${ticks}</div></div>`+vs.map(x=>{const a=assign[x.v]||{};
    return `<div class="g-row"><div class="g-lbl" data-jump="${esc(x.v)}">${esc(x.v)}<small>${esc(a.plate||'без номера')}</small></div><div class="g-track">${x.legs.map(l=>`<div class="g-blk ${l.kind}${l.over?' over':''}${l.end<NOW?' past':''}" style="left:${pos(l.start)};width:${w(l.start,l.end)}" title="${esc(fmt(l.start)+' '+legPlace(l)+' · '+l.pax+' чел')}">${esc(l.t)} ${l.pax}</div>`).join('')}${NOW>=lo&&NOW<=hi?`<div class="g-now" style="left:${pos(NOW)}"></div>`:''}</div></div>`}).join('');
  {const gw=$('.gantt-wrap');if(gw&&gw.scrollWidth>gw.clientWidth&&NOW>=lo&&NOW<=hi)gw.scrollLeft=Math.max(0,(NOW-lo)/(hi-lo)*($('#gantt').scrollWidth-92)-gw.clientWidth/3)}
  $('#gantt').querySelectorAll('[data-jump]').forEach(el=>el.onclick=()=>{const c=document.getElementById('veh_'+el.dataset.jump.replace(/\W/g,'_'));if(c)c.scrollIntoView({behavior:'smooth'})});
  // cards
  const active=document.activeElement&&document.activeElement.closest&&document.activeElement.closest('#vgrid')?document.activeElement.id:null;
  $('#vgrid').innerHTML=vs.map(x=>{const a=assign[x.v]||{};const id=x.v.replace(/\W/g,'_');const st=vehNow(x);
    const warn=[];if(!a.plate)warn.push('<span class="chip bad">номер не назначен</span>');if(!a.phone)warn.push('<span class="chip">нет телефона водителя</span>');
    if(DAY.aracTotals&&DAY.aracTotals[x.v]!=null){const n=x.legs.filter(l=>l.kind==='arr').reduce((s,l)=>{const g=DAY.arr.find(a=>a.id===l.gid);return s+(g&&g.p&&g.p.length?g.p.filter(p=>p[0]!=='Inf').length:l.pax)},0);warn.push(n===DAY.aracTotals[x.v]?`<span class="chip ok">Araç Listesi: ${n} чел ✓</span>`:`<span class="chip bad">Araç Listesi: ${DAY.aracTotals[x.v]} чел, в программе ${n}</span>`)}
    x.over.forEach(t=>warn.push(`<span class="chip bad">перегруз ${fmt(t.start)}: ${t.pax} чел при ${x.cap} местах</span>`));
    x.legs.filter(l=>l.late).forEach(l=>warn.push(`<span class="chip gzp">${esc(normFl(l.fl))} задерживается на ${l.late} мин</span>`));
    const rows=x.trips.map((t,ti)=>(x.trips.length>1?`<tr class="trip"><td colspan="4">Поездка ${ti+1} · ${t.kind==='arr'?'из аэропорта':'в аэропорт'} · ${t.pax} из ${x.cap} мест</td></tr>`:'')+t.legs.map(l=>`<tr class="${l.end<NOW?'past':''}"><td class="tm num">${esc(l.t)}</td><td><span class="act ${l.kind}">${l.kind==='arr'?'Встреча':'Забор'}</span><br>${esc(legPlace(l))}${l.note?` <span class="hint">· ${esc(l.note)}</span>`:''}</td><td>${l.kind==='arr'?termLbl(l.term):'вылет '+esc(l.ft)}<br><span class="hint">${esc(l.op||'')}${l.g&&x.gs.size>1?' · '+esc(l.g):''}</span></td><td class="n num">${l.pax}</td></tr>`).join('')).join('');
    return `<article class="vcard2" id="veh_${id}"><div class="vtop"><div><div class="vn">${esc(x.v)}</div><div class="hint">${esc([...x.gs].join(', ')||'гид не указан')} · ${x.legs.length} заб. · ${x.pax} чел</div></div><span class="vnow ${st.busy?'busy':''} ${st.done?'done':''}">${esc(st.txt)}</span></div>
    <div class="vfields"><label>Номер<input id="pl_${id}" data-v="${esc(x.v)}" data-f="plate" value="${esc(a.plate||'')}" placeholder="07 ABC 123"></label><label>Телефон водителя<input id="ph_${id}" data-v="${esc(x.v)}" data-f="phone" value="${esc(a.phone||'')}" placeholder="05xx xxx xx xx" inputmode="tel"></label><label>Водитель<input id="dr_${id}" data-v="${esc(x.v)}" data-f="driver" value="${esc(a.driver||'')}" placeholder="Имя"></label><label>Мест<input id="cp_${id}" data-v="${esc(x.v)}" data-f="cap" value="${esc(a.cap||'')}" placeholder="${CAP(x.v)}" inputmode="numeric"></label></div>
    ${warn.length?`<div class="vwarn">${warn.join('')}</div>`:''}
    <div style="overflow-x:auto"><table class="legs">${rows}</table></div>
    <div class="vfoot"><button class="btn" type="button" data-drv="${esc(x.v)}">Скопировать задание водителю</button></div></article>`}).join('');
  $('#vgrid').querySelectorAll('input').forEach(i=>i.addEventListener('change',e=>{const v=e.target.dataset.v,f=e.target.dataset.f;assign[v]=assign[v]||{};assign[v][f]=e.target.value.trim();saveAssign();renderVeh();renderBoard()}));
  $('#vgrid').querySelectorAll('input').forEach(i=>i.addEventListener('input',e=>{const v=e.target.dataset.v,f=e.target.dataset.f;assign[v]=assign[v]||{};assign[v][f]=e.target.value;renderWa()}));
  $('#vgrid').querySelectorAll('[data-drv]').forEach(b=>b.onclick=()=>copy(driverText(vs.find(x=>x.v===b.dataset.drv))));
  if(active){const el=document.getElementById(active);if(el)el.focus()}
  renderWa();
}
function driverText(x){
  const a=assign[x.v]||{};
  const lines=x.legs.map(l=>l.kind==='arr'
    ?`${l.t} KARŞILAMA ${/^[!?]/.test(l.fl)?'uçuş belirsiz':normFl(l.fl)}${l.org?' ('+(CITY_TR[l.org]||l.org)+')':''} · ${termTr(l.term)} → ${l.h} · ${l.pax} kişi`
    :`${l.t} ALIM ${l.h} · ${l.pax} kişi → ${/^[!?]/.test(l.fl)?'uçuş belirsiz':normFl(l.fl)} ${l.ft} · ${termTr(l.term)}`);
  return `*${x.v} · ${dayKey}*\n${a.plate?'Plaka: '+a.plate+'\n':''}Rehber: ${[...x.gs].join(', ')||'-'}\n\n${lines.join('\n')}\n\nToplam ${x.pax} kişi`;
}
function renderWa(){
  if(!DAY)return;
  const vs=vehicleLegs();const withG=$('#waGuide').checked,withT=$('#waTime').checked,withEmpty=$('#waEmpty').checked;
  const line=x=>{const a=assign[x.v]||{};if(!withEmpty&&!a.plate)return null;return [x.v,a.plate||'?',a.phone||'?',a.driver,withG?[...x.gs].join('/'):'',withT?fmt(x.legs[0].start):''].filter(Boolean).join(' - ')};
  const arr=vs.filter(x=>x.kind.includes('arr')).map(line).filter(Boolean),dep=vs.filter(x=>!x.kind.includes('arr')).map(line).filter(Boolean);
  $('#waMsg').textContent=`*${dayKey}.26*\n\nARRİVAL\n${arr.join('\n')}\n\nDEPARTURE\n${dep.join('\n')}`;
}
['#waGuide','#waTime','#waEmpty'].forEach(s=>$(s).addEventListener('change',renderWa));


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

/* ---------- guide screen ---------- */
// marks: met[groupId][i] = 'out' | 'no' | null ; met[groupId].n = counter when the group has no names
let curGuide=store.get('guide',null);
const guides=()=>[...new Set([...DAY.arr,...DAY.dep].map(x=>x.g).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));
const markOf=(gid,i)=>{const v=(met[gid]||{})[i];return v===true?'out':v||null};
function marked(g){const m=met[g.id]||{};if(g.p&&g.p.length)return g.p.reduce((s,_,i)=>s+(markOf(g.id,i)==='out'?1:0),0);return Math.min(+m.n||0,+g.pax||0)}
function groupTotal(g){return g.p&&g.p.length?g.p.length:(+g.pax||0)}
function resolved(g){if(g.p&&g.p.length)return g.p.reduce((s,_,i)=>s+(markOf(g.id,i)?1:0),0);return marked(g)}
const stamp=()=>nowMinutes();
function setMark(gid,i,val){met[gid]=met[gid]||{};met[gid][i]=val;met[gid]['@'+i]=val?stamp():null;saveMet()}
const allGroups=()=>[...DAY.arr,...DAY.dep];
function rerenderMarks(){renderGuide();renderOps();renderBoard();renderDep()}
function renderGuidePick(){
  const gl=guides();if(!curGuide||!gl.includes(curGuide))curGuide=gl[0]||null;
  $('#guidePick').innerHTML=gl.map(g=>`<button type="button" aria-pressed="${g===curGuide}" data-g="${esc(g)}">${esc(g)}</button>`).join('');
  $('#guidePick').querySelectorAll('button').forEach(b=>b.onclick=()=>{curGuide=b.dataset.g;store.set('guide',curGuide);renderGuidePick();renderGuide()});
}
// tasks = one meeting (all groups of one flight for one guide) or one hotel pick-up
function buildTasks(keep){
  const tasks=[];const byFl=new Map();
  DAY.arr.filter(keep).forEach(t=>{const f=flightOfGroup(t);const k=(f?f.key:t.id)+'|'+(t.g||'');if(!byFl.has(k))byFl.set(k,{kind:'arr',f,guide:t.g||'',groups:[]});byFl.get(k).groups.push(t)});
  byFl.forEach(x=>{x.time=x.f?x.f.eta:toMin(x.groups[0].t);tasks.push(x)});
  const byPu=new Map();
  DAY.dep.filter(keep).forEach(t=>{const k=t.pu+'|'+t.h+'|'+t.v+'|'+(t.g||'');if(!byPu.has(k))byPu.set(k,{kind:'dep',guide:t.g||'',groups:[]});byPu.get(k).groups.push(t)});
  byPu.forEach(x=>{x.time=toMin(x.groups[0].pu||x.groups[0].t);tasks.push(x)});
  tasks.sort((a,b)=>a.time-b.time);
  tasks.forEach(t=>{t.total=t.groups.reduce((s,g)=>s+groupTotal(g),0);t.done=t.groups.reduce((s,g)=>s+marked(g),0);t.res=t.groups.reduce((s,g)=>s+resolved(g),0);t.no=t.res-t.done;t.complete=t.total>0&&t.res>=t.total;
    t.last=Math.max(-1,...t.groups.flatMap(g=>Object.entries(met[g.id]||{}).filter(([k,v])=>k[0]==='@'&&v!=null).map(([,v])=>+v)))});
  return tasks;
}
const guideTasks=g=>buildTasks(t=>t.g===g);
function taskHead(t,showGuide){
  const g0=t.groups[0];
  if(t.kind==='arr'){const f=t.f,st=f?fStatus(f,NOW):null;const late=f&&f.delay>=15&&(f.live||NOW>=f.delayKnownAt);
    return `<div class="tt ${late?'late':''} num">${late?`<s>${g0.t}</s>`:''}${fmt(t.time)}<small>${st&&st.k==='land'?'сел':'посадка'}</small></div><div><div class="kind arr">Встреча</div><div class="ttl">${esc(f?[...f.codes].join(' / '):g0.fl)}</div><div class="sub">${esc(CITY[g0.org]||g0.org||'')} · ${g0.to==='GZP'?'<b>Газипаша</b>':termLbl(g0.term)} · ${esc(g0.v||'без машины')}</div></div>${st?`<span class="status ${st.k} st"><span class="dot"></span>${st.lbl}</span>`:''}`}
  return `<div class="tt num">${esc(g0.pu||g0.t)}<small>выезд</small></div><div><div class="kind dep">Забор из отеля</div><div class="ttl">${esc(g0.h)}</div><div class="sub">→ ${/^[!?]/.test(g0.fl)?'рейс не указан':esc(normFl(g0.fl))} в ${esc(g0.t)} · ${termLbl(g0.term)} · ${esc(g0.v||'')}${g0.note?' · '+esc(g0.note):''}</div></div><span class="chip st">${t.groups.reduce((s,x)=>s+(+x.pax||0),0)} чел</span>`;
}
// passengers still expected first; the ones already marked go into a "Вышли" box with the time
function paxRows(g,kind){
  const okLbl=kind==='arr'?'Вышел':'Сел';
  const row=(p,i)=>{const mk=markOf(g.id,i);const at=(met[g.id]||{})['@'+i];return `<div class="prow ${mk||''}"><span class="pn">${i+1}</span><span class="nm">${esc(p[0])} ${esc(p[1])}${p[2]?`<small>${esc(p[2])}</small>`:''}${mk&&at!=null?`<small class="at">${mk==='out'?'✓':'✗'} ${fmt(at)}</small>`:''}</span><span class="mk"><button type="button" class="ok" aria-pressed="${mk==='out'}" data-mk="${g.id}|${i}|out">✓ ${okLbl}</button><button type="button" class="no" aria-pressed="${mk==='no'}" data-mk="${g.id}|${i}|no" aria-label="Нет">✗</button></span></div>`};
  if(g.p&&g.p.length){
    const pend=[],done=[];g.p.forEach((p,i)=>(markOf(g.id,i)?done:pend).push([p,i]));
    const nOut=done.filter(([,i])=>markOf(g.id,i)==='out').length,nNo=done.length-nOut;
    return pend.map(([p,i])=>row(p,i)).join('')+(done.length?`<details class="donebox"${pend.length?'':' open'}><summary><span class="met">✓ ${kind==='arr'?'Вышли':'Сели'}: ${nOut}</span>${nNo?` <span class="nos">✗ не пришли: ${nNo}</span>`:''}</summary>${done.map(([p,i])=>row(p,i)).join('')}</details>`:'');
  }
  const n=marked(g);
  return `<div class="counter"><button type="button" data-cnt="${g.id}|-1" aria-label="Минус">−</button><output>${n} / ${g.pax}</output><button type="button" data-cnt="${g.id}|1" aria-label="Плюс">+</button>${kind==='arr'?'<span class="hint">без имён</span>':''}</div>`;
}
function grpHtml(t){return t.groups.map(x=>{const d=marked(x),n=groupTotal(x);return `<div class="tgrp"><div class="gh"><span><b>${esc(t.kind==='arr'?x.h:normFl(x.fl)+' '+x.t)}</b> <span class="hint">${esc(x.op||'')} · ${x.pax} чел</span></span><span style="display:flex;gap:8px;align-items:center"><span class="bar"><i style="width:${n?Math.round(d/n*100):0}%"></i></span><span class="num">${d}/${n}</span></span></div>${paxRows(x,t.kind)}</div>`}).join('')}
function guideStrip(t){
  const vs=[...new Set(t.groups.map(g=>g.v).filter(Boolean))];
  return `<div class="gstrip"><span class="gs-name">${esc(t.guide||'гид не указан')}</span><span class="gs-ph">${gPhone(t.guide)?esc(gPhone(t.guide)):'<span class="hint">телефон гида не указан</span>'}</span>${vs.map(v=>{const a=assign[v]||{};return `<span class="gs-veh"><b>${esc(v)}</b>${a.plate?' · '+esc(a.plate):''}${a.phone?' · водитель '+esc(a.phone):''}${a.driver?' ('+esc(a.driver)+')':''}</span>`}).join('')}</div>`;
}
function taskCard(t,key,o={}){
  const cls=['task',t.complete?'done':'',o.next?'next':''].join(' ');
  const ids=t.groups.map(x=>x.id).join(',');
  const strip=o.showGuide?guideStrip(t):'';
  if(t.complete)return `<article class="${cls}"><div class="th">${taskHead(t,o.showGuide)}</div>${strip}<div class="tf"><span class="met">✓ ${t.kind==='arr'?'Вышли':'Сели'} ${t.done} из ${t.total}${t.no?`, не пришли: ${t.no}`:''}${t.last>=0?` · ${fmt(t.last)}`:''}</span><button class="btn" type="button" data-open="${key}">Показать список</button></div><div hidden id="tg_${key}">${grpHtml(t)}</div></article>`;
  return `<article class="${cls}"><div class="th">${taskHead(t,o.showGuide)}</div>${strip}${grpHtml(t)}<div class="tf"><button class="btn primary" type="button" data-allk="${ids}">${t.kind==='arr'?'Все вышли':'Все сели'}</button><button class="btn" type="button" data-clear="${ids}">Сбросить</button></div></article>`;
}
function bindMarks(T){
  T.querySelectorAll('[data-mk]').forEach(b=>b.onclick=()=>{const [gid,i,val]=b.dataset.mk.split('|');setMark(gid,i,markOf(gid,i)===val?null:val);rerenderMarks()});
  T.querySelectorAll('[data-cnt]').forEach(b=>b.onclick=()=>{const [gid,d]=b.dataset.cnt.split('|');const g=allGroups().find(x=>x.id===gid);met[gid]=met[gid]||{};met[gid].n=Math.max(0,Math.min(+g.pax||0,(+met[gid].n||0)+(+d)));met[gid]['@n']=stamp();saveMet();rerenderMarks()});
  T.querySelectorAll('[data-allk]').forEach(b=>b.onclick=()=>{const now=stamp();b.dataset.allk.split(',').forEach(gid=>{const g=allGroups().find(x=>x.id===gid);met[gid]=met[gid]||{};if(g.p&&g.p.length)g.p.forEach((_,i)=>{if(!markOf(gid,i)){met[gid][i]='out';met[gid]['@'+i]=now}});else{met[gid].n=+g.pax||0;met[gid]['@n']=now}});saveMet();rerenderMarks();toast('Отмечено, операционщик это видит')});
  T.querySelectorAll('[data-clear]').forEach(b=>b.onclick=()=>{b.dataset.clear.split(',').forEach(gid=>{const g=allGroups().find(x=>x.id===gid);met[gid]={n:0,'@n':null};if(g.p)g.p.forEach((_,i)=>{met[gid][i]=null;met[gid]['@'+i]=null})});saveMet();rerenderMarks()});
  T.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{const el=document.getElementById('tg_'+b.dataset.open);el.hidden=!el.hidden;b.textContent=el.hidden?'Показать список':'Скрыть список'});
}
function renderGuide(){
  if(!DAY)return;
  const g=curGuide;if(!g){$('#guideHead').innerHTML='<p class="hint">В этом дне нет гидов.</p>';$('#tasks').innerHTML='';return}
  const tasks=guideTasks(g);
  const vehs=[...new Set(tasks.flatMap(t=>t.groups.map(x=>x.v)).filter(Boolean))];
  const tot=tasks.reduce((s,t)=>s+t.total,0),done=tasks.reduce((s,t)=>s+t.done,0);
  $('#guideHead').innerHTML=`<div class="ghead"><div class="gname">${esc(g)}</div><div class="gmeta">${vehs.map(v=>{const a=assign[v]||{};return `<span><b>${esc(v)}</b>${a.plate?' · '+esc(a.plate):''}${a.phone?' · водитель '+esc(a.phone):''}</span>`}).join('')}</div><div class="gmeta"><span><b>${tasks.filter(t=>t.kind==='arr').length}</b> встреч</span><span><b>${tasks.filter(t=>t.kind==='dep').length}</b> заборов</span><span><b>${tot}</b> гостей</span><span>отмечено <b>${done}</b></span></div></div>`;
  const hide=$('#hideDone').checked;
  const nextIdx=tasks.findIndex(t=>!t.complete&&t.time+60>=NOW);
  $('#tasks').innerHTML=tasks.map((t,ti)=>hide&&t.complete?'':taskCard(t,'g'+ti,{next:ti===nextIdx})).join('')||'<p class="hint">Все задания выполнены.</p>';
  bindMarks($('#tasks'));
}
$('#hideDone').addEventListener('change',renderGuide);

/* ---------- control screen for the operations desk ---------- */
let opsOpen={later:false,done:false,stale:false};
function renderOps(){
  if(!DAY||!$('#opsWait'))return;
  const fg=$('#opsGuide').value,fk=$('#opsKind').value,q=$('#opsQ').value.trim().toUpperCase();
  // guide filter list
  const gl=guides();const sel=$('#opsGuide');const cur=sel.value;sel.length=1;gl.forEach(g=>sel.add(new Option(g,g)));sel.value=gl.includes(cur)?cur:'';
  const tasks=buildTasks(t=>(!fg||t.g===fg)).filter(t=>!fk||t.kind===fk).filter(t=>!q||(t.guide||'').toUpperCase().includes(q)||t.groups.some(g=>(g.p||[]).some(p=>p[1].includes(q))||String(g.fl).replace(/\s/g,'').includes(q.replace(/\s/g,''))||(g.h||'').toUpperCase().includes(q)));
  const open=tasks.filter(t=>!t.complete),done=tasks.filter(t=>t.complete);
  const now=open.filter(t=>t.time>=NOW-90&&t.time<=NOW+120),later=open.filter(t=>t.time>NOW+120),stale=open.filter(t=>t.time<NOW-90);
  // no-shows
  const noShows=[];tasks.forEach(t=>t.groups.forEach(g=>(g.p||[]).forEach((p,i)=>{if(markOf(g.id,i)==='no')noShows.push({t,g,p,i,at:(met[g.id]||{})['@'+i]})})));
  const sum=(arr,f)=>arr.reduce((s,t)=>s+f(t),0);
  const waiting=sum(open,t=>t.total-t.res),out=sum(tasks,t=>t.done);
  $('#opsSum').innerHTML=[['Ждём',waiting,`гостей в ${open.length} заданиях`],['Вышли',out,'отмечено гидами'],['Не пришли',noShows.length,noShows.length?'нужно разобраться':'пока нет'],['Закрыто',`${done.length}/${tasks.length}`,'заданий выполнено']].map(([k,v,s],i)=>`<div class="stat${i===2&&noShows.length?' alert':''}"><div class="k">${k}</div><div class="v num">${v}</div><div class="s">${s}</div></div>`).join('');
  $('#opsWait').innerHTML=now.length?now.map((t,i)=>taskCard(t,'on'+i,{showGuide:true,next:i===0})).join(''):'<p class="hint">Сейчас никого не ждём.</p>';
  $('#opsNo').innerHTML=noShows.length?noShows.map(x=>`<div class="noshow"><div><b>${esc(x.p[0]+' '+x.p[1])}</b><span class="hint">${esc(x.t.kind==='arr'?normFl(x.g.fl)+' → '+x.g.h:x.g.h+' → '+normFl(x.g.fl))} · ${esc(x.g.op||'')}</span><span class="hint">${esc(x.g.g||'')} · ${esc(x.g.v||'')}${x.at!=null?' · отмечен в '+fmt(x.at):''}</span></div><button class="btn" type="button" data-mk="${x.g.id}|${x.i}|no">Вернуть</button></div>`).join(''):'<p class="hint">Все, кого отметили, вышли.</p>';
  $('#opsLaterN').textContent=later.length;$('#opsStaleN').textContent=stale.length;$('#opsStaleBox').hidden=!stale.length;
  $('#opsStale').innerHTML=stale.map((t,i)=>taskCard(t,'os'+i,{showGuide:true})).join('');$('#opsDoneN').textContent=done.length;
  $('#opsLater').innerHTML=later.map(t=>`<tr><td class="tm num">${fmt(t.time)}</td><td><span class="act ${t.kind}">${t.kind==='arr'?'Встреча':'Забор'}</span> ${esc(t.kind==='arr'?(t.f?[...t.f.codes].join(' / '):t.groups[0].fl):t.groups[0].h)}<br><span class="hint">${esc(t.groups.map(g=>t.kind==='arr'?g.h:normFl(g.fl)+' '+g.t).join(', '))}</span></td><td>${esc(t.guide||'—')}<br><span class="hint">${esc([...new Set(t.groups.map(g=>g.v))].join(', '))}</span></td><td class="n num">${t.total}</td></tr>`).join('');
  $('#opsDone').innerHTML=done.slice().reverse().map((t,i)=>taskCard(t,'od'+i,{showGuide:true})).join('');
  renderOpsGuides(fg);
  renderWaOut(tasks);
  $('#opsLaterBox').open=opsOpen.later;$('#opsStaleBox').open=opsOpen.stale;$('#opsDoneBox').open=opsOpen.done;
  bindMarks($('#v-ops'));
}
function renderOpsGuides(sel){
  const all=buildTasks(()=>true);
  const rows=guides().map(g=>{const ts=all.filter(t=>t.guide===g);const open=ts.filter(t=>!t.complete);const next=open.find(t=>t.time>=NOW-90)||open[0];
    const out=ts.reduce((s,t)=>s+t.done,0),tot=ts.reduce((s,t)=>s+t.total,0),no=ts.reduce((s,t)=>s+t.no,0),stale=open.filter(t=>t.time<NOW-90).length;
    const vs=[...new Set(ts.flatMap(t=>t.groups.map(x=>x.v)).filter(Boolean))];
    const nx=next?`${fmt(next.time)} ${next.kind==='arr'?'встреча '+(next.f?[...next.f.codes][0]:normFl(next.groups[0].fl)):'забор '+next.groups[0].h}`:'всё закрыто';
    return `<div class="gcard${sel===g?' on':''}"><button type="button" class="gc-name" data-pick="${esc(g)}">${esc(g)}</button>
      <input class="gc-ph" id="gp_${esc(g).replace(/\W/g,'_')}" data-gp="${esc(g)}" value="${esc(gPhone(g))}" placeholder="телефон гида" inputmode="tel" aria-label="Телефон ${esc(g)}">
      <span class="gc-veh">${esc(vs.join(', ')||'без машины')}</span>
      <span class="gc-prog"><span class="bar"><i style="width:${tot?Math.round(out/tot*100):0}%"></i></span><span class="num">${out}/${tot}</span>${no?` <span class="nos">✗${no}</span>`:''}${stale?` <span class="chip gzp" title="задания прошли, отметок нет">⚠ ${stale}</span>`:''}</span>
      <span class="gc-next ${next?'':'hint'}">Дальше: ${esc(nx)}</span>${out?`<button type="button" class="btn gc-copy" data-gcopy="${esc(g)}">📋 Вышедшие (${out})</button>`:''}</div>`}).join('');
  $('#opsGuides').innerHTML=rows;
  $('#opsGuides').querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{const g=b.dataset.pick;$('#opsGuide').value=$('#opsGuide').value===g?'':g;renderOps();$('#opsWait').scrollIntoView?.({behavior:'smooth',block:'start'})});
  $('#opsGuides').querySelectorAll('[data-gcopy]').forEach(b=>b.onclick=async()=>{const g=b.dataset.gcopy;const r=exitedText(buildTasks(t=>t.g===g),{...woOpts(),onlyNew:false});if(r.text)await copy(r.text)});
  $('#opsGuides').querySelectorAll('[data-gp]').forEach(i=>i.addEventListener('change',e=>{GP[e.target.dataset.gp]=e.target.value.trim();saveGP();renderOps()}));
}
['#opsGuide','#opsKind'].forEach(s=>$(s).addEventListener('change',renderOps));$('#opsQ').addEventListener('input',renderOps);
$('#opsLaterBox').addEventListener('toggle',e=>opsOpen.later=e.target.open);$('#opsStaleBox').addEventListener('toggle',e=>opsOpen.stale=e.target.open);$('#opsDoneBox').addEventListener('toggle',e=>opsOpen.done=e.target.open);


/* ---------- exited guests as a WhatsApp message ---------- */
let SENT={};
const sentKey=(gid,i)=>gid+'|'+i;
function exitedText(tasks,o){
  const L=o.lang==='ru'?{title:'ВЫШЛИ ГОСТИ',out:'вышли',in:'сели',no:'Не пришли',noname:'чел. без имён',total:'Всего вышло',guide:'Гид'}:{title:'ÇIKAN MİSAFİRLER',out:'çıktı',in:'bindi',no:'Gelmedi',noname:'kişi (isimsiz)',total:'Toplam çıkan',guide:'Rehber'};
  const byG=new Map();let total=0;const keys=[];
  tasks.forEach(t=>{
    const lines=[];let n=0;
    t.groups.forEach(g=>{
      const outs=[],nos=[];
      if(g.p&&g.p.length)g.p.forEach((p,i)=>{const mk=markOf(g.id,i);if(!mk)return;if(o.onlyNew&&SENT[sentKey(g.id,i)])return;const at=(met[g.id]||{})['@'+i];
        if(mk==='out'){outs.push(`${p[0]} ${p[1]}${o.time&&at!=null?' ('+fmt(at)+')':''}`);keys.push(sentKey(g.id,i))}else if(o.no){nos.push(`${p[0]} ${p[1]}`);keys.push(sentKey(g.id,i))}});
      else{const m=met[g.id]||{};const cnt=+m.n||0;const sentN=+SENT[sentKey(g.id,'n')]||0;const add=o.onlyNew?cnt-sentN:cnt;if(add>0){outs.push(`${add} ${L.noname}${o.time&&m['@n']!=null?' ('+fmt(m['@n'])+')':''}`);keys.push(sentKey(g.id,'n')+'='+cnt);n+=add}}
      if(!outs.length&&!nos.length)return;
      if(g.p&&g.p.length)n+=outs.length;
      const where=t.kind==='arr'?`${normFl(g.fl)} ${g.t} → ${g.h}`:`${g.h} → ${normFl(g.fl)} ${g.t}`;
      lines.push(`${where} · ${g.op||''} (${marked(g)}/${groupTotal(g)})`);
      outs.forEach((x,k)=>lines.push(`${k+1}. ${x}`));
      if(nos.length)lines.push(`✗ ${L.no}: ${nos.join(', ')}`);
    });
    if(!lines.length)return;
    const gname=t.guide||'—';if(!byG.has(gname))byG.set(gname,{lines:[],n:0,v:new Set()});
    const G=byG.get(gname);G.lines.push(...lines,'');G.n+=n;t.groups.forEach(g=>g.v&&G.v.add(g.v));total+=n;
  });
  if(!byG.size)return {text:'',keys:[],total:0};
  let txt=`*${dayKey} · ${L.title}* (${fmt(nowMinutes())})\n\n`;
  byG.forEach((G,name)=>{txt+=`*${name}*${G.v.size?' · '+[...G.v].join(', '):''}${gPhone(name)?' · '+gPhone(name):''}\n${G.lines.join('\n')}\n`});
  txt+=`${L.total}: ${total}`;
  return {text:txt.replace(/\n{3,}/g,'\n\n'),keys,total};
}
function woOpts(){return {onlyNew:$('#woNew').checked,time:$('#woTime').checked,no:$('#woNo').checked,lang:$('#woLang').value}}
let woTasks=[];
function renderWaOut(tasks){
  woTasks=tasks;const r=exitedText(tasks,woOpts());
  $('#waOut').textContent=r.text||($('#woNew').checked?'Новых вышедших гостей нет: всё уже отправлено.':'Пока никто не отмечен как вышедший.');
  $('#waOutCnt').textContent=r.total?`· ${r.total} ${$('#woNew').checked?'новых':'всего'}`:'';
  $('#woCopy').disabled=!r.text;
}
$('#woCopy').onclick=async()=>{const r=exitedText(woTasks,woOpts());if(!r.text)return;await copy(r.text);
  r.keys.forEach(k=>{const m=k.match(/^(.*\|n)=(\d+)$/);if(m)SENT[m[1]]=+m[2];else SENT[k]=1});store.set('sent_'+dayKey,SENT);renderOps()};
$('#woReset').onclick=()=>{SENT={};store.set('sent_'+dayKey,SENT);renderOps();toast('Все вышедшие снова попадут в сообщение')};
['#woNew','#woTime','#woNo','#woLang'].forEach(id=>$(id).addEventListener('change',()=>renderWaOut(woTasks)));


/* ---------- delayed flights as a WhatsApp message ---------- */
let SENTD={};
const delayKnown=f=>f.live||NOW>=f.delayKnownAt;
const lateSig=f=>f.live&&['cancelled','diverted'].includes(f.live.status)?f.live.status:fmt(f.eta);
function lateFlights(o){
  return flights.filter(f=>{if(f.unknown||!delayKnown(f))return false;const st=fStatus(f,NOW);
    if(o.onlyNew&&SENTD[f.key]===lateSig(f))return false;
    if(f.live&&['cancelled','diverted'].includes(f.live.status))return true;
    if(f.delay<o.min)return false;if(st.k==='land'&&!o.landed)return false;
    return true});
}
function lateText(o){
  const L=o.lang==='ru'?{title:'ЗАДЕРЖКИ РЕЙСОВ',plan:'По расписанию',eta:'новое время посадки',landed:'сел в',cancel:'РЕЙС ОТМЕНЁН',div:'УШЁЛ НА ЗАПАСНОЙ АЭРОПОРТ',min:'мин',pax:'чел',total:'Задержано рейсов',guests:'гостей',int:'Внешние T2',dom:'Внутренние'}
    :{title:'RÖTARLI UÇUŞLAR',plan:'Planlanan',eta:'yeni tahmini iniş',landed:'indi',cancel:'UÇUŞ İPTAL',div:'BAŞKA HAVALİMANINA İNDİ',min:'dk',pax:'kişi',total:'Rötarlı uçuş',guests:'misafir',int:'Dış Hatlar T2',dom:'İç Hatlar'};
  const list=lateFlights(o);if(!list.length)return {text:'',list};
  let txt=`*${dayKey} · ${L.title}* (${fmt(nowMinutes())})\n`;let guests=0;
  list.forEach(f=>{
    const g0=f.groups[0];const term=g0.term==='İÇ'?L.dom:g0.term==='DIŞ'?L.int:'';
    const city=o.lang==='ru'?(CITY[f.org]||f.org):(CITY_TR[f.org]||f.org);
    const st=fStatus(f,NOW);const pax=f.groups.reduce((s,g)=>s+(+g.pax||0),0);guests+=pax;
    txt+=`\n✈ *${[...f.codes].join(' / ')}*${city?' ('+city+')':''}${term?' · '+term:''}\n`;
    if(f.live&&f.live.status==='cancelled')txt+=`❌ ${L.cancel}\n`;
    else if(f.live&&f.live.status==='diverted')txt+=`⚠ ${L.div}\n`;
    else if(st.k==='land')txt+=`${L.plan} ${f.t} → ${L.landed} *${fmt(f.eta)}* (+${f.delay} ${L.min})\n`;
    else txt+=`${L.plan} ${f.t} → ${L.eta} *${fmt(f.eta)}* (+${f.delay} ${L.min})\n`;
    if(o.groups)f.groups.forEach(g=>{txt+=`• ${g.h} · ${g.pax} ${L.pax}${g.v?' · '+g.v:''}${g.g?' · '+g.g:''}\n`});
  });
  txt+=`\n${L.total}: ${list.length} · ${guests} ${L.guests}`;
  return {text:txt,list};
}
function wlOpts(){return {min:+$('#wlMin').value,onlyNew:$('#wlNew').checked,groups:$('#wlGroups').checked,landed:$('#wlLanded').checked,lang:$('#wlLang').value}}
function renderWaLate(){
  if(!DAY)return;const r=lateText(wlOpts());
  $('#waLate').textContent=r.text||($('#wlNew').checked?'Новых задержек нет: всё уже отправлено.':'Задержанных рейсов нет.');
  $('#waLateCnt').textContent=r.list.length?`· ${r.list.length} ${$('#wlNew').checked?'новых':''}`:'';
  $('#wlCopy').disabled=!r.text;
  const all=lateFlights({...wlOpts(),onlyNew:false,landed:false});$('#boardLateCopy').textContent=all.length?`✈ Скопировать задержки (${all.length})`:'✈ Задержек нет';$('#boardLateCopy').disabled=!all.length;
}
async function copyLate(o){const r=lateText(o);if(!r.text)return;await copy(r.text);r.list.forEach(f=>SENTD[f.key]=lateSig(f));store.set('sentd_'+dayKey,SENTD);renderWaLate()}
$('#wlCopy').onclick=()=>copyLate(wlOpts());
$('#boardLateCopy').onclick=()=>copyLate({...wlOpts(),onlyNew:false,landed:false});
$('#wlReset').onclick=()=>{SENTD={};store.set('sentd_'+dayKey,SENTD);renderWaLate();toast('Все задержки снова попадут в сообщение')};
['#wlMin','#wlNew','#wlGroups','#wlLanded','#wlLang'].forEach(id=>$(id).addEventListener('change',renderWaLate));

/* ---------- live sync of guide marks between phones ---------- */
let lastLocalMark=0;
async function pullMarks(){
  if(!SERVER||!DAY||document.hidden||Date.now()-lastLocalMark<5000)return;
  try{const r=await api('GET','/api/state?d='+encodeURIComponent(dayKey)+'&kind=met');const srv=r.data||{};
    if(Date.now()-lastLocalMark<5000)return;
    const before=JSON.stringify(met);met=Object.assign({},met,srv);
    if(JSON.stringify(met)!==before){store.set('met_'+dayKey,met);rerenderMarks()}
  }catch(e){}
}
setInterval(pullMarks,20000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)pullMarks()});


/* ---------- contacts & log ---------- */
function renderContacts(){
  if(!contacts)contacts=[...guides().map(g=>({name:g,role:'Гид',phone:gPhone(g),on:true})),{name:'Операционный отдел',role:'Операционщик',phone:'',on:true},{name:'Владелец',role:'Только срочное',phone:'',on:true}];
  $('#ctable').innerHTML=`<thead><tr><th>Кто</th><th>Роль</th><th>Телефон</th><th>Уведомлять</th></tr></thead><tbody>${contacts.map((c,i)=>`<tr><td>${esc(c.name)}</td><td class="hint">${esc(c.role)}</td><td><input id="cp_${i}" data-i="${i}" value="${esc(c.phone)}" placeholder="+90 5xx xxx xx xx"></td><td><input type="checkbox" id="cn_${i}" data-i="${i}" ${c.on?'checked':''} style="width:auto;min-width:0" aria-label="Уведомлять"></td></tr>`).join('')}</tbody>`;
  $('#ctable').querySelectorAll('input').forEach(inp=>inp.addEventListener('input',e=>{const c=contacts[e.target.dataset.i];if(e.target.type==='checkbox')c.on=e.target.checked;else{c.phone=e.target.value;if(c.role==='Гид'){GP[c.name]=c.phone.trim();saveGP()}}store.set('contacts_'+dayKey,contacts);renderLog()}));
  renderLog();
}
function renderLog(){
  const ev=[];const ph=n=>{const c=(contacts||[]).find(x=>x.name===n);return c&&c.phone?c.phone:(gPhone(n)||'номер не указан')};
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
const MONTHS=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const loadScript=src=>new Promise((ok,fail)=>{if(document.querySelector(`script[src="${src}"]`))return ok();const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>fail(new Error('нет интернета для чтения файла'));document.head.appendChild(s)});
const PDFJS='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
async function readRows(file){
  const ext=(file.name.match(/\.(\w+)$/)||[])[1]?.toLowerCase();
  if(ext==='pdf'){if(!window.pdfjsLib)await loadScript(PDFJS+'pdf.min.js');if(!window.pdfjsWorker)await loadScript(PDFJS+'pdf.worker.min.js');window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS+'pdf.worker.min.js';return pdfToRows(await file.arrayBuffer())}
  if(ext==='docx'){if(!window.JSZip)await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');return docxToRows(await file.arrayBuffer())}
  if(ext==='doc')throw new Error('это старый формат Word (.doc). Откройте файл в Word и сохраните как .docx или PDF');
  if(typeof XLSX==='undefined')throw new Error('библиотека Excel не загрузилась, обновите страницу');
  const wb=XLSX.read(new Uint8Array(await file.arrayBuffer()),{type:'array'});
  let rows=[];wb.SheetNames.forEach(n=>rows=rows.concat(XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:false})));
  return rows;
}
async function saveDay(key,d){if(SERVER)return api('PUT','/api/day?d='+encodeURIComponent(key),d);const imp=store.get('imported',{});imp[key]=d;store.set('imported',imp);return null}
async function importKapak(rows,file){
  const flat=rows.slice(0,40).map(r=>(r||[]).join(' ')).join(' ');
  const dm=flat.match(/Tarih\s*:\s*(\d\d)\/(\d\d)\/(\d{4})/)||file.name.match(/(\d\d)[._](\d\d)[._](\d{4})/);
  const key=dm?dm[1]+'.'+dm[2]:file.name.replace(/\.\w+$/,'').slice(0,10);
  const title=dm?`${+dm[1]} ${MONTHS[+dm[2]-1]} ${dm[3]}`:key;
  const K=parseKapak(rows);
  const ok=K.recon.filter(c=>c.expected===c.got).length;
  if(/\.pdf$/i.test(file.name)&&ok<K.recon.length*0.9)throw new Error('Капак в PDF читается неточно (сошлось '+ok+' из '+K.recon.length+' рейсов). Загрузите Капак в Excel');
  const pack={recs:K.recs,recon:{ok,total:K.recon.length,bad:K.recon.filter(c=>c.expected!==c.got)}};
  const d=dayFromKapak(pack,key,title);
  if(!d.arr.length&&!d.dep.length)throw new Error('в файле не найдено ни одного рейса');
  d.iso=dm?`${dm[3]}-${dm[2]}-${dm[1]}`:'';
  const prev=DAYS[key];let names=null;
  if(prev&&prev.arac){d.arac=prev.arac;applyTourists(d,d.arac)}
  if(prev&&prev.tourists){d.tourists=prev.tourists;names=applyTourists(d,d.tourists)}
  DAYS[key]=d;
  const srv=await saveDay(key,d);
  return {key,html:`<b>Капак ${esc(key)} загружен.</b><span>${d.arr.length} групп на прилёт, ${d.dep.length} на вылет, ${d.self} гостей едут сами, ${d.h2h} межотельных.</span>${srv?`<span>Программа следит за ${srv.watched} рейсами из этого Капака${srv.poll&&srv.poll.ok?`, первые данные уже получены (${srv.poll.found})`:''}.</span>`:''}<span>Сверка с итогами файла: ${ok} из ${K.recon.length} рейсов сходятся.${pack.recon.bad.length?' Не сходятся: '+pack.recon.bad.map(b=>esc(b.fl)).join(', ')+'.':''}</span>${names?`<span>Имена туристов из прошлой загрузки сохранены: ${names.people}.</span>`:''}`};
}
async function importTourists(T,file){
  const key=T.date?T.date.d+'.'+T.date.m:null;
  if(!key)throw new Error('не нашёл дату в списке');
  let d=DAYS[key],created=false;
  if(!d){
    if(!T.isArac)throw new Error(`сначала загрузите Капак или Araç Listesi на ${key}, потом имена`);
    // a vehicle list alone is enough to build the arrivals of the day
    d={key,title:`${+T.date.d} ${MONTHS[+T.date.m-1]} ${T.date.y}`,source:'Araç Listesi',arr:[],dep:[],self:0,h2h:0,recon:null,delays:{},extra:[],iso:`${T.date.y}-${T.date.m}-${T.date.d}`};
    DAYS[key]=d;created=true;
  }
  const r=applyTourists(d,T);
  if(T.isArac)d.arac=T;else d.tourists=T;
  await saveDay(key,d);
  const un=r.unmatched.filter(t=>t.people.length&&t.fl);
  if(T.isArac){
    const per=T.vehicles.map(v=>{const n=d.arr.concat(d.dep).filter(g=>g.v===v).reduce((s,g)=>s+(g.p&&g.p.length?g.p.filter(p=>p[0]!=='Inf').length:+g.pax||0),0);const tot=T.totals[v];return `${esc(v)}: ${n}${tot!=null?(n===tot?' ✓':` (в листе ${tot})`):''}`});
    return {key,html:`<b>Araç Listesi ${esc(key)} загружен: ${T.vehicles.length} машин.</b><span>${created?'Капака на этот день нет, прилёты построены по листу машин. ':''}Машины, гиды и терминалы обновлены, имена добавлены в ${r.matched+r.added} групп, всего ${r.people} туристов.</span><span>По машинам: ${per.join(' · ')}</span>${r.changed.length?`<span>Машина изменилась по сравнению с Капаком: ${r.changed.map(esc).join('; ')}</span>`:''}${r.added&&!created?`<span>Добавлено трансферов, которых не было в Капаке: ${r.added}.</span>`:''}`};
  }
  return {key,html:`<b>Имена туристов ${esc(key)} загружены.</b><span>Имена добавлены в ${r.matched} групп, всего ${r.people} туристов. Теперь у гидов есть кнопки «Вышел».</span>${r.h2h?`<span>${r.h2h} туристов в межотельных переездах, в Капаке их нет.</span>`:''}${un.length?`<span>Не нашлись в Капаке (${un.length}): ${un.slice(0,8).map(t=>esc((t.fl||'без рейса')+' '+t.hotel+' · '+t.people.length+' чел')).join('; ')}${un.length>8?'…':''}</span>`:''}`};
}
async function importFiles(files){
  const msg=$('#xlsMsg');msg.innerHTML='Читаю файлы…';
  const items=[];
  for(const file of files){try{const rows=await readRows(file);const T=parseTourists(rows);const people=T.groups.reduce((s,g)=>s+g.people.length,0);items.push({file,rows,T,isTourists:people>0})}catch(e){items.push({file,err:e.message})}}
  items.sort((a,b)=>(a.isTourists?(a.T.isArac?1:2):0)-(b.isTourists?(b.T.isArac?1:2):0));
  const out=[];let last=null;
  for(const it of items){
    if(it.err){out.push(`<span>${esc(it.file.name)}: не удалось прочитать (${esc(it.err)}).</span>`);continue}
    try{const r=it.isTourists?await importTourists(it.T,it.file):await importKapak(it.rows,it.file);last=r.key;out.push(r.html)}
    catch(e){if(e.message==='401')return;out.push(`<span>${esc(it.file.name)}: ${esc(e.message)}.</span>`)}
  }
  if(last){if(SERVER)refreshLive();loadDay(last)}
  msg.innerHTML=out.join('');
}
// kept for older callers and tests
const importFile=f=>importFiles([f]);
['#xlsK','#xlsA','#xlsT'].forEach(id=>$(id).addEventListener('change',e=>{if(e.target.files.length)importFiles([...e.target.files]);e.target.value=''}));
['#dropK','#dropA','#dropT'].forEach(id=>{const drop=$(id);
  ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over')}));
  ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over')}));
  drop.addEventListener('drop',e=>{const f=[...e.dataTransfer.files];if(f.length)importFiles(f)})});
function renderDayStatus(){
  const el=$('#dayStatus');if(!el)return;
  if(!DAY){el.innerHTML='<span class="chip">День ещё не загружен</span>';return}
  const named=DAY.arr.filter(g=>g.p&&g.p.length),ppl=[...DAY.arr,...DAY.dep].reduce((s,g)=>s+(g.p?g.p.length:0),0);
  const hasK=DAY.source!=='Araç Listesi';
  el.innerHTML=(hasK?`<span class="chip ok">${esc(DAY.key||dayKey)} · Капак: ${DAY.arr.length} групп на прилёт, ${DAY.dep.length} на вылет</span>`:`<span class="chip bad">${esc(DAY.key||dayKey)} · Капак не загружен (вылетов нет)</span>`)
    +(DAY.aracVehicles?`<span class="chip ok">Машины: ${DAY.aracVehicles.length} из Araç Listesi</span>`:'<span class="chip">Araç Listesi не загружен</span>')
    +(ppl?`<span class="chip ok">Имена: ${ppl} туристов в ${named.length} группах</span>`:'<span class="chip bad">Имена туристов ещё не загружены</span>');
}

/* ---------- wiring ---------- */
function renderAll(){if(!DAY)return;$('#nowLbl').textContent=fmt(NOW);$('#slider').value=NOW;renderBoard();renderDep();renderGuidePick();renderGuide();renderWaLate();if(!(document.activeElement&&document.activeElement.closest&&document.activeElement.closest('#opsGuides')))renderOps();renderLog();if(!$('#v-veh').hidden&&!(document.activeElement&&document.activeElement.closest&&document.activeElement.closest('#vgrid')))renderVeh()}
$('#slider').addEventListener('input',e=>{followNow=false;NOW=+e.target.value;store.set('now_'+dayKey,NOW);renderAll()});
let play=null;
$('#playBtn').onclick=()=>{if(play){clearInterval(play);play=null;$('#playBtn').textContent='▶ Проиграть день';return}
  $('#playBtn').textContent='❚❚ Пауза';play=setInterval(()=>{NOW+=5;if(NOW>1440)NOW=0;renderAll()},350)};
setInterval(()=>{if(followNow&&DAY&&!play){NOW=nowMinutes();renderAll()}},60000);
$('#nowBtn').onclick=()=>{followNow=true;NOW=nowMinutes();store.set('now_'+dayKey,NOW);renderAll()};
['#fVeh','#fHotel','#fOp'].forEach(s=>$(s).addEventListener('change',()=>DAY&&renderBoard()));$('#fQ').addEventListener('input',()=>DAY&&renderBoard());
$('#copyWa').onclick=()=>copy($('#waMsg').textContent);
const views=['board','ops','dep','veh','guide','checks','contacts','data'];
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('.tab');if(!b)return;
  document.querySelectorAll('.tab').forEach(t=>t.setAttribute('aria-selected',t===b));
  views.forEach(v=>$('#v-'+v).hidden=v!==b.dataset.t);store.set('tab',b.dataset.t)});
if(SERVER)serverBoot();else loadDay(dayKey);
const lastTab=store.get('tab','board');const tb=document.querySelector(`.tab[data-t="${lastTab}"]`);if(tb)tb.click();
