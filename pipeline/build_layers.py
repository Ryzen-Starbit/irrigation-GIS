import sys, json, math, re, collections, statistics, os
from shapely.geometry import LineString, Point, Polygon, MultiPolygon, box, mapping
from shapely.ops import unary_union, polygonize, voronoi_diagram, transform
from shapely import affinity
sys.path.insert(0, os.path.dirname(__file__))
from dwgutil import load, pts, text_center, polygons_from_lines

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEOREF = json.load(open(os.path.join(ROOT, 'config', 'georef.json')))
SHEET_X = (78850, 79500)         
LEGEND_BOX = (79295, 67990, 79500, 68085) 
GAOTHAN_SHEET_DX = 3545.63      

def in_sheet(e):
    p = pts(e)
    q = p[0] if p else ((e.get('insertionPoint') or e.get('startPoint') or {}).get('x'), (e.get('insertionPoint') or e.get('startPoint') or {}).get('y'))
    if q[0] is None or not (SHEET_X[0] <= q[0] <= SHEET_X[1]): return False
    if p and all(LEGEND_BOX[0] <= x <= LEGEND_BOX[2] and LEGEND_BOX[1] <= y <= LEGEND_BOX[3] for x, y in p): return False
    return True

def norm_outlet(s):
    s = re.sub(r'\s+', '', s.upper())
    s = s.replace('WC', '(WC)') if 'WC' in s and '(WC)' not in s else s
    return s.replace('TAILOT', 'TAIL OT')

