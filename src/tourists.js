// Tourist lists (GENEL GELİŞ / ARAÇ TRANSFER LİSTESİ) as Excel, including PDF→Excel conversions.
// The sheet is read as one text stream, so it does not matter how the converter split cells and rows.
const T_STOP=new Set(['GRUB','İND','IND','ARA','NO','TER','ICHAT','BUS','MİN','MİNİ','MİDİ','VİTO','DBL','SNG','TRP','TPL','QUAD','QDR','STD','SUP','DLX','FAM','ECO','ROOM','HB','BB','FB','AI','UAI','RO','NOT','GELİŞ','GİDİŞ','DÖNÜŞ','TRANSFER','LİSTESİ','LISTESI','ARAÇ','ARAC','EXTRA','TICKET','YOK','KENDİ','GİDER','HAVALİMANI','HAVAALANI','OTELE','DIŞ','İÇ','HATLAR']);
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
      guide=gw.join(' ')}
    const term=/\bICHAT\b/.test(head)?'İÇ':/\bTER\b/.test(head)?'DIŞ':'';
    const opm=seg.slice(0,400).match(/\b([A-Z]{3,6}\d{2}|AIR|SKY|BINALI|SIBIR|URAN|KAP|MERID|SARAB)\s+NOT\b/);
    const g={type:h.type,time:h.time,from:h.from,to:h.to,fl:fm&&!/^[!?]/.test(fm[1])?fm[1].replace(/^([A-Z0-9]{2})\s?0*(\d+)$/,'$1 $2'):'',fFrom:fm?fm[2]:'',fTo:fm?fm[3]:'',hotel:normHotel(hotel),hotelRaw:hotel.trim(),pax,veh:isArac?vehAt(h.start):(vm?(vm[1]+(vm[2]?' '+vm[2]:'')):''),guide,term,op:opm?opm[1]:'',people:[]};
    g.dir=g.fTo==='AYT'?'arr':g.fFrom==='AYT'?'dep':h.type==='ARA'?'h2h':'arr';
    // people
    const pr=/(\d{1,3})-\s+(Mr|Mrs|Ms|Miss|Chd|Inf)\s*\.?\s+/g;const anchors=[];let p;
    while((p=pr.exec(seg)))anchors.push({start:p.index,end:pr.lastIndex,title:p[2]});
    anchors.forEach((a,j)=>{
      const toks=seg.slice(a.end,j+1<anchors.length?anchors[j+1].start:seg.length).trim().split(' ');
      const name=[];let k=0;
      while(k<toks.length&&T_CAPS.test(toks[k])&&!T_STOP.has(toks[k])){name.push(toks[k]);k++}
      let age='';if(/^\d{1,2}$/.test(toks[k]||'')){age=toks[k];k++}
      // a long name wraps to the next line in the PDF: its tail shows up after the room/board columns
      const tail=toks.slice(k);let sawRoom=false;
      for(const t of tail){if(T_STOP.has(t)||/\d/.test(t)){sawRoom=true;continue}if(T_CAPS.test(t)&&t.length>2){name.push(t)}else if(sawRoom&&!T_CAPS.test(t))break}
      if(name.length)g.people.push([a.title==='Ms'||a.title==='Miss'?'Mrs':a.title,name.join(' '),age]);
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
    if(!t.people.length||t.dir==='h2h'||!t.fl)return;
    const pool=pools[t.dir]||[];
    let cands=pool.filter(g=>!used.has(g.id)&&key(g.fl,g.h)===key(t.fl,t.hotel));
    if(!cands.length)cands=pool.filter(g=>!used.has(g.id)&&key(g.fl,'')===key(t.fl,'')&&(+g.pax===t.people.length||+g.pax===t.pax));
    if(!cands.length){unmatched.push(t);return}
    const g=cands.find(c=>+c.pax===t.pax)||cands.find(c=>+c.pax===t.people.length)||cands[0];
    used.add(g.id);g.p=t.people;matched++;people+=t.people.length;
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
  const h2h=parsed.groups.filter(t=>t.dir==='h2h').reduce((s,t)=>s+t.people.length,0);
  return {matched,people,unmatched,h2h,changed,added};
}
if(typeof module!=='undefined')module.exports={parseTourists,applyTourists};
