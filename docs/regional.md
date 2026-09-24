# The district map: sources, normalisation and crosswalks

This file documents how `districts.html` and its data (`data/districts.js`, `data/regional_table15.csv`)
are made from the provincial and state volumes of the Census of India, 1931. It covers every rule
applied to the transcribed figures and every hand-made link between areas. The CSV files next to this
document list the rules row by row. The code is in `tools/regional/` and `tools/lineage.py`.

Contents:

1. Sources
2. Transcription
3. Choosing the records (`load.py`)
4. From printed rows to leaves (`normalize.py`)
5. Matching language names to the Vol. I classification
6. Hindustani, Hindi and Urdu
7. Checks
8. From 1931 areas to present-day districts (`lineage.py`, `crosswalk.py`, `adm2.py`, `build_districts.py`)
9. What the map shows, and what it hides (`districts-app.js`)
10. Rebuilding
11. Known problems

---

## 1. Sources

**Figures.** The source is Table XV (“Language”), Part I (mother tongue), in the tables part of each provincial
and state volume of the *Census of India, 1931*. The scans are on the Internet Archive. `source/regional/manifest.json`
gives each volume's identifier and scan leaves, and each area in the map's side panel links to the leaf it
comes from. The volumes used are:

| key | volume | Internet Archive item |
|---|---|---|
| ajmer | Vol. 26, Ajmer-Merwara | in.ernet.dli.2015.105680 |
| andaman | Vol. 2, Andaman and Nicobar Islands | in.ernet.dli.2015.105673 |
| assam | Vol. 3, Assam, Pt. 2 | in.ernet.dli.2015.56020 |
| baluchistan | Vol. 4, Baluchistan | in.ernet.dli.2015.56021 |
| bengal | Vol. 5, Bengal and Sikkim, Pt. 2 | in.ernet.dli.2015.56024 |
| bihar_orissa | Vol. 7, Bihar and Orissa, Pt. 2 | in.ernet.dli.2015.56027 |
| bombay | Vol. 8, Bombay Presidency, Pt. 2 | in.ernet.dli.2015.56029 |
| aden | Vol. 8, Pt. 3, Aden | in.gov.ignca.31111 |
| wisa | Vol. 10, Western India States Agency | in.ernet.dli.2015.56032 |
| burma | Vol. 11, Burma, Pt. 2 | in.ernet.dli.2015.56035 |
| cp_berar | Vol. 12, Central Provinces and Berar, Pt. 2 | in.ernet.dli.2015.56037 |
| madras | Vol. 14, Madras, Pt. 2 | in.ernet.dli.2015.56039 |
| nwfp | Vol. 15, North-West Frontier Province | in.ernet.dli.2015.56040 |
| punjab | Vol. 17, Punjab, Pt. 2 | in.ernet.dli.2015.56042 |
| up | Vol. 18, United Provinces, Pt. 2 | in.ernet.dli.2015.56044 |
| baroda | Vol. 19, Baroda, Pt. 2 | in.ernet.dli.2015.56048 |
| cia | Vol. 20, Central India Agency, Pt. 2 | in.gov.ignca.31130 |
| cochin | Vol. 21, Cochin | in.ernet.dli.2015.105676 |
| gwalior | Vol. 22, Gwalior, Pt. 2 | in.ernet.dli.2015.116061 |
| hyderabad | Vol. 23, Hyderabad State | in.ernet.dli.2015.105678 |
| jk | Vol. 24, Jammu and Kashmir, Pt. 2 | in.ernet.dli.2015.56050 |
| mysore | Vol. 25, Mysore, Pt. 2 | in.ernet.dli.2015.56052 |
| rajputana | Vol. 27, Rajputana Agency | in.ernet.dli.2015.105322 |
| travancore | Vol. 28, Travancore, Pt. 2 | in.ernet.dli.2015.105681 |

Some volumes were transcribed but are not used on the map. Calcutta (Vol. 6) repeats figures already in
Bengal. Cities of Bombay (Vol. 9) repeats the city rows of Bombay. Delhi (Vol. 16) and Coorg have no
district table, so the map uses their province rows from Vol. I.

