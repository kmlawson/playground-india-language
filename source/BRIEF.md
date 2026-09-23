# Transcription brief — Census of India 1931, Vol. I Part II, Imperial Table XV Part I (Language — Mother Tongue)

Scan: Internet Archive item `india.history.resource.92539`. Page images already rotated upright at
`/Users/kml/shell/projects/india-languages/source/pages/pNNN.png` (4200x2800 px, NNN = scan leaf, 477–514).

## HARD RULE: read the images with your own eyes
Transcribe by looking at the images with the Read tool. **Do not use any OCR engine or image-description
service** (no tesseract, no Apple Vision / `apple-vision` skill, no `llmimage` skill, no `llm` CLI, no Gemini)
and **do not read the IA OCR files** (`92539_djvu.txt`, `*_hocr*`, `*_djvu.xml`, `*_chocr*`) — they are
garbled and must not leak into the data. A figure you cannot read is `"?"` plus a note, never a guess.

## How to look at a page
Whole page is too small to read. Use the crop helper, which glues the row-label strip to any x-range:

    /Users/kml/shell/projects/india-languages/source/crop.py PAGE X0 X1 Y0 Y1 OUT.png

X/Y are fractions (0–1) of the 4200x2800 page. First view a downscaled overview
(`magick pages/pNNN.png -resize 1400x /tmp-or-scratch/ov.png`) to find where the column groups and the
two row blocks sit, then read crops ~0.18–0.22 wide (one language triplet or so) and about half the page
tall (e.g. Y 0.07–0.52 for header + INDIA…row 15, and Y 0.48–0.93 for States…row 35). Put crops in
`/private/tmp/claude-501/-Users-kml-shell-projects-india-languages/29218917-abd2-412c-b7ff-4221af0956fa/scratchpad/crops/`.
Zoom tighter whenever a digit is doubtful (3/8/6/5/9, 1/7, 0/6 are the usual confusions).

## Table layout
Rows = provinces/states (printed row numbers), columns = languages, each language a triplet
Persons / Males / Females with printed column numbers (2 … 958). Header rows above give the
classification hierarchy (Family › Sub-Family › Branch › Group › language), often with “—contd.”/“—concld.”.

Row keys to use (use only rows actually printed on the page; some pages omit a row, e.g. row 32):
`INDIA`, `PROV` (the “Provinces” subtotal), `1` Ajmer-Merwara, `2` Andaman and Nicobar Islands, `3` Assam,
`4` Baluchistan (Districts…), `5` Bengal, `6` Bihar and Orissa, `7` Bombay (including Aden), `7a` Aden,
`8` Burma, `9` Central Provinces and Berar, `10` Coorg, `11` Delhi, `12` Madras, `13` North-West Frontier
Province (Districts…), `14` Punjab, `15` United Provinces of Agra and Oudh, `STATES` (the “States and
Agencies” subtotal), `16` Assam States, `17` Baluchistan States, `18` Baroda State, `19` Bengal States,
`20` Bihar and Orissa States, `21` Bombay States, `22` Central India Agency, `23` Central Provinces States,
`24` Gwalior State, `25` Hyderabad State, `26` Jammu and Kashmir State, `27` Madras States Agency,
`27a` Cochin State, `27b` Travancore State, `27c` Other Madras States, `28` Mysore State, `29` North-West
Frontier Province (Agencies and Tribal Areas), `30` Punjab States, `31` Punjab States Agency,
`32` Rajputana Agency, `33` Sikkim State, `34` United Provinces States, `35` Western India States Agency.
If a page's row list differs from this, say so in `notes`.

## Output: one JSON file per page
`/Users/kml/shell/projects/india-languages/source/transcribed/pNNN.json`:

```json
{
  "leaf": 478, "printed_page": 473,
  "columns": [
    {"cols": [14, 15, 16],
     "header": ["Austric Family", "Austronesian Sub-Family", "Indonesian Branch", "Malay Group", "Malay"],
     "total": false,
     "values": {"INDIA": [4634, 2397, 2237], "PROV": [4633, 2396, 2237], "3": [11, 4, 7], "...": []},
     "footnotes": "",
     "notes": ""}
  ],
  "rows_printed": ["INDIA", "PROV", "1", "..."],
  "unreadable": [],
  "notes": ""
}
```
- `values` holds one [persons, males, females] triple per row key; **include every printed row**, using
  `null` for a printed `..` (nil). Numbers are plain integers without commas.
- `header`: the full hierarchy path for that triplet, spelled as printed (drop “contd./concld.”). For a
  total column (e.g. “Austroasiatic Sub-Family Total”, “Mon-Khmer Branch Total”, “Bihari Total”) set
  `"total": true` and make the last header element the printed heading.
- A triplet split across two pages: transcribe the part on your page only; note it.
- `unreadable`: list of `{"row":..,"col":..,"note":..}` for anything you could not make out (value `"?"`).
- Footnote markers (*, †) next to figures: record in the column's `footnotes`, and copy the page footnote
  text into the page `notes`.

## Self-checks before you finish each page (do not skip)
1. For every cell triple: persons == males + females. If not, re-zoom and re-read all three figures.
   If the print itself does not add up, keep what is printed and record it in `notes` — never "fix" it.
2. For every column: PROV == sum of rows 1–15 (with 7a Aden already inside 7, so exclude 7a);
   STATES == sum of rows 16–35 (27a–c are inside 27, so exclude them); INDIA == PROV + STATES.
   Re-read any column that fails; record residual discrepancies in `notes`.
3. Write a small python check for yourself to do this arithmetic from your JSON.

Report back briefly: pages done, number of columns per page, and every discrepancy/unreadable cell left.
