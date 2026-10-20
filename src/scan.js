/* ---------- find a guest with the camera: passport (MRZ), name sign, booking on a screen, or typed name ---------- */
// OCR runs on the phone (tesseract.js). The picture is never stored or sent anywhere; only the recognised words are used to search today's lists.
const OCR_LIB='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const OCR_OPT={workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',langPath:'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int'};
let ocrWorker=null,ocrReady=null,scanStream=null,scanTimer=null,scanBusy=false,scanPaused=false;

// one spelling for every alphabet and transliteration: Turkish letters, Cyrillic, KH/H, Y/I, double letters
function nk(s){
  return String(s||'').replace(/[А-Яа-яЁё]/g,c=>{const l=CYR2LAT[c.toLowerCase()];return l==null?c:l}).toUpperCase()
    .replace(/İ/g,'I').replace(/I/g,'I').replace(/Ç/g,'C').replace(/Ğ/g,'G').replace(/Ö/g,'O').replace(/Ş/g,'S').replace(/Ü/g,'U').replace(/ı/g,'I')
    .normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Z]/g,'')
    .replace(/DZH/g,'J').replace(/ZH/g,'J').replace(/KH/g,'H').replace(/Y/g,'I').replace(/W/g,'V').replace(/Q/g,'K').replace(/(.)\1+/g,'$1');
}
function lev(a,b){if(a===b)return 0;const m=a.length,n=b.length;if(!m||!n)return m||n;let prev=Array.from({length:n+1},(_,j)=>j);
  for(let i=1;i<=m;i++){const cur=[i];for(let j=1;j<=n;j++)cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur}return prev[n]}
const sim=(a,b)=>!a||!b?0:1-lev(a,b)/Math.max(a.length,b.length);

// every guest of the open day with where they belong
function guestIndex(){
  if(!DAY)return [];const out=[];
  const add=(grp,kind,list)=>(list||[]).forEach((p,i)=>{if(!p||!p[1])return;const toks=String(p[1]).split(/\s+/).map(nk).filter(t=>t.length>=2);if(!toks.length)return;out.push({p,i,grp,kind,sur:toks[0],giv:toks.slice(1),full:toks.join('')})});
  DAY.arr.forEach(g=>add(g,'arr',g.p));DAY.dep.forEach(g=>add(g,'dep',g.p));(DAY.h2hList||[]).forEach(x=>add(x,'h2h',x.p));
  return out;
}
// words read from a picture: passport machine lines ("P<KGZBAZARKULOVA<<GULNARA<<<") or any printed text
function ocrTokens(text){
  const up=String(text||'').toUpperCase();const set=new Set();
  up.split(/\n+/).forEach(line=>{
    const mrz=(line.match(/</g)||[]).length>=3||/^P[<KC]?[A-Z]{3}/.test(line.replace(/\s/g,''));
    let L=line.replace(/\s/g,mrz?'':' ');
    if(mrz)L=L.replace(/[<«]+/g,' ').replace(/(?:K|C){3,}/g,' ');
    L.split(/[^A-Z]+/).forEach(w=>{if(w.length<3)return;set.add(nk(w));
      // the first machine line starts with P + country code glued to the surname
      if(w.length>6||mrz&&w.length>4){for(const k of [1,2,3,4,5])if(w.length-k>=3)set.add(nk(w.slice(k)))}});
  });
  return [...set].filter(t=>t.length>=3);
}
function matchGuests(tokens,typed){
  const idx=guestIndex();if(!idx.length||!tokens.length)return [];
  const q=typed?nk(typed):'';
  return idx.map(x=>{
    let s1=0,s2=x.giv.length?0:1;
    tokens.forEach(t=>{s1=Math.max(s1,sim(t,x.sur));x.giv.forEach(gv=>{s2=Math.max(s2,sim(t,gv))})});
    if(typed&&q.length>=3&&(x.full.includes(q)||x.sur.startsWith(q)))s1=Math.max(s1,1);
    return {...x,s1,s2,score:s1*0.65+s2*0.35};
  }).filter(x=>typed?(x.s1>=0.75||x.score>=0.8):(x.s1>=0.8&&(x.s2>=0.6||!x.giv.length)))
    .sort((a,b)=>b.score-a.score).filter((x,i,arr)=>typed||x.score>=arr[0].score-0.12).slice(0,6);
}

