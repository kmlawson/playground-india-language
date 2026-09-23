#!/usr/bin/env python3
"""Fold the page-by-page hand transcription (source/transcribed/pNNN.json) of
Census of India 1931, Vol. I Part II, Imperial Table XV Part I into:

  data/census.js      window.CENSUS for the site
  data/table15.csv    long format: one row per language x unit
  data/languages.csv  one row per language/group with all-India totals

and report hierarchy checks: each printed group total against the sum of its
member rows. Figures are kept exactly as printed; nothing is corrected.
"""
import csv, glob, json, os, re, sys
from collections import OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'source', 'transcribed')
OUT = os.path.join(HERE, '..', 'data')

UNITS = OrderedDict([
    ('INDIA', ('India', 'total')), ('PROV', ('Provinces', 'total')), ('STATES', ('States and Agencies', 'total')),
    ('1', ('Ajmer-Merwara', 'prov')), ('2', ('Andaman and Nicobar Islands', 'prov')), ('3', ('Assam', 'prov')),
    ('4', ('Baluchistan (Districts and Administered Territories)', 'prov')), ('5', ('Bengal', 'prov')),
    ('6', ('Bihar and Orissa', 'prov')), ('7', ('Bombay (including Aden)', 'prov')), ('7a', ('Aden', 'sub')),
    ('8', ('Burma', 'prov')), ('9', ('Central Provinces and Berar', 'prov')), ('10', ('Coorg', 'prov')),
    ('11', ('Delhi', 'prov')), ('12', ('Madras', 'prov')),
    ('13', ('North-West Frontier Province (Districts and Administered Territories)', 'prov')),
    ('14', ('Punjab', 'prov')), ('15', ('United Provinces of Agra and Oudh', 'prov')),
    ('16', ('Assam States', 'state')), ('17', ('Baluchistan States', 'state')), ('18', ('Baroda State', 'state')),
    ('19', ('Bengal States', 'state')), ('20', ('Bihar and Orissa States', 'state')), ('21', ('Bombay States', 'state')),
    ('22', ('Central India Agency', 'state')), ('23', ('Central Provinces States', 'state')),
    ('24', ('Gwalior State', 'state')), ('25', ('Hyderabad State', 'state')), ('26', ('Jammu and Kashmir State', 'state')),
    ('27', ('Madras States Agency', 'state')), ('27a', ('Cochin State', 'sub')), ('27b', ('Travancore State', 'sub')),
    ('27c', ('Other Madras States', 'sub')), ('28', ('Mysore State', 'state')),
    ('29', ('North-West Frontier Province (Agencies and Tribal Areas)', 'state')),
    ('30', ('Punjab States', 'state')), ('31', ('Punjab States Agency', 'state')), ('32', ('Rajputana Agency', 'state')),
    ('33', ('Sikkim State', 'state')), ('34', ('United Provinces States', 'state')),
    ('35', ('Western India States Agency', 'state')),
])
SHORT = {'4': 'Baluchistan', '13': 'NWFP', '29': 'NWFP Agencies & Tribal Areas', '7': 'Bombay',
         '15': 'United Provinces', '9': 'Central Provinces & Berar', '2': 'Andamans & Nicobars',
         '35': 'Western India States', '22': 'Central India', '32': 'Rajputana', '27': 'Madras States',
         '26': 'Jammu & Kashmir', '6': 'Bihar & Orissa', '20': 'Bihar & Orissa States',
         '23': 'Central Provinces States', '34': 'U.P. States', '31': 'Punjab States Agency'}
LEAF_UNITS = [k for k, (_, t) in UNITS.items() if t in ('prov', 'state')]

# Spelling variants between transcribers -> one canonical name per level.
CANON = {
    'Tibeto-Burmese Sub-Family': 'Tibeto-Burman Sub-Family',
    'Assam Burmese Branch': 'Assam-Burmese Branch',
    'Naga Kuki Sub-Group': 'Naga-Kuki Sub-Group',
    'Arayn Sub-Family': 'Aryan Sub-Family',
    'Mongolian Family Group': 'Mongolian Family',
    'Tai Chinese Sub-Family': 'Tai-Chinese Sub-Family',
    'Tai-Chinese Family': 'Tai-Chinese Sub-Family',
    # printed so on p. 494 (Konkani, Oriya, Bihari, Bengali): evidently "Outer", as on p. 493
    'Other Sub-Branch': 'Outer Sub-Branch',
}
# The three parts of the table, by printed column number.
SECTIONS = [(5, 790, 'A. Vernaculars of India'),
            (791, 877, 'B. Vernaculars of other Asiatic countries and Africa'),
            (878, 958, 'C. European languages')]
