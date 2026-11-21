/* ---------- excursion sales: price list, a sale per guest in one tap, targets and statistics ---------- */
// PRICES['i:<key>'] = {n, full, ind, grp, d, k:'pack'|'extra'}; PRICES['~target'] = $ per person
// SALES[id] = {id, tk (ticket), tid, gi, ref, n, item, name, qty, price, sum, date, at, by}
var PRICES=store.get('prices',{}),SALES=store.get('sales',{}),slLast=0,SLG=null;
// sales are for the administrator and the guides only; operations do not see them anywhere
const canSales=()=>ROLE==='admin'||ROLE==='guide';
const SL_TARGET=()=>+(PRICES['~target']||350);
const slItems=()=>Object.entries(PRICES).filter(([k,v])=>k.startsWith('i:')&&v&&v.n).map(([k,v])=>Object.assign({id:k},v)).sort((a,b)=>(a.k==='pack'?0:1)-(b.k==='pack'?0:1)||(b.full||0)-(a.full||0));
// a bus sells the packages at the individual or the group (TOPLU) price
const slPrice=(it,t)=>it.k==='pack'?(+(t&&t.plist==='grp'?it.grp:it.ind)||+it.full||0):(+it.full||0);
const slPax=t=>{const X=(t.gx||[]).filter(x=>!x.gone);const n=X.filter(x=>!/INF/i.test(x.sex)).length;return n||+t.pax||0};
const slOf=tid=>Object.values(SALES).filter(s=>s&&s.tid===tid);
const slGuest=(tid,gi)=>slOf(tid).filter(s=>s.gi===gi);
const money=v=>Math.round(+v||0).toLocaleString('ru').replace(/ /g,' ')+' $';
function slStats(t){const L=slOf(t.id);const sum=L.reduce((s,x)=>s+(+x.sum||0),0);const pax=slPax(t);const target=SL_TARGET()*pax;
  const buyers=new Set(L.filter(x=>x.gi>=0).map(x=>x.gi)).size;const by={};L.forEach(x=>{const k=x.name;by[k]=by[k]||{n:k,q:0,s:0};by[k].q+=+x.qty||1;by[k].s+=+x.sum||0});
  return {L,sum,pax,target,per:pax?sum/pax:0,pct:target?Math.round(sum/target*100):0,buyers,items:Object.values(by).sort((a,b)=>b.s-a.s)}}
async function pullSales(){if(!SERVER||!canSales())return;try{const [a,b]=await Promise.all([api('GET','/api/state?d=00.00&kind=prices'),api('GET','/api/state?d=00.00&kind=sales')]);
  const s1=JSON.stringify(PRICES)+JSON.stringify(SALES);PRICES=a.data||{};SALES=b.data||{};if(JSON.stringify(PRICES)+JSON.stringify(SALES)!==s1){store.set('prices',PRICES);store.set('sales',SALES);slRefresh()}}catch(e){}}
function slPut(kind,patch){slLast=Date.now();if(SERVER)api('PUT','/api/state?d=00.00&kind='+kind,patch).catch(()=>toast('Нет связи с сервером, продажа сохранена только на этом телефоне'))}
function saveSale(s,del){if(del)delete SALES[s.id];else SALES[s.id]=s;store.set('sales',SALES);slPut('sales',{[s.id]:del?null:s});slRefresh()}
function savePrices(patch){Object.entries(patch).forEach(([k,v])=>{if(v==null)delete PRICES[k];else PRICES[k]=v});store.set('prices',PRICES);slPut('prices',patch);slRefresh()}
function slRefresh(){try{if(!$('#v-guide').hidden){if(guideMode==='sales')renderSales();else if(guideMode==='guests')renderGuests()}}catch(e){}try{if(!$('#v-tours').hidden)renderSalesAdm()}catch(e){}}
function addSale(tid,gi,itemId,o={}){const t=TOURS[tid],it=PRICES[itemId];if(!t||!it)return;const qty=+o.qty||1,price=o.price!=null?+o.price:slPrice(Object.assign({id:itemId},it),t);
  const x=(t.gx||[])[gi];const s={id:'s'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),tid,gi:x?gi:-1,ref:x?gxRef(tid,gi):'',n:x?x.n:(o.n||''),item:itemId,name:it.n,qty,price,sum:qty*price,date:isoToday(),at:new Date().toISOString(),by:ROLE==='guide'?(ME||''):(uName()||'Администратор')};
  saveSale(s);toast(`${it.n}${x?' · '+x.n:''}: ${money(s.sum)}`)}

