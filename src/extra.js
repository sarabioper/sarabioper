/* ---------- guests added by hand on the arrivals board ---------- */
// EXTRA['g:<id>'] = an arrival group like the KAPAK ones, plus manual:true (late booking, urgent add, moved guests)
// EXTRA['mv:<groupId>'] = {to:'PC 2010 14:30', at} : a KAPAK group moved to another flight (hidden from its old flight)
var EXTRA=EXTRA||{},xLastSave=0,xEdit=xEdit||null;
function applyExtra(){if(!DAY)return;
  if(!Object.prototype.hasOwnProperty.call(DAY,'_base'))Object.defineProperty(DAY,'_base',{value:DAY.arr.filter(g=>!g.manual),writable:true,enumerable:false});
  const add=Object.entries(EXTRA||{}).filter(([k,v])=>k.startsWith('g:')&&v&&v.fl&&v.t).map(([,v])=>v);
  if(!Object.prototype.hasOwnProperty.call(DAY,'_baseDep'))Object.defineProperty(DAY,'_baseDep',{value:DAY.dep,writable:true,enumerable:false});
  // EXTRA['rg:<groupId>'] = {g,v,why,at}: the group is met / picked up by another guide or vehicle (late flight etc.)
  const rg=x=>{const o=(EXTRA||{})['rg:'+x.id];if(!o)return x;return Object.assign({},x,{g0:x.g,v0:x.v,g:o.g||x.g,v:o.v||x.v,rgWhy:o.why||'',reassigned:true})};
  DAY.arr=DAY._base.filter(g=>!(EXTRA||{})['mv:'+g.id]).concat(add).map(rg);
  DAY.dep=DAY._baseDep.map(rg)}
function extraChanged(){if(!DAY)return;const keep=['#fVeh','#fHotel','#fOp'].map(s=>$(s).value);
  applyExtra();buildFlights();fillFilters();['#fVeh','#fHotel','#fOp'].forEach((s,i)=>{const el=$(s);if([...el.options].some(o=>o.value===keep[i]))el.value=keep[i]});runChecks();renderAll()}
// write manual guests into any day (tomorrow's KAPAK may not be uploaded yet: they appear once it is)
const isoKey=iso=>iso.slice(8,10)+'.'+iso.slice(5,7);
function putExtra(day,patch){if(day===dayKey)return saveExtra(patch);
  const cur=Object.assign({},store.get('extra_'+day,{}),(DAYS[day]&&DAYS[day].manual)||{});Object.entries(patch).forEach(([k,v])=>{if(v==null)delete cur[k];else cur[k]=v});store.set('extra_'+day,cur);if(DAYS[day])DAYS[day].manual=cur;
  if(SERVER)api('PUT','/api/state?d='+encodeURIComponent(day)+'&kind=extra&iso='+encodeURIComponent(dayIso(day)),patch).catch(()=>toast('Нет связи с сервером, изменения сохранены только здесь'))}
function saveExtra(patch){Object.entries(patch).forEach(([k,v])=>{if(v==null)delete EXTRA[k];else EXTRA[k]=v});store.set('extra_'+dayKey,EXTRA);xLastSave=Date.now();extraChanged();
  if(SERVER)api('PUT','/api/state?d='+encodeURIComponent(dayKey)+'&kind=extra&iso='+encodeURIComponent(dayIso(dayKey)),patch).catch(()=>toast('Нет связи с сервером, изменения сохранены только здесь'))}
async function pullExtra(){if(!SERVER||!DAY||document.hidden||Date.now()-xLastSave<8000||xEdit)return;
  try{const k=dayKey;const r=await api('GET','/api/state?d='+encodeURIComponent(k)+'&kind=extra');if(k!==dayKey)return;const srv=r.data||{};
    if(JSON.stringify(srv)!==JSON.stringify(EXTRA)){EXTRA=srv;store.set('extra_'+k,EXTRA);extraChanged()}}catch(e){}}


