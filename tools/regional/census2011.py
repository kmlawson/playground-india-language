#!/usr/bin/env python3
"""Census of India 2011, Table A-2 (decadal variation in population since 1901), district level:
the population of each 2011 district in every census from 1901 to 2011, recomputed on 2011 boundaries.
load() reads the spreadsheet; match() links each 2011 district to its '2011|name' node in the lineage
(tools/lineage.py), so that a district-map unit can add up the series of the 2011 districts it contains.
Andhra Pradesh in 2011 included present-day Telangana, and Jammu and Kashmir included Ladakh."""
import collections, difflib, os, re
import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
# override with $CENSUS_A2
SRC = os.environ.get('CENSUS_A2', os.path.join(HERE, '..', '..', 'source', 'census2011', 'A2-population-1901-2011.xlsx'))
YEARS = list(range(1901, 2012, 10))

def n(s):
    return re.sub(r'[^a-z]', '', str(s).lower().replace('&', 'and'))

# 2011 state -> lineage (2024) states that now hold its districts
STATES = {'andhrapradesh': {'andhrapradesh', 'telangana'}, 'jammuandkashmir': {'jammuandkashmir', 'ladakh'},
          'nctofdelhi': {'delhi'}, 'orissa': {'odisha'}, 'pondicherry': {'puducherry'},
          'dadraandnagarhaveli': {'dadraandnagarhavelianddamananddiu'}, 'damananddiu': {'dadraandnagarhavelianddamananddiu'}}
# spreadsheet name -> lineage 2011 name, where they differ beyond spelling
ALIAS = {}

def load():
    ws = openpyxl.load_workbook(SRC, read_only=True)['Master Sheet']
    d = collections.OrderedDict()
    for r in list(ws.iter_rows(values_only=True))[1:]:
        if not r[0] or str(r[2]) == '000':
            continue
        k = (n(r[1]), str(r[3]).strip())
        try:
            y = int(float(r[4]))
        except (TypeError, ValueError):
            continue
        d.setdefault(k, {})[y] = int(r[5]) if isinstance(r[5], (int, float)) else None
    return d

def match(series, info):
    by_name = collections.defaultdict(list)
    for k, v in info.items():
        if v['year'] == 2011:
            by_name[n(v['name'])].append(k)
    def st(k):
        return n(info[k]['state'] or '')
    res, unmatched = {}, []
    for (state, name) in series:
        ok = STATES.get(state, {state})
        nm = n(ALIAS.get(name, name))
        c = [k for k in by_name.get(nm, []) if st(k) in ok] or (by_name.get(nm, []) if len(by_name.get(nm, [])) == 1 else [])
        if not c:
            pool = [x for x, ks in by_name.items() if any(st(k) in ok for k in ks)]
            close = difflib.get_close_matches(nm, pool, n=1, cutoff=0.8)
            if close:
                c = [k for k in by_name[close[0]] if st(k) in ok]
        if len(c) == 1:
            res[(state, name)] = c[0]
        else:
            unmatched.append((state, name, c))
    return res, unmatched

if __name__ == '__main__':
    import sys
    sys.path.insert(0, os.path.join(HERE, '..'))
    import lineage
    G, info = lineage.build()
    s = load()
    m, u = match(s, info)
    print(len(s), 'districts;', len(m), 'matched;', len(u), 'unmatched')
    for x in u:
        print('  ', x)
