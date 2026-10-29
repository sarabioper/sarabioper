// Tourist lists (GENEL GELİŞ / ARAÇ TRANSFER LİSTESİ) as Excel, including PDF→Excel conversions.
// The sheet is read as one text stream, so it does not matter how the converter split cells and rows.
const T_STOP=new Set(['AL','TWN','TOPLAM','PAX','SAYFA','GRUB','İND','IND','ARA','NO','TER','ICHAT','BUS','MİN','MİNİ','MİDİ','VİTO','DBL','SNG','TRP','TPL','QUAD','QDR','STD','SUP','DLX','FAM','ECO','ROOM','HB','BB','FB','AI','UAI','RO','NOT','GELİŞ','GİDİŞ','DÖNÜŞ','TRANSFER','LİSTESİ','LISTESI','ARAÇ','ARAC','EXTRA','TICKET','YOK','KENDİ','GİDER','HAVALİMANI','HAVAALANI','OTELE','DIŞ','İÇ','HATLAR']);
const T_NOTEW=new Set(['GRUBU','GRUP','ERKEN','GEÇ','GİRİŞ','ÇIKIŞ','BEBEK','YATAĞI','İSTEK','KONFERANS','HONEYMOON','BALAYI','DOĞUM','GÜNÜ','VIP','ODA','DENİZ','MANZARA','KAT','YAN','AYNI','ÖZEL','ÜCRETLİ','ÖDEME','KAPIDA','TEKERLEKLİ','SANDALYE','ENGELLİ','BEDAVA','FREE','EXTRA','LATE','EARLY','CHECK','IN','OUT','REQUEST','BABY','COT','SEA','VIEW']);
const T_CAPS=/^[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ'\-]*$/;
function parseTourists(rows){
  const parts=[];
  rows.forEach(r=>{(r||[]).forEach(c=>{if(c==null||c==='')return;String(c).split('\n').forEach(p=>{p=p.trim();if(p)parts.push(p)})})});
  const S=' '+parts.join(' ').replace(/\s+/g,' ')+' ';
  const dm=S.replace(/Bas\S*m Tarihi\s*:\s*\d\d\/\d\d\/\d{4}/g,' ').match(/\b(\d\d)\/(\d\d)\/(\d{4})\b/)||S.match(/\b(\d\d)\/(\d\d)\/(\d\d)\b/);
  const date=dm?{d:dm[1],m:dm[2],y:dm[3].length===2?'20'+dm[3]:dm[3]}:null;
  const hdr=/(\d{1,4})-\s+(\d\d\/\d\d\/\d\d)\s+(GRUB|İND|IND|ARA|NO)\s+(?:(\d\d:\d\d)\s+)?([A-Z?]{1,3})\s*=>\s*([A-Z?]{1,3})\s*/g;
  const heads=[];let m;
  while((m=hdr.exec(S)))heads.push({start:m.index,end:hdr.lastIndex,type:m[3],time:m[4]||'',from:m[5],to:m[6]});
  const isArac=/ARAÇ\s+TRANSFER\s+L[İI]STES[İI]/.test(S);
  // the list's own title says the direction ("GELİŞ … TRANSFER LİSTESİ" = arrivals), even when a route is typed backwards
  const listDir=/GEL[İI][ŞS]\s+(?:ARAÇ\s+)?TRANSFER/.test(S)?'arr':/(D[ÖO]N[ÜU][ŞS]|G[İI]D[İI][ŞS])\s+(?:ARAÇ\s+)?TRANSFER/.test(S)?'dep':'';
  const marks=[];const mk=/(BUS\s?\d+|MİNİ\s?\d+|MİN\s?\d+|MİDİ\s?\d+|VİTO\s?\d*)\s+(?=Bas\S*m Tarihi|GEL[İI]Ş|G[İI]D[İI]Ş|D[ÖO]N[ÜU]Ş)/g;
  if(isArac)while((m=mk.exec(S)))marks.push({pos:m.index,v:m[1].replace(/\s+/g,' ').replace(/^(BUS|MİNİ|MİN|MİDİ)(\d)/,'$1 $2').trim()});
  const vehAt=pos=>{let v='';for(const x of marks){if(x.pos<pos)v=x.v;else break}return v};
  const totals={};if(isArac){const tr=/TOPLAM PAX\s*:\s*(\d+)/g;let t;while((t=tr.exec(S))){const v=vehAt(t.index);if(v)totals[v]=+t[1]}}
  const groups=[];
  heads.forEach((h,i)=>{
    const seg=S.slice(h.end,i+1<heads.length?heads[i+1].start:S.length);
    const head=seg.slice(0,220);
    const fm=head.match(/((?:[A-Z]{3}|[A-Z][A-Z0-9]|[0-9][A-Z])\s?\d{1,5}|\?{2,}|!{2,})\s*\(([A-ZİÇ?]*)-([A-ZİÇ?]*)\)\s*=>\s*/);
    let hotelTxt;
    if(fm)hotelTxt=head.slice(head.indexOf(fm[0])+fm[0].length);
    else hotelTxt=head.replace(/=>/,' ');
    const pm=hotelTxt.match(/^(.*?)\s*(\d{1,3})\s+(?=<|[A-ZÇĞİÖŞÜ]{3}|BUS|MİN|VİTO|MİDİ|\d)/);
    const hotel=pm?pm[1]:hotelTxt.split(/\s\d/)[0];
    const pax=pm?+pm[2]:0;
    const vm=head.match(/\b(BUS|MİNİ|MİN|MİDİ|VİTO)\b\s*(\d*)/);
    // guide: capital words after the passenger count (skipping the vehicle), until terminal or a number
    let guide='';{const after=pm?hotelTxt.slice(pm[0].length):'';const tk=after.replace(/<[^>]*>/g,' ').split(' ').filter(Boolean);const gw=[];
      for(let k=0;k<tk.length;k++){const t=tk[k];if(/^(BUS|MİNİ|MİN|MİDİ)$/.test(t)&&/^\d+$/.test(tk[k+1]||'')){k++;continue}if(t==='VİTO')continue;if(/^(TER|ICHAT|NOT)$/.test(t)||/\d/.test(t)){if(gw.length)break;continue}if(T_CAPS.test(t.replace(/\.$/,''))&&!T_STOP.has(t))gw.push(t);else if(gw.length)break}
      // words of a hotel name wrapped onto the next line ("CASA FORA BEACH / RESORT") are not a guide
      const HW=/^(BEACH|RESORT|HOTEL|OTEL|SPA|&|CLUB|THERMAL|PALACE|SUITE|SUITES|DELUXE|PREMIUM|RIVER|SIDE|LAKE|PORT)$/;
      guide=/<\s*Araç Yok\s*>/i.test(head)&&!vm?'':gw.filter(w=>!HW.test(w)).length?gw.join(' '):''}
    const term=/\bICHAT\b/.test(head)?'İÇ':/\bTER\b/.test(head)?'DIŞ':'';
    const opm=seg.slice(0,400).match(/\b([A-Z]{3,6}\d{2}|AIR|SKY|BINALI|SIBIR|URAN|KAP|MERID|SARAB)\s+NOT\b/);
    const g={type:h.type,time:h.time,from:h.from,to:h.to,fl:fm&&!/^[!?]/.test(fm[1])?fm[1].replace(/^([A-Z0-9]{2})\s?0*(\d+)$/,'$1 $2'):'',fFrom:fm?fm[2]:'',fTo:fm?fm[3]:'',hotel:normHotel(hotel),hotelRaw:hotel.trim(),pax,veh:isArac?vehAt(h.start):(vm?(vm[1]+(vm[2]?' '+vm[2]:'')):''),guide,term,op:opm?opm[1]:'',people:[]};
    g.dir=h.type==='ARA'&&!g.fl?'h2h':listDir||(g.fTo==='AYT'?'arr':g.fFrom==='AYT'?'dep':h.type==='ARA'?'h2h':'arr');
    if(listDir==='arr'&&g.fFrom==='AYT'){g.routeFlip=g.fFrom+'-'+g.fTo;g.fFrom=g.fTo;g.fTo='AYT'}
    // people
    const pr=/(\d{1,3})-\s*(Mr|Mrs|Ms|Miss|Chd|Inf)\s*(?:\.\s*|\s+)(?:\?\s+)?(?=[A-ZÇĞİÖŞÜ?])/g;const anchors=[];let p;
    while((p=pr.exec(seg)))anchors.push({start:p.index,end:pr.lastIndex,title:p[2]});
    let room=null,roomNo=0;
    anchors.forEach((a,j)=>{
      const before=seg.slice(j?anchors[j-1].end:0,a.start);
      const vm2=before.match(/(?:^|\s)(\d{4})\s*$/);
      const toks=seg.slice(a.end,j+1<anchors.length?anchors[j+1].start:seg.length).trim().split(' ').filter(Boolean);
      const name=[];let k=0;
      while(k<toks.length&&T_CAPS.test(toks[k])&&!T_STOP.has(toks[k])){name.push(toks[k]);k++}
      let age='';if(/^\d{1,2}$/.test(toks[k]||'')){age=toks[k];k++}
      // name wrapped right after the age (no room columns on this line)
      while(k<toks.length&&T_CAPS.test(toks[k])&&!T_STOP.has(toks[k])&&!/[ÇĞİÖŞÜ]/.test(toks[k])&&name.length<4){name.push(toks[k]);k++}
      // room columns: stay dates, room type, category, board, then a free-text note
      const rest=toks.slice(k).join(' ');
      const dm=rest.match(/(\d\d)\/(\d\d)\/\d\d\s*~\s*(\d\d)\/(\d\d)\/\d\d/);
      const rt=rest.match(/\b(SNG|DBL|TRP|TPL|QUAD|QDR|TWN|FAM)\b/);
      const cat=rest.match(/\b(STD|SUP|DLX|ECO|FAM|SUITE|PROMO)\b/);
      const bd=rest.match(/\b(UAI|AI|HB|BB|FB|RO|AL)\b/);
      if(dm||rt){roomNo++;room={no:roomNo,stay:dm?`${dm[1]}.${dm[2]}–${dm[3]}.${dm[4]}`:'',type:[rt&&rt[1],cat&&cat[1]].filter(Boolean).join(' '),board:bd?bd[1]:'',voucher:vm2?vm2[1]:''}}
      // words after the board column: a wrapped surname/first name, or the operator's note
      let tailStart=0;const tt=toks.slice(k);
      tt.forEach((t,i)=>{if(T_STOP.has(t)||/\d/.test(t)||t==='~')tailStart=i+1});
      const words=tt.slice(tailStart).filter(t=>/^[A-ZÇĞİÖŞÜ0-9'.,\/+\-]+$/.test(t));
      let note='';
      if(words.length){
        const isNote=words.length>2||words.some(w=>/[ÇĞİÖŞÜ]/.test(w))||words.some(w=>T_NOTEW.has(w));
        if(isNote&&!(name.length===1&&words.length<=2&&!words.some(w=>T_NOTEW.has(w))))note=words.join(' ');else name.push(...words.filter(w=>T_CAPS.test(w)&&w.length>1));
      }
      if(name.length)g.people.push([a.title==='Ms'||a.title==='Miss'?'Mrs':a.title,name.join(' '),age,room?{room:room.no,type:room.type,board:room.board,stay:room.stay,voucher:room.voucher,note}:(note?{note}:undefined)].filter((x,i)=>i<3||x));
    });
    groups.push(g);
  });
  return {date,groups,isArac,totals,vehicles:[...new Set(marks.map(x=>x.v))]};
}
// Attach names to the day's groups: same flight + same hotel; several groups -> by passenger count.
function applyTourists(day,parsed){
  const key=(fl,h)=>String(fl).replace(/\s+/g,'').replace(/^([A-Z0-9]{2})0*/,'$1')+'|'+h;
  const used=new Set();let matched=0,people=0;const unmatched=[];const changed=[];
  const pools={arr:day.arr,dep:day.dep};
  parsed.groups.forEach(t=>{
    if(!t.people.length)return;
    // hotel-to-hotel (ARA) groups: names go onto the matching transfer, same destination and passenger count
    if(t.dir==='h2h'){const L=(day.h2hList||[]).filter(x=>!used.has(x.id)&&x.h===t.hotel);
      const x=L.find(x=>+x.pax===t.pax&&(!t.from||!x.from||normHotel(x.from)===normHotel(t.from)))||L.find(x=>+x.pax===t.pax)||L.find(x=>+x.pax===t.people.length);
      if(!x){unmatched.push(t);return}used.add(x.id);x.p=t.people;matched++;people+=t.people.length;return}
    // a group whose flight is not known yet ("????") goes onto the KAPAK line with no flight, same hotel and count
    if(!t.fl){const x=(pools[t.dir]||[]).find(g=>!used.has(g.id)&&/^[!?]/.test(g.fl||'?')&&g.h===t.hotel&&(+g.pax===t.pax||+g.pax===t.people.length));
      if(!x){unmatched.push(t);return}used.add(x.id);x.p=t.people;matched++;people+=t.people.length;return}
    const pool=pools[t.dir]||[];
    let cands=pool.filter(g=>!used.has(g.id)&&key(g.fl,g.h)===key(t.fl,t.hotel));
    if(!cands.length)cands=pool.filter(g=>!used.has(g.id)&&key(g.fl,'')===key(t.fl,'')&&(+g.pax===t.people.length||+g.pax===t.pax));
    if(!cands.length){unmatched.push(t);return}
    const g=cands.find(c=>+c.pax===t.pax)||cands.find(c=>+c.pax===t.people.length)||cands[0];
    used.add(g.id);
    // two lists for the same group (Araç + Genel): keep ages from one and vouchers/rooms from the other
    if(g.p&&g.p.length===t.people.length)g.p=t.people.map((p,i)=>{const o=g.p[i]||[];const ex=Object.assign({},o[3]||{},...Object.entries(p[3]||{}).filter(([,v])=>v!==''&&v!=null).map(([k,v])=>({[k]:v})));return [p[0],p[1],p[2]||o[2]||'',...(Object.keys(ex).length?[ex]:[])]});
    else g.p=t.people;
    matched++;people+=t.people.length;
    if(parsed.isArac){if(t.veh&&g.v!==t.veh){changed.push(`${g.fl} ${g.h}: ${g.v||'—'} → ${t.veh}`);g.v=t.veh}if(t.guide)g.g=t.guide;if(t.term&&!g.term)g.term=t.term;if(t.op&&(!g.op||g.op==='—'))g.op=t.op}
  });
  // vehicle list: transfers missing from KAPAK are added, so the vehicle plan is complete
  let added=0;
  if(parsed.isArac)unmatched.slice().forEach(t=>{if(!t.fl||t.dir!=='arr'&&t.dir!=='dep')return;
    const id=(day.key||'')+'v'+(day.arr.length+day.dep.length+added);
    const g=t.dir==='arr'?{id,t:t.time,fl:t.fl,org:t.fFrom.replace(/\?/g,''),to:t.fTo||'AYT',h:t.hotel,v:t.veh,g:t.guide,op:t.op||'—',term:t.term,p:t.people,pax:t.pax||t.people.length,note:'добавлено из Araç Listesi'}
      :{id,fl:t.fl,dest:t.fTo.replace(/\?/g,''),t:t.time,h:t.hotel,pax:t.pax||t.people.length,pu:'',g:t.guide,v:t.veh,term:t.term,op:t.op||'—',note:'добавлено из Araç Listesi',p:t.people};
    (t.dir==='arr'?day.arr:day.dep).push(g);added++;people+=t.people.length;unmatched.splice(unmatched.indexOf(t),1)});
  // departures in KAPAK often carry only the first name ("BAİRAM"): use the full name when it is unique
  if(parsed.isArac){const full=[...new Set(day.arr.map(g=>g.g).filter(n=>/\s/.test(n||'')))];
    day.dep.forEach(r=>{if(!r.g||/\s/.test(r.g))return;const k=r.g.normalize('NFD').replace(/[\u0300-\u036f]/g,'');const c=full.filter(f=>f.split(' ')[0].normalize('NFD').replace(/[\u0300-\u036f]/g,'')===k);if(c.length===1)r.g=c[0]});
    day.aracTotals=parsed.totals;day.aracVehicles=parsed.vehicles;}
  const h2h=unmatched.filter(t=>t.dir==='h2h').reduce((s,t)=>s+t.people.length,0);
  return {matched,people,unmatched,h2h,changed,added};
}

// ---- departure notices put up in hotels ("ИНФОРМАЦИЯ О ВЫЕЗДЕ": one group per page, pickup time, flight, passengers)
const NOTICE_HDR=/ИНФОРМАЦИЯ\s+О\s+ВЫЕЗДЕ|DEPARTURE\s+INFORMATION|D[ÖO]N[ÜU][ŞS]\s+B[İI]LG[İI]|TRANSFER\s+INFORMATION|ИНФОРМАЦИЯ\s+ОБ?\s+ОТЪЕЗДЕ/i;
const CITY_CODE={MOSKVA:'MOW',MOSCOW:'MOW',MOSKOVA:'MOW',NOVOSIBIRSK:'OVB',KRASNODAR:'KRR',YEKATERINBURG:'SVX',EKATERINBURG:'SVX',KAZAN:'KZN',SOCHI:'AER',SOCI:'AER',UFA:'UFA',SAMARA:'KUF',ALMATY:'ALA',ALMATI:'ALA',ASTANA:'NQZ',BISHKEK:'FRU',BISKEK:'FRU',TASHKENT:'TAS',ISTANBUL:'IST',ANKARA:'ESB',PETERBURG:'LED',PETERSBURG:'LED',MINERALNYE:'MRV',KALININGRAD:'KGD',CHELYABINSK:'CEK',ORENBURG:'REN',PERM:'PEE',SURGUT:'SGC',TYUMEN:'TJM',OMSK:'OMS',KRASNOYARSK:'KJA',IRKUTSK:'IKT',BAKU:'GYD',BAKI:'GYD',TBILISI:'TBS',VOLGOGRAD:'VOG',ROSTOV:'ROV',SHYMKENT:'CIT',KARAGANDA:'KGF',AKTOBE:'AKX',ATYRAU:'GUW'};
const cityCode=s=>{const u=String(s||'').toUpperCase().replace(/İ/g,'I').replace(/Ş/g,'S').replace(/Ç/g,'C').replace(/Ü/g,'U').replace(/Ö/g,'O').replace(/Ğ/g,'G');for(const [k,v] of Object.entries(CITY_CODE))if(u.includes(k))return v;return ''};
function isDepNotice(rows){return rows.slice(0,40).some(r=>NOTICE_HDR.test((r||[]).join(' ')))}
function parseDepNotice(rows){
  const lines=rows.map(r=>(r||[]).filter(c=>c!=null&&c!=='').join('  ').replace(/\s+/g,' ').trim()).filter(Boolean);
  const groups=[];let g=null,date=null;
  const val=(l,re)=>{const m=l.match(re);return m?l.slice(m.index+m[0].length).replace(/^[\s:]+/,'').replace(/^:\s*/,'').trim():null};
  lines.forEach((l,i)=>{
    if(NOTICE_HDR.test(l)){g={dir:'dep',op:'',fl:'',t:'',hotel:'',hotelRaw:'',pu:'',meet:'',dest:'',destName:'',people:[],pax:0};groups.push(g);
      const prev=lines[i-1]||'';if(prev&&!/:/.test(prev)&&prev.length<40&&!/^\d+\s*[-.)]/.test(prev))g.op=prev;return}
    if(!g)return;let v;
    if((v=val(l,/В\s+АЭРОПОРТ\s+ГОРОДА|TO\s+(?:AIRPORT|CITY)|VARI[ŞS]\s+(?:HAVAL[İI]MANI|[ŞS]EHR[İI])/i))!==null){g.destName=v;g.dest=cityCode(v);return}
    if(/ИЗ\s+АЭРОПОРТА\s+ГОРОДА|FROM\s+AIRPORT|KALKI[ŞS]\s+HAVAL/i.test(l))return;
    if((v=val(l,/дата\s+полета|FLIGHT\s+DATE|U[ÇC]U[ŞS]\s+TAR[İI]H[İI]/i))!==null){const m=v.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);if(m)date=date||{d:m[1].padStart(2,'0'),m:m[2].padStart(2,'0'),y:m[3]};return}
    if((v=val(l,/НОМЕР\s+РЕЙСА|FLIGHT\s+(?:NO|NUMBER)\.?|U[ÇC]U[ŞS]\s+(?:NO|NUMARASI)/i))!==null){const m=v.toUpperCase().match(/\b([A-Z0-9]{2})\s?0*(\d{1,4})\b/);g.fl=m&&!/^[!?]/.test(v)?m[1]+' '+m[2]:'';return}
    if((v=val(l,/ВРЕМЯ\s+ВЫЛЕТА|DEPARTURE\s+TIME|KALKI[ŞS]\s+SAAT[İI]/i))!==null){const m=v.match(/\d{1,2}:\d\d/);g.t=m?m[0].padStart(5,'0'):'';return}
    if(/ВРЕМЯ\s+ПРИБЫТИЯ|ARRIVAL\s+TIME|VARI[ŞS]\s+SAAT/i.test(l))return;
    if((v=val(l,/ВРЕМЯ\s+ВЫЕЗДА\s+ИЗ\s+ГОСТИНИЦЫ|PICK[\s-]?UP\s+TIME|OTELDEN\s+[ÇC]IKI[ŞS]|ALI[ŞS]\s+SAAT[İI]/i))!==null){const m=v.match(/\d{1,2}:\d\d/);g.pu=m?m[0].padStart(5,'0'):'';return}
    if((v=val(l,/НАЗВАНИЕ\s+ОТЕЛЯ|HOTEL\s+NAME|OTEL\s+ADI/i))!==null){g.hotelRaw=v;g.hotel=normHotel(v);return}
    if((v=val(l,/^ГОСТИНИЦА|MEETING\s+POINT|BULU[ŞS]MA\s+YER[İI]/i))!==null){g.meet=v.replace(/^[:\s]+/,'');return}
    const pm=l.match(/^\d{1,3}\s*[-.)]\s*(MRS|MR|MS|MISS|CHD|INF|CHILD)\.?\s+(.+?)(?:\s+(\d{1,3}))?$/i);
    if(pm){const t=pm[1][0].toUpperCase()+pm[1].slice(1).toLowerCase();g.people.push([t==='Child'?'Chd':t,pm[2].trim().toUpperCase(),pm[3]||'',g.meet?{note:g.meet}:{}]);g.pax=g.people.filter(p=>p[0]!=='Inf').length}
  });
  return {date,groups:groups.filter(x=>x.people.length),isNotice:true};
}
const hk=s=>String(s||'').toUpperCase().replace(/[^A-Z]/g,'').replace(/(HOTEL|OTEL|RESORT|SPA|BEACH|THE)/g,'');
function applyDepNotices(day,N){
  let matched=0,added=0,people=0;const used=new Set();const out=[];
  N.groups.forEach(g=>{
    const sameHotel=r=>{const a=hk(r.h),b=hk(g.hotelRaw||g.hotel);return a&&b&&(a.includes(b)||b.includes(a))};
    let c=day.dep.filter(r=>!used.has(r.id)&&(g.fl?normFlT(r.fl)===normFlT(g.fl):/^[!?]/.test(r.fl||'?'))&&sameHotel(r));
    if(!c.length&&g.fl)c=day.dep.filter(r=>!used.has(r.id)&&normFlT(r.fl)===normFlT(g.fl)&&(+r.pax===g.pax));
    const r=c.find(x=>+x.pax===g.pax)||c[0];
    if(r){used.add(r.id);r.p=g.people;if(!r.pu&&g.pu)r.pu=g.pu;if(g.meet)r.meet=g.meet;matched++;people+=g.people.length;out.push({g,r,st:'ok'});return}
    const id=(day.key||'')+'n'+(day.dep.length+added);
    day.dep.push({id,fl:g.fl||'???',dest:g.dest,t:g.t,h:g.hotelRaw||g.hotel,pax:g.pax,pu:g.pu,g:'',v:'',term:'',op:g.op||'—',note:'лист выезда'+(g.meet?' · '+g.meet:''),meet:g.meet,p:g.people});
    added++;people+=g.people.length;out.push({g,st:'new'});
  });
  return {matched,added,people,out};
}
const normFlT=f=>String(f||'').toUpperCase().replace(/\s+/g,'').replace(/^([A-Z0-9]{2})0*/,'$1');
if(typeof module!=='undefined')module.exports={parseTourists,applyTourists};