const xUp=s=>String(s||'').trim().toLocaleUpperCase('tr');
function xGuests(text){return String(text||'').split(/\n+/).map(l=>l.trim()).filter(Boolean).map(l=>{const m=l.match(/^(Mrs?|Ms|Miss|Mstr|Chd|Inf|Г-ж[аи]|Г-н)\.?\s+(.+)$/i);return m?[m[1],m[2].toUpperCase(),'']:['',l.toUpperCase(),'']})}
const xGuestText=p=>(p||[]).map(x=>[x[0],x[1]].filter(Boolean).join(' ')).join('\n');
function xOpen(g,moveFrom){
  xEdit={g:Object.assign({fl:'',t:'',org:'',term:'',h:'',v:'',g:'',op:'',p:[],pax:'',note:''},g||{}),moveFrom:moveFrom||null,day:dayKey,iso:dayIso(dayKey),orig:g&&g.id?dayKey:null};
  if(moveFrom){xEdit.g.fl='';xEdit.g.t='';xEdit.g.org='';xEdit.g.term=''}
  xRender();const f=$('#xForm');f.hidden=false;f.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>{const i=f.querySelector('[data-x=fl]');if(i)i.focus()},250)}
function xClose(){xEdit=null;$('#xForm').hidden=true;$('#xForm').innerHTML=''}
function xRender(){const e=xEdit,g=e.g,el=$('#xForm');
  const uniq=a=>[...new Set(a.filter(Boolean))].sort((x,y)=>String(x).localeCompare(String(y),'tr',{numeric:true}));
  const dl=(id,vals)=>`<datalist id="${id}">${vals.map(v=>`<option value="${esc(v)}">`).join('')}</datalist>`;
  const all=(DAY._base||DAY.arr);
  const title=e.moveFrom?`✈ Перенести на другой рейс: ${esc(e.moveFrom.h)} · ${groupTotal(e.moveFrom)} чел. (был ${esc(normFl(e.moveFrom.fl))} ${esc(e.moveFrom.t)})`:g.id?'✎ Изменить добавленных гостей':'+ Добавить гостей на рейс';
  el.innerHTML=`<h3>${title}</h3>
    <div class="xg">
      <label>Рейс *<input data-x="fl" value="${esc(g.fl)}" placeholder="PC 2010" list="xFl" autocomplete="off"></label>
      <label>Дата прилёта *<input data-xd type="date" value="${esc(e.iso)}"></label>
      <label>Время прилёта *<input data-x="t" type="time" value="${esc(g.t)}"></label>
      <label>Откуда (код аэропорта)<input data-x="org" value="${esc(g.org)}" placeholder="SAW, VKO, ALA…" list="xOrg" autocomplete="off"></label>
      <label>Терминал<select data-x="term"><option value="">—</option><option value="DIŞ"${g.term==='DIŞ'?' selected':''}>DIŞ HATLAR T2</option><option value="İÇ"${g.term==='İÇ'?' selected':''}>İÇ HATLAR</option></select></label>
      <label>Отель *<input data-x="h" value="${esc(g.h)}" list="xH" autocomplete="off"></label>
      <label>Оператор<input data-x="op" value="${esc(g.op==='—'?'':g.op)}" list="xOp" autocomplete="off"></label>
      <label>Машина<input data-x="v" value="${esc(g.v)}" list="xV" autocomplete="off" placeholder="MİNİ 6"></label>
      <label>Гид<input data-x="g" value="${esc(g.g)}" list="xG" autocomplete="off"></label>
      <label class="xw">Гости — по одному в строке<textarea data-x="p" rows="3" placeholder="Mr IVANOV IVAN&#10;Mrs IVANOVA ANNA">${esc(xGuestText(g.p))}</textarea></label>
      <label>Всего человек<input data-x="pax" type="number" min="1" inputmode="numeric" value="${esc(g.pax)}" placeholder="по списку"></label>
      <label class="xw">Примечание<input data-x="note" value="${esc(g.note)}" placeholder="например: опоздали на KC 215, летят следующим"></label>
    </div>
    ${dl('xFl',uniq(all.map(x=>normFl(x.fl)).filter(f=>!/^[!?]/.test(f))))}${dl('xOrg',uniq(Object.keys(CITY)))}${dl('xH',uniq(all.map(x=>x.h)))}${dl('xOp',uniq(all.map(x=>x.op).filter(o=>o!=='—')))}${dl('xV',uniq([...all,...DAY.dep].map(x=>x.v)))}${dl('xG',uniq([...all.map(x=>x.g),...gpKeys()]))}
    <p class="xact"><span class="hint" id="xHint"></span><span class="sp"></span><button type="button" class="btn" id="xCancel">Отмена</button><button type="button" class="btn primary" id="xSave">${e.moveFrom?'Перенести':'Сохранить'}</button></p>`;
  const dayHint=()=>{const k=e.day;$('#xHint').textContent=k===dayKey?'':DAYS[k]?T('Гости будут добавлены на')+' '+k+' — '+T('откройте этот день в барабане, чтобы увидеть'):T('KAPAK на')+' '+k+' '+T('ещё не загружен — гости появятся, когда его загрузите')};
  el.querySelector('[data-xd]').onchange=ev=>{const v=ev.target.value;if(!/^\d{4}-\d\d-\d\d$/.test(v))return;e.iso=v;e.day=isoKey(v);dayHint()};
  el.querySelectorAll('[data-x]').forEach(i=>i.oninput=i.onchange=()=>{const k=i.dataset.x;g[k]=i.value;
    if((k==='fl'||k==='t')&&e.day!==dayKey){dayHint();return}
    if(k==='fl'||k==='t'){// same flight already on the board: take its time, city and terminal
      const f=flights.find(f=>normFl(f.code)===normFl(xUp(i.value).replace(/\s+/g,' ')));
      if(f){if(!g.t){g.t=f.t;el.querySelector('[data-x=t]').value=f.t}if(!g.org&&f.org){g.org=f.org;el.querySelector('[data-x=org]').value=f.org}const tm=(f.groups.find(x=>x.term)||{}).term;if(tm&&!g.term){g.term=tm;el.querySelector('[data-x=term]').value=tm}$('#xHint').textContent=g.t&&g.t!==f.t?T('На табло этот рейс в')+' '+f.t+' — '+T('проверьте время'):T('Этот рейс уже есть на табло — гости добавятся к нему')}else $('#xHint').textContent=''}
    if(k==='org'&&!g.term){const o=xUp(i.value);if(o.length===3){g.term=DOMESTIC.has(o)?'İÇ':'DIŞ';el.querySelector('[data-x=term]').value=g.term}}});
  $('#xCancel').onclick=xClose;
  $('#xSave').onclick=()=>{
    const fl=normFl(xUp(g.fl).replace(/\s+/g,' '));if(!/^[A-Z0-9]{2}\s?\d{1,4}[A-Z]?$/.test(fl))return toast('Впишите номер рейса, например PC 2010');
    if(!/^\d\d:\d\d$/.test(g.t))return toast('Впишите время прилёта');if(!String(g.h).trim())return toast('Впишите отель');
    const p=Array.isArray(g.p)?g.p:xGuests(g.p);const pax=Math.max(+g.pax||0,p.length);if(!pax)return toast('Впишите гостей или число человек');
    const id=g.id||('x'+Date.now().toString(36)+Math.random().toString(36).slice(2,5));
    const out={id,manual:true,t:g.t,fl,org:xUp(g.org),to:'AYT',h:String(g.h).trim(),v:xUp(g.v),g:xUp(g.g),op:String(g.op||'').trim()||'—',term:g.term||(DOMESTIC.has(xUp(g.org))?'İÇ':xUp(g.org)?'DIŞ':''),p,pax,note:String(g.note||'').trim(),src:g.src||null,by:nowMinutes()};
    const patch={['g:'+id]:out};
    const td=e.day,other=td!==dayKey;const here={};
    if(e.moveFrom){const m=e.moveFrom;out.src=m.id;out.srcDay=dayKey;if(!out.note)out.note=`перенесены с ${normFl(m.fl)} ${m.t}${other?' ('+dayKey+')':''}`;here['mv:'+m.id]={to:fl+' '+g.t+(other?' '+td:''),at:nowMinutes()};
      // carry the guide's marks over to the new group (same day only: marks belong to a day)
      if(!other&&met[m.id]){met[id]=Object.assign({},met[m.id]);saveMet()}}
    // an edited group moved to another date leaves this day
    if(e.orig&&other)here['g:'+id]=null;
    if(other){delete patch['g:'+id];putExtra(td,{['g:'+id]:out})}
    const fk=fl+'|'+g.t;if(!other)OPENF.add(fk);xEdit=null;saveExtra(Object.assign(here,patch));xClose();
    toast((e.moveFrom?`Перенесены на ${fl} ${g.t}`:`Добавлено на ${fl} ${g.t}: ${pax} чел.`)+(other?` · ${td}`+(DAYS[td]?'':' — '+T('появятся, когда загрузите KAPAK')):''));
    setTimeout(()=>{const a=document.querySelector(`#board article.flight[data-fk="${CSS.escape(fk)}"]`);if(a)a.scrollIntoView({behavior:'smooth',block:'center'})},150)};
}
// buttons under the guest list of an open flight: move a KAPAK group, or change / remove a manual one
function xActs(gs){return `<div class="xacts">${gs.map(g=>g.manual
  ?`<span class="xa"><b>${esc(g.h)}</b> <span class="chip man">✍ добавлено вручную</span><button type="button" class="btn sm" data-xedit="${esc(g.id)}">✎ Изменить</button><button type="button" class="btn sm ghost" data-xdel="${esc(g.id)}">🗑 Удалить</button></span>`
  :`<span class="xa"><b>${esc(g.h)}</b> · ${groupTotal(g)} чел.<button type="button" class="btn sm" data-xmove="${esc(g.id)}">✈ Перенести на другой рейс</button></span>`).join('')}</div>`}