def section(col):
    for a, b, n in SECTIONS:
        if a <= col <= b:
            return n
    return None
# Header paths that the printed page arranges differently from its neighbours;
# fixed by column so the tree nests properly. Keyed by the Persons column.
PATH_OVERRIDES = {
    # p. 500: heading "Tibeto-Chinese Family Total" set under "Tai-Chinese Sub-Family"; the only
    # sub-family, so the one figure is the total of both
    812: ['Tibeto-Chinese Family'],
    # p. 499: "Outer Sub-Branch. Southern Group Total" and Sinhalese, under Indo-Aryan Branch
    797: ['Indo-European Family', 'Aryan Sub-Family', 'Indo-Aryan Branch', 'Outer Sub-Branch', 'Southern Group'],
    800: ['Indo-European Family', 'Aryan Sub-Family', 'Indo-Aryan Branch', 'Outer Sub-Branch', 'Southern Group', 'Sinhalese'],
}
# Notes attached to a node (by its name) where the printed arrangement needs explaining.
NODE_NOTES = {
    'Bara or Bodo Group': 'The printed Bara or Bodo Group Total (col. 170) includes Mikir (126,457), although the '
                          'table prints Mikir under its own heading, “Mikir Language”, beside the group. So the Assam-Burmese '
                          'Branch members appear to add up to more than the branch total.',
    'Outer Sub-Branch': 'On printed p. 494 the heading over Konkani, Oriya, Bihari and Bengali reads “Other Sub-Branch”, '
                        'evidently a misprint for “Outer Sub-Branch” (p. 493); treated as Outer here.',
}
def rewrite(sec, path):
    # Section B prints "Chinese Branch" on p. 501 only; supply it on p. 500 too
    if sec and sec.startswith('B') and 'Chinese Group' in path and 'Chinese Branch' not in path:
        i = path.index('Chinese Group'); path = path[:i] + ['Chinese Branch'] + path[i:]
    return path
def canon(s):
    s = re.sub(r'\s+', ' ', s.replace('—', '-').replace('–', '-')).strip().rstrip('.')
    s = re.sub(r'[-,]?\s*(contd|concld|conid|contd\.)\.?$', '', s, flags=re.I).strip()
    return CANON.get(s, s)

def total_name(path):
    """For a total column the last element is the printed heading ('Munda Branch Total',
    'Total Austric Family'); the node it totals is the path up to the previous element,
    unless the heading names a level that is not yet in the path."""
    head = path[-1]
    core = re.sub(r'^(Total)\s*', '', head, flags=re.I)
    core = re.sub(r'\s*(Total)$', '', core, flags=re.I).strip()
    if not core or (len(path) >= 2 and canon(path[-2]) == canon(core)):
        return [canon(p) for p in path[:-1]]
    return [canon(p) for p in path[:-1]] + [canon(core)]

cols = []
notes = []
derived, illegible = [], []
for f in sorted(glob.glob(os.path.join(SRC, 'p*.json')), key=lambda p: int(re.findall(r'\d+', p)[-1])):
    d = json.load(open(f))
    for c in d['columns']:
        col0 = c['cols'][0]
        if col0 in PATH_OVERRIDES:
            path = list(PATH_OVERRIDES[col0])
        else:
            path = total_name(c['header']) if c.get('total') else [canon(p) for p in c['header']]
        sec = section(col0)
        if sec:
            path = [sec] + rewrite(sec, [p for p in path if not re.match(r'^[ABC]\.\s*[-—–]', p) and p != sec])
        vals = {}
        for r, t in c['values'].items():
            if t is None:
                t = [None, None, None]
            if isinstance(t[0], str) and not any(isinstance(x, str) for x in t[1:]) and t[1] is not None:
                # persons illegible, males and females legible: show their sum, flagged
                derived.append(f'col {col0} ({" > ".join(path[1:])}), row {r} {UNITS.get(r, (r,))[0]}: '
                               f'persons illegible or blank in the scan; males + females = {(t[1] or 0) + (t[2] or 0):,} used')
                t = [(t[1] or 0) + (t[2] or 0), t[1], t[2]]
            elif any(isinstance(x, str) for x in t):
                illegible.append(f'col {col0} ({" > ".join(path[1:])}), row {r}: {t}')
            vals[r] = [None if (x is None or isinstance(x, str)) else int(x) for x in t]
        # a column printed only in one half (e.g. Burushaski, States only): fill the missing
        # subtotal rows from the printed rows, and say so
        for tot, rows in (('PROV', [str(i) for i in range(1, 16)]), ('STATES', [str(i) for i in range(16, 36)])):
            if tot not in vals and any(r in vals for r in rows):
                vals[tot] = [sum((vals[r][i] or 0) for r in rows if r in vals) for i in range(3)]
                derived.append(f'col {col0} ({" > ".join(path[1:])}): {tot} row not printed; summed from the rows printed')
        if 'INDIA' not in vals and ('PROV' in vals or 'STATES' in vals):
            vals['INDIA'] = [(vals.get('PROV', [0, 0, 0])[i] or 0) + (vals.get('STATES', [0, 0, 0])[i] or 0) for i in range(3)]
            derived.append(f'col {col0} ({" > ".join(path[1:])}): INDIA row not printed; Provinces + States used')
        cols.append({'col': c['cols'][0], 'leaf': d['leaf'], 'page': d.get('printed_page'),
                     'path': path, 'total': bool(c.get('total')), 'values': vals,
                     'notes': (c.get('notes') or '') + (' ' + c['footnotes'] if c.get('footnotes') else '')})
    if d.get('notes'):
        notes.append({'leaf': d['leaf'], 'page': d.get('printed_page'), 'notes': d['notes']})
