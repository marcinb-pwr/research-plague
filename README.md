# Research Plague — Gastaldi's Rome

An interactive research wiki for exploring Girolamo Gastaldi's *Tractatus de avertenda et profliganda peste politico-legalis* (Bologna, 1684) and the Roman plague response of 1656–1657, including subsequent orders through 1658.

The site connects **204 chapters of edicts and operational instructions** with **13 analytical groups**, expanded provisions, and selected original-page PDF excerpts. Chapter pages now distinguish summary, facsimile, transcription and translation coverage. Complete bilingual reading editions now cover **22 chapters: 42–62 and 99**, with aligned Italian and English passages, source-page links, editorial notes and explicit review status.

It is a static website: no database, account system or external service is needed to browse the catalogue. Full chapter editions are loaded on demand.

## Explore

- Search the chapter catalogue and filter by subject or action.
- Follow links between thematic groups and chapter pages.
- Read concise English paraphrases alongside original page images and downloadable PDF excerpts.
- Read paired original-language text and English working translations where an edition is available; filter the chapter index to find them.
- Link to an individual passage, copy its versioned translation citation and follow explicit documentary references.
- Check transcription, translation and human-review status separately.
- Distinguish enacted orders from general recommendations elsewhere in the treatise.
- Consult the methodology and glossary before comparing interventions.

The book contains **261 chapters overall**. Chapters 42–227 reproduce 186 edict/order chapters; chapters 228–245 contain 18 instruction chapters. These are documents, **not 204 independent NPIs**. Repeated bans, local extensions, renewals and repeals remain visible.

## Run locally

Use Node.js 22 or newer (the publishing workflow uses Node.js 24). There are no npm dependencies to install.

```sh
git clone https://github.com/marcinb-pwr/research-plague.git
cd research-plague
npm run build
npm test
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080/`. The last command needs Python 3; any static HTTP server can serve `dist/` instead.

The browser downloads the catalogue and local source assets from the same site. Source-reader links to the complete historical scan require internet access. Changes to source files require rebuilding `dist/`.

## Publish with GitHub Pages

The repository includes a publishing workflow in [`.github/workflows/pages.yml`](.github/workflows/pages.yml). Every push to `main` builds, validates and publishes the website. Pull requests build and validate without publishing. No `PAGES_AUTO_DEPLOY` variable is needed.

1. In the repository, open **Settings → Pages** and select **GitHub Actions** as the publishing source.
2. Push a change to `main`, or open **Actions → Validate and publish wiki → Run workflow**, choose `main`, and run it.
3. Read the successful `github-pages` deployment's URL from the workflow. That reported URL is the authoritative published address.

Use **GitHub Actions**, not **Deploy from a branch**: the homepage and its data bundle are generated into `dist/`. Publishing the repository root directly uploads source files without a root `index.html` and produces a 404. The custom workflow uploads the contents of `dist/` as the Pages artifact.

The workflow uses the built-in repository token and GitHub's Pages environment. It does not require a personal access token. The actions are pinned to verified commits with their upstream major versions recorded in comments.

For this repository, the project-site address is `https://marcinb-pwr.github.io/research-plague/`. Check the workflow's **deploy** job, not only its **build** job, when diagnosing publication.

See GitHub's official guides on [custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) and [selecting a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Publish elsewhere

Upload the contents of `dist/` to any static host. Relative asset paths and hash-based article routes allow the site to run at a domain root or a repository subdirectory without server rewrite rules.

The historical excerpts are local assets, so the selected evidence remains readable even if an external PDF embed is unavailable. The complete original volume is linked rather than bundled.

## Repository structure

| Path | Purpose |
| --- | --- |
| `site/` | HTML, styles and browser application |
| `data/catalogue.json` | Group, chapter, supplementary-section and glossary content |
| `data/excerpts.json` | Excerpt metadata, page mapping and source provenance |
| `data/editions/*.json` | Versioned original text, English translation, notes and review history per chapter |
| `public/excerpts/` | Original-page PDF extracts and browser page images |
| `public/images/` | Historical illustration used by the site |
| `scripts/build.mjs` | Reproducible static build |
| `scripts/check.mjs` | Data coverage, references and local asset validation |
| `dist/` | Generated deployable website; not source-edited |

The build generates `dist/data/editions/index.json` from the edition files. It includes only coverage metadata in the initial application payload; the full texts remain separate downloadable JSON files.

## Research and corrections

Read [SOURCES.md](SOURCES.md) for bibliographic details, evidence distinctions and pagination. Read [CONTRIBUTING.md](CONTRIBUTING.md) before editing the catalogue or adding an excerpt.

The catalogue summaries and thematic groups are analytical aids. Full-text editions have their own coverage statements and transcription policies; they currently contain AI-prepared, image-checked transcriptions and English working translations, with human specialist review pending. This status is not a certification of textual accuracy. See [the editorial workflow](docs/EDITIONS.md) for adding and reviewing a chapter.

The workbook is the initial catalogue snapshot of 3 November 2026. The JSON catalogue and versioned chapter editions contain subsequent source-based editorial revisions. Orders establish what authorities prescribed; they do not prove uniform compliance or the effectiveness of each measure. Historical remedies are not contemporary medical advice.

## Rights

The underlying 1684 text is historical public-domain material. Its digitization provenance is retained with each excerpt; consult the source provider's notices for the scan. No blanket license for the new code, catalogue or editorial content is assigned here. The repository owner can select an appropriate license separately.