function bindXActs(root){
  root.querySelectorAll('[data-xedit]').forEach(b=>b.onclick=e=>{e.stopPropagation();const g=EXTRA['g:'+b.dataset.xedit];if(g)xOpen(JSON.parse(JSON.stringify(g)))});
  root.querySelectorAll('[data-xdel]').forEach(b=>b.onclick=e=>{e.stopPropagation();const g=EXTRA['g:'+b.dataset.xdel];if(!g)return;
    if(!confirm(T(g.src?'Удалить перенос? Гости вернутся на свой прежний рейс.':'Удалить этих гостей с табло?')))return;saveExtra({['g:'+g.id]:null});if(g.src)putExtra(g.srcDay||dayKey,{['mv:'+g.src]:null});toast(g.src?'Гости возвращены на прежний рейс':'Удалено')});
  root.querySelectorAll('[data-xmove]').forEach(b=>b.onclick=e=>{e.stopPropagation();const g=(DAY._base||DAY.arr).find(x=>x.id===b.dataset.xmove);if(g)xOpen({h:g.h,v:g.v,g:g.g,op:g.op,p:JSON.parse(JSON.stringify(g.p||[])),pax:g.pax,note:'',src:g.id},g)})}
$('#xAdd').onclick=()=>{if(!DAY)return toast('Сначала загрузите день');xOpen()};