cols.sort(key=lambda c: c['col'])

# ---------------------------------------------------------------- tree
nodes = OrderedDict()   # key = tuple(path)
def ensure(path):
    for i in range(1, len(path) + 1):
        k = tuple(path[:i])
        if k not in nodes:
            nodes[k] = {'path': list(k), 'name': k[-1], 'printed': None, 'children': []}
            if i > 1:
                nodes[tuple(path[:i - 1])]['children'].append(k)
for c in cols:
    if c['path'][0] in ('Population',):
        continue
    ensure(c['path'])
    n = nodes[tuple(c['path'])]
    if n['printed'] is not None:
        print(f'WARN duplicate column for {c["path"]}: cols {n["printed"]["col"]} and {c["col"]}', file=sys.stderr)
    n['printed'] = c

def add(a, b):
    return [(x or 0) + (y or 0) for x, y in zip(a, b)]

def node_values(k):
    n = nodes[k]
    if n['printed'] is not None:
        return n['printed']['values']
    agg = {}
    for ch in n['children']:
        for u, t in node_values(ch).items():
            agg[u] = add(agg.get(u, [0, 0, 0]), t)
    return agg

# hierarchy check: printed total vs children
hier = []
for k, n in nodes.items():
    if n['printed'] is None or not n['children']:
        continue
    kids = {}
    for ch in n['children']:
        for u, t in node_values(ch).items():
            kids[u] = add(kids.get(u, [0, 0, 0]), t)
    for u in ['INDIA'] + LEAF_UNITS:
        a = [x or 0 for x in n['printed']['values'].get(u, [0, 0, 0])]
        b = kids.get(u, [0, 0, 0])
        if a != b:
            hier.append(f'{" > ".join(k)} (col {n["printed"]["col"]}) {u}: printed {a} vs members {b}')
print(f'{len(nodes)} nodes, {len(cols)} columns, {len(hier)} hierarchy mismatches', file=sys.stderr)
for h in hier[:200]:
    print('  HIER', h, file=sys.stderr)

# ---------------------------------------------------------------- output
pop = next(c for c in cols if c['path'] == ['Population'])['values']
units = OrderedDict()
for k, (name, typ) in UNITS.items():
    units[k] = {'name': name, 'short': SHORT.get(k, re.sub(r' State$', '', name)), 'type': typ,
                'pop': pop.get(k)}

langs = []
index = {}
for i, (k, n) in enumerate(nodes.items()):
    index[k] = i
for k, n in nodes.items():
    v = node_values(k)
    pc = n['printed']
    langs.append({
        'id': index[k], 'name': n['name'], 'depth': len(k) - 1,
        'parent': index[k[:-1]] if len(k) > 1 else None,
        'kids': [index[c] for c in n['children']],
        'col': pc['col'] if pc else None, 'page': pc['page'] if pc else None,
        'leaf': pc['leaf'] if pc else None,
        'computed': pc is None,
        'note': ' '.join(x for x in [NODE_NOTES.get(n['name'], ''),
                                     ' '.join('DERIVED: ' + m.split(': ', 1)[1] for m in derived if pc and m.startswith(f"col {pc['col']} ")),
                                     (pc['notes'].strip() if pc else '')] if x) or None,
        'v': {u: t for u, t in v.items() if u in UNITS and t and any(t)},
    })

