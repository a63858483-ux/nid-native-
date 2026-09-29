// The page inside the reader WebView. epub.js renders the book with its own stylesheet, so
// coloured text, italics, pictures and note links stay as the book made them. It talks to the
// app through postMessage: where we are, what she selected, which note link or highlight she
// tapped, the contents and search results. The app drives it by calling the window.nid* functions.
export function readerHtml(opts: { top: number; bottom: number; paper: string }) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js"></script>
<style>
html,body{margin:0;height:100%;overflow:hidden;background:${opts.paper};-webkit-user-select:none}
#v{position:absolute;top:${opts.top}px;bottom:${opts.bottom}px;left:0;right:0}
</style></head><body><div id="v"></div><script>
const post=(t,d)=>window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({t},d||{})));
window.onerror=(m)=>post('error',{m:String(m)});
let book=null,rend=null,marks={},pendingQuotes=[],toc=[],theme={paper:'${opts.paper}',ink:'',weight:400,size:100};
const flat=(items,level)=>items.reduce((a,i)=>a.concat([{label:(i.label||'').trim(),href:i.href,level}],level<2?flat(i.subitems||[],level+1):[]),[]);

function applyTheme(){
  if(!rend)return;
  document.documentElement.style.background=theme.paper;document.body.style.background=theme.paper;
  rend.themes.override('background',theme.paper);
  // Original keeps the book's own ink; the others set the base colour, and spans the book
  // coloured itself keep their colour.
  rend.themes.override('color',theme.ink||'inherit');
  rend.themes.override('font-weight',String(theme.weight));
  rend.themes.fontSize(theme.size+'%');
}
window.nidTheme=(t)=>{theme=Object.assign(theme,t);applyTheme()};

function textRange(doc,quote){
  // find the quote across text nodes; whitespace-insensitive on the first 40 characters
  const want=quote.replace(/\\s+/g,'').slice(0,40);if(!want)return null;
  const walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT);const nodes=[];let flatText='';const map=[];
  let n;while((n=walker.nextNode())){for(let i=0;i<n.data.length;i++){if(!/\\s/.test(n.data[i])){flatText+=n.data[i];map.push([n,i])}}}
  const at=flatText.indexOf(want);if(at<0)return null;
  const s=map[at],e=map[at+want.length-1];const r=doc.createRange();r.setStart(s[0],s[1]);r.setEnd(e[0],e[1]+1);return r;
}
function drawMark(m){
  if(!rend||!m.cfi)return;
  try{rend.annotations.remove(m.cfi,'highlight')}catch(e){}
  rend.annotations.highlight(m.cfi,{id:m.id},()=>post('mark',{id:m.id}),'nid-hl',{fill:m.color,'fill-opacity':'0.38','mix-blend-mode':'multiply'});
}
window.nidMarks=(list)=>{
  list.forEach(m=>{marks[m.id]=m;if(m.cfi)drawMark(m)});
  pendingQuotes=list.filter(m=>!m.cfi&&m.quote);
  if(rend)rend.getContents().forEach(placeQuotes);
};
function placeQuotes(contents){
  pendingQuotes=pendingQuotes.filter(m=>{
    const r=textRange(contents.document,m.quote);if(!r)return true;
    try{m.cfi=contents.cfiFromRange(r);drawMark(m);post('placed',{id:m.id,cfi:m.cfi})}catch(e){return true}
    return false;
  });
}

// A link's href is relative to the chapter file it sits in; spine hrefs are relative to the package.
function resolveHref(contents,href){
  const item=book.spine.get(contents.sectionIndex);
  const base=item&&item.href?item.href:'';
  try{const u=new URL(href,'http://book/'+base);return decodeURIComponent(u.pathname.slice(1))+u.hash}catch(e){return href}
}
async function noteText(href,doc){
  const [file,hash]=href.split('#');
  let target=null;
  if(hash)target=doc.getElementById(hash);
  if(!target&&hash&&file){
    const item=book.spine.spineItems.find(s=>s.href&&(s.href===file||s.href.endsWith('/'+file)||file.endsWith('/'+s.href)));
    if(item){const d=await item.load(book.load.bind(book));target=(d.ownerDocument||d).getElementById?(d.ownerDocument||d).getElementById(hash):d.querySelector('#'+CSS.escape(hash));item.unload()}
  }
  if(!target)return '';
  const box=target.closest('aside,li,p,div')||target;
  return (box.textContent||'').replace(/\\s+/g,' ').trim();
}

