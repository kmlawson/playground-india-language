#!/usr/bin/env python3
"""Build the map geometry (geo.js) for the 1931 census units.

Base: wtennant/plague_india `india_1931` (LGPL-3.0), latitude-corrected to WGS84
(`india_1931_latfix_wgs84.geojson`: lat = -0.00579*y^2 + 1.10155*y - 0.53785).
That file has one polygon per province, split only into British (NATIVE=0) and
princely (NATIVE=1) territory, so several 1931 census units are merged in it.
They are separated here with modern district boundaries (geoBoundaries ADM2),
which follow the old lines closely enough at this scale:

  Sylhet (+ Karimganj)          Bengal -> Assam
  Bahawalpur division           Punjab (British) -> Punjab States Agency
  Khairpur                      Bombay (British) -> Bombay States
  Kalat, Las Bela, Kharan...    Baluchistan -> Baluchistan States
  Gwadar                        Baluchistan -> Muscat (not India in 1931)
  Chitral, Dir, Swat, FATA...   NWFP -> NWFP Agencies and Tribal Areas
  Kathiawar, Cutch, Palanpur    Bombay States -> Western India States Agency
  Simla Hill States             Punjab States Agency -> Punjab States

Everything is clipped to Natural Earth 10m land, slivers between units are
handed to the neighbour sharing most boundary, and the result is projected
with the same spherical Mercator the froginawell.net Japanese-empire map uses.
Run with a Python that has shapely + pyshp.
"""
import json, math, os, sys
import shapefile
from shapely.geometry import shape, mapping, Point, box
from shapely.ops import unary_union, transform
from shapely import make_valid

HERE = os.path.dirname(os.path.abspath(__file__))
G = os.path.join(HERE, '..', 'source', 'geo')
OUT = os.path.join(HERE, '..', 'data', 'geo.js')

def fix(g):
    g = make_valid(g)
    if g.geom_type == 'GeometryCollection':
        g = unary_union([p for p in g.geoms if p.geom_type in ('Polygon', 'MultiPolygon')])
    return g.buffer(0)

def gb(country, names, pred=None):
    d = json.load(open(os.path.join(G, f'{country}-ADM2.geojson')))
    out = []
    got = set()
    for f in d['features']:
        n = f['properties']['shapeName']
        if n in names:
            s = fix(shape(f['geometry']))
            if pred and not pred(s):
                continue
            out.append(s); got.add(n)
    miss = set(names) - got
    if miss:
        sys.exit(f'geoBoundaries {country}: missing {sorted(miss)}')
    return unary_union(out)

def ne(layer, field, values):
    r = shapefile.Reader(os.path.join(G, layer, layer))
    fields = [x[0] for x in r.fields][1:]
    out = {}
    for sr in r.iterShapeRecords():
        rec = dict(zip(fields, sr.record))
        if values is None or rec[field] in values:
            out.setdefault(rec[field], []).append(fix(shape(sr.shape.__geo_interface__)))
    return {k: unary_union(v) for k, v in out.items()}

# ---------------------------------------------------------------- base units
base = json.load(open(os.path.join(G, 'plague_india', 'india_1931_latfix_wgs84.geojson')))
P = {}
for f in base['features']:
    if not f['geometry']:
        continue
    p = f['properties']
    P[(p['STATE_NAME'], p['NATIVE'])] = fix(shape(f['geometry']))

