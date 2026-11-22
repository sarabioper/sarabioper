/* ---------- accounts (administrator only): the accountant's Excel exports → income, expenses and profit by month, taxes, debts, state support ---------- */
// What can be loaded (any of them, several at once; columns are found by their Turkish headers, the admin checks them before saving):
//   • a list of operations: invoices (e-fatura giden/gelen), gelir-gider, bank/cash statement — TARİH + TUTAR, or BORÇ/ALACAK, or GELİR/GİDER (+ KDV, ÜNVAN, AÇIKLAMA)
//   • a trial balance (mizan): HESAP KODU + BORÇ + ALACAK — revenue 60x, costs 62x–66x, receivables 120, payables 320, KDV 191/391
//   • a list of balances (cari bakiye): ÜNVAN + BORÇ/ALACAK/BAKİYE — who owes us, whom we owe
// Stored on the server for the administrator only: state/00.00/acct = {tx:[[iso, ±amount, ±kdv, desc, cari, fileId]], files, mizan, cari, paid, use}
var ACCT={tx:[],files:[],mizan:null,cari:null,paid:{},use:{}},acLoaded=false,acY=new Date().getFullYear(),AC_IMP=null;
const acTL=v=>(Math.round(+v||0)).toLocaleString('tr-TR')+' ₺';
const acN=s=>String(s==null?'':s).toLocaleUpperCase('tr').replace(/\s+/g,' ').trim();
const AC_F={date:/^(TAR[İI]H|FATURA TAR[İI]H[İI]|BELGE TAR[İI]H[İI]|[İI]ŞLEM TAR[İI]H[İI]|F[İI]Ş TAR[İI]H[İI]|VADE TAR[İI]H[İI]|DATE)( |$)/,
  code:/HESAP KODU|^KOD(U)?$|^HESAP NO/,desc:/A[ÇC]IKLAMA|HESAP ADI|DESCRIPTION|^MAL\/H[İI]ZMET/,
  cari:/[ÜU]NVAN|^CAR[İI]|F[İI]RMA|M[ÜU]ŞTER[İI]|TEDAR[İI]K|^ALICI|^SATICI|G[ÖO]NDER[İI]C[İI]|KARŞI TARAF/,
  borc:/^BOR[ÇC]/,alacak:/^ALACAK/,bakiye:/BAK[İI]YE/,gelir:/^GEL[İI]R/,gider:/^G[İI]DER/,
  kdv:/KDV|VAT/,amt:/GENEL TOPLAM|[ÖO]DENECEK|TUTAR|TOPLAM|AMOUNT|^MATRAH/,dir:/T[İI]P[İI]?$|T[ÜU]R[ÜU]?$|Y[ÖO]N[ÜU]?$|SENARYO|TYPE/};
