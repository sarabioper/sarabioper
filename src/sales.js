/* ---------- excursion sales: price list, a sale per guest in one tap, targets and statistics ---------- */
// PRICES['i:<key>'] = {n, full, ind, grp, d, k:'pack'|'extra'}; PRICES['~target'] = $ per person
// SALES[id] = {id, tid, gi, n, item, name, qty, price, sum, date, at, by}
var PRICES=store.get('prices',{}),SALES=store.get('sales',{}),slLast=0,SLG=null;
const SL_TARGET=()=>+(PRICES['~target']||350);
const slItems=()=>Object.entries(PRICES).filter(([k,v])=>k.startsWith('i:')&&v&&v.n).map(([k,v])=>Object.assign({id:k},v)).sort((a,b)=>(a.k==='pack'?0:1)-(b.k==='pack'?0:1)||(b.full||0)-(a.full||0));
// a bus sells the packages at the individual or the group (TOPLU) price
const slPrice=(it,t)=>it.k==='pack'?(+(t&&t.plist==='grp'?it.grp:it.ind)||+it.full||0):(+it.full||0);
const slPax=t=>{const X=t.gx||[];const n=X.filter(x=>!/INF/i.test(x.sex)).length;return n||+t.pax||0};
const slOf=tid=>Object.values(SALES).filter(s=>s&&s.tid===tid);
const slGuest=(tid,gi)=>slOf(tid).filter(s=>s.gi===gi);
const money=v=>Math.round(+v||0).toLocaleString('ru').replace(/ /g,' ')+' $';
function slStats(t){const L=slOf(t.id);const sum=L.reduce((s,x)=>s+(+x.sum||0),0);const pax=slPax(t);const target=SL_TARGET()*pax;
  const buyers=new Set(L.filter(x=>x.gi>=0).map(x=>x.gi)).size;const by={};L.forEach(x=>{const k=x.name;by[k]=by[k]||{n:k,q:0,s:0};by[k].q+=+x.qty||1;by[k].s+=+x.sum||0});
  return {L,sum,pax,target,per:pax?sum/pax:0,pct:target?Math.round(sum/target*100):0,buyers,items:Object.values(by).sort((a,b)=>b.s-a.s)}}
async function pullSales(){if(!SERVER)return;try{const [a,b]=await Promise.all([api('GET','/api/state?d=00.00&kind=prices'),api('GET','/api/state?d=00.00&kind=sales')]);
  const s1=JSON.stringify(PRICES)+JSON.stringify(SALES);PRICES=a.data||{};SALES=b.data||{};if(JSON.stringify(PRICES)+JSON.stringify(SALES)!==s1){store.set('prices',PRICES);store.set('sales',SALES);slRefresh()}}catch(e){}}
function slPut(kind,patch){slLast=Date.now();if(SERVER)api('PUT','/api/state?d=00.00&kind='+kind,patch).catch(()=>toast('Нет связи с сервером, продажа сохранена только на этом телефоне'))}
function saveSale(s,del){if(del)delete SALES[s.id];else SALES[s.id]=s;store.set('sales',SALES);slPut('sales',{[s.id]:del?null:s});slRefresh()}
function savePrices(patch){Object.entries(patch).forEach(([k,v])=>{if(v==null)delete PRICES[k];else PRICES[k]=v});store.set('prices',PRICES);slPut('prices',patch);slRefresh()}
function slRefresh(){try{if(!$('#v-guide').hidden){if(guideMode==='sales')renderSales();else if(guideMode==='guests')renderGuests()}}catch(e){}try{if(!$('#v-tours').hidden)renderSalesAdm()}catch(e){}}
function addSale(tid,gi,itemId,o={}){const t=TOURS[tid],it=PRICES[itemId];if(!t||!it)return;const qty=+o.qty||1,price=o.price!=null?+o.price:slPrice(Object.assign({id:itemId},it),t);
  const x=(t.gx||[])[gi];const s={id:'s'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),tid,gi:x?gi:-1,n:x?x.n:(o.n||''),item:itemId,name:it.n,qty,price,sum:qty*price,date:isoToday(),at:new Date().toISOString(),by:ROLE==='guide'?(ME||''):'Офис'};
  saveSale(s);toast(`${it.n}${x?' · '+x.n:''}: ${money(s.sum)}`)}