os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, 'census.js'), 'w') as fh:
    fh.write('/* Generated by tools/build_data.py from the hand transcription in source/transcribed/.\n'
             '   Census of India 1931, Vol. I (India), Part II (Imperial Tables), Table XV Part I:\n'
             '   Language (mother tongue). [persons, males, females] per unit. */\n')
    fh.write('window.CENSUS = ' + json.dumps({'units': units, 'langs': langs, 'pageNotes': notes},
                                            ensure_ascii=False, separators=(',', ':')) + ';\n')

with open(os.path.join(OUT, 'table15.csv'), 'w', newline='') as fh:
    w = csv.writer(fh)
    w.writerow(['classification_path', 'name', 'is_group', 'table_column', 'printed_page', 'scan_leaf',
                'unit_code', 'unit', 'persons', 'males', 'females'])
    for L in langs:
        path = ' > '.join(nodes[list(nodes)[L['id']]]['path'])
        for u, (un, _) in UNITS.items():
            t = L['v'].get(u)
            if not t:
                continue
            w.writerow([path, L['name'], int(bool(L['kids'])), L['col'] or '', L['page'] or '', L['leaf'] or '',
                        u, un, *t])
with open(os.path.join(OUT, 'languages.csv'), 'w', newline='') as fh:
    w = csv.writer(fh)
    w.writerow(['classification_path', 'name', 'is_group', 'total_printed', 'table_column', 'printed_page',
                'india_persons', 'india_males', 'india_females'])
    for L in langs:
        path = ' > '.join(nodes[list(nodes)[L['id']]]['path'])
        t = L['v'].get('INDIA', [0, 0, 0])
        w.writerow([path, L['name'], int(bool(L['kids'])), int(not L['computed']), L['col'] or '',
                    L['page'] or '', *t])
print(f'wrote data/census.js ({os.path.getsize(os.path.join(OUT, "census.js")) // 1024} KB)', file=sys.stderr)

# ---------------------------------------------------------------- checks report for the site
import subprocess, datetime
chk = subprocess.run([sys.executable, os.path.join(HERE, 'check.py')], capture_output=True, text=True).stdout.splitlines()
cell = [l for l in chk if ' != M ' in l]
sums = [l for l in chk if (' PROV ' in l or ' STATES ' in l or ' INDIA ' in l) and ' != ' in l]
colinfo = [l for l in chk if l.startswith('columns:')]
n_cells = sum(len(c['values']) * 3 for c in cols)
groups = [
    {'title': 'Cells where persons ≠ males + females in the print (kept as printed)', 'items': cell, 'open': True},
    {'title': 'Columns where the printed Provinces / States / India totals differ from the rows', 'items': sums, 'open': True},
    {'title': 'Printed group totals that differ from the sum of their members', 'items': hier, 'open': bool(hier) and len(hier) < 40},
    {'title': 'Illegible figures, left blank', 'items': illegible, 'open': True},
    {'title': 'Figures derived because the print is illegible, blank or missing (flagged)', 'items': derived, 'open': True},
    {'title': 'Transcribers’ notes, page by page', 'items': [f"p. {n['page']} (scan leaf {n['leaf']}): {n['notes']}" for n in notes], 'open': False},
]
summary = (f'The transcription covers {len(cols)} column triplets and about {n_cells:,} figures, printed columns 2–958. '
           f'{len(cell)} cells fail persons = males + females, {len(sums)} column totals fail the row-sum check, and '
           f'{len(hier)} group-total comparisons do not balance. Each was re-read on the scan. All of the group-total '
           f'differences come from those printed inconsistencies, or from two features of the print: Mikir is printed '
           f'outside the Bodo Group yet counted in its total, and the Hamitic total includes 20 people footnoted as '
           f'returning “African”. Where the print is inconsistent, the printed figure is kept. '
           f'{len(illegible)} figures are left blank as unreadable. {len(derived)} figures that were illegible, blank or not '
           f'printed were derived from the figures around them, and are flagged.')
with open(os.path.join(OUT, 'checks.js'), 'w') as fh:
    fh.write('/* Generated by tools/build_data.py */\nwindow.CHECKS = ' + json.dumps(
        {'summary': summary, 'groups': groups, 'columns': colinfo}, ensure_ascii=False) + ';\n')
print(summary, file=sys.stderr)
