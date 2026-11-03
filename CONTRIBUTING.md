# Contributing to Research Plague

## Where to edit

Edit `data/catalogue.json` for chapter summaries, grouping, related chapters, glossary terms and general counsel. Edit `data/excerpts.json` when adding or correcting a source extract. Add original text and paired English translations in `data/editions/<chapter-id>.json`, following [the edition workflow and data contract](docs/EDITIONS.md). Keep changes to HTML, styling and interactions in `site/`.

Rebuild and validate after changes:

```sh
npm run build
npm test
```

Do not edit generated `dist/` files directly.

The build derives the edition index from the individual edition files. Do not maintain a separate handwritten coverage count. Excerpt `readingGuide` fields are paraphrases; reserve edition segment `english` fields for translations of the corresponding `original` text.

## Editorial rules

1. **Preserve identifiers.** Chapter IDs are the original Arabic equivalents of Gastaldi's Roman chapter numbers. The operational catalogue covers exactly 42–245. Keep group IDs stable so incoming links remain useful.
2. **Cite the original.** Give the chapter and printed page or page range. Add the source scan page separately when a reader jump is available.
3. **Read operative text.** A chapter heading is not sufficient to claim a complete summary of its provisions. Label uncertainty and incomplete verification rather than filling gaps from expectation.
4. **Separate quotation, translation and paraphrase.** Text in quotation marks should be checked against the image. Label an English translation as such; an analytical description is not a verbatim translation.
5. **Retain policy changes.** Renewals, exemptions, geographic extensions, reopening and repeal are important historical information. Do not collapse them into an unsupported count of unique interventions.
6. **Distinguish evidence levels.** A prescription is not proof of compliance. A measure described for another place or recommended in a general chapter is not automatically an enacted Roman policy.
7. **Preserve difficult history.** Accurately identify coercion, status-based exclusions and rules targeting Jewish or Roma people and beggars. Do not recast these as neutral infection classifications.
8. **Do not infer modern efficacy from resemblance.** Historical fumigation, vinegar use, animal killing and miasmatic reasoning need their own assessment. Avoid presenting the book as current medical guidance.
9. **Avoid causal overstatement.** Comparisons with Naples need evidence about chronology, coverage, administration, resources and implementation; counts of orders do not estimate treatment effects.

## Add a source excerpt

Use an unmodified selection of pages from the cited primary-source PDF. Preserve original margins, pagination and available OCR. The website's description belongs in metadata, not on top of the source page.

Each excerpt should include:

- A stable lowercase ID, title and concise description.
- Relevant chapter IDs.
- The printed page label(s).
- The corresponding **one-based PDF scan page numbers**.
- A downloadable PDF and a browser image for each included page.
- A thumbnail, source URL and digitization provenance.
- Any uncertainties or OCR limitations.

PDF scan page numbers are not interchangeable with printed page numbers. The source contains preliminary matter, plates and duplicated printed pagination; never apply a single offset to the entire book.

Place PDF and image files in `public/excerpts/` and use relative paths such as `excerpts/reporting.pdf` in the manifest. Check the resulting images visually. Confirm that the PDF and image sequence agree with the manifest.

## Links and accessibility

Use hash-based internal article links, such as `#/chapter/126`. Keep site assets relative so project-subdirectory hosting works. Ensure interactive controls have accessible labels and keyboard focus, and that an original-page image has meaningful alternative text or an accompanying page caption.

Do not add trackers, third-party fonts, remote script dependencies or account requirements merely to display the catalogue.

## Proposing a correction

Describe the affected chapter, the existing statement, the proposed revision and the evidence. Include the original printed page and scan page, and explain whether the change corrects transcription, translation, categorization or interpretation.

This repository does not grant a new blanket license to incoming material. Preserve applicable third-party notices and let the repository owner decide licensing changes.