const AC_FL={date:'Дата',code:'Код счёта',desc:'Описание',cari:'Контрагент',borc:'Borç',alacak:'Alacak',bakiye:'Bakiye',gelir:'Gelir',gider:'Gider',kdv:'KDV',amt:'Сумма',dir:'Тип (alış/satış)'};
function acNum(v){if(v==null||v==='')return 0;if(typeof v==='number')return v;let s=String(v).trim();const neg=/^\(.*\)$/.test(s)||/^-/.test(s)||/-$/.test(s);
  s=s.replace(/[^\d.,]/g,'');if(!s)return 0;const c=s.lastIndexOf(','),d=s.lastIndexOf('.');
  if(c>=0&&d>=0)s=c>d?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');else if(c>=0)s=/,\d{3}$/.test(s)&&!/,\d{1,2}$/.test(s)&&s.split(',').length>2?s.replace(/,/g,''):s.replace(',','.');
  else if(d>=0&&/^\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');const n=parseFloat(s)||0;return neg?-n:n}
function acDate(v){if(v instanceof Date&&!isNaN(v))return new Date(v.getTime()-v.getTimezoneOffset()*60000).toISOString().slice(0,10);
  if(typeof v==='number'&&v>30000&&v<70000){const d=new Date(Date.UTC(1899,11,30)+v*864e5);return d.toISOString().slice(0,10)}
  const s=String(v||'');let m=s.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  m=s.match(/(\d{4})-(\d{2})-(\d{2})/);return m?m[0]:null}
// the header row and which column is what
function acHead(rows){let best=null;for(let i=0;i<Math.min(rows.length,25);i++){const H=(rows[i]||[]).map(acN);const map={};
    H.forEach((h,c)=>{if(!h)return;for(const f of ['date','code','kdv','borc','alacak','bakiye','gelir','gider','cari','desc','dir','amt']){if(map[f]!=null)continue;if(f==='amt'&&/KDV|VAT/.test(h))continue;if(f==='desc'&&map.cari===c)continue;if(AC_F[f].test(h)){map[f]=c;break}}});
    // the amount without KDV (matrah) is preferred: profit is counted without VAT
    const mi=H.findIndex(h=>/^MATRAH|KDV HAR[İI]Ç|NET TUTAR/.test(h));if(mi>=0)map.amt=mi;
    const sc=Object.keys(map).length;if(sc>=2&&(!best||sc>best.sc))best={i,map,sc,H}}
  return best}
function acKind(m){if(!m)return null;const k=m.map;if(k.code!=null&&k.borc!=null&&k.alacak!=null&&k.date==null)return 'mizan';
  if(k.cari!=null&&(k.bakiye!=null||k.borc!=null&&k.alacak!=null)&&k.date==null)return 'cari';
  if(k.date!=null&&(k.amt!=null||k.borc!=null||k.alacak!=null||k.gelir!=null||k.gider!=null))return 'tx';return null}
// a file from the common upload box: is it an accounting export?
function isAcctRows(rows){const h=acHead(rows);const k=acKind(h);return !!k&&(k!=='tx'||h.map.kdv!=null||h.map.borc!=null||h.map.gelir!=null||h.map.cari!=null)}
async function acSheets(file){if(typeof XLSX==='undefined')throw new Error('библиотека Excel не загрузилась, обновите страницу');
  const ext=(file.name.match(/\.(\w+)$/)||[])[1]?.toLowerCase();
  if(ext==='csv'||ext==='txt'){const buf=await file.arrayBuffer();let t=new TextDecoder('utf-8').decode(buf);if(/�/.test(t))t=new TextDecoder('windows-1254').decode(buf);
    const wb=XLSX.read(t.replace(/^﻿/,''),{type:'string',raw:true});return [{n:file.name,rows:XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:false,defval:''})}]}
  const wb=XLSX.read(new Uint8Array(await file.arrayBuffer()),{type:'array',cellDates:true});
  return wb.SheetNames.map(n=>({n,rows:XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:true,defval:''})}))}
// direction of a list of operations: guessed from the file name, the admin can change it in the preview
function acGuessDir(name,map){const N=acN(name);if(map.gelir!=null||map.gider!=null)return 'gg';
  if(map.borc!=null&&map.alacak!=null)return /SATIŞ|SATIS|G[İI]DEN|M[ÜU]ŞTER/.test(N)?'ba-rev':'ba';
  if(/G[İI]DEN|SATIŞ|SATIS|GEL[İI]R/.test(N))return 'in';if(/GELEN|ALIŞ|ALIS|G[İI]DER|MASRAF/.test(N))return 'out';return map.dir!=null?'col':'sign'}
const AC_DIRS={gg:'колонки Gelir / Gider',ba:'Borç = приход, Alacak = расход (банк, касса)','ba-rev':'Borç = продажа (доход), Alacak = оплата (выписка по клиенту)',in:'все строки — доход (продажи)',out:'все строки — расход (покупки)',col:'по колонке «тип» (satış / alış)',sign:'по знаку суммы (+ доход, − расход)'};
function acTx(P){const {rows,h,dir}=P;const m=h.map;const out=[];const g=(r,f)=>m[f]==null?'':r[m[f]];
  for(let i=h.i+1;i<rows.length;i++){const r=rows[i]||[];const iso=acDate(g(r,'date'));if(!iso)continue;let a=0;const k=Math.abs(acNum(g(r,'kdv')));
    if(dir==='gg')a=acNum(g(r,'gelir'))-acNum(g(r,'gider'));
    else if(dir==='ba'||dir==='ba-rev'){const b=acNum(g(r,'borc')),c=acNum(g(r,'alacak'));a=dir==='ba'?b-c:b-c;if(dir==='ba-rev'&&c&&!b)continue}
    else{let v=acNum(g(r,'amt'));if(k&&m.kdv!=null&&!/^MATRAH|KDV HAR[İI]Ç|NET TUTAR/.test((h.H||[])[m.amt]||''))v=Math.sign(v)*(Math.abs(v)-k);if(dir==='in')a=Math.abs(v);else if(dir==='out')a=-Math.abs(v);else if(dir==='sign')a=v;
      else{const t=acN(g(r,'dir'));a=/SATIŞ|SATIS|G[İI]DEN|GEL[İI]R|İADE ALIŞ/.test(t)?Math.abs(v):/ALIŞ|ALIS|GELEN|G[İI]DER|MASRAF/.test(t)?-Math.abs(v):v}}
    if(!a)continue;const desc=String(g(r,'desc')||'').trim().slice(0,80),cari=String(g(r,'cari')||'').trim().slice(0,60);
    out.push([iso,Math.round(a*100)/100,Math.round((a<0?-k:k)*100)/100,desc,cari])}
  return out}
