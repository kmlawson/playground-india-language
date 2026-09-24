#!/usr/bin/env python3
"""Walk district lineage from 1931 to 2024 (India State and District Evolution Database,
Jolad, Kalra & Singh, Harvard Dataverse doi:10.7910/DVN/D1AGUR, CC BY 4.0) and build
'stable clusters': connected components of the lineage graph linking 1931 districts to
2024 districts. Within a cluster the set of 1931 units and the set of 2024 units cover
(approximately) the same territory, so a cluster is the finest unit for which 1931
figures can be drawn on present-day district geometry.

Node keys are year|name. Names that denote two different districts in the same year are
disambiguated by state (see AMBIG). Spelling differences between the files are bridged by
ALIAS. Both lists are documented in docs/regional.md.
"""
import collections, json, os, sys
import openpyxl

# the ISDED files (tools/fetch_sources.sh puts them in source/isded/); override with $ISDED
SRC = os.environ.get('ISDED', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'source', 'isded'))

def rows(rel):
    ws = openpyxl.load_workbook(os.path.join(SRC, rel), read_only=True).worksheets[0]
    return list(ws.iter_rows(values_only=True))[1:]

def clean(s):
    return ' '.join(str(s).replace('\n', ' ').split())

# names that differ between adjacent files for the same unit (file A name -> file B name)
ALIAS_1951 = {  # consolidation dest (1951) -> proliferation src (1951)
    'Kistna (Krishna)': 'Krishna', 'The Nilgiris': 'Nilgiris', 'Vizagapatam': 'Vizagapatnam',
    'Nagore': 'Nagaur', 'Partapgarh': 'Pratapgarh', 'United Mikir and North Cachar Hills': 'United Mikir and North Cachar Hills',
    'Balipara Frontier Tract (N.E.F.A.)': 'Balipara Frontier Tract (N.E.F.A.)'}
ALIAS_1941 = {'DELHI': 'Delhi'}   # evolution dest (1941) -> consolidation src (1941)

# genuinely different districts sharing a name in one year: disambiguate by state label
AMBIG = {'Bilaspur', 'Hamirpur', 'Pratapgarh', 'Patna', 'Partabgarh', 'Aurangabad', 'Balrampur', 'Raigarh', 'Bijapur',
         'East', 'North', 'South', 'West'}
STATE_NORM = {'NCT of Delhi': 'Delhi'}
# 1951 state as labelled in the consolidation file -> 2024 state used in the proliferation file (ambiguous names only)
MAP51 = {('Bilaspur', 'Bilaspur'): 'Himachal Pradesh', ('Bilaspur', 'Madhya Pradesh'): 'Chhattisgarh',
         ('Raigarh', 'Madhya Pradesh'): 'Chhattisgarh', ('Aurangabad', 'Hyderabad'): 'Maharashtra',
         ('Bijapur', 'Bombay'): 'Karnataka', ('Pratapgarh', 'Uttar Pradesh'): 'Uttar Pradesh',
         ('Hamirpur', 'Uttar Pradesh'): 'Uttar Pradesh', ('Patna', 'Bihar'): 'Bihar'}
# corrections to evident errors in the source (1941 name, 1951 name as given -> 1951 name used)
FIX_1951 = {('Raigarh', 'Jhabua'): 'Raigarh'}
# links missing from the source: Udaipur (Dharamjaigarh), a Chhattisgarh feudatory state, merged into Raigarh district in 1948
EXTRA_1951 = [('Udaipur', 'Central Province and Berar', 'Raigarh', 'Madhya Pradesh')]

def build():
    G = collections.defaultdict(set)
    info = {}
    def node(year, name, state=None):
        name = clean(name)
        state = STATE_NORM.get(state, state)
        k = f'{year}|{name}' + (f'|{state}' if name in AMBIG and state else '')
        info.setdefault(k, {'year': year, 'name': name, 'state': state})
        return k
    def edge(a, b):
        G[a].add(b); G[b].add(a)

    # 1931 -> 1941 (key admin division for the ambiguous names)
    for r in rows('1872-1941/district_evolution_1872_1941.xlsx'):
        if r[6] != 1931:
            continue
        a = node(1931, r[2], clean(r[0])); b = node(1941, ALIAS_1941.get(clean(r[5]), r[5]), clean(r[3]))
        info[a]['div'] = clean(r[0]); info[a]['type'] = r[1]
        edge(a, b)
    # 1941 -> 1951 (filter_state = state in 1951)
    div41 = {}      # (1941 district, 1951 state) -> 1941 province; the 1951 state separates same-named districts
    cons = rows('1941-1951/district_consolidation_1941_1951.xlsx')
    for r in cons:
        if r[2] == 0:
            div41[(clean(r[1]), clean(r[4]))] = clean(r[0])
            div41.setdefault(clean(r[1]), clean(r[0]))
    cons = cons + [(a, b, 1, 2, d) for a, _, b, d in EXTRA_1951]
    for r in cons:
        if r[2] != 1:
            continue
        a = node(1941, r[0], div41.get((clean(r[0]), clean(r[4])), div41.get(clean(r[0]))))
        n51 = ALIAS_1951.get(clean(r[1]), clean(r[1]))
        n51 = FIX_1951.get((clean(r[0]), n51), n51)
        b = node(1951, n51, MAP51.get((n51, clean(r[4])), clean(r[4])))
        edge(a, b)
    # 1951 -> ... -> 2024 (filter_state = state in 2024)
    for r in rows('1951-2024/district_proliferation_1951_2024.xlsx'):
        edge(node(r[2], r[0], clean(r[4])), node(r[3], r[1], clean(r[4])))
    return G, info

def components(G, info):
    seen, comps = set(), []
    for n in G:
        if n in seen:
            continue
        stack, comp = [n], []
        seen.add(n)
        while stack:
            x = stack.pop(); comp.append(x)
            for y in G[x]:
                if y not in seen:
                    seen.add(y); stack.append(y)
        comps.append(comp)
    return comps

if __name__ == '__main__':
    G, info = build()
    comps = components(G, info)
    stats = collections.Counter()
    for c in comps:
        n31 = sum(1 for x in c if info[x]['year'] == 1931)
        n24 = sum(1 for x in c if info[x]['year'] == 2024)
        stats[(min(n31, 5), min(n24, 5))] += 1
    print(len(comps), 'components; (n1931, n2024) ->', sorted(stats.items()))
    big = sorted(comps, key=lambda c: -sum(1 for x in c if info[x]['year'] == 1931))[:8]
    for c in big:
        print(sum(1 for x in c if info[x]['year'] == 1931), sorted({info[x]['name'] for x in c if info[x]['year'] == 1931})[:14])
