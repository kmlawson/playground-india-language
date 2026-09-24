# Languages of India, 1931

An interactive SVG map of the mother-tongue returns in the **Census of India, 1931**, in two parts:

- **Province map** (`index.html`): Vol. I (India), Part II (Imperial Tables), **Table XV: Language**. It has
  Part I (mother tongue) for 35 provinces, states and agencies, and Part II (bilingualism).
- **District map** (`districts.html`): Table XV Part I from **24 provincial and state volumes**. The figures
  are grouped onto present-day district boundaries through a district lineage running from 1931 to 2024.
  Click a unit to see its mother tongues, its 1931 areas with scan links, and its population in every census
  from 1901 to 2011 (Census 2011, Table A-2).
- **Province tables** (`data.html`) and **District tables** (`regional.html`): every transcribed figure,
  searchable and linked to its page scan. The district tables hold 16,573 mother-tongue rows (Part I) and
  23,808 subsidiary-language rows (Part II).

Live site: https://kmlawson.github.io/playground-india-language/

No build step, no libraries: plain HTML, CSS and JavaScript over pre-built data files.

## What is here

| Path | What |
|---|---|
| `index.html`, `app.js`, `styles.css` | the province map, essay, cautions and bilingualism section |
| `districts.html`, `districts-app.js` | the district map and its method notes |
| `data.html`, `browse.js` | Province tables: search, filter and sort every Vol. I figure, each linked to its page scan |
| `regional.html`, `regional-browse.js`, `data/regional.js` | District tables: every figure transcribed from the provincial and state volumes (Parts I and II) |
| `version.js` | site version and last-update date, shown on every page |
| `data/census.js`, `data/table15.csv`, `data/languages.csv` | Vol. I Table XV Part I: every figure, the classification tree, all-India totals |
| `data/bilingual.js`, `data/bilingual.csv` | Vol. I Table XV Part II: 54 mother tongues × subsidiary languages |
| `data/checks.js` | the arithmetic checks listed on the province page |
| `data/geo.js`, `data/units1931.geojson`, `data/areas.js` | 1931 unit geometry (projected SVG paths and GeoJSON), and polygon areas checked against Table I |
| `data/districts.js` | district map units: geometry, figures, member areas, scan links |
| `data/regional_table15.csv` | every figure used from the provincial volumes, long format, with its Vol. I match and map unit |
| `docs/regional.md` | **how the district map was made: every normalisation rule, crosswalk and correction** |
| `docs/regional_*.csv` | the alias, crosswalk and check tables behind `docs/regional.md`, row by row |
| `source/transcribed/`, `source/transcribed_bilingual/` | hand transcription of Vol. I, one JSON file per scan leaf |
| `source/regional/KEY/leafNNNN.json` | hand transcription of Table XV (Parts I and II) of each provincial and state volume, one file per scan leaf; `manifest.json` lists the volumes and leaves, `BRIEF.md` the rules, `check.py` the arithmetic |
| `source/verification/` | the blind re-reading of a random sample of 250 cells |
| `source/BRIEF.md`, `source/BRIEF_BILINGUAL.md`, `source/crop.py` | transcription instructions and crop helper |
| `source/geo/` | boundary inputs (plague_india, the Rann of Kutch from OSM; the rest are fetched) |
| `tools/` | build and check scripts (see below) |
| `tools/regional/` | loading, normalising and crosswalking the provincial volumes |

## Where the data came from

