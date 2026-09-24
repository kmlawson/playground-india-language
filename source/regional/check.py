#!/usr/bin/env python3
"""check.py [KEY ...] — summarise regional transcriptions: records per leaf, persons != males+females, unreadables."""
import glob, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
keys = sys.argv[1:] or sorted(d for d in os.listdir(HERE) if os.path.isdir(os.path.join(HERE, d)))
for k in keys:
    files = sorted(glob.glob(os.path.join(HERE, k, 'leaf*.json')))
    nrec = bad = unr = 0
    for f in files:
        d = json.load(open(f))
        for r in d.get('records', []):
            nrec += 1
            p, m, fe = r.get('persons'), r.get('males'), r.get('females')
            if any(isinstance(x, str) for x in (p, m, fe)):
                unr += 1; continue
            if None not in (p, m, fe) and p != m + fe:
                bad += 1
    print(f'{k:14s} leaves {len(files):3d}  records {nrec:6d}  P!=M+F {bad:4d}  unreadable {unr:3d}')
