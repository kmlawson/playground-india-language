#!/usr/bin/env python3
"""Match geoBoundaries IND ADM2 districts (present-day, ~2019-20) to district nodes of the
lineage database (tools/lineage.py), by state and normalised name; ADM2_ALIAS covers
spellings that differ. Unmatched shapes are listed for docs/regional.md."""
import collections, difflib, json, os, re, sys, unicodedata
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
from shapely.geometry import shape
from shapely.strtree import STRtree

# geoBoundaries India ADM1/ADM2 (tools/fetch_sources.sh puts them in source/geo/); override with $GBIND
GB = os.environ.get('GBIND', os.path.join(HERE, '..', '..', 'source', 'geo'))

def n(s):
    s = unicodedata.normalize('NFKD', str(s)); s = ''.join(c for c in s if not unicodedata.combining(c))
    s = s.lower().replace('&', ' and ')
    s = re.sub(r'\b(nct of|district|dist)\b', ' ', s)
    return re.sub(r'[^a-z]+', '', s)

STATE_ALIAS = {'ladakh': 'jammuandkashmir', 'nctofdelhi': 'delhi', 'dadaraandnagarhavelli': 'dadraandnagarhavelianddamananddiu', 'damananddiu': 'dadraandnagarhavelianddamananddiu',
               'dadraandnagarhaveli': 'dadraandnagarhavelianddamananddiu', 'jammuandkashmir': 'jammuandkashmir', 'delhi': 'delhi'}
def ns(s):
    x = n(s); return STATE_ALIAS.get(x, x)

# geoBoundaries shapeName -> lineage name (normalised), where spelling differs
ADM2_ALIAS = {'Kadapa(YSR)': 'ysr', 'Batod': 'botad', 'Leh(Ladakh)': 'lehladakh', 'Bhadradri': 'bhadradrikothagudem',
              'Jayashankar': 'jayashankarbhupalpally', 'Jogulamba': 'jogulambagadwal', 'Medchal': 'medchalmalkajgiri',
              'Hapur': 'hapurpanchsheelnagar', 'Sambhal': 'sambhalbhimnagar', 'Samli': 'shamliprabuddhanagar',
              # guard against close matches to the wrong district (Agar -> Sagar) and split districts
              'Agar': 'agarmalwa', 'Karbi Anglong West': 'westkarbianglong', 'Karbi Anglong East': 'karbianglong',
              'Warangal (R)': 'warangalrural', 'Warangal (U)': 'warangalurbanhanamkonda', 'South West Garo Hills': 'westgarohills'}

def load_adm():
    a1 = json.load(open(os.path.join(GB, 'geoBoundaries-IND-ADM1.geojson')))
    states = [(ns(f['properties']['shapeName']), shape(f['geometry']).buffer(0)) for f in a1['features']]
    tree = STRtree([s for _, s in states])
    a2 = json.load(open(os.path.join(GB, 'geoBoundaries-IND-ADM2.geojson')))
    out = []
    for f in a2['features']:
        g = shape(f['geometry']).buffer(0)
        pt = g.representative_point()
        st = None
        for i in tree.query(pt):
            if states[i][1].contains(pt):
                st = states[i][0]; break
        out.append({'id': f['properties']['shapeID'], 'name': f['properties']['shapeName'], 'state': st, 'geom': g})
    return out

def match(adm, info):
    by = collections.defaultdict(list)
    for k, v in info.items():
        if v['year'] >= 2001:
            by[(ns(v['state'] or ''), n(v['name']))].append((v['year'], k))
    bystate = collections.defaultdict(set)
    for (st, nm) in by:
        bystate[st].add(nm)
    res, unmatched = {}, []
    for a in adm:
        nm = ADM2_ALIAS.get(a['name'], n(a['name']))
        cands = by.get((a['state'], nm))
        if not cands and a['state'] is None:
            cands = [c for (st, nn), v in by.items() if nn == nm for c in v]
        if not cands:
            close = difflib.get_close_matches(nm, bystate.get(a['state'], []), n=1, cutoff=0.8)
            if close:
                cands = by[(a['state'], close[0])]
        if cands:
            res[a['id']] = sorted(cands, reverse=True)[0][1]      # latest year
        else:
            unmatched.append((a['state'], a['name']))
    return res, unmatched

if __name__ == '__main__':
    import lineage
    G, info = lineage.build()
    adm = load_adm()
    res, un = match(adm, info)
    print(len(adm), 'ADM2;', len(res), 'matched;', len(un), 'unmatched')
    for u in sorted(un, key=str):
        print('  ', u)
