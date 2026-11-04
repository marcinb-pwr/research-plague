# Chapter reading editions

The chapter catalogue and the reading editions serve different purposes. The catalogue summarizes and groups documents. An edition provides original-language text and an English translation with enough source and revision information for a reader to inspect individual claims.

The editions now cover 22 chapters: 42–62 and 99. The 4 November 2026 batch adds the first 20 previously untranslated chapters in catalogue order: 42–54 and 56–62. Chapter 55 and chapter 99 retain their existing editions. Their transcriptions were prepared by AI and compared with the page images; their English translations are working drafts. Human specialist review is pending. Never describe these states as a completed critical edition or independent human verification.

## Preparation workflow

1. Locate the beginning and end of the chapter in the images. Check neighboring pages and identify adjoining text on shared pages. Record printed page labels separately from one-based PDF scan positions.
2. Read the whole chapter, including its heading, preamble, numbered clauses, exceptions, names, date, signatures and any publication certification. State which components are present and which surrounding content is excluded.
3. Transcribe from the images, using OCR only as an aid. Disclose normalization, expansions, supplied readings and uncertainties. Preserve readable historical spellings rather than silently modernizing them.
4. Translate the transcription passage by passage. Keep qualifications, exceptions, penalties and documentary formulae. Put interpretation and modern explanatory context in notes.
5. Compare the translation with both the transcription and the images. Record actual review actions and whether they were performed by AI or a human. An unresolved word should have a local note, not a fabricated certainty score.
6. Check explicit references to other documents. Record these as relations, separate from the catalogue's thematic recommendations. Reassess the summary only after checking the source and its relevant references.
7. Build and validate the site, then inspect the bilingual reader, original images, passage links, notes and citation controls at desktop and mobile widths.

## Source and transcription policy

Describe the source as the text printed in Gastaldi's 1684 edition. Record the earlier document's date separately. The scanned book is evidence of this printed witness; do not imply that it is a separately authenticated contemporary broadside.

For these reading editions, long s is represented as s, line-end word divisions are joined, and printer spacing and apostrophes are regularized. Historical spelling is retained. Abbreviations may remain as printed in the transcription and be expanded in the English translation; explain any non-obvious expansion. Record any departure from this policy in the individual edition.

When a source prints one long paragraph, an editor may divide it for comparison. Say so in `paragraphPolicy`. Original numbered clauses should retain their numbers in passage labels. Keep heading, date and signature passages distinct from operative clauses.

The complete facsimile page should remain available even when the chapter occupies only part of it. Do not overlay modern text on the historical page or silently crop away contextual material.

## File contract

Create `data/editions/<number>.json`. The file must contain:

| Field | Content |
| --- | --- |
| `schemaVersion` | Data contract version, currently `1` |
| `chapterId` | The original chapter's stable Arabic-number equivalent |
| `version` | Editorial text version, initially `0.1.0` |
| `document` | Original and English title, established date, place and source languages |
| `source` | Archive identifier, complete-source PDF SHA-256, local excerpt ID, printed labels and scan positions |
| `coverage` | `complete-chapter` or `selected-passages`, boundary note, included and excluded material |
| `transcriptionPolicy` | Actual treatment of spelling, typography, abbreviations and uncertainties |
| `paragraphPolicy` | Original paragraph structure and any editorial segmentation |
| `segments` | Ordered matched original/English passages with stable IDs, kind, label, language, source pages and note references |
| `notes` | Stable note IDs, types (`transcription`, `translation`, `context`) and explanations |
| `relations` | Explicitly supported connections to other chapters and supporting passage IDs |
| `review` | Separate transcription, translation and human-review states, with dated review events |

Each segment has `id`, `kind`, `label`, `language`, `original`, `english`, `sourcePages` and `noteIds`. Use stable identifiers such as `ch99-p1`; never renumber unrelated passages merely because an earlier passage was added. Both language fields must contain the corresponding text. A missing translation is not an invitation to substitute an analytical summary.

Use `heading`, `preamble`, `provision`, `dateline`, `signature` or `publication` for passage kinds. Use source language codes such as `it` and `la`. A passage spanning two pages must list both scan positions. Every referenced page must be present in the edition's linked local excerpt.

Supported textual review states are `ai-draft`, `ai-checked` and `human-reviewed`. Use `human-reviewed` only after an actual human reviewer checks the identified textual layer, with that person's responsibility recorded in the review events. Human review starts `pending`; recording another AI pass does not change it to complete. Review descriptions must state the work actually performed.

## Passage citations and revisions

Passage links use `#/chapter/99?passage=ch99-p1`. The citation identifies Gastaldi's edition and printed page together with the atlas's chapter, passage ID and editorial version. The English wording belongs to the atlas translation; do not present it as words printed in English in 1684.

Increment the editorial version when changing transcription or translation, and append a dated event explaining the correction and its evidence. Git history preserves the earlier text. A passage permalink displays the current edition; the version in a copied citation identifies the reading used and can be traced through repository history.

## Coverage, builds and validation

`scripts/build.mjs` generates the edition index at `dist/data/editions/index.json` and includes its small metadata list in the application payload. Full edition files are copied separately and fetched only when their chapter is opened. Coverage labels, filters and counts derive from that index.

`scripts/check.mjs` checks pairing, stable IDs, page mappings, note/relationship references, review states and deployment paths. These checks protect the structure of the edition. They cannot establish that an Italian word was read correctly or that an English rendering is the best interpretation.

The initial workbook remains a dated catalogue snapshot. The JSON catalogue and chapter editions are the working sources for subsequent corrections. The import script reconstructs the initial workbook-based catalogue; review and preserve later editorial changes before using it to regenerate data.

## Useful editorial standards

The representation follows lightweight principles from the Text Encoding Initiative: identify unclear readings, distinguish original text from editorial interventions, state responsibility and retain a revision history. The site stores JSON rather than requiring an XML publishing stack.

- [TEI: representation of primary sources](https://tei-c.org/release/doc/tei-p5-doc/en/html/PH.html)
- [TEI: unclear readings](https://tei-c.org/release/doc/tei-p5-doc/en/html/ref-unclear.html)
- [TEI: revision descriptions](https://tei-c.org/release/doc/tei-p5-doc/en/html/ref-revisionDesc.html)


## Chapters 63–72 — 4 November 2026

Ten complete reading editions add 110 paired passages and ten chapter-specific PDF facsimiles (printed pp.311–326, scans 395–410). The site now has 32 chapter editions and 39 excerpt records. Shared full-page images are reused between adjacent excerpts without changing chapter-specific PDF boundaries.

Chapter 63 includes the entire fourteen-district staffing roster after the signatures. Image checks corrected OCR errors in its date (27 June) and medical penalty (500 scudi), chapter 66’s “all of Poland”, and chapter 72’s reference to the 25th of the preceding month. Chapter 68 is catalogued cautiously: the order seeks named or described persons but does not establish a diagnosis or specific exposure. Legal and livestock terminology requiring specialist review is retained or qualified in the individual notes. Human review remains pending.
