#!/usr/bin/env python3
"""Write the normalisation and crosswalk tables behind the district map to docs/ as CSV,
so that every rule described in docs/regional.md can be inspected row by row:

  docs/regional_language_aliases.csv   printed language name -> Vol. I entry (ALIAS, GROUP_ALIAS, suffix rule)
  docs/regional_language_matches.csv   every distinct printed language name, how it was matched, persons
  docs/regional_area_crosswalk.csv     every regional area -> lineage 1931 units / present-day districts
  docs/regional_area_checks.csv        per area: printed population vs sum of the language leaves
  docs/regional_volume_totals.csv      per volume: sum of leaves vs the Vol. I (Imperial Table) population
"""
import collections, csv, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
import normalize as N, crosswalk, build_districts as B

DOCS = os.path.join(HERE, '..', '..', 'docs')
os.makedirs(DOCS, exist_ok=True)
L = N.L
def name(nd):
    return L[nd]['name'] if isinstance(nd, int) else (nd or '')

# volume -> Vol. I rows it covers
VOL1_ROWS = {'ajmer': ['1'], 'andaman': ['2'], 'assam': ['3', '16'], 'baluchistan': ['4', '17'], 'bengal': ['5', '19', '33'],
             'bihar_orissa': ['6', '20'], 'bombay': ['7', '21', '-7a'], 'aden': ['7a'], 'burma': ['8'], 'cp_berar': ['9', '23'],
             'madras': ['12', '27c'], 'nwfp': ['13', '29'], 'punjab': ['14', '30', '31'], 'up': ['15', '34'], 'baroda': ['18'],
             'cia': ['22'], 'gwalior': ['24'], 'hyderabad': ['25'], 'jk': ['26'], 'cochin': ['27a'], 'travancore': ['27b'],
             'mysore': ['28'], 'rajputana': ['32'], 'wisa': ['35']}

def main():
    leaves, unmapped = N.build()
    rows = [l for l in leaves if not l['area_total']]

    with open(os.path.join(DOCS, 'regional_language_aliases.csv'), 'w', newline='') as fh:
        w = csv.writer(fh)
        w.writerow(['table', 'printed_name_normalised', 'maps_to'])
        for k, v in sorted(N.ALIAS.items()):
            w.writerow(['ALIAS', k, 'HU (Hindustani, Hindi or Urdu as printed)' if v == 'HU' else v])
        for k, v in sorted(N.GROUP_ALIAS.items()):
            w.writerow(['GROUP_ALIAS', k, v if v else '(not matched)'])
        for k, v in sorted(N.SUFFIX_ALIAS.items()):
            w.writerow(['SUFFIX_ALIAS', f'... ({k})', v])

    agg = collections.defaultdict(lambda: [0, set()])
    for l in rows:
        k = (l['language'], ' > '.join(l['lang_path']), name(l['node']), l['how'] or 'not matched', 'residual' if l['flag'] and l['flag'][0] == 'Σ' and 'printed total less' in l['flag'][1] else '')
        agg[k][0] += l['p'] or 0; agg[k][1].add(l['vol'])
    with open(os.path.join(DOCS, 'regional_language_matches.csv'), 'w', newline='') as fh:
        w = csv.writer(fh)
        w.writerow(['language_as_printed', 'lang_path', 'vol1_entry', 'matched_by', 'kind', 'persons', 'volumes'])
        for k, (p, vs) in sorted(agg.items(), key=lambda x: -x[1][0]):
            w.writerow(list(k) + [p, ' '.join(sorted(vs))])

    xw, _, info = crosswalk.build()
    with open(os.path.join(DOCS, 'regional_area_crosswalk.csv'), 'w', newline='') as fh:
        w = csv.writer(fh)
        w.writerow(['volume', 'area_path', 'area', 'lineage_1931_units', 'hand_mapped_present_day_units', 'rule'])
        for (vol, path, area), nodes in xw.items():
            outside = B.OUTSIDE.get((vol, area), [])
            if vol == 'burma':
                outside = ['Burma 1931: ' + x.lstrip('@') for x in B.BURMA_SHAPES.get(B.deaccent(area), [])]
            manual = any(k in crosswalk.MANUAL for k in [(vol, area + '|' + pe) for pe in path] + [(vol, area)])
            rule = ('not comparable' if (vol, area) in B.NOT_COMPARABLE else 'hand crosswalk (MANUAL)' if manual
                    else 'hand mapping outside the lineage (OUTSIDE)' if outside else 'name match in province' if nodes else 'no geometry')
            w.writerow([vol, ' > '.join(path), area, '; '.join(n.split('|', 1)[1] if n.startswith(('1931|', '1941|')) else n for n in (nodes or [])),
                        '; '.join(outside), rule])

    with open(os.path.join(DOCS, 'regional_area_checks.csv'), 'w', newline='') as fh:
        w = csv.writer(fh)
        w.writerow(['volume', 'area', 'printed_population', 'sum_of_language_leaves', 'difference'])
        for vol, area, pop, s in N.CHECK:
            w.writerow([vol, area, pop, s, (s - pop) if pop is not None else ''])

    s = open(os.path.join(HERE, '..', '..', 'data', 'census.js')).read()
    import json
    C = json.loads(s[s.index('{'):s.rindex('}') + 1])
    vsum = collections.Counter()
    for l in rows:
        vsum[l['vol']] += l['p'] or 0
    with open(os.path.join(DOCS, 'regional_volume_totals.csv'), 'w', newline='') as fh:
        w = csv.writer(fh)
        w.writerow(['volume', 'vol1_rows', 'vol1_population', 'sum_of_language_leaves', 'difference_pct'])
        for vol, codes in VOL1_ROWS.items():
            v1 = sum((-1 if c.startswith('-') else 1) * C['units'][c.lstrip('-')]['pop'][0] for c in codes)
            w.writerow([vol, ' '.join(codes), v1, vsum[vol], round((vsum[vol] - v1) / v1 * 100, 2)])
            print(f'{vol:13s} {v1:>11,} {vsum[vol]:>11,} {(vsum[vol] - v1) / v1 * 100:+.2f}%')

if __name__ == '__main__':
    main()
