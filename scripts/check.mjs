import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import vm from "node:vm";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const errors=[];
let checks=0;
const check=(ok,message)=>{checks++;if(!ok)errors.push(message);};
const exists=async file=>fs.access(file).then(()=>true,()=>false);
const readJSON=async name=>JSON.parse(await fs.readFile(path.join(root,name),"utf8"));
const nonempty=v=>typeof v==="string"&&v.trim().length>0;
const unique=values=>new Set(values).size===values.length;
const validHTTP=v=>{try{return new URL(v).protocol==="https:";}catch{return false;}};
const digest=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");

const catalogue=await readJSON("data/catalogue.json");
const excerpts=await readJSON("data/excerpts.json");
const editionNames=(await fs.readdir(path.join(root,"data/editions"))).filter(name=>/^\d+\.json$/.test(name));
const editionDocuments=await Promise.all(editionNames.map(name=>readJSON("data/editions/"+name)));
const editionByChapter=new Map(editionDocuments.map(e=>[e.chapterId,e]));
check(Array.isArray(catalogue.chapters),"chapters must be an array");
check(Array.isArray(catalogue.groups),"groups must be an array");
const chapters=catalogue.chapters||[];
const groups=catalogue.groups||[];
check(chapters.length===204,"Operational catalogue must contain 204 chapters");
check(groups.length===13,"Catalogue must have 13 analytical groups");
check(unique(chapters.map(c=>c.id)),"Duplicate chapter IDs");
check(unique(groups.map(g=>g.id)),"Duplicate group IDs");
check(chapters.map(c=>c.id).sort((a,b)=>a-b).every((id,i)=>id===i+42),"Chapter coverage must be exactly 42–245");
const chapterIds=new Set(chapters.map(c=>c.id));
const groupIds=new Set(groups.map(g=>g.id));
for(const g of groups){
 check(nonempty(g.id)&&nonempty(g.name),"Group identifiers and names must be present");
 check(nonempty(g.measures)&&nonempty(g.analysis),"Group "+g.id+" lacks its measures or analysis");
 check(g.chapterCount===chapters.filter(c=>c.primaryGroup===g.id).length,"Primary group count mismatch: "+g.id);
}
for(const c of chapters){
 const prefix="Chapter "+c.id+": ";
 check(Number.isInteger(c.id),prefix+"ID must be integer");
 check(nonempty(c.title)&&nonempty(c.summary),prefix+"missing title/summary");
 check(groupIds.has(c.primaryGroup),prefix+"invalid primary group");
 check(Array.isArray(c.groupIds)&&c.groupIds.includes(c.primaryGroup),prefix+"primary group missing from groupIds");
 check((c.groupIds||[]).every(id=>groupIds.has(id)),prefix+"unresolved group link");
 check(unique(c.groupIds||[]),prefix+"duplicate group link");
 check(Array.isArray(c.provisions)&&c.provisions.length>0&&c.provisions.every(nonempty),prefix+"missing provisions");
 check(nonempty(c.printedPages),prefix+"missing printed-page locator");
 check(nonempty(c.verificationNote),prefix+"missing verification note");
 check(c.source&&validHTTP(c.source.readerUrl)&&validHTTP(c.source.pdfUrl),prefix+"invalid source URLs");
 check(c.source?.pdfPage===null||(Number.isInteger(c.source?.pdfPage)&&c.source.pdfPage>=1&&c.source.pdfPage<=997),prefix+"invalid scan page");
 check((c.related||[]).every(id=>chapterIds.has(id)&&id!==c.id),prefix+"unresolved/self related chapter");
}
check(Array.isArray(catalogue.supplements)&&catalogue.supplements.length>0,"General counsel/context must be retained separately");
check(Array.isArray(catalogue.glossary)&&catalogue.glossary.length>0,"Glossary must be present");
for(const entry of catalogue.glossary||[])check((entry.chapters||[]).every(id=>chapterIds.has(id)),"Glossary "+entry.term+" has unresolved chapter link");

