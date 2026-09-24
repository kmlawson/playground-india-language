#!/usr/bin/env python3
"""Build data/districts.js: the regional (provincial-volume) Table XV figures drawn on
present-day district boundaries.

A *map unit* is a connected component of a graph whose nodes are
  - district nodes of the lineage database 1931 -> 2024 (tools/lineage.py),
  - regional Table XV areas (tools/regional/crosswalk.py),
  - present-day district shapes: geoBoundaries IND ADM2 (matched in tools/regional/adm2.py),
    and, outside present-day India, geoBoundaries PAK / BGD ADM2 and Natural Earth
    Myanmar states/regions (hand crosswalk OUTSIDE below).
Within a unit the regional figures can be summed and drawn on the union of the shapes
without splitting anything, so no figure is apportioned or estimated. The price is that
some units are larger than a single 1931 district. Everything is documented in
docs/regional.md.
"""
import collections, json, math, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
import shapely
from shapely.geometry import shape, mapping, box
from shapely.ops import unary_union, transform
import lineage, crosswalk, adm2, normalize as N, census2011

G_DIR = os.path.join(ROOT, 'source', 'geo')

# ------------------------------------------------------------------ outside present-day India
# regional area (vol, area) -> present-day shapes. 'PAK:x' / 'BGD:x' = geoBoundaries ADM2 shapeName,
# 'MMR:x' = Natural Earth admin-1, 'JK:x' = geoBoundaries IND ADM2 shapeName in J&K / Ladakh.
OUTSIDE = {
    # Bengal districts now in Bangladesh (1931 district = modern 'greater district')
    ('bengal', 'Jessore District'): ['BGD:Jessore', 'BGD:Jhenaidah', 'BGD:Magura', 'BGD:Narail'],
    ('bengal', 'Khulna District'): ['BGD:Khulna', 'BGD:Bagerhat', 'BGD:Satkhira'],
    ('bengal', 'Rajshahi District'): ['BGD:Rajshahi', 'BGD:Natore', 'BGD:Naogaon'],
    ('bengal', 'Rangpur District'): ['BGD:Rangpur', 'BGD:Gaibandha', 'BGD:Kurigram', 'BGD:Lalmonirhat', 'BGD:Nilphamari'],
    ('bengal', 'Bogra District'): ['BGD:Bogra', 'BGD:Joypurhat'],
    ('bengal', 'Pabna District'): ['BGD:Pabna', 'BGD:Sirajganj'],
    ('bengal', 'Dacca District'): ['BGD:Dhaka', 'BGD:Gazipur', 'BGD:Manikganj', 'BGD:Munshiganj', 'BGD:Narayanganj', 'BGD:Narsingdi'],
    ('bengal', 'Mymensingh District'): ['BGD:Mymensingh', 'BGD:Jamalpur', 'BGD:Kishoreganj', 'BGD:Netrakona', 'BGD:Sherpur', 'BGD:Tangail'],
    ('bengal', 'Faridpur District'): ['BGD:Faridpur', 'BGD:Gopalganj', 'BGD:Madaripur', 'BGD:Rajbari', 'BGD:Shariatpur'],
    ('bengal', 'Bakarganj District'): ['BGD:Barisal', 'BGD:Barguna', 'BGD:Bhola', 'BGD:Jhalokati', 'BGD:Patuakhali', 'BGD:Pirojpur'],
    ('bengal', 'Tippera District'): ['BGD:Comilla', 'BGD:Brahamanbaria', 'BGD:Chandpur'],
    ('bengal', 'Noakhali District'): ['BGD:Noakhali', 'BGD:Feni', 'BGD:Lakshmipur'],
    ('bengal', 'Chittagong District'): ['BGD:Chittagong', "BGD:Cox's Bazar"],
    ('bengal', 'Chittagong Hill Tracts District'): ['BGD:Rangamati', 'BGD:Khagrachhari', 'BGD:Bandarban'],
    # west Punjab
    ('punjab', 'Lahore'): ['PAK:Lahore', 'PAK:Kasur'], ('punjab', 'Sialkot'): ['PAK:Sialkot', 'PAK:Narowal'],
    ('punjab', 'Gujranwala'): ['PAK:Gujranwala', 'PAK:Hafizabad'], ('punjab', 'Sheikhupura'): ['PAK:Sheikhpura'],
    ('punjab', 'Gujrat'): ['PAK:Gujrat', 'PAK:Mandi Bahauddin'], ('punjab', 'Shahpur'): ['PAK:Sargodha', 'PAK:Khushab'],
    ('punjab', 'Jhelum'): ['PAK:Jhelum', 'PAK:Chakwal'], ('punjab', 'Rawalpindi'): ['PAK:Rawalpindi', 'PAK:Islamabad Capital Territory'],
    ('punjab', 'Attock'): ['PAK:Attock'], ('punjab', 'Mianwali'): ['PAK:Mianwali', 'PAK:Bhakkar'],
    ('punjab', 'Montgomery'): ['PAK:Sahiwal', 'PAK:Okara', 'PAK:Pakpattan'], ('punjab', 'Lyallpur'): ['PAK:Faisalabad', 'PAK:Toba Tek Singh'],
    ('punjab', 'Jhang'): ['PAK:Jhang'], ('punjab', 'Multan'): ['PAK:Multan', 'PAK:Khanewal', 'PAK:Lodhran', 'PAK:Vihari'],
    ('punjab', 'Muzaffargarh'): ['PAK:Muzaffargarh', 'PAK:Layyah'], ('punjab', 'Dera Ghazi Khan'): ['PAK:Dera Ghazi Khan', 'PAK:Rajanpur'],
    ('punjab', 'Bahawalpur'): ['PAK:Bahawalpur', 'PAK:Bahawalnagar', 'PAK:Rahim Yar Khan'],
    # Sind (Bombay Presidency) and Khairpur (Bombay States)
    ('bombay', 'Karachi'): ['PAK:Karachi', 'PAK:Thatta'], ('bombay', 'Hyderabad'): ['PAK:Hyderabad', 'PAK:Badin', 'PAK:Matiari', 'PAK:Tando Allahyar', 'PAK:Tando Muhammad Khan'],
    ('bombay', 'Larkana'): ['PAK:Qambar Shahdadkot', 'PAK:Dadu', 'PAK:Jamshoro'], ('bombay', 'Nawabshah'): ['PAK:Nawabshah', 'PAK:Naushehro Feroze', 'PAK:Sanghar'],
    ('bombay', 'Sukkur'): ['PAK:Sukkur', 'PAK:Shikarpur', 'PAK:Ghotki'], ('bombay', 'Thar and Parkar'): ['PAK:Tharparkar', 'PAK:Umerkot', 'PAK:Mirpurkhas'],
    ('bombay', 'Upper Sind Frontier'): ['PAK:Jacobabad', 'PAK:Kashmore'], ('bombay', 'Khairpur'): ['PAK:Khairpur'],
    # NWFP districts (the agencies and tribal areas, unit 29 of the India map, were not enumerated)
    ('nwfp', 'Hazara'): ['PAK:Abbottabad', 'PAK:Haripur', 'PAK:Mansehra', 'PAK:Battagram'],
    ('nwfp', 'Peshawar'): ['PAK:Peshawar', 'PAK:Charsadda', 'PAK:Nowshera', 'PAK:Mardan', 'PAK:Swabi'],
    ('nwfp', 'Kohat'): ['PAK:Kohat', 'PAK:Hangu', 'PAK:Karak'], ('nwfp', 'Bannu'): ['PAK:Bannu', 'PAK:Lakki Marwat'],
    ('nwfp', 'Dera Ismail Khan'): ['PAK:Dera Ismail Khan', 'PAK:Tank'],
    # Baluchistan
    ('baluchistan', 'Quetta-Pishin'): ['PAK:Quetta', 'PAK:Pishin', 'PAK:Qilla Abdullah'], ('baluchistan', 'Loralai'): ['PAK:Loralai', 'PAK:Musakhel', 'PAK:Barkhan'],
    ('baluchistan', 'Zhob'): ['PAK:Zhob', 'PAK:Qilla Saifullah'], ('baluchistan', 'Chagai'): ['PAK:Chagai', 'PAK:Nushki'],
    ('baluchistan', 'Administered area'): ['PAK:Sibi', 'PAK:Ziarat'], ('baluchistan', 'Mari Bugti Country'): ['PAK:Kohlu', 'PAK:Dera Bugti'],
    ('baluchistan', 'Bolan'): ['PAK:Kachhi'], ('baluchistan', 'Kachhi'): ['PAK:Kachhi', 'PAK:Nasirabad', 'PAK:Jafarabad', 'PAK:Jhal Magsi'],
    ('baluchistan', 'Dombki-Kaheri Country'): ['PAK:Nasirabad'], ('baluchistan', 'Sarawan'): ['PAK:Kalat', 'PAK:Mastung'],
    ('baluchistan', 'Jhalawan'): ['PAK:Khuzdar', 'PAK:Awaran'], ('baluchistan', 'Makran'): ['PAK:Kech', 'PAK:Panjgur'],
    ('baluchistan', 'Kharan'): ['PAK:Kharan'], ('baluchistan', 'Las-Bela'): ['PAK:Lasbela'],
    # Jammu and Kashmir State (1931 districts / wazarats)
    ('jk', 'Jammu District'): ['JK:Jammu', 'JK:Samba'], ('jk', 'Kathua District'): ['JK:Kathua'],
    ('jk', 'Udhampur District'): ['JK:Udhampur', 'JK:Doda', 'JK:Ramban', 'JK:Kishtwar'], ('jk', 'Chenani Jagir'): ['JK:Udhampur'],
    ('jk', 'Reasi District'): ['JK:Reasi', 'JK:Rajouri'], ('jk', 'Poonch Jagir'): ['JK:Punch', 'PAK:Azad Kashmir'],
    ('jk', 'Mirpur District'): ['PAK:Azad Kashmir'], ('jk', 'Muzaffarabad'): ['PAK:Azad Kashmir'],
    ('jk', 'Kashmir South (including Municipality)'): ['JK:Srinagar', 'JK:Badgam', 'JK:Anantnag', 'JK:Kulgam', 'JK:Pulwama', 'JK:Shupiyan', 'JK:Ganderbal'],
    ('jk', 'Kashmir North'): ['JK:Baramula', 'JK:Bandipore', 'JK:Kupwara'],
    ('jk', 'Ladakh District'): ['JK:Leh(Ladakh)', 'JK:Kargil', 'PAK:Skardu', 'PAK:Ghanche', 'PAK:Shigar', 'PAK:Kharmang'],
    ('jk', 'Gilgit District'): ['PAK:Gilgit', 'PAK:Hunza', 'PAK:Nagar', 'PAK:Ghizer', 'PAK:Diamer', 'PAK:Astore'],
    ('jk', 'Frontier Ilaqas'): ['PAK:Gilgit', 'PAK:Hunza', 'PAK:Nagar', 'PAK:Ghizer', 'PAK:Diamer', 'PAK:Astore'],
}
# Burma: each district of the provincial table on its 1931 shape (source/geo/burma_1931_districts.geojson, from the
# Japanese Empire map's admin layer; tools/regional/burma1931.py). Keys are printed area names without diacritics.
SHAN = 'Federated Shan States'
BURMA_SHAPES = {'Akyab': ['Akyab'], 'Arakan Hill Tracts': ['Arakan Hill Distric'], 'Kyaukpyu': ['Kyaukpyu'], 'Sandoway': ['Sandoway'],
                'Rangoon Town': ['Hanthawaddy'], 'Insein': ['Hanthawaddy'], 'Hanthawaddy': ['Hanthawaddy'],   # no separate shapes
                'Pegu': ['Pegu'], 'Tharrawaddy': ['Tharawaddy'], 'Prome': ['Prome'], 'Bassein': ['Bassein'], 'Henzada': ['Henzada'],
                'Myaungmya': ['Myaungmya'], 'Maubin': ['Maubin'], 'Pyapon': ['Pyapon'], 'Salween': ['Salween'], 'Thaton': ['Thaton'],
                'Amherst': ['Amherst'], 'Tavoy': ['Tavoy'], 'Mergui': ['Mergui'], 'Toungoo': ['Toungoo'], 'Thayetmyo': ['Thayetmo'],
                'Minbu': ['Minbu'], 'Magwe': ['Magwe'], 'Pakokku': ['Pakokku', 'Pakokku Hill Tracks'], 'Chin Hills': ['Chin Hills'],
                'Mandalay': ['Mandalay'], 'Kyaukse': ['Kyaukse'], 'Meiktila': ['Meiktila'], 'Myingyan': ['Myingyan'], 'Yamethin': ['Yamethin'],
                'Bhamo': ['Bhamo'], 'Myitkyina': ['Myitkyina'], 'Shwebo': ['Shwebo'], 'Sagaing': ['Sagaing'], 'Katha': ['Katha'],
                'Lower Chindwin': ['Lower Chindwin'], 'Upper Chindwin': ['Upper Chindwin'],
                # the shapes do not say which Shan states were Northern and which Southern, so the two form one unit
                'Northern Shan States': ['@' + SHAN], 'Southern Shan States': ['@' + SHAN], 'Karenni': ['@Karenni States']}
