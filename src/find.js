/* ---------- find any guest by name or phone: phone, WhatsApp, family, excursion bus, transfers, notes ---------- */
// Looks through everything loaded on this device: group lists of the excursion buses (they carry phones),
// every uploaded KAPAK day (arrivals, departures) and today's hand-added guests. A guide sees only his own guests.
const fdN=s=>String(s||'').toLocaleUpperCase('tr').replace(/İ/g,'I').replace(/Ş/g,'S').replace(/Ğ/g,'G').replace(/Ü/g,'U').replace(/Ö/g,'O').replace(/Ç/g,'C').replace(/[^A-Z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
const fdKey=n=>fdN(n).split(' ').sort().join(' ');
const waNum=p=>{let d=String(p||'').replace(/\D/g,'');if(/^0\d{10}$/.test(d))d='90'+d.slice(1);else if(/^8\d{10}$/.test(d))d='7'+d.slice(1);else if(/^5\d{9}$/.test(d))d='90'+d;return d.length>=10?d:''};
function fdIndex(){const out=[];
  try{tours().forEach(t=>(t.gx||[]).forEach((x,i)=>{if(!x.gone)out.push({k:fdKey(x.n),n:x.n,src:'tour',t,x,i})}))}catch(e){}
  Object.values(DAYS||{}).forEach(d=>{['arr','dep'].forEach(kind=>(d[kind]||[]).forEach(g=>(g.p||[]).forEach(p=>{if(p&&p[1])out.push({k:fdKey(p[1]),n:p[1],src:kind,d,g,p})})))});
  return out}
function fdSearch(q){q=String(q||'').trim();if(q.length<2)return [];const digits=q.replace(/\D/g,'');const Q=fdN(q).split(' ').filter(Boolean);
  const hit=e=>{if(digits.length>=4&&e.x&&String(e.x.phone||'').replace(/\D/g,'').includes(digits))return true;if(!Q.length||digits.length>=4&&!/[A-Za-zА-Яа-яÇĞİÖŞÜçğıöşü]/.test(q))return false;
    const W=e.k.split(' ');return Q.every(t=>W.some(w=>w.startsWith(t)))};
  // one card per person: the same name in a group list and in the KAPAK days comes together
  const by=new Map();fdIndex().filter(hit).forEach(e=>{const c=by.get(e.k)||{k:e.k,n:e.n,items:[]};c.items.push(e);if(e.src==='tour')c.n=e.n;by.set(e.k,c)});
  const today=isoToday();
  return [...by.values()].map(c=>{const tr=c.items.filter(e=>e.src==='tour');const dd=c.items.filter(e=>e.src!=='tour');
    c.score=(tr.some(e=>dayOfTour(e.t,today))?4:0)+(dd.some(e=>e.d.iso>=isoAdd(today,-1)&&e.d.iso<=isoAdd(today,1))?3:0)+(tr.length?1:0);return c})
    .sort((a,b)=>b.score-a.score||a.n.localeCompare(b.n,'tr')).slice(0,30)}
function fdHotelOn(t,iso){const dm=iso.slice(8,10)+'.'+iso.slice(5,7);const H=(t.ghotels||[]).map(h=>{const m=h.match(/^(\d\d)\.(\d\d)\s*[–-]\s*(\d\d)\.(\d\d)\s+(.+)$/);return m?{a:iso.slice(0,4)+'-'+m[2]+'-'+m[1],b:iso.slice(0,4)+'-'+m[4]+'-'+m[3],h:m[5]}:null}).filter(Boolean);
  const x=H.find(h=>iso>=h.a&&iso<h.b)||H.find(h=>iso===h.b);return x?x.h:''}
function fdCard(c){const today=isoToday();const tr=c.items.filter(e=>e.src==='tour');const arr=c.items.filter(e=>e.src==='arr').sort((a,b)=>a.d.iso.localeCompare(b.d.iso));const dep=c.items.filter(e=>e.src==='dep').sort((a,b)=>a.d.iso.localeCompare(b.d.iso));
  const x=tr[0]&&tr[0].x;const p=(arr[0]||dep[0]||{}).p;const ph=x&&x.phone;const wa=waNum(ph);
  const age=x&&x.dob?ageOn(x.dob,today):p&&p[2]!=null&&p[2]!==''?p[2]:'';
  const fam=tr[0]?(tr[0].t.gx||[]).filter((y,j)=>j!==tr[0].i&&!y.gone&&y.fam&&y.fam===x.fam).map(y=>y.n):[];
  const gl=g=>{if(!g)return '';const gp=(typeof gPhone==='function'&&gPhone(g))||'';const w=waNum(gp);return `${esc(g)}${gp?` <a href="tel:${esc(gp.replace(/[^\d+]/g,''))}">📞</a>${w?` <a href="https://wa.me/${w}" target="_blank" rel="noopener">WA</a>`:''}`:''}`};
  const note=tr.map(e=>{try{return (TM[e.t.id+'|gn|'+e.i]||{}).note}catch(er){return ''}}).filter(Boolean)[0]||'';
  return `<article class="fd-c"><div class="fd-h"><b>${esc(c.n)}</b><span class="hint">${age!==''?age+' л.':''}${x&&x.sex?' · '+esc(x.sex):''}${p&&p[0]?' · '+esc(p[0]):''}</span></div>
    ${ph?`<div class="fd-ph"><a class="btn sm" href="tel:${esc(String(ph).replace(/[^\d+]/g,''))}">📞 ${esc(ph)}</a>${wa?`<a class="btn sm wa-go" target="_blank" rel="noopener" href="https://wa.me/${wa}">WhatsApp</a>`:''}<button type="button" class="btn sm ghost" data-fdcopy="${esc(ph)}">📋</button></div>`:`<div class="hint">Телефона нет: он бывает только в списках групп экскурсий.</div>`}
    ${fam.length?`<div class="fd-r">👨‍👩‍👧 вместе: ${fam.map(esc).join(', ')}</div>`:''}
    ${note?`<div class="fd-r gnote">✎ ${esc(note)}</div>`:''}
    ${x&&x.c&&isOps()?`<div class="fd-r hint">💬 ${esc(x.c)}</div>`:''}
    ${tr.map(e=>{const t=e.t;const on=dayOfTour(t,today);const h=on?fdHotelOn(t,today):'';return `<div class="fd-r">🚌 <b>${esc(t.bus||'')}</b> ${isoDM(t.days[0].d)}–${isoDM(t.days[t.days.length-1].d)} · гид ${gl(gSplit(t.guide)[0]||t.guide)}${gSplit(t.guide).length>1?' + '+gSplit(t.guide).slice(1).map(gl).join(' + '):''}${on?` · <b>сейчас в туре</b>${h?', отель '+esc(h):''}`:''} <button type="button" class="btn sm ghost" data-fdtour="${esc(t.id)}" data-fdname="${esc(e.x.n)}">открыть</button></div>`}).join('')}
    ${x&&(x.af||x.ad)?`<div class="fd-r">🛬 ${esc(x.af||'')} ${x.ad?gxDm(x.ad):''} ${esc(x.at||'')}${x.rf||x.rd?` · 🛫 ${esc(x.rf||'')} ${x.rd?gxDm(x.rd):''} ${esc(x.rt||'')}`:''}</div>`:''}
    ${arr.map(e=>`<div class="fd-r">✈ <b>${isoDM(e.d.iso)}</b> прилёт ${esc(e.g.fl||'')} ${esc(e.g.t||'')} → ${esc(e.g.h||'')}${e.g.g?' · гид '+gl(e.g.g):''}${e.g.v?' · '+esc(e.g.v):''}</div>`).join('')}
    ${dep.map(e=>`<div class="fd-r">🛫 <b>${isoDM(e.d.iso)}</b> вылет ${esc(e.g.fl||'')} ${esc(e.g.t||'')} · сбор ${esc(e.g.pu||'—')} из ${esc(e.g.h||'')}${e.g.g?' · гид '+gl(e.g.g):''}${e.g.v?' · '+esc(e.g.v):''}</div>`).join('')}
  </article>`}
function fdRender(){const q=$('#fdQ').value;const R=fdSearch(q);const box=$('#fdRes');
  box.innerHTML=q.trim().length<2?'<p class="hint">Начните вводить фамилию, имя или номер телефона (от 4 цифр).</p>':R.length?R.map(fdCard).join(''):'<p class="hint">Никого не нашёл. Гости ищутся в списках групп и в загруженных KAPAK.</p>';
  box.querySelectorAll('[data-fdcopy]').forEach(b=>b.onclick=()=>copy(b.dataset.fdcopy,true));
  box.querySelectorAll('[data-fdtour]').forEach(b=>b.onclick=()=>{const tid=b.dataset.fdtour;fdClose();
    // the bus's guest list, filtered to this guest
    try{TGQ[tid]=b.dataset.fdname.split(' ')[0];if(isOps())TOURPICK=tid;gKind='tour';store.set('gkind','tour');const tab=$(ROLE==='guide'?'.tab[data-t="tours"]':'.tab[data-t="guide"]');if(tab)tab.click();setGuideMode('guests')}catch(e){}})}
function fdOpen(){const el=$('#fdBox');el.hidden=false;document.body.classList.add('sc-open');const q=$('#fdQ');q.value='';fdRender();setTimeout(()=>q.focus(),50)}
function fdClose(){$('#fdBox').hidden=true;document.body.classList.remove('sc-open')}
$('#findBtn').onclick=fdOpen;$('#fdClose').onclick=fdClose;$('#fdQ').oninput=fdRender;
$('#fdBox').addEventListener('click',e=>{if(e.target.id==='fdBox')fdClose()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#fdBox').hidden)fdClose();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!$('#login').offsetParent){e.preventDefault();fdOpen()}});