// inside a guest's open line: what he has bought, and one-tap buttons for the price list
function guestSaleHtml(t,i){if(!canSales())return '';const mine=slGuest(t.id,i);const items=slItems();
  return `<div class="gsale">${mine.length?`<div class="gs-have">${mine.map(s=>`<span class="chip ok">💰 ${esc(s.name)}${s.qty>1?' ×'+s.qty:''} · ${money(s.sum)} <button type="button" class="x" data-slpr="${esc(slTkKey(s))}" title="Печать билета">🖨</button><button type="button" class="x" data-sldel="${esc(s.id)}" aria-label="Удалить">✕</button></span>`).join('')}</div>`:''}
    ${items.length?`<details class="gs-add" data-gso="${esc(t.id)}|${i}"${typeof GXOPEN!=='undefined'&&GXOPEN.has('s:'+t.id+'|'+i)?' open':''}><summary class="btn sm">💰 Продажа</summary><div class="gs-items">${items.map(it=>`<button type="button" class="btn sm${it.k==='pack'?' pack':''}" data-sladd="${esc(t.id)}|${i}|${esc(it.id)}">${esc(it.n)} <b>${money(slPrice(it,t))}</b></button>`).join('')}</div></details>`:'<span class="hint">Прайс ещё не загружен</span>'}</div>`}
