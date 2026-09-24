#!/usr/bin/env python3
"""Burma's 1931 districts and states as GeoJSON, from the administrative layer of the Japanese Empire map
(https://froginawell.net/reference/japanese-empire/, file japan-empire-map-admin.svg, group data-for="burma").

That SVG is a Mercator projection: x = (lon - 66) * 20, y = yTop - R * ln(tan(pi/4 + lat/2)), with
R = 1145.915590 and yTop computed from latMax = 55 (the map's data-lon-min, data-px-per-deg, data-r and
data-lat-max attributes). Each path carries data-prov (district or state) and data-parent (division).
The shapes are clipped to Myanmar's outline in Natural Earth, and land in that outline that no shape
covers goes to the shape it touches most, so they meet the other units of the district map.

  python3 tools/regional/burma1931.py path/to/japan-empire-map-admin.svg  -> source/geo/burma_1931_districts.geojson
"""
import json, math, os, re, sys
import shapefile
from shapely.geometry import Polygon, shape, mapping
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
GEO = os.path.join(HERE, '..', '..', 'source', 'geo')
LON_MIN, PX, R, LAT_MAX = 66.0, 20.0, 1145.915590, 55.0
YTOP = R * math.log(math.tan(math.pi / 4 + LAT_MAX * math.pi / 360))

def inv(x, y):
    return LON_MIN + x / PX, (math.atan(math.exp((YTOP - y) / R)) - math.pi / 4) * 360 / math.pi

def polys(d):
    out = []
    for ring in re.findall(r'M([^MZ]+)Z?', d):
        pts = [tuple(map(float, p.split())) for p in re.split(r'L', ring.strip()) if p.strip()]
        if len(pts) >= 3:
            p = Polygon([inv(x, y) for x, y in pts]).buffer(0)
            if not p.is_empty:
                out.append(p)
    return out

def main(svg):
    s = open(svg).read()
    i = s.find('data-for="burma"')
    seg = s[i:s.find('</g>', i)]
    parts = {}
    for m in re.finditer(r'<path ([^>]*?) d="([^"]*)"', seg):
        attrs = dict(re.findall(r'data-([a-z]+)="([^"]*)"', m.group(1)))
        if attrs.get('epoch', 'e1930') != 'e1930':
            continue
        name = attrs.get('prov') or ('(unnamed, ' + attrs.get('parent', '') + ')')
        g = unary_union(polys(m.group(2)))
        key = (name, attrs.get('parent', ''))
        parts[key] = unary_union([parts[key], g]) if key in parts else g
    r = shapefile.Reader(os.path.join(GEO, 'ne_10m_admin_1_states_provinces', 'ne_10m_admin_1_states_provinces'))
    fl = [x[0] for x in r.fields][1:]
    mm = unary_union([shape(sr.shape.__geo_interface__).buffer(0) for sr in r.iterShapeRecords()
                      if dict(zip(fl, sr.record))['adm0_a3'] == 'MMR'])
    clipped = {k: g.intersection(mm) for k, g in parts.items()}
    rest = mm.difference(unary_union(list(clipped.values())))
    for p in getattr(rest, 'geoms', [rest]):
        if p.is_empty or p.geom_type != 'Polygon':
            continue
        best = max(clipped, key=lambda k: p.buffer(0.02).intersection(clipped[k]).area)
        clipped[best] = unary_union([clipped[best], p])
    feats = [{'type': 'Feature', 'properties': {'name': k[0], 'division': k[1]}, 'geometry': mapping(g.buffer(0))}
             for k, g in sorted(clipped.items()) if not g.is_empty]
    out = os.path.join(GEO, 'burma_1931_districts.geojson')
    json.dump({'type': 'FeatureCollection', 'source': 'https://froginawell.net/reference/japanese-empire/ (admin layer, 1930)',
               'features': feats}, open(out, 'w'))
    print(len(feats), 'shapes ->', out)

if __name__ == '__main__':
    main(sys.argv[1])