/* ---------- hand a flight's guests to another guide / vehicle (late flight: the evening guide meets them) ---------- */
var RG=RG||{key:null,sel:null,g:'',v:'',why:'',done:''};
function rgBusy(g,f){// what this guide already does around the new landing time
  const eta=f.eta;const ts=buildTasks(t=>t.g===g).filter(t=>!t.groups.some(x=>f.groups.includes(x)));
  return ts.filter(t=>Math.abs(t.time-eta)<=90).map(t=>`${fmt(t.time)} ${t.kind==='arr'?'встреча '+(t.f?t.f.code:normFl(t.groups[0].fl)):'сбор '+t.groups[0].h}`)}
function rgHtml(f,gs){
  if(RG.done)return `<div class="rgform"><h3>✓ Гости переданы</h3><pre class="rg-msg">${esc(RG.done)}</pre><p class="xact"><button type="button" class="btn" data-rgcopy>📋 Скопировать для WhatsApp</button><a class="btn wa-go" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(RG.done)}">WhatsApp ➜</a><span class="sp"></span><button type="button" class="btn" data-rgclose>Готово</button></p></div>`;
  if(!RG.sel)RG.sel=new Set(gs.map(g=>g.id));
  const all=[...new Set([...guides(),...gpKeys()])];
  const rows=all.map(g=>({g,busy:rgBusy(g,f),today:guides().includes(g)})).sort((a,b)=>(a.busy.length-b.busy.length)||(b.today-a.today)||a.g.localeCompare(b.g,'tr'));
  const vehs=[...new Set([...DAY.arr,...DAY.dep].map(x=>x.v).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr',{numeric:true}));
  const cur=[...new Set(gs.map(g=>g.g).filter(Boolean))].join(', ');
  return `<div class="rgform" data-fk="${esc(f.key)}"><h3>🔄 Передать гостей другому гиду · ${esc(f.code)}${f.delay?` <span class="dchip part">посадка ${fmt(f.eta)} (+${f.delay} мин)</span>`:''}</h3>
    <div class="rg-g">${gs.map(g=>`<label class="rg-row"><input type="checkbox" data-rgsel="${esc(g.id)}" ${RG.sel.has(g.id)?'checked':''}> <b>${esc(g.h)}</b> · ${groupTotal(g)} чел. · ${esc(g.op||'')} · <span class="hint">сейчас: ${esc(g.g||'гид не указан')} · ${esc(g.v||'без машины')}</span>${g.reassigned?' <span class="chip man">🔄 уже передано</span>':''}</label>`).join('')}</div>
    <div class="xg"><label>Новый гид<input data-rgf="g" value="${esc(RG.g)}" list="rgGL" placeholder="фамилия или имя" autocomplete="off"></label>
      <label>Машина (пусто — не менять)<input data-rgf="v" value="${esc(RG.v)}" list="rgVL" placeholder="MİNİ 6" autocomplete="off"></label>
      <label class="xw">Причина<input data-rgf="why" value="${esc(RG.why||(f.delay?'рейс задержан до '+fmt(f.eta):''))}"></label></div>
    <datalist id="rgGL">${all.map(g=>`<option value="${esc(g)}">`).join('')}</datalist><datalist id="rgVL">${vehs.map(v=>`<option value="${esc(v)}">`).join('')}</datalist>
    <div class="hint" style="margin:8px 0 4px">Кто свободен около ${fmt(f.eta)}:</div>
    <div class="rg-pick">${rows.slice(0,14).map(r=>`<button type="button" class="rgp ${r.busy.length?'busy':'free'}${RG.g===r.g?' on':''}" data-rgpick="${esc(r.g)}"><b>${esc(r.g)}</b><small>${r.busy.length?'занят: '+esc(r.busy.join(', ')):(r.today?'свободен':'сегодня без заданий')}</small></button>`).join('')}</div>
    <p class="xact"><span class="hint">Сейчас встречает: ${esc(cur||'—')}</span><span class="sp"></span>${gs.some(g=>g.reassigned)?`<button type="button" class="btn ghost" data-rgundo>↩ Вернуть как было</button>`:''}<button type="button" class="btn" data-rgcancel>Отмена</button><button type="button" class="btn primary" data-rgsave>Передать</button></p></div>`}
function bindRg(root){
  const f=RG.key&&flights.find(x=>x.key===RG.key);
  root.querySelectorAll('[data-rga]').forEach(b=>b.onclick=e=>{e.stopPropagation();const k=b.dataset.rga;RG={key:RG.key===k?null:k,sel:null,g:'',v:'',why:'',done:''};renderBoard()});
  if(!f)return;
  root.querySelectorAll('[data-rgsel]').forEach(c=>c.onchange=()=>{c.checked?RG.sel.add(c.dataset.rgsel):RG.sel.delete(c.dataset.rgsel)});
  root.querySelectorAll('[data-rgf]').forEach(i=>i.oninput=()=>{RG[i.dataset.rgf]=i.value;if(i.dataset.rgf==='g')root.querySelectorAll('[data-rgpick]').forEach(b=>b.classList.toggle('on',b.dataset.rgpick===i.value))});
  root.querySelectorAll('[data-rgpick]').forEach(b=>b.onclick=()=>{RG.g=b.dataset.rgpick;const i=root.querySelector('[data-rgf=g]');if(i)i.value=RG.g;root.querySelectorAll('[data-rgpick]').forEach(x=>x.classList.toggle('on',x===b))});
  root.querySelectorAll('[data-rgcancel],[data-rgclose]').forEach(b=>b.onclick=()=>{RG={key:null};renderBoard()});
  root.querySelectorAll('[data-rgcopy]').forEach(b=>b.onclick=()=>copy(RG.done,true));
  root.querySelectorAll('[data-rgundo]').forEach(b=>b.onclick=()=>{const patch={};f.groups.forEach(g=>{if(g.reassigned)patch['rg:'+g.id]=null});RG={key:null};saveExtra(patch);toast('Гид и машина возвращены как в KAPAK')});
  root.querySelectorAll('[data-rgsave]').forEach(b=>b.onclick=()=>{
    const g=xUp(RG.g).replace(/\s+/g,' ');if(!g)return toast('Выберите нового гида');const sel=f.groups.filter(x=>RG.sel.has(x.id));if(!sel.length)return toast('Отметьте, какие группы передать');
    const v=xUp(RG.v).replace(/^(BUS|MİNİ|MİN|MİDİ)(\d)/,'$1 $2');const why=String(RG.why||(f.delay?'рейс задержан до '+fmt(f.eta):'')).trim();
    const patch={};sel.forEach(x=>{patch['rg:'+x.id]={g,v:v||'',why,at:nowMinutes()}});
    const old=[...new Set(sel.map(x=>x.g0||x.g).filter(Boolean))].join(', ');const pax=sel.reduce((a,x)=>a+groupTotal(x),0);const tr=LANG==='tr';
    const vv=v||[...new Set(sel.map(x=>x.v))].join(', ');const a=assign[vv]||{};
    RG.done=[`🔄 *${f.code}* ${tr?(CITY_TR[f.org]||f.org||''):(CITY[f.org]||f.org||'')} · ${tr?'iniş':'посадка'} *${fmt(f.eta)}*${f.delay?` (${tr?'plan':'план'} ${f.t})`:''}`,
      `${tr?'Karşılayan':'Встречает'}: *${g}*${gPhone(g)?' '+gPhone(g):''}${old?` (${tr?'önceki':'вместо'} ${old})`:''}`,
      `${tr?'Araç':'Машина'}: ${vv||'-'}${a.plate?' · '+a.plate:''}${a.phone?' · '+(tr?'şoför ':'водитель ')+a.phone:''}`,
      ...sel.map(x=>`🏨 ${x.h} · ${groupTotal(x)} ${tr?'kişi':'чел.'} · ${x.op||''}`),`${tr?'Toplam':'Всего'}: ${pax}`,why?`${tr?'Neden':'Причина'}: ${why}`:''].filter(Boolean).join('\n');
    saveExtra(patch);toast(`Передано: ${g} · ${pax} чел.`)})}