def main(dwg_json, wua_json, out_dir):
    E = [e for e in load(dwg_json)]
    S = [e for e in E if in_sheet(e)]
    wua = json.load(open(wua_json))
    lines = [LineString(pts(e)) for e in S if e['layer'] in ('POLY_PARCEL', 'POLY PARCEL', 'V_BOUND_LINE', 'LINE_WATER')
             and len(pts(e)) > 1]
    hull = unary_union(lines).convex_hull
    faces, nfix = polygons_from_lines(lines + [hull.exterior], 1.0)
    hull_edge = hull.exterior.buffer(0.5)
    labels = [(e['text'].strip(), text_center(e)) for e in S if e['layer'] == 'TEXT_PARCEL' and e['type'] == 'TEXT'
              and e['text'].strip()]

    def extend(ls, d=80):
        c = list(ls.coords)
        def ext(a, b):
            dx, dy = a[0] - b[0], a[1] - b[1]; n = math.hypot(dx, dy) or 1
            return (a[0] + dx / n * d, a[1] + dy / n * d)
        return LineString([ext(c[0], c[1])] + c + [ext(c[-1], c[-2])])
    vb = [extend(LineString(pts(e))) for e in S if e['layer'] == 'V_BOUND_LINE' and len(pts(e)) > 1]
    frame = box(*unary_union(lines).bounds).buffer(5)
    vfaces = list(polygonize(unary_union(vb + [frame.exterior])))
    wua_sets = collections.defaultdict(set)
    for g in wua['gats']:
        wua_sets[g['village']].add(g['gat_no'])

    parcels = []
    for f in faces:
        inside = [(t, p) for t, p in labels if f.contains(p)]
        texts = sorted(set(t for t, _ in inside), key=lambda t: (len(t), t))
        if not texts:
            continue
        if len(texts) == 1:
            parcels.append({'gat_no': texts[0], 'geom': f, 'approx': f.intersects(hull_edge)}); continue
        seeds = {}
        for t, p in inside:
            seeds.setdefault(t, []).append(p)
        cent = {t: Point(sum(p.x for p in ps) / len(ps), sum(p.y for p in ps) / len(ps)) for t, ps in seeds.items()}
        vor = voronoi_diagram(unary_union(list(cent.values())), envelope=f.envelope.buffer(10))
        for cell in vor.geoms:
            t = next(t for t, c in cent.items() if cell.contains(c))
            piece = cell.intersection(f)
            if not piece.is_empty:
                parcels.append({'gat_no': t, 'geom': piece, 'approx': True})

    for vf in sorted(vfaces, key=lambda f: f.area):         
        members = [p for p in parcels if 'village' not in p and vf.contains(p['geom'].representative_point())]
        if not members: continue
        nums = {p['gat_no'] for p in members}
        share = {v: len(nums & s) / len(s) for v, s in wua_sets.items()}
        best = max(share, key=share.get)
        name = best if share[best] >= 0.3 else 'Outside command'
        print(f'   village face: {len(members)} parcels -> {name}', {v: round(x, 2) for v, x in share.items()})
        for p in members:
            p['village'] = name
    merged = {}
    for p in parcels:
        k = (p.get('village', 'Outside command'), p['gat_no'])
        if k in merged:
            merged[k]['geom'] = unary_union([merged[k]['geom'], p['geom']]); merged[k]['approx'] |= p['approx']
        else:
            merged[k] = dict(p, village=k[0])
    parcels = list(merged.values())

    rec = {}
    for g in wua['gats']:
        k = (g['village'], g['gat_no'])
        rec[k] = max(rec.get(k, 0), g.get('total_ha') or 0)   
    ratios = [math.sqrt(rec[(p['village'], p['gat_no'])] * 10000 / p['geom'].area)
              for p in parcels if not p['approx'] and rec.get((p['village'], p['gat_no']), 0) > 0.1]
    scale = statistics.median(ratios)
    print(f'parcels {len(parcels)} (connectors added {nfix}); scale estimate {scale:.3f} m per drawing unit '
          f'from {len(ratios)} Gats (IQR {statistics.quantiles(ratios, n=4)[0]:.2f}-{statistics.quantiles(ratios, n=4)[2]:.2f})')
    if GEOREF.get('metres_per_unit'):
        scale = GEOREF['metres_per_unit']

    ax, ay = GEOREF['anchor_drawing_xy']
    lat0, lon0 = GEOREF['anchor_latlon']
    rot = math.radians(GEOREF.get('rotation_deg', 0))
    mlat = 111320.0; mlon = 111320.0 * math.cos(math.radians(lat0))
    def to_ll(x, y):
        dx, dy = (x - ax) * scale, (y - ay) * scale
        rx, ry = dx * math.cos(rot) - dy * math.sin(rot), dx * math.sin(rot) + dy * math.cos(rot)
        return (round(lon0 + rx / mlon, 7), round(lat0 + ry / mlat, 7))
    def geo(g):
        return mapping(transform(lambda x, y, z=None: tuple(zip(*[to_ll(a, b) for a, b in zip(x, y)])), g))

    def fc(features):
        return {'type': 'FeatureCollection', 'features': features}
    def write(name, feats):
        json.dump(fc(feats), open(os.path.join(out_dir, name), 'w'), ensure_ascii=False)
        print(f'  {name}: {len(feats)}')

    write('parcels.geojson', [{'type': 'Feature', 'geometry': geo(p['geom']), 'properties': {
        'id': f"{'DB' if p['village']=='Digras Bk' else 'TW' if p['village']=='Takarkhed Wayal' else 'OC'}-{p['gat_no']}",
        'village': p['village'], 'gat_no': p['gat_no'], 'map_area_ha': round(p['geom'].area * scale * scale / 10000, 3),
        'shape_approx': p['approx']}} for p in parcels])

    canals = []
    lbc = [e for e in S if e['layer'] == 'CANAL' and e['type'] == 'LWPOLYLINE']
    for e in lbc:
        canals.append({'type': 'Feature', 'geometry': geo(LineString(pts(e))), 'properties': {
            'id': 'LBC', 'name': 'Left Bank Canal', 'level': 'main', 'parent': None,
            'note': 'Section within this WUA (RD ~8.2 km to 10 km)'}})
    minor_names = [('AMONA TAIL MINOR', 'Amona Tail Minor', 10005), ('MINOR-5', 'Minor 5', 9905), ('MINOR-6', 'Minor 6', 10005)]
    mlines = [e for e in S if e['layer'] == 'MINOR' and e['type'] == 'LWPOLYLINE' and LineString(pts(e)).length > 20]
    mlines.sort(key=lambda e: -LineString(pts(e)).length) 
    minor_geo = {}
    for e, (mid, name, rd) in zip(mlines, minor_names):
        ls = LineString(pts(e)); minor_geo[mid] = ls
        canals.append({'type': 'Feature', 'geometry': geo(ls), 'properties': {
            'id': mid, 'name': name, 'level': 'minor', 'parent': 'LBC', 'offtake_rd_m': rd}})
    write('canals.geojson', canals)

    otexts = [e for e in S if e['layer'] == 'EXISTING OUTLET' and e['type'] == 'TEXT']
    chak_by_key = {}
    for c in wua['chaks']:
        if 'outlet' in c:
            chak_by_key[(c.get('minor') or 'LBC', norm_outlet(c['outlet']), int(c['chainage_m']))] = c
    tp = lambda t: Point(t['startPoint']['x'], t['startPoint']['y'])
    def match(a_items, b_items, pa, pb):
        pairs = sorted((pa(x).distance(pb(y)), i, j) for i, x in enumerate(a_items) for j, y in enumerate(b_items))
        used_a, used_b, out = set(), set(), {}
        for d, i, j in pairs:
            if i in used_a or j in used_b: continue
            used_a.add(i); used_b.add(j); out[i] = b_items[j]
        return out
    inserts = [e for e in S if e['type'] == 'INSERT' and e['name'] == 'OUTLET']
    names = [t for t in otexts if re.match(r'\s*(D?O[RL]|TAIL)', t['text'])]
    chs = [t for t in otexts if t['text'].strip().startswith('CH')]
    ins_name = match(inserts, names, lambda e: Point(e['insertionPoint']['x'], e['insertionPoint']['y']), tp)
    name_ch = {id(n): c for n, c in zip(names, [match(names, chs, tp, tp).get(i) for i in range(len(names))])}
    outlets = []
    for i, e in enumerate(inserts):
        p = Point(e['insertionPoint']['x'], e['insertionPoint']['y'])
        nt = ins_name.get(i)
        name = nt['text'] if nt else ''
        ct = name_ch.get(id(nt)) if nt else None
        ch = ct['text'] if ct else ''
        chm = int(float(re.sub(r'[^\d.]', '', ch).strip('.') or 0))
        on = min(list(minor_geo.items()) + [('LBC', LineString(pts(lbc[0])))], key=lambda kv: kv[1].distance(p))[0]
        c = chak_by_key.get((on, norm_outlet(name), chm))
        if not c:  
            base = norm_outlet(name).replace('(WC)', '')
            c = next((v for (m, o, ch), v in chak_by_key.items() if m == on and o.replace('(WC)', '') == base
                      and (chm == 0 or ch == chm)), None)
            if c: chm = int(c['chainage_m'])
        outlets.append({'type': 'Feature', 'geometry': geo(p), 'properties': {
            'id': f"{on}/{norm_outlet(name)}@{chm}", 'name': norm_outlet(name), 'chainage_m': chm, 'canal_id': on,
            'chak_no': c['chak_no'] if c else None, 'is_tail': 'TAIL' in name.upper()}})
    write('outlets.geojson', outlets)
    print('  outlets linked to WUA chaks:', sum(1 for o in outlets if o['properties']['chak_no']), 'of', len(outlets))

    def lines_of(layer, **props):
        return [{'type': 'Feature', 'geometry': geo(LineString(pts(e))), 'properties': dict(props)}
                for e in S if e['layer'] == layer and len(pts(e)) > 1]
    write('chak_boundaries.geojson', lines_of('CHAK BONTRY', kind='chak'))
    write('village_boundaries.geojson', lines_of('V_BOUND_LINE', kind='village'))
    write('rivers.geojson', lines_of('LINE_WATER', kind='river/nalla'))
    wells = [{'type': 'Feature', 'geometry': geo(Point(e['insertionPoint']['x'], e['insertionPoint']['y'])),
              'properties': {'id': f'WELL-{i+1:02d}', 'type': 'Well', 'name': f'Well {i+1}', 'source': 'DWG layer NEW WELL'}}
             for i, e in enumerate(e for e in S if e['type'] == 'INSERT' and e['name'] == 'MOTWELL')]
    write('wells.geojson', wells)
    gao = []
    for e in E:
        if e['type'] == 'HATCH' and e['layer'] in ('Gavthan', 'GAOTHAN'):
            for bp in e.get('boundaryPaths', []):
                ring = [(v['x'], v['y']) for v in bp.get('vertices', [])] or \
                       [(ed['start']['x'], ed['start']['y']) for ed in bp.get('edges', []) if 'start' in ed]
                if len(ring) > 2:
                    pg = Polygon(ring).buffer(0)
                    if box(SHEET_X[0], 68000, SHEET_X[1], 68400).contains(pg.centroid) and not box(79290, 68000, 79500, 68090).contains(pg.centroid) and pg.area > 1:
                        gao.append(pg)
    gao = unary_union(gao)
    gao = list(gao.geoms) if hasattr(gao, 'geoms') else [gao]
    write('gaothan.geojson', [{'type': 'Feature', 'geometry': geo(g), 'properties': {'name': 'Gaothan (village settlement)'}} for g in gao if not g.is_empty])
    json.dump({'metres_per_unit': scale, 'anchor': GEOREF}, open(os.path.join(out_dir, 'georef_used.json'), 'w'), indent=1)

if __name__ == '__main__':
    main(*sys.argv[1:4])
