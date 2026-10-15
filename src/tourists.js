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
  const groups=[];
  heads.forEach((h,i)=>{
    const seg=S.slice(h.end,i+1<heads.length?heads[i+1].start:S.length);
    const head=seg.slice(0,220);
    const fm=head.match(/((?:[A-Z]{3}|[A-Z][A-Z0-9]|[0-9][A-Z])\s?\d{1,5}|\?{2,}|!{2,})\s*\(([A-ZİÇ?]*)-([A-ZİÇ?]*)\)\s*=>\s*/);
    let hotelTxt;
    if(fm)hotelTxt=head.slice(head.indexOf(fm[0])+fm[0].length);
    else hotelTxt=head.replace(/=>/,' ');
    const pm=hotelTxt.match(/^(.*?)\s*(\d{1,3})\s+(?=<|[A-ZİÇ]{3}|BUS|MİN|VİTO|MİDİ|\d)/);
    const hotel=pm?pm[1]:hotelTxt.split(/\s\d/)[0];
    const pax=pm?+pm[2]:0;
    const vm=head.match(/\b(BUS|MİNİ|MİN|MİDİ|VİTO)\b\s*(\d*)/);
    const g={type:h.type,time:h.time,from:h.from,to:h.to,fl:fm&&!/^[!?]/.test(fm[1])?fm[1].replace(/^([A-Z0-9]{2})\s?0*(\d+)$/,'$1 $2'):'',fFrom:fm?fm[2]:'',fTo:fm?fm[3]:'',hotel:normHotel(hotel),hotelRaw:hotel.trim(),pax,veh:vm?(vm[1]+(vm[2]?' '+vm[2]:'')):'',people:[]};
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
  return {date,groups};
}
// Attach names to the day's groups: same flight + same hotel; several groups -> by passenger count.
function applyTourists(day,parsed){
  const key=(fl,h)=>String(fl).replace(/\s+/g,'').replace(/^([A-Z0-9]{2})0*/,'$1')+'|'+h;
  const used=new Set();let matched=0,people=0;const unmatched=[];
  const pools={arr:day.arr,dep:day.dep};
  parsed.groups.forEach(t=>{
    if(!t.people.length||t.dir==='h2h'||!t.fl)return;
    const pool=pools[t.dir]||[];
    let cands=pool.filter(g=>!used.has(g.id)&&key(g.fl,g.h)===key(t.fl,t.hotel));
    if(!cands.length)cands=pool.filter(g=>!used.has(g.id)&&key(g.fl,'')===key(t.fl,'')&&(+g.pax===t.people.length||+g.pax===t.pax));
    if(!cands.length){unmatched.push(t);return}
    const g=cands.find(c=>+c.pax===t.pax)||cands.find(c=>+c.pax===t.people.length)||cands[0];
    used.add(g.id);g.p=t.people;matched++;people+=t.people.length;
  });
  const h2h=parsed.groups.filter(t=>t.dir==='h2h').reduce((s,t)=>s+t.people.length,0);
  return {matched,people,unmatched,h2h};
}
if(typeof module!=='undefined')module.exports={parseTourists,applyTourists};
