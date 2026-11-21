/* ---------- excursion buses: when the bus came to and left every stop, from the driver's GPS ---------- */
// The driver's phone (Sarabi Sürücü / Telegram) sends points; the office turns the day's track into stops (≥4 min in one place)
// and matches them to the program: TM['tid|sid'].ga / .gd = minutes by GPS (guides and the office see them, the guide has nothing to press).
// A place learns its coordinates once — from a guide's «Прибыли» while the bus stood there, or when the office names a stop — and is known for every bus after that.
const GPSD={};let gpsBusy=false;
const hav=(a,b)=>{const r=Math.PI/180,dl=(b[0]-a[0])*r,dg=(b[1]-a[1])*r;const x=Math.sin(dl/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dg/2)**2;return 2*6371e3*Math.asin(Math.sqrt(x))};
const msMin=ms=>{const d=new Date(ms);return d.getHours()*60+d.getMinutes()};
const dg10=p=>String(p||'').replace(/\D/g,'').slice(-10);
// stops whose place is the same for every bus (not "the hotel" / "the airport")
const gpsPlace=s=>!['start','hotel','transfer'].includes(s.k)&&!/OTEL|HOTEL|HAVALIMAN|AIRPORT/i.test(s.n);
// the driver of this bus: chosen by the office, or found by the driver's phone from the program / vehicles message
function tourDrv(t){if(!t)return null;if(t.drv)return LOCS.find(x=>x.id===t.drv)||{id:t.drv,name:'',veh:''};const ph=dg10(t.dphone);if(ph.length===10){const x=LOCS.find(x=>dg10(x.phone)===ph);if(x)return x}return null}
// the day's track → stops: points within 120 m of each other for 4 min or more; left = the first point away (minus a minute: the phone sends when it moves)
function gpsDwells(tr,now){const out=[];let i=0;
  while(i<tr.length){let j=i,la=tr[i][0],lo=tr[i][1],n=1;
    while(j+1<tr.length&&hav([la/n,lo/n],tr[j+1])<120){j++;la+=tr[j][0];lo+=tr[j][1];n++}
    const nx=tr[j+1];const a=tr[i][2];const d=nx?Math.max(tr[j][2],nx[2]-60000):null;
    // one lonely point with the next one far away is a gap in the signal while driving, not a stop
    const real=n>1||!nx||hav(tr[j],nx)<1500;
    if(real&&(d||now)-a>=4*60000)out.push({ll:[la/n,lo/n],a,d});i=j+1}
  return out}
function gpsMatch(t,iso,D){const x=dayOfTour(t,iso);const P=(TOURS['~places']||{}).places||{};const res={},used=new Set();let from=0;if(!x)return {res,used};
  x.day.s.forEach(s=>{if(!gpsPlace(s))return;const ll=(P[placeKey(s)]||{}).ll;if(!ll)return;
    const k=D.findIndex((w,wi)=>wi>=from&&!used.has(wi)&&hav(w.ll,ll)<300);if(k<0)return;used.add(k);from=k+1;res[s.id]=D[k]});
  return {res,used}}
async function gpsTick(){if(!SERVER||!isOps()||gpsBusy||document.hidden)return;const iso=isoToday();
  const L=tours().filter(t=>dayOfTour(t,iso));if(!L.length)return;gpsBusy=true;
  try{if(!LOCS.length)await pullLocs();const D=new Map();L.forEach(t=>{const d=tourDrv(t);if(d)D.set(t.id,d)});if(!D.size)return;
    const r=await api('GET','/api/track?ids='+encodeURIComponent([...new Set([...D.values()].map(d=>d.id))].join(',')));const now=r.now||Date.now();
    const day0=new Date();day0.setHours(0,0,0,0);let changed=false;const sig0=JSON.stringify(Object.values(GPSD).map(g=>[g.drv.id,g.W.length,g.used.size]));
    L.forEach(t=>{const drv=D.get(t.id);if(!drv)return;const tr=(r.tracks[drv.id]||[]).filter(p=>p[2]>=+day0);const W=gpsDwells(tr,now);const x=dayOfTour(t,iso);
      // learn a place: the guide pressed «Прибыли» while the bus stood there
      const P=(TOURS['~places']||{}).places||{};
      x.day.s.forEach(s=>{if(!gpsPlace(s))return;const key=placeKey(s);if((P[key]||{}).ll)return;const m=TM[t.id+'|'+s.id]||{};if(m.a==null)return;
        const gap=w=>{const a=msMin(w.a),d=msMin(w.d||now);return m.a<a?a-m.a:m.a>d?m.a-d:0};const w=W.filter(w=>gap(w)<=10).sort((x,y)=>gap(x)-gap(y))[0];if(w){setPlaceCfg(key,{ll:w.ll.map(v=>Math.round(v*1e5)/1e5)});changed=true}});
      const {res,used}=gpsMatch(t,iso,W);
      x.day.s.forEach(s=>{const k=t.id+'|'+s.id;const m=TM[k]||{};const w=res[s.id];const ga=w?msMin(w.a):null,gd=w&&w.d?msMin(w.d):null;
        if((m.ga==null?null:m.ga)===ga&&(m.gd==null?null:m.gd)===gd)return;const v=Object.assign({},m);delete v.ga;delete v.gd;if(ga!=null)v.ga=ga;if(gd!=null)v.gd=gd;
        saveTM(k,Object.keys(v).length?v:null);changed=true});
      GPSD[t.id]={drv,W,used,at:now,last:tr.length?tr[tr.length-1][2]:0}});
    // redraw only when something changed (a select being used is not reset every minute)
    const busy=document.activeElement&&document.activeElement.matches&&document.activeElement.matches('select,input');
    if((changed||JSON.stringify(Object.values(GPSD).map(g=>[g.drv.id,g.W.length,g.used.size]))!==sig0)&&!busy)tourRefresh()}catch(e){}finally{gpsBusy=false}}