function guestCard(m){
  const g=m.grp,p=m.p,ex=p[3]||{};
  const f=m.kind==='arr'?flights.find(fl=>fl.groups.includes(g)):null;const st=f?fStatus(f,NOW):null;
  const a=assign[g.v]||{};
  const mates=(g.p||[]).filter((q,i)=>i!==m.i&&(!ex.voucher||(q[3]||{}).voucher===ex.voucher)).map(q=>q[1]);
  const mark=m.kind==='h2h'?null:markOf(g.id,m.i);
  const route=m.kind==='arr'?`✈️ ${esc(normFl(g.fl))} · ${esc(g.t)} · ${esc(CITY[g.org]||g.org||'')} → <b>${esc(g.h)}</b>`
    :m.kind==='dep'?`🛫 ${esc(g.h)} → ${esc(normFl(g.fl))} ${esc(g.t)}${g.dest?' · '+esc(CITY[g.dest]||g.dest):''}${g.pu?` · выезд ${esc(g.pu)}`:''}`
    :`🏨 ${esc(g.from||'откуда не указано')} → <b>${esc(g.h)}</b>`;
  return `<article class="sc-card">
    <div class="sc-name">${esc(p[0]||'')} <b>${esc(p[1])}</b>${p[2]?` <span class="hint">· ${esc(p[2])} лет</span>`:''}</div>
    <div class="sc-route">${route}${st?` <span class="status ${st.k}" style="margin-left:6px"><span class="dot"></span>${st.lbl}</span>`:''}</div>
    <dl class="sc-dl">
      <dt>Оператор</dt><dd>${esc(g.op||'—')}</dd>
      ${g.term?`<dt>Терминал</dt><dd>${esc(termLbl(g.term))}</dd>`:''}
      <dt>Гид</dt><dd>${g.g?gTag(g.g):'—'}</dd>
      <dt>Машина</dt><dd>${esc(g.v||'—')}${a.plate?' · '+esc(a.plate):''}${a.phone?` · <a class="tel" href="tel:${esc(a.phone.replace(/\s/g,''))}">${esc(a.phone)}</a>`:''}</dd>
      ${ex.voucher?`<dt>Ваучер</dt><dd>${esc(ex.voucher)}</dd>`:''}
      ${ex.type||ex.board?`<dt>Номер</dt><dd>${esc([ex.type,ex.board].filter(Boolean).join(' · '))}${ex.room?` <span class="hint">(комната ${esc(ex.room)})</span>`:''}</dd>`:''}
      ${ex.stay?`<dt>Проживание</dt><dd>${esc(ex.stay)}</dd>`:''}
      ${ex.note?`<dt>Примечание</dt><dd>${esc(ex.note)}</dd>`:''}
      ${m.kind!=='h2h'&&noteOf(g.id,m.i)?`<dt>📝 Заметка</dt><dd><b>${esc(noteOf(g.id,m.i))}</b></dd>`:''}
      ${mates.length?`<dt>Вместе с ним</dt><dd>${mates.slice(0,6).map(esc).join(', ')}${mates.length>6?` <span class="hint">и ещё ${mates.length-6}</span>`:''}</dd>`:''}
    </dl>
    ${m.kind==='h2h'?'':`<div class="sc-act">${mark==='out'?`<span class="chip ok">✓ ${m.kind==='arr'?'Вышел':'Сел'} ${(met[g.id]||{})['@'+m.i]!=null?fmt((met[g.id]||{})['@'+m.i]):''}</span><button type="button" class="btn sm" data-scm="${esc(g.id)}|${m.i}|">Вернуть</button>`
      :`<button type="button" class="btn primary" data-scm="${esc(g.id)}|${m.i}|out">✓ ${m.kind==='arr'?'Вышел':'Сел'}</button>${mark==='no'?'<span class="chip bad">не пришёл</span>':`<button type="button" class="btn" data-scm="${esc(g.id)}|${m.i}|no">✗ Не пришёл</button>`}`}<button type="button" class="btn sm" data-note="${esc(g.id)}|${m.i}">📝 ${noteOf(g.id,m.i)?'Изменить заметку':'Заметка'}</button></div>`}
  </article>`;
}
function showMatches(list,from){
  const box=$('#scRes');
  if(!list.length){box.innerHTML=from==='typed'?'<p class="hint">Никого не нашёл в списках этого дня.</p>':'';return}
  box.innerHTML=(list.length>1?`<p class="hint">Похожих: ${list.length}. Сверьте возраст и рейс.</p>`:'')+list.map(guestCard).join('');
  box.querySelectorAll('[data-note]').forEach(b=>b.onclick=()=>{const [gid,i]=b.dataset.note.split('|');const v=prompt(T('Заметка (например: ждёт жену с рейса PC 2010). Пусто — удалить.'),noteOf(gid,+i));if(v===null)return;met[gid]=met[gid]||{};met[gid]['#'+i]=v.trim();saveMet();rerenderMarks();const toks=box.dataset.toks?JSON.parse(box.dataset.toks):[];showMatches(matchGuests(toks,box.dataset.typed||''),from)});
  box.querySelectorAll('[data-scm]').forEach(b=>b.onclick=()=>{const [gid,i,v]=b.dataset.scm.split('|');setMark(gid,+i,v||null);rerenderMarks();
    const toks=box.dataset.toks?JSON.parse(box.dataset.toks):[];showMatches(matchGuests(toks,box.dataset.typed||''),from)});
}
function scanStatus(t){$('#scStatus').textContent=t}

