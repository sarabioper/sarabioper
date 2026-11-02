/* ---------- excursion program from a screenshot / photo of the program table ---------- */
// Layout: date | stop | ÇIKIŞ | MAĞAZA GİRİŞ | OTEL REHBERİ | KOK REHBER | MAĞAZA SATIŞ | PAX (one table per bus).
// Runs on the phone: the grid is found from its lines, the lines are erased, each column is read with Turkish OCR.
let tourOcrW=null;
async function tourOcr(){
  if(tourOcrW)return tourOcrW;
  if(!window.Tesseract)await loadScript(OCR_LIB);
  const w=await Tesseract.createWorker('tur',1,Object.assign({},OCR_OPT,{langPath:'https://cdn.jsdelivr.net/npm/@tesseract.js-data/tur@1.0.0/4.0.0_best_int'}));
  await w.setParameters({tessedit_pageseg_mode:'4',preserve_interword_spaces:'1'});
  tourOcrW=w;return w}
const imgFromFile=f=>new Promise((ok,bad)=>{const u=URL.createObjectURL(f);const i=new Image();i.onload=()=>{URL.revokeObjectURL(u);ok(i)};i.onerror=()=>bad(new Error('не открывается картинка'));i.src=u});
function lineRuns(idx){const r=[];idx.forEach(i=>{if(r.length&&i-r[r.length-1][1]<=1)r[r.length-1][1]=i;else r.push([i,i])});return r}
function programGeom(img){
  const k=img.naturalWidth>1400?1300/img.naturalWidth:1;const W=Math.round(img.naturalWidth*k),H=Math.round(img.naturalHeight*k);
  const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0,W,H);
  const d=x.getImageData(0,0,W,H).data;const mx=new Uint8Array(W*H);
  for(let i=0;i<W*H;i++){const r=d[i*4],g=d[i*4+1],b=d[i*4+2];mx[i]=r>g?(r>b?r:b):(g>b?g:b)}
  // ink = black/grey text and grid; yellow, red and white cell backgrounds are not ink
  const ink=i=>mx[i]<120;
  const colFrac=x0=>{let n=0;for(let y=0;y<H;y++)if(ink(y*W+x0))n++;return n/H};
  const vl=lineRuns([...Array(W).keys()].filter(x0=>colFrac(x0)>0.6));
  const cols=[];for(let i=0;i+1<vl.length;i++){const a=vl[i][1]+1,b=vl[i+1][0];if(b-a>8)cols.push([a,b])}
  if(cols.length<7)throw new Error('не нашёл таблицу программы (нужны колонки ÇIKIŞ, MAĞAZA GİRİŞ, REHBER, PAX)');
  const rowFrac=(y,[a,b])=>{let n=0;for(let x0=a;x0<b;x0++)if(ink(y*W+x0))n++;return n/(b-a)};
  const hl=lineRuns([...Array(H).keys()].filter(y=>rowFrac(y,cols[1])>0.7));
  const dl=lineRuns([...Array(H).keys()].filter(y=>rowFrac(y,cols[0])>0.7));
  const blocks=[];for(let i=0;i+1<dl.length;i++){const a=dl[i][1]+1,b=dl[i+1][0];if(b-a>8)blocks.push([a,b])}
  const bands=[];for(let i=0;i+1<hl.length;i++){const a=hl[i][1]+1,b=hl[i+1][0];if(b-a>8)bands.push([a,b])}
  const bh=bands.length?bands.map(b=>b[1]-b[0]).sort((a,b)=>a-b)[bands.length>>1]:20;
  // clean picture: ink black on white, grid and cell borders erased
  const g=new Uint8Array(W*H);for(let i=0;i<W*H;i++)g[i]=mx[i]<150?0:255;
  vl.forEach(([a,b])=>{for(let x0=Math.max(0,a-1);x0<=Math.min(W-1,b+1);x0++)for(let y=0;y<H;y++)g[y*W+x0]=255});
  hl.forEach(([a,b])=>{for(let y=Math.max(0,a-1);y<=Math.min(H-1,b+1);y++)for(let x0=0;x0<W;x0++)g[y*W+x0]=255});
  dl.forEach(([a,b])=>{for(let y=Math.max(0,a-1);y<=Math.min(H-1,b+1);y++)for(let x0=cols[0][0];x0<cols[0][1];x0++)g[y*W+x0]=255});
  const hRun=Math.max(30,bh*2),vRun=Math.max(12,Math.round(bh*0.8));
  for(let y=0;y<H;y++){let s=-1;for(let x0=0;x0<=W;x0++){const on=x0<W&&g[y*W+x0]===0;if(on&&s<0)s=x0;if(!on&&s>=0){if(x0-s>=hRun)for(let k2=s;k2<x0;k2++)g[y*W+k2]=255;s=-1}}}
  for(let x0=0;x0<W;x0++){let s=-1;for(let y=0;y<=H;y++){const on=y<H&&g[y*W+x0]===0;if(on&&s<0)s=y;if(!on&&s>=0){if(y-s>=vRun)for(let k2=s;k2<y;k2++)g[k2*W+x0]=255;s=-1}}}
  const S=3,cc=document.createElement('canvas');cc.width=W;cc.height=H;const cx=cc.getContext('2d');const id=cx.createImageData(W,H);
  for(let i=0;i<W*H;i++){id.data[i*4]=id.data[i*4+1]=id.data[i*4+2]=g[i];id.data[i*4+3]=255}cx.putImageData(id,0,0);
  const big=document.createElement('canvas');big.width=W*S;big.height=H*S;const bx=big.getContext('2d');bx.imageSmoothingEnabled=true;bx.imageSmoothingQuality='high';bx.drawImage(cc,0,0,W*S,H*S);
  // which cells have any writing (so empty time cells are not read at all)
  const inked=(x0,x1,y0,y1)=>{let n=0;for(let y=y0;y<y1;y++)for(let xx=x0;xx<x1;xx++)if(g[y*W+xx]===0&&++n>8)return true;return false};
  // one small cell (a time) cut tight around its writing and enlarged to ~48 px letters: tiny digits on red cells read right
  const cellImg=(x0,x1,y0,y1)=>{let a=1e9,b=-1,c=1e9,e=-1;for(let y=y0;y<y1;y++)for(let xx=x0;xx<x1;xx++)if(g[y*W+xx]===0){if(y<a)a=y;if(y>b)b=y;if(xx<c)c=xx;if(xx>e)e=xx}
    if(b<0)return null;a=Math.max(0,a-2);b=Math.min(H-1,b+2);c=Math.max(0,c-2);e=Math.min(W-1,e+2);
    let lo=255,hi=0;for(let y=a;y<=b;y++)for(let xx=c;xx<=e;xx++){const v=mx[y*W+xx];if(v<lo)lo=v;if(v>hi)hi=v}
    const w0=e-c+1,h0=b-a+1,t=document.createElement('canvas');t.width=w0;t.height=h0;const tx=t.getContext('2d');const im=tx.createImageData(w0,h0);
    for(let y=0;y<h0;y++)for(let xx=0;xx<w0;xx++){const v=Math.round((mx[(a+y)*W+c+xx]-lo)/Math.max(1,hi-lo)*255);const o=(y*w0+xx)*4;im.data[o]=im.data[o+1]=im.data[o+2]=v;im.data[o+3]=255}
    tx.putImageData(im,0,0);const k=48/h0,out=document.createElement('canvas');out.width=Math.round(w0*k)+40;out.height=Math.round(h0*k)+40;const ox=out.getContext('2d');
    ox.fillStyle='#fff';ox.fillRect(0,0,out.width,out.height);ox.imageSmoothingEnabled=true;ox.imageSmoothingQuality='high';ox.drawImage(t,20,20,Math.round(w0*k),Math.round(h0*k));
    /* grey works best: thresholding fattens 8 into 6 */const TH=0;const od=ox.getImageData(0,0,out.width,out.height);if(TH>0)for(let i=0;i<od.data.length;i+=4){const v=od.data[i]<TH?0:255;od.data[i]=od.data[i+1]=od.data[i+2]=v}ox.putImageData(od,0,0);return out};
  return {canvas:big,S,W,H,cols,blocks,bands,inked,cellImg,headerY:hl.length?hl[0][1]:0}}
