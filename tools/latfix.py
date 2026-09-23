#!/usr/bin/env python3
"""Rebuild source/geo/plague_india/india_1931_latfix_wgs84.geojson from the
plague_india shapefile. Its .prj claims an equal-area projection, but the
coordinates are degrees with latitude stretched northward; this quadratic,
fitted against 1941 district boundaries, brings them back to within ~0.1°:
    lat = -0.00579*y^2 + 1.10155*y - 0.53785
Needs pyshp."""
import json, os, shapefile
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'source', 'geo', 'plague_india')
def fixc(c):
    if isinstance(c[0], (int, float)):
        x, y = c[0], c[1]
        return [round(x, 6), round(-0.00579 * y * y + 1.10155 * y - 0.53785, 6)]
    return [fixc(e) for e in c]
r = shapefile.Reader(os.path.join(D, 'india_1931'))
names = [f[0] for f in r.fields][1:]
feats = []
for sr in r.iterShapeRecords():
    g = sr.shape.__geo_interface__ if sr.shape.shapeType else None
    if g and g.get('coordinates'):
        g = {'type': g['type'], 'coordinates': fixc(g['coordinates'])}
    else:
        g = None
    feats.append({'type': 'Feature', 'properties': dict(zip(names, sr.record)), 'geometry': g})
json.dump({'type': 'FeatureCollection', 'features': feats}, open(os.path.join(D, 'india_1931_latfix_wgs84.geojson'), 'w'))
print('ok', len(feats))