U = {
    '1': P[('Ajmer Merwara', 0)],
    '3': P[('Assam', 0)],
    '4': P[('Baluchistan Agency', None)],
    '5': P[('Bengal', 0)],
    '6': P[('Bihar And Orissa', 0)],
    '7': P[('Bombay Presidency', 0)],
    '8': unary_union([P[('Burma', 0)], P[('Burma', 1)]]),
    '9': P[('Central Province And Berar', 0)],
    '10': P[('Coorg', 0)],
    '11': P[('Delhi', 0)],
    '12': P[('Madras Presidency', 0)],
    '13': P[('North West Frontier Province', 0)],
    '14': P[('Punjab', 0)],
    '15': P[('United Province Of Agra And Oudh', 0)],
    '16': P[('Assam', 1)],
    '18': P[('Baroda', 1)],
    '19': P[('Bengal', 1)],
    '20': P[('Bihar And Orissa', 1)],
    '21': P[('Bombay Presidency', 1)],
    '22': P[('Central India Agency', 1)],
    '23': P[('Central Province And Berar', 1)],
    '24': P[('Gwalior', 1)],
    '25': P[('Hyderabad', 1)],
    '26': P[('Jammu And Kashmir', 1)],
    '27': P[('Madras Presidency', 1)],
    '28': P[('Mysore', 1)],
    '31': P[('Punjab', 1)],
    '32': P[('Rajputana Agency', 1)],
    '33': P[('Sikkim', 1)],
    '34': P[('United Province Of Agra And Oudh', 1)],
}
# Tracts beyond the administered frontier in the north-east: not census units.
X = {
    'tribal_ne': unary_union([P[('Naga Tribes', 0)], P[('Singhpos', 0)]]),
    'goa': P[('Goa', None)],
}

def move(geom, frm, to):
    """Take `geom` out of unit `frm` (and every other unit) and give it to `to`."""
    part = U[frm].intersection(geom)
    for k in list(U):
        U[k] = U[k].difference(geom)
    if to in U:
        U[to] = unary_union([U[to], part])
    else:
        U[to] = part

# Sylhet was in Assam in 1931.
sylhet = unary_union([gb('BGD', ['Sylhet', 'Sunamganj', 'Habiganj', 'Maulvibazar']),
                      gb('IND', ['Karimganj'])])
U['3'] = unary_union([U['3'], U['5'].intersection(sylhet.buffer(0.02))])
U['5'] = U['5'].difference(sylhet.buffer(0.02))

# Bahawalpur State: Punjab States Agency.
bahawalpur = gb('PAK', ['Bahawalpur', 'Bahawalnagar', 'Rahim Yar Khan'])
move(bahawalpur, '14', '31')

# Khairpur State: Bombay States.
move(gb('PAK', ['Khairpur']), '7', '21')

# Baluchistan: Kalat (with Makran and Kharan) and Las Bela were the States.
# Gwadar was Muscat's until 1958.
gwadar = gb('PAK', ['Gwadar'])
X['gwadar'] = U['4'].intersection(gwadar)
U['4'] = U['4'].difference(gwadar)
bal_states = gb('PAK', ['Kalat', 'Mastung', 'Khuzdar', 'Awaran', 'Lasbela', 'Kharan', 'Panjgur',
                        'Kech', 'Jhal Magsi', 'Kachhi'])
move(bal_states, '4', '17')

# NWFP: the Malakand states, the agencies and the tribal belt.
nwfp_tribal = gb('PAK', ['Chitral', 'Upper Dir', 'Lower Dir', 'Swat', 'Malakand', 'Buner', 'Shangla',
                         'Bajaur', 'Mohmand', 'Khyber', 'Kurram', 'Orakzai', 'North Waziristan',
                         'South Waziristan', 'Kohistan'])
move(nwfp_tribal, '13', '29')

# Bombay States vs Western India States Agency (Kathiawar, Cutch, Palanpur agency).
wisa = gb('IND', ['Kachchh', 'Rajkot', 'Jamnagar', 'Devbhumi Dwarka', 'Porbandar', 'Junagadh',
                  'Gir Somnath', 'Amreli', 'Bhavnagar', 'Surendranagar', 'Morbi',
                  'Banas Kantha', 'Patan'])
U['35'] = U['21'].intersection(wisa)
U['21'] = U['21'].difference(wisa)

# Punjab States (Simla Hill States etc.) vs Punjab States Agency.
simla = gb('IND', ['Shimla', 'Kinnaur', 'Solan', 'Bilaspur'], pred=lambda s: s.centroid.y > 30)
U['30'] = U['31'].intersection(simla)
U['31'] = U['31'].difference(simla)

