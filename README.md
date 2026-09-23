# Languages of India, 1931

An interactive SVG map of the mother-tongue returns in the **Census of India, 1931**:
Vol. I (India), Part II (Imperial Tables), **Table XV, Part I — Language (Mother Tongue)**.

Live site: https://kmlawson.github.io/playground-india-language/

## What is here

| Path | What |
|---|---|
| `index.html`, `styles.css`, `app.js` | the map page (no build step, no libraries) |
| `data.html`, `browse.js` | the table browser: search/filter/sort every figure, each linked to its page scan |
| `data/census.js` | every figure of Table XV Part I, with the classification tree |
| `data/table15.csv` | the same, long format (language × unit × persons/males/females) |
| `data/languages.csv` | the classification with all-India totals |
| `data/geo.js` | projected SVG paths for the 35 census units |
| `data/checks.js` | the arithmetic checks shown on the page |
| `data/bilingual.js`, `data/bilingual.csv` | Table XV Part II (bilingualism): 54 mother tongues × their subsidiary languages |
| `source/transcribed_bilingual/pNNN.json` | hand transcription of Part II (scan leaves 515–517) |
| `source/transcribed/pNNN.json` | the hand transcription, one file per scan leaf (477–514) |
| `source/BRIEF.md`, `source/crop.py` | the instructions and crop helper used for the transcription |
| `source/geo/plague_india/` | 1931 base boundaries from W. Tennant's plague_india (LGPL-3.0) |
| `tools/` | `check.py` (arithmetic), `build_data.py`, `latfix.py`, `build_geo.py`, `fetch_sources.sh` |

## How the figures were made

The scan is Internet Archive item
[`india.history.resource.92539`](https://archive.org/details/india.history.resource.92539), leaves 477–514
(printed pages 472–509). Every figure was read from the page images — no OCR — and recorded with the
printed column number. `tools/check.py` then tests persons = males + females in every cell, the Provinces /
States / India totals in every column, and `tools/build_data.py` tests each printed group total against its
members. Where the printed table is itself inconsistent the printed figure is kept and listed on the page.

    python3 tools/check.py          # arithmetic report
    python3 tools/build_data.py     # -> data/census.js, data/*.csv, data/checks.js
    python3 tools/build_bilingual.py  # -> data/bilingual.js, data/bilingual.csv
    tools/fetch_sources.sh          # boundary inputs (and the scan, for checking)
    python3 tools/latfix.py         # needs pyshp
    python3 tools/build_geo.py      # needs shapely + pyshp -> data/geo.js

## Licences

Census figures: public domain. Boundaries: plague_india (LGPL-3.0; its licence is in
`source/geo/plague_india/LICENSE`), geoBoundaries (Pakistan: public domain; India: ODbL 1.0;
Bangladesh: CC BY 3.0 IGO), Natural Earth (public domain), and the Rann of Kutch outline from
OpenStreetMap (© OpenStreetMap contributors, ODbL). `tools/area_check.py` compares each polygon with the
area printed in Table I (`source/reference/table1_area_sq_miles.json`). Design after the
[Japanese Empire map](https://froginawell.net/reference/japanese-empire/).