const slBadge=(tid,i)=>{if(!canSales())return '';const s=slGuest(tid,i).reduce((a,x)=>a+(+x.sum||0),0);return s?` <span class="chip ok gs-b">💰 ${money(s)}</span>`:''};
function bindSales(el){
  el.querySelectorAll('[data-sladd]').forEach(b=>b.onclick=e=>{e.preventDefault();const [tid,i,id]=b.dataset.sladd.split('|');addSale(tid,+i,id)});
  el.querySelectorAll('.gsale [data-slpr]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();slPrint(b.dataset.slpr)});
  el.querySelectorAll('[data-sldel]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();const s=SALES[b.dataset.sldel];if(!s||!confirm(T('Удалить продажу?')+` ${s.name} · ${money(s.sum)}`))return;saveSale(s,true);toast('Продажа удалена')})}

// a bus's statistics card: sold, per person, target bar, who bought, what sold
function slCard(t,o={}){const S=slStats(t);const cls=S.pct>=100?'ok':S.pct>=60?'mid':'low';
  return `<section class="slc"><div class="slc-h"><b>🚌 ${esc(t.bus||'')}</b> <span class="hint">${esc(t.guide||'')}${t.kok?' · '+esc(t.kok):''} · ${isoDM(t.days[0].d)}–${isoDM(t.days[t.days.length-1].d)}</span></div>
    <div class="slc-n"><div><small>Продано</small><b>${money(S.sum)}</b></div><div><small>На человека</small><b>${money(S.per)}</b><small>цель ${money(SL_TARGET())}</small></div><div><small>Купили</small><b>${S.buyers} / ${S.pax}</b><small>гостей</small></div></div>
    <div class="slbar ${cls}" title="${S.pct}% цели"><i style="width:${Math.min(100,S.pct)}%"></i><span>${S.pct}% от цели ${money(S.target)}</span></div>
    ${S.items.length?`<div class="sli">${S.items.map(x=>`<span>${esc(x.n)} <b>×${x.q}</b> = ${money(x.s)}</span>`).join('')}</div>`:'<p class="hint">Продаж пока нет.</p>'}
    ${o.form?slFormHtml(t):''}
    ${o.list&&S.L.length?`<details class="sll"><summary>Все продажи (${S.L.length})</summary>${S.L.sort((a,b)=>String(b.at).localeCompare(String(a.at))).map(s=>`<div class="sl-r"><span class="num hint">${isoDM(s.date)}</span> ${s.n?esc(s.n):'<i>без имени</i>'} · ${esc(s.name)}${s.qty>1?' ×'+s.qty:''} · <b>${money(s.sum)}</b>${o.by?` <span class="hint">${esc(s.by||'')}</span>`:''} <button type="button" class="btn sm ghost" data-slpr="${esc(slTkKey(s))}" title="Печать билета">🖨</button> <button type="button" class="x" data-sldel="${esc(s.id)}" aria-label="Удалить">✕</button></div>`).join('')}</details>`:''}
    <div class="tact"><button type="button" class="btn sm" data-slwa="${esc(t.id)}">📋 Отчёт в WhatsApp</button>${o.form?slPrinterHtml():''}</div></section>`}
// quick sale from the Sales block: find the guest(s) by name or number, fill a cart, sell and print a ticket
// SLC[tid] = {q, sel:[gi…], name, cart:{itemId:qty}}  — kept while the screen redraws on sync
var SLC={};const slc=tid=>SLC[tid]||(SLC[tid]={q:'',sel:[],name:'',cart:{}});
const slNorm=v=>(typeof gKey==='function'?gKey(v):String(v||'').toUpperCase());
function slFind(t,q){const X=t.gx||[];q=String(q||'').trim();if(!q)return [];const num=/^\d+$/.test(q)?+q:null;const Q=slNorm(q).split(' ').filter(Boolean);
  return X.map((x,i)=>({x,i})).filter(({x})=>!x.gone&&(num!=null?+x.no===num:(()=>{const W=slNorm(x.n).split(' ');return Q.every(w=>W.some(y=>y.startsWith(w)))})())).slice(0,8)}
function slFormHtml(t){const items=slItems();if(!items.length)return '<p class="hint">Прайс ещё не загружен — его загружает офис.</p>';const c=slc(t.id);const X=t.gx||[];
  return `<div class="slf" data-slf="${esc(t.id)}">
    <div class="slf-s"><span class="slf-step">1</span><input type="search" class="slf-q" data-slfq="${esc(t.id)}" value="${esc(c.q)}" placeholder="🔎 Фамилия, имя или № гостя" autocomplete="off" enterkeyhint="search"></div>
    <div data-slfbody>${slFormBody(t)}</div></div>`}
function slFormBody(t){const items=slItems();const c=slc(t.id);const X=t.gx||[];const R=slFind(t,c.q);
  const selN=c.sel.map(i=>X[i]).filter(Boolean);
  const fam=selN.length?X.map((x,i)=>({x,i})).filter(({x,i})=>!x.gone&&!c.sel.includes(i)&&selN.some(y=>y.fam&&y.fam===x.fam)):[];
  const res=c.q.trim()?`<div class="slf-res">${R.map(({x,i})=>`<button type="button" class="slf-g${c.sel.includes(i)?' on':''}" data-slfpick="${i}"><span class="hint">${x.no}.</span> <b>${esc(x.n)}</b>${x.room?` <span class="hint">${esc(x.room)}</span>`:''}${slGuest(t.id,i).length?' <span class="chip ok">💰</span>':''}</button>`).join('')}
      ${c.q.trim().length>=2&&!R.length?`<p class="hint">В списке автобуса не нашёл.</p>`:''}${c.q.trim().length>=2?`<button type="button" class="slf-g free" data-slffree>➕ Гость не из списка: <b>${esc(c.q.trim().toUpperCase())}</b></button>`:''}</div>`:'';
  const who=selN.length||c.name?`<div class="slf-who">${selN.map(x=>`<span class="chip slf-c">👤 ${esc(x.n)} <button type="button" class="x" data-slfun="${X.indexOf(x)}" aria-label="Убрать">✕</button></span>`).join('')}${c.name?`<span class="chip slf-c">✍️ ${esc(c.name)} <button type="button" class="x" data-slfunname aria-label="Убрать">✕</button></span>`:''}
      ${fam.length?`<button type="button" class="btn sm ghost" data-slffam>👨‍👩‍👧 + семья: ${fam.map(f=>esc(f.x.n.split(' ').slice(-1)[0])).join(', ')}</button>`:''}</div>`:'<p class="hint slf-tip">Найдите гостя — или сразу выбирайте экскурсии, тогда продажа будет без имени.</p>';
  const nP=Math.max(1,selN.length+(c.name?1:0));
  const lines=Object.entries(c.cart).filter(([k,q])=>q>0&&PRICES[k]);const tot=lines.reduce((a,[k,q])=>a+q*slPrice(Object.assign({id:k},PRICES[k]),t),0);
  return `${res}${who}
    <div class="slf-s"><span class="slf-step">2</span><span class="hint">Нажмите экскурсию${nP>1?` — добавится ×${nP}, по одной на каждого`:''}</span></div>
    <div class="gs-items">${items.map(it=>`<button type="button" class="btn sm${it.k==='pack'?' pack':''}${c.cart[it.id]?' in':''}" data-slfadd="${esc(it.id)}">${c.cart[it.id]?`<i class="slf-n">${c.cart[it.id]}</i>`:''}${esc(it.n)} <b>${money(slPrice(it,t))}</b></button>`).join('')}</div>
    ${lines.length?`<div class="slf-cart">${lines.map(([k,q])=>{const it=PRICES[k];const pr=slPrice(Object.assign({id:k},it),t);return `<div class="slf-l"><span>${esc(it.n)}</span><span class="slf-q2"><button type="button" class="btn sm ghost" data-slfq2="${esc(k)}|-1">−</button><b>${q}</b><button type="button" class="btn sm ghost" data-slfq2="${esc(k)}|1">+</button></span><b class="n">${money(q*pr)}</b></div>`}).join('')}
      <div class="slf-l tot"><span>Итого</span><span></span><b class="n">${money(tot)}</b></div>
      <div class="slf-go"><button type="button" class="btn primary" data-slfsell="1">✅ Продать и 🖨 билет</button><button type="button" class="btn" data-slfsell="0">✅ Продать без печати</button><button type="button" class="btn ghost" data-slfclr>Очистить</button></div></div>`:''}`}
function slFormBind(el,tid){const t=TOURS[tid];if(!t)return;const c=slc(tid);const body=el.querySelector('[data-slfbody]');const X=t.gx||[];
  const redraw=()=>{body.innerHTML=slFormBody(t);slFormBind(el,tid)};
  const q=el.querySelector('[data-slfq]');q.oninput=()=>{c.q=q.value;redraw()};
  q.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();const R=slFind(t,c.q);if(R.length===1){pick(R[0].i)}}};
  const pick=i=>{if(c.sel.includes(i))c.sel=c.sel.filter(x=>x!==i);else c.sel.push(i);c.q='';q.value='';redraw()};
  body.querySelectorAll('[data-slfpick]').forEach(b=>b.onclick=()=>pick(+b.dataset.slfpick));
  body.querySelectorAll('[data-slfun]').forEach(b=>b.onclick=()=>{c.sel=c.sel.filter(x=>x!==+b.dataset.slfun);redraw()});
  const fr=body.querySelector('[data-slffree]');if(fr)fr.onclick=()=>{c.name=c.q.trim().toUpperCase();c.q='';q.value='';redraw()};
  const un=body.querySelector('[data-slfunname]');if(un)un.onclick=()=>{c.name='';redraw()};
  const fm=body.querySelector('[data-slffam]');if(fm)fm.onclick=()=>{const S=c.sel.map(i=>X[i]).filter(Boolean);X.forEach((x,i)=>{if(!x.gone&&!c.sel.includes(i)&&S.some(y=>y.fam&&y.fam===x.fam))c.sel.push(i)});redraw()};
  body.querySelectorAll('[data-slfadd]').forEach(b=>b.onclick=()=>{const n=Math.max(1,c.sel.length+(c.name?1:0));c.cart[b.dataset.slfadd]=(c.cart[b.dataset.slfadd]||0)+n;redraw()});
  body.querySelectorAll('[data-slfq2]').forEach(b=>b.onclick=()=>{const [k,d]=b.dataset.slfq2.split('|');c.cart[k]=Math.max(0,(c.cart[k]||0)+ +d);if(!c.cart[k])delete c.cart[k];redraw()});
  const cl=body.querySelector('[data-slfclr]');if(cl)cl.onclick=()=>{SLC[tid]={q:'',sel:[],name:'',cart:{}};q.value='';redraw()};
  body.querySelectorAll('[data-slfsell]').forEach(b=>b.onclick=()=>{const tk=slSell(t,c);if(!tk)return;SLC[tid]={q:'',sel:[],name:'',cart:{}};if(b.dataset.slfsell==='1')slPrint(tk)})}
// the cart becomes sales: when an excursion is bought once per chosen guest, every guest gets his own sale (for the per-guest stats)
function slSell(t,c){const people=[...c.sel.map(i=>({gi:i})),...(c.name?[{gi:-1,n:c.name}]:[])];if(!people.length)people.push({gi:-1,n:''});
  const tk=isoToday().slice(8,10)+isoToday().slice(5,7)+'-'+Math.random().toString(36).slice(2,6).toUpperCase();const at=new Date().toISOString();const by=ROLE==='guide'?(ME||''):(uName()||'Администратор');const patch={};let sum=0;
  Object.entries(c.cart).forEach(([k,q])=>{const it=PRICES[k];if(!it||!q)return;const price=slPrice(Object.assign({id:k},it),t);
    const parts=q%people.length===0?people.map(p=>({p,qty:q/people.length})):[{p:people[0],qty:q}];
    parts.forEach(({p,qty})=>{const x=p.gi>=0?(t.gx||[])[p.gi]:null;const s={id:'s'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),tk,tid:t.id,gi:x?p.gi:-1,ref:x?gxRef(t.id,p.gi):'',n:x?x.n:(p.n||''),item:k,name:it.n,qty,price,sum:qty*price,date:isoToday(),at,by};
      SALES[s.id]=s;patch[s.id]=s;sum+=s.sum})});
  if(!Object.keys(patch).length)return null;SLC[t.id]={q:'',sel:[],name:'',cart:{}};store.set('sales',SALES);slPut('sales',patch);toast(`Продано: ${money(sum)} · билет ${tk}`);slRefresh();return tk}