# Andaman and Nicobar Islands from Natural Earth.
adm1 = ne('ne_10m_admin_1_states_provinces', 'name', {'Andaman and Nicobar', 'Manipur', 'Tripura', 'Meghalaya',
                                                     'Arunachal Pradesh', 'Lakshadweep'})
U['2'] = adm1['Andaman and Nicobar']

# ------------------------------------------------------------ district-based overrides
# plague_india is hand-traced and coarse; where a 1931 unit coincides with modern
# districts, those are used instead (checked against the areas printed in Table I:
# see tools/area_check.py). The displaced remainder of the old shape becomes a gap
# and is handed to its neighbours below.
OVERRIDDEN = set()
def override(k, geom):
    OVERRIDDEN.add(k)
    geom = fix(geom)
    for j in list(U):
        if j != k:
            U[j] = U[j].difference(geom)
    U[k] = geom

override('10', gb('IND', ['Kodagu']))                                          # Coorg
override('29', nwfp_tribal)
override('13', gb('PAK', ['Abbottabad', 'Haripur', 'Mansehra', 'Battagram', 'Peshawar', 'Charsadda',
                          'Nowshera', 'Mardan', 'Swabi', 'Kohat', 'Hangu', 'Karak', 'Bannu',
                          'Lakki Marwat', 'Dera Ismail Khan', 'Tank']))
benares = U['34'].intersection(box(81.5, 24.5, 84, 26))                         # Benares State
override('34', unary_union([gb('IND', ['Tehri Garhwal', 'Uttarkashi', 'Rampur']), benares]))
khasi = U['16'].intersection(adm1['Meghalaya'].buffer(0.02))
override('16', unary_union([adm1['Manipur'], khasi]))                          # Manipur + Khasi States
override('19', unary_union([adm1['Tripura'], gb('IND', ['Koch Bihar'])]))       # Tripura + Cooch Behar
override('30', simla)                                                           # Simla Hill States
# Boundaries that became today's international border: Bahawalpur/Bikaner and Sind/Rajputana
# (India-Pakistan), and Burma's frontiers. The whole modern unit replaces plague_india's trace.
override('31', unary_union([U['31'], bahawalpur]))                              # Bahawalpur fully in PSA
adm1b = ne('ne_10m_admin_1_states_provinces', 'name', {'Sind'})
khairpur = gb('PAK', ['Khairpur'])
sind = adm1b['Sind'].difference(khairpur)
U['7'] = unary_union([U['7'], sind])
for j in U:
    if j not in ('7',):
        U[j] = U[j].difference(sind)
override('21', unary_union([U['21'], khairpur]))
burma = ne('ne_10m_admin_0_countries', 'ADMIN', {'Myanmar'})['Myanmar']
override('8', burma.difference(X['tribal_ne']))
U['12'] = unary_union([U['12'], adm1['Lakshadweep']])                          # Laccadives, Minicoy
# NEFA: the Balipara and Sadiya frontier tracts were administered only along the plains
X['tribal_ne'] = unary_union([X['tribal_ne'], adm1['Arunachal Pradesh']])
U['3'] = U['3'].difference(adm1['Arunachal Pradesh'])
# Rann of Kutch (OpenStreetMap, ODbL): salt waste, not counted in the areas of Cutch or Sind
rann = fix(shape(json.load(open(os.path.join(G, 'rann_of_kutch_osm.geojson')))['features'][0]['geometry']))
for k in U:
    U[k] = U[k].difference(rann)
X['rann'] = rann
# French and Portuguese India
X['goa'] = unary_union([X['goa'], gb('IND', ['Daman', 'Diu', 'Dadra & Nagar Haveli'])])
X['french'] = gb('IND', ['Puducherry', 'Karaikal', 'Mahe', 'Yanam'])
for k in U:
    U[k] = U[k].difference(X['goa']).difference(X['french'])

