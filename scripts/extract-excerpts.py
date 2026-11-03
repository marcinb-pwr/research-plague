#!/usr/bin/env python3
"""Extract exact source pages and browser previews from Gastaldi (1684).

Requires PyMuPDF and Pillow. Run from any directory:
  python scripts/extract-excerpts.py --source /path/to/bub_gb_7JW_fmB33XEC.pdf

The scan-page selections below were visually checked against printed pagination.
PDF pages are copied in full, including the original OCR and marginal material.
Page-image rotation is only used to make the sideways Trastevere plate readable.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path

import fitz
from PIL import Image


ARCHIVE_ID = "bub_gb_7JW_fmB33XEC"
READER = "https://archive.org/details/" + ARCHIVE_ID
SOURCE_PDF = "https://archive.org/download/" + ARCHIVE_ID + "/" + ARCHIVE_ID + ".pdf"
SOURCE_SHA256 = "71d4e5d487fb5d18ec66408a4828e44bcddaf7c782bc48198e723d2a042309a3"

SELECTIONS = [
    {
        "id": "health-passes",
        "title": "Health passes, routes and discriminatory exclusions",
        "description": "Rules for named health certificates, route endorsements, free issuance and forged or transferred documents, followed by explicit exclusions based on social and religious status.",
        "chapterIds": [43],
        "printedPages": "278-281",
        "scanPages": [360, 361, 362, 363],
        "printed": ["278", "279", "280", "281"],
        "translation": "English paraphrase: certificates must identify each traveller and be endorsed along the journey; they must be issued free. Page 281 excludes vagabonds, able-bodied beggars, Roma and Jews even if they hold health papers.",
        "notes": "Selected pages from chapter XLIII, not the entire chapter. These status exclusions are historical discriminatory rules, not evidence that the named groups carried infection.",
    },
    {
        "id": "illness-reporting",
        "title": "Reporting illness and deaths",
        "description": "An extensive order makes households, clergy and medical practitioners part of the reporting network, appoints district notaries, controls burials and possessions, and offers compensation for disclosed property.",
        "chapterIds": [55],
        "printedPages": "297-301",
        "scanPages": [381, 382, 383, 384, 385],
        "printed": ["297", "298", "299", "300", "301"],
        "translation": "English paraphrase: report household illness promptly, including illness that shows no sign of plague; physicians must provide signed daily returns, and suspected contagion must be reported without waiting until evening.",
        "notes": "The complete pages include the start of the following chapter on p.301. This scan contains an earlier duplicate of pp.297-298; this excerpt uses the continuous sequence at scan pages381-385.",
    },
    {
        "id": "tavern-contact-rules",
        "title": "Four people per tavern table",
        "description": "A compact four-part decree restricts courtesan-house visits, roaming cats and dogs, tavern groups and nonessential visits to sick people.",
        "chapterIds": [126],
        "printedPages": "417-418",
        "scanPages": [503, 504],
        "printed": ["417", "418"],
        "translation": "English paraphrase: innkeepers may not seat more than four people at a table. Sick visits are limited to household members and specified necessary religious, clinical, legal and care roles unless permission is obtained.",
        "notes": "The four-person cap applies to tavern tables, not to every gathering in Rome. Chapter CXXVI ends near the top of p.418, which also begins the next tribunal-suspension order.",
    },
    {
        "id": "free-cleansing",
        "title": "Disinfection without a charge",
        "description": "An order denies rumours of expensive cleansing fees and requires treated belongings to be returned to owners who establish their title, without an expurgation payment.",
        "chapterIds": [142],
        "printedPages": "446-447",
        "scanPages": [532, 533],
        "printed": ["446", "447"],
        "translation": "English paraphrase: owners owe no cleansing fee, and disinfectors may not demand one. The same order retains severe penalties for hiding suspect property and rewards disclosure.",
        "notes": "Chapter CXLII ends on p.447, where the next order begins. The text combines free service with coercion; it does not establish that every worker complied.",
    },
    {
        "id": "property-compensation",
        "title": "Compensation and an amnesty for the ghetto",
        "description": "A fifteen-day amnesty addresses concealed or untreated property. The order records the Jewish community leaders' offer to pay for deterioration caused by cleansing.",
        "chapterIds": [209],
        "printedPages": "532-533",
        "scanPages": [618, 619],
        "printed": ["532", "533"],
        "translation": "English paraphrase: value belongings before treatment and compensate their owners from community funds for damage, or allow a voluntary sale to the community at the assessed value. Gastaldi supervises cleansing and purchase.",
        "notes": "Chapter CCIX begins partway down p.532. Compensation follows an offer by the community's leaders; it should not be described as an unconditional treasury payment to all Romans.",
    },
    {
        "id": "quarantine-cohorts",
        "title": "Separate cohorts and contact-free meals",
        "description": "Instructions for the internal superintendent of San Pancrazio address accommodation, support for poor residents, separation by time in quarantine, food deliveries, cleaning and records.",
        "chapterIds": [231],
        "printedPages": "581-584",
        "scanPages": [667, 668, 669, 670],
        "printed": ["581", "582", "583", "584"],
        "translation": "English paraphrase: people who have already spent longer in quarantine should not mix with more recent arrivals. Residents put vessels outside their rooms, withdraw while food is served, and collect it after a signal.",
        "notes": "The cohort and meal procedure appears on p.582. The same instructions distinguish accommodation by social rank and provide food tickets for those unable to pay.",
    },
    {
        "id": "house-cleansing",
        "title": "Two teams for cleansing infected houses",
        "description": "A detailed protocol separates exposed and clean workers, specifies protective clothing, sequences washing and fumigation, includes places used before illness, and delays reoccupation.",
        "chapterIds": [242],
        "printedPages": "615-619",
        "scanPages": [701, 702, 703, 704, 705],
        "printed": ["615", "616", "617", "618", "619"],
        "translation": "English paraphrase: 'dirty' workers perform the initial treatment; 'clean' workers finish the process without mixing with them. The protocol calls for at least fifteen days from the first operation to reoccupation, with specified ventilation and fumigation intervals.",
        "notes": "Chapter CCXLII ends near the top of p.619, followed by another cleansing protocol. This is historical prescription, not current medical or chemical-safety guidance.",
    },
    {
        "id": "conditional-reopening",
        "title": "Reopening after sustained health assurance",
        "description": "The final collected edict restores commerce to named towns after elapsed disease-free periods while continuing to control household textiles, furniture and other merchandise.",
        "chapterIds": [227],
        "printedPages": "555-556",
        "scanPages": [641, 642],
        "printed": ["555", "556"],
        "translation": "English paraphrase: reopen movement of people and specified necessities after the recorded last cases and periods of health assurance; require local permission for other household goods. The order is dated 1 March1658.",
        "notes": "Chapter CCXXVII begins partway down p.555. The date on p.556 shows that the documentary sequence extends beyond calendar1657.",
    },
    {
        "id": "trastevere-cordon",
        "title": "Trastevere and Tiber Island: the containment landscape",
        "description": "The original engraved plan depicts the enclosed Trastevere district and Tiber Island, used as an infected-person lazaretto, with lettered features explained in chapter XXVII.",
        "chapterIds": [27],
        "printedPages": "179",
        "scanPages": [259],
        "printed": ["179"],
        "rotate": -90,
        "translation": "English paraphrase of the plate heading: topography of the enclosed Trastevere district and Tiber Island.",
        "notes": "The PDF preserves the sideways source page in full. Browser images are rotated for reading, with no content removed. The surrounding explanation is on printed pp.177-178.",
    },
]


def sha256(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def clean(text: str) -> str:
    import re
    text = re.sub(r"([A-Za-z])(\d)", r"\1 \2", text)
    return re.sub(r"([,;:.])(?=\d)", r"\1 ", text)


def render(page: fitz.Page, target: Path, long_edge: int, rotation: int = 0, quality: int = 84) -> tuple[int, int]:
    scale = long_edge / max(page.rect.width, page.rect.height)
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale).prerotate(rotation), colorspace=fitz.csRGB, alpha=False)
    image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    buffer = io.BytesIO()
    image.save(buffer, format="WEBP", quality=quality, method=4)
    payload = buffer.getvalue()
    with Image.open(io.BytesIO(payload)) as check:
        check.load()
        if check.size != (pix.width, pix.height):
            raise RuntimeError("Rendered image size mismatch: " + str(target))
    temporary = target.with_suffix(target.suffix + ".part")
    temporary.write_bytes(payload)
    temporary.replace(target)
    return pix.width, pix.height


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    source_path = args.source.resolve()
    checksum = sha256(source_path)
    if SOURCE_SHA256 != "TO_BE_REPLACED" and checksum != SOURCE_SHA256:
        raise SystemExit("Source checksum differs: refusing to reuse unverified scan-page selections.")
    root = args.output_root.resolve()
    assets = root / "public" / "excerpts"
    images = root / "public" / "images"
    data = root / "data"
    for directory in (assets, images, data):
        directory.mkdir(parents=True, exist_ok=True)
    source = fitz.open(source_path)
    if len(source) != 997:
        raise SystemExit("Expected the997-page complete scan.")
    manifest = {
        "source": {
            "title": "Tractatus de avertenda et profliganda peste politico-legalis",
            "author": "Girolamo Gastaldi",
            "year": 1684,
            "place": "Bologna",
            "archiveId": ARCHIVE_ID,
            "readerUrl": READER,
            "pdfUrl": SOURCE_PDF,
            "rightsNote": "Original text and engravings published in1684. Facsimiles are reproduced from the Google-digitized copy hosted by the Internet Archive; original scan marks and page content are retained. Cite the original edition and this digitized copy when reusing excerpts.",
            "sha256": checksum,
            "scanPageCount": len(source),
            "pageNumberingNote": "Printed page numbers differ from PDF scan positions. Scan pages here are1-based; Internet Archive n-page links use0-based positions. Selected PDF pages are complete and uncropped.",
        },
        "excerpts": [],
    }
    for selection in SELECTIONS:
        sid = selection["id"]
        pdf_path = assets / (sid + ".pdf")
        output = fitz.open()
        for scan in selection["scanPages"]:
            output.insert_pdf(source, from_page=scan - 1, to_page=scan - 1)
        output.set_metadata({
            "title": selection["title"] + " | Gastaldi1684",
            "author": "Girolamo Gastaldi",
            "subject": "Exact facsimile excerpt; printed pages " + selection["printedPages"],
            "keywords": "Gastaldi; plague; Rome;1656;1657;1684; facsimile",
        })
        output.save(pdf_path, garbage=4, deflate=True)
        output.close()
        copied = fitz.open(pdf_path)
        if len(copied) != len(selection["scanPages"]):
            raise RuntimeError("Wrong extracted page count")
        pages = []
        for index, (scan, printed) in enumerate(zip(selection["scanPages"], selection["printed"])):
            original_page = source[scan - 1]
            if copied[index].get_text() != original_page.get_text():
                raise RuntimeError("OCR differs for " + sid + " at " + str(scan))
            if tuple(copied[index].rect) != tuple(original_page.rect):
                raise RuntimeError("Page geometry differs for " + sid)
            name = sid + "-p" + str(index + 1) + ".webp"
            width, height = render(original_page, assets / name, 1500, selection.get("rotate", 0))
            pages.append({
                "image": "excerpts/" + name,
                "printedPage": printed,
                "scanPage": scan,
                "width": width,
                "height": height,
                "readerUrl": READER + "/page/n" + str(scan - 1) + "/mode/1up",
                "rotation": selection.get("rotate", 0),
            })
        copied.close()
        thumb_name = sid + "-thumb.webp"
        render(source[selection["scanPages"][0] - 1], assets / thumb_name, 600, selection.get("rotate", 0), quality=78)
        entry = {k: clean(v) if isinstance(v, str) else v for k, v in selection.items() if k not in {"printed", "rotate"}}
        entry.update({
            "pdf": "excerpts/" + sid + ".pdf",
            "pdfSha256": sha256(pdf_path),
            "pdfBytes": pdf_path.stat().st_size,
            "pages": pages,
            "thumbnail": "excerpts/" + thumb_name,
            "readerUrl": READER + "/page/n" + str(selection["scanPages"][0] - 1) + "/mode/1up",
            "evidenceType": "Primary-source facsimile",
            "explanationType": "Analytical English paraphrase; original Italian/Latin remains visible in the facsimile",
        })
        manifest["excerpts"].append(entry)
    hero_name = "trastevere-map.webp"
    width, height = render(source[258], images / hero_name, 1800, rotation=-90, quality=87)
    manifest["hero"] = {
        "image": "images/" + hero_name,
        "alt": "Engraved1684 plan of the enclosed Trastevere district and Tiber Island in Rome, with streets, walls, river and lettered health-control features.",
        "caption": "Trastevere and Tiber Island. Gastaldi,1684, chapter XXVII, printed p.179; scan page259. Rendered upright from the original engraving.",
        "printedPage": "179",
        "scanPage": 259,
        "chapterId": 27,
        "readerUrl": READER + "/page/n258/mode/1up",
        "excerptId": "trastevere-cordon",
        "width": width,
        "height": height,
    }
    for k, v in manifest["hero"].items():
        if isinstance(v, str) and not v.startswith(("http", "images/")):
            manifest["hero"][k] = clean(v)
    for k, v in manifest["source"].items():
        if isinstance(v, str) and not v.startswith("http") and k not in {"archiveId", "sha256"}:
            manifest["source"][k] = clean(v)
    (data / "excerpts.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    total = sum(p.stat().st_size for p in assets.iterdir() if p.is_file()) + sum(p.stat().st_size for p in images.iterdir() if p.is_file())
    print(json.dumps({"pdfs": len(manifest["excerpts"]), "pages": sum(len(e["pages"]) for e in manifest["excerpts"]), "assetBytes": total, "sourceSha256": checksum}, indent=2))


if __name__ == "__main__":
    main()