async function readProgramImage(file,onStep){
  const img=await imgFromFile(file);const G=programGeom(img);const w=await tourOcr();const L={};
  for(let ci=0;ci<8&&ci<G.cols.length;ci++){const [a,b]=G.cols[ci];if(onStep)onStep(ci);
    await w.setParameters({tessedit_pageseg_mode:ci===7||ci===2||ci===3?'6':'4'});
    const {data}=await w.recognize(G.canvas,{rectangle:{left:a*G.S,top:0,width:(b-a)*G.S,height:G.H*G.S}},{blocks:true});
    const out=[];(data.blocks||[]).forEach(bl=>bl.paragraphs.forEach(p=>p.lines.forEach(l=>{const t=l.text.replace(/[|¦]/g,' ').replace(/\s+/g,' ').trim();if(t)out.push({t,y:(l.bbox.y0+l.bbox.y1)/2/G.S})})));
    L[ci]=out}
  await w.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:'0123456789:.'});
  for(const ci of [2,3]){const [a,b]=G.cols[ci];const cells=[];
    for(const [y0,y1] of G.bands){if(y0<=G.headerY||!G.inked(a,b,y0,y1))continue;
      const ci2=G.cellImg(a,b,y0,y1);if(!ci2)continue;const {data}=await w.recognize(ci2);
      let t=(data.text||'').replace(/\s/g,'');if(/^\d{4}$/.test(t))t=t.slice(0,2)+':'+t.slice(2);if(/\d[:.]\d/.test(t))cells.push({t,y:(y0+y1)/2})}
    // a cell the close-up could not read keeps what the whole-column pass found there
    L[ci]=cells.concat((L[ci]||[]).filter(l=>/\d[:.,]\d/.test(l.t)&&!cells.some(c=>Math.abs(c.y-l.y)<14)))}
  await w.setParameters({tessedit_char_whitelist:''});
  return programFromLines(L,G)}