/* ---- ticket for a small thermal printer (58 or 80 mm): printed from the browser's print dialog ---- */
let TKW=store.get('tkw',58);
function slTicketHtml(L){const t=TOURS[L[0].tid]||{};const names=[...new Set(L.map(s=>s.n).filter(Boolean))];const by={};L.forEach(s=>{by[s.name]=by[s.name]||{q:0,s:0};by[s.name].q+=+s.qty||1;by[s.name].s+=+s.sum||0});
  const tot=L.reduce((a,s)=>a+(+s.sum||0),0);const d=new Date(L[0].at||Date.now());const dt=d.toLocaleDateString('ru-RU')+' '+d.toTimeString().slice(0,5);
  const days=(t.days||[]).length?isoDM(t.days[0].d)+'–'+isoDM(t.days[t.days.length-1].d):'';
  return `<div class="tk"><div class="tk-c tk-big">SARABI TRAVEL</div><div class="tk-c">Antalya · экскурсии</div><div class="tk-hr"></div>
    <div class="tk-c tk-no">БИЛЕТ № ${esc(L[0].tk||L[0].id.slice(-6).toUpperCase())}</div><div class="tk-c">${esc(dt)}</div><div class="tk-hr"></div>
    ${t.bus?`<div>Автобус: <b>${esc(t.bus)}</b>${days?' · '+days:''}</div>`:''}${t.guide?`<div>Гид: ${esc(t.guide)}</div>`:''}
    ${names.length?`<div class="tk-hr"></div><div><b>Гости (${names.length}):</b></div>${names.map(n=>`<div>· ${esc(n)}</div>`).join('')}`:''}
    <div class="tk-hr"></div>${Object.entries(by).map(([n,v])=>`<div class="tk-l"><span>${esc(n)} ×${v.q}</span><b>${money(v.s)}</b></div>`).join('')}
    <div class="tk-hr"></div><div class="tk-l tk-big"><span>ИТОГО</span><b>${money(tot)}</b></div>
    <div class="tk-hr"></div><div>Продал: ${esc(L[0].by||'')}</div><div class="tk-c" style="margin-top:6px">Спасибо и хорошего отдыха!</div><div class="tk-c">Сохраните билет до конца экскурсии</div></div>`}
