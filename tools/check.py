#!/usr/bin/env python3
"""Arithmetic checks on the hand transcription of Table XV Part I (source/transcribed/pNNN.json).

1. persons == males + females for every cell
2. PROV == sum(rows 1-15, excl. 7a); STATES == sum(rows 16-35, excl. 27a-c); INDIA == PROV + STATES
3. column numbers are contiguous 2..958 across pages
Prints one line per failure; exit status 0 regardless (it is a report)."""
import json, glob, os, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'source', 'transcribed')
PROV = [str(i) for i in range(1, 16)]
STATES = [str(i) for i in range(16, 36)]
def v(x):
    return 0 if x is None else x
fails = 0; cols_seen = []
for f in sorted(glob.glob(os.path.join(ROOT, 'p*.json'))):
    d = json.load(open(f)); leaf = d['leaf']
    for c in d['columns']:
        cols_seen.extend(c['cols']); name = ' > '.join(c['header'])
        vals = c['values']
        for r, t in list(vals.items()):
            if t is None: t = vals[r] = [None, None, None]
            if any(isinstance(x, str) for x in t):
                print(f'{leaf} col{c["cols"][0]} row {r}: unreadable {t}  [{name}]'); fails += 1; continue
            p, m, fe = map(v, t)
            if p != m + fe:
                print(f'{leaf} col{c["cols"][0]} row {r}: P {p} != M {m} + F {fe} (diff {p-m-fe})  [{name}]'); fails += 1
        for i in range(3):
            def s(keys):
                return sum(v(vals[k][i]) for k in keys if k in vals and not isinstance(vals[k][i], str))
            got = {k: v(vals[k][i]) if k in vals and not isinstance(vals[k][i], str) else 0 for k in ('INDIA', 'PROV', 'STATES')}
            sp, ss = s(PROV), s(STATES)
            lab = 'PMF'[i]
            if got['PROV'] != sp:
                print(f'{leaf} col{c["cols"][i]} {lab}: PROV {got["PROV"]} != sum rows {sp} (diff {got["PROV"]-sp})  [{name}]'); fails += 1
            if got['STATES'] != ss:
                print(f'{leaf} col{c["cols"][i]} {lab}: STATES {got["STATES"]} != sum rows {ss} (diff {got["STATES"]-ss})  [{name}]'); fails += 1
            if got['INDIA'] != got['PROV'] + got['STATES']:
                print(f'{leaf} col{c["cols"][i]} {lab}: INDIA {got["INDIA"]} != PROV+STATES {got["PROV"]+got["STATES"]}  [{name}]'); fails += 1
cols_seen.sort()
missing = sorted(set(range(2, 959)) - set(cols_seen))
dups = sorted({c for c in cols_seen if cols_seen.count(c) > 1})
print(f'columns: {len(cols_seen)} seen; missing {len(missing)}: {missing[:40]}; duplicated: {dups[:40]}')
print(f'failures: {fails}')