function programFromLines(L,G){
  const body=a=>(a||[]).filter(l=>l.y>G.headerY);
  const hdr=(L[1]||[]).find(l=>l.y<=G.headerY&&/\d{1,2}[./]\d{1,2}[./]\d{4}/.test(l.t));
  const yearH=hdr?hdr.t.match(/(\d{4})/)[1]:String(new Date().getFullYear());
  const near=(arr,y,re)=>{let best=null;body(arr).forEach(l=>{const d=Math.abs(l.y-y);if(d<=12&&re.test(l.t)&&(!best||d<best.d))best={d,l}});return best&&best.l};
  const hm=t=>{const m=String(t).match(/(\d{1,2})[:.,](\d\d)/);return m&&+m[1]<24&&+m[2]<60?m[1].padStart(2,'0')+':'+m[2]:''};
  // "HALİL/RÜST" + "EM" on the next line of the cell -> "HALİL/RÜSTEM"
  const fixGuide=t=>t.replace(/([A-ZÇĞİÖŞÜ])J([A-ZÇĞİÖŞÜ])/g,'$1/$2').replace(/\s+/g,' ').replace(/([A-ZÇĞİÖŞÜ]{3,}) ([A-ZÇĞİÖŞÜ]{1,2})(?=$|[\s/])/g,'$1$2').trim();
  const inBlock=(arr,[a,b])=>body(arr).filter(l=>l.y>=a-2&&l.y<=b+2);
  const t={id:rid(),bus:'',name:'',pax:'',hotel:'',guide:'',kok:'',plate:'',driver:'',dphone:'',days:[]};
  const okIso=x=>/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(x);
  const dates=G.blocks.map(bk=>{const m=inBlock(L[0],bk).map(l=>l.t.match(/(\d{1,2})\s*[./,]\s*(\d{1,2})/)).find(Boolean);const iso=m?`${yearH}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';return okIso(iso)?iso:''});
  for(let i=0;i<dates.length;i++)if(dates[i]&&dates[i-1]&&dates[i]<=dates[i-1])dates[i]='';
  for(let r=0;r<2;r++)for(let i=0;i<dates.length;i++)if(!dates[i]){if(i&&dates[i-1])dates[i]=isoAdd(dates[i-1],1);else if(dates[i+1])dates[i]=isoAdd(dates[i+1],-1)}
  G.blocks.forEach((bk,bi)=>{const iso=dates[bi];if(!iso)return;
    if(!t.guide){const gl=inBlock(L[4],bk).map(l=>l.t).join(' ');if(gl)t.guide=fixGuide(gl)}
    if(!t.kok){const kl=inBlock(L[5],bk).map(l=>l.t).join(' ');if(kl)t.kok=fixGuide(kl)}
    if(!t.pax){const p=inBlock(L[7],bk).map(l=>l.t.match(/\b(\d{1,3})\b/)).find(Boolean);if(p)t.pax=p[1]}
    const day={d:iso,s:[]};
    inBlock(L[1],bk).forEach(l=>{let n=l.t.replace(/^[\-–—_.,:;]+|[\-–—_.,;]+$/g,'').replace(/I!/g,'I').replace(/(\p{Lu})!/gu,'$1İ').replace(/!(\p{Lu})/gu,'İ$1').replace(/(\p{Lu})5(\b|\s)/gu,'$1S$2').trim();if(!n||/^NOT\s*:/i.test(n)||n.length<2)return;
      const tm=near(L[2],l.y,/\d[:.,]\d/),mg=near(L[3],l.y,/\d[:.,]\d/);const m=mg?hm(mg.t):'';const k=stopKind(n,m);
      day.s.push({id:rid(),t:(tm&&hm(tm.t))||(k==='shop'?m:''),n,k,m:k==='shop'?m:''})});
    if(day.s.length)t.days.push(day)});
  if(!t.days.length)throw new Error('не смог прочитать дни программы');
  t.bus=(t.guide||'').split(/[\s/]/)[0]||'';
  return t}
async function importTourImages(files,o={}){
  let n=0,first=null;const progs=[];
  for(const [i,f] of files.entries()){
    try{toast(`Читаю фото ${i+1} из ${files.length}… (первый раз до 20 сек)`);
      progs.push(await readProgramImage(f));n++}
    catch(e){toast(`${f.name}: ${e.message}`);await new Promise(r=>setTimeout(r,1800))}}
  snapNames(progs);if(o.batch){progs.forEach(upsertTour);try{renderTours()}catch(e){}return progs.length}
  progs.forEach((t,i)=>{if(!i)first=t;else saveTour(t.id,t)});
  if(first){openTourEd(first);toast(n>1?`Прочитано программ: ${n}. Первая открыта для проверки, остальные сохранены — проверьте их через «✎ Изменить»`:'Программа прочитана с фото — проверьте и сохраните')}
  else if(!n)toast('Не получилось прочитать программу с фото. Лучше всего читаются скриншоты таблицы.')}

// the same restaurants and shops appear in every bus of a batch: snap OCR slips ("VYAROLTEKSTİL") to the common spelling
function snapNames(progs){
  const key=n=>String(n).toLocaleUpperCase('tr').replace(/[^A-ZÇĞİÖŞÜ0-9]/g,'');
  const cnt=new Map();const add=(n,w)=>{const k=key(n);if(k.length<3)return;const e=cnt.get(k)||{n,c:0};e.c+=w;if(/\s/.test(n)&&!/\s/.test(e.n))e.n=n;cnt.set(k,e)};
  progs.forEach(t=>t.days.forEach(d=>d.s.forEach(s=>add(s.n,1))));
  try{tours().forEach(t=>t.days.forEach(d=>d.s.forEach(s=>add(s.n,2))))}catch(e){}
  const all=[...cnt.entries()];
  progs.forEach(t=>t.days.forEach(d=>d.s.forEach(s=>{const k=key(s.n);const me=cnt.get(k);if(!me)return;let best=null;
    all.forEach(([k2,e])=>{if(k2===k||e.c<=me.c)return;const v=sim(k,k2);if(v>=0.8&&(!best||v>best.v||(v===best.v&&e.c>best.e.c)))best={v,e}});
    if(best){s.n=best.e.n;s.k=stopKind(s.n,s.m);if(s.k!=='shop')s.m=''}})))}
