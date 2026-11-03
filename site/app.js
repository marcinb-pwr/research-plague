(() => {
"use strict";
const payload=window.PLAGUE_DATA;
if(!payload?.catalogue?.chapters?.length){document.getElementById("app").innerHTML='<main class="loading-shell"><h1>The catalogue could not load.</h1><p>Reload this page, or download the workbook from the project repository.</p></main>';return;}
const D=payload.catalogue,S=payload.sources;
const groups=new Map(D.groups.map(g=>[g.id,g]));
const chapters=new Map(D.chapters.map(c=>[c.id,c]));
const excerpts=new Map(S.excerpts.map(e=>[e.id,e]));
const editionEntries=new Map((Array.isArray(payload.editions?.entries)?payload.editions.entries:[]).filter(e=>e&&Number.isInteger(e.chapterId)&&chapters.has(e.chapterId)&&typeof e.path==="string"&&/^data\/editions\/[a-zA-Z0-9_-]+\.json$/.test(e.path)).map(e=>[e.chapterId,e]));
const editionCache=new Map();
let editionView="both";
const localSources=new Map();
for(const e of S.excerpts)for(const id of e.chapterIds||[]){if(!localSources.has(id))localSources.set(id,[]);localSources.get(id).push(e);}
const REPO="https://github.com/marcinb-pwr/research-plague";
const STORAGE="research-plague.reading-list.v1";
let saved=new Set(),storageOK=true,shown=24,toastTimer,searchTimer,sourceView="scan",zoom=1;
try{saved=new Set(JSON.parse(localStorage.getItem(STORAGE)||"[]").filter(id=>chapters.has(id)));}catch{storageOK=false;}
const el=document.getElementById("app");
const H=v=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const U=v=>{const s=String(v||"");return /^https:\/\//.test(s)||/^(excerpts|images|downloads|data)\//.test(s)?H(s):"#";};
const paths={
 book:'<path d="M3 4h6c2 0 3 2 3 2s1-2 3-2h6v15h-6c-2 0-3 2-3 2s-1-2-3-2H3z"/><path d="M12 6v15M6 8h3m-3 4h3m6-4h3m-3 4h3"/>',
 home:'<path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7"/>',
 layers:'<path d="m12 3 10 5-10 5L2 8zM3 13l9 5 9-5M3 18l9 5 9-5"/>',
 list:'<path d="M8 5h13M8 12h13M8 19h13M3 5h.1M3 12h.1M3 19h.1"/>',
 file:'<path d="M5 3h9l5 5v13H5zM14 3v6h5M8 13h8m-8 4h6"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 10v7m0-10v.1"/>',
 bookmark:'<path d="M6 3h12v19l-6-4-6 4z"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
 arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
 external:'<path d="M14 3h7v7m0-7L10 14M10 4H4v17h17v-6"/>',
 chevron:'<path d="m9 5 7 7-7 7"/>',
 left:'<path d="m15 5-7 7 7 7"/>',
 menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
 copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 5V3H3v13h2"/>',
 check:'<path d="m4 12 5 5L20 6"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 minus:'<path d="M5 12h14"/>',
 close:'<path d="m5 5 14 14M19 5 5 19"/>',
 github:'<path d="M9 19c-4 1-4-2-6-2m12 4v-3.4c0-1 .1-1.6-.5-2.1 3.1-.3 6.5-1.5 6.5-7A5.5 5.5 0 0 0 19.5 5c.1-1-.1-2-.5-3-1.6 0-3.3 1-4 1.5a13 13 0 0 0-6 0C8.3 3 6.6 2 5 2c-.4 1-.6 2-.5 3A5.5 5.5 0 0 0 3 8.5c0 5.5 3.4 6.7 6.5 7-.6.5-.5 1.1-.5 2.1V21"/>',
 letters:'<path d="M3 20 9 4l6 16M5 15h8M16 9h5l-5 11h5"/>'
};
const icon=(name,cls="")=>'<svg class="icon '+cls+'" viewBox="0 0 24 24" aria-hidden="true">'+(paths[name]||paths.book)+'</svg>';
const external=(url,label,cls="text-link")=>'<a class="'+cls+'" href="'+U(url)+'" target="_blank" rel="noopener noreferrer">'+label+' '+icon("external","small")+'</a>';
const groupLink=(id,text,cls="tag")=>'<a class="'+cls+'" href="#/group/'+encodeURIComponent(id)+'">'+H(text||groups.get(id)?.name||id)+'</a>';
const chip=(text,cls="")=>'<span class="badge '+cls+'">'+H(text)+'</span>';
const bookmark=(c,small=false)=>'<button class="'+(small?"bookmark-small":"button secondary"+(saved.has(c.id)?" saved":""))+'" data-save="'+c.id+'" aria-pressed="'+saved.has(c.id)+'" aria-label="'+(saved.has(c.id)?"Remove chapter "+c.id+" from reading list":"Save chapter "+c.id+" to reading list")+'">'+icon(saved.has(c.id)?"check":"bookmark")+(small?"":saved.has(c.id)?"Saved":"Save chapter")+'</button>';
const normalize=s=>String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const searchIndex=new Map(D.chapters.map(c=>[c.id,normalize([c.id,c.roman,c.title,c.summary,...c.provisions,...c.tags,...c.groupIds.map(g=>groups.get(g)?.name||""),c.actionLabel].join(" "))]));
function route(){const raw=(location.hash||"#/").slice(1);const i=raw.indexOf("?");const path=i<0?raw:raw.slice(0,i);let parts;try{parts=path.split("/").filter(Boolean).map(decodeURIComponent);}catch{parts=[];}return{parts,params:new URLSearchParams(i<0?"":raw.slice(i+1))};}
function navigate(url){if(location.hash==="#"+url){render();}else location.hash=url;}
function toast(text){const box=document.getElementById("toast");box.textContent=text;box.classList.add("visible");clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove("visible"),3200);}
function footer(){return '<footer class="page-footer"><div><strong>Gastaldi · The Plague Response Atlas</strong><br>Rome, 1656–1657 · Collected orders through 1658 · Bologna edition, 1684</div><div class="footer-links"><a href="#/method">Sources & method</a><a href="./data/catalogue.json" download>Open data</a><a href="'+REPO+'" target="_blank" rel="noopener noreferrer">Contribute on GitHub '+icon("external","small")+'</a></div></footer>';}
function layout(content,section="Overview",active="overview"){
 const nav=[["overview","/","home","Overview",""],["groups","/groups","layers","Intervention groups","13"],["chapters","/chapters","list","Chapter index","204"],["sources","/sources","file","Primary sources",String(S.excerpts.length)],["context","/context","book","Beyond the edicts",""],["glossary","/glossary","letters","Glossary",""]];
 const navHtml=nav.map(([id,url,ic,label,count])=>'<a class="nav-link '+(active===id?"active":"")+'" href="#'+url+'" '+(active===id?'aria-current="page"':"")+'>'+icon(ic)+'<span>'+label+'</span>'+(count?'<span class="nav-count">'+count+'</span>':"")+'</a>').join("");
 return '<div class="shell"><aside class="sidebar" aria-label="Main navigation"><a class="brand" href="#/"><span class="brand-mark">'+icon("book")+'Gastaldi</span><span class="brand-caption">The plague response atlas</span></a><button class="icon-button sidebar-close" aria-label="Close navigation" data-menu-close>'+icon("close")+'</button><div class="nav-heading">Explore the collection</div><nav class="nav-list">'+navHtml+'</nav><div class="nav-heading" style="margin-top:28px">Your research</div><nav class="nav-list"><a class="nav-link '+(active==="reading"?"active":"")+'" href="#/reading-list">'+icon("bookmark")+'Reading list<span class="nav-count" id="saved-count">'+saved.size+'</span></a><a class="nav-link '+(active==="method"?"active":"")+'" href="#/method">'+icon("info")+'Sources & method</a></nav><div class="sidebar-bottom"><div class="side-rule"></div><p>A public-health response<br>through its original documents.</p><p class="edition">Bologna · 1684</p><a href="'+U(D.meta.sourceUrl)+'" target="_blank" rel="noopener noreferrer">Open the complete volume '+icon("external","small")+'</a></div></aside><button class="menu-overlay" aria-label="Dismiss navigation backdrop" tabindex="-1" data-menu-close></button><div class="main-shell"><header class="topbar"><button class="icon-button mobile-menu" aria-label="Open navigation" aria-expanded="false" data-menu>'+icon("menu")+'</button><div class="breadcrumbs"><a href="#/">Research atlas</a>'+icon("chevron","small")+'<span>'+H(section)+'</span></div><form class="global-search" id="global-search" role="search"><label class="sr-only" for="global-query">Search all chapters</label>'+icon("search","small")+'<input id="global-query" name="q" type="search" placeholder="Search the chapter catalogue…" autocomplete="off"><span class="key" aria-hidden="true">/</span></form><a class="github-link" href="'+REPO+'" target="_blank" rel="noopener noreferrer" aria-label="Open the GitHub repository">'+icon("github")+'<span>Repository</span></a></header><main id="main" tabindex="-1">'+content+footer()+'</main></div></div>';
}
function sourceCard(e){return '<a class="source-card" href="#/source/'+H(e.id)+'"><div class="source-thumb"><img src="./'+U(e.thumbnail||e.pages[0].image)+'" alt="Original page from '+H(e.title)+'" loading="lazy"></div><div class="source-card-body">'+chip('Printed pp. '+e.printedPages,"warm")+'<h2>'+H(e.title)+'</h2><p>'+H(e.description)+'</p><div class="source-card-bottom"><span>'+e.pages.length+' scanned page'+(e.pages.length===1?"":"s")+' · PDF available</span>'+icon("arrow","small")+'</div></div></a>';}
function chapterTrail(ids){return '<div class="chapter-trail">'+ids.filter(id=>chapters.has(id)).map(id=>'<a href="#/chapter/'+id+'" title="'+H(chapters.get(id).title)+'">Ch. '+id+'</a>').join("")+'</div>';}
function home(){
 const hero=S.hero||{};
 const featured=excerpts.get("tavern-contact-rules")||S.excerpts[0];
 const pathsData=[
 {k:"01 / Find and follow",title:"How did a case become visible?",text:"From an illness report to a household visit: follow the reporting system through the city.",ids:[55,63,201,228]},
 {k:"02 / Objects and obligations",title:"What happened to suspect goods?",text:"Follow possessions through registration, cleansing, compensation and return.",ids:[64,100,142,209,241]},
 {k:"03 / A changing response",title:"When could restrictions end?",text:"Read rules beside their later exceptions and relaxations. The response changed over time.",ids:[75,126,193,227]}
 ];
 const questions=[["surveillance_tracing","How was illness discovered?","Household visits, reports and contact records."],["border_travel","Who could enter the city?","Travel papers, ports and guarded routes."],["special_populations_welfare","What made confinement possible?","Food, care, compensation and unequal obligations."],["reopening_adaptive","How did the city reopen?","Conditions, exceptions and renewed restrictions."]];
 return '<section class="hero"><div><p class="eyebrow">Rome, 1656–1657 · A documentary atlas</p><h1>How a city<br>confronted plague.</h1><p class="lead">Explore the rules, people and practical arrangements behind Rome’s response—through Girolamo Gastaldi’s account and the original pages of his 1684 treatise.</p><div class="button-row"><a class="button" href="#/groups">Explore the interventions '+icon("arrow","small")+'</a><a class="button secondary" href="#/sources">'+icon("book","small")+'Read the original</a></div></div><figure class="hero-figure"><a class="hero-frame" href="#/source/trastevere-cordon" aria-label="Explore the original Trastevere map">'+(hero.image?'<img src="./'+U(hero.image)+'" alt="'+H(hero.alt||"Original plan of Trastevere and Tiber Island")+'">':"")+'<span class="source-stamp">From the 1684 volume</span></a><figcaption>'+H(hero.caption||"Gastaldi’s plan of Trastevere and the Tiber Island lazaretto.")+' <a href="#/source/trastevere-cordon">View the source '+icon("arrow","small")+'</a></figcaption></figure></section><section class="metric-strip" aria-label="Collection scope"><div class="metric"><span class="metric-number">204</span><span class="metric-label">Document chapters<small>Edicts and operational instructions</small></span></div><div class="metric"><span class="metric-number">13</span><span class="metric-label">Intervention groups<small>A functional reading of the response</small></span></div><div class="metric"><span class="metric-number">'+S.excerpts.length+'</span><span class="metric-label">Original excerpts<small>Page scans and downloadable PDFs</small></span></div></section>'+editionPreview()+'<section class="section"><div class="section-heading"><div><p class="eyebrow">Start with a question</p><h2>Explore how the system worked.</h2></div><a class="text-link" href="#/groups">All 13 groups '+icon("arrow","small")+'</a></div><div class="question-grid">'+questions.map((q,i)=>'<a class="question" href="#/group/'+q[0]+'"><span class="question-number">0'+(i+1)+'</span><div class="question-text"><h3>'+q[1]+'</h3><p>'+q[2]+'</p></div>'+icon("arrow","small")+'</a>').join("")+'</div></section><section class="section"><div class="section-heading"><div><p class="eyebrow">Reading paths</p><h2>Follow the paper trail.</h2><p>Three editorial routes through the collection.</p></div><a class="text-link" href="#/chapters">Full chapter index '+icon("arrow","small")+'</a></div><div class="paths-grid">'+pathsData.map(p=>'<article class="path-card"><p class="eyebrow">'+p.k+'</p><h3>'+p.title+'</h3><p>'+p.text+'</p>'+chapterTrail(p.ids)+'</article>').join("")+'</div></section><section class="section feature-source"><a href="#/source/'+H(featured.id)+'"><img src="./'+U(featured.thumbnail||featured.pages[0].image)+'" alt="Scanned original page containing the tavern and contact rules" loading="lazy"></a><div><p class="eyebrow">From summary to evidence</p><h2>Four people at a tavern table.</h2><p>Chapter 126 brings together a table limit, restrictions on visits, and rules for cats and dogs. Read the English analysis, then inspect the original Italian wording.</p><div class="button-row"><a class="button secondary" href="#/chapter/126">Explore chapter 126 '+icon("arrow","small")+'</a><a class="text-link" href="#/source/'+H(featured.id)+'">Open the scan</a></div></div></section><section class="section callout"><strong>A catalogue of documents, not 256 independent interventions.</strong><p>The book has 261 chapters; this atlas follows all 204 chapters of edicts and instructions, with context from the rest of the volume. Repeated orders and later relaxations remain visible. <a href="#/method">How the collection was prepared</a>.</p></section>';
}
function groupsPage(){return '<header class="page-intro"><p class="eyebrow">The response, by function</p><h1>Thirteen ways to explore.</h1><p class="lead">From household reporting to reopening trade, follow the different functions that made up the response. One document can touch several themes.</p><p class="muted" style="font-size:11px">Counts below use each document’s primary category. Related themes are cross-linked on its chapter page.</p></header><div class="group-grid">'+D.groups.map(g=>'<a class="group-card" href="#/group/'+g.id+'"><div class="group-card-top"><span class="group-num">'+String(g.number).padStart(2,"0")+'</span>'+icon("arrow")+'</div><h2>'+H(g.name)+'</h2><p>'+H(g.analysis)+'</p><div class="group-card-bottom"><span>'+g.chapterCount+' document'+(g.chapterCount===1?"":"s")+' filed here</span><span>Explore group</span></div></a>').join("")+'</div>';}
function chapterRow(c){
 const g=groups.get(c.primaryGroup),src=localSources.get(c.id)?.[0],text=editionEntries.get(c.id);
 return '<article class="chapter-row"><a class="chapter-number" href="#/chapter/'+c.id+'">'+c.id+'<span>'+H(c.roman)+'</span></a><div><a class="chapter-row-title" href="#/chapter/'+c.id+'">'+H(c.title)+'</a><p>'+H(c.summary)+'</p><div class="pill-row">'+groupLink(g.id,g.name,"chapter-row-group")+(src?'<a class="badge warm" href="#/source/'+H(src.id)+'">'+icon("file","small")+'Original excerpt</a>':"")+(text?'<a class="badge text-available" href="#/chapter/'+c.id+'?text=1">'+icon("book","small")+(text.scope==="complete-chapter"?"Original + English":"Selected original + English")+'</a>':"")+'</div></div><div class="row-meta">'+chip(c.actionLabel,"outline")+'<div>Printed p. '+H(c.printedPages)+'</div></div>'+bookmark(c,true)+'</article>';
}
function filterChapters(params){
 const q=normalize(params.get("q")||"").trim(),group=params.get("group"),action=params.get("action"),sourceOnly=params.get("source")==="1",editionOnly=params.get("edition")==="1";
 const numeric=/^(?:ch(?:apter)?\.?\s*)?(\d{1,3})$/.exec(q),roman=D.chapters.find(c=>c.roman===q.toUpperCase());
 const tokens=q.match(/"[^"]+"|\S+/g)?.map(s=>s.replace(/^"|"$/g,""))||[];
 return D.chapters.filter(c=>(!q||(numeric?c.id===Number(numeric[1]):roman?c.id===roman.id:tokens.every(t=>searchIndex.get(c.id).includes(t))))&&(!group||c.groupIds.includes(group))&&(!action||c.action===action)&&(!sourceOnly||localSources.has(c.id))&&(!editionOnly||editionEntries.has(c.id)));
}
function cataloguePage(params){
 const actionOptions=[...new Map(D.chapters.map(c=>[c.action,c.actionLabel])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
 return '<header class="page-intro"><p class="eyebrow">The complete operational collection</p><h1>Chapter index.</h1><p class="lead">Search all 204 catalogue entries by subject or chapter number. Open a chapter to see its sources, text availability and review status.</p></header><form id="catalogue-filters" class="catalogue-toolbar" role="search"><div class="field"><label for="catalogue-query">Search the catalogue</label><input id="catalogue-query" name="q" type="search" value="'+H(params.get("q")||"")+'" placeholder="e.g. tavern, compensation, 126" autocomplete="off"></div><div class="field"><label for="group-filter">Theme · includes cross-links</label><select id="group-filter" name="group"><option value="">All themes</option>'+D.groups.map(g=>'<option value="'+g.id+'" '+(params.get("group")===g.id?"selected":"")+'>'+H(g.name)+'</option>').join("")+'</select></div><div class="field"><label for="action-filter">Document action</label><select id="action-filter" name="action"><option value="">All actions</option>'+actionOptions.map(([id,label])=>'<option value="'+H(id)+'" '+(params.get("action")===id?"selected":"")+'>'+H(label)+'</option>').join("")+'</select></div><div class="catalogue-checkboxes"><label class="checkbox-field"><input id="source-filter" type="checkbox" name="source" '+(params.get("source")==="1"?"checked":"")+'>With a local PDF excerpt</label><label class="checkbox-field"><input id="edition-filter" type="checkbox" name="edition" '+(params.get("edition")==="1"?"checked":"")+'>With original text & translation</label></div></form><div class="results-line"><span id="results-label" role="status" aria-live="polite"></span><div class="button-row"><button class="clear-button" data-reset-filters>Reset filters</button><button class="button subtle small" data-export-results>'+icon("download","small")+'CSV</button></div></div><div id="chapter-results"></div>';
}
function updateCatalogue(params=route().params){
 const result=filterChapters(params),box=document.getElementById("chapter-results");if(!box)return;
 document.getElementById("results-label").textContent=result.length+" of 204 document chapters"+(params.get("group")?" · includes related themes":"");
 box.innerHTML=result.length?'<div class="chapter-list">'+result.slice(0,shown).map(chapterRow).join("")+'</div>'+(shown<result.length?'<div class="load-more"><button class="button secondary" data-load-more>Show more documents '+icon("plus","small")+'</button><p class="caption-note" style="margin-top:10px">'+Math.min(shown,result.length)+" of "+result.length+" shown</p></div>":""):'<div class="empty-state"><h2>No matching documents.</h2><p>Try a broader term, remove a filter, or enter a chapter number between 42 and 245.</p><button class="button secondary" data-reset-filters>Show all chapters</button></div>';
}
function groupPage(g){
 const filed=D.chapters.filter(c=>c.primaryGroup===g.id);
 const e=S.excerpts.find(e=>e.chapterIds.some(id=>chapters.get(id)?.groupIds.includes(g.id)));
 return '<header class="page-intro wide"><p class="eyebrow">Intervention group '+String(g.number).padStart(2,"0")+' / 13</p><h1>'+H(g.name)+'.</h1><div class="pill-row">'+chip(filed.length+" primary documents")+'<a class="text-link" href="#/groups">All intervention groups</a></div></header><div class="reading-layout"><div class="reading-main"><h2 class="subheading">Recorded measures</h2><ul class="group-measures">'+g.measures.replace(/\.$/,"").split(";").map(s=>'<li>'+H(s.trim())+'</li>').join("")+'</ul><div class="callout"><strong>How to read these measures</strong><p>'+H(g.analysis)+'</p></div><p class="source-credit" style="margin-top:19px">Primary references: '+H(g.locators)+'.</p></div><aside class="reading-aside">'+(e?'<div class="aside-box"><p class="eyebrow">Primary evidence</p><a href="#/source/'+H(e.id)+'"><img class="source-preview" src="./'+U(e.thumbnail||e.pages[0].image)+'" alt="Original page from '+H(e.title)+'" loading="lazy"></a><h3>'+H(e.title)+'</h3><p>Printed pp. '+H(e.printedPages)+' · '+e.pages.length+' selected pages</p><a class="button secondary small" href="#/source/'+H(e.id)+'">Inspect the excerpt '+icon("arrow","small")+'</a></div>':"")+'<div class="aside-box"><h3>Follow the connections.</h3><p>Documents often cross more than one theme. Broaden the index to include related entries.</p><a class="button secondary small" href="#/chapters?group='+g.id+'">View all thematic matches</a></div></aside></div><section class="section"><div class="group-results-heading"><h2>Documents in this group</h2>'+chip(filed.length+" chapters")+'</div><div class="chapter-list" style="margin-top:21px">'+filed.map(chapterRow).join("")+'</div></section>';
}

function citation(c){return "Gastaldi, Girolamo. Tractatus de avertenda et profliganda peste politico-legalis. Bologna, 1684, ch. "+c.roman+" ("+c.id+"), printed p. "+c.printedPages+". "+c.source.readerUrl;}
function editionStatus(status,layer){
 const labels={"ai-checked":"AI checked against the scan","ai-draft":layer==="translation"?"Working translation":"AI transcription draft","human-reviewed":"Human reviewed"};
 return labels[status]||"Prepared; review status recorded below";
}
function historicalDate(value){
 const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value||"");
 const months=["January","February","March","April","May","June","July","August","September","October","November","December"];
 return m&&months[Number(m[2])-1]?Number(m[3])+" "+months[Number(m[2])-1]+" "+m[1]:String(value||"");
}
function editionScope(entry){return entry.scope==="complete-chapter"?"Complete chapter":"Selected passages";}
function evidenceCoverage(c){
 const entry=editionEntries.get(c.id),local=localSources.has(c.id);
 return '<section class="evidence-coverage" aria-labelledby="evidence-title-'+c.id+'"><div class="evidence-coverage-heading"><h2 id="evidence-title-'+c.id+'">Evidence available for this chapter</h2><a href="#/method">How to read these labels '+icon("arrow","small")+'</a></div><dl class="evidence-grid"><div><dt>Summary</dt><dd>Analytical paraphrase</dd></div><div><dt>Source scan</dt><dd>'+(local?"Local PDF & page images":"Full-volume page link")+'</dd></div><div class="'+(entry?"is-prepared":"is-pending")+'"><dt>Original transcription</dt><dd>'+(entry?H(editionStatus(entry.transcriptionStatus,"transcription")):"Not yet prepared")+'</dd></div><div class="'+(entry?"is-prepared":"is-pending")+'"><dt>English translation</dt><dd>'+(entry?H(editionStatus(entry.translationStatus,"translation")):"Not yet prepared")+'</dd></div></dl>'+(entry?'<p class="evidence-footnote">'+H(editionScope(entry))+' · The transcription and translation have separate review records below.</p>':"")+'</section>';
}
function validEdition(data,entry){
 if(!data||data.schemaVersion!==1||data.chapterId!==entry.chapterId||data.version!==entry.version||!Array.isArray(data.segments)||!data.segments.length)return false;
 if(!data.document||typeof data.document.originalTitle!=="string"||typeof data.document.englishTitle!=="string"||!data.source||data.source.pdfSha256!==S.source.sha256)return false;
 if(!data.coverage||data.coverage.scope!==entry.scope||!Array.isArray(data.source.scanPages)||!data.source.scanPages.length)return false;
 const knownPages=new Set(data.source.scanPages);
 if([...knownPages].some(n=>!Number.isInteger(n)||n<1||n>(S.source.scanPageCount||997)))return false;
 const safeID=v=>typeof v==="string"&&/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(v);
 const notes=Array.isArray(data.notes)?data.notes:[];
 if(!notes.every(n=>safeID(n.id)&&typeof n.text==="string")||new Set(notes.map(n=>n.id)).size!==notes.length)return false;
 const noteIDs=new Set(notes.map(n=>n.id));
 const ids=new Set();
 for(const segment of data.segments){
  if(!safeID(segment.id)||ids.has(segment.id)||typeof segment.original!=="string"||!segment.original.trim()||typeof segment.english!=="string"||!segment.english.trim()||typeof segment.label!=="string")return false;
  if(!Array.isArray(segment.sourcePages)||!segment.sourcePages.length||!segment.sourcePages.every(n=>knownPages.has(n)))return false;
  if(segment.noteIds!==undefined&&(!Array.isArray(segment.noteIds)||!segment.noteIds.every(id=>noteIDs.has(id))))return false;
  ids.add(segment.id);
 }
 return true;
}
function activeEditionChapter(id){const r=route();return r.parts[0]==="chapter"&&Number(r.parts[1])===id;}
function editionPassageURL(id,passage){return "#/chapter/"+id+"?passage="+encodeURIComponent(passage);}
function sourceForPassage(c,edition,scanPage,passage){
 const preferred=excerpts.get(edition.source.excerptId);
 const excerpt=preferred?.pages.some(p=>p.scanPage===scanPage)?preferred:(localSources.get(c.id)||[]).find(e=>e.pages.some(p=>p.scanPage===scanPage));
 if(excerpt){
  const index=excerpt.pages.findIndex(p=>p.scanPage===scanPage);
  return {href:"#/source/"+encodeURIComponent(excerpt.id)+"?page="+(index+1)+"&chapter="+c.id+"&passage="+encodeURIComponent(passage),label:"View scan · p. "+excerpt.pages[index].printedPage,printedPage:String(excerpt.pages[index].printedPage),local:true};
 }
 return {href:"https://archive.org/details/"+encodeURIComponent(edition.source.archiveId)+"/page/n"+(scanPage-1)+"/mode/1up",label:"View scan "+scanPage,printedPage:null,local:false};
}
function translationCitation(c,edition,segment){
 const source=S.source,parts=segment?[segment]:edition.segments;
 const scans=[...new Set(parts.flatMap(p=>p.sourcePages))];
 const printed=[...new Set(scans.map(n=>sourceForPassage(c,edition,n,segment?.id||parts[0].id).printedPage).filter(Boolean))];
 const locator=printed.length?"printed p"+(printed.length===1?". ":"p. ")+printed.join(", "):"printed pp. "+edition.source.printedPages;
 const versionDate=(edition.review?.events||[]).at(-1)?.date;
 const status=edition.review?.translation?.status==="human-reviewed"?"English translation":"English working translation";
 const address=location.href.split("#")[0]+(segment?editionPassageURL(c.id,segment.id):"#/chapter/"+c.id);
 return 'The Plague Response Atlas, "'+edition.document.englishTitle+'", chapter '+c.id+(segment?", "+segment.label+" ["+segment.id+"]":"")+", "+status+", version "+edition.version+(versionDate?" ("+versionDate+")":"")+". Source: "+source.author+", "+source.title+" ("+source.place+", "+source.year+"), ch. "+c.roman+", "+locator+"; PDF scan "+(scans.length===1?"page ":"pages ")+scans.join(", ")+". "+address;
}
function editionRelations(data){
 const relations=(data.relations||[]).filter(r=>chapters.has(r.chapterId)&&r.chapterId!==data.chapterId);
 return relations.length?'<nav class="document-relations" aria-label="Document relationships"><p class="eyebrow">Document relationships</p>'+relations.map(r=>'<a href="#/chapter/'+r.chapterId+'"><span>Chapter '+r.chapterId+'</span><strong>'+H(r.label||chapters.get(r.chapterId).title)+'</strong>'+icon("arrow","small")+'</a>').join("")+'</nav>':"";
}
function renderEditionPassage(c,edition,segment,selected){
 const language=/^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(segment.language||"")?segment.language:"und";
 const languageLabel={it:"Italian",la:"Latin",en:"English"}[language]||"Original-language";
 const notes=(segment.noteIds||[]).map(id=>(edition.notes||[]).find(n=>n.id===id)).filter(Boolean);
 const link=editionPassageURL(c.id,segment.id);
 // Source links are either generated internal routes or a known HTTPS reader URL.
 const sourceLinks=segment.sourcePages.map(n=>{
  const source=sourceForPassage(c,edition,n,segment.id);
  return '<a class="passage-source-link" href="'+H(source.href)+'"'+(source.local?"":' target="_blank" rel="noopener noreferrer"')+'>'+icon("file","small")+H(source.label)+'</a>';
 }).join("");
 return '<section class="edition-passage '+(selected===segment.id?"is-target":"")+'" id="passage-'+c.id+'-'+H(segment.id)+'" tabindex="-1" aria-labelledby="label-'+c.id+'-'+H(segment.id)+'"><div class="passage-heading"><h3 id="label-'+c.id+'-'+H(segment.id)+'">'+H(segment.label)+'</h3><a class="passage-permalink" href="'+H(link)+'" aria-label="Link to '+H(segment.label)+'">Link to passage '+icon("external","small")+'</a></div><div class="parallel-text"><div class="passage-original"><p class="text-layer-label">'+H(languageLabel)+' transcription</p><p class="edition-text" lang="'+H(language)+'">'+H(segment.original)+'</p></div><div class="passage-english"><p class="text-layer-label">'+(edition.review?.translation?.status==="human-reviewed"?"English translation":"English working translation")+'</p><p class="edition-text" lang="en">'+H(segment.english)+'</p></div></div><div class="passage-tools"><div class="passage-sources">'+sourceLinks+'</div><button class="clear-button" data-edition-cite="'+c.id+'" data-passage="'+H(segment.id)+'" aria-label="Copy translation citation for '+H(segment.label)+'">'+icon("copy","small")+'Copy citation</button></div><details class="passage-notes"><summary>'+(notes.length?notes.length+" editorial note"+(notes.length===1?"":"s")+" & citation":"Passage citation")+'</summary>'+(notes.length?'<ul>'+notes.map(n=>'<li><strong>'+H(n.type==="transcription"?"Reading note":n.type==="translation"?"Translation note":"Context note")+'.</strong> '+H(n.text)+'</li>').join("")+'</ul>':"")+'<p class="source-credit">'+H(translationCitation(c,edition,segment))+'</p></details></section>';
}
function editionContent(c,entry,data,params){
 const selected=params.get("passage")||"",found=!selected||data.segments.some(s=>s.id===selected);
 const originalStatus=data.review?.transcription?.description||editionStatus(entry.transcriptionStatus,"transcription");
 const translationStatus=data.review?.translation?.description||editionStatus(entry.translationStatus,"translation");
 const humanStatus=data.review?.humanReview?.status==="complete"?"Human specialist review is recorded below.":"Independent human specialist review is pending.";
 const languageNames=[...new Set(data.segments.map(s=>({it:"Italian",la:"Latin",en:"English"}[s.language]||"Original-language")))].join(" / ");
 return '<div class="edition-heading"><div><p class="eyebrow">Source text & translation</p><h2 id="document-title-'+c.id+'">Read the document.</h2><p class="edition-subtitle">'+H(data.document.englishTitle)+'</p></div><span class="badge outline">'+H(editionScope(entry))+'</span></div><div class="edition-document-meta">'+(data.document.date?'<span><strong>Document date</strong> <time datetime="'+H(data.document.date)+'">'+H(historicalDate(data.document.date))+'</time></span>':"")+(data.document.place?'<span><strong>Place</strong> '+H(data.document.place)+'</span>':"")+'<span><strong>Edition</strong> Gastaldi, 1684</span><span><strong>Translation version</strong> '+H(data.version)+'</span></div><div class="edition-review" aria-label="Text review status"><div><strong>Transcription</strong><p>'+H(originalStatus)+'</p></div><div><strong>Translation</strong><p>'+H(translationStatus)+'</p></div><p class="review-human">'+H(humanStatus)+'</p></div><p class="edition-boundary"><strong>Source boundaries.</strong> '+H(data.coverage.boundaryNote||"See the cited pages for the text included in this edition.")+'</p>'+editionRelations(data)+'<div class="edition-toolbar"><div class="view-tabs" role="group" aria-label="Document text display">'+[["both","Both texts"],["original","Original"],["english","English"]].map(([value,label])=>'<button data-edition-view="'+value+'" class="'+(editionView===value?"active":"")+'" aria-pressed="'+(editionView===value)+'">'+label+'</button>').join("")+'</div><div class="edition-jump"><label for="edition-jump-'+c.id+'">Go to passage</label><select id="edition-jump-'+c.id+'" data-edition-jump="'+c.id+'"><option value="">Choose a passage</option>'+data.segments.map(s=>'<option value="'+H(s.id)+'" '+(selected===s.id?"selected":"")+'>'+H(s.label)+'</option>').join("")+'</select></div></div>'+(!found?'<p class="callout edition-not-found" role="status">That passage is not in this edition. Choose one from the passage menu.</p>':"")+'<p class="edition-reading-note">'+H(languageNames)+' text as printed in the 1684 volume, paired with an English translation. Passage labels follow the editorial policy below.</p><div class="edition-passages" data-edition-view="'+editionView+'">'+data.segments.map(s=>renderEditionPassage(c,data,s,selected)).join("")+'</div><details class="edition-editorial"><summary>Editorial policy, notes & revision history</summary><div class="editorial-policy-grid"><div><h3>Transcription policy</h3><p>'+H(data.transcriptionPolicy||"See the edition record.")+'</p></div><div><h3>Passage divisions</h3><p>'+H(data.paragraphPolicy||"Passage labels are editorial unless stated otherwise.")+'</p></div></div>'+((data.notes||[]).length?'<h3>Editorial notes</h3><ol class="editorial-notes">'+data.notes.map(n=>'<li><span>'+H(n.type||"note")+'</span> '+H(n.text)+'</li>').join("")+'</ol>':"")+'<h3>Revision history</h3><ul class="edition-history">'+(data.review?.events||[]).map(event=>'<li><time>'+H(event.date)+'</time><strong>'+H(event.actor)+'</strong><span>'+H(event.action)+'</span></li>').join("")+'</ul><p class="source-credit">Source PDF SHA-256: <code>'+H(data.source.pdfSha256)+'</code></p></details><div class="edition-downloads"><a class="button secondary small" href="./'+U(entry.path)+'" download>'+icon("download","small")+'Download text & translation</a><button class="button secondary small" data-edition-cite="'+c.id+'">'+icon("copy","small")+'Copy edition citation</button></div><details class="detail-note edition-full-citation"><summary>Edition citation</summary><p class="source-credit">'+H(translationCitation(c,data))+'</p></details>';
}
function editionSection(c,params){
 const entry=editionEntries.get(c.id);
 if(!entry)return '<section class="document-pending" aria-labelledby="document-pending-'+c.id+'"><div><p class="eyebrow">Original text & English translation</p><h2 id="document-pending-'+c.id+'">Text preparation is still to come.</h2><p>This chapter currently has an analytical summary'+(localSources.has(c.id)?" and a local facsimile":" and a link to the original scan")+'. A transcription and English translation have not yet been prepared.</p></div><a class="text-link" href="#/chapters?edition=1">Explore chapters with paired text '+icon("arrow","small")+'</a></section>';
 const state=editionCache.get(c.id);
 const content=state?.status==="ready"?editionContent(c,entry,state.data,params):state?.status==="error"?'<div class="edition-loading" role="status"><p class="eyebrow">Source text & translation</p><h2 id="document-title-'+c.id+'">The document text could not load.</h2><p>Retry to load the transcription and English translation. The original scan is still available from the source links above.</p><button class="button secondary" data-edition-retry="'+c.id+'">Try again '+icon("arrow","small")+'</button></div>':'<div class="edition-loading" role="status"><p class="eyebrow">Source text & translation</p><h2 id="document-title-'+c.id+'">Loading the document…</h2><p>Preparing the original text and its English working translation.</p></div>';
 return '<section id="document-edition-'+c.id+'" class="document-edition" tabindex="-1" aria-labelledby="document-title-'+c.id+'" aria-busy="'+(!state||state.status==="loading")+'">'+content+'</section>';
}
function focusEditionPassage(id){
 const data=editionCache.get(id)?.data,params=route().params,requested=params.get("passage");
 const known=requested&&data?.segments.some(s=>s.id===requested);
 if(!known&&!(params.get("text")==="1"&&!requested))return;
 const target=document.getElementById(known?"passage-"+id+"-"+requested:"document-edition-"+id);
 if(target){target.scrollIntoView({block:"start",behavior:"auto"});target.focus({preventScroll:true});}
}
function paintEdition(id,focusPassage=false){
 if(!activeEditionChapter(id))return;
 const box=document.getElementById("document-edition-"+id),state=editionCache.get(id),entry=editionEntries.get(id),c=chapters.get(id);
 if(!box||!entry||!c)return;
 if(state?.status==="ready"){
  box.innerHTML=editionContent(c,entry,state.data,route().params);box.setAttribute("aria-busy","false");
  if(focusPassage)focusEditionPassage(id);
 }else if(state?.status==="error"){
  box.innerHTML='<div class="edition-loading" role="status"><p class="eyebrow">Source text & translation</p><h2 id="document-title-'+id+'">The document text could not load.</h2><p>Retry to load the transcription and English translation. You can still inspect the original scan.</p><button class="button secondary" data-edition-retry="'+id+'">Try again '+icon("arrow","small")+'</button></div>';box.setAttribute("aria-busy","false");
 }
}
function loadEdition(id,force=false){
 const entry=editionEntries.get(id);
 if(!entry)return;
 const existing=editionCache.get(id);
 if(!force&&existing)return existing.promise;
 const state={status:"loading",data:null,promise:null};
 editionCache.set(id,state);
 state.promise=Promise.resolve().then(()=>fetch("./"+entry.path,{cache:"no-cache"})).then(response=>{
  if(!response.ok)throw new Error("Document request failed");
  return response.json();
 }).then(data=>{
  if(!validEdition(data,entry))throw new Error("Document content does not match the edition record");
  if(editionCache.get(id)!==state)return;
  state.status="ready";state.data=data;paintEdition(id,true);
 }).catch(()=>{
  if(editionCache.get(id)!==state)return;
  state.status="error";paintEdition(id,false);
 });
 return state.promise;
}
function chapterPage(c,params=new URLSearchParams()){
 const g=groups.get(c.primaryGroup),local=localSources.get(c.id)||[],s=local[0],prev=chapters.get(c.id-1),next=chapters.get(c.id+1),entry=editionEntries.get(c.id);
 const provisions=c.provisionKind==="expanded"||c.provisions.length>1?'<ol class="provision-list">'+c.provisions.map(p=>'<li>'+H(p)+'</li>').join("")+'</ol>':"";
 const outline=provisions?(entry?'<details class="analytical-outline"><summary>Analytical outline · '+c.provisions.length+' points</summary>'+provisions+'</details>':'<h2 class="subheading">What the document prescribes</h2>'+provisions):"";
 const scope=entry?.scope==="complete-chapter"?"The local facsimile includes this complete chapter. See the boundary note below for adjoining text on the same pages.":"A selected passage is available here as page images and a downloadable PDF. It may cover only part of this chapter.";
 return '<header class="chapter-head"><p class="eyebrow">Document '+c.id+' / '+H(c.roman)+' · Modern catalogue title</p><div class="pill-row">'+groupLink(g.id,g.name)+chip(c.actionLabel,"warm")+'</div><h1>'+H(c.title)+'.</h1><div class="chapter-meta"><span>Printed p. '+H(c.printedPages)+'</span><span>Original scan page '+H(c.source.pdfPage)+'</span>'+(entry?.documentDate?'<span>Document dated '+H(historicalDate(entry.documentDate))+'</span>':"")+'</div>'+(entry?'<div class="chapter-text-link"><a class="button secondary small" data-document-start href="#/chapter/'+c.id+'?text=1">'+icon("book","small")+'Read original text & English '+icon("arrow","small")+'</a></div>':"")+'</header>'+evidenceCoverage(c)+'<div class="reading-layout chapter-overview"><article class="reading-main"><p class="eyebrow">English analytical summary</p><p class="chapter-summary">'+H(c.summary)+'</p>'+outline+'<div class="callout"><strong>Read as a prescription.</strong><p>This entry records what the text orders or reports. It does not, by itself, establish compliance or the effectiveness of each measure. <a href="#/method">About the evidence</a>.</p></div></article><aside class="reading-aside"><div class="aside-box"><p class="eyebrow">The primary source</p>'+(s?'<a href="#/source/'+H(s.id)+'"><img class="source-preview" src="./'+U(s.thumbnail||s.pages[0].image)+'" alt="Scanned page from '+H(s.title)+'"></a><h3>Read the original.</h3><p>'+scope+'</p><a class="button" href="#/source/'+H(s.id)+'">'+icon("file","small")+'Open the facsimile</a>':'<h3>Read the original.</h3><p>The complete volume is linked directly to this chapter’s opening page. This entry has no locally hosted excerpt.</p>')+external(c.source.readerUrl,"Full-volume page","button secondary small")+external(c.source.pdfUrl,"Complete PDF at this page","button secondary small")+'<p class="source-caption" style="margin:13px 0 0">Gastaldi, Bologna, 1684.<br>Printed p. '+H(c.printedPages)+' ≠ PDF scan position.</p></div></aside></div>'+editionSection(c,params)+'<div class="reading-layout chapter-follow-up"><article class="reading-main"><section><p class="eyebrow">Connected themes</p><div class="tag-row">'+c.groupIds.map(id=>groupLink(id)).join("")+'</div>'+(c.tags.length?'<p class="caption-note" style="margin-top:14px">Also indexed under: '+H(c.tags.join(", "))+'</p>':"")+'</section><details class="detail-note"><summary>Source citation & preparation notes</summary><p class="source-credit" id="citation-'+c.id+'">'+H(citation(c))+'</p><p>'+H(c.verificationNote)+'</p><p>'+H(c.source.mappingNote||"Printed pages and physical PDF positions are recorded separately.")+'</p></details><section class="section"><h2 class="subheading">Continue reading</h2><p class="caption-note">These links suggest related themes. Document relationships are identified separately with the text above.</p><div class="related-grid">'+c.related.slice(0,4).map(id=>{const r=chapters.get(id);return r?'<a class="related-card" href="#/chapter/'+r.id+'"><small>Chapter '+r.id+' · '+H(r.actionLabel)+'</small><span>'+H(r.title)+'</span></a>':"";}).join("")+'</div></section><nav class="pager" aria-label="Adjacent documents"><div>'+(prev?'<a href="#/chapter/'+prev.id+'"><small>← Previous chapter</small>'+prev.id+' · '+H(prev.title)+'</a>':"")+'</div><div>'+(next?'<a href="#/chapter/'+next.id+'"><small>Next chapter →</small>'+next.id+' · '+H(next.title)+'</a>':"")+'</div></nav></article><aside class="reading-aside"><div class="aside-box"><h3>Keep a reference.</h3>'+bookmark(c)+'<button class="button secondary small" data-cite="'+c.id+'">'+icon("copy","small")+'Copy source citation</button><a class="button secondary small" href="#/reading-list">Open your reading list</a></div></aside></div>';
}
function sourcesPage(){return '<header class="page-intro"><p class="eyebrow">Evidence, close at hand</p><h1>Open the original pages.</h1><p class="lead">'+S.excerpts.length+' selected source excerpts from the 1684 volume. Read the scan, move between pages, or download an exact PDF excerpt. English explanations are labelled paraphrases.</p><div class="button-row">'+external(D.meta.sourceUrl,"Browse the full volume","button secondary")+external(D.meta.sourcePdfUrl,"Complete original PDF","button subtle")+'</div></header><div class="callout" style="margin-bottom:29px"><strong>Two page numbers, one source.</strong><p>Printed pagination differs from the scan’s page position. Both are shown so a reference can be checked. The PDF excerpts preserve complete original pages.</p></div><div class="source-grid">'+S.excerpts.map(sourceCard).join("")+'</div><p class="caption-note" style="margin-top:26px">'+H(S.source.rightsNote)+'</p>';}
function sourceTextLinks(e,params){
 const requestedChapter=Number(params.get("chapter")),passage=params.get("passage")||"";
 const available=(e.chapterIds||[]).filter(id=>editionEntries.has(id));
 if(!available.length)return "";
 const links=available.map(id=>{
  const returning=id===requestedChapter&&/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(passage);
  const href=returning?editionPassageURL(id,passage):"#/chapter/"+id+"?text=1";
  return '<a class="button secondary small" href="'+H(href)+'">'+icon(returning?"left":"book","small")+(returning?"Return to the passage":"Chapter "+id+" · Original text & English")+'</a>';
 }).join("");
 return '<div class="source-text-links">'+links+'</div>';
}
function sourcePage(e,params){
 const n=Math.min(e.pages.length,Math.max(1,Math.floor(Number(params.get("page"))||1))),p=e.pages[n-1];
 const url=p.readerUrl||"https://archive.org/details/"+D.meta.sourceArchiveId+"/page/n"+(p.scanPage-1)+"/mode/1up";
 return '<header class="page-intro wide"><p class="eyebrow">Primary-source facsimile · '+H(S.source.year)+'</p><h1 style="font-size:clamp(32px,3.6vw,49px)">'+H(e.title)+'.</h1><p class="lead">'+H(e.description)+'</p><div class="pill-row">'+chip("Printed pp. "+e.printedPages,"warm")+chip(e.pages.length+" original page"+(e.pages.length===1?"":"s"),"outline")+'<a class="text-link" href="#/sources">All excerpts '+icon("arrow","small")+'</a></div>'+sourceTextLinks(e,params)+'</header><div class="source-reading-layout"><div><div class="source-toolbar"><div class="page-controls"><button class="icon-button" data-source-page="'+(n-1)+'" '+(n===1?"disabled":"")+' aria-label="Previous scanned page">'+icon("left","small")+'</button><span>Page <strong>'+n+'</strong> of '+e.pages.length+'</span><button class="icon-button" data-source-page="'+(n+1)+'" '+(n===e.pages.length?"disabled":"")+' aria-label="Next scanned page">'+icon("chevron","small")+'</button></div><div class="button-row"><div class="view-tabs" role="group" aria-label="Source display"><button data-source-view="scan" class="'+(sourceView==="scan"?"active":"")+'" aria-pressed="'+(sourceView==="scan")+'">Page scan</button><button data-source-view="pdf" class="'+(sourceView==="pdf"?"active":"")+'" aria-pressed="'+(sourceView==="pdf")+'">PDF</button></div><button class="icon-button" data-zoom="out" aria-label="Zoom out" '+(zoom<=.75?"disabled":"")+'>'+icon("minus","small")+'</button><button class="icon-button" data-zoom="in" aria-label="Zoom in" '+(zoom>=2?"disabled":"")+'>'+icon("plus","small")+'</button></div></div><div class="scan-stage" id="scan-stage" tabindex="0" aria-label="Original page reader. Use the page controls above to move through the excerpt.">'+(sourceView==="pdf"?'<iframe title="PDF excerpt: '+H(e.title)+'" src="./'+U(e.pdf)+'#page='+n+'"></iframe>':'<img id="original-scan" src="./'+U(p.image)+'" alt="Original '+(e.id==="trastevere-cordon"?"engraving":"printed page")+' '+H(p.printedPage)+' from Gastaldi’s 1684 treatise; physical scan page '+p.scanPage+'" style="width:'+Math.round(zoom*100)+'%">')+'</div><div class="scan-source-line"><span>Printed p. '+H(p.printedPage)+' · Full-volume scan '+p.scanPage+'</span>'+external(url,"This page in the full volume")+'</div>'+(sourceView==="pdf"?'<p class="caption-note">If your browser cannot display the PDF, choose Page scan or open the PDF in a new tab.</p>':"")+'</div><aside class="source-sidebar reading-aside"><div class="aside-box"><p class="eyebrow">Reading the passage</p><h3>What to look for.</h3><p>'+H(e.readingGuide||e.description)+'</p><p class="caption-note">'+H(e.notes||"The explanation is an analytical paraphrase, not a line-by-line translation.")+'</p><a class="button" href="./'+U(e.pdf)+'" download>'+icon("download","small")+'Download PDF</a><a class="button secondary small" href="./'+U(e.pdf)+'#page='+n+'" target="_blank" rel="noopener noreferrer">Open PDF in a new tab '+icon("external","small")+'</a></div><div class="aside-box"><p class="eyebrow">Related document pages</p>'+e.chapterIds.map(id=>chapters.has(id)?'<p><a href="#/chapter/'+id+'"><strong>Chapter '+id+'</strong><br>'+H(chapters.get(id).title)+'</a></p>':'<p>Chapter '+id+' belongs to the book’s plans and descriptions, outside the 204-document operational collection.</p>').join("")+'<div class="document-source-link"><strong>Source</strong><p>'+H(S.source.author)+', <em>'+H(S.source.title)+'</em>, '+H(S.source.place)+', '+S.source.year+'.</p></div></div></aside></div>';
}
function contextPage(){return '<header class="page-intro"><p class="eyebrow">Reading beyond the operational documents</p><h1>The rest of the treatise.</h1><p class="lead">Gastaldi surrounds the orders with narrative, plans, medical discussion and general counsel. These passages give context; a recommendation’s presence in the book does not prove that Rome implemented it.</p></header><div class="callout warm" style="margin-bottom:30px"><strong>Keep the evidence categories distinct.</strong><p>Roman orders, retrospective narrative, general advice and historical allegations have different evidential status. Clinical remedies and causal theories do not become additional nonpharmaceutical interventions merely by being discussed.</p></div><div class="supplement-list">'+D.supplements.map(s=>'<article class="supplement" id="'+H(s.id)+'"><div class="pill-row">'+chip(s.status,"warm")+'<span class="caption-note">Chs. '+H(s.chapters)+' · Printed pp. '+H(s.pages)+'</span></div><h3>'+H(s.title)+'</h3><p>'+H(s.summary)+'</p><p>'+H(s.note)+'</p></article>').join("")+'</div>';}
function corpusCoverage(){
 const entries=[...editionEntries.values()],localCount=D.chapters.filter(c=>localSources.has(c.id)).length;
 const complete=entries.filter(e=>e.scope==="complete-chapter").length;
 const reviewed=entries.filter(e=>e.humanReviewStatus==="complete"||(e.transcriptionStatus==="human-reviewed"&&e.translationStatus==="human-reviewed")).length;
 return '<section class="method-section corpus-coverage"><p class="eyebrow">Text coverage</p><h2>A catalogue growing into an edition.</h2><p>The catalogue and the documentary texts have different levels of coverage. Each chapter identifies which layers are available.</p><dl class="coverage-numbers"><div><dt>Catalogue summaries</dt><dd>'+D.chapters.length+'</dd></div><div><dt>Chapters with local facsimiles</dt><dd>'+localCount+'</dd></div><div><dt>Original text + English</dt><dd>'+entries.length+'</dd></div><div><dt>Human specialist review complete</dt><dd>'+reviewed+'</dd></div></dl><p class="caption-note">'+complete+' complete chapter'+(complete===1?"":"s")+' with paired text'+(entries.length>complete?"; "+(entries.length-complete)+" with selected passages":"")+'. Local facsimile coverage can consist of selected pages rather than the whole chapter.</p><a class="button secondary small" href="#/chapters?edition=1">Explore the paired texts '+icon("arrow","small")+'</a></section>';
}
function editionPreview(){
 const entries=[...editionEntries.values()];
 if(!entries.length)return "";
 return '<section class="edition-feature"><div class="section-heading"><div><p class="eyebrow">Read the words behind the summary</p><h2>Original text. English translation.</h2><p>Compare matched passages with their scanned pages. Every text carries its coverage and review status.</p></div><a class="text-link" href="#/chapters?edition=1">All '+entries.length+' text editions '+icon("arrow","small")+'</a></div><div class="edition-feature-links">'+entries.slice(0,3).map(entry=>'<a href="#/chapter/'+entry.chapterId+'?text=1"><small>Chapter '+entry.chapterId+' · '+H(editionScope(entry))+'</small><span>'+H(chapters.get(entry.chapterId).title)+'</span>'+icon("arrow","small")+'</a>').join("")+'</div></section>';
}
function methodPage(){return '<header class="page-intro"><p class="eyebrow">Scope, provenance and limits</p><h1>A guide to the evidence.</h1><p class="lead">This is an interpretive research catalogue anchored to the original volume. It is designed to make claims easy to follow back to their source—and the limits of those claims easy to see.</p></header>'+corpusCoverage()+'<div class="method-grid"><div><section class="method-section"><h2>What is counted?</h2><p>The book has <strong>261 chapters</strong>. Its core documentary collection contains <strong>204 chapters</strong>: 186 edict/order chapters (42–227) and 18 operational instruction chapters (228–245).</p><p>One chapter may contain many rules. Another may renew an earlier restriction, add a town, grant an exception or announce reopening. The catalogue counts documents and does <strong>not</strong> claim 256 independent interventions.</p><p>Thirteen groups organize the documents by function. The primary counts sum to 204; thematic cross-links overlap.</p></section><section class="method-section"><h2>From scan to chapter page.</h2><p>The catalogue summaries and analytical outlines are paraphrases. Original-language transcriptions and English translations form a separate layer, with their own completeness and review status.</p><p>Original pages were read through the scan and its OCR, with image checks for gaps and uncertain readings. References distinguish printed pages from physical PDF positions, including duplicated scans. The selected PDF excerpts retain complete page content and OCR.</p><p>The catalogue titles and thematic reading suggestions are editorial aids. Explicit references and later clarifications are identified separately as document relationships. Shared themes alone do not establish historical chronology or causation.</p></section><section class="method-section"><h2>Read the editorial record.</h2><p>Each text edition states its transcription policy, source boundaries, passage divisions and translation version. Uncertain readings and interpretive choices belong in visible notes. The facsimile preserves the historical page; the text panels are editorial work.</p><p><strong>AI checked against the scan</strong> describes an AI comparison with the page image. <strong>Working translation</strong> identifies English text awaiting specialist review. Human review is recorded separately, with responsibility and revision dates.</p><p>Automated checks validate data structure, identifiers and links. They do not certify transcription or translation accuracy. Citations for English wording identify this atlas, the translation version and the passage as well as Gastaldi’s printed page.</p></section><section class="method-section"><h2>Prescription is not an outcome.</h2><p>A decree establishes what authorities prescribed. It does not alone establish uniform enforcement, compliance, or an intervention’s causal effect. A threatened penalty is not evidence that every offender received it.</p><p>The response combined separation and provisioning with contemporary beliefs about air, objects, diet and spiritual protection. It also included discriminatory exclusions and coercive practices. These are described as historical measures, without endorsing their premises.</p><p>For a Rome–Naples comparison, compare timing, reach, resources and implementation. This catalogue principally documents Rome; it is not a matched dataset of outcomes in the two cities.</p></section></div><aside><div class="book-map"><div class="book-map-row"><strong>I–XIII</strong><span>Narrative and account of the response</span></div><div class="book-map-row"><strong>XIV–XL</strong><span>Plans, facilities and physical arrangements</span></div><div class="book-map-row"><strong>XLI</strong><span>Introduction to the documentary collection</span></div><div class="book-map-row active"><strong>XLII–CCXLV</strong><span><strong style="font:inherit;font-weight:700">204 chapters explored here</strong><br>Edicts, orders and operational instructions</span></div><div class="book-map-row"><strong>CCXLVI–CCLXI</strong><span>General, medical and theoretical discussion</span></div></div><div class="aside-box" style="margin-top:23px"><p class="eyebrow">Primary edition</p><h3>Gastaldi, 1684.</h3><p>Girolamo Gastaldi, <em>Tractatus de avertenda et profliganda peste politico-legalis</em>. Bologna, 1684.</p><p>The historical response concerns 1656–1657. The collected follow-up orders continue through 1 March 1658.</p>'+external(D.meta.sourceUrl,"Internet Archive reader","button secondary small")+external(D.meta.sourcePdfUrl,"Complete digitized PDF","button secondary small")+external("https://books.google.com/books?id=dPUHQlrUZWEC","User-referenced Google Books copy","button secondary small")+'</div><div class="aside-box"><h3>Modern interpretation.</h3><p>Modern plague transmission includes infected fleas, contact with infected tissues or fluids, and respiratory transmission in pneumonic cases. Resemblance to a modern precaution is not evidence that every historical procedure worked.</p>'+external("https://www.who.int/news-room/fact-sheets/detail/plague","WHO: Plague")+'</div></aside></div><section class="method-section"><h2>Use and extend the collection.</h2><p>Download the complete catalogue, source manifest or workbook. Corrections should identify the chapter, printed page and physical scan page, with a reason for the change.</p><div class="data-downloads"><a class="button secondary" href="./downloads/Gastaldi_1684_interventions.xlsx" download>'+icon("download","small")+'Workbook</a><a class="button secondary" href="./data/catalogue.json" download>'+icon("download","small")+'Catalogue JSON</a><a class="button secondary" href="./data/excerpts.json" download>'+icon("download","small")+'Source manifest</a><a class="button secondary" href="./data/editions/index.json" download>'+icon("download","small")+'Text edition index</a>'+external(REPO,"Repository","button secondary")+'</div><p class="caption-note">Original 1684 text and engravings; digital facsimiles from the Internet Archive copy. Scan marks are retained. See the repository’s SOURCES.md for provenance and contribution guidance.</p></section>';}
function glossaryPage(){return '<header class="page-intro"><p class="eyebrow">Terms in context</p><h1>A small working glossary.</h1><p class="lead">Historical terms can hide different institutions and obligations. These definitions help you read the catalogue; follow the chapter links for their particular use.</p></header><div class="glossary-grid">'+D.glossary.map(g=>'<article class="glossary-entry" id="term-'+H(g.term.toLowerCase().replace(/[^a-z0-9]+/g,"-"))+'"><h2>'+H(g.term)+'</h2><p>'+H(g.definition)+'</p>'+chapterTrail(g.chapters)+'</article>').join("")+'</div>';}
function readingPage(){
 const list=[...saved].map(id=>chapters.get(id)).filter(Boolean);
 return '<header class="page-intro wide"><p class="eyebrow">Your research</p><h1>Reading list.</h1><p class="lead">Keep chapters together as you explore. This list is stored in this browser; it is not an account or a shared collection.</p>'+(!storageOK?'<p class="callout warm">Browser storage is unavailable. Your list will last for this visit; export it to keep a copy.</p>':"")+(list.length?'<div class="button-row"><button class="button secondary" data-export-list>'+icon("download","small")+'Export reading list</button><button class="button subtle" data-copy-list>'+icon("copy","small")+'Copy citations</button></div>':"")+'</header>'+(list.length?'<div class="results-line"><span>'+list.length+' saved chapter'+(list.length===1?"":"s")+'</span><a class="text-link" href="#/chapters">Find more documents '+icon("arrow","small")+'</a></div><div class="chapter-list">'+list.map(chapterRow).join("")+'</div>':'<div class="empty-state"><h2>Your next reading path starts here.</h2><p>Use the bookmark beside a chapter to save it. The catalogue and themed groups are good places to begin.</p><a class="button" href="#/chapters">Explore the chapter index '+icon("arrow","small")+'</a></div>');
}
function notFound(){return '<section class="empty-state"><p class="eyebrow">This page is not in the collection</p><h1>Let’s return to the index.</h1><p>The operational catalogue covers chapters 42–245. Other parts of the book are introduced under Beyond the edicts and Primary sources.</p><div class="button-row" style="justify-content:center"><a class="button" href="#/chapters">Chapter index</a><a class="button secondary" href="#/context">Beyond the edicts</a></div></section>';}


let lastPath="";
function render(options={}){
 clearTimeout(searchTimer);
 const r=route(),p=r.parts,type=p[0]||"",oldY=window.scrollY,path=p.join("/");
 if(path!==lastPath){sourceView="scan";zoom=1;shown=24;}
 lastPath=path;
 let body,section="Overview",active="overview",title="The Plague Response Atlas";
 if(!type){body=home();}
 else if(type==="groups"){body=groupsPage();section="Intervention groups";active="groups";title="Intervention groups";}
 else if(type==="group"&&groups.has(p[1])){const g=groups.get(p[1]);body=groupPage(g);section="Intervention groups";active="groups";title=g.name;}
 else if(type==="chapters"){body=cataloguePage(r.params);section="Chapter index";active="chapters";title="Chapter index";}
 else if(type==="chapter"&&chapters.has(Number(p[1]))){const c=chapters.get(Number(p[1]));body=chapterPage(c,r.params);section="Chapter "+c.id;active="chapters";title="Chapter "+c.id+" · "+c.title;}
 else if(type==="sources"){body=sourcesPage();section="Primary sources";active="sources";title="Primary sources";}
 else if(type==="source"&&excerpts.has(p[1])){const e=excerpts.get(p[1]);body=sourcePage(e,r.params);section="Primary sources";active="sources";title=e.title;}
 else if(type==="context"){body=contextPage();section="Beyond the edicts";active="context";title="Beyond the edicts";}
 else if(type==="method"){body=methodPage();section="Sources & method";active="method";title="Sources & method";}
 else if(type==="glossary"){body=glossaryPage();section="Glossary";active="glossary";title="Glossary";}
 else if(type==="reading-list"){body=readingPage();section="Reading list";active="reading";title="Reading list";}
 else{body=notFound();section="Page not found";title="Page not found";}
 el.innerHTML=layout(body,section,active);
 document.title=title+" · Gastaldi";
 document.body.style.overflow="";
 if(type==="chapters")updateCatalogue(r.params);
 if(options.preserveScroll){window.scrollTo(0,oldY);}else{window.scrollTo(0,0);document.getElementById("main")?.focus({preventScroll:true});}
 if(type==="chapter"&&editionEntries.has(Number(p[1]))){
  const id=Number(p[1]);loadEdition(id);
  if(!options.preserveScroll&&editionCache.get(id)?.status==="ready")focusEditionPassage(id);
 }
}
function persistSaved(){
 try{localStorage.setItem(STORAGE,JSON.stringify([...saved]));storageOK=true;}catch{storageOK=false;}
}
function toggleSaved(id){
 if(!chapters.has(id))return;
 const adding=!saved.has(id);if(adding)saved.add(id);else saved.delete(id);persistSaved();
 if(route().parts[0]==="reading-list"){render({preserveScroll:true});}
 else{
  for(const button of document.querySelectorAll('[data-save="'+id+'"]')){
   const small=button.classList.contains("bookmark-small");
   button.setAttribute("aria-pressed",String(adding));
   button.setAttribute("aria-label",(adding?"Remove chapter "+id+" from reading list":"Save chapter "+id+" to reading list"));
   button.classList.toggle("saved",adding&&!small);
   button.innerHTML=icon(adding?"check":"bookmark")+(small?"":adding?"Saved":"Save chapter");
  }
  const count=document.getElementById("saved-count");if(count)count.textContent=String(saved.size);
 }
 toast(adding?"Chapter "+id+" saved"+(storageOK?" to your reading list.":" for this visit."):"Chapter "+id+" removed from your list.");
}
function applyFilters(){
 const form=document.getElementById("catalogue-filters");if(!form)return;
 const params=new URLSearchParams();
 const q=form.elements.q.value.trim(),group=form.elements.group.value,action=form.elements.action.value;
 if(q)params.set("q",q);if(group)params.set("group",group);if(action)params.set("action",action);if(form.elements.source.checked)params.set("source","1");if(form.elements.edition?.checked)params.set("edition","1");
 history.replaceState(null,"","#/chapters"+(params.size?"?"+params.toString():""));
 shown=24;updateCatalogue(params);
}
function downloadFile(name,content,type){
 const url=URL.createObjectURL(new Blob([content],{type}));
 const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function csvCell(v){let s=String(v??"");if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
async function copyText(text){
 try{await navigator.clipboard.writeText(text);return true;}catch{
  const area=document.createElement("textarea");area.value=text;area.style.position="fixed";area.style.left="-9999px";document.body.append(area);area.select();
  let ok=false;try{ok=document.execCommand("copy");}catch{}area.remove();return ok;
 }
}
function menu(open){
 document.querySelector(".shell")?.classList.toggle("menu-open",open);
 document.querySelector("[data-menu]")?.setAttribute("aria-expanded",String(open));
 document.body.style.overflow=open?"hidden":"";
 if(open)document.querySelector(".sidebar .brand")?.focus();
 else document.querySelector("[data-menu]")?.focus();
}
function restoreSourceFocus(selector){
 const control=document.querySelector(selector);
 if(control&&!control.disabled)control.focus({preventScroll:true});
 else document.getElementById("scan-stage")?.focus({preventScroll:true});
}
function moveSourcePage(n,focusSelector="#scan-stage"){
 const r=route(),e=excerpts.get(r.parts[1]);if(!e||!Number.isInteger(n)||n<1||n>e.pages.length)return;
 const params=new URLSearchParams(r.params);params.set("page",String(n));
 history.pushState(null,"","#/source/"+e.id+"?"+params.toString());
 render({preserveScroll:true});
 document.getElementById("scan-stage")?.scrollTo(0,0);
 restoreSourceFocus(focusSelector);
}
el.addEventListener("submit",event=>{
 if(event.target.id==="global-search"){event.preventDefault();const q=event.target.elements.q.value.trim();navigate("/chapters"+(q?"?q="+encodeURIComponent(q):""));}
 if(event.target.id==="catalogue-filters"){event.preventDefault();clearTimeout(searchTimer);applyFilters();}
});
el.addEventListener("input",event=>{if(event.target.id==="catalogue-query"){clearTimeout(searchTimer);searchTimer=setTimeout(applyFilters,180);}});
el.addEventListener("change",event=>{
 if(["group-filter","action-filter","source-filter","edition-filter"].includes(event.target.id))applyFilters();
 if(event.target.hasAttribute?.("data-edition-jump")){
  const id=Number(event.target.dataset.editionJump),passage=event.target.value,data=editionCache.get(id)?.data;
  if(activeEditionChapter(id)&&data?.segments.some(s=>s.id===passage))navigate("/chapter/"+id+"?passage="+encodeURIComponent(passage));
 }
});
el.addEventListener("click",async event=>{
 const button=event.target.closest("button");
 const documentStart=event.target.closest("[data-document-start]");
 if(documentStart){event.preventDefault();navigate(documentStart.getAttribute("href").slice(1));return;}
 if(event.target.closest("[data-menu-close]")){menu(false);return;}
 if(event.target.closest("[data-menu]")){menu(!document.querySelector(".shell")?.classList.contains("menu-open"));return;}
 if(button?.hasAttribute("data-save")){toggleSaved(Number(button.dataset.save));return;}
 if(button?.hasAttribute("data-cite")){
  const c=chapters.get(Number(button.dataset.cite));if(c){const ok=await copyText(citation(c));toast(ok?"Source citation copied.":"Clipboard unavailable. Expand Source citation & preparation notes to copy.");}return;
 }
 if(button?.hasAttribute("data-edition-retry")){
  const id=Number(button.dataset.editionRetry);
  if(activeEditionChapter(id)&&editionEntries.has(id)){
   editionCache.delete(id);render({preserveScroll:true});
  }
  return;
 }
 if(button?.hasAttribute("data-edition-view")){
  const nextView=button.dataset.editionView,id=Number(route().parts[1]);
  if(["both","original","english"].includes(nextView)&&activeEditionChapter(id)&&editionCache.get(id)?.status==="ready"){
   const oldY=window.scrollY;editionView=nextView;paintEdition(id,false);window.scrollTo(0,oldY);
   document.querySelector('[data-edition-view="'+nextView+'"]')?.focus({preventScroll:true});
  }
  return;
 }
 if(button?.hasAttribute("data-edition-cite")){
  const id=Number(button.dataset.editionCite),data=editionCache.get(id)?.data,c=chapters.get(id);
  const passage=button.dataset.passage,segment=passage?data?.segments.find(s=>s.id===passage):null;
  if(data&&c&&(!passage||segment)){
   const ok=await copyText(translationCitation(c,data,segment));
   toast(ok?"Translation citation copied.":"Clipboard unavailable. Open the passage or edition citation to copy it.");
  }
  return;
 }
 if(button?.hasAttribute("data-reset-filters")){shown=24;navigate("/chapters");return;}
 if(button?.hasAttribute("data-load-more")){shown+=24;updateCatalogue();return;}
 if(button?.hasAttribute("data-export-results")){
  clearTimeout(searchTimer);applyFilters();
  const rows=filterChapters(route().params),header=["chapter","roman","title","primary_group","action","printed_pages","summary","source_url"];
  const csv=[header,...rows.map(c=>[c.id,c.roman,c.title,groups.get(c.primaryGroup).name,c.actionLabel,c.printedPages,c.summary,c.source.readerUrl])].map(row=>row.map(csvCell).join(",")).join("\r\n");
  downloadFile("gastaldi-filtered-chapters.csv","\uFEFF"+csv,"text/csv;charset=utf-8");toast(rows.length+" chapter records exported.");return;
 }
 if(button?.hasAttribute("data-export-list")){
  const data={title:"Gastaldi reading list",edition:D.meta.edition,chapters:[...saved].map(id=>{const c=chapters.get(id);return{id,title:c.title,citation:citation(c),url:location.href.split("#")[0]+"#/chapter/"+id};})};
  downloadFile("gastaldi-reading-list.json",JSON.stringify(data,null,2),"application/json");toast("Reading list exported.");return;
 }
 if(button?.hasAttribute("data-copy-list")){
  const ok=await copyText([...saved].map(id=>citation(chapters.get(id))).join("\n\n"));toast(ok?"Reading-list citations copied.":"Clipboard unavailable. Use Export reading list instead.");return;
 }
 if(button?.hasAttribute("data-source-page")){
  const label=button.getAttribute("aria-label")==="Previous scanned page"?"Previous scanned page":"Next scanned page";
  moveSourcePage(Number(button.dataset.sourcePage),'[aria-label="'+label+'"]');return;
 }
 if(button?.hasAttribute("data-source-view")){sourceView=button.dataset.sourceView;render({preserveScroll:true});restoreSourceFocus('[data-source-view="'+sourceView+'"]');return;}
 if(button?.hasAttribute("data-zoom")){
  const direction=button.dataset.zoom;
  zoom=Math.max(.75,Math.min(2,zoom+(direction==="in"?.25:-.25)));
  if(sourceView!=="scan")sourceView="scan";render({preserveScroll:true});restoreSourceFocus('[data-zoom="'+direction+'"]');return;
 }
 const a=event.target.closest("a[href^='#/']");
 if(a){document.body.style.overflow="";document.querySelector(".shell")?.classList.remove("menu-open");}
});
document.querySelector(".skip-link").addEventListener("click",event=>{event.preventDefault();document.getElementById("main")?.focus();document.getElementById("main")?.scrollIntoView({block:"start"});});
document.addEventListener("keydown",event=>{
 const typing=/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)||event.target.isContentEditable;
 if(event.key==="/"&&!typing){event.preventDefault();document.getElementById("global-query")?.focus();}
 if(event.key==="Escape"){if(document.querySelector(".shell")?.classList.contains("menu-open"))menu(false);else if(typing)event.target.blur();}
 if(event.key==="Tab"&&document.querySelector(".shell")?.classList.contains("menu-open")){
  const nodes=[...document.querySelectorAll(".sidebar a[href],.sidebar button")],first=nodes[0],last=nodes.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 }
 if(!typing&&document.activeElement?.id==="scan-stage"&&route().parts[0]==="source"&&["ArrowLeft","ArrowRight"].includes(event.key)){
  event.preventDefault();const r=route(),e=excerpts.get(r.parts[1]);if(!e)return;
  const current=Math.min(e.pages.length,Math.max(1,Math.floor(Number(r.params.get("page"))||1)));
  moveSourcePage(current+(event.key==="ArrowRight"?1:-1));document.getElementById("scan-stage")?.focus({preventScroll:true});
 }
});
window.addEventListener("hashchange",()=>render());
window.addEventListener("popstate",()=>render());
window.addEventListener("storage",event=>{if(event.key===STORAGE){try{saved=new Set(JSON.parse(event.newValue||"[]").filter(id=>chapters.has(id)));render({preserveScroll:true});}catch{}}});
render();
})();