function acMizan(P){const {rows,h}=P;const m=h.map;const acc=[];for(let i=h.i+1;i<rows.length;i++){const r=rows[i]||[];const code=String(r[m.code]||'').trim();if(!/^\d{3}/.test(code))continue;
    acc.push([code,String(m.desc!=null?r[m.desc]:'').trim().slice(0,60),Math.round(acNum(r[m.borc])*100)/100,Math.round(acNum(r[m.alacak])*100)/100])}return acc}
function acCari(P){const {rows,h}=P;const m=h.map;const out=[];for(let i=h.i+1;i<rows.length;i++){const r=rows[i]||[];const n=String(r[m.cari]||'').trim();if(!n||/^TOPLAM/i.test(n))continue;
    let b;if(m.bakiye!=null){const raw=String(r[m.bakiye]);b=Math.abs(acNum(r[m.bakiye]));if(/\(?A\)?\s*$/i.test(raw)||/ALACAK/i.test(raw))b=-b;else if(!/\(?B\)?\s*$/i.test(raw)&&m.borc!=null&&m.alacak!=null)b=acNum(r[m.borc])-acNum(r[m.alacak]);else if(acNum(r[m.bakiye])<0)b=-b}
    else b=acNum(r[m.borc])-acNum(r[m.alacak]);if(Math.abs(b)>=1)out.push([n.slice(0,60),Math.round(b*100)/100])}return out}
// loading: every sheet is parsed and shown for checking before it is saved
async function acctImport(files){if(!isAdmin())return;const P=[];
  for(const f of files){try{for(const sh of await acSheets(f)){const h=acHead(sh.rows);const kind=acKind(h);if(!kind)continue;P.push({file:f.name,sheet:sh.n,rows:sh.rows,h,kind,dir:kind==='tx'?acGuessDir(f.name+' '+sh.n,h.map):''})}}catch(e){toast(f.name+': '+e.message)}}
  if(!P.length)return toast('Не нашёл в файлах колонок бухгалтерии (TARİH, TUTAR, BORÇ/ALACAK, HESAP KODU, ÜNVAN…)');
  AC_IMP=P;$('.tab[data-t="acct"]').click();renderAcct()}
