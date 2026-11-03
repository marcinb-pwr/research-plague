#!/usr/bin/env python3
"""Import the checked Gastaldi workbook into the static wiki catalogue.

Usage:
  python3 scripts/import-catalogue.py --workbook path/to/Gastaldi_1684_interventions.xlsx

The XLSX is read with the Python standard library. A first import additionally
needs --page-map path/to/bub_gb_7JW_fmB33XEC_page_numbers.json for scan links.
Subsequent imports preserve the checked page links in data/catalogue.json.
This script never edits the workbook or accesses the network.
"""
from __future__ import annotations
import argparse
import collections
import hashlib
import json
import re
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

NS={"s":"http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r":"http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
ARCHIVE="bub_gb_7JW_fmB33XEC"
SOURCE_URL="https://archive.org/details/"+ARCHIVE
PDF_URL="https://archive.org/download/"+ARCHIVE+"/"+ARCHIVE+".pdf"

GROUP_KEYS=[
"administration_legal","surveillance_tracing","border_travel",
"isolation_quarantine","gatherings_contact","workforce_protection",
"environment_decontamination","sanitation_burial","food_economic_supply",
"special_populations_welfare","religion","enforcement_amnesties","reopening_adaptive"]

TITLES={
42:"Initial restrictions on Naples",
43:"Health passes, guarded borders and status-based exclusions",
44:"Four approved ports and guarded coasts",
45:"Street cleaning, waste disposal and roaming pigs",
46:"Exceptions for approved provisions and animals",
47:"Wider Neapolitan and Tuscan exclusions",
48:"Civitavecchia: precautionary suspension",
49:"Trace arrivals from Civitavecchia",
50:"Prayers and indulgences during the epidemic",
51:"Nettuno: precautionary suspension",
52:"Trace arrivals and belongings from Nettuno",
53:"Relocate fiscal payments to the Quirinal",
54:"Restrict begging at the Holy Stairs and Lateran",
55:"Report illness and deaths; protect exposed property",
56:"Register, license and confine beggars",
57:"Require medical personnel to remain in Rome",
58:"Trace departures from sealed Trastevere",
59:"Suspend courts while preserving urgent business",
60:"Safe-return certificates for harvest workers",
61:"Tiber crossing and nighttime navigation controls",
62:"Organize firewood stocks and transport",
63:"District teams and repeated household visits",
64:"Ledgers and restrictions for secondhand goods",
65:"Enforce the Trastevere cordon",
66:"Renew the list of prohibited and suspended places",
67:"Close nonfood markets while preserving food sales",
68:"Search for specified suspected contacts",
69:"Provision Rome through separated gate markets",
70:"Decentralize reports to supervising prelates",
71:"Benevento: prohibit commerce",
72:"Extend court suspension with urgent exceptions",
73:"San Polo: prohibit arrivals and goods",
74:"Protect food carriers from detention and obstruction",
75:"Lazaretto boundaries and licensed home isolation",
76:"Velletri: temporary closure with provision exceptions",
77:"Keep spectators away from patient transfers",
78:"Separate administration and confinement of the ghetto",
79:"Roviano and Licenza: prohibit commerce",
80:"Locate an escaped lazaretto servant",
81:"Protect health notices and punish impersonation",
82:"Preserve notarial records and archives",
83:"Maintain ordinary care and limit additional fees",
84:"Separate care teams and appoint exposed midwives",
85:"Recover property stolen from sealed houses",
86:"Locate a servant of health concern",
87:"Extend bans to Genoa and specified Papal towns",
88:"Bread standards, production and bakery rent relief",
89:"Move foul burning outside Rome",
90:"Protect and separate provision carriers",
91:"Inspect fish, dairy, eggs and produce",
92:"Extend isolation rules to the Consolazione hospital",
93:"Confine and support beggars at San Saba",
94:"Trace households, control property and observe admissions",
95:"Order an escaped health-service convict to return",
96:"Revoke unsafe harvest-worker passes",
97:"Add newly infected places to the prohibited list",
98:"Trace goods from a named cloth merchant",
99:"Clarify complete household illness reporting",
100:"Organize cleansing sites and protect owners' property",
101:"Prohibit unripe fruit",
102:"Relax grape restrictions in stages",
103:"Renew and extend territorial restrictions",
104:"Lazaretto operations, staffing and accountability",
105:"Reporting triggers and immediate household containment",
106:"Disclose goods removed from sealed Trastevere",
107:"Reopen Cisterna; extend the Genoese prohibition",
108:"Require permission for returning Romans",
109:"Marino: district reporting and household surveillance",
110:"Marino: gathering limits, animals and separate laundries",
111:"Marino: lazaretto boundaries and home-care exceptions",
112:"Mixed reopening and new territorial restrictions",
113:"Health passes and limits for rural work",
114:"Sezze and Montefortino: prohibit commerce",
115:"Bracciano: temporary suspension",
116:"Require permission for sick people to move",
117:"Reopen Bracciano; suspend Lamentana",
118:"Marino: guarded exchanges for surplus provisions",
119:"Detailed passes, routes and cargo endorsements",
120:"Prohibit mushrooms entering Rome",
121:"Register physicians and surgeons",
122:"Divert traffic around Marino",
123:"Support certified food carriers and clean inns",
124:"Stop officials' trading and weighing abuses",
125:"Lamentana: restore commerce",
126:"Tavern tables, sick visits, courtesans and roaming animals",
127:"Extend court closures and written-petition procedures",
128:"Fiumicino: segregated landings and fish supplies",
129:"Separate old and new pledges at Monte di Pieta",
130:"Trace the servant of a plague victim",
131:"Extend restrictions to Valmontone, Oriolo and Subiaco",
132:"Delegate summary jurisdiction over health offences",
133:"Lamentana: reimpose restrictions",
134:"Substitute home devotion for crowded church visits",
135:"Digest of the health regulations",
136:"Renew reporting duties and symptom-based triggers",
137:"Maintain sowing and cultivation",
138:"Rieti and Gualdo: suspend commerce",
139:"Extend tribunal suspension",
140:"Disclose suspect property removed from the ghetto",
141:"Palestrina and Corchiano: suspend commerce",
142:"Disinfection must be free",
143:"Religious provision for victims buried outside churches",
144:"Amnesty for disclosure of removed furnishings",
145:"Require communities to restrict contact with Rome",
146:"Serrone and Frosinone: prohibit commerce",
147:"Locate an escaped lazaretto carter",
148:"Separate exposed workers and their households",
149:"Reopen the Frattocchie supply route",
150:"Partially restore Jewish-Christian commerce",
151:"Civitavecchia: restore commerce after cleansing",
152:"Nettuno: reopen with goods reservations",
153:"Restrict landings near Nettuno, Astura and Anzio",
154:"Extend judicial suspension into January 1657",
155:"Extend cleansing controls to warehouses and mills",
156:"Christmas services behind closed doors",
157:"Reopen Roviano and neighbouring towns conditionally",
158:"Amnesty for surrendering suspect possessions",
159:"Extend disclosure immunity with exclusions",
160:"Prohibit dumping beside San Giovanni dei Fiorentini",
161:"Vivaro, Arsoli and Riofreddo: conditional reopening",
162:"Keep unauthorized boats away from Tiber Island",
163:"Pozzaglia: suspend commerce",
164:"Disclosure amnesty during Gastaldi's inspections",
165:"Trace stolen goods and a detained dealer's stock",
166:"Prohibit affected places in Val di Magra",
167:"Reopen selected ports; route Subiaco merchandise",
168:"Reserve the Isola inn for food carriers",
169:"Relax Lenten dietary abstinence",
170:"Quarantine exposed staff; retain emergency care",
171:"Partially reopen judicial proceedings",
172:"Renew the ghetto property-disclosure amnesty",
173:"Require official disinfection despite completed quarantine",
174:"One church may replace the station-church itinerary",
175:"Valmontone and Bassiano: conditional reopening",
176:"Reopen courts while limiting crowds",
177:"Investigate theft during cleansing and corpse removal",
178:"Reopen two towns and suspend two others",
179:"Reopen Rome's surrounding twenty-mile zone selectively",
180:"Relax restrictions on Jewish work and commerce",
181:"Renew the Genoese ban; reopen Frosinone",
182:"Permit eligible former residents to return to Rome",
183:"Clarify the limits of relaxed Jewish trade restrictions",
184:"Morlupo: restore commerce after cleansing",
185:"Easter Jubilee indulgence and prayer requirements",
186:"Reopen named towns with commodity reservations",
187:"Maenza: suspend commerce after suspicious deaths",
188:"Renew the deadline to declare untreated property",
189:"Reopen Scarpa; prohibit Carpineto",
190:"Reopen provincial commerce and forbid obstruction",
191:"Differentiated reopening in the Subiaco abbacy",
192:"Renew the prohibition on the whole Kingdom of Naples",
193:"Repeal selected controls while retaining illness reports",
194:"Terni: suspend commerce",
195:"Suspend Rome's reopening after new suspected cases",
196:"Safe return for healthy-country harvest workers",
197:"Extend renewed closure to Rome's surrounding zone",
198:"Restore district inspection teams",
199:"Configni: prohibit commerce",
200:"Renew secondhand-goods, market and visiting restrictions",
201:"Renew reporting, household controls and hospital screening",
202:"Velletri: reopen with restrictions on selected goods",
203:"Extend Rome's commercial suspension",
204:"Authorize additional health-pass issuers",
205:"Montefiascone: suspend commerce",
206:"Extend the restrictions restated in chapter 200",
207:"Continue Rome's trade suspension through August",
208:"Sun and air suspect possessions; offer disclosure immunity",
209:"Community compensation for Jewish owners' goods",
210:"Viterbo: suspend commerce",
211:"Casperia: prohibit commerce",
212:"Extend Rome's closure; suspend Cantalupo and Gavignano",
213:"Prohibit grapes until the appointed date",
214:"Reopen Maenza and Piglio; prohibit Cottanello",
215:"Extend closure as contagion spreads nearby",
216:"Cantalupo and Gavignano: restore commerce",
217:"Limit visits and overnight stays during the vintage",
218:"Reopen Rome while preserving certificates and exclusions",
219:"Permit safe seasonal movement of shepherds and flocks",
220:"Repeal lodging and property restrictions; retain reports",
221:"Return cleansed Tiber Island houses to owners",
222:"Castel di Piero: suspend commerce",
223:"Terni: reopen after cleansing and a case-free interval",
224:"Reopen northern legations and exports from Rome",
225:"Reaffirm safeguards against still-prohibited places",
226:"Retain coastal, river and Magliana safeguards",
227:"Reopen the remaining towns with goods reservations",
228:"Instructions for district officers",
229:"More frequent inspections and coordinated household records",
230:"Instructions for gate commissioners and supply exchange",
231:"Instructions for the internal quarantine superintendent",
232:"Instructions for the external quarantine superintendent",
233:"Instructions for lazaretto guards",
234:"Instructions for the quarantine physician",
235:"Instructions for the quarantine surgeon",
236:"Instructions for the quarantine apothecary",
237:"Instructions for the food contractor",
238:"Instructions for the wardrobe and linen keeper",
239:"Select, inventory and remove exposed household property",
240:"Supervise cleansing, custody and return of belongings",
241:"Material-specific cleansing procedures",
242:"Two-stage cleansing of infected houses",
243:"Additional premises and property cleansing protocol",
244:"Prepare food, containers and animals at frontier exchanges",
245:"Customs release after authorized cleansing"
}

# Explicit thematic aliases extend the workbook's supplied cross-tags.
# They are editorial navigation, not evidence that one order was caused by another.
TAG_GROUPS={
"food supply":"food_economic_supply","food provision":"food_economic_supply",
"provisioning":"food_economic_supply","food quality":"food_economic_supply",
"agriculture":"food_economic_supply","fuel":"food_economic_supply",
"price regulation":"food_economic_supply","fair trade":"food_economic_supply",
"weights measures":"food_economic_supply","rent relief":"food_economic_supply",
"surveillance":"surveillance_tracing","contact tracing":"surveillance_tracing",
"case definition":"surveillance_tracing","case reporting":"surveillance_tracing",
"daily reporting":"surveillance_tracing","early warning":"surveillance_tracing",
"reporting":"surveillance_tracing","reporting delivery":"surveillance_tracing",
"duplicate reports":"surveillance_tracing","identity":"surveillance_tracing",
"registration":"surveillance_tracing","inspection":"surveillance_tracing",
"enforcement":"enforcement_amnesties","fraud":"enforcement_amnesties",
"anti fraud":"enforcement_amnesties","anti corruption":"enforcement_amnesties",
"informant rewards":"enforcement_amnesties","amnesty":"enforcement_amnesties",
"coercion":"enforcement_amnesties","convict labour":"enforcement_amnesties",
"decontamination":"environment_decontamination","secondhand trade":"environment_decontamination",
"property":"environment_decontamination","laundry":"environment_decontamination",
"burning":"environment_decontamination","vinegar":"environment_decontamination",
"sanitation":"sanitation_burial","water":"sanitation_burial",
"burial":"sanitation_burial","animals":"sanitation_burial","air":"sanitation_burial",
"quarantine":"isolation_quarantine","isolation":"isolation_quarantine",
"home care":"isolation_quarantine","hospital admission":"isolation_quarantine",
"hospital operation":"isolation_quarantine","hospitals":"isolation_quarantine",
"observation":"isolation_quarantine","gender separation":"isolation_quarantine",
"gatherings":"gatherings_contact","visitors":"gatherings_contact",
"contact separation":"gatherings_contact","district separation":"gatherings_contact",
"spatial separation":"gatherings_contact","table capacity":"gatherings_contact",
"sex work":"gatherings_contact","overnight stays":"gatherings_contact",
"workforce":"workforce_protection","protective clothing":"workforce_protection",
"clinical care":"workforce_protection","clinical monitoring":"workforce_protection",
"continuity of care":"workforce_protection","compulsory service":"workforce_protection",
"midwifery":"workforce_protection","necessary workers":"workforce_protection",
"welfare":"special_populations_welfare","poverty":"special_populations_welfare",
"compensation":"special_populations_welfare","ghetto":"special_populations_welfare",
"indulgences":"religion","home devotion":"religion",
"adaptive relaxation":"reopening_adaptive","returning residents":"reopening_adaptive",
"archives":"administration_legal","communication":"administration_legal",
"finance":"administration_legal","inventory":"administration_legal",
"district administration":"administration_legal","written petitions":"administration_legal",
"ecclesiastical jurisdiction":"administration_legal","summary procedure":"administration_legal",
"debt":"administration_legal","debt protection":"administration_legal",
"payment":"administration_legal","regulated fees":"administration_legal",
"continuity":"administration_legal","essential services":"administration_legal",
"maritime":"border_travel","movement":"border_travel","transport":"border_travel",
"river navigation":"border_travel","road barriers":"border_travel","routes":"border_travel",
"route exception":"border_travel","territorial scope":"border_travel",
"correspondence":"border_travel","certification":"border_travel","licensing":"border_travel",
"rescue exception":"border_travel","diversion":"border_travel"
}
GLOSSARY=[
{"term":"Lazaretto","definition":"An institution used to isolate, observe or care for people and to manage suspect goods. Gastaldi describes distinct facilities and staff roles; the term does not always mean the same patient category.","chapters":[75,104,231,232,233]},
{"term":"Quarantine","definition":"A period or arrangement of separation for people or belongings regarded as exposed or suspect. Durations vary in the Roman documents; forty days is not a universal rule across this collection.","chapters":[75,83,170,231,232]},
{"term":"Isolation","definition":"In this catalogue, separation of sick or potentially infectious people. This modern analytical label does not imply that seventeenth-century authorities used today's diagnostic definitions.","chapters":[65,75,78,94,201]},
{"term":"Health pass","definition":"An official document stating identity, origin, route or permitted movement. Some orders require endorsements at checkpoints; a certificate did not override every territorial or status-based ban.","chapters":[43,60,96,119,204,218]},
{"term":"Cordons","definition":"Guarded boundaries intended to prevent unauthorized entry, exit or exchange around places considered infected or suspect.","chapters":[43,65,78,122]},
{"term":"Clean and dirty","definition":"Historical administrative classifications for people, teams, goods or places considered free from, or exposed to, contagion. They are not laboratory findings or judgments about personal worth.","chapters":[84,100,104,148,240,242]},
{"term":"Disinfection / cleansing","definition":"The historical treatment of possessions or premises using procedures such as washing, boiling, airing, fumigation and selective burning. The label does not certify that a procedure sterilized an object.","chapters":[100,142,173,239,240,241,242,243]},
{"term":"Fumigation","definition":"Treatment with fumes or smoke, applied to rooms, belongings and other materials under historical contagion and air theories. Its inclusion records practice, not a modern recommendation.","chapters":[100,234,238,241,242]},
{"term":"Rione","definition":"A district of Rome. The programme assigned reporting, inspection and care responsibilities through district officials and notaries.","chapters":[55,63,70,198,228,229]},
{"term":"Congregazione di Sanità","definition":"The central health congregation directing the papal response, supported by commissioners and local officials.","chapters":[59,63,70,135,176]},
{"term":"SANITAS / SANITÀ","definition":"The health notice placed on a sealed house. Removing it, moving it to an unaffected house or impersonating health officials was explicitly prohibited.","chapters":[55,78,81,201]},
{"term":"Amnesty","definition":"A time-limited offer of immunity for truthful disclosure or surrender of suspect property, with specified conditions and exclusions. Repeated amnesties did not erase all health offences.","chapters":[85,158,159,164,172,188,208,209]},
{"term":"Ghetto","definition":"Rome's compulsory Jewish residential district, subjected to separate medical, reporting, supply and burial administration. The catalogue distinguishes relief from discriminatory confinement and exclusions.","chapters":[43,78,140,150,180,183,209]},
{"term":"NPI","definition":"Nonpharmaceutical intervention: an analytical term for measures such as surveillance, separation, movement restrictions and environmental controls. It is not Gastaldi's terminology, and a chapter or decree is not one unique NPI.","chapters":[135,228,241]},
{"term":"Prescription and implementation","definition":"An order establishes what authorities required. Its text alone does not prove compliance, uniform enforcement or effectiveness; those questions need additional records and analysis.","chapters":[104,135,198,227]}
]

def clean(value):
    if not isinstance(value,str): return value
    pieces=re.split(r"(https?://\S+)",value)
    for i,part in enumerate(pieces):
        if part.startswith("http"): continue
        part=re.sub(r"([A-Za-z])(\d)",r"\1 \2",part)
        part=re.sub(r"([,;:])(?=[A-Za-z0-9])",r"\1 ",part)
        pieces[i]=part
    # A leading newline separates an empty tag list from provenance in the
    # workbook. Preserve it; stripping it misclassifies chapter205's note as tags.
    return "".join(pieces).strip(" \t\r")

def roman(n):
    out=""
    for value,token in [(1000,"M"),(900,"CM"),(500,"D"),(400,"CD"),(100,"C"),(90,"XC"),(50,"L"),(40,"XL"),(10,"X"),(9,"IX"),(5,"V"),(4,"IV"),(1,"I")]:
        while n>=value: out+=token; n-=value
    return out

def read_xlsx(path):
    with zipfile.ZipFile(path) as z:
        strings=[]
        if "xl/sharedStrings.xml" in z.namelist():
            strings=["".join(el.itertext()) for el in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("s:si",NS)]
        relationships=ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        targets={r.attrib["Id"]:r.attrib["Target"] for r in relationships}
        sheets={}
        for el in ET.fromstring(z.read("xl/workbook.xml")).findall("s:sheets/s:sheet",NS):
            target=targets[el.attrib["{"+NS["r"]+"}id"]]
            filename=target.lstrip("/") if target.startswith("/") else "xl/"+target
            cells={}
            for c in ET.fromstring(z.read(filename)).findall(".//s:sheetData/s:row/s:c",NS):
                typ=c.attrib.get("t")
                v=c.find("s:v",NS)
                if typ=="inlineStr":
                    value="".join(c.find("s:is",NS).itertext())
                elif v is not None:
                    value=v.text or ""
                    if typ=="s": value=strings[int(value)]
                else: value=""
                cells[c.attrib["r"]]=clean(value)
            sheets[el.attrib["name"]]=cells
        return sheets

def page_lookup(path):
    data=json.loads(path.read_text())
    by_page=collections.defaultdict(list)
    for p in data["pages"]:
        if str(p.get("pageNumber","")).isdigit():
            by_page[int(p["pageNumber"])].append(p)
    # Physical duplicates are preserved in the source scan. Prefer the clearer
    # occurrence when the Archive metadata assigns the same printed number twice.
    mapping={p:sorted(items,key=lambda x:(-x.get("confidence",0),x["leafNum"]))[0]["leafNum"]+1
             for p,items in by_page.items()}
    # Two duplicate scans of pp.396–397 make the Archive's zero-confidence
    # inferred labels wrong here. Actual chapter CXII/CXIII starts and printed
    # pp.398–399 were checked in the original PDF, not inferred by offset.
    mapping.update({398:484,399:485})
    return mapping

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workbook",required=True,type=Path)
    parser.add_argument("--page-map",type=Path)
    parser.add_argument("--output",type=Path,default=Path("data/catalogue.json"))
    args=parser.parse_args()
    old=json.loads(args.output.read_text()) if args.output.exists() else {}
    sheets=read_xlsx(args.workbook)
    gs=sheets["Groups and scope"]; cs=sheets["Chapter inventory"]; ds=sheets["Operative detail"]
    groups=[]
    for idx,key in enumerate(GROUP_KEYS):
        row=idx+9
        groups.append({"id":key,"key":key,"number":idx+1,
                       "name":re.sub(r"^\d+\.\s*","",gs["A"+str(row)]),
                       "measures":gs["B"+str(row)],"analysis":gs["C"+str(row)],
                       "locators":gs["D"+str(row)],"chapterCount":0})
    name_to_group={g["name"]:g["id"] for g in groups}
    key_to_group={g["id"]:g for g in groups}
    provisions=collections.defaultdict(list)
    detail_kinds=collections.defaultdict(set)
    detail_rows=0
    for addr,value in ds.items():
        if not re.fullmatch(r"A\d+",addr) or int(addr[1:])<9 or not value.isdigit(): continue
        row=addr[1:]; chapter=int(value)
        provisions[chapter].append(ds.get("D"+row,""))
        detail_kinds[chapter].add(ds.get("C"+row,""))
        detail_rows+=1
    page_map=page_lookup(args.page_map) if args.page_map else {}
    previous={c["id"]:c for c in old.get("chapters",[])}
    chapters=[]
    for row in range(9,213):
        s=str(row); cid=int(cs["A"+s]); summary=cs["C"+s]
        primary=name_to_group[cs["B"+s]]
        tags_part,_,note=cs["F"+s].partition("\n")
        tags=[clean(t.replace("_"," ")) for t in tags_part.split(";") if t.strip()]
        group_ids=[primary]
        for tag in tags:
            gid=name_to_group.get(tag) or TAG_GROUPS.get(tag.lower())
            if gid and gid not in group_ids: group_ids.append(gid)
        page_text=cs["E"+s]
        match=re.search(r"\d+",page_text)
        first_page=int(match.group()) if match else None
        pdf_page=page_map.get(first_page)
        if pdf_page is None: pdf_page=previous.get(cid,{}).get("source",{}).get("pdfPage")
        if pdf_page is None and args.page_map:
            raise ValueError("No physical page mapping for chapter "+str(cid))
        source={"readerUrl":SOURCE_URL+("/page/n"+str(pdf_page-1)+"/mode/1up" if pdf_page else ""),
                "pdfUrl":PDF_URL+("#page="+str(pdf_page) if pdf_page else ""),
                "pdfPage":pdf_page,"printedPage":first_page,
                "mappingNote":"Printed-page metadata mapped to the original scan; physical PDF page numbering includes preliminaries and duplicate scans."}
        action=cs["D"+s].replace(" ","_")
        chapters.append({"id":cid,"roman":roman(cid),"title":TITLES[cid],
                         "summary":summary,"primaryGroup":primary,"groupIds":group_ids,
                         "tags":tags,"action":action,"actionLabel":cs["D"+s].capitalize(),
                         "printedPages":page_text,"provisions":provisions[cid],
                         "provisionKind":"expanded" if "Operative provision" in detail_kinds[cid] else "summary",
                         "verificationNote":note,"source":source,"related":[]})
        key_to_group[primary]["chapterCount"]+=1
    ids=[c["id"] for c in chapters]
    assert ids==list(range(42,246)),"Expected exactly chapters42–245"
    assert len(groups)==13
    assert set(ids)==set(TITLES)
    assert all(len(c["title"])<=90 for c in chapters)
    assert all(c["provisions"] and all(c["provisions"]) for c in chapters)
    assert all(c["verificationNote"].strip() for c in chapters),"Missing chapter provenance"
    # Related chapters are navigational affinities, never causal assertions.
    for chapter in chapters:
        def score(other):
            return (3*(chapter["primaryGroup"]==other["primaryGroup"])
                    +len(set(chapter["groupIds"])&set(other["groupIds"]))
                    +len(set(chapter["tags"])&set(other["tags"]))*0.5)
        related=sorted((c for c in chapters if c["id"]!=chapter["id"]),
                       key=lambda c:(-score(c),abs(c["id"]-chapter["id"]),c["id"]))
        chapter["related"]=[c["id"] for c in related[:6]]
    supplements=[]
    for row in range(25,39):
        s=str(row)
        chapters_text,_,pages=gs["D"+s].partition(" | ")
        status,sep,note=gs["C"+s].partition(". ")
        supplements.append({"id":"supplement-"+str(row-24),"title":gs["A"+s],
                            "chapters":chapters_text,"pages":pages,"status":status,
                            "summary":gs["B"+s],"note":note if sep else ""})
    result={"meta":{
        "title":"Gastaldi's Rome: a plague-response wiki",
        "edition":"Girolamo Gastaldi, Tractatus de avertenda et profliganda peste politico-legalis. Bologna,1684.",
        "coverage":"Roman plague response of1656–1657, with collected follow-up orders through1 March1658.",
        "countingNote":"261 chapters in the book;204 edict/order and operational-instruction chapters (42–245). Several chapters contain multiple provisions; repeated orders, renewals and repeals are not distinct NPIs.",
        "sourceUrl":SOURCE_URL,"sourcePdfUrl":PDF_URL,"sourceArchiveId":ARCHIVE,
        "generatedAt":"2026-11-03","sourcePdfPages":997,
        "workbook":"Gastaldi_1684_interventions.xlsx",
        "workbookSha256":hashlib.sha256(args.workbook.read_bytes()).hexdigest(),
        "documentCount":len(chapters),"groupCount":len(groups),"operativeRowCount":detail_rows,
        "method":"Analytical English paraphrases of the checked workbook and its primary-source review. Every operational chapter is represented. This is not a diplomatic transcription or proof of uniform implementation or effectiveness.",
        "relatedNote":"Related chapters share editorial themes; links do not establish historical sequence or causation.",
        "groupCountNote":"Group counts use one primary filing category per chapter. Thematic filters also include cross-tags, so their totals can overlap."
    },"groups":groups,"chapters":chapters,"supplements":supplements,"glossary":GLOSSARY}
    def clean_all(v):
        if isinstance(v,dict):return {k:clean_all(x) for k,x in v.items()}
        if isinstance(v,list):return [clean_all(x) for x in v]
        return clean(v)
    # Do not alter identifiers or machine-readable action/group keys.
    result["meta"]={k:(clean(v) if isinstance(v,str) and k not in ["sourceArchiveId","workbookSha256","workbook"] else v) for k,v in result["meta"].items()}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({"chapters":len(chapters),"groups":len(groups),"supplements":len(supplements),
                      "operativeRows":detail_rows,"sourceLinks":sum(c["source"]["pdfPage"] is not None for c in chapters),
                      "output":str(args.output)}))

if __name__=="__main__": main()