# ---------------------------------------------------------------- clip & fill
land = ne('ne_10m_land', 'featurecla', None)
land = unary_union(list(land.values())).intersection(box(55, 0, 105, 40))
countries = ne('ne_10m_admin_0_countries', 'ADMIN', None)
NEIGH = ['Nepal', 'Bhutan', 'China', 'Afghanistan', 'Iran', 'Sri Lanka', 'Thailand', 'Laos',
         'Tajikistan', 'Oman', 'Yemen', 'Maldives', 'Turkmenistan', 'Uzbekistan', 'Vietnam',
         'Cambodia', 'Malaysia', 'Indonesia', 'Kyrgyzstan', 'Kazakhstan', 'United Arab Emirates',
         'Somaliland', 'Somalia', 'Ethiopia', 'Djibouti', 'Eritrea', 'Saudi Arabia', 'Qatar', 'Bahrain']
foreign = unary_union([countries[n] for n in NEIGH if n in countries]).buffer(0)

foreign_nochina = unary_union([countries[n] for n in NEIGH if n in countries and n != 'China']).buffer(0)
for k in U:
    # Aksai Chin lies inside Jammu and Kashmir's 1931 area (84,516 sq mi)
    U[k] = U[k].intersection(land).difference(foreign_nochina if k == '26' else foreign)
for k in X:
    X[k] = X[k].intersection(land).difference(foreign)

allu = unary_union(list(U.values()) + list(X.values()))
modern = unary_union([countries[n] for n in ('India', 'Pakistan', 'Bangladesh', 'Myanmar')])
domain = allu.buffer(0.35).intersection(land).intersection(modern.buffer(0.05)).difference(foreign)
gaps = domain.difference(allu)
gparts = list(gaps.geoms) if hasattr(gaps, 'geoms') else [gaps]
assigned = 0
for g in gparts:
    if g.area < 1e-7:
        continue
    best, bl = None, 0.0
    for k, u in U.items():
        if k in OVERRIDDEN and g.area > 0.002:   # their extent is authoritative; only coastal slivers
            continue
        l = g.buffer(0.01).intersection(u).area
        if l > bl:
            best, bl = k, l
    if best:
        U[best] = unary_union([U[best], g]); assigned += 1
print(f'filled {assigned} gap pieces', file=sys.stderr)
# hatched non-units win over units where they touch
xall = unary_union([v for v in X.values() if not v.is_empty])
for k in U:
    U[k] = U[k].difference(xall)
# settle overlaps: earlier numeric ids keep contested area
order = sorted(U, key=lambda k: int(k))
taken = None
for k in order:
    U[k] = U[k].buffer(0)
    if taken is not None:
        U[k] = U[k].difference(taken)
    taken = U[k] if taken is None else unary_union([taken, U[k]])

# unprojected result, for checking and for reuse
feats = [{'type': 'Feature', 'properties': {'code': k}, 'geometry': mapping(U[k])} for k in order]
feats += [{'type': 'Feature', 'properties': {'code': 'x_' + k}, 'geometry': mapping(v)} for k, v in X.items() if not v.is_empty]
with open(os.path.join(HERE, '..', 'data', 'units1931.geojson'), 'w') as fh:
    json.dump({'type': 'FeatureCollection', 'features': feats}, fh, separators=(',', ':'))

# ---------------------------------------------------------------- projection
LON0, LAT_MAX, PXD = 60.0, 38.0, 20.0
R = PXD * 180 / math.pi
YTOP = R * math.log(math.tan(math.pi / 4 + LAT_MAX * math.pi / 360))
def fwd(lon, lat):
    return (lon - LON0) * PXD, YTOP - R * math.log(math.tan(math.pi / 4 + lat * math.pi / 360))
def proj(g):
    return transform(lambda x, y, z=None: fwd(x, y), g)

