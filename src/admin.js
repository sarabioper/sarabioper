/* ---------- admin cabinet: the one person who gives access (passwords, guide PINs) ---------- */
let ADM={passwords:{ops:'',guide:''},fromEnv:{},pins:{},log:[]},admShow={},admDirty=false;
async function loadAdmin(){const r=await api('GET','/api/admin');ADM=r;if(r.drivers){DRV=r.drivers;setTimeout(()=>{try{renderDrivers()}catch(e){}},0)}PINS=r.pins||{};admDirty=false;renderAdmin()}
function admGuides(){const S=new Set([...Object.keys(ADM.pins||{}),...gpKeys()]);
  if(DAY)[...DAY.arr,...DAY.dep].forEach(g=>{if(g.g&&!Object.keys(ADM.pins||{}).some(n=>sameG(n,g.g))&&!gpKeys().some(n=>sameG(n,g.g)))S.add(g.g)});
  try{tours().forEach(t=>{[t.guide,t.kok].forEach(n=>{if(n&&![...S].some(x=>sameG(x,n)))S.add(n)})})}catch(e){}
  return [...S].filter(Boolean).sort((a,b)=>a.localeCompare(b,'tr'))}
const admNewPin=()=>{const used=new Set(Object.values(ADM.pins).map(String));let p='';while(!p||used.has(p))p=String(1000+Math.floor(Math.random()*9000));return p};
function renderAdmin(){if(!$('#v-admin')||!isAdmin())return;
  $('#admPw').innerHTML=[['ops','Операционный отдел'],['guide','Гиды (общий)']].map(([k,l])=>`<div class="adm-pw"><b>${l}</b><span class="cur">${admShow[k]?esc(ADM.passwords[k]||'—'):'••••••••'} <button type="button" class="btn sm ghost" data-admeye="${k}" aria-label="Показать">${admShow[k]?'🙈':'👁'}</button>${ADM.fromEnv&&ADM.fromEnv[k]?' <small class="hint">(из настроек Netlify)</small>':''}</span><input type="text" data-admpw="${k}" placeholder="новый пароль, мин. 6 символов" autocomplete="off"><button type="button" class="btn primary" data-admpwsave="${k}">Сменить</button></div>`).join('');
  const G=admGuides();
  $('#admPins').innerHTML=`<div class="adm-pins">${G.map(n=>{const ph=gPhone(n);return `<div class="adm-pin"><span class="nm"><b>${esc(n)}</b>${ph?`<small>${esc(ph)}</small>`:'<small>нет телефона</small>'}</span><input data-admpin="${esc(n)}" value="${esc(ADM.pins[n]||'')}" inputmode="numeric" placeholder="нет PIN" maxlength="8">
    <span class="b"><button type="button" class="btn sm" data-admgen="${esc(n)}" title="Новый PIN">🎲</button><button type="button" class="btn sm ghost" data-admdel="${esc(n)}" title="Забрать PIN">✕</button>${ph&&ADM.pins[n]?`<a class="btn sm wa-go" target="_blank" rel="noopener" href="https://wa.me/${esc(ph.replace(/\D/g,'').replace(/^0/,'90'))}?text=${encodeURIComponent(`SARABI OPS\n${location.origin}\n${LANG==='tr'?'Rehber şifresi':'Пароль гидов'}: ${ADM.passwords.guide}\nPIN: ${ADM.pins[n]}`)}">WhatsApp</a>`:''}</span></div>`}).join('')}</div>
    <div class="adm-add"><input id="admNew" placeholder="Новый гид: имя как в Araç-листе"><button type="button" class="btn" id="admAdd">+ Добавить</button><span class="sp"></span><span class="hint">PIN сохраняется сразу, как только вы его выдали или изменили</span></div>`;
  $('#admLog').innerHTML=`<div class="adm-log">${(ADM.log||[]).map(l=>`<div><span class="num hint">${new Date(l.at).toLocaleString('ru',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span> ${esc(l.what)}</div>`).join('')||'<p class="hint">Пока пусто.</p>'}</div>`;
  const el=$('#v-admin');
  el.querySelectorAll('[data-admeye]').forEach(b=>b.onclick=()=>{admShow[b.dataset.admeye]=!admShow[b.dataset.admeye];renderAdmin()});
  el.querySelectorAll('[data-admpwsave]').forEach(b=>b.onclick=async()=>{const k=b.dataset.admpwsave;const v=el.querySelector(`[data-admpw="${k}"]`).value.trim();
    if(v.length<6)return toast('Пароль — минимум 6 символов');if(!confirm(T('Сменить пароль? Все, кто вошёл со старым паролем, должны будут войти заново.')))return;
    try{await api('PUT','/api/admin',{passwords:{[k]:v}});toast('Пароль изменён');await loadAdmin()}catch(e){toast('Не удалось: '+String(e.message).replace(/[{}"]/g,' '))}});
  // every change goes to the server at once: a PIN shown here (and sent on WhatsApp) is always the one that works
  const setPin=async(n,v)=>{const P=Object.assign({},ADM.pins);if(v)P[n]=v;else delete P[n];
    if(v&&(v.length<4||v.length>8))return toast('PIN — от 4 до 8 цифр');if(v&&Object.entries(P).some(([k,x])=>k!==n&&x===v))return toast('Этот PIN уже у другого гида');
    try{await api('PUT','/api/admin',{pins:P});toast(v?`PIN для ${n} сохранён: ${v}`:`PIN у ${n} забран`);await loadAdmin()}catch(e){toast('Не сохранилось: '+String(e.message).replace(/[{}"]/g,' '));renderAdmin()}};
  el.querySelectorAll('[data-admpin]').forEach(i=>i.onchange=()=>setPin(i.dataset.admpin,i.value.replace(/\D/g,'')));
  el.querySelectorAll('[data-admgen]').forEach(b=>b.onclick=()=>setPin(b.dataset.admgen,admNewPin()));
  el.querySelectorAll('[data-admdel]').forEach(b=>b.onclick=()=>setPin(b.dataset.admdel,''));
  $('#admAdd').onclick=()=>{const n=$('#admNew').value.trim().toLocaleUpperCase('tr');if(!n)return;setPin(n,admNewPin())};
}
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('.tab');if(b&&b.dataset.t==='admin'&&isAdmin())loadAdmin().catch(()=>{})});

/* ---- drivers with the tracking app: name, vehicle, phone, 6-digit PIN; operations and the administrator give them out ---- */
var DRV={};
const drvBox=()=>ROLE==='admin'?$('#admDrv'):ROLE==='ops'?$('#vehDrv'):null;
async function loadDrivers(){if(!SERVER||ROLE==='guide')return;try{const r=await api('GET','/api/drivers');DRV=r.drivers||{};renderDrivers()}catch(e){}}
const drvPin=()=>{const used=new Set(Object.values(DRV).map(d=>String(d.pin)));let p='';while(!p||used.has(p))p=String(100000+Math.floor(Math.random()*900000));return p};
async function saveDrivers(D,msg){try{await api('PUT','/api/drivers',{drivers:D});DRV=D;toast(msg||'Сохранено');renderDrivers();if(isAdmin())loadAdmin().catch(()=>{})}catch(e){toast('Не сохранилось: '+String(e.message).replace(/[{}"]/g,' '));loadDrivers()}}
function drvWa(d){return [`SARABI · Sürücü uygulaması`,`1) Uygulamayı indirin ve kurun: ${APK_URL}`,`   (Google Play Koruma uyarısında "Yine de yükle"ye basın)`,`2) PIN kodunuz: ${d.pin}`,`3) Vardiya başlarken "VARDİYAYI BAŞLAT", bitince "VARDİYAYI BİTİR".`,`Konum yalnızca vardiya süresince paylaşılır.`].join('\n')}
function renderDrivers(){const el=drvBox();if(!el)return;const D=DRV||{};
  const vehs=[...new Set([...(DAY?[...DAY.arr,...DAY.dep].map(g=>g.v):[]),...Object.keys(assign||{})].filter(v=>v&&!/^~/.test(v)))].sort((a,b)=>a.localeCompare(b,'tr',{numeric:true}));
  const rows=Object.entries(D).sort((a,b)=>String(a[1].veh).localeCompare(String(b[1].veh),'tr',{numeric:true}));
  el.innerHTML=`<datalist id="drvVehL">${vehs.map(v=>`<option value="${esc(v)}">`).join('')}</datalist><div class="adm-drv">
    ${rows.map(([id,d])=>{const ph=String(d.phone||'').replace(/\D/g,'').replace(/^0/,'90');
      return `<div class="adm-d"><input data-dv="${esc(id)}|name" value="${esc(d.name)}" placeholder="Имя водителя"><input data-dv="${esc(id)}|veh" value="${esc(d.veh||'')}" list="drvVehL" placeholder="Машина (BUS 3)"><input data-dv="${esc(id)}|phone" value="${esc(d.phone||'')}" placeholder="Телефон" inputmode="tel">
        <b class="num" title="PIN">🔑 ${esc(d.pin)}</b><span class="b"><button type="button" class="btn sm" data-dvpin="${esc(id)}" title="Новый PIN">🎲</button>${ph.length>=10?`<a class="btn sm wa-go" target="_blank" rel="noopener" href="https://wa.me/${esc(ph)}?text=${encodeURIComponent(drvWa(d))}">WhatsApp</a>`:`<button type="button" class="btn sm" data-dvcopy="${esc(id)}">📋 Текст</button>`}<button type="button" class="btn sm ghost" data-dvdel="${esc(id)}" title="Удалить">✕</button></span></div>`}).join('')||'<p class="hint">Водителей пока нет.</p>'}
    <div class="adm-d"><input data-dvnew="name" placeholder="Новый водитель: имя"><input data-dvnew="veh" list="drvVehL" placeholder="Машина"><input data-dvnew="phone" placeholder="Телефон" inputmode="tel"><span></span><span class="b"><button type="button" class="btn primary" data-dvadd>+ Добавить</button></span></div></div>
    <p class="hint">Приложение (Android): <a href="${APK_URL}" target="_blank" rel="noopener">sarabi-driver.apk</a> · проверить в браузере: <a href="/driver.html" target="_blank" rel="noopener">/driver.html</a></p>`;
  el.querySelectorAll('[data-dv]').forEach(i=>i.onchange=()=>{const [id,f]=i.dataset.dv.split('|');const N=JSON.parse(JSON.stringify(D));N[id][f]=i.value.trim();if(f==='veh')N[id][f]=N[id][f].toLocaleUpperCase('tr');saveDrivers(N,'Водитель сохранён')});
  el.querySelectorAll('[data-dvpin]').forEach(b=>b.onclick=()=>{const N=JSON.parse(JSON.stringify(D));N[b.dataset.dvpin].pin=drvPin();saveDrivers(N,'Новый PIN: '+N[b.dataset.dvpin].pin+' — отправьте водителю')});
  el.querySelectorAll('[data-dvcopy]').forEach(b=>b.onclick=()=>copy(drvWa(D[b.dataset.dvcopy]),true));
  el.querySelectorAll('[data-dvdel]').forEach(b=>b.onclick=()=>{const d=D[b.dataset.dvdel];if(!confirm(T('Удалить водителя?')+' '+d.name))return;const N=JSON.parse(JSON.stringify(D));delete N[b.dataset.dvdel];saveDrivers(N,'Водитель удалён')});
  el.querySelector('[data-dvadd]').onclick=()=>{const v=k=>el.querySelector(`[data-dvnew="${k}"]`).value.trim();const name=v('name');if(!name)return toast('Впишите имя водителя');
    const N=JSON.parse(JSON.stringify(D));const id='d'+Date.now().toString(36);N[id]={name,veh:v('veh').toLocaleUpperCase('tr'),phone:v('phone'),pin:drvPin()};saveDrivers(N,`Водитель добавлен, PIN ${N[id].pin}`)}}
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('.tab');if(b&&(b.dataset.t==='veh'&&ROLE==='ops'||b.dataset.t==='admin'&&isAdmin()))loadDrivers()});
