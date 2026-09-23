#!/usr/bin/env python3
"""Audit data/units1931.geojson for boundary artefacts. Needs shapely + pyshp.

  1. gaps: land inside the mapped area covered by no unit
  2. thin strips / protrusions: what a morphological opening of 0.03 deg removes
  3. small detached fragments of each unit, with the neighbour they sit against
  4. composition of each modern admin-1 area by 1931 unit (small minority shares are suspects)
"""
import json, math, os, sys
import shapefile
from shapely.geometry import shape
from shapely.ops import unary_union, transform

HERE = os.path.dirname(os.path.abspath(__file__))
G = {f['properties']['code']: shape(f['geometry']) for f in
     json.load(open(os.path.join(HERE, '..', 'data', 'units1931.geojson')))['features']}
R = 6371.0088
def A(g):
    return transform(lambda x, y, z=None: (R * math.radians(x) * math.cos(math.radians(y)), R * math.radians(y)), g).area / 2.589988
def parts(g):
    return list(g.geoms) if hasattr(g, 'geoms') else [g]
def where(g):
    c = g.representative_point(); return f'{c.x:.2f}E {c.y:.2f}N'
def neighbour(g, skip):
    best, bl = None, 0
    for k, u in G.items():
        if k == skip: continue
        l = g.buffer(0.01).intersection(u).area
        if l > bl: best, bl = k, l
    return best

units = {k: v for k, v in G.items() if not k.startswith('x_')}
allg = unary_union(list(G.values()))
mode = sys.argv[1] if len(sys.argv) > 1 else 'all'

if mode in ('all', 'gaps'):
    print('== 1. gaps inside the mapped area (holes of the union, > 0.5 sq mi)')
    for p in parts(allg):
        for ring in p.interiors:
            from shapely.geometry import Polygon
            h = Polygon(ring)
            if A(h) > 0.5:
                print(f'   gap {A(h):7.1f} sq mi at {where(h)}')

if mode in ('all', 'thin'):
    print('== 2. thin strips / protrusions (> 3 sq mi removed by a 0.03 deg opening)')
    for k, g in units.items():
        op = g.buffer(-0.03).buffer(0.03)
        res = g.difference(op)
        for p in parts(res):
            if A(p) > 3:
                # skip coastal fringe: residue touching the sea edge of the union
                coast = p.buffer(0.02).difference(allg).area > 0.3 * p.buffer(0.02).difference(p).area
                print(f'   unit {k:>3}: {A(p):7.1f} sq mi at {where(p)} next to {neighbour(p, k)}{"  (coast)" if coast else ""}')

if mode in ('all', 'frag'):
    print('== 3. detached fragments (< 3% of the unit, > 2 sq mi)')
    for k, g in units.items():
        ps = sorted(parts(g), key=lambda p: -p.area)
        tot = A(g)
        for p in ps[1:]:
            a = A(p)
            if a > 2 and a < 0.03 * tot:
                print(f'   unit {k:>3}: {a:7.1f} sq mi at {where(p)} surrounded by {neighbour(p, k)}')

if mode in ('all', 'admin'):
    print('== 4. modern admin-1 composition (minority shares 0.2%-5%)')
    r = shapefile.Reader(os.path.join(HERE, '..', 'source', 'geo', 'ne_10m_admin_1_states_provinces', 'ne_10m_admin_1_states_provinces'))
    f = [x[0] for x in r.fields][1:]
    for sr in r.iterShapeRecords():
        d = dict(zip(f, sr.record))
        if d['adm0_a3'] not in ('IND', 'PAK', 'BGD', 'MMR'): continue
        a1 = shape(sr.shape.__geo_interface__).buffer(0)
        tot = A(a1)
        comp = sorted(((A(a1.intersection(u)) / tot * 100, k) for k, u in G.items() if a1.intersects(u)), reverse=True)
        minor = [(round(s, 2), k) for s, k in comp if 0.2 <= s < 5]
        if minor:
            print(f'   {d["name"]} ({d["adm0_a3"]}): main {[(round(s,1),k) for s,k in comp if s>=5]}  minor {minor}')
