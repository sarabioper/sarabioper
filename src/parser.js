// Parser for "Transfer Takip Formu" (KAPAK) as Excel, including PDF→Excel conversions
// where records are glued into cells and departure/arrival columns are interleaved.
function parseKapak(rows){
  const OPS=/^(?:[A-Z]{3,6}\d{2}|AIR|SKY|SARAB|BINALI|SIBIR|URAN|KAP|MERID|MERİD)$/;
  const VEH=/^(BUS|MİNİ|MİN|MINI|MIN)$/;
  const STOP=new Set(['GRUB','İND','IND','NO','ARA','TER','ICHAT','TOPLAM','PAX']);
  const totals={};const dayTotals=[];
  const normFl=s=>s.replace(/^([A-Z0-9]{2})\s?0*(\d+)$/,'$1 $2');
  const anchorRe=/((?:[A-Z]{3}|[A-Z][A-Z0-9]|[0-9][A-Z])\s?\d{1,5}|!{2,}|\?{2,})\s*\(([A-ZİÇ?]*)-([A-ZİÇ?]*)\)/g;

  function tokenizeBody(body){
    const toks=body.split(/[\s¦]+/).filter(Boolean);
    const b={time:'',type:'',hotel:'',pax:[],pu:[],g:[],v:[],term:[],op:[],note:[]};
    let stage='start',pending=[];
    for(let k=0;k<toks.length;k++){
      const t=toks[k];
      if(/^\d\d:\d\d$/.test(t)){if(!b.time&&stage==='start')b.time=t;else b.pu.push(t);if(stage==='hotel')stage='names';continue}
      if(!b.type&&/^(GRUB|İND|IND|NO|ARA)$/.test(t)){b.type=t;stage='hotel';continue}
      if(VEH.test(t)&&/^\d+$/.test(toks[k+1]||'')){b.v.push(t.replace('MINI','MİNİ').replace(/^MIN$/,'MİN')+' '+toks[k+1]);k++;b.g.push(pending.length?pending.shift():'');stage='after';continue}
      if(t==='VİTO'||t==='VITO'){b.v.push('VİTO');b.g.push(pending.length?pending.shift():'');stage='after';continue}
      if(t==='TER'&&toks[k+1]==='2'){b.term.push('TER 2');k++;continue}
      if(t==='ICHAT'){b.term.push('ICHAT');continue}
      if(/^\d{1,3}$/.test(t)){b.pax.push(+t);if(stage==='hotel'||stage==='start')stage='names';continue}
      if(OPS.test(t)){b.op.push(t);continue}
      if(stage==='hotel'||(stage==='start'&&b.type)){b.hotel+=(b.hotel?' ':'')+t;continue}
      if(stage==='start'&&!b.type&&!b.time&&/^[A-ZÇĞİÖŞÜ&]+$/.test(t)&&!b.pax.length){b.hotel+=(b.hotel?' ':'')+t;continue}
      if(/^[A-ZÇĞİÖŞÜ.]{3,}$/.test(t)&&!STOP.has(t)&&(stage==='names'||stage==='after')){pending.push(t);continue}
      b.note.push(...pending,t);pending=[];
    }
    b.note.push(...pending);
    return b;
  }

  // 1. rows → strings; collect totals
  const lines=[];
  rows.forEach((row,ri)=>{
    if(!row)return;const frags=[];
    row.forEach(c=>{if(c==null||c==='')return;String(c).split('\n').forEach(p=>{p=p.trim();if(p)frags.push(p)})});
    if(!frags.length)return;
    let S=frags.join(' ¦ ');
    S=S.replace(/(\d\d\/\d\d\/\d{4})\s*Toplam Pax\s*:\s*(\d+)/g,(m,d,n)=>{dayTotals.push(+n);return ' '});
    S=S.replace(/Genel [Tt]oplam \(Pax\):\s*\d+/g,' ');
    S=S.replace(/([A-Z0-9!?]+(?: ?[A-Z0-9]+)?)\s+Toplam Pax\s*:\s*(\d+)/g,(m,k,n)=>{k=normFl(k);(totals[k]=totals[k]||[]).push(+n);return ' '});
    S=S.replace(/Tarih\s*:\s*\d\d\/\d\d\/\d{4}/g,' ').replace(/Operatör.*Not\s*$/,' ');
    lines.push({row:ri+1,S});
  });
  // glue a flight code broken across rows ("… 2S" + "248 (KGD-AYT) …")
  for(let i=0;i+1<lines.length;i++){
    const m=lines[i].S.match(/(?:^|[\s¦])([A-Z][A-Z0-9]|[0-9][A-Z])\s*$/);
    if(m&&/^\s*\d{1,5}\s*\(/.test(lines[i+1].S)){lines[i].S=lines[i].S.slice(0,lines[i].S.length-m[0].length);lines[i+1].S=m[1]+' '+lines[i+1].S.trim()}
  }
  // 2. parse rows
  const recs=[];const orphans=[];
  lines.forEach(({row,S})=>{
    const anchors=[];let m;anchorRe.lastIndex=0;
    while((m=anchorRe.exec(S)))anchors.push({start:m.index,end:anchorRe.lastIndex,fl:normFl(m[1].trim()),raw:m[1].trim(),from:m[2],to:m[3]});
    if(!anchors.length){const b=tokenizeBody(S);if((b.pax.length||b.time)&&(!b.type||b.time))orphans.push({row,b});return}
    const rr=anchors.map((a,i)=>{
      const prev=S.slice(i?anchors[i-1].end:0,a.start);
      const opm=prev.match(/([A-Z]{3,6}\d{2}|AIR|SKY|SARAB|BINALI|SIBIR|URAN|KAP|MERID)[\s¦]*$/);
      const b=tokenizeBody(S.slice(a.end,i+1<anchors.length?anchors[i+1].start:S.length));
      return {row,fl:a.fl,raw:a.raw,from:a.from,to:a.to,op:opm?opm[1]:'',b};
    });
    // drop the op token that belongs to the next record from each body
    rr.forEach((r,i)=>{if(i+1<rr.length&&rr[i+1].op){const j=r.b.op.lastIndexOf(rr[i+1].op);if(j>=0)r.b.op.splice(j,1)}});
    rr.forEach(r=>{r.kind=r.from==='AYT'?'dep':(r.to==='AYT'||r.to==='GZP')?'arr':(r.b.pu.length?'dep':'arr')});
    // prefix operators like "ELDR27 RIXS27 SSS27 ¦ VF 4009 …"
    const prefixOps=(S.slice(0,anchors[0].start).match(/\b([A-Z]{3,6}\d{2}|AIR|SKY|SARAB|BINALI|SIBIR|URAN|KAP|MERID)\b/g)||[]);
    if(prefixOps.length===rr.length&&rr.slice(1).every(r=>!r.op))rr.forEach((r,i)=>r.op=prefixOps[i]);
    // sequential assignment of row items in document order
    const seq=(key,eligible)=>{const items=[];rr.forEach(r=>items.push(...r.b[key]));const el=rr.filter(eligible);el.forEach((r,i)=>r[key]=items[i]??null)};
    seq('pax',()=>true);seq('pu',r=>r.kind==='dep');seq('g',()=>true);seq('v',()=>true);seq('term',()=>true);
    rr.forEach(r=>{if(!r.op&&r.b.op.length)r.op=r.b.op[0];r.time=r.b.time;r.type=r.b.type;r.hotel=r.b.hotel;r.note=r.b.note.join(' ');delete r.b;recs.push(r)});
  });
  // 3. orphan rows fill records that lack pax or a time (document order)
  const needy=recs.filter(r=>!r.pax||(!r.time&&!r.type));
  orphans.forEach(o=>{
    const b=o.b;const r=needy.shift();if(!r)return;
    if(!r.time&&b.time){r.time=b.time;r.type=r.type||b.type;r.hotel=r.hotel||b.hotel}
    if(!r.pax&&b.pax.length)r.pax=b.pax[0];
    if(!r.g&&b.g.length)r.g=b.g[0];
    if(!r.v&&b.v.length)r.v=b.v[0];
    if(!r.term&&b.term.length)r.term=b.term[0];
    if(r.kind==='dep'&&!r.pu&&b.pu.length)r.pu=b.pu[0];
    if(b.note.length)r.note=(r.note+' '+b.note.join(' ')).trim();
    r.fixed=true;
  });
  // 4. siblings on the same flight share vehicle/guide/terminal when one is missing
  recs.forEach(r=>{if(r.v&&r.g&&r.op)return;const s=recs.find(x=>x!==r&&x.fl===r.fl&&x.time===r.time&&x.kind===r.kind&&x.v&&x.g);if(s){r.v=r.v||s.v;r.g=r.g||s.g;r.term=r.term||s.term;r.op=r.op||s.op}});
  // 5. finalize
  recs.forEach(r=>{
    r.hotel=normHotel(r.hotel||'');r.pax=r.pax||0;r.g=r.g||'';r.v=r.v||'';r.term=r.term||'';r.pu=r.pu||'';
    if(/KENDİ GİDER/.test(r.note)&&!r.v)r.kind='self';
    else if(r.type==='ARA'&&!r.time)r.kind='h2h';
    r.unknownFlight=/^[!?]/.test(r.fl);
  });
  const sums={};recs.forEach(r=>{sums[r.fl]=(sums[r.fl]||0)+r.pax});
  const recon=Object.entries(totals).filter(([k])=>/^[A-Z0-9]{2} \d+$/.test(k)).map(([k,v])=>({fl:k,expected:v.reduce((a,b)=>a+b,0),got:sums[k]||0}));
  return {recs,totals,recon,dayTotals};
}
function normHotel(h){
  const u=h.toUpperCase();
  if(/LAKE/.test(u))return 'LRS Lake & River Side';
  if(/PORT RIVER/.test(u))return 'LRS Port River';
  if(/DOĞA|DOGA/.test(u))return 'Beach Club Doğanay';
  if(/CASA/.test(u))return 'Casa Fora Beach Resort';
  if(/SORGUN|AKADIA/.test(u))return 'LRS Sorgun Akadia';
  if(/RAYMAR/.test(u))return 'Raymar Beach';
  if(/ON HOTEL/.test(u))return 'On Hotel Antalya';
  return h.trim()||'—';
}
if(typeof module!=='undefined')module.exports={parseKapak,normHotel};
