/* ---------- where the vehicles are: drivers' phones (Sarabi Sürücü app) on a map ---------- */
// shown to operations in «Машины» and to the administrator in «Контроль»; refreshed every 30 s while visible
const LEAF='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';
const APK_URL='https://github.com/sarabioper/sarabioper/releases/download/driver-latest/sarabi-driver.apk';
let LOCS=[],locAt=0,MAPS={},mapT=null;
// loaded once; two map refreshes at the same moment wait for the same download
let leafP=null;
function loadLeaflet(){if(window.L&&window.L.map)return Promise.resolve();if(leafP)return leafP;
  if(!document.querySelector('link[data-leaf]')){const l=document.createElement('link');l.rel='stylesheet';l.href=LEAF+'leaflet.min.css';l.dataset.leaf=1;document.head.appendChild(l)}
  leafP=new Promise((ok,fail)=>{const s=document.createElement('script');s.src=LEAF+'leaflet.min.js';s.onload=()=>window.L&&window.L.map?ok():fail(new Error('leaflet'));s.onerror=()=>fail(new Error('leaflet'));document.head.appendChild(s)}).catch(e=>{leafP=null;throw e});
  return leafP}
const MAPBUSY={};
async function pullLocs(){if(!SERVER||ROLE==='guide')return;try{const r=await api('GET','/api/locs');LOCS=r.locs||[];locAt=r.now||Date.now()}catch(e){if(e.message==='401')throw e}}
const ago=ms=>{const m=Math.round(ms/60000);return m<1?T('сейчас'):m<60?m+' '+T('мин назад'):Math.floor(m/60)+' ч '+(m%60)+' мин назад'};
const locState=x=>x.never?'never':!x.on?'off':locAt-x.at<4*60000?'live':locAt-x.at<20*60000?'idle':'old';
const srcTag=x=>x.src==='telegram'?' <span class="hint">· Telegram</span>':'';
// the vehicle's next job today, from the loaded KAPAK
function nextJob(veh){if(!DAY||!veh)return null;const VS=new Set(String(veh).split(/\s*,\s*/).map(v=>v.toUpperCase()));try{const ts=buildTasks(()=>true).filter(t=>t.groups.some(g=>VS.has((g.v||'').toUpperCase()))&&!t.complete).sort((a,b)=>a.time-b.time);
  return ts.find(t=>t.time>=NOW-30)||ts[0]||null}catch(e){return null}}
function locPopup(x){const st=locState(x);const nj=nextJob(x.veh);
  return `<b>${esc(x.veh||'—')}</b> · ${esc(x.name||'')}<br>${x.phone?`<a href="tel:${esc(String(x.phone).replace(/[^\d+]/g,''))}">📞 ${esc(x.phone)}</a><br>`:''}
    ${st==='off'?'⏹ смена закрыта':`${x.spd!=null&&x.spd>1?'🚐 едет '+Math.round(x.spd*3.6)+' км/ч':'⏸ стоит'} · ${ago(locAt-x.at)}`}${srcTag(x)}
    ${nj?`<br>Дальше: <b>${fmt(nj.time)}</b> ${nj.kind==='arr'?'встреча '+esc(nj.f?[...nj.f.codes][0]:normFl(nj.groups[0].fl)):'сбор '+esc(nj.groups[0].h)}`:''}`}
const LCOL={live:'#2E9E5B',idle:'#E8A317',old:'#8C9DAF',off:'#C2392E',never:'#C2392E'};
// a driver who should be working soon (a job within 45 min, or started up to 30 min ago) but is not on the map
function locAlerts(){const out=[];LOCS.forEach(x=>{const nj=nextJob(x.veh);if(!nj)return;const dt=nj.time-NOW;if(dt>45||dt<-30)return;
  const job=`${fmt(nj.time)} ${nj.kind==='arr'?'встреча '+(nj.f?[...nj.f.codes][0]:normFl(nj.groups[0].fl)):'сбор '+nj.groups[0].h}`;const st=locState(x);
  if(st==='off'||st==='never')out.push({x,txt:`${st==='never'?'ещё ни разу не включал смену':'смена не включена'} — а в ${job}`});
  else if(st==='old')out.push({x,txt:`нет сигнала ${ago(locAt-x.at)} — а в ${job}`})});return out}