// inside a guest's open line: what he has bought, and one-tap buttons for the price list
function guestSaleHtml(t,i){const mine=slGuest(t.id,i);const items=slItems();
  return `<div class="gsale">${mine.length?`<div class="gs-have">${mine.map(s=>`<span class="chip ok">💰 ${esc(s.name)}${s.qty>1?' ×'+s.qty:''} · ${money(s.sum)} <button type="button" class="x" data-sldel="${esc(s.id)}" aria-label="Удалить">✕</button></span>`).join('')}</div>`:''}
    ${items.length?`<details class="gs-add" data-gso="${esc(t.id)}|${i}"${typeof GXOPEN!=='undefined'&&GXOPEN.has('s:'+t.id+'|'+i)?' open':''}><summary class="btn sm">💰 Продажа</summary><div class="gs-items">${items.map(it=>`<button type="button" class="btn sm${it.k==='pack'?' pack':''}" data-sladd="${esc(t.id)}|${i}|${esc(it.id)}">${esc(it.n)} <b>${money(slPrice(it,t))}</b></button>`).join('')}</div></details>`:'<span class="hint">Прайс ещё не загружен</span>'}</div>`}
const slBadge=(tid,i)=>{const s=slGuest(tid,i).reduce((a,x)=>a+(+x.sum||0),0);return s?` <span class="chip ok gs-b">💰 ${money(s)}</span>`:''};
function bindSales(el){
  el.querySelectorAll('[data-sladd]').forEach(b=>b.onclick=e=>{e.preventDefault();const [tid,i,id]=b.dataset.sladd.split('|');addSale(tid,+i,id)});
  el.querySelectorAll('[data-sldel]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();const s=SALES[b.dataset.sldel];if(!s||!confirm(T('Удалить продажу?')+` ${s.name} · ${money(s.sum)}`))return;saveSale(s,true);toast('Продажа удалена')})}

// a bus's statistics card: sold, per person, target bar, who bought, what sold
function slCard(t,o={}){const S=slStats(t);const cls=S.pct>=100?'ok':S.pct>=60?'mid':'low';
  return `<section class="slc"><div class="slc-h"><b>🚌 ${esc(t.bus||'')}</b> <span class="hint">${esc(t.guide||'')}${t.kok?' · '+esc(t.kok):''} · ${isoDM(t.days[0].d)}–${isoDM(t.days[t.days.length-1].d)}</span></div>
    <div class="slc-n"><div><small>Продано</small><b>${money(S.sum)}</b></div><div><small>На человека</small><b>${money(S.per)}</b><small>цель ${money(SL_TARGET())}</small></div><div><small>Купили</small><b>${S.buyers} / ${S.pax}</b><small>гостей</small></div></div>
    <div class="slbar ${cls}" title="${S.pct}% цели"><i style="width:${Math.min(100,S.pct)}%"></i><span>${S.pct}% от цели ${money(S.target)}</span></div>
    ${S.items.length?`<div class="sli">${S.items.map(x=>`<span>${esc(x.n)} <b>×${x.q}</b> = ${money(x.s)}</span>`).join('')}</div>`:'<p class="hint">Продаж пока нет.</p>'}
    ${o.form?slFormHtml(t):''}
    ${o.list&&S.L.length?`<details class="sll"><summary>Все продажи (${S.L.length})</summary>${S.L.sort((a,b)=>String(b.at).localeCompare(String(a.at))).map(s=>`<div class="sl-r"><span class="num hint">${isoDM(s.date)}</span> ${s.n?esc(s.n):'<i>без имени</i>'} · ${esc(s.name)}${s.qty>1?' ×'+s.qty:''} · <b>${money(s.sum)}</b>${o.by?` <span class="hint">${esc(s.by||'')}</span>`:''} <button type="button" class="x" data-sldel="${esc(s.id)}" aria-label="Удалить">✕</button></div>`).join('')}</details>`:''}
    <div class="tact"><button type="button" class="btn sm" data-slwa="${esc(t.id)}">📋 Отчёт в WhatsApp</button></div></section>`}
// quick sale from the Sales block: guest + item
function slFormHtml(t){const X=t.gx||[];const items=slItems();if(!items.length)return '<p class="hint">Прайс ещё не загружен — его загружает офис.</p>';
  return `<div class="slf"><select data-slg="${esc(t.id)}"><option value="-1">— гость (можно без имени) —</option>${X.map((x,i)=>`<option value="${i}"${SLG&&SLG.tid===t.id&&SLG.gi===i?' selected':''}>${x.no}. ${esc(x.n)}</option>`).join('')}</select>
    <div class="gs-items">${items.map(it=>`<button type="button" class="btn sm${it.k==='pack'?' pack':''}" data-slq="${esc(t.id)}|${esc(it.id)}">${esc(it.n)} <b>${money(slPrice(it,t))}</b></button>`).join('')}</div></div>`}
function slWa(t){const S=slStats(t);return [`💰 *${t.bus||''}* · ${t.guide||''} · ${isoDM(t.days[0].d)}–${isoDM(t.days[t.days.length-1].d)}`,`Продано: *${money(S.sum)}* · на человека ${money(S.per)} (цель ${money(SL_TARGET())}) · ${S.pct}%`,`Купили: ${S.buyers} из ${S.pax}`,'',...S.items.map(x=>`${x.n} ×${x.q} = ${money(x.s)}`)].join('\n')}
function bindSlCards(el){bindSales(el);
  el.querySelectorAll('[data-slg]').forEach(s=>s.onchange=()=>{SLG={tid:s.dataset.slg,gi:+s.value}});
  el.querySelectorAll('[data-slq]').forEach(b=>b.onclick=()=>{const [tid,id]=b.dataset.slq.split('|');const sel=el.querySelector(`[data-slg="${CSS.escape(tid)}"]`);const gi=sel?+sel.value:-1;SLG={tid,gi};addSale(tid,gi,id)});
  el.querySelectorAll('[data-slwa]').forEach(b=>b.onclick=()=>copy(slWa(TOURS[b.dataset.slwa]),true))}

// guide screen, mode "💰 Продажи": the buses of this guide today
function renderSales(){const box=$('#sales');if(!box)return;const g=curGuide;let iso=gTourDate||isoToday();let L=g?toursOfGuide(g,iso):[];if(!L.length&&iso!==isoToday()){iso=isoToday();L=g?toursOfGuide(g,iso):[]}
  box.innerHTML=L.length?L.map(t=>slCard(t,{form:true,list:true})).join(''):`<p class="hint">${isoDM(iso)}: экскурсий у ${esc(g||'гида')} нет. Продажи ведутся в режиме «🚌 Экскурсия».</p>`;bindSlCards(box)}

/* ---- price list file (ПРАЙС: name | price | | discount price | what is included) ---- */
const isPriceList=rows=>{const S=rows.slice(0,5).map(r=>(r||[]).join(' ')).join(' ');return /ЭКСКУРСИ/i.test(S)&&/ЦЕНА/i.test(S)};
const slNum=v=>{const m=String(v==null?'':v).match(/(\d[\d\s]*)\s*\$/)||String(v==null?'':v).match(/^\s*(\d{2,5})\s*$/);return m?+m[1].replace(/\s/g,''):null};
function parsePriceList(rows){const out=[];
  rows.forEach(r=>{r=r||[];const n=String(r[0]||'').replace(/\s+/g,' ').trim();if(!n||/^(ЭКСКУРСИИ|ИМЯ|ПРОГРАММА|ЗА УСЛУГИ|ЦЕНА)/i.test(n))return;
    if(/БЕСПЛАТНО/i.test(String(r[1]||'')))return;
    const full=slNum(r[1]),disc=/^\s*\d[\d\s]*\$\s*$/.test(String(r[3]||''))?slNum(r[3]):null;const desc=[r[3],r[4]].map(x=>String(x||'').replace(/\s+/g,' ').trim()).filter(x=>x.length>12).sort((a,b)=>b.length-a.length)[0]||'';
    out.push({n:n.toLocaleUpperCase('ru').replace(/ПAНОРАМА|ПОНОРАМА/g,'ПАНОРАМА'),full:full||0,disc,d:desc,k:disc?'pack':'extra'})});
  return out}
function importPrices(rows,file){const grp=/TOPLU|ГРУП|GRUP/i.test(file.name);const P=parsePriceList(rows);if(!P.length)throw new Error('в прайсе не нашёл цен');
  const key=n=>'i:'+n.toLocaleUpperCase('ru').replace(/[^A-ZА-ЯЁ0-9]+/g,'');const patch={};
  P.forEach(p=>{const k=key(p.n);const o=Object.assign({},PRICES[k]||{},{n:p.n,k:p.k,d:p.d||(PRICES[k]||{}).d||''});if(p.full)o.full=p.full;else if(o.full==null)o.full=0;if(p.disc)o[grp?'grp':'ind']=p.disc;patch[k]=o});
  savePrices(patch);
  return `<b>Прайс ${grp?'групповой (TOPLU)':'индивидуальный'} загружен: ${P.length} позиций.</b><span>${P.filter(p=>p.k==='pack').map(p=>`${esc(p.n)} ${p.disc}$`).join(' · ')}</span>${P.some(p=>!p.full&&!p.disc)?`<span style="color:var(--warn)">Без цены: ${P.filter(p=>!p.full&&!p.disc).map(p=>esc(p.n)).join(', ')} — впишите цену во вкладке «Экскурсии» → «Продажи».</span>`:''}`}

/* ---- administrator: Excursions tab, all buses, targets, the price list ---- */
let slAdmOpen=store.get('slAdmOpen',true);
function renderSalesAdm(){const el=$('#salesAdm');if(!el)return;if(!isOps()){el.hidden=true;return}el.hidden=false;
  const all=tours().filter(t=>(t.gx||[]).length||slOf(t.id).length);const from=isoAdd(isoToday(),-14);const L=all.filter(t=>t.days[t.days.length-1].d>=from);
  const tot=L.reduce((a,t)=>{const S=slStats(t);a.sum+=S.sum;a.pax+=S.pax;a.target+=S.target;return a},{sum:0,pax:0,target:0});
  const byG={};L.forEach(t=>{const S=slStats(t);const k=t.guide||'—';byG[k]=byG[k]||{g:k,sum:0,pax:0};byG[k].sum+=S.sum;byG[k].pax+=S.pax});
  const items=slItems();
  el.innerHTML=`<details class="sla"${slAdmOpen?' open':''}><summary><b>💰 Продажи и цели</b> <span class="hint">за 2 недели: ${money(tot.sum)} · на человека ${money(tot.pax?tot.sum/tot.pax:0)} · ${tot.target?Math.round(tot.sum/tot.target*100):0}% цели</span></summary>
    <div class="sla-top"><label>Цель на человека, $ <input type="number" id="slTarget" value="${SL_TARGET()}" min="0" step="10"></label><span class="hint">Считаются все гости автобуса, кроме младенцев (INF).</span></div>
    <div class="sla-tbl"><table><thead><tr><th>Автобус</th><th>Гид</th><th>Даты</th><th class="n">Гостей</th><th class="n">Продано</th><th class="n">На чел.</th><th class="n">Цель</th><th>Цены</th></tr></thead><tbody>
      ${L.map(t=>{const S=slStats(t);return `<tr><td><b>${esc(t.bus||'')}</b></td><td>${esc(t.guide||'')}</td><td class="num">${isoDM(t.days[0].d)}–${isoDM(t.days[t.days.length-1].d)}</td><td class="n">${S.pax}</td><td class="n"><b>${money(S.sum)}</b></td><td class="n">${money(S.per)}</td><td class="n"><span class="slpct ${S.pct>=100?'ok':S.pct>=60?'mid':'low'}">${S.pct}%</span></td><td><select data-plist="${esc(t.id)}"><option value="ind"${t.plist!=='grp'?' selected':''}>индивид.</option><option value="grp"${t.plist==='grp'?' selected':''}>TOPLU</option></select></td></tr>`}).join('')||'<tr><td colspan="8" class="hint">Нет автобусов со списками гостей за 2 недели.</td></tr>'}
    </tbody></table></div>
    ${Object.keys(byG).length?`<div class="sli"><b>По гидам:</b> ${Object.values(byG).sort((a,b)=>b.sum-a.sum).map(x=>`<span>${esc(x.g)}: ${money(x.sum)} · ${money(x.pax?x.sum/x.pax:0)}/чел</span>`).join('')}</div>`:''}
    <details class="sll"><summary>Прайс (${items.length}) — загрузите файл ПРАЙС в «⬆ Программы и списки групп» или в «Загрузить день»</summary>
      <table class="slp"><thead><tr><th>Позиция</th><th class="n">Цена</th><th class="n">Индивид.</th><th class="n">TOPLU</th><th></th></tr></thead><tbody>${items.map(it=>`<tr><td>${it.k==='pack'?'📦 ':''}${esc(it.n)}</td>${['full','ind','grp'].map(f=>`<td class="n">${f!=='full'&&it.k!=='pack'?'':`<input type="number" data-plf="${esc(it.id)}|${f}" value="${esc(it[f]==null?'':it[f])}" min="0">`}</td>`).join('')}<td><button type="button" class="x" data-pldel="${esc(it.id)}" aria-label="Удалить">✕</button></td></tr>`).join('')}</tbody></table></details>
    ${L.map(t=>slOf(t.id).length?slCard(t,{list:true,by:true}):'').join('')}</details>`;
  el.querySelector('details.sla').ontoggle=e=>{slAdmOpen=e.target.open;store.set('slAdmOpen',slAdmOpen)};
  $('#slTarget').onchange=e=>savePrices({'~target':Math.max(0,+e.target.value||0)});
  el.querySelectorAll('[data-plist]').forEach(s=>s.onchange=()=>{const t=JSON.parse(JSON.stringify(TOURS[s.dataset.plist]));t.plist=s.value;saveTour(t.id,t);renderSalesAdm()});
  el.querySelectorAll('[data-plf]').forEach(i=>i.onchange=()=>{const [id,f]=i.dataset.plf.split('|');savePrices({[id]:Object.assign({},PRICES[id],{[f]:+i.value||0})})});
  el.querySelectorAll('[data-pldel]').forEach(b=>b.onclick=()=>{const it=PRICES[b.dataset.pldel];if(it&&confirm(T('Убрать из прайса?')+' '+it.n))savePrices({[b.dataset.pldel]:null})});
  bindSlCards(el)}
if(!SERVER)slRefresh();
