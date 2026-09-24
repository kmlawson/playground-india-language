#!/usr/bin/env python3
"""Write data/regional.js for the district-table browser (regional.html): every record transcribed from
Table XV of the provincial and state volumes, as printed.

  Part I   every printed row (languages, group totals, population rows), with its role in the district map:
           L = a leaf, summed on the map; T = a total or group row, not summed; D = a derived residual
           (printed total less the rows listed under it, see docs/regional.md 4.4), not printed as such.
           Leaves carry their Vol. I classification match and district-map unit.
  Part II  subsidiary-language records, exactly as laid out in each volume (the layouts differ).

Strings are pooled to keep the file small."""
import collections, glob, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
import load, normalize as N

SRC = os.path.join(ROOT, 'source', 'regional')
pool, pidx = [], {}
def S(s):
    s = '' if s is None else str(s)
    if s not in pidx:
        pidx[s] = len(pool); pool.append(s)
    return pidx[s]
def num(x):
    return x if isinstance(x, int) else (None if x is None else '?')

def main():
    leaves, _ = N.build()
    D = open(os.path.join(ROOT, 'data', 'districts.js')).read()
    D = json.loads(D[D.index('{'):D.rindex('}') + 1])
    unit_of = {}
    for i, u in enumerate(D['units']):
        for m in u['members']:
            unit_of[(m['vol'], tuple(m['path']), m['area'])] = i
    # leaves by record identity (canonical area key)
    def residual(l):
        return bool(l['flag'] and 'printed total less' in (l['flag'][1] or ''))
    lk = {}
    for l in leaves:
        if residual(l):
            continue
        k = (N.area_key(l['vol'], l['area_path'], l['area']), l['language'], tuple(l['lang_path']), l['leaf'])
        lk.setdefault(k, l)
    canon = {}
    for l in leaves:
        canon.setdefault(N.area_key(l['vol'], l['area_path'], l['area']), (tuple(l['area_path']), l['area']))
    areas, aidx = [], {}
    def A(vol, path, area, tot):
        ak = N.area_key(vol, path, area)
        cpath, carea = canon.get(ak, (tuple(path), area))
        k = (vol, tuple(path), area)
        if k not in aidx:
            aidx[k] = len(areas)
            areas.append([S(vol), S(' › '.join(path)), S(area), 1 if tot else 0,
                          -1 if tot else unit_of.get((vol, cpath, carea), -1)])
        return aidx[k]
    def node(nd):
        return nd if isinstance(nd, int) else (S(nd) if nd else -1)

    p1 = []
    used = set()
    for r in load.load():
        ai = A(r['vol'], r['area_path'], r['area'], r['area_total'])
        k = (N.area_key(r['vol'], r['area_path'], r['area']), r['language'], tuple(r['lang_path']), r['leaf'])
        l = lk.get(k)
        if l is not None:
            used.add(id(l))
            role, nd, fl = 'L', l['node'], (l['flag'][0] if l['flag'] else '')
        else:
            role, nd, fl = 'T', None, ''
        if any(x == '?' or isinstance(x, str) for x in (r['p'], r['m'], r['f'])):
            fl = fl or '?'
        p1.append([ai, S(r['language']), S(' › '.join(r['lang_path'])), num(r['p']), num(r['m']), num(r['f']),
                   r['leaf'], S(r['page']), role, -1 if nd is None else (nd if isinstance(nd, int) else S(nd)), S(fl)])
    for l in leaves:
        if not residual(l):
            continue
        ai = A(l['vol'], l['area_path'], l['area'], l['area_total'])
        p1.append([ai, S(l['language'] + ' (other or unlisted)'), S(' › '.join(l['lang_path'])), l['p'], l['m'], l['f'],
                   l['leaf'], S(l['page']), 'D', l['node'] if isinstance(l['node'], int) else (S(l['node']) if l['node'] else -1), S('Σ')])

    # Part II, as laid out in each volume
    p2 = []
    for key in sorted(os.listdir(SRC)):
        if not os.path.isdir(os.path.join(SRC, key)) or load.CONFIG.get(key, {}).get('skip'):
            continue
        for f in sorted(glob.glob(os.path.join(SRC, key, 'leaf*.json'))):
            d = json.load(open(f))
            for r in d.get('records', []):
                if 'language' in r or 'mother_tongue' not in r:
                    continue
                sub = r.get('subsidiary')
                kind = r.get('measure') or r.get('kind') or ''
                if isinstance(sub, list):
                    sub = ', '.join(map(str, sub))
                sub = sub or ({'mother_tongue_speakers': '(speakers of the mother tongue)', 'total_population': '(total population)',
                               'speaking_as_mother_tongue': '(speakers of the mother tongue)'}.get(kind) or ('(' + kind.replace('_', ' ') + ')' if kind else '(total)'))
                path = r.get('area_path') or []
                ai = A(key, path, r.get('area') or '', bool(r.get('area_is_total')))
                mtp = r.get('mt_path') or r.get('mother_tongue_path') or ([r['mt_group']] if r.get('mt_group') else [])
                p2.append([ai, S(r.get('mother_tongue')), S(' › '.join(map(str, mtp))), S(sub), S(kind.replace('_', ' ')),
                           num(r.get('persons')), num(r.get('males')), num(r.get('females')), d['leaf'], S(d.get('printed_page'))])

    man = json.load(open(os.path.join(SRC, 'manifest.json')))
    NAMES = load.VOL_NAMES
    vols = {m['key']: {'title': NAMES.get(m['key'], m.get('title')), 'id': m.get('identifier')} for m in man}
    L = {l['id']: l['name'] for l in N.L}
    out = {'S': pool, 'areas': areas, 'p1': p1, 'p2': p2, 'vols': vols, 'vol1': L}
    with open(os.path.join(ROOT, 'data', 'regional.js'), 'w') as fh:
        fh.write('/* Generated by tools/regional/build_browser.py from source/regional/. See docs/regional.md. */\n')
        fh.write('window.REGIONAL = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
    c = collections.Counter(r[8] for r in p1)
    print(f'{len(p1)} Part I rows {dict(c)}; {len(p2)} Part II rows; {len(areas)} areas; '
          f'{os.path.getsize(os.path.join(ROOT, "data", "regional.js")) // 1024} KB', file=sys.stderr)

if __name__ == '__main__':
    main()