setInterval(gpsTick,60000);setTimeout(gpsTick,6000);
// the office's line in the tour card: whose GPS this bus uses (or a choice), and stops the GPS saw that have no name yet
function gpsDrvHtml(t){if(!isOps())return '';const d=tourDrv(t);const G=GPSD[t.id];
  const opts=LOCS.slice().sort((a,b)=>String(a.veh).localeCompare(String(b.veh),'tr',{numeric:true})).map(x=>`<option value="${esc(x.id)}"${d&&d.id===x.id?' selected':''}>${esc(x.veh||'—')} · ${esc(x.name||'')}</option>`).join('');
  return `<div class="gps-l">🛰 <select data-tdrv="${esc(t.id)}"><option value="">${d?'— авто по телефону —':'GPS: выберите водителя автобуса'}</option>${opts}</select>${d?` <span class="hint">${G&&G.last?'сигнал '+ago(Date.now()-G.last):'сигнала сегодня не было'}</span>`:''}</div>`}
function gpsDwellHtml(t,iso){if(!isOps()||iso!==isoToday())return '';const G=GPSD[t.id];if(!G)return '';const x=dayOfTour(t,iso);const P=(TOURS['~places']||{}).places||{};
  const free=G.W.map((w,i)=>({w,i})).filter(o=>!G.used.has(o.i)&&((o.w.d||G.at)-o.w.a>=8*60000));if(!free.length)return '';
  const opts=x.day.s.filter(s=>gpsPlace(s)).map(s=>`<option value="${esc(placeKey(s))}">${esc(s.n)}${(P[placeKey(s)]||{}).ll?' (переставить)':''}</option>`).join('');
  return `<details class="gps-w"><summary>🅿 Стоянки по GPS без названия: ${free.length}</summary>${free.map(({w,i})=>`<div class="gps-r"><span class="num">${fmt(msMin(w.a))}–${w.d?fmt(msMin(w.d)):'сейчас'}</span> <a href="https://www.google.com/maps?q=${w.ll[0].toFixed(5)},${w.ll[1].toFixed(5)}" target="_blank" rel="noopener">на карте</a> <select data-gpsp="${esc(t.id)}|${i}"><option value="">это…</option>${opts}</select></div>`).join('')}</details>`}
function gpsBind(el){
  el.querySelectorAll('[data-tdrv]').forEach(s=>s.onchange=()=>{const t=JSON.parse(JSON.stringify(TOURS[s.dataset.tdrv]));if(s.value)t.drv=s.value;else delete t.drv;saveTour(t.id,t);toast('Водитель автобуса сохранён');setTimeout(gpsTick,500)});
  el.querySelectorAll('[data-gpsp]').forEach(s=>s.onchange=()=>{if(!s.value)return;const [tid,i]=s.dataset.gpsp.split('|');const w=(GPSD[tid]||{}).W[+i];if(!w)return;
    setPlaceCfg(s.value,{ll:w.ll.map(v=>Math.round(v*1e5)/1e5)});toast('Точка запомнена — дальше время будет ставиться само для всех автобусов');setTimeout(gpsTick,500)})}
