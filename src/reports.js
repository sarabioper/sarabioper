/* ---------- incident reports (рапорты): written by guides or the office, kept by date ---------- */
// REPORTS[id] = {id, date:'2026-11-02', at:ISO, author, topic, ref, guest, text}
let REPORTS=store.get('reports',{}),repLast=0,repDate=null,repEdit=null;
const REP_TOPICS=['Гость снят / выгнан','Гость не пришёл','Опоздание','Жалоба гостя','Проблема с машиной','Здоровье / травма','Потеря вещей или документов','Другое'];
const repList=iso=>Object.values(REPORTS).filter(r=>r&&r.date===iso).sort((a,b)=>String(b.at).localeCompare(String(a.at)));
async function pullReports(force){if(!SERVER)return;if(!force&&Date.now()-repLast<8000)return;
  try{const r=await api('GET','/api/state?d=00.00&kind=reports');const s=JSON.stringify(REPORTS);REPORTS=r.data||{};if(JSON.stringify(REPORTS)!==s||force){store.set('reports',REPORTS);renderReports()}}catch(e){}}
function saveReport(rep){if(rep.del){delete REPORTS[rep.id]}else REPORTS[rep.id]=rep;store.set('reports',REPORTS);repLast=Date.now();renderReports();
  if(SERVER)api('PUT','/api/state?d=00.00&kind=reports',{[rep.id]:rep.del?null:rep}).catch(()=>toast('Нет связи с сервером, рапорт сохранён только на этом телефоне'))}