TOL = 0.35  # px (≈0.017°)
def path(g, tol=TOL, minarea=0.6):
    g = proj(g).simplify(tol, preserve_topology=True)
    polys = [g] if g.geom_type == 'Polygon' else [p for p in getattr(g, 'geoms', []) if p.geom_type == 'Polygon']
    out = []
    for p in polys:
        if p.area < minarea:
            continue
        for ring in [p.exterior] + list(p.interiors):
            cs = list(ring.coords)[:-1]
            if len(cs) < 3:
                continue
            out.append('M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in cs) + 'Z')
    return ''.join(out)

def label_pt(g):
    g2 = proj(g)
    big = max(g2.geoms, key=lambda p: p.area) if hasattr(g2, 'geoms') else g2
    p = big.representative_point()
    # prefer centroid if it lies inside
    c = big.centroid
    if big.contains(c):
        p = c
    return round(p.x, 1), round(p.y, 1)

x0, y0 = fwd(60.5, 37.5)
x1, y1 = fwd(101.5, 5.5)
vb = [round(x0, 1), round(y0, 1), round(x1 - x0, 1), round(y1 - y0, 1)]
frame = box(50, -6, 112, 48)

units = {}
for k in order:
    lx, ly = label_pt(U[k])
    units[k] = {'d': path(U[k]), 'lx': lx, 'ly': ly}
extra = {k: {'d': path(v), 'lx': label_pt(v)[0], 'ly': label_pt(v)[1]} for k, v in X.items() if not v.is_empty}

neigh = []
for n in ['Afghanistan', 'Iran', 'Nepal', 'Bhutan', 'China', 'Sri Lanka', 'Thailand', 'Laos',
          'Tajikistan', 'Oman', 'Turkmenistan', 'Uzbekistan', 'Malaysia', 'Vietnam', 'Cambodia',
          'Indonesia', 'Kyrgyzstan', 'Kazakhstan', 'United Arab Emirates', 'Maldives', 'Saudi Arabia',
          'Qatar', 'Bahrain', 'Yemen', 'Russia', 'Mongolia', 'Azerbaijan', 'Kuwait', 'Iraq']:
    if n in countries:
        g = countries[n].intersection(frame)
        if not g.is_empty:
            neigh.append({'n': n, 'd': path(g, tol=0.6, minarea=1.5)})

cities = [('Delhi', 77.21, 28.61), ('Calcutta', 88.36, 22.57), ('Bombay', 72.83, 18.94),
          ('Madras', 80.27, 13.08), ('Karachi', 67.01, 24.86), ('Lahore', 74.34, 31.55),
          ('Rangoon', 96.2, 16.87), ('Mandalay', 96.08, 21.97), ('Hyderabad', 78.47, 17.38),
          ('Bangalore', 77.59, 12.97), ('Lucknow', 80.95, 26.85), ('Dacca', 90.41, 23.81),
          ('Nagpur', 79.09, 21.15), ('Peshawar', 71.58, 34.01), ('Quetta', 67.0, 30.18),
          ('Srinagar', 74.8, 34.08), ('Patna', 85.14, 25.6), ('Ahmedabad', 72.57, 23.02),
          ('Shillong', 91.88, 25.57), ('Trivandrum', 76.94, 8.52), ('Jaipur', 75.79, 26.91),
          ('Cuttack', 85.88, 20.46), ('Colombo', 79.86, 6.93), ('Kathmandu', 85.32, 27.71)]
cities = [{'n': n, 'x': round(fwd(lo, la)[0], 1), 'y': round(fwd(lo, la)[1], 1)} for n, lo, la in cities]

grat = []
for lon in range(50, 115, 5):
    pts = [fwd(lon, lat) for lat in range(-5, 49)]
    grat.append({'k': 'lon', 'v': lon, 'd': 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in pts)})
for lat in range(-5, 50, 5):
    pts = [fwd(lon, lat) for lon in range(50, 113)]
    grat.append({'k': 'lat', 'v': lat, 'd': 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in pts)})

out = {'viewBox': vb, 'units': units, 'extra': extra, 'neighbours': neigh, 'cities': cities,
       'graticule': grat,
       'proj': {'type': 'mercator', 'lon0': LON0, 'latMax': LAT_MAX, 'pxPerDeg': PXD}}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w') as fh:
    fh.write('/* Generated by tools/build_geo.py — do not edit. Geometry: see sources.html. */\n')
    fh.write('window.GEO = ' + json.dumps(out, separators=(',', ':')) + ';\n')
print(f'wrote {OUT} ({os.path.getsize(OUT)//1024} KB), units: {sorted(units, key=int)}', file=sys.stderr)
