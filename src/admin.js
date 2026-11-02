/* ---------- admin cabinet: the one person who gives access (passwords, guide PINs) ---------- */
let ADM={passwords:{ops:'',guide:''},fromEnv:{},pins:{},log:[]},admShow={},admDirty=false;
async function loadAdmin(){const r=await api('GET','/api/admin');ADM=r;PINS=r.pins||{};admDirty=false;renderAdmin()}
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
    <div class="adm-add"><input id="admNew" placeholder="Новый гид: имя как в Araç-листе"><button type="button" class="btn" id="admAdd">+ Добавить</button><span class="sp"></span><button type="button" class="btn primary" id="admSavePins"${admDirty?'':' disabled'}>Сохранить PIN-коды</button></div>`;
  $('#admLog').innerHTML=`<div class="adm-log">${(ADM.log||[]).map(l=>`<div><span class="num hint">${new Date(l.at).toLocaleString('ru',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span> ${esc(l.what)}</div>`).join('')||'<p class="hint">Пока пусто.</p>'}</div>`;
  const el=$('#v-admin');
  el.querySelectorAll('[data-admeye]').forEach(b=>b.onclick=()=>{admShow[b.dataset.admeye]=!admShow[b.dataset.admeye];renderAdmin()});
  el.querySelectorAll('[data-admpwsave]').forEach(b=>b.onclick=async()=>{const k=b.dataset.admpwsave;const v=el.querySelector(`[data-admpw="${k}"]`).value.trim();
    if(v.length<6)return toast('Пароль — минимум 6 символов');if(!confirm(T('Сменить пароль? Все, кто вошёл со старым паролем, должны будут войти заново.')))return;
    try{await api('PUT','/api/admin',{passwords:{[k]:v}});toast('Пароль изменён');await loadAdmin()}catch(e){toast('Не удалось: '+String(e.message).replace(/[{}"]/g,' '))}});
  const setPin=(n,v)=>{const P=Object.assign({},ADM.pins);if(v)P[n]=v;else delete P[n];ADM.pins=P;admDirty=true;renderAdmin()};
  el.querySelectorAll('[data-admpin]').forEach(i=>i.onchange=()=>setPin(i.dataset.admpin,i.value.replace(/\D/g,'')));
  el.querySelectorAll('[data-admgen]').forEach(b=>b.onclick=()=>setPin(b.dataset.admgen,admNewPin()));
  el.querySelectorAll('[data-admdel]').forEach(b=>b.onclick=()=>setPin(b.dataset.admdel,''));
  $('#admAdd').onclick=()=>{const n=$('#admNew').value.trim().toLocaleUpperCase('tr');if(!n)return;setPin(n,admNewPin())};
  $('#admSavePins').onclick=async()=>{const vals=Object.values(ADM.pins);if(vals.some(v=>v.length<4||v.length>8))return toast('PIN — от 4 до 8 цифр');if(new Set(vals).size!==vals.length)return toast('У двух гидов одинаковый PIN');
    try{await api('PUT','/api/admin',{pins:ADM.pins});toast('PIN-коды сохранены');await loadAdmin()}catch(e){toast('Не удалось: '+String(e.message).replace(/[{}"]/g,' '))}};
}
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('.tab');if(b&&b.dataset.t==='admin'&&isAdmin())loadAdmin().catch(()=>{})});