function acPrevHtml(){return `<div class="panel ac-imp"><h2>Проверьте, как я понял файлы</h2>${AC_IMP.map((P,pi)=>{const m=P.h.map;
  const opts=f=>`<option value="">—</option>${P.h.H.map((h,c)=>h?`<option value="${c}"${m[f]===c?' selected':''}>${esc(h)}</option>`:'').join('')}`;
  const fields=P.kind==='tx'?['date','amt','borc','alacak','gelir','gider','kdv','cari','desc','dir']:P.kind==='mizan'?['code','desc','borc','alacak']:['cari','borc','alacak','bakiye'];
  let sum='';if(P.kind==='tx'){const T=acTx(P);const inc=T.filter(t=>t[1]>0).reduce((a,t)=>a+t[1],0),exp=T.filter(t=>t[1]<0).reduce((a,t)=>a-t[1],0);const ds=T.map(t=>t[0]).sort();
    sum=`<p><b>${T.length}</b> операций${ds.length?` · ${isoDM(ds[0])}.${ds[0].slice(0,4)} – ${isoDM(ds[ds.length-1])}.${ds[ds.length-1].slice(0,4)}`:''} · доход <b class="ac-in">${acTL(inc)}</b> · расход <b class="ac-out">${acTL(exp)}</b></p>
      <table class="ac-t"><tbody>${T.slice(0,4).map(t=>`<tr><td class="num">${isoDM(t[0])}</td><td>${esc(t[4]||t[3])}</td><td class="n ${t[1]>0?'ac-in':'ac-out'}">${acTL(t[1])}</td></tr>`).join('')}</tbody></table>`}
  else if(P.kind==='mizan'){const A=acMizan(P);sum=`<p>Мизан: <b>${A.length}</b> счетов</p>`}else{const C=acCari(P);sum=`<p><b>${C.length}</b> контрагентов · нам должны ${acTL(C.filter(c=>c[1]>0).reduce((a,c)=>a+c[1],0))} · мы должны ${acTL(-C.filter(c=>c[1]<0).reduce((a,c)=>a+c[1],0))}</p>`}
  return `<section class="ac-p"><div class="ac-ph"><b>${esc(P.file)}</b>${P.sheet!==P.file?` <span class="hint">лист «${esc(P.sheet)}»</span>`:''} <select data-ackind="${pi}">${[['tx','операции (доход/расход)'],['mizan','мизан'],['cari','остатки по контрагентам'],['skip','не загружать']].map(([k,l])=>`<option value="${k}"${P.kind===k?' selected':''}>${l}</option>`).join('')}</select></div>
    ${P.kind==='skip'?'':`<div class="ac-map">${fields.map(f=>`<label>${AC_FL[f]}<select data-acmap="${pi}|${f}">${opts(f)}</select></label>`).join('')}</div>
    ${P.kind==='tx'?`<label class="ac-dir">Как понимать суммы: <select data-acdir="${pi}">${Object.entries(AC_DIRS).map(([k,l])=>`<option value="${k}"${P.dir===k?' selected':''}>${l}</option>`).join('')}</select></label>`:''}${sum}`}</section>`}).join('')}
  <div class="ac-go"><button type="button" class="btn primary" data-acsave>✅ Сохранить в бухгалтерию</button><button type="button" class="btn ghost" data-accancel>Отмена</button></div></div>`}
async function acSaveImp(){let nTx=0,dup=0;const keys=new Set(ACCT.tx.map(t=>t.slice(0,5).join('|')));
  AC_IMP.forEach(P=>{if(P.kind==='skip')return;const fid='f'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    if(P.kind==='tx'){const T=acTx(P);T.forEach(t=>{const k=t.join('|');if(keys.has(k)){dup++;return}keys.add(k);ACCT.tx.push(t.concat(fid));nTx++});
      const ds=T.map(t=>t[0]).sort();ACCT.files.push({id:fid,n:P.file+(P.sheet!==P.file?' / '+P.sheet:''),at:new Date().toISOString(),kind:'tx',rows:T.length,from:ds[0]||'',to:ds[ds.length-1]||''})}
    else if(P.kind==='mizan'){ACCT.mizan={n:P.file,at:new Date().toISOString(),acc:acMizan(P)};ACCT.files.push({id:fid,n:P.file,at:ACCT.mizan.at,kind:'mizan',rows:ACCT.mizan.acc.length})}
    else{ACCT.cari={n:P.file,at:new Date().toISOString(),list:acCari(P)};ACCT.files.push({id:fid,n:P.file,at:ACCT.cari.at,kind:'cari',rows:ACCT.cari.list.length})}});
  ACCT.tx.sort((a,b)=>a[0].localeCompare(b[0]));AC_IMP=null;await acPut();toast(`Бухгалтерия: +${nTx} операций${dup?`, ${dup} повторов пропущено`:''}`);renderAcct()}