function slPrint(key){const L=Object.values(SALES).filter(s=>s&&(s.tk&&s.tk===key||s.id===key));if(!L.length)return toast('Продажа не найдена');
  let box=$('#tkPrint');if(!box){box=document.createElement('div');box.id='tkPrint';document.body.appendChild(box)}
  let st=$('#tkPage');if(!st){st=document.createElement('style');st.id='tkPage';document.head.appendChild(st)}
  st.textContent=`@page{size:${TKW}mm auto;margin:0}#tkPrint .tk{width:${TKW-6}mm}`;
  box.innerHTML=slTicketHtml(L);document.body.classList.add('tk-printing');
  const done=()=>{document.body.classList.remove('tk-printing');window.removeEventListener('afterprint',done)};window.addEventListener('afterprint',done);
  setTimeout(()=>{try{window.print()}catch(e){}setTimeout(done,60000)},80)}
const slTkKey=s=>s.tk||s.id;
function slPrinterHtml(){return `<label class="hint slf-pw">🖨 Принтер: <select data-tkw><option value="58"${TKW==58?' selected':''}>58 мм</option><option value="80"${TKW==80?' selected':''}>80 мм</option></select></label>`}
function slWa(t){const S=slStats(t);return [`💰 *${t.bus||''}* · ${t.guide||''} · ${isoDM(t.days[0].d)}–${isoDM(t.days[t.days.length-1].d)}`,`Продано: *${money(S.sum)}* · на человека ${money(S.per)} (цель ${money(SL_TARGET())}) · ${S.pct}%`,`Купили: ${S.buyers} из ${S.pax}`,'',...S.items.map(x=>`${x.n} ×${x.q} = ${money(x.s)}`)].join('\n')}
function bindSlCards(el){bindSales(el);
  el.querySelectorAll('[data-slf]').forEach(f=>slFormBind(f,f.dataset.slf));
  el.querySelectorAll('[data-slpr]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();slPrint(b.dataset.slpr)});
  el.querySelectorAll('[data-tkw]').forEach(s=>s.onchange=()=>{TKW=+s.value;store.set('tkw',TKW)});
  el.querySelectorAll('[data-slwa]').forEach(b=>b.onclick=()=>copy(slWa(TOURS[b.dataset.slwa]),true))}

// guide screen, mode "💰 Продажи": the buses of this guide today
function renderSales(){const box=$('#sales');if(!box)return;const g=curGuide;let iso=gTourDate||isoToday();let L=toursFor(g,iso);if(!L.length&&iso!==isoToday()){iso=isoToday();L=toursFor(g,iso)}
  const ae=document.activeElement;const fq=ae&&ae.dataset&&ae.dataset.slfq;const cp=fq?ae.selectionStart:0;
  box.innerHTML=L.length?L.map(t=>slCard(t,{form:true,list:true})).join(''):`<p class="hint">${isoDM(iso)}: экскурсий у ${esc(g||'гида')} нет. Продажи ведутся в режиме «🚌 Экскурсия».</p>`;bindSlCards(box);
  if(fq){const q=box.querySelector(`[data-slfq="${CSS.escape(fq)}"]`);if(q){q.focus();try{q.setSelectionRange(cp,cp)}catch(e){}}}}

/* ---- price list file (ПРАЙС: name | price | | discount price | what is included) ---- */
const isPriceList=rows=>{const S=rows.slice(0,5).map(r=>(r||[]).join(' ')).join(' ');return /ЭКСКУРСИ/i.test(S)&&/ЦЕНА/i.test(S)};
const slNum=v=>{const m=String(v==null?'':v).match(/(\d[\d\s]*)\s*\$/)||String(v==null?'':v).match(/^\s*(\d{2,5})\s*$/);return m?+m[1].replace(/\s/g,''):null};
function parsePriceList(rows){const out=[];
  rows.forEach(r=>{r=r||[];const n=String(r[0]||'').replace(/\s+/g,' ').trim();if(!n||/^(ЭКСКУРСИИ|ИМЯ|ПРОГРАММА|ЗА УСЛУГИ|ЦЕНА)/i.test(n))return;
    if(/БЕСПЛАТНО/i.test(String(r[1]||'')))return;
    const full=slNum(r[1]),disc=/^\s*\d[\d\s]*\$\s*$/.test(String(r[3]||''))?slNum(r[3]):null;const desc=[r[3],r[4]].map(x=>String(x||'').replace(/\s+/g,' ').trim()).filter(x=>x.length>12).sort((a,b)=>b.length-a.length)[0]||'';
    out.push({n:n.toLocaleUpperCase('ru').replace(/ПAНОРАМА|ПОНОРАМА/g,'ПАНОРАМА'),full:full||0,disc,d:desc,k:disc?'pack':'extra'})});
  return out}
function importPrices(rows,file){if(!isAdmin())throw new Error('прайс загружает только администратор');const grp=/TOPLU|ГРУП|GRUP/i.test(file.name);const P=parsePriceList(rows);if(!P.length)throw new Error('в прайсе не нашёл цен');
  const key=n=>'i:'+n.toLocaleUpperCase('ru').replace(/[^A-ZА-ЯЁ0-9]+/g,'');const patch={};
  P.forEach(p=>{const k=key(p.n);const o=Object.assign({},PRICES[k]||{},{n:p.n,k:p.k,d:p.d||(PRICES[k]||{}).d||''});if(p.full)o.full=p.full;else if(o.full==null)o.full=0;if(p.disc)o[grp?'grp':'ind']=p.disc;patch[k]=o});
  savePrices(patch);
  return `<b>Прайс ${grp?'групповой (TOPLU)':'индивидуальный'} загружен: ${P.length} позиций.</b><span>${P.filter(p=>p.k==='pack').map(p=>`${esc(p.n)} ${p.disc}$`).join(' · ')}</span>${P.some(p=>!p.full&&!p.disc)?`<span style="color:var(--warn)">Без цены: ${P.filter(p=>!p.full&&!p.disc).map(p=>esc(p.n)).join(', ')} — впишите цену во вкладке «Экскурсии» → «Продажи».</span>`:''}`}

/* ---- administrator: Control tab, all buses, targets, the price list ---- */
let slAdmOpen=store.get('slAdmOpen',true);
function renderSalesAdm(){const el=$('#salesAdm');if(!el)return;if(!isAdmin()){el.hidden=true;el.innerHTML='';return}el.hidden=false;
  const all=tours().filter(t=>(t.gx||[]).length||slOf(t.id).length);const from=isoAdd(isoToday(),-14);const L=all.filter(t=>t.days[t.days.length-1].d>=from);
  const tot=L.reduce((a,t)=>{const S=slStats(t);a.sum+=S.sum;a.pax+=S.pax;a.target+=S.target;return a},{sum:0,pax:0,target:0});
  const byG={};L.forEach(t=>{const S=slStats(t);const k=t.guide||'—';byG[k]=byG[k]||{g:k,sum:0,pax:0};byG[k].sum+=S.sum;byG[k].pax+=S.pax});
  const items=slItems();
  el.innerHTML=`<details class="sla"${slAdmOpen?' open':''}><summary><b>💰 Продажи и цели</b> <span class="hint">за 2 недели: ${money(tot.sum)} · на человека ${money(tot.pax?tot.sum/tot.pax:0)} · ${tot.target?Math.round(tot.sum/tot.target*100):0}% цели</span></summary>
    <div class="sla-top"><label>Цель на человека, $ <input type="number" id="slTarget" value="${SL_TARGET()}" min="0" step="10"></label><span class="hint">Считаются все гости автобуса, кроме младенцев (INF).</span></div>
    <div class="sla-tbl"><table><thead><tr><th>Автобус</th><th>Гид</th><th>Даты</th><th class="n">Гостей</th><th class="n">Продано</th><th class="n">На чел.</th><th class="n">Цель</th><th>Цены</th></tr></thead><tbody>
      ${L.map(t=>{const S=slStats(t);return `<tr><td><b>${esc(t.bus||'')}</b></td><td>${esc(t.guide||'')}</td><td class="num">${isoDM(t.days[0].d)}–${isoDM(t.days[t.days.length-1].d)}</td><td class="n">${S.pax}</td><td class="n"><b>${money(S.sum)}</b></td><td class="n">${money(S.per)}</td><td class="n"><span class="slpct ${S.pct>=100?'ok':S.pct>=60?'mid':'low'}">${S.pct}%</span></td><td><select data-plist="${esc(t.id)}"><option value="ind"${t.plist!=='grp'?' selected':''}>индивид.</option><option value="grp"${t.plist==='grp'?' selected':''}>TOPLU</option></select></td></tr>`}).join('')||'<tr><td colspan="8" class="hint">Нет автобусов со списками гостей за 2 недели.</td></tr>'}
    </tbody></table></div>
    ${(()=>{const R={};L.forEach(t=>(t.gx||[]).forEach((x,i)=>{if(x.gone)return;const g=gxRef(t.id,i);if(!g)return;const k=gKey(g);R[k]=R[k]||{g,n:0,sum:0,to:new Set()};R[k].n++;R[k].to.add(gSplit(t.guide)[0]||t.bus);R[k].sum+=slGuest(t.id,i).reduce((a,s)=>a+(+s.sum||0),0)}));
      const V=Object.values(R).sort((a,b)=>b.n-a.n);return V.length?`<div class="sli"><b>🤝 Кто привёл гостей:</b> ${V.map(r=>`<span>${esc(r.g)} → ${[...r.to].map(esc).join(', ')}: ${r.n} гост. · куплено ${money(r.sum)}</span>`).join('')}</div>`:''})()}
    ${Object.keys(byG).length?`<div class="sli"><b>По гидам:</b> ${Object.values(byG).sort((a,b)=>b.sum-a.sum).map(x=>`<span>${esc(x.g)}: ${money(x.sum)} · ${money(x.pax?x.sum/x.pax:0)}/чел</span>`).join('')}</div>`:''}
    <details class="sll"><summary>Прайс (${items.length}) — файл ПРАЙС загружается во вкладке «Экскурсии» → «⬆ Программы и списки групп»</summary>
      <table class="slp"><thead><tr><th>Позиция</th><th class="n">Цена</th><th class="n">Индивид.</th><th class="n">TOPLU</th><th></th></tr></thead><tbody>${items.map(it=>`<tr><td>${it.k==='pack'?'📦 ':''}${esc(it.n)}</td>${['full','ind','grp'].map(f=>`<td class="n">${f!=='full'&&it.k!=='pack'?'':`<input type="number" data-plf="${esc(it.id)}|${f}" value="${esc(it[f]==null?'':it[f])}" min="0">`}</td>`).join('')}<td><button type="button" class="x" data-pldel="${esc(it.id)}" aria-label="Удалить">✕</button></td></tr>`).join('')}</tbody></table></details>
    ${L.map(t=>slOf(t.id).length?slCard(t,{list:true,by:true}):'').join('')}</details>`;
  el.querySelector('details.sla').ontoggle=e=>{slAdmOpen=e.target.open;store.set('slAdmOpen',slAdmOpen)};
  $('#slTarget').onchange=e=>savePrices({'~target':Math.max(0,+e.target.value||0)});
  el.querySelectorAll('[data-plist]').forEach(s=>s.onchange=()=>{const t=JSON.parse(JSON.stringify(TOURS[s.dataset.plist]));t.plist=s.value;saveTour(t.id,t);renderSalesAdm()});
  el.querySelectorAll('[data-plf]').forEach(i=>i.onchange=()=>{const [id,f]=i.dataset.plf.split('|');savePrices({[id]:Object.assign({},PRICES[id],{[f]:+i.value||0})})});
  el.querySelectorAll('[data-pldel]').forEach(b=>b.onclick=()=>{const it=PRICES[b.dataset.pldel];if(it&&confirm(T('Убрать из прайса?')+' '+it.n))savePrices({[b.dataset.pldel]:null})});
  bindSlCards(el)}
if(!SERVER)slRefresh();
