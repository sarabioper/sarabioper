// Read PDF and Word files into the same "rows" shape the Excel reader produces,
// so the KAPAK and tourist parsers work on any of the three formats.
async function pdfToRows(buf,lib){
  const pdfjs=lib||window.pdfjsLib;
  const doc=await pdfjs.getDocument({data:new Uint8Array(buf),isEvalSupported:false}).promise;
  const rows=[];
  for(let n=1;n<=doc.numPages;n++){
    const page=await doc.getPage(n);
    const tc=await page.getTextContent();
    const items=tc.items.filter(i=>i.str&&i.str.trim()).map(i=>({s:i.str,x:i.transform[4],y:i.transform[5],w:i.width,h:Math.abs(i.transform[3])||8}));
    // KAPAK prints departures and arrivals side by side: read the two halves separately
    const arrHdr=items.find(i=>/^\s*ARRIVAL\s*$/.test(i.s));
    const ops=items.filter(i=>/^\s*Operat/.test(i.s)).map(i=>i.x);
    const cut=arrHdr?(ops.length>1?Math.max(...ops)-8:arrHdr.x-10):null;
    const cols=cut?[items.filter(i=>i.x<cut),items.filter(i=>i.x>=cut)]:[items];
    cols.forEach(col=>{
      col.sort((a,b)=>b.y-a.y||a.x-b.x);
      const lines=[];
      col.forEach(it=>{const L=lines.find(l=>Math.abs(l.y-it.y)<=Math.max(2,it.h*0.35));if(L)L.items.push(it);else lines.push({y:it.y,items:[it]})});
      lines.sort((a,b)=>b.y-a.y);
      lines.forEach(L=>{
        L.items.sort((a,b)=>a.x-b.x);
        let txt='',end=null;
        L.items.forEach(it=>{if(end!=null){const gap=it.x-end;
          // a number printed right after a word ("SPA2", "RESORT29") is a separate column
          const glued=gap>-1&&((/[A-Za-zÇĞİÖŞÜçğıöşü)]$/.test(txt)&&/^\d/.test(it.s))||(/\d$/.test(txt)&&/^[A-Za-zÇĞİÖŞÜ(]/.test(it.s)));
          txt+=gap>it.h*1.2?'  ':(gap>it.h*0.15||gap<-0.5||glued?' ':'')}txt+=it.s;end=it.x+it.w});
        rows.push([txt]);
      });
    });
  }
  return rows;
}
async function docxToRows(buf,Zip,Parser){
  const JSZ=Zip||window.JSZip;const DP=Parser||window.DOMParser;
  const zip=await JSZ.loadAsync(buf);
  const f=zip.file('word/document.xml');if(!f)throw new Error('это не документ Word (.docx)');
  const xml=new DP().parseFromString(await f.async('string'),'application/xml');
  const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const textOf=node=>{let t='';const walk=n=>{for(const c of n.childNodes){if(c.nodeType!==1)continue;const ln=c.localName;if(ln==='t')t+=c.textContent;else if(ln==='tab')t+='  ';else if(ln==='br'||ln==='cr')t+='\n';else if(ln==='p'&&t&&!t.endsWith('\n'))t+='\n',walk(c);else walk(c)}};walk(node);return t};
  const rows=[];
  const body=xml.getElementsByTagNameNS(W,'body')[0];if(!body)return rows;
  for(const el of body.childNodes){
    if(el.nodeType!==1)continue;
    if(el.localName==='p'){const t=textOf(el);if(t.trim())rows.push([t])}
    else if(el.localName==='tbl'){
      for(const tr of el.getElementsByTagNameNS(W,'tr')){const cells=[...tr.childNodes].filter(c=>c.nodeType===1&&c.localName==='tc').map(tc=>textOf(tc).trim());if(cells.some(Boolean))rows.push(cells)}
    }
  }
  return rows;
}
if(typeof module!=='undefined')module.exports={pdfToRows,docxToRows};
