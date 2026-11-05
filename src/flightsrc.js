/* ---------- flight data services: which one follows arrivals and departures, how much of the monthly quota is left ---------- */
// office: opens from the quota line in the header; administrator: in the 🔐 Admin cabinet
let PROV=null,provOpen=false;
const PMODES=[['auto','Авто'],['AirLabs','AirLabs'],['Aviationstack','Aviationstack'],['off','Выкл']];
async function loadProv(){if(!SERVER||!isOps())return;try{PROV=await api('GET','/api/flights/providers');renderProv()}catch(e){}}
async function setProv(patch){try{PROV=await api('PUT','/api/flights/providers',Object.assign({arr:PROV.cfg.arr,dep:PROV.cfg.dep},patch));toast('Сохранено: прилёты — '+PROV.cfg.arr+', вылеты — '+PROV.cfg.dep);renderProv();refreshLive().catch(()=>{})}catch(e){toast('Не сохранилось: '+String(e.message).replace(/[{}"]/g,' '))}}
const daysTo=iso=>Math.max(0,Math.ceil((Date.parse(iso+'T00:00:00+03:00')-Date.now())/864e5));
function provHtml(){if(!PROV)return '<p class="hint">Загрузка…</p>';const P=PROV.providers,c=PROV.cfg;
  const card=p=>{const x=P[p];const pct=x.limit?Math.round(x.used/x.limit*100):0;const used=[x.last&&('прилёты '+hm(x.last)),x.lastDep&&('вылеты '+hm(x.lastDep))].filter(Boolean).join(', ');
    const role=[c.arr!=='off'&&PROV.now.arr===p?'✈ прилёты':'',c.dep!=='off'&&PROV.now.dep===p?'🛫 вылеты':''].filter(Boolean).join(' + ');
    return `<div class="pv${x.key?'':' nokey'}${role?' on':''}"><div class="pv-h"><b>${p}</b>${role?`<span class="chip ok">сейчас: ${role}</span>`:''}${x.key?'':'<span class="chip">ключа нет</span>'}</div>
      ${x.key?`<div class="pv-q"><span class="bar"><i style="width:${Math.min(100,pct)}%;background:${pct>=90?'var(--crit)':pct>=70?'var(--warn)':'var(--signal)'}"></i></span><span><b>${x.left}</b> осталось из ${x.limit} · использовано ${x.used} · сегодня ${x.today}</span></div>
        <div class="hint">${used?'последний запрос: '+used:'в этом месяце запросов ещё не было'}</div>${x.basic?'<div class="pv-w">⚠ бесплатный тариф AirLabs даёт только расписание, без задержек — в режиме «Авто» прилёты берутся из Aviationstack</div>':''}
        <label class="pv-l">Лимит в месяц по тарифу <input type="number" min="1" step="1" value="${x.limit}" data-pvlim="${p}"></label>`
      :`<div class="hint">Чтобы подключить: ключ ${p==='AirLabs'?'AIRLABS_KEY':'AVIATIONSTACK_KEY'} в Netlify → Environment variables, затем обновить сайт.</div>`}</div>`};
  const modes=(dir,lbl)=>`<div class="pv-m"><span class="pv-ml">${lbl}</span><div class="seg">${PMODES.map(([v,t])=>{const dis=(v==='AirLabs'||v==='Aviationstack')&&!P[v].key;return `<button type="button" data-pvdir="${dir}" data-pvm="${v}" aria-pressed="${c[dir]===v}"${dis?' disabled title="Нет ключа"':''}>${t}</button>`}).join('')}</div>
    <span class="hint">${c[dir]==='off'?'не отслеживаются':PROV.now[dir]?'работает: <b>'+PROV.now[dir]+'</b>':'<b style="color:var(--crit)">нет доступного сервиса</b>'}</span></div>`;
  return `<div class="pv-top"><b>✈️ Сервисы рейсов</b><span class="hint">лимиты обновятся ${isoDM(PROV.reset)} (через ${daysTo(PROV.reset)} дн.)</span><span class="sp"></span><button type="button" class="btn sm ghost" data-pvreload>⟳</button></div>
    <div class="pv-grid">${['AirLabs','Aviationstack'].map(card).join('')}</div>
    ${modes('arr','Прилёты · Arrival')}${modes('dep','Вылеты · Depar')}
    <p class="hint">«Авто»: сначала AirLabs, если он без живых данных, исчерпан или с ошибкой — Aviationstack. Выбрали сервис — работает только он.${c.changedAt?` Изменено ${new Date(c.changedAt).toLocaleString('ru',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} (${esc(c.changedBy||'')}).`:''}</p>
    ${PROV.lastError?`<p class="pv-w">Последняя ошибка: ${esc(PROV.lastError)}</p>`:''}`}
function renderProv(){[['#provPanel',provOpen&&ROLE==='ops'],['#admProv',isAdmin()]].forEach(([id,show])=>{const el=$(id);if(!el)return;el.hidden=!show;if(!show)return;el.innerHTML=provHtml();
  el.querySelectorAll('[data-pvm]').forEach(b=>b.onclick=()=>setProv({[b.dataset.pvdir]:b.dataset.pvm}));
  el.querySelectorAll('[data-pvlim]').forEach(i=>i.onchange=()=>setProv({limits:{[i.dataset.pvlim]:+i.value}}));
  const r=el.querySelector('[data-pvreload]');if(r)r.onclick=loadProv})}
// the quota line in the header opens the panel
(()=>{const q=$('#liveQuota');if(!q)return;q.classList.add('pv-open');q.title='Нажмите: сервисы рейсов, лимиты, выбор для прилётов и вылетов';
  q.onclick=()=>{provOpen=!provOpen;if(provOpen)loadProv();renderProv()}})();
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('.tab');if(b&&b.dataset.t==='admin')loadProv()});