async function ensureOcr(){
  if(ocrReady)return ocrReady;
  ocrReady=(async()=>{
    if(!window.Tesseract)await loadScript(OCR_LIB);
    scanStatus(T('Загружаю распознавание текста… (первый раз 5–10 секунд)'));
    const w=await Tesseract.createWorker('eng',1,OCR_OPT);
    await w.setParameters({tessedit_pageseg_mode:'6'});
    ocrWorker=w;return w;
  })().catch(e=>{ocrReady=null;throw e});
  return ocrReady;
}
// the part of the picture inside the frame, enlarged, grey and high-contrast: what OCR reads best
// enlarge so passport letters are big enough for OCR, grey, contrast stretched (no hard threshold: glare and holograms survive)
function prep(src,sx,sy,sw,sh,targetW){
  const c=document.createElement('canvas');const scale=Math.min(3,(targetW||2400)/sw);
  c.width=Math.round(sw*scale);c.height=Math.round(sh*scale);
  const x=c.getContext('2d',{willReadFrequently:true});x.imageSmoothingQuality='high';x.drawImage(src,sx,sy,sw,sh,0,0,c.width,c.height);
  const d=x.getImageData(0,0,c.width,c.height),px=d.data;const hist=new Uint32Array(256);
  for(let i=0;i<px.length;i+=4){const v=(0.3*px[i]+0.59*px[i+1]+0.11*px[i+2])|0;px[i]=v;hist[v]++}
  const n=px.length/4;let lo=0,hi=255,acc=0;while(lo<255&&(acc+=hist[lo])<n*0.02)lo++;acc=0;while(hi>0&&(acc+=hist[hi])<n*0.02)hi--;
  const k=255/Math.max(1,hi-lo);for(let i=0;i<px.length;i+=4){const v=Math.max(0,Math.min(255,(px[i]-lo)*k));px[i]=px[i+1]=px[i+2]=v}
  x.putImageData(d,0,0);c._src=src;c._sx=sx;c._sy=sy;c._k=scale;return c;
}
// a row found on the prepared picture, cut again from the original picture (one resample only: sharper letters)
const stripOf=(c,b)=>{const k=c._k||1,src=c._src||c;const sx=(c._sx||0)+b.x0/k,sy=(c._sy||0)+b.y0/k,sw=(b.x1-b.x0)/k,sh=(b.y1-b.y0)/k;return prep(src,sx,sy,sw,sh,Math.min(3000,sw*Math.max(1,110/sh)))};
// a passport held at a slight angle: find the angle at which text rows line up best and straighten the picture
function deskew(src,sx,sy,sw,sh){
  const small=document.createElement('canvas');const k=Math.min(1,500/sw);small.width=Math.round(sw*k);small.height=Math.round(sh*k);
  const sc=small.getContext('2d',{willReadFrequently:true});let best=0,bestV=-1;
  for(let a=-6;a<=6;a+=1.5){sc.save();sc.fillStyle='#fff';sc.fillRect(0,0,small.width,small.height);sc.translate(small.width/2,small.height/2);sc.rotate(a*Math.PI/180);
    sc.drawImage(src,sx,sy,sw,sh,-small.width/2,-small.height/2,small.width,small.height);sc.restore();
    const px=sc.getImageData(0,0,small.width,small.height).data,W=small.width;let sum=0,sum2=0;
    for(let y=0;y<small.height;y++){let n=0,prev=px[y*W*4];for(let x=1;x<W;x++){const v=px[(y*W+x)*4];if(Math.abs(v-prev)>30)n++;prev=v}sum+=n;sum2+=n*n}
    const v=sum2/small.height-(sum/small.height)**2;if(v>bestV){bestV=v;best=a}}
  const c=document.createElement('canvas');c.width=Math.round(sw);c.height=Math.round(sh);const x=c.getContext('2d');
  x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.translate(c.width/2,c.height/2);x.rotate(best*Math.PI/180);x.drawImage(src,sx,sy,sw,sh,-c.width/2,-c.height/2,c.width,c.height);
  return c;
}
function cropFrame(src,sw,sh){const fw=sw*0.92,fh=Math.min(sh*0.5,fw/2.6);const d=deskew(src,(sw-fw)/2,(sh-fh)/2,fw,fh);return prep(d,0,0,d.width,d.height,2400)}
// rows of the picture full of letter edges = lines of text; passport machine lines are the densest
function textBands(c){
  const x=c.getContext('2d',{willReadFrequently:true});const W=c.width,H=c.height;const px=x.getImageData(0,0,W,H).data;
  const rows=new Float32Array(H);
  for(let y=0;y<H;y++){let n=0,prev=px[(y*W)*4];for(let xx=2;xx<W;xx+=2){const v=px[(y*W+xx)*4];if(Math.abs(v-prev)>28)n++;prev=v}rows[y]=n}
  const sm=new Float32Array(H);for(let y=0;y<H;y++){let a=0,k=0;for(let d=-3;d<=3;d++){const yy=y+d;if(yy>=0&&yy<H){a+=rows[yy];k++}}sm[y]=a/k}
  let max=0;for(const v of sm)if(v>max)max=v;if(max<6)return [];const t=max*0.3;const out=[];let y=0;
  while(y<H){if(sm[y]<t){y++;continue}let y1=y;while(y1<H&&(sm[y1]>=t||(y1+2<H&&sm[y1+2]>=t)))y1++;
    const h=y1-y;if(h>=Math.max(10,H*0.006)&&h<=H*0.3){let dens=0;for(let k=y;k<y1;k++)dens+=sm[k];const pad=Math.round(h*0.5);
      out.push({y0:Math.max(0,y-pad),y1:Math.min(H,y1+pad),x0:0,x1:W,dens:dens/h})}
    y=y1+1}
  return out.sort((a,b)=>b.dens-a.dens);
}
// what was read, to show the operator that the camera is working: passport name line or the longest words
function readLabel(text){
  const line=String(text||'').toUpperCase().split(/\n/).map(l=>l.replace(/\s/g,'')).find(l=>/[A-Z]{2,}<<[A-Z]/.test(l));
  if(line){const m=line.match(/([A-Z<]*?)<<([A-Z]+)/);if(m)return (m[1].replace(/^P[<A-Z]?[A-Z]{0,3}</,'').replace(/</g,' ').trim()+' '+m[2]).trim()}
  return String(text||'').toUpperCase().split(/[^A-ZÇĞİÖŞÜ]+/).filter(w=>w.length>=4).sort((a,b)=>b.length-a.length).slice(0,3).join(' ');
}
const WL_UP='ABCDEFGHIJKLMNOPQRSTUVWXYZ<0123456789 ';
let ocrPass=0;
async function recognise(canvas,manual){
  const w=await ensureOcr();
  // pass 1: capital letters only (passport lines, name signs); pass 2: any text (bookings on a screen)
  const passes=manual?[WL_UP,'']:[ocrPass++%3===2?'':WL_UP];let list=[],text='',allText='';
  for(const wl of passes){
    await w.setParameters({tessedit_char_whitelist:wl,tessedit_pageseg_mode:'6'});
    const {data}=await w.recognize(canvas);text=data.text;
    // passport machine lines are read best one line at a time: find dense text rows and re-read each on its own
    if(wl){const bands=textBands(canvas).slice(0,manual?6:4);
      if(bands.length){await w.setParameters({tessedit_pageseg_mode:'7'});
        for(const b of bands){const strip=stripOf(canvas,b);
          const r=await w.recognize(strip);text+='\n'+r.data.text}
        await w.setParameters({tessedit_pageseg_mode:'6'});}}
    allText+='\n'+text;window.__ocr=allText;
    const toks=ocrTokens(allText);list=matchGuests(toks);
    const box=$('#scRes');box.dataset.toks=JSON.stringify(toks);box.dataset.typed='';
    if(list.length)break;
  }
  if(list.length){showMatches(list,'scan');const best=list[0];
    if(best.s1>=0.88&&best.s2>=0.75){scanPaused=true;try{navigator.vibrate&&navigator.vibrate(80)}catch(e){}scanStatus(T('Нашёл. Нажмите «Сканировать дальше» для следующего гостя.'));$('#scNext').hidden=false}
  }else{const lbl=readLabel(allText);
    if(lbl)scanStatus(`${T('Прочитал')}: ${lbl} — ${T('в списках этого дня такого гостя нет')}`);
    else if(manual)scanStatus(T('На фото не нашёл никого из списков этого дня. Попробуйте ближе и без бликов, или введите фамилию.'));}
  return list;
}
async function scanTick(){
  if(scanBusy||scanPaused||!scanStream)return;const v=$('#scVideo');if(!v.videoWidth)return;
  scanBusy=true;try{await recognise(cropFrame(v,v.videoWidth,v.videoHeight))}
  catch(e){scanStatus(T('Распознавание не загрузилось. Проверьте интернет.'))}finally{scanBusy=false}
}
async function openScan(){
  if(!DAY){toast(T('Сначала загрузите день'));return}
  $('#scanSheet').hidden=false;document.body.classList.add('sc-open');$('#scRes').innerHTML='';$('#scQ').value='';$('#scNext').hidden=true;scanPaused=false;
  scanStatus(T('Включаю камеру…'));
  ensureOcr().catch(()=>scanStatus(T('Распознавание не загрузилось. Проверьте интернет.')));
  try{
    scanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});
    try{const tr=scanStream.getVideoTracks()[0];const cap=tr.getCapabilities?tr.getCapabilities():{};if(cap.focusMode&&cap.focusMode.includes('continuous'))await tr.applyConstraints({advanced:[{focusMode:'continuous'}]})}catch(e){}
    const v=$('#scVideo');v.srcObject=scanStream;await v.play();$('#scCam').hidden=false;
    scanStatus(T('Две нижние строки паспорта (с <<<) — в рамку, ровно, без бликов, на расстоянии 15–20 см'));
    clearInterval(scanTimer);scanTimer=setInterval(scanTick,900);
  }catch(e){$('#scCam').hidden=true;scanStatus(T('Камера недоступна. Нажмите «Сфотографировать» или введите фамилию.'))}
}
function closeScan(){clearInterval(scanTimer);scanTimer=null;if(scanStream){scanStream.getTracks().forEach(t=>t.stop());scanStream=null}$('#scanSheet').hidden=true;document.body.classList.remove('sc-open')}
$('#scanBtn').onclick=openScan;{const b=document.querySelector('.tab[aria-selected="true"]');$('#scanBtn').hidden=!b||b.dataset.t!=='ops'}$('#scClose').onclick=closeScan;
$('#scNext').onclick=()=>{scanPaused=false;$('#scNext').hidden=true;$('#scRes').innerHTML='';scanStatus(T('Две нижние строки паспорта (с <<<) — в рамку, ровно, без бликов, на расстоянии 15–20 см'))};
$('#scPhoto').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
  scanPaused=true;scanStatus(T('Читаю фото…'));
  try{const img=await createImageBitmap(f);
    // a still photo: read the whole picture, the passport can be anywhere on it
    const d=deskew(img,0,0,img.width,img.height);const c=prep(d,0,0,d.width,d.height,Math.min(3000,Math.max(1600,img.width)));
    const list=await recognise(c,true);if(list.length&&!$('#scNext').hidden)return;if(list.length)scanStatus(T('Проверьте, тот ли это гость.'))}
  catch(err){scanStatus(T('Не удалось прочитать фото.'))}
  $('#scNext').hidden=false});
$('#scQ').addEventListener('input',e=>{const q=e.target.value.trim();const box=$('#scRes');box.dataset.typed=q;box.dataset.toks=JSON.stringify(q.split(/\s+/).map(nk).filter(t=>t.length>=2));
  if(q.length<3){box.innerHTML='';return}scanPaused=true;$('#scNext').hidden=false;showMatches(matchGuests(JSON.parse(box.dataset.toks),q),'typed')});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#scanSheet').hidden)closeScan()});

// installable app: register the service worker on the real site
if('serviceWorker' in navigator&&/^https?:/.test(location.protocol))window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