**District lineage.** The lineage comes from the *India State and District Evolution Database, 1872–2025*
(ISDED), by Shivakumar Jolad, Ayushi Kalra and Mahendra Singh, on the Harvard Dataverse:
[doi:10.7910/DVN/D1AGUR](https://doi.org/10.7910/DVN/D1AGUR), licence **CC BY 4.0**. Three of its files are
used: `district_evolution_1872_1941.xlsx`, `district_consolidation_1941_1951.xlsx` and
`district_proliferation_1951_2024.xlsx`. It is read from a local copy and is not redistributed here.

**Present-day boundaries.**
- [geoBoundaries](https://www.geoboundaries.org/) ADM1 and ADM2 for India (ODbL 1.0).
- geoBoundaries ADM2 for Pakistan (public domain) and Bangladesh (CC BY 3.0 IGO).
- [Natural Earth](https://www.naturalearthdata.com/) admin-1 for Myanmar (public domain).
- The 1931 province outlines drawn underneath come from the province map (`data/geo.js`). See the main
  `README.md` for their sources.

## 2. Transcription

People read every figure from the page images. **No OCR** was used: no OCR engine, no image-description
service, and not the Internet Archive's own OCR text. The rules they followed are in `source/regional/BRIEF.md`.

The figures were recorded as printed, one JSON file per scan leaf (`source/regional/KEY/leafNNNN.json`).
For each cell the reader recorded:
- the area and its path of headings;
- the language and its path of group headings;
- persons, males and females;
- the printed column numbers.

A figure that could not be read is recorded as `"?"`, with a note, and never guessed. Each leaf was then
checked in two ways:
- persons = males + females in every cell;
- the parts add up to every printed total.

Where the print itself does not add up, the printed figures were kept and the problem noted. They were not
corrected.

## 3. Choosing the records (`tools/regional/load.py`)

The volumes differ in layout, and some print the same figures twice. `CONFIG` in `load.py` lists the rules
applied to each volume:

| volume | rule | why |
|---|---|---|
| burma | leaves 234–237 only | Table XV Part I-D: every language group by district. The other parts give single languages for the province only. |
| bengal | leaves 192–200 and 202; sections “Part A” and “Part C” only | Part A: districts and states. Part C: Sikkim. Part B (cities) and the supplements repeat figures already in Part A. |
| calcutta | skipped | Repeats Bengal's Calcutta row and city rows. |
| gwalior | leaves 151–157; only “Gwalior State” is a total | Leaf 158 holds the cities (Part B). |
| aden | religion “All Religions” only | The Aden table is also broken down by religion. |
| travancore | the Lowland, Midland and Highland rows are dropped | These are natural divisions that overlap the administrative ones. |
| ajmer, cochin | the single area counts as a district | Otherwise it is printed as the volume total. |

Records from Part II (subsidiary language) are not used on the district map.

## 4. From printed rows to leaves (`tools/regional/normalize.py`)

Each area of each volume is taken in turn.

1. **Population row.** A row named “Population”, “Total”, “All languages”, “Total population” or the area's
   own name, with no heading above it, is the area's population (regex `TOP`). If there is more than one,
   the largest is used.
2. **Members.** For every other row the program finds the rows printed under it: rows whose heading path
   contains its name. A row printed as “Total X” in the same group as its members (the Central India Agency's
   “Total Bhil Dialects”) also counts those same-group rows as members.
3. **Leaves.** A row with no members is a *leaf*. Leaves never overlap, and they are the only rows added up.
   Two kinds of row are dropped even though they have no members:
   - a section total whose detail is printed beneath it;
   - a second “Total” row where detail rows exist.
4. **Residuals (marked Σ).** Sometimes a printed group total is larger than the sum of its largest members.
   Usually the volume named only the main languages of the group, but sometimes a member is illegible. The
   difference is then kept as a separate leaf, named after the group, and marked **Σ** (“printed total less
   the entries listed under it”). This rule does not apply to *structural* totals. These are rows whose
   names contain *language, vernacular, family, branch, group, Asiatic, European, Indian, part* or a bare
   section letter (regex `SECTION`). Their differences are misprints, not missing languages.
5. **Illegible cells.** If persons is illegible but males and females are legible, persons = males +
   females, marked Σ. If males or females is illegible, the leaf is marked **?**.
6. **Area totals.** Rows for provinces, divisions and similar totals are kept in `regional_table15.csv`
   with `area_is_total = True`. They are never added into the map.
7. **Area names.** Area names are compared in a normalised form (`area_key`), so that spelling variants of
   one area across leaves are joined. There is also one hand alias, `AREA_ALIAS` (Muzaffrabad → Muzaffarabad).

## 5. Matching language names to the Vol. I classification

Each leaf is placed in the classification of the all-India volume (Vol. I, Part II, Table XV; `data/census.js`),
so the same language can be mapped across volumes. The program tries these steps in order:

1. the printed name, then variants of it (without brackets, each part of “X or Y”, the text in brackets);
2. `ALIAS`: a printed spelling mapped to the Vol. I name (Punjabi → Panjabi, Kannada → Kanarese, Marwari →
   Rajasthani, Sourashtra and Saurashtri → Gujarati, Miri → Abor, Korava/Yerukala → Tamil, …);
3. `SUFFIX_ALIAS`: a dialect printed with its group in brackets, such as “Vaiphei (Kuki)” or “Maram (Naga)”,
   is matched to “Other or unspecified Kuki Sub-Group” or “Other or unspecified Naga Languages”;
4. the headings above the leaf, from the nearest upwards (`GROUP_ALIAS` for group names spelled differently).
   A leaf matched this way counts as that group's “other or unspecified” speakers.

Rows printed as “Other … languages” are matched to their group through `ALIAS` (for example “Other Munda
Languages” → Munda Branch, “Other Asiatic Languages” → section B).

Some aliases follow the volume's own classification where Vol. I has no separate entry:
- Saurashtri is placed under Gujarati, as in Mysore;
- Korava, Yerukala and Kaikadi under Tamil, as in the Central Provinces and Mysore;
- Limbu under Kiranti;
- Lahuli under the Tibeto-Himalayan Branch.

The full table is in `docs/regional_language_aliases.csv`. `docs/regional_language_matches.csv` lists every
distinct printed name, the Vol. I entry it was matched to, how it was matched, and the number of persons.

**Not matched.** 4,324,533 persons are not matched. Of these, 4,284,704 are Burma's “X. Indian languages”:
the district table for Burma gives language groups only and puts every Indian language in one row. The
rest are a few rows with no group given (“Total Group D” in Bombay, “Other languages” in the United
Provinces), and some single dialect names in Jammu and Kashmir with a few hundred speakers each.

## 6. Hindustani, Hindi and Urdu

Several volumes printed one figure for “Hindustani” (sometimes “Hindi” and “Urdu” separately). They did not
divide it into Western Hindi, Eastern Hindi and Bihari. The main cases are the United Provinces, and Bihar
and Orissa, but the practice is widespread. Vol. I later redistributed those returns among the three
languages, at province level only. There is therefore no district-level figure for Western Hindi, Eastern
Hindi or Bihari in those provinces. The map handles this with two entries:

- **HU, “Hindustani, Hindi or Urdu (as printed)”**: every row printed under one of these names. It sits
  under the Indo-Aryan Branch, but under no sub-branch.
- **HB, “Hindustani + Western Hindi + Eastern Hindi + Bihari”**: HU plus the three Vol. I languages. This is
  the only Hindi-area figure that means the same thing in every volume. The map offers it first as the
  “Hindi composite”.

The Western Hindi, Eastern Hindi and Bihari entries carry a warning on the page.

## 7. Checks

- **Per area** (`docs/regional_area_checks.csv`): the printed population is compared with the sum of the
  leaves for all 613 areas that print a population. 547 agree exactly. Most of the 66 that differ are off by
  a handful of persons, from misprints or faint cells. The large differences are:
  - **Gwalior**: Tonwarghar, Ujjain and Mandsaur. Pages are damaged or missing in the only scan
    (in.ernet.dli.2015.116061).
  - **Central India Agency**: Baoni, the Baghelkhand “Rest of Agency”, and cells elsewhere in the volume
    that cannot be read.
  - **Hazara (NWFP)**: the printed population reads 70,117 because its leading digit is missing in the
    print. Males + females and the province total both require 670,117.
  - **Nalgonda (Hyderabad)**: the language rows add up to 19,971 more than the printed population, a
    misprint in the source.
- **Per volume** (`docs/regional_volume_totals.csv`): each volume's leaves are compared with the population of
  the Vol. I rows that volume covers. Every volume agrees to within 0.01%, with two exceptions: the Central
  India Agency (−0.55%) and Gwalior (−53.4%).

## 8. From 1931 areas to present-day districts

### 8.1 The lineage graph (`tools/lineage.py`)

Each node is a district in one census year, keyed `year|name`. The graph has three kinds of edge:
- 1931 → 1941, from the 1872–1941 file (rows for 1931);
- 1941 → 1951, from the consolidation file;
- each later census to the next, up to 2024, from the proliferation file.

Some names belong to different districts in the same year. For these names (`AMBIG`: Bilaspur, Hamirpur,
Pratapgarh, Partabgarh, Patna, Aurangabad, Balrampur, Raigarh, Bijapur, and North/South/East/West) the key
also includes the state. The source labels each file with a different state (the 1941 province, the 1951
state, the 2024 state), so hand tables translate between them:
- `MAP51`: 1951 state → 2024 state;
- the 1941 province is looked up from the 1941 district and its 1951 state;
- `ALIAS_1941` and `ALIAS_1951`: names spelled differently in adjacent files (Kistna → Krishna, Nagore → Nagaur, …).

The source was changed in two places:
- `FIX_1951`: the source links Raigarh (1941) to Jhabua. It is linked to Raigarh (Madhya Pradesh →
  Chhattisgarh).
- `EXTRA_1951`: Udaipur (Dharamjaigarh), a Chhattisgarh feudatory state, has no 1941–1951 link in the source.
  It is linked to Raigarh, the district it merged into.

### 8.2 Regional areas → 1931 lineage nodes (`tools/regional/crosswalk.py`)

Each area printed in a regional table is matched by its name, with “District”, “State” and “Agency” removed,
among the 1931 lineage nodes of its province (`VOLDIV`). `MANUAL` covers the other 110 areas:
- cities, which join their district (Bangalore City → Bangalore);
- divisions of a state (Baroda's four divisions);
- the “Rest of the Agency” rows of the agencies, which join the states they are made of;
- spelling differences (Ferozepore → Ferozepur, Naini Tal → Nainital);
- the Orissa and Chota Nagpur States, which join their 23 and 2 lineage states;
- Sikkim and the Andaman and Nicobar Islands, which join their 1941 nodes.

The result for every area is in `docs/regional_area_crosswalk.csv`.

### 8.3 Present-day districts → lineage nodes (`tools/regional/adm2.py`)

Each geoBoundaries India ADM2 polygon is given a state by which ADM1 polygon contains it. It is then matched
to the latest lineage node (2001 or later) with the same normalised name in that state. There is a small
alias table (`ADM2_ALIAS`, for example Kadapa (YSR) → YSR, Batod → Botad, Hapur → Hapur (Panchsheel Nagar)),
and a close-match fallback (difflib, cutoff 0.8) within the state. `ADM2_ALIAS` also pins six names where
the close match would be wrong or where a district has been split: Agar, Karbi Anglong East and West,
Warangal (R) and (U), and South West Garo Hills. 733 of 735 polygons match. The two that
do not are Yanam, part of French India in 1931, and a polygon labelled “DATA NOT AVAILABLE”.

### 8.4 Outside present-day India (`OUTSIDE`, `BURMA_DIV`, `PARTITION` in `build_districts.py`)

The lineage database covers present-day India only. Each 1931 district elsewhere was assigned by hand to
the present-day districts formed from it. These are listed in full in `build_districts.py` and in the
crosswalk CSV.

- **Bangladesh** (geoBoundaries BGD ADM2): the fourteen east Bengal districts map to the present-day
  districts carved from them. For example, Mymensingh → Mymensingh, Jamalpur, Kishoreganj, Netrakona, Sherpur
  and Tangail.
- **Partitioned districts**: Nadia, Malda, Dinajpur and Sylhet were divided in 1947. Each is drawn as its
  Indian lineage plus its Bangladeshi part (Nadia + Kushtia, Chuadanga, Meherpur; Malda + Nawabganj;
  Dinajpur + Dinajpur, Thakurgaon, Panchagarh; Sylhet + Sylhet, Sunamganj, Habiganj, Maulvibazar).
- **Pakistan** (geoBoundaries PAK ADM2): assigned the same way for the west Punjab districts and Bahawalpur,
  Sind and Khairpur, the NWFP districts, and Baluchistan. The Bolan and Dombki-Kaheri areas share present-day
  districts with Kachhi, so the three form one unit.
- **Jammu and Kashmir**: the lineage treats the whole state as one unit, so the 1931 districts and jagirs
  were assigned by hand. Present-day India's J&K and Ladakh polygons are not matched through the lineage.
  Mirpur, Muzaffarabad and Poonch share Azad Kashmir and Punch, and so form one unit. Gilgit and the Frontier
  Ilaqas form one unit. Ladakh includes Baltistan (Skardu, Ghanche, Shigar, Kharmang).
- **Burma** is drawn on its own 1931 districts and states. They come from the administrative layer of the
  Japanese Empire map (https://froginawell.net/reference/japanese-empire/, `japan-empire-map-admin.svg`).
  `tools/regional/burma1931.py` projects them back to longitude and latitude (Mercator: 66°E origin, 20 px
  per degree, R = 1145.915590, latMax 55°). It then clips them to Myanmar's Natural Earth outline and gives
  any uncovered land to the shape it touches most. The result is `source/geo/burma_1931_districts.geojson`.
  Each district of the Burma table is one unit, with three exceptions:
  - Rangoon Town and Insein have no shapes of their own and are drawn with Hanthawaddy.
  - The Pakokku Hill Tracts are drawn with Pakokku.
  - The shapes do not say which Shan states were Northern and which Southern, so the two form one unit. The
    Karenni states form another.

  Hukawng Valley, the Triangle and the Wa States were unadministered and not enumerated.
- **Not drawn**: Aden, and the NWFP “Trans-frontier posts” (46,451 persons, mostly garrisons; marked not
  comparable).

### 8.5 Map units

All these links form one graph. Each connected group of nodes becomes one **map unit**:
- its shape is the union of its present-day polygons;
- its figures are the sum of its regional areas' leaves;
- its population is the sum of its areas' printed populations.

Units are built so that nothing is apportioned: a present-day district made from parts of two 1931
districts joins both of them into one unit. The price is size. Some units are large, for example the
Western India States Agency's scattered states, the Deccan states around Kolhapur, and the Punjab states
with their enclaves.

A unit is *incomplete* if it contains a 1931 lineage node that no regional area covers. (With the present
crosswalk there are none.)

**Check for disjoint units.** A unit made of pieces far apart usually means a wrong link. The check
compares each unit's large parts (over 3% of its area) with one another and reports any gap. It found two
errors, both now fixed:
- geoBoundaries' “Agar” had been close-matched to Sagar. It is now pinned to Agar-Malwa in `ADM2_ALIAS`.
- The Malwa thakurat of Bori (now in Dhar) had been listed under Bundelkhand's “Rest of Agency”. It
  belongs under the Southern States' “Other States”.

Three units still come out split, all for real reasons:
- the Andaman and Nicobar Islands;
- Las Bela, whose coastal islands are separate pieces;
- the Punjab plains cluster, which is joined through the scattered enclaves of Patiala, Nabha and Jind.

No two units overlap. The present-day sources disagree along some borders (India, Pakistan, Bangladesh, and
Burma's 1931 shapes), and geoBoundaries India draws a "DATA NOT AVAILABLE" polygon over Gilgit-Baltistan and
Azad Kashmir. Units with figures therefore take priority, largest first, and each gives up any ground already
drawn for another. Units without figures keep only what no unit with figures covers.

Polygons are projected exactly like the province map (`data/geo.js`) and simplified together with
`shapely.coverage_simplify` (tolerance 0.25 px), so neighbouring units still share their edges.

Only these units are drawn: there is no separate 1931 province layer underneath. The 1931 province outlines
come from the units themselves, as the union of the units belonging to each volume. A unit that spans two
volumes goes with the one holding most of its people. Present-day districts that nothing links to are
drawn as grey units with a note. These are the tribal agencies and the Dir, Swat and Chitral states of the
North-West Frontier, Gwadar (Muscat's in 1931), Burma's unadministered tracts, and Yanam. Other present-day
areas with no 1931 figures, also grey:
- Goa, Daman, Diu, and Dadra and Nagar Haveli (Portuguese India);
- Puducherry, Karaikal and Mahe (French India);
- Lakshadweep, which was counted inside Malabar and South Kanara.

## 9. What the map shows, and what it hides (`districts-app.js`)

- **Share** is a language's speakers divided by the unit's population. The denominator is the printed
  population, unless the leaves add up to more (Hazara, Nalgonda). Then the sum of the leaves is used, so
  that no share can exceed 100%.
- A **group** (a family, branch or group) is the sum of every leaf beneath it in the Vol. I tree, including
  the leaves matched only to the group itself.
- **Grey** (no figures to show; the card says why): a unit is grey in any of these cases:
  - it has no figures;
  - its legible leaves cover less than 80% of its printed population (the damaged Gwalior districts);
  - it is in Burma and the selected language is not one of the groups the Burma table gives.
- **Mismatch note**: somewhere in the unit, the leaves and the printed population differ by more than 1%.
  The card names the area and gives both figures.
- **Largest language** colours each unit by its largest single leaf (Hindustani as printed counts as one leaf).
  Colours come from `langcolors.js`, shared with the province map:
  - each language family takes a range of hues, and languages within it are spread along that range in
    classification order, so related languages get related colours;
  - the spread runs over a fixed list of every language that leads a unit on either map, so each language has
    the same colour on both;
  - a lighter tint means the language leads with under half the population;
  - one label is placed per contiguous block of units with the same language, on the unit nearest the block's
    area-weighted centre.
    The build stores each unit's neighbours for this (`nb` in `data/districts.js`).

- **Population of this area, 1901–2011.** This comes from the *Census of India 2011*, Table A-2 (decadal
  variation in population since 1901), district level, which recomputes every census from 1901 on 2011
  district boundaries. `tools/regional/census2011.py` links each of its 626 districts to the 2011 node of the
  lineage by name within its state. Andhra Pradesh in 2011 included Telangana, and Jammu and Kashmir included
  Ladakh. A unit's series is the sum of the 2011 districts in it. A year is left blank if any of those
  districts has no figure for it (the Punjab and Haryana princely-state districts before 1951). There is no
  series for:
  - units that extend into Pakistan, Bangladesh or Myanmar;
  - Sikkim, Mizoram and Daman and Diu, which are not in the spreadsheet.
- **1931 check against Table A-2.** The side panel compares Table A-2's 1931 figure for the area drawn with
  the population printed in the 1931 tables for the unit's areas. The median ratio is 1.00, and 161 of 209
  units are within 10%. A larger gap means territory moved between districts in ways the lineage does not
  record. For example, Jhalawar district took in parts of Kota, Indore and Gwalior in 1948 (×3.1), and
  Bellary lost Adoni and other taluks to Andhra (×0.5). The panel says so. The language shares still
  describe the 1931 areas.
- **Damaged areas found this way.** Some Gwalior districts have an illegible printed population (Bhind,
  Gird). A unit is shown grey if its printed population is missing and its legible language figures come to
  less than 80% of the Table A-2 figure for 1931.

## 10. Rebuilding

The inputs are:
- the transcriptions, now in `source/regional/KEY/leafNNNN.json`;
- the ISDED files in `source/isded/` (fetched by `tools/fetch_sources.sh`, or set `ISDED`);
- geoBoundaries India ADM1 and ADM2 in `source/geo/` (fetched by `tools/fetch_sources.sh`, or set `GBIND`);
- `source/geo/PAK-ADM2.geojson` and `source/geo/BGD-ADM2.geojson`;
- the Census 2011 Table A-2 district spreadsheet (`source/census2011/A2-population-1901-2011.xlsx`, or set `CENSUS_A2`);
- the Natural Earth admin-1 shapefile in `source/geo/` (for Myanmar's outline), and
  `source/geo/burma_1931_districts.geojson` (committed; rebuild it with `tools/regional/burma1931.py`).

The build needs Python with shapely, pyshp and openpyxl.

    python tools/regional/build_districts.py   # -> data/districts.js, data/regional_table15.csv
    python tools/regional/build_browser.py     # -> data/regional.js (the District tables page)
    python tools/regional/export_docs.py       # -> docs/regional_*.csv

## 11. Known problems

- **Gwalior** (−53%) and the **Central India Agency** (−0.5%) are incomplete because the only scans are
  damaged. The Central India Agency's Table XV Part II was not transcribed for the same reason.
- **Rest-of-Agency rows** join the states that make them up in the lineage, which enlarges some units.
- **Burma** shows language groups only. Its Indian languages cannot be mapped by district.
- **The district lineage** is only as good as ISDED. Two errors found in it have been corrected (see 8.1).
  Others may remain, and would show up as units joined unexpectedly.
- **Geometry**: every shape is a present-day boundary. It stands in for the 1931 area only as a whole unit.
  It is not a reconstruction of 1931 district lines.
