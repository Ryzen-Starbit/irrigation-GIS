import json, math
from shapely.geometry import LineString, Point, MultiLineString
from shapely.ops import unary_union, polygonize, nearest_points
from shapely.strtree import STRtree

def load(path):
    return json.load(open(path))['entities']

def pts(e):
    if e['type'] in ('LWPOLYLINE', 'POLYLINE2D'):
        v = [(p['x'], p['y']) for p in e.get('vertices', [])]
        if v and (e.get('flag', 0) & 1):
            v.append(v[0])
        return v
    if e['type'] == 'LINE':
        return [(e['startPoint']['x'], e['startPoint']['y']), (e['endPoint']['x'], e['endPoint']['y'])]
    return []

def text_center(e):
    p = e['startPoint']; h = e.get('textHeight', 1) or 1; r = e.get('rotation', 0) or 0
    if (e.get('halign') or e.get('valign')) and e.get('endPoint') and (e['endPoint']['x'] or e['endPoint']['y']):
        p = e['endPoint']; return Point(p['x'], p['y'])
    w = len(e['text'].strip()) * h * 0.75
    return Point(p['x'] + math.cos(r) * w / 2 - math.sin(r) * h / 2,
                 p['y'] + math.sin(r) * w / 2 + math.cos(r) * h / 2)

def close_dangles(lines, tol):
    noded = unary_union(lines)
    segs = list(noded.geoms) if hasattr(noded, 'geoms') else [noded]
    deg = {}
    for s in segs:
        for c in (s.coords[0], s.coords[-1]):
            k = (round(c[0], 4), round(c[1], 4)); deg[k] = deg.get(k, 0) + 1
    tree = STRtree(segs)
    extra = []
    for k, d in deg.items():
        if d != 1: continue
        p = Point(k)
        best = None
        for i in tree.query(p.buffer(tol)):
            s = segs[i]
            if s.coords[0] == k or s.coords[-1] == k:
                if p.distance(s) == 0 and (round(s.coords[0][0],4),round(s.coords[0][1],4)) in (k,) or (round(s.coords[-1][0],4),round(s.coords[-1][1],4)) in (k,):
                    continue
            dist = p.distance(s)
            if 1e-9 < dist <= tol and (best is None or dist < best[0]):
                best = (dist, s)
        if best:
            q = nearest_points(p, best[1])[1]
            dx, dy = q.x - p.x, q.y - p.y; n = math.hypot(dx, dy)
            extra.append(LineString([k, (q.x + dx / n * 1e-3, q.y + dy / n * 1e-3)]))
    return segs + extra, len(extra)

def polygons_from_lines(lines, tol):
    segs, n = close_dangles(lines, tol)
    return list(polygonize(unary_union(segs))), n