let tx=0,ty=0,tt=0;
function hookContents(contents){
  const doc=contents.document;
  doc.addEventListener('selectionchange',()=>{const s=doc.getSelection();if(!s||s.isCollapsed)post('select',{text:''})});
  doc.querySelectorAll('a[href]').forEach(a=>{
    a.addEventListener('click',async(e)=>{
      const href=a.getAttribute('href')||'';
      e.preventDefault();e.stopPropagation();
      if(/^https?:/i.test(href)){post('link',{url:href});return}
      const noteish=/noteref|footnote|endnote/i.test((a.getAttribute('epub:type')||'')+' '+(a.getAttribute('role')||'')+' '+(a.className||''))||/^\\s*[\\[(（]?[0-9*＊†]+[\\])）]?\\s*$/.test(a.textContent||'');
      const full=href.startsWith('#')?href:resolveHref(contents,href);
      if(noteish){const t=await noteText(href.startsWith('#')?href:full,doc);if(t){post('note',{text:t,label:(a.textContent||'').trim()});return}}
      try{rend.display(href.startsWith('#')?(book.spine.get(contents.sectionIndex).href+href):full)}catch(err){}
    });
  });
  placeQuotes(contents);
}

function onTouchStart(e){const p=e.changedTouches[0];tx=p.screenX;ty=p.screenY;tt=Date.now()}
function onTouchEnd(e){
  const p=e.changedTouches[0];const dx=p.screenX-tx,dy=p.screenY-ty,dt=Date.now()-tt;
  const sel=e.view&&e.view.getSelection&&e.view.getSelection();
  if(sel&&!sel.isCollapsed)return;
  if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.2){dx<0?rend.next():rend.prev();return}
  if(Math.abs(dx)<10&&Math.abs(dy)<10&&dt<350){
    if(e.target&&e.target.closest&&e.target.closest('a[href]'))return;
    const w=window.innerWidth,x=p.screenX;
    if(x<w*0.22)rend.prev();else if(x>w*0.78)rend.next();else post('tap');
  }
}

window.nidOpen=async(url,token,cfi,t,list)=>{
  try{
    if(t)theme=Object.assign(theme,t);
    const res=await fetch(url,{headers:{Authorization:'Bearer '+token}});
    if(!res.ok){post('error',{m:'HTTP '+res.status});return}
    book=ePub(await res.arrayBuffer());
    rend=book.renderTo('v',{width:'100%',height:'100%',flow:'paginated',spread:'none',allowScriptedContent:false});
    rend.hooks.content.register(hookContents);
    rend.on('touchstart',onTouchStart);rend.on('touchend',onTouchEnd);
    rend.on('selected',(cfi,contents)=>{
      let text='';try{text=rend.getRange(cfi).toString()}catch(e){}
      post('select',{cfi,text:text.trim()});
    });
    rend.on('relocated',(loc)=>{
      const s=loc.start;let pct=0,page=0,total=0;
      if(book.locations.length()){pct=book.locations.percentageFromCfi(s.cfi)||0;page=(s.location||0)+1;total=book.locations.length()}
      const ch=toc.filter(i=>s.href&&i.href&&(s.href===i.href.split('#')[0]||s.href.endsWith(i.href.split('#')[0]))).pop();
      post('loc',{cfi:s.cfi,pct,page,total,cpage:s.displayed.page,ctotal:s.displayed.total,chapter:ch?ch.label:''});
    });
    applyTheme();
    await book.ready;
    book.loaded.navigation.then(nav=>{toc=flat(nav.toc||[],0);post('toc',{items:toc})});
    await rend.display(cfi||undefined);
    if(list)window.nidMarks(list);
    post('ready',{title:(book.packaging&&book.packaging.metadata&&book.packaging.metadata.title)||''});
    book.locations.generate(1200).then(()=>{const l=rend.currentLocation();if(l&&l.start){rend.emit('relocated',l)}post('located',{total:book.locations.length()})});
  }catch(e){post('error',{m:String(e&&e.message||e)})}
};
window.nidGo=(target)=>{try{rend.display(target)}catch(e){}};
window.nidGoPct=(p)=>{if(book.locations.length())rend.display(book.locations.cfiFromPercentage(p))};
window.nidNext=()=>rend&&rend.next();window.nidPrev=()=>rend&&rend.prev();
window.nidClear=()=>{rend&&rend.getContents().forEach(c=>{const s=c.window.getSelection();s&&s.removeAllRanges()})};
window.nidSearch=async(q)=>{
  const out=[];
  for(const item of book.spine.spineItems){
    if(out.length>=150)break;
    try{await item.load(book.load.bind(book));const r=item.find(q)||[];item.unload();r.forEach(x=>out.push({cfi:x.cfi,excerpt:x.excerpt}))}catch(e){}
  }
  post('results',{q,items:out.slice(0,150)});
};
post('boot');
</script></body></html>`;
}