BURMA_UNADMINISTERED = {'Hukawng Valley', 'The Triangle', 'Wa States'}
def deaccent(s):
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFKD', s) if not unicodedata.combining(c))
# 1931 districts divided by the 1947 boundary: the part now in Bangladesh / Pakistan is added to the lineage unit
PARTITION = {'Nadia': ['BGD:Kushtia', 'BGD:Chuadanga', 'BGD:Meherpur'], 'Malda': ['BGD:Nawabganj'],
             'Dinajpur': ['BGD:Dinajpur', 'BGD:Thakurgaon', 'BGD:Panchagarh'],
             'Sylhet': ['BGD:Sylhet', 'BGD:Sunamganj', 'BGD:Habiganj', 'BGD:Maulvibazar']}
# territories drawn without figures: not in Table XV, or not enumerated
NOT_COMPARABLE = {('nwfp', 'Trans-frontier posts')}
# present-day territory with no 1931 figures (status 'nodata'), keyed by geoBoundaries ADM1 (normalised)
NODATA_NOTE = {'goa': 'Portuguese India in 1931: outside the Census of India.',
               'dadraandnagarhavelianddamananddiu': 'Portuguese India in 1931: outside the Census of India.',
               'puducherry': 'French India in 1931: outside the Census of India.',
               None: 'The Laccadive, Amindivi and Minicoy islands were counted with Malabar and South Kanara districts and cannot be separated.'}