async function acPut(){if(!SERVER)return;try{await api('PUT','/api/state?d=00.00&kind=acct',ACCT)}catch(e){toast('Не сохранилось: '+e.message)}}
async function loadAcct(){if(!SERVER||!isAdmin())return;try{const r=await api('GET','/api/state?d=00.00&kind=acct');if(r.data&&r.data.tx)ACCT=Object.assign({tx:[],files:[],paid:{},use:{}},r.data);acLoaded=true;renderAcct()}catch(e){}}
/* ---- figures ---- */
function acMonths(y){const M=[...Array(12)].map(()=>({inc:0,exp:0,ki:0,ko:0}));ACCT.tx.forEach(t=>{if(+t[0].slice(0,4)!==y)return;const m=M[+t[0].slice(5,7)-1];if(t[1]>0){m.inc+=t[1];m.ki+=Math.abs(t[2]||0)}else{m.exp-=t[1];m.ko+=Math.abs(t[2]||0)}});return M}
function acTop(y,sign){const R={};ACCT.tx.forEach(t=>{if(+t[0].slice(0,4)!==y||Math.sign(t[1])!==sign)return;const k=t[4]||t[3]||'—';R[k]=(R[k]||0)+Math.abs(t[1])});return Object.entries(R).sort((a,b)=>b[1]-a[1]).slice(0,8)}
// tax days: KDV the 28th, withholding+SGK (MUHSGK) and stamp tax the 26th, provisional tax the 17th of May/August/November, corporate tax by 30 April; a weekend moves it to Monday
function acDue(y,m,d){const x=new Date(y,m,d,12);while(x.getDay()===0||x.getDay()===6)x.setDate(x.getDate()+1);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`}
function acTaxes(){const out=[];const now=new Date();const MN=['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
  for(let k=-2;k<4;k++){const b=new Date(now.getFullYear(),now.getMonth()+k,1);const y=b.getFullYear(),m=b.getMonth();const pm=new Date(y,m-1,1);const per=MN[pm.getMonth()]+' '+pm.getFullYear();
    const M=acMonths(pm.getFullYear())[pm.getMonth()];
    out.push({id:`KDV|${pm.getFullYear()}-${pm.getMonth()+1}`,d:acDue(y,m,28),t:'KDV за '+per,est:M.ki-M.ko,hasK:M.ki||M.ko});
    out.push({id:`MUHSGK|${pm.getFullYear()}-${pm.getMonth()+1}`,d:acDue(y,m,26),t:'Muhtasar и SGK за '+per});
    out.push({id:`DAMGA|${pm.getFullYear()}-${pm.getMonth()+1}`,d:acDue(y,m,26),t:'Damga vergisi за '+per});
    if([4,7,10].includes(m))out.push({id:`GV|${y}-${m}`,d:acDue(y,m,17),t:`Geçici vergi за ${['','','','','I','','','II','','','III'][m]} квартал ${y}`});
    if(m===3)out.push({id:`KV|${y-1}`,d:acDue(y,3,30),t:'Kurumlar vergisi (годовая) за '+(y-1)})}
  return out.sort((a,b)=>a.d.localeCompare(b.d))}
function acMizanSum(){const A=(ACCT.mizan||{}).acc||[];const top=A.filter(a=>/^\d{3}$/.test(a[0]));const L=top.length?top:A.filter(a=>!/\d{3}[.\s-]/.test(a[0])||a[0].length<=3);
  const S=p=>L.filter(a=>p.test(a[0].slice(0,3))).reduce((s,a)=>s+a[2]-a[3],0);
  return {rev:-S(/^60[0-2]/),ded:S(/^61/),cost:S(/^6[2-6]/),rec:S(/^12[01]/),pay:-S(/^32[01]/),kdvOut:-S(/^391/),kdvIn:S(/^19[01]/),tax:-S(/^36[01]/),bank:S(/^10[0-2]/)}}
function acDebts(){if(ACCT.cari&&ACCT.cari.list.length)return {src:ACCT.cari.n,at:ACCT.cari.at,L:ACCT.cari.list};
  const A=(ACCT.mizan||{}).acc||[];const L=A.filter(a=>/^(120|320)[.\s-]?\d/.test(a[0])&&a[0].length>3).map(a=>[a[1]||a[0],a[2]-a[3]]).filter(a=>Math.abs(a[1])>=1);
  return L.length?{src:ACCT.mizan.n,at:ACCT.mizan.at,L}:null}
/* ---- the page ---- */
function renderAcct(){const el=$('#acctBox');if(!el||!isAdmin())return;
  if(AC_IMP){el.innerHTML=acPrevHtml();acBindImp(el);return}
  const yrs=[...new Set(ACCT.tx.map(t=>+t[0].slice(0,4)).concat([new Date().getFullYear()]))].sort();
  const cur=acMonths(acY),prv=acMonths(acY-1);const now=new Date();const lastM=acY===now.getFullYear()?now.getMonth():11;
  const sum=(M,to)=>M.slice(0,to+1).reduce((a,m)=>({inc:a.inc+m.inc,exp:a.exp+m.exp}),{inc:0,exp:0});const A=sum(cur,lastM),B=sum(prv,lastM);
  const d=(a,b)=>b?`<small class="${a>=b?'ac-in':'ac-out'}">${a>=b?'▲':'▼'} ${Math.abs(Math.round((a-b)/Math.abs(b)*100))}% к ${acY-1}</small>`:'';
  const mx=Math.max(1,...cur.map(m=>Math.max(m.inc,m.exp)),...prv.map(m=>Math.max(m.inc,m.exp)));const MN=['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
  const tax=acTaxes().filter(x=>x.d>=isoAdd(isoToday(),-40)).slice(0,10);const debts=acDebts();const ms=ACCT.mizan?acMizanSum():null;
  const has=ACCT.tx.length||ACCT.mizan||ACCT.cari;
  el.innerHTML=`<div class="panel ac-top"><div class="ac-th"><h2>💼 Бухгалтерия</h2>
      <label class="btn primary">⬆ Загрузить выгрузку бухгалтера<input type="file" id="acFile" multiple accept=".xlsx,.xls,.csv,.txt" hidden></label>
      ${yrs.length>1?`<span class="ac-yrs">${yrs.map(y=>`<button type="button" class="btn sm${y===acY?' on':''}" data-acy="${y}">${y}</button>`).join('')}</span>`:''}</div>
    <p class="hint">Excel от бухгалтера: список фатур (giden/gelen), gelir-gider, выписка банка/кассы, мизан, остатки по карточкам (cari bakiye). Можно несколько файлов сразу; перед сохранением я покажу, как понял колонки. Видит только администратор.</p>
    ${has?'':`<p><b>Пока пусто.</b> Попросите бухгалтера выгрузить в Excel за ${acY-1} и ${acY} год: 1) «Gelir-gider» или список фатур, 2) мизан на сегодня, 3) cari bakiye listesi.</p>`}</div>
  ${ACCT.tx.length?`<div class="ac-kpi"><div class="kpi"><small>Доход ${acY}${lastM<11?' (янв–'+MN[lastM].toLowerCase()+')':''}</small><b class="ac-in">${acTL(A.inc)}</b>${d(A.inc,B.inc)}</div>
      <div class="kpi"><small>Расход</small><b class="ac-out">${acTL(A.exp)}</b>${d(A.exp,B.exp)}</div>
      <div class="kpi"><small>Прибыль</small><b>${acTL(A.inc-A.exp)}</b>${d(A.inc-A.exp,B.inc-B.exp)}</div></div>
    <div class="panel"><h3>По месяцам · ${acY} <span class="hint">(тонкая полоса — ${acY-1})</span></h3><table class="ac-t ac-m"><thead><tr><th>Месяц</th><th class="n">Доход</th><th class="n">Расход</th><th class="n">Прибыль</th><th class="n">${acY-1}</th><th></th></tr></thead><tbody>
      ${cur.map((m,i)=>{const p=prv[i];return `<tr><td>${MN[i]}</td><td class="n ac-in">${m.inc?acTL(m.inc):'—'}</td><td class="n ac-out">${m.exp?acTL(m.exp):'—'}</td><td class="n"><b>${m.inc||m.exp?acTL(m.inc-m.exp):'—'}</b></td><td class="n hint">${p.inc||p.exp?acTL(p.inc-p.exp):'—'}</td>
        <td class="ac-bar"><i class="i" style="width:${m.inc/mx*100}%"></i><i class="o" style="width:${m.exp/mx*100}%"></i><i class="p" style="width:${p.inc/mx*100}%"></i></td></tr>`}).join('')}
      <tr class="ac-tot"><td>Итого</td><td class="n">${acTL(cur.reduce((a,m)=>a+m.inc,0))}</td><td class="n">${acTL(cur.reduce((a,m)=>a+m.exp,0))}</td><td class="n"><b>${acTL(cur.reduce((a,m)=>a+m.inc-m.exp,0))}</b></td><td class="n hint">${acTL(prv.reduce((a,m)=>a+m.inc-m.exp,0))}</td><td></td></tr></tbody></table></div>
    <div class="ac-2"><div class="panel"><h3>Откуда доход · ${acY}</h3>${acTop(acY,1).map(([n,v])=>`<div class="ac-r"><span>${esc(n)}</span><b class="ac-in">${acTL(v)}</b></div>`).join('')||'<p class="hint">—</p>'}</div>
      <div class="panel"><h3>Куда уходят деньги · ${acY}</h3>${acTop(acY,-1).map(([n,v])=>`<div class="ac-r"><span>${esc(n)}</span><b class="ac-out">${acTL(v)}</b></div>`).join('')||'<p class="hint">—</p>'}</div></div>`:''}
  ${ms?`<div class="panel"><h3>По мизану <span class="hint">${esc(ACCT.mizan.n)} · загружен ${new Date(ACCT.mizan.at).toLocaleDateString('ru-RU')}</span></h3><div class="ac-kpi sm">
      <div class="kpi"><small>Выручка (600–602)</small><b>${acTL(ms.rev-ms.ded)}</b></div><div class="kpi"><small>Затраты (62x–66x)</small><b>${acTL(ms.cost)}</b></div><div class="kpi"><small>Результат</small><b>${acTL(ms.rev-ms.ded-ms.cost)}</b></div>
      <div class="kpi"><small>Касса и банк (100–102)</small><b>${acTL(ms.bank)}</b></div><div class="kpi"><small>Нам должны (120)</small><b class="ac-in">${acTL(ms.rec)}</b></div><div class="kpi"><small>Мы должны (320)</small><b class="ac-out">${acTL(ms.pay)}</b></div>
      <div class="kpi"><small>Налоги к уплате (360–361)</small><b>${acTL(ms.tax)}</b></div></div></div>`:''}
  <div class="ac-2"><div class="panel"><h3>🧾 Налоги и сроки</h3>${tax.map(x=>`<label class="ac-tax${ACCT.paid[x.id]?' paid':x.d<isoToday()?' late':x.d<=isoAdd(isoToday(),7)?' soon':''}"><input type="checkbox" data-acpaid="${esc(x.id)}"${ACCT.paid[x.id]?' checked':''}><span class="num">${isoDM(x.d)}</span><span>${esc(x.t)}${x.hasK?` <span class="hint">· по загруженным фатурам ${x.est>=0?'к уплате ≈ '+acTL(x.est):'KDV к переносу (devreden) ≈ '+acTL(-x.est)}</span>`:''}</span></label>`).join('')}
      <p class="hint">Сроки по общему правилу (KDV — 28-е, Muhtasar/SGK и Damga — 26-е, выходные переносят на понедельник). Праздники и продления — сверяйте с бухгалтером. Галочка — «оплачено».</p></div>
    <div class="panel"><h3>🤝 Долги</h3>${debts?(()=>{const R=debts.L.filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]),P=debts.L.filter(x=>x[1]<0).sort((a,b)=>a[1]-b[1]);
        return `<p class="hint">${esc(debts.src)} · ${new Date(debts.at).toLocaleDateString('ru-RU')}</p><div class="ac-r"><b>Нам должны</b><b class="ac-in">${acTL(R.reduce((a,x)=>a+x[1],0))}</b></div>${R.slice(0,8).map(x=>`<div class="ac-r"><span>${esc(x[0])}</span><span class="ac-in">${acTL(x[1])}</span></div>`).join('')}
          <div class="ac-r" style="margin-top:8px"><b>Мы должны</b><b class="ac-out">${acTL(-P.reduce((a,x)=>a+x[1],0))}</b></div>${P.slice(0,8).map(x=>`<div class="ac-r"><span>${esc(x[0])}</span><span class="ac-out">${acTL(-x[1])}</span></div>`).join('')}`})()
      :'<p class="hint">Загрузите «cari bakiye listesi» или мизан — здесь будет, кто нам должен и кому должны мы.</p>'}</div></div>
  <div class="panel"><h3>🏛 Льготы и господдержка <span class="hint">проверено ${isoDM(PERKS_AT)}.${PERKS_AT.slice(0,4)} · обновляется раз в неделю</span></h3>
    ${[['yes','✅ Нам подходит'],['check','❔ Может подойти — уточнить'],['no','⛔ Не для агентства']].map(([f,l])=>{const L=PERKS.filter(p=>p.fit===f);return L.length?`<h4>${l}</h4>${L.map(p=>`<details class="ac-perk ${f}"><summary><b>${esc(p.t)}</b>${f!=='no'?` <label class="ac-use" onclick="event.stopPropagation()"><input type="checkbox" data-acuse="${esc(p.id)}"${ACCT.use[p.id]?' checked':''}> используем</label>`:''}</summary><p>${esc(p.d)}</p><p><b>Что сделать:</b> ${esc(p.do)}</p><a href="${esc(p.src)}" target="_blank" rel="noopener">источник</a></details>`).join('')}`:''}).join('')}
    <p class="hint">Это обзор открытых источников, не консультация. Перед тем как применять льготу — согласуйте с бухгалтером / YMM.</p></div>
  ${ACCT.files.length?`<details class="panel"><summary>Загруженные файлы (${ACCT.files.length}) · операций всего ${ACCT.tx.length}</summary>${ACCT.files.slice().reverse().map(f=>`<div class="ac-r"><span>${esc(f.n)} <span class="hint">${f.kind==='tx'?`${f.rows} оп. ${f.from?isoDM(f.from)+'–'+isoDM(f.to)+'.'+f.to.slice(0,4):''}`:f.kind==='mizan'?'мизан':'остатки'} · ${new Date(f.at).toLocaleDateString('ru-RU')}</span></span><button type="button" class="x" data-acdel="${esc(f.id)}" aria-label="Удалить">✕</button></div>`).join('')}</details>`:''}`;
  $('#acFile').onchange=e=>{const fs=[...e.target.files];e.target.value='';if(fs.length)acctImport(fs)};
  el.querySelectorAll('[data-acy]').forEach(b=>b.onclick=()=>{acY=+b.dataset.acy;renderAcct()});
  el.querySelectorAll('[data-acpaid]').forEach(c=>c.onchange=()=>{if(c.checked)ACCT.paid[c.dataset.acpaid]=new Date().toISOString().slice(0,10);else delete ACCT.paid[c.dataset.acpaid];acPut();renderAcct()});
  el.querySelectorAll('[data-acuse]').forEach(c=>c.onchange=()=>{if(c.checked)ACCT.use[c.dataset.acuse]=true;else delete ACCT.use[c.dataset.acuse];acPut()});
  el.querySelectorAll('[data-acdel]').forEach(b=>b.onclick=()=>{const f=ACCT.files.find(x=>x.id===b.dataset.acdel);if(!f||!confirm(`Удалить «${f.n}» и его строки из бухгалтерии?`))return;
    ACCT.tx=ACCT.tx.filter(t=>t[5]!==f.id);if(f.kind==='mizan'&&ACCT.mizan&&ACCT.mizan.n===f.n)ACCT.mizan=null;if(f.kind==='cari'&&ACCT.cari&&ACCT.cari.n===f.n)ACCT.cari=null;ACCT.files=ACCT.files.filter(x=>x!==f);acPut();renderAcct()})}
function acBindImp(el){el.querySelectorAll('[data-ackind]').forEach(s=>s.onchange=()=>{const P=AC_IMP[+s.dataset.ackind];P.kind=s.value;if(P.kind==='tx'&&!P.dir)P.dir=acGuessDir(P.file,P.h.map);renderAcct()});
  el.querySelectorAll('[data-acmap]').forEach(s=>s.onchange=()=>{const [pi,f]=s.dataset.acmap.split('|');const m=AC_IMP[+pi].h.map;if(s.value==='')delete m[f];else m[f]=+s.value;renderAcct()});
  el.querySelectorAll('[data-acdir]').forEach(s=>s.onchange=()=>{AC_IMP[+s.dataset.acdir].dir=s.value;renderAcct()});
  el.querySelector('[data-acsave]').onclick=acSaveImp;el.querySelector('[data-accancel]').onclick=()=>{AC_IMP=null;renderAcct()}}
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('.tab');if(b&&b.dataset.t==='acct'){renderAcct();if(!acLoaded)loadAcct()}});