check(excerpts.source&&/^[a-f0-9]{64}$/i.test(excerpts.source.sha256),"Missing original-PDF SHA-256 provenance");
check(validHTTP(excerpts.source?.readerUrl)&&validHTTP(excerpts.source?.pdfUrl),"Source manifest requires HTTPS provenance");
check(Array.isArray(excerpts.excerpts)&&excerpts.excerpts.length>0,"No source excerpts");
check(unique((excerpts.excerpts||[]).map(e=>e.id)),"Duplicate excerpt IDs");
let assetBytes=0;
const seenAssets=new Set();
async function localAsset(relative,label){
 check(nonempty(relative),label+" missing path");
 if(!nonempty(relative))return null;
 check(!relative.startsWith("/")&&!/^[a-z]+:/i.test(relative)&&!relative.split(/[\\/]/).includes(".."),label+" must be a safe relative path");
 const filename=path.resolve(root,"public",relative);
 if(!filename.startsWith(path.resolve(root,"public")+path.sep))return null;
 const present=await exists(filename);
 check(present,label+" missing: "+relative);
 if(!present)return null;
 const bytes=await fs.readFile(filename);
 check(bytes.length>0,label+" is empty");
 if(!seenAssets.has(relative)){assetBytes+=bytes.length;seenAssets.add(relative);}
 return bytes;
}
for(const e of excerpts.excerpts||[]){
 const label="Excerpt "+e.id;
 check(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(e.id),label+" has invalid ID");
 check(nonempty(e.title)&&nonempty(e.description),label+" lacks context");
 check(nonempty(e.readingGuide),label+" needs an explicitly named reading guide");
 check(!Object.hasOwn(e,"translation"),label+" must not label a paraphrase as translation");
 check(Array.isArray(e.chapterIds)&&e.chapterIds.length>0&&e.chapterIds.every(n=>Number.isInteger(n)&&n>=1&&n<=261),label+" has invalid original chapter references");
 check(nonempty(e.printedPages),label+" lacks printed pagination");
 check(Array.isArray(e.scanPages)&&e.scanPages.length>0&&e.scanPages.every(n=>Number.isInteger(n)&&n>=1&&n<=997),label+" has invalid PDF scan pages");
 check(Array.isArray(e.pages)&&e.pages.length===e.scanPages.length,label+" image count does not match PDF scan selection");
 const pdf=await localAsset(e.pdf,label+" PDF");
 if(pdf){
  check(pdf.subarray(0,5).toString()==="%PDF-",label+" does not begin with a PDF signature");
  if(e.pdfSha256)check(digest(pdf)===e.pdfSha256,label+" PDF hash differs from manifest");
  if(e.pdfBytes)check(pdf.length===e.pdfBytes,label+" PDF byte count differs from manifest");
 }
 for(let i=0;i<(e.pages||[]).length;i++){
  const p=e.pages[i];
  check(p.scanPage===e.scanPages[i],label+" page"+(i+1)+" scan-page mismatch");
  check(nonempty(String(p.printedPage??"")),label+" page"+(i+1)+" lacks printed label");
  await localAsset(p.image,label+" page"+(i+1)+" image");
 }
 await localAsset(e.thumbnail,label+" thumbnail");
}
const reviewStates=new Set(["ai-draft","ai-checked","human-reviewed"]);
const passageKinds=new Set(["heading","preamble","provision","dateline","signature","publication"]);
check(unique(editionDocuments.map(e=>e.chapterId)),"Duplicate full-text edition chapter IDs");
for(let i=0;i<editionDocuments.length;i++){
 const e=editionDocuments[i],label="Edition "+e.chapterId+": ";
 check(e.schemaVersion===1,label+"unsupported schema version");
 check(chapterIds.has(e.chapterId)&&editionNames[i]===e.chapterId+".json",label+"chapter ID and filename must resolve to the same catalogue chapter");
 check(/^\d+\.\d+\.\d+$/.test(e.version||""),label+"missing editorial version");
 check(nonempty(e.document?.originalTitle)&&nonempty(e.document?.englishTitle),label+"missing historical/translated title");
 check(Array.isArray(e.document?.languages)&&e.document.languages.length>0,label+"missing source languages");
 check(e.document?.date===null||/^\d{4}-\d{2}-\d{2}$/.test(e.document?.date||""),label+"document date must be ISO or null");
 check(["complete-chapter","selected-passages"].includes(e.coverage?.scope),label+"invalid coverage scope");
 check(nonempty(e.coverage?.boundaryNote)&&Array.isArray(e.coverage?.includes)&&Array.isArray(e.coverage?.excluded),label+"coverage must identify boundaries, inclusions and exclusions");
 check(nonempty(e.transcriptionPolicy)&&nonempty(e.paragraphPolicy),label+"missing transcription/segmentation policy");
 check(e.source?.archiveId===excerpts.source.archiveId&&e.source?.pdfSha256===excerpts.source.sha256,label+"provenance differs from the source scan");
 const facsimile=excerpts.excerpts.find(s=>s.id===e.source?.excerptId);
 check(Boolean(facsimile)&&facsimile.chapterIds.includes(e.chapterId),label+"local facsimile must include this chapter");
 check(nonempty(e.source?.printedPages)&&Array.isArray(e.source?.scanPages)&&e.source.scanPages.length>0,label+"missing source page locators");
 check((e.source?.scanPages||[]).every(p=>Number.isInteger(p)&&facsimile?.scanPages.includes(p)),label+"source page missing from local facsimile");
 const segments=e.segments||[],notes=e.notes||[],ids=new Set(segments.map(s=>s.id)),noteIds=new Set(notes.map(n=>n.id));
 check(Array.isArray(e.segments)&&segments.length>0&&unique(segments.map(s=>s.id)),label+"missing/duplicate passage IDs");
 check(Array.isArray(e.notes)&&unique(notes.map(n=>n.id)),label+"duplicate or invalid editorial notes");
 for(const s of segments){
  const p=label+s.id+": ";
  check(new RegExp("^ch"+e.chapterId+"-[a-z0-9-]+$").test(s.id||""),p+"invalid stable passage identifier");
  check(passageKinds.has(s.kind)&&nonempty(s.label),p+"missing passage kind or label");
  check(nonempty(s.original)&&nonempty(s.english),p+"original and English translation must both be present");
  check(e.document.languages.includes(s.language),p+"passage language absent from document metadata");
  check(Array.isArray(s.sourcePages)&&s.sourcePages.length>0&&s.sourcePages.every(n=>e.source.scanPages.includes(n)),p+"invalid source-page mapping");
  check(Array.isArray(s.noteIds)&&s.noteIds.every(id=>noteIds.has(id)),p+"unresolved editorial note");
 }
 for(const n of notes)check(["transcription","translation","context"].includes(n.type)&&nonempty(n.id)&&nonempty(n.text),label+"invalid note "+n.id);
 check(Array.isArray(e.relations),label+"relations must be explicit, including an empty array when absent");
 for(const r of e.relations||[]){
  check(chapterIds.has(r.chapterId)&&r.chapterId!==e.chapterId&&nonempty(r.kind)&&nonempty(r.label),label+"invalid documentary relation");
  check(Array.isArray(r.segmentIds)&&r.segmentIds.length>0&&r.segmentIds.every(id=>ids.has(id)),label+"documentary relation lacks supporting passages");
 }
 for(const layer of ["transcription","translation"]){
  check(reviewStates.has(e.review?.[layer]?.status)&&nonempty(e.review?.[layer]?.description),label+"invalid "+layer+" review state");
 }
 check(["pending","complete"].includes(e.review?.humanReview?.status),label+"invalid human-review status");
 check(Array.isArray(e.review?.events)&&e.review.events.length>0&&e.review.events.every(v=>/^\d{4}-\d{2}-\d{2}$/.test(v.date||"")&&nonempty(v.actor)&&nonempty(v.action)),label+"review history needs dates, responsibility and actions");
 if([e.review?.transcription?.status,e.review?.translation?.status].includes("human-reviewed")){
  check(e.review.humanReview.status==="complete"&&nonempty(e.review.humanReview.reviewer),label+"human-reviewed text needs a named human reviewer");
 }
}
if(excerpts.hero){
 await localAsset(excerpts.hero.image,"Historical illustration");
 check(nonempty(excerpts.hero.alt)&&nonempty(excerpts.hero.caption),"Illustration lacks descriptive context");
 check(Number.isInteger(excerpts.hero.scanPage)&&excerpts.hero.scanPage>=1&&excerpts.hero.scanPage<=997,"Illustration scan-page locator is invalid");
 check(validHTTP(excerpts.hero.readerUrl),"Illustration lacks original reader link");
}
for(const name of ["site/app.js","scripts/build.mjs"]){
 const file=path.join(root,name);
 const present=await exists(file);
 check(present,name+" is missing");
 if(present){
  const result=spawnSync(process.execPath,["--check",file],{encoding:"utf8"});
  check(result.status===0,name+" syntax check failed: "+(result.stderr||""));
 }
}
const htmlPath=path.join(root,"dist/index.html");
const built=await exists(htmlPath);
let editionManifest={schemaVersion:1,entries:[]};
check(built,"dist/index.html missing: run npm run build first");
if(built){
 const html=await fs.readFile(htmlPath,"utf8");
 check(/<html[^>]*\blang=["']en["']/i.test(html),"Built HTML lacks declared English language");
 check(/name=["']viewport["']/i.test(html),"Built HTML lacks responsive viewport");
 for(const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)){
  const href=match[1];
  if(/^(?:https?:|mailto:|tel:|data:|#)/i.test(href))continue;
  check(!href.startsWith("/"),"Root-absolute asset URL breaks project subdirectory hosting: "+href);
  const clean=decodeURIComponent(href.split(/[?#]/)[0]);
  if(clean)check(await exists(path.resolve(root,"dist",clean)),"Built HTML references missing local file: "+href);
 }
 for(const relative of seenAssets)check(await exists(path.join(root,"dist",relative)),"Build omitted public asset: "+relative);
 const manifest=editionManifest=await readJSON("dist/data/editions/index.json");
 check(manifest.schemaVersion===1&&manifest.entries.length===editionDocuments.length,"Built edition index has stale coverage");
 for(const entry of manifest.entries){
  const e=editionByChapter.get(entry.chapterId);
  check(entry.path==="data/editions/"+entry.chapterId+".json","Unsafe or incorrect edition path");
  check(Boolean(e)&&entry.version===e.version&&entry.segmentCount===e.segments.length&&entry.scope===e.coverage.scope,"Built edition metadata is stale: "+entry.chapterId);
  check(Boolean(e)&&entry.transcriptionStatus===e.review.transcription.status&&entry.translationStatus===e.review.translation.status&&entry.humanReviewStatus===e.review.humanReview.status,"Built edition review status is stale: "+entry.chapterId);
  const copy=await readJSON("dist/"+entry.path);
  check(JSON.stringify(copy)===JSON.stringify(e),"Build changed/omitted edition content: "+entry.chapterId);
 }
}

// Exercise the shipped application, without modifying it or requiring a browser.
// A minimal DOM receives its rendered HTML; visual and keyboard behavior still
// require browser review. This catches bad data references and route-specific
// rendering failures that a JavaScript syntax check cannot detect.
try{
 const nodes=new Map(),listeners=new Map(),stored=new Map(),fetches=[];
 const makeNode=id=>({id,innerHTML:"",textContent:"",style:{},
  classList:{add(){},remove(){},toggle(){},contains(){return false;}},
  addEventListener(){},setAttribute(){},focus(){},scrollTo(){},scrollIntoView(){}});
 const node=id=>{if(!nodes.has(id))nodes.set(id,makeNode(id));return nodes.get(id);};
 const location={hash:"#/",href:"https://example.test/research-plague/#/"};
 const context={
  window:{PLAGUE_DATA:{catalogue,sources:excerpts,editions:editionManifest},scrollY:0,scrollTo(){},
   addEventListener(type,listener){listeners.set(type,listener);}},
  document:{getElementById:node,querySelector:selector=>node(selector),querySelectorAll:()=>[],
   addEventListener(){},body:{style:{}},title:""},
  location,history:{replaceState(_state,_title,url){location.hash=url;},pushState(_state,_title,url){location.hash=url;}},
  localStorage:{getItem:key=>stored.get(key)||null,setItem(key,value){stored.set(key,value);}},
  fetch:async url=>{fetches.push(url);const entry=editionManifest.entries.find(e=>"./"+e.path===url);return {ok:Boolean(entry),json:async()=>entry?structuredClone(editionByChapter.get(entry.chapterId)):null};},
  URL,URLSearchParams,Blob,console,setTimeout(){return 1;},clearTimeout(){},navigator:{}
 };
 vm.runInNewContext(await fs.readFile(path.join(root,"site/app.js"),"utf8"),context,{timeout:5000});
 check(typeof listeners.get("hashchange")==="function","Application did not install its route listener");
 const links=new Set();
 function renderRoute(hash){
  location.hash=hash;
  node("chapter-results").innerHTML="";
  node("results-label").textContent="";
  listeners.get("hashchange")();
  const markup=node("app").innerHTML+node("chapter-results").innerHTML;
  check(markup.includes('<main id="main"'),"Route failed to render main content: "+hash);
  for(const match of markup.matchAll(/\b(?:href|src)="([^"]+)"/g))links.add(match[1].replaceAll("&amp;","&"));
  return markup;
 }
 for(const route of ["/","/groups","/chapters","/sources","/context","/method","/glossary","/reading-list"])renderRoute("#"+route);
 for(const c of chapters){
  const markup=renderRoute("#/chapter/"+c.id);
  check(markup.includes('id="citation-'+c.id+'"'),"Chapter route lacks its citation: "+c.id);
 }
 // Requests may finish after the user leaves a chapter. They must populate
 // the cache without replacing the current route's content.
 const awayMarkup=renderRoute("#/chapter/98");
 await new Promise(resolve=>setImmediate(resolve));
 check(node("app").innerHTML===awayMarkup,"A late edition response replaced another chapter");
 for(const entry of editionManifest.entries){
  const e=editionByChapter.get(entry.chapterId),segment=e.segments.find(s=>s.kind==="provision")||e.segments[0];
  const markup=renderRoute("#/chapter/"+entry.chapterId+"?passage="+segment.id);
  check(markup.includes('id="document-edition-'+entry.chapterId+'"'),"Edition reader missing: "+entry.chapterId);
  check(markup.includes(segment.id)&&markup.includes('lang="en"')&&markup.includes('lang="'+segment.language+'"'),"Paired languages/permalink missing: "+entry.chapterId);
  check(markup.includes('data-edition-cite="'+entry.chapterId+'"'),"Translation citation control missing: "+entry.chapterId);
  check(markup.includes('./'+entry.path),"Downloadable edition record missing: "+entry.chapterId);
  check(markup.includes("version "+entry.version),"Translation citation omits edition version: "+entry.chapterId);
  check(fetches.filter(url=>url==="./"+entry.path).length===1,"Edition should load once and be cached: "+entry.chapterId);
 }
 renderRoute("#/chapters?edition=1");
 check(node("results-label").textContent.startsWith(editionManifest.entries.length+" of 204"),"Paired-text filter has incorrect coverage");
 check(fetches.every(url=>editionManifest.entries.some(e=>"./"+e.path===url)),"Application fetched an unlisted edition path");
 for(const g of groups)renderRoute("#/group/"+g.id);
 for(const e of excerpts.excerpts){
  for(let page=1;page<=e.pages.length;page++){
   const markup=renderRoute("#/source/"+e.id+"?page="+page);
   check(markup.includes('./'+e.pages[page-1].image),"Source route selected the wrong scanned page: "+e.id+" / "+page);
  }
  for(const [query,index] of [["nonsense",0],["-1",0],["999",e.pages.length-1],["1.9",0]]){
   const markup=renderRoute("#/source/"+e.id+"?page="+query);
   check(markup.includes('./'+e.pages[index].image),"Source query was not safely clamped: "+e.id+" / "+query);
  }
 }
 for(const query of ["126","ch. 126","chapter 126","CXXVI"]){
  renderRoute("#/chapters?q="+encodeURIComponent(query));
  check(node("results-label").textContent.startsWith("1 of 204"),"Chapter-number search is not exact: "+query);
  check(node("chapter-results").innerHTML.includes('href="#/chapter/126"'),"Chapter-number search missed chapter 126: "+query);
 }
 renderRoute("#/chapters?q=%22four%20people%22");
 check(node("chapter-results").innerHTML.includes('href="#/chapter/126"'),"Quoted-phrase search missed the tavern provision");
 renderRoute("#/chapters?q=zzzz-no-matching-document-zzzz");
 check(node("results-label").textContent.startsWith("0 of 204"),"Unmatched query should display zero results");
 renderRoute("#/chapters?source=1");
 const locallyCovered=new Set(excerpts.excerpts.flatMap(e=>e.chapterIds).filter(id=>chapterIds.has(id)));
 check(node("results-label").textContent.startsWith(locallyCovered.size+" of 204"),"Local-PDF filter includes chapters without an excerpt");
 for(const g of groups){
  renderRoute("#/chapters?group="+encodeURIComponent(g.id));
  const expected=chapters.filter(c=>c.groupIds.includes(g.id)).length;
  check(node("results-label").textContent.startsWith(expected+" of 204"),"Theme filter lost cross-linked chapters: "+g.id);
 }
 const miss=renderRoute("#/chapter/999");
 check(miss.includes("This page is not in the collection"),"Unknown chapter should display a useful recovery page");
 renderRoute("#/chapters?q=%22%3E%3Cscript%3E");
 check(!node("app").innerHTML.includes('<script>'),"Search input was interpreted as HTML");
 for(const href of links){
  if(/^(https?:|mailto:|tel:|data:)/i.test(href))continue;
  if(href.startsWith("#/")){
   const [type,id]=href.slice(2).split("?")[0].split("/");
   const valid=type==="chapter"?chapterIds.has(Number(id)):type==="group"?groupIds.has(id):type==="source"?excerpts.excerpts.some(e=>e.id===id):["","groups","chapters","sources","context","method","glossary","reading-list"].includes(type);
   check(valid,"Rendered unresolved wiki link: "+href);
  }else if(!href.startsWith("#")){
   check(!href.startsWith("/"),"Rendered asset uses a root-absolute URL: "+href);
   const clean=decodeURIComponent(href.split(/[?#]/)[0]);
   if(built&&clean)check(await exists(path.resolve(root,"dist",clean)),"Rendered route references a missing local asset: "+href);
  }
 }
}catch(error){check(false,"Application route smoke check failed: "+error.message);}
if(errors.length){
 console.error("Validation failed ("+errors.length+" issue"+(errors.length===1?"":"s")+").");
 for(const e of errors)console.error(" - "+e);
 process.exitCode=1;
}else{
 console.log("Validated "+chapters.length+" chapters, "+groups.length+" groups, "+excerpts.excerpts.length+" excerpts and "+seenAssets.size+" local source assets.");
 console.log(checks+" checks passed; source assets total "+(assetBytes/1024/1024).toFixed(2)+" MiB.");
}