function locBadges(){const n=locAlerts().length;[['#vehCnt','ops'],['#ctlVCnt','admin']].forEach(([id,r])=>{const el=$(id);if(el){el.textContent='⚠'+n;el.hidden=!n||ROLE!==r}})}
function locIcon(x){const st=locState(x);return L.divIcon({className:'vpin',iconSize:null,html:`<span class="vp ${st}" style="--c:${LCOL[st]}">🚐 ${esc(x.veh||x.name||'?')}</span>`})}
function mapListHtml(){if(!LOCS.length)return `<p class="hint">Пока ни один водитель не включил смену. Водители и их PIN — в блоке «🚐 Водители и PIN-коды» ниже (или создаются сами при вставке машин из WhatsApp), приложение: <a href="${APK_URL}" target="_blank" rel="noopener">sarabi-driver.apk</a>.</p>`;
  const o={live:0,idle:1,old:2,off:3,never:4};
  return `<div class="vlist">${LOCS.slice().sort((a,b)=>o[locState(a)]-o[locState(b)]||String(a.veh).localeCompare(String(b.veh),'tr',{numeric:true})).map(x=>{const st=locState(x);const nj=nextJob(x.veh);
    return `<button type="button" class="vrow ${st}" data-loc="${esc(x.id)}"><span class="dot" style="background:${LCOL[st]}"></span><b>${esc(x.veh||'—')}</b><span>${esc(x.name||'')}</span><span class="hint">${st==='never'?'ещё не включал':st==='off'?'смена закрыта':ago(locAt-x.at)}${x.src==='telegram'?' · Telegram':''}</span>${nj?`<span class="hint">→ ${fmt(nj.time)} ${nj.kind==='arr'?esc(nj.f?[...nj.f.codes][0]:''):esc(nj.groups[0].h)}</span>`:''}</button>`}).join('')}</div>`}
async function renderMap(boxId){if(MAPBUSY[boxId])return;MAPBUSY[boxId]=true;try{await renderMap_(boxId)}finally{MAPBUSY[boxId]=false}}
async function renderMap_(boxId){const box=$('#'+boxId);if(!box||box.closest('[hidden]'))return;
  if(!box.dataset.ready){box.dataset.ready=1;box.innerHTML=`<details class="panel vmap" open><summary><b>🗺 Где машины</b> <span class="hint" data-mapcnt></span></summary><div data-mapalert></div><div class="vmap-in"><div class="vmap-map" data-map></div><div data-maplist></div></div></details>`}
  try{await loadLeaflet()}catch(e){box.querySelector('[data-maplist]').innerHTML='<p class="hint">Карта не загрузилась, проверьте интернет.</p>';return}
  const el=box.querySelector('[data-map]');let M=MAPS[boxId];
  if(!M||M.el!==el){const map=L.map(el,{zoomControl:true,attributionControl:true}).setView([36.89,30.70],10);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,referrerPolicy:'origin',attribution:'© OpenStreetMap'}).addTo(map);M=MAPS[boxId]={el,map,mk:{},fit:false}}
  const seen=new Set();LOCS.forEach(x=>{if(x.lat==null)return;seen.add(x.id);let m=M.mk[x.id];
    if(!m){m=M.mk[x.id]=L.marker([x.lat,x.lng],{icon:locIcon(x)}).addTo(M.map)}else{m.setLatLng([x.lat,x.lng]);m.setIcon(locIcon(x))}m.bindPopup(locPopup(x))});
  Object.keys(M.mk).forEach(id=>{if(!seen.has(id)){M.mk[id].remove();delete M.mk[id]}});
  const pts=LOCS.filter(x=>x.lat!=null&&locState(x)!=='off').map(x=>[x.lat,x.lng]);if(!M.fit&&pts.length){M.map.fitBounds(pts,{padding:[30,30],maxZoom:13});M.fit=true}
  setTimeout(()=>M.map.invalidateSize(),50);
  const live=LOCS.filter(x=>locState(x)==='live').length;const AL=locAlerts();box.querySelector('[data-mapcnt]').innerHTML=`${live} на линии · всего ${LOCS.length}${AL.length?` · <b style="color:var(--crit)">⚠ ${AL.length}</b>`:''}`;
  box.querySelector('[data-mapalert]').innerHTML=AL.length?`<div class="valert">${AL.map(a=>`<button type="button" class="va" data-loc="${esc(a.x.id)}">⚠ <b>${esc(a.x.veh||'—')}</b> · ${esc(a.x.name||'')}: ${esc(a.txt)}${a.x.phone?` · <a href="tel:${esc(String(a.x.phone).replace(/[^\d+]/g,''))}">📞 ${esc(a.x.phone)}</a>`:''}</button>`).join('')}</div>`:'';
  box.querySelectorAll('.valert [data-loc]').forEach(b=>b.onclick=e=>{if(e.target.closest('a'))return;const m=M.mk[b.dataset.loc];if(m){M.map.setView(m.getLatLng(),14);m.openPopup()}});
  const ls=box.querySelector('[data-maplist]');ls.innerHTML=mapListHtml();
  ls.querySelectorAll('[data-loc]').forEach(b=>b.onclick=()=>{const m=M.mk[b.dataset.loc];if(m){M.map.setView(m.getLatLng(),14);m.openPopup()}})}
// positions are fetched every 30 s while the map is open and every minute otherwise (for the ⚠ badge on the tab)
let mapN=0;async function mapTick(force){if(document.hidden||!SERVER||ROLE==='guide')return;const box=ROLE==='ops'?'vehMap':ROLE==='admin'?'ctlMap':null;if(!box)return;
  const vis=$('#'+box)&&!$('#'+box).closest('[hidden]');mapN++;if(!force&&!vis&&mapN%2)return;
  try{await pullLocs()}catch(e){return}locBadges();if(vis)renderMap(box)}
setInterval(()=>mapTick(),30000);setTimeout(()=>mapTick(true),4000);
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('.tab');if(b&&(b.dataset.t==='veh'||b.dataset.t==='ops'))setTimeout(()=>mapTick(true),50)});