const repTime=r=>{try{return new Date(r.at).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'})}catch(e){return ''}};
function repWa(r){const tr=LANG==='tr';return [`📝 *${tr?'RAPOR':'РАПОРТ'} · ${isoDM(r.date)} ${repTime(r)}*`,`${tr?'Konu':'Тема'}: ${trText(r.topic)}`,r.ref?`${tr?'Uçuş / otobüs / otel':'Рейс / автобус / отель'}: ${r.ref}`:'',r.guest?`${tr?'Misafir':'Гость'}: ${r.guest}`:'',`${tr?'Yazan':'Автор'}: ${r.author||'-'}`,'',r.text].filter((x,i)=>x||i===5).join('\n')}
function repCard(r){const mine=isOps();return `<article class="rep"><div class="rep-h"><span class="num">${repTime(r)}</span><span class="chip rep-t">${esc(r.topic)}</span><b>${r.author?gTag(r.author):'—'}</b></div>
  ${r.ref||r.guest?`<div class="rep-m">${r.ref?`<span>✈️/🚌 ${esc(r.ref)}</span>`:''}${r.guest?`<span>👤 ${esc(r.guest)}</span>`:''}</div>`:''}
  <div class="rep-x">${esc(r.text)}</div>
  <div class="rep-a"><button type="button" class="btn sm" data-repwa="${esc(r.id)}">📋 В WhatsApp</button>${mine?`<button type="button" class="btn sm ghost" data-repdel="${esc(r.id)}">🗑 Удалить</button>`:''}</div></article>`}
function bindRep(el){
  el.querySelectorAll('[data-repwa]').forEach(b=>b.onclick=()=>copy(repWa(REPORTS[b.dataset.repwa]),true));
  el.querySelectorAll('[data-repdel]').forEach(b=>b.onclick=()=>{if(!confirm(T('Удалить этот рапорт?')))return;saveReport({id:b.dataset.repdel,del:true});toast('Рапорт удалён')})}
// the form: same for a guide (author = the chosen guide) and the office
function repOpen(where,pre={},anchor=null){const today=pre.date||isoToday();
  const flights_=typeof flights!=='undefined'&&DAY?[...new Set(flights.map(f=>f.code).filter(c=>!/^[!?]/.test(c)))]:[];
  const buses=(()=>{try{return tours().filter(t=>dayOfTour(t,today)).map(t=>t.bus)}catch(e){return []}})();
  const hotels=DAY?[...new Set([...DAY.arr,...DAY.dep].map(g=>g.h))]:[];
  repEdit={where,author:pre.author||(where==='guide'?(curGuide||''):(uName()||'Офис'))};
  const el=$('#repForm');if(anchor){anchor.after(el)}else if(where==='ops'){$('#repBox').open=true;$('#repBox').appendChild(el)}else document.querySelector('.rep-bar').after(el);el.hidden=false;
  el.innerHTML=`<h3>📝 Рапорт</h3><div class="xg">
    <label>Дата<input type="date" id="repD" value="${today}"></label>
    <label>Тема<select id="repT">${REP_TOPICS.map(t=>`<option>${esc(t)}</option>`).join('')}</select></label>
    <label>Кто пишет<input id="repA" value="${esc(repEdit.author)}" list="repAL"></label>
    <label>Рейс / автобус / отель<input id="repR" list="repRL" value="${esc(pre.ref||'')}" placeholder="PC 2010, BUS 3, Casa Fora…"></label>
    <label class="xw">Гость (если про гостя)<input id="repG" value="${esc(pre.guest||'')}" placeholder="Фамилия Имя"></label>
    <label class="xw">Что случилось *<textarea id="repX" rows="5" placeholder="Коротко и по порядку: что произошло, во сколько, кто был рядом, что сделали"></textarea></label></div>
    <datalist id="repRL">${[...flights_,...buses,...hotels].map(v=>`<option value="${esc(v)}">`).join('')}</datalist>
    <datalist id="repAL">${(typeof guides==='function'&&DAY?guides():[]).map(v=>`<option value="${esc(v)}">`).join('')}</datalist>
    <p class="xact"><span class="hint">Рапорт увидит операционный отдел в «Контроле», по дате</span><span class="sp"></span><button type="button" class="btn" id="repC">Отмена</button><button type="button" class="btn primary" id="repS">Отправить рапорт</button></p>`;
  el.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>{const x=$('#repX');if(x)x.focus()},300);
  $('#repC').onclick=()=>{el.hidden=true;el.innerHTML='';repEdit=null};
  $('#repS').onclick=()=>{const text=$('#repX').value.trim();if(text.length<3)return toast('Опишите, что случилось');const date=$('#repD').value||today;
    const r={id:'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),date,at:new Date().toISOString(),author:$('#repA').value.trim(),topic:$('#repT').value,ref:$('#repR').value.trim(),guest:$('#repG').value.trim(),text};
    saveReport(r);repEdit=null;toast('Рапорт отправлен');
    // right away: send it on WhatsApp too
    el.innerHTML=`<h3>✓ Рапорт отправлен</h3>${repCard(r)}<p class="xact"><a class="btn wa-go" id="repGo" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(repWa(r))}">WhatsApp ➜</a><span class="sp"></span><button type="button" class="btn" id="repDone">Готово</button></p>`;
    bindRep(el);$('#repDone').onclick=()=>{el.hidden=true;el.innerHTML='';try{tourRefresh()}catch(e){}}}}
// where reports are shown: the office (Control, any date) and the guide's own for today
function renderReports(){
  const iso=repDate||(DAY&&DAY.iso)||isoToday();const L=repList(iso);
  const lbl=$('#repDate');if(lbl)lbl.innerHTML=`<b>${isoDM(iso)}</b> <small>${iso===isoToday()?'сегодня':isoWd(iso)}</small>`;
  const box=$('#repList');if(box){box.innerHTML=L.length?L.map(repCard).join(''):'<p class="hint">За этот день рапортов нет.</p>';bindRep(box)}
  const n=$('#repN');if(n)n.textContent=L.length;
  const tc=$('#repCnt');if(tc){const k=repList(isoToday()).length;tc.textContent=k;tc.hidden=!k}
  const mine=$('#repMine');if(mine){const g=curGuide||'';const my=repList(isoToday()).filter(r=>g&&gKey(r.author||'')===gKey(g));
    mine.innerHTML=my.length?`<details class="rep-my"><summary>Мои рапорты сегодня: ${my.length}</summary>${my.map(repCard).join('')}</details>`:'';bindRep(mine)}}
$('#repNew').onclick=()=>repOpen('guide');
$('#repNewOps').onclick=()=>{repOpen('ops')};
$('#repPrev').onclick=()=>{repDate=isoAdd(repDate||(DAY&&DAY.iso)||isoToday(),-1);renderReports()};
$('#repNext').onclick=()=>{repDate=isoAdd(repDate||(DAY&&DAY.iso)||isoToday(),1);renderReports()};
$('#repToday').onclick=()=>{repDate=isoToday();renderReports()};
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('.tab');if(b&&(b.dataset.t==='ops'||b.dataset.t==='guide')){pullReports(true);renderReports()}if(b&&b.dataset.t==='ops'){try{renderCtl();renderSalesAdm();pullSales();pullTours(true)}catch(e){}}});
pullReports(true);renderReports();

/* ---------- jump to the top / bottom of long pages ---------- */
(()=>{const box=$('#scrollFab');if(!box)return;
  const upd=()=>{const long=document.documentElement.scrollHeight>innerHeight*1.6;box.hidden=!long||document.body.classList.contains('sc-open');
    $('#toTop').disabled=scrollY<200;$('#toBottom').disabled=scrollY+innerHeight>document.documentElement.scrollHeight-200};
  $('#toTop').onclick=()=>scrollTo({top:0,behavior:'smooth'});
  $('#toBottom').onclick=()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'smooth'});
  addEventListener('scroll',()=>requestAnimationFrame(upd),{passive:true});addEventListener('resize',upd);
  new MutationObserver(()=>requestAnimationFrame(upd)).observe(document.querySelector('main')||document.body,{childList:true,subtree:true});upd()})();
