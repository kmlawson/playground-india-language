# Transcription brief — Census of India 1931, Vol. I Part II, Table XV Part II (Bilingualism)

Scan: Internet Archive `india.history.resource.92539`, scan leaves 515–517 (printed pp. 510–512).
Upright page images: `/Users/kml/shell/projects/india-languages/source/pages/pNNNu.png` (2800x4200, portrait).

## HARD RULE: read the images with your own eyes
Use the Read tool on crops. No OCR engine or image-description service (no tesseract, no Apple Vision /
`apple-vision`, no `llmimage`, no `llm` CLI), and do not read the IA OCR files (`92539_djvu.txt`, `*hocr*`,
`*djvu.xml`, `*chocr*`). An unreadable figure is `"?"` plus a note — never a guess.

Make crops with ImageMagick, e.g. `magick pages/p515u.png -crop 2800x700+0+900 +repage OUT.png`, into
`/private/tmp/claude-501/-Users-kml-shell-projects-india-languages/29218917-abd2-412c-b7ff-4221af0956fa/scratchpad/bcrops/`.
Keep crops to about a quarter of the page height so the small type is legible; zoom tighter on doubtful digits.

## Layout
Four columns: (1) numbered mother tongue in small capitals, followed in square brackets by the provinces/states
from which bilingual returns came; (2) Total speakers; (3) Total persons returned as speaking a language subsidiary
to that in column 1; (4) Subsidiary languages, a running list "Language (count), Language (count), …".
Some entries are un-numbered sub-entries (e.g. "KHASI [Assam and Bengal]" under 1. Mon-Khmer Branch).

## Output: `/Users/kml/shell/projects/india-languages/source/transcribed_bilingual/pNNN.json`
```json
{"leaf": 515, "printed_page": 510,
 "entries": [
  {"num": 1, "mother_tongue": "Mon-Khmer Branch", "sub_of": null,
   "areas": ["Assam", "Bengal", "Burma"], "total_speakers": 714762, "bilingual": 262329,
   "subsidiary": [["Burma Group", 168937], ["Tai (Shan) Group", 90927], ["Bengali", 1400]],
   "notes": ""},
  {"num": null, "mother_tongue": "Khasi", "sub_of": 1, "areas": ["Assam", "Bengal"], "...": "..."}
 ],
 "notes": ""}
```
- Spell names as printed (use normal capitalisation instead of small caps). Keep the order of the list.
- An entry continuing from the previous page or onto the next: transcribe your part and say so in notes.
- Footnote marks: note them; copy footnote text into page notes.

## Self-check (do not skip)
For every entry the subsidiary counts must add up to column 3. Re-read any entry that fails; if the print
itself does not add up, keep what is printed and state the difference in `notes`. Write a small python check.

Report back: entries per page and every discrepancy or unreadable figure.