VOL1 = {'11': '1931|DELHI', '10': '1941|Coorg'}     # provinces with no provincial volume: Vol. I figures

def fix(g):
    g = shapely.make_valid(g)
    if g.geom_type == 'GeometryCollection':
        g = unary_union([p for p in g.geoms if p.geom_type in ('Polygon', 'MultiPolygon')])
    return g.buffer(0)

def main():
    Gr, info = lineage.build()
    A2 = census2011.load()                              # 2011 districts: population 1901-2011 on 2011 boundaries
    a2match, _ = census2011.match(A2, info)
    A2_BY_NODE = {v: A2[k] for k, v in a2match.items()}
    A2_NAME = {v: k[1] for k, v in a2match.items()}
    A2_JK = {census2011.n(k[1]): k for k in A2 if k[0] == 'jammuandkashmir'}
    xw, unmatched, _ = crosswalk.build()
    leaves, _ = N.build()
    CHK = {(v, a): (p, t) for v, a, p, t in N.CHECK}
    edges = collections.defaultdict(set)
    def link(a, b):
        edges[a].add(b); edges[b].add(a)
    for a, bs in Gr.items():
        for b in bs:
            link(a, b)
    B31_BY_DIV = collections.defaultdict(list)
    for f in json.load(open(os.path.join(G_DIR, 'burma_1931_districts.geojson')))['features']:
        if f['properties']['name'] not in BURMA_UNADMINISTERED and f['properties']['division'] in (SHAN, 'Karenni States'):
            B31_BY_DIV[f['properties']['division']].append('A|B31:' + f['properties']['name'])
    # regional areas
    areas = {}
    for (vol, path, area), nodes in xw.items():
        rid = f'R|{vol}|{" > ".join(path)}|{area}'
        areas[rid] = (vol, path, area)
        edges[rid]
        if (vol, area) in NOT_COMPARABLE:
            continue
        for nd in (nodes or []):
            if nd.startswith('@'):
                link(rid, f'1941|{nd[1:]}')
            else:
                link(rid, nd)
        for ref in OUTSIDE.get((vol, area), []):
            link(rid, 'A|' + ref)
        if vol == 'burma':
            for ref in BURMA_SHAPES.get(deaccent(area), []):
                if ref.startswith('@'):
                    for k in B31_BY_DIV.get(ref[1:], []):
                        link(rid, k)
                else:
                    link(rid, 'A|B31:' + ref)
    for u, nd in VOL1.items():
        link('V|' + u, nd)
    # partitioned 1931 districts
    for k, v in info.items():
        if v['year'] == 1931 and v['name'] in PARTITION:
            for ref in PARTITION[v['name']]:
                link(k, 'A|' + ref)
    # present-day shapes
    shapes, sname, sstate = {}, {}, {}
    adm = adm2.load_adm()
    matched, _ = adm2.match(adm, info)
    for a in adm:
        key = None
        if a['state'] == 'jammuandkashmir':
            key = 'A|JK:' + a['name']            # J&K and Ladakh: drawn from the regional volume via OUTSIDE
        else:
            key = 'A|IND:' + a['id']
            if a['id'] in matched:
                link(key, matched[a['id']])
        if key:
            shapes[key] = fix(a['geom']); sname[key] = a['name'] + ' (India)'; sstate[key] = a['state']
    for c in ('PAK', 'BGD'):
        for f in json.load(open(os.path.join(G_DIR, f'{c}-ADM2.geojson')))['features']:
            k = f'A|{c}:' + f['properties']['shapeName']
            shapes[k] = fix(shape(f['geometry'])); sname[k] = f['properties']['shapeName'] + (' (Pakistan)' if c == 'PAK' else ' (Bangladesh)')
    for f in json.load(open(os.path.join(G_DIR, 'burma_1931_districts.geojson')))['features']:
        k = 'A|B31:' + f['properties']['name']
        if f['properties']['name'] in BURMA_UNADMINISTERED:
            k = 'A|B31X:' + f['properties']['name']
        shapes[k] = fix(shape(f['geometry'])); sname[k] = f['properties']['name'].replace('Distric', 'District').replace('Tracks', 'Tracts') + ' (Burma, 1931)'
    for k in list(edges):
        if k.startswith('A|') and k not in shapes:
            print('missing shape', k, file=sys.stderr)
    # components
    seen, comps = set(), []
    for n0 in list(edges):
        if n0 in seen:
            continue
        st, comp = [n0], []
        seen.add(n0)
        while st:
            x = st.pop(); comp.append(x)
            for y in edges[x]:
                if y not in seen:
                    seen.add(y); st.append(y)
        comps.append(comp)
    # figures per regional area
    byarea = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0, 0]))
    flags = collections.defaultdict(list)
    popa = {}
    for l in leaves:
        if l['area_total']:
            continue
        rid = f'R|{l["vol"]}|{" > ".join(l["area_path"])}|{l["area"]}'
        k = l['node'] if l['node'] is not None else '?'
        t = byarea[rid][k]
        t[0] += l['p'] or 0; t[1] += l['m'] or 0; t[2] += l['f'] or 0
        if l['flag']:
            flags[rid].append(l['flag'][0])
        if l['pop'] and l['pop'][0]:
            popa[rid] = l['pop']
    C = N.C
    units_out, stats = [], collections.Counter()
    for comp in comps:
        R = [x for x in comp if x.startswith('R|')]
        V = [x for x in comp if x.startswith('V|')]
        A = [x for x in comp if x.startswith('A|') and x in shapes]
        l31 = [x for x in comp if x.startswith('1931|') or x in ('1941|Andaman and Nicobar Islands', '1941|Sikkim', '1941|Coorg')]
        if not A:
            if R:
                stats['data without shapes'] += 1
                print('no shape for', [areas[x][2] for x in R], file=sys.stderr)
            continue
        covered = set()
        for x in R + V:
            covered |= {y for y in edges[x] if not y.startswith('A|')}
        missing31 = sorted(info[x]['name'] for x in l31 if x.startswith('1931|') and x not in covered)
        vals = collections.defaultdict(lambda: [0, 0, 0]); pop = [0, 0, 0]; members = []
        for x in R:
            vol, path, area = areas[x]
            for k, t in byarea[x].items():
                for i in range(3):
                    vals[k][i] += t[i]
            if x in popa:
                for i in range(3):
                    pop[i] += popa[x][i] or 0
            else:
                s = [sum(t[i] for t in byarea[x].values()) for i in range(3)]
                for i in range(3):
                    pop[i] += s[i]
            lp = sorted({(l['leaf'], l['page']) for l in leaves if l['vol'] == vol and l['area'] == area and l['area_path'] == list(path)}, key=lambda t: t[0])
            members.append({'vol': vol, 'area': area, 'path': list(path), 'leaves': [t[0] for t in lp], 'pages': [t[1] for t in lp],
                            'flags': sorted(set(flags.get(x, []))), 'check': CHK.get((vol, area))})
        for x in V:
            u = x[2:]
            for l in C['langs']:
                if not l['kids'] and l['v'].get(u):
                    t = l['v'][u]
                    for i in range(3):
                        vals[l['id']][i] += t[i] or 0
            pop = [pop[i] + (C['units'][u]['pop'][i] or 0) for i in range(3)]
            members.append({'vol': 'india', 'area': C['units'][u]['name'], 'path': [], 'leaves': [], 'flags': ['V']})
        nc = any(areas[x][:1] + (areas[x][2],) in NOT_COMPARABLE for x in R)
        status = 'nodata' if not (R or V) else ('partial' if missing31 else 'ok')
        if nc:
            status = 'nc'
        stats[status] += 1
        geom = unary_union([shapes[a] for a in A]).buffer(0)
        names31 = sorted({info[x]['name'] for x in l31})
        label = ', '.join(m['area'] for m in members) if members else ', '.join(names31)
        # population of the unit's area in every census 1901-2011, on 2011 district boundaries (Census 2011, Table A-2)
        series, snote, d2011 = None, None, []
        if any(a.startswith(('A|PAK:', 'A|BGD:', 'A|B31')) for a in A):
            ind = any(a.startswith(('A|IND:', 'A|JK:')) for a in A)
            snote = ('Partly outside present-day India' if ind else 'Outside present-day India') + ': Census 2011 Table A-2 has no series for it.'
        elif R or V:
            keys = [x for x in comp if x.startswith('2011|')]
            jk = [A2_JK.get(census2011.n(a[5:])) for a in A if a.startswith('A|JK:')]
            rows = [A2_BY_NODE.get(k) for k in keys] + [A2.get(k) for k in jk if k]
            names = [A2_NAME.get(k, info[k]['name']) for k in keys] + [k[1] for k in jk if k]
            if not rows or any(r is None for r in rows) or any(k is None for k in jk):
                snote = 'Not available: ' + ', '.join(sorted(info[k]['name'] for k in keys if k not in A2_BY_NODE)) + ' not in Table A-2.' if rows else None
            else:
                series = [None if any(r.get(y) is None for r in rows) else sum(r[y] for r in rows) for y in census2011.YEARS]
                d2011 = sorted(set(names))
        note = None
        if status == 'nodata':
            note = NODATA_NOTE.get(sstate.get(A[0], 'x'), 'No 1931 figures.')
        elif status == 'nc':
            note = 'Not comparable: the regional volume gives no district breakdown for this territory.'
        units_out.append({'akeys': A, 'series': series, 'snote': snote, 'd2011': d2011, 'note': note, 'geom': geom, 'name': label, 'names31': names31, 'members': members, 'missing31': missing31,
                          'status': status, 'pop': pop, 'vals': {str(k): v for k, v in vals.items() if v[0] or v[1] or v[2]},
                          'shapes': sorted(sname.get(a, a[2:]) for a in A)})
    # present-day districts linked to nothing: drawn as units without figures, so the map has no holes
    used = {a for u in units_out for a in u['akeys']}
    for a in sorted(shapes):
        if a in used:
            continue
        nm = sname.get(a, a[2:]).replace('DATA NOT AVAILABLE', 'Unassigned area in geoBoundaries').replace(' (Burma, 1931)', '')
        if a.startswith('A|B31X:'):
            note = 'Unadministered in 1931 and not enumerated (Census of India 1931, Vol. XI, Burma, Part I, p. 1).'
        elif a.startswith('A|PAK:'):
            note = ('Gwadar was a possession of Muscat in 1931, outside the census.' if 'Gwadar' in a else
                    'Not in the 1931 district tables. The tribal areas and agencies of the North-West Frontier (and the states of Dir, Swat and Chitral) were not enumerated by district.')
        elif sstate.get(a) == 'puducherry' or 'Yanam' in nm:
            note = 'French India in 1931: outside the Census of India.'
        else:
            note = 'No 1931 figures could be linked to this present-day district.'
        stats['no figures (unlinked shape)'] += 1
        units_out.append({'akeys': [a], 'series': None, 'snote': None, 'd2011': [], 'note': note, 'geom': shapes[a].buffer(0), 'name': nm.replace(' (Pakistan)', '').replace(' (India)', ''),
                          'names31': [], 'members': [], 'missing31': [], 'status': 'nodata', 'pop': [0, 0, 0], 'vals': {}, 'shapes': [nm]})
    print(dict(stats), file=sys.stderr)
    # projection identical to data/geo.js
    GEO = open(os.path.join(ROOT, 'data', 'geo.js')).read()
    Gj = json.loads(GEO[GEO.index('{'):GEO.rindex('}') + 1])
    P = Gj['proj']; Rr = P['pxPerDeg'] * 180 / math.pi
    YT = Rr * math.log(math.tan(math.pi / 4 + P['latMax'] * math.pi / 360))
    def fwd(x, y, z=None):
        return (x - P['lon0']) * P['pxPerDeg'], YT - Rr * math.log(math.tan(math.pi / 4 + y * math.pi / 360))
    geoms = [fix(transform(fwd, u['geom'])) for u in units_out]
    try:
        simp = list(shapely.coverage_simplify(geoms, 0.25))
    except Exception as e:
        print('coverage simplify failed:', e, file=sys.stderr)
        simp = [g.simplify(0.25, preserve_topology=True) for g in geoms]
    def path(g):
        polys = [g] if g.geom_type == 'Polygon' else [p for p in getattr(g, 'geoms', []) if p.geom_type == 'Polygon']
        out = []
        for p in polys:
            if p.area < 0.05:
                continue
            for ring in [p.exterior] + list(p.interiors):
                cs = list(ring.coords)[:-1]
                if len(cs) >= 3:
                    out.append('M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in cs) + 'Z')
        return ''.join(out)
    # 1931 outlines drawn from the units themselves: each unit belongs to the volume holding most of its people
    groups = collections.defaultdict(list)
    for i, u in enumerate(units_out):
        if not u['members']:
            continue
        w = collections.Counter()
        for m in u['members']:
            w[m['area'] if m['vol'] == 'india' else m['vol']] += ((m.get('check') or [0])[0] or 1)
        groups[w.most_common(1)[0][0]].append(i)
    prov = [{'g': k, 'd': path(fix(unary_union([simp[i] for i in ix])))} for k, ix in sorted(groups.items())]
    # neighbours (units sharing a boundary), so the map can label each contiguous block of units once
    from shapely.strtree import STRtree
    tree = STRtree(simp)
    nbrs = []
    for i, g in enumerate(simp):
        gb = g.buffer(0.3)
        nbrs.append(sorted(int(j) for j in tree.query(gb) if j != i and gb.intersection(simp[j]).length > 0.5 or
                           (j != i and gb.intersection(simp[j]).area > 0.05)))
    out = []
    for u, g, g0 in zip(units_out, simp, geoms):
        big = max(g0.geoms, key=lambda p: p.area) if hasattr(g0, 'geoms') else g0
        pt = big.representative_point()
        out.append({'d': path(g), 'lx': round(pt.x, 1), 'ly': round(pt.y, 1), 'name': u['name'], 'names31': u['names31'],
                    'members': u['members'], 'missing31': u['missing31'], 'status': u['status'], 'pop': u['pop'],
                    'vals': u['vals'], 'shapes': u['shapes'], 'note': u['note'],
                    'coarse': any(m['vol'] == 'burma' for m in u['members']),
                    'series': u['series'], 'snote': u['snote'], 'd2011': u['d2011'],
                    'nb': nbrs[len(out)], 'ar': round(g0.area, 1)})
    # every regional figure used, long format, with its classification match and map unit
    import csv
    unit_of = {}
    for i, u in enumerate(units_out):
        for m in u['members']:
            unit_of[(m['vol'], tuple(m['path']), m['area'])] = i
    with open(os.path.join(ROOT, 'data', 'regional_table15.csv'), 'w', newline='') as fh:
        w = csv.writer(fh)
        w.writerow(['volume', 'area_path', 'area', 'area_is_total', 'language_as_printed', 'lang_path', 'persons', 'males', 'females',
                    'vol1_entry', 'matched_by', 'mark', 'mark_note', 'scan_leaf', 'printed_page', 'district_map_unit'])
        for l in leaves:
            nd = l['node']
            w.writerow([l['vol'], ' > '.join(l['area_path']), l['area'], l['area_total'], l['language'], ' > '.join(l['lang_path']),
                        l['p'], l['m'], l['f'], (N.L[nd]['name'] if isinstance(nd, int) else nd or ''), l['how'] or '',
                        l['flag'][0] if l['flag'] else '', l['flag'][1] if l['flag'] else '', l['leaf'], l['page'],
                        '' if l['area_total'] else unit_of.get((l['vol'], tuple(l['area_path']), l['area']), '')])
    vols = {}
    man = json.load(open(os.path.join(ROOT, 'source', 'regional', 'manifest.json')))
    for m in man:
        vols[m['key']] = {'title': __import__('load').VOL_NAMES.get(m['key'], m.get('title')), 'identifier': m.get('identifier'), 'unit': m.get('unit')}
    with open(os.path.join(ROOT, 'data', 'districts.js'), 'w') as fh:
        fh.write('/* Generated by tools/regional/build_districts.py. See docs/regional.md. */\n')
        fh.write('window.DISTRICTS = ' + json.dumps({'units': out, 'vols': vols, 'prov': prov}, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print('wrote data/districts.js', os.path.getsize(os.path.join(ROOT, 'data', 'districts.js')) // 1024, 'KB', len(out), 'units', file=sys.stderr)

if __name__ == '__main__':
    main()