**Census figures.**
- Vol. I Part II: Internet Archive
  [`india.history.resource.92539`](https://archive.org/details/india.history.resource.92539). Table XV
  Part I is on scan leaves 477–514 (printed pages 472–509), and Part II on leaves 515–517 (pp. 510–512).
- The provincial and state volumes: the Internet Archive items listed in `docs/regional.md` §1.
- All are Government of India publications of 1932–34 and in the public domain.

**1931 boundaries.**
- W. Tennant's [plague_india](https://github.com/wtennant/plague_india), 1931 layer (LGPL-3.0), with its
  latitudes rescaled to WGS84 (`tools/latfix.py`).
- Refined with [geoBoundaries](https://www.geoboundaries.org/) ADM2 district lines for India, Pakistan and
  Bangladesh, and Natural Earth admin-1 for Myanmar, wherever those follow the 1931 lines.
- The Rann of Kutch outline is from OpenStreetMap.
- Coastlines and neighbouring countries are from Natural Earth.

**District lineage.**
- The *India State and District Evolution Database, 1872–2025*, by Jolad, Kalra and Singh, Harvard
  Dataverse, [doi:10.7910/DVN/D1AGUR](https://doi.org/10.7910/DVN/D1AGUR) (CC BY 4.0).

**Population 1901–2011.**
- Census of India 2011, Table A-2 (decadal variation in population since 1901), district level, on 2011
  boundaries. Office of the Registrar General and Census Commissioner, India.

**Present-day districts.**
- geoBoundaries ADM1 and ADM2 for India, and ADM2 for Pakistan and Bangladesh.
- Burma: its 1931 districts and states, from the administrative layer of the
  [Japanese Empire map](https://froginawell.net/reference/japanese-empire/).

## How it was put together

**1. Transcription, by eye.** People read every figure from the page images and typed it into JSON with its
printed column number. No OCR was used at any stage: no OCR engine, no image-description service, and not
the Internet Archive's OCR text. A figure that could not be read is recorded as illegible and never guessed.
Misprints are kept as printed and flagged.

**2. Arithmetic checks (Vol. I).**
- `tools/check.py` tests persons = males + females in every cell, and the Provinces, States and India
  totals in every column.
- `tools/build_data.py` tests every printed group total against its members.
- A second reader re-read 250 random cells blind (`source/verification/`).

**3. Geometry (province map).** `tools/build_geo.py`:
- separates the units that plague_india merges, using present-day districts;
- replaces the hand trace with present-day lines wherever those follow the 1931 boundary;
- limits which 1931 units may lie inside each present-day state, and reassigns overshoots;
- sweeps slivers and detached fragments into their neighbours, and fills holes;
- simplifies all shapes together (`shapely.coverage_simplify`), so neighbours share one line.

`tools/geo_audit.py` reports gaps, thin strips and stray fragments. `tools/area_check.py` compares each
polygon's area with the area printed in Table I: the map total is within 1.4% of the printed figure.

**4. The provincial volumes (district map).** `tools/regional/`:
- `load.py` chooses the records of each volume;
- `normalize.py` reduces each area's rows to non-overlapping *leaves*, keeps residuals of partly itemised
  groups, and matches each leaf to the Vol. I classification;
- `crosswalk.py` links each printed area to its 1931 node in the lineage;
- `adm2.py` links each present-day district to its latest node;
- `build_districts.py` joins everything into connected *map units* and adds hand mappings for Pakistan,
  Bangladesh, Jammu and Kashmir and Burma.

Hindustani, Hindi and Urdu as printed get their own entry and a composite, because the provincial volumes did
not divide them as Vol. I did. The full method is in **[docs/regional.md](docs/regional.md)**.

## Rebuilding

    python3 tools/check.py                      # Vol. I arithmetic report
    python3 tools/build_data.py                 # -> data/census.js, data/*.csv, data/checks.js
    python3 tools/build_bilingual.py            # -> data/bilingual.js, data/bilingual.csv
    tools/fetch_sources.sh                      # boundary inputs (and the Vol. I scan, for checking)
    python3 tools/latfix.py                     # needs pyshp
    python3 tools/build_geo.py                  # needs shapely + pyshp -> data/geo.js, data/units1931.geojson
    python3 tools/regional/build_districts.py   # needs shapely, pyshp, openpyxl; ISDED in source/isded/ and
                                                #   geoBoundaries India ADM1/ADM2 in source/geo/ (both fetched above),
                                                #   Census 2011 Table A-2 in source/census2011/ -> data/districts.js
    python3 tools/regional/build_browser.py     # -> data/regional.js
    python3 tools/regional/export_docs.py       # -> docs/regional_*.csv

## Licence

This project's own code, transcriptions, documentation and text are dedicated to the public domain
(CC0 1.0). No rights are claimed. Third-party data keeps its own licence, and so do files derived from it:

- plague_india: LGPL-3.0;
- geoBoundaries India: ODbL 1.0;
- geoBoundaries Pakistan: public domain;
- geoBoundaries Bangladesh: CC BY 3.0 IGO;
- OpenStreetMap: ODbL 1.0;
- Natural Earth: public domain;
- ISDED: CC BY 4.0;
- Census 2011 Table A-2: Government of India published data;
- census figures and scans: public domain.

Details are in [LICENSE](LICENSE). The design follows the
[Japanese Empire map](https://froginawell.net/reference/japanese-empire/).

## Versions

The version is **1.xxx**, where xxx counts the pushes to the published site; it goes up by one on every push.
The number and date appear at the foot of every page (`version.js`).

- **1.011** (24 September 2026)
  - District map: no unit is drawn over another. geoBoundaries' "data not available" polygon had hidden
    Gilgit-Baltistan and Azad Kashmir, and smaller overlaps sat along the borders between sources.
  - Block labels sit in the middle of their block (the Bengali label is now in Bengal).
  - Hover boxes: the figures sit on their own line under the language name.
  - Phones: the header links fold into a Menu button, in two groups (pages; sections of the province map page).
  - Touch: after a pinch, lifting one finger no longer makes the map jump. The remaining finger now pans from
    where it is. Two fingers placed close together no longer start a huge zoom.
- **1.010** (24 September 2026)
  - "Largest language" on both maps: a colour per language, with related languages in related colours
    (Indo-European reds to olives, Dravidian greens, Karen teal, Tibeto-Chinese blues, Austric violets;
    `langcolors.js`). A lighter tint marks a largest language under half the population. One label per
    contiguous block of units with the same language, and a legend of colour chips grouped by family.
  - A selected unit's card sits above the controls, up to two-thirds of the window; each scrolls on its own.
  - Slimmer mode and measure buttons; bigger city dots.
  - French Indo-China drawn as one polygon.
  - The 1931 atlas links on district cards open DSAL's Mirador viewer, which shows the plate image.

- **1.009** (24 September 2026)
  - Province map: no dashed or hatched marks. Areas without figures are plain grey, and the explanations are in
    the hover box and info pane. The NWFP agencies (garrisons only) are grey in the colour views.
  - Label positions checked against their units: the Central Provinces States, Central India Agency, Bombay
    States, NWFP districts and agencies, and United Provinces States labels had sat over a neighbour. A label
    moved out of a collision now stays over its own unit.
  - The "Modern borders" toggle is gone from the province map as well.
  - The selection outline is a bright pastel yellow.
  - Further reading: 17 works from the bibliographies of Majeed (2018) and Mishra (2020), on Hindustani, Punjab,
    Lahnda, Kashmir, Assam, Mithila, Orissa, Burma's language survey, Adivasi history and post-1947 language
    politics.
- **1.008** (24 September 2026), released as 2.2
  - One header on every page, with the same links (the current page marked). "Start here" opens the tour
    from any page. The number switch sits in the map toggles and the table toolbars.
  - Family and branch names that occur in more than one section of the classification carry their section,
    e.g. "Indo-European Family (languages of India)" and "Indo-European Family (European languages)".
- **1.007** (24 September 2026), released as 2.1
  - District map: no red outlines or hatching on the map. Areas without figures are plain grey, and the
    info card says why.
  - A selected area's card moves to the top of the side panel; × clears it.
  - Number-format switch in the header of every page: Indian (1,23,456; lakh, crore) or international
    (123,456; thousand, million). It is remembered, and `?num=intl` in a link sets it.
  - In-page links no longer scroll section headings under the sticky header.
  - District map: only district units are drawn. The 1931 province outlines are built from them, and every
    present-day district without figures is its own grey unit with a note. The "Modern borders" toggle is
    gone. The number switch sits in the map toggles on both maps. The selection outline is light yellow.
  - District map: quick buttons for the 22 largest languages, the Hindi composite and the Burma group.
  - No red anywhere on the site: links, notes, flags, focus rings and checkboxes are blue, and the "more women"
    end of the females-per-1,000-males scale is orange.
  - District map: hovering (or tabbing to) a bar of the population chart shows a card with the figure and
    the change since the previous census.
  - District map cards link the relevant provincial plate(s) of the *Imperial Gazetteer of India, Atlas* (1931)
    at the Digital South Asia Library, and explain why a unit groups several 1931 areas.
  - Burma is drawn on its 1931 districts (from the Japanese Empire map's admin layer) instead of by division.
- **1.006** (24 September 2026), released as 2.0
  - District map from 24 provincial and state volumes, drawn on present-day districts through the 1931–2024
    district lineage.
  - Each unit's population in every census 1901–2011 (Census 2011, Table A-2), checked against 1931.
  - District tables: every transcribed figure of Table XV Parts I and II, with scans.
  - Transcriptions added under `source/regional/`.
  - `docs/regional.md` documents the method.
  - Licence is now CC0 for this project's own work.
  - Lighter hatching.
- **1.005**: guided tour, reading guide, interpretive safeguards and accessibility.
- **1.004**: bilingualism (Table XV Part II).
- **1.003**: boundary cleanup throughout the map.
- **1.002**: removed a false Punjab strip between Bahawalpur and Bikaner.
- **1.001**: the province map of Vol. I Table XV Part I, with the Province tables.
