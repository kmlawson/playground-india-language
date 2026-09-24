# Regional transcription brief — Census of India 1931 provincial/state volumes, Table XV (Language)

You are transcribing one volume's (or part of one volume's) language table from the page scans.
Volume details (identifier, scan leaves, layout notes) are in `regional/manifest.json`
(find the entry by `key`). Work only inside `regional/KEY/`.

## HARD RULES
- **Read the images with your own eyes** (Read tool on crops). **No OCR** of any kind: no tesseract, no Apple Vision /
  `apple-vision`, no `llmimage`, no `llm` CLI, and do **not** read any Internet Archive OCR text (`*_djvu.txt`, `*hocr*`,
  `*djvu.xml`, `*chocr*`, full-text search). A figure you cannot read is `"?"` plus a note — never a guess.
- **No `ia` CLI** (it sends account credentials). Fetch pages only with the provided script, which uses curl with a
  neutral user-agent: `python3 regional/fetch.py KEY part1` (or `part2`).
  No personal information in any request. **No git operations.**

## Getting the pages
`fetch.py` writes full-resolution PNGs to `regional/KEY/pages/leafNNNN.png` (NNNN = scan leaf, 0-based). Pages may be
sideways: check a small overview (`magick pages/leafNNNN.png -resize 1200x ov.png`) and rotate a working copy upright
(`magick pages/leafNNNN.png -rotate 90 work/leafNNNN.png`, or -90/180). Crop legible pieces (roughly a fifth of the page
width, half its height, always including the row labels — glue label strip + data strip with
`magick \( IMG -crop WxH+X+Y +repage \) \( IMG -crop W2xH+X2+Y +repage \) +append OUT.png`). Put crops in
`regional/KEY/work/`. Zoom tighter on any doubtful digit (3/8, 5/6, 1/7).

## What to transcribe
Table XV **Part I** (mother tongue) in full, on your assigned leaves: every printed figure, Persons/Males/Females,
for every area (district, state, division, tahsil, city… whatever the rows or columns are) and every language/group
column including totals. If assigned **Part II** (subsidiary language / bilingualism), transcribe it the same way,
recording mother tongue, subsidiary language and the figures exactly as laid out.

## Output — one JSON file per leaf: `regional/KEY/transcribed/leafNNNN.json`
```json
{
  "key": "assam", "identifier": "in.ernet.dli.2015.56020", "leaf": 232, "printed_page": 226,
  "table": "XV Part I", "orientation": "rotated 90 clockwise to read",
  "layout": "rows = districts, columns = languages",
  "records": [
    {"area": "Goalpara", "area_path": ["Assam", "Assam Valley Division"], "area_is_total": false,
     "language": "Assamese", "lang_path": ["A. Vernaculars of Assam", "Indo-European Family", "..."],
     "lang_is_total": false, "cols": [14, 15, 16],
     "persons": 123456, "males": 60000, "females": 63456}
  ],
  "footnotes": "", "unreadable": [], "notes": ""
}
```
- One record per printed cell triple (area × language). Omit cells printed as nil ("..", "—"); record printed zeros.
- Part II records: `{"area", "area_path", "mother_tongue", "subsidiary", "persons", "males", "females", "cols"}`
  (use whichever of persons/males/females are printed; null for the rest) — set `"table": "XV Part II"`.
- Spell area and language names as printed; header hierarchy in `lang_path` / `area_path` (drop "contd."/"concld.").
- Printed column numbers in `cols` when the table has them.
- A table continuing across pages: transcribe your leaves only; say so in notes.

## Self-checks before finishing each leaf (do not skip)
1. persons == males + females for every record (when all three are printed).
2. Where the page prints totals (a province/division/district total row, or a family/group total column), check that
   the parts add up to them. Re-read anything that fails; if the print itself is inconsistent keep what is printed and
   explain in `notes`.
3. Write a small python check script for yourself in `regional/KEY/work/`.

## Report back (briefly)
Leaves done, records per leaf, every discrepancy / unreadable figure, and anything odd about the layout.
