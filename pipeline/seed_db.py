import json, os, random, sqlite3, math
from shapely.geometry import shape, Point, LineString
from shapely.ops import unary_union
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from translit import to_english

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, 'data', 'processed')
DB = os.path.join(ROOT, 'backend', 'irrigation.db')
rnd = random.Random(42)

def fc(name):
    return json.load(open(os.path.join(P, name)))['features']

def lonlat_m(a, b):
    lat = math.radians((a[1] + b[1]) / 2)
    return math.hypot((a[0] - b[0]) * 111320 * math.cos(lat), (a[1] - b[1]) * 111320)

def line_len_m(g):
    c = list(g.coords)
    return sum(lonlat_m(c[i], c[i + 1]) for i in range(len(c) - 1))

def main():
    if os.path.exists(DB): os.remove(DB)
    con = sqlite3.connect(DB)
    con.executescript(open(os.path.join(ROOT, 'backend', 'schema.sql')).read())
    wua = json.load(open(os.path.join(P, 'wua_gats.json')))
    con.executemany('INSERT INTO villages VALUES (?,?,?,?,?)', [
        ('DB', 'Digras Bk', '529349', 'Deulgaon Raja', 'Buldhana'),
        ('TW', 'Takarkhed Wayal', None, 'Deulgaon Raja', 'Buldhana')])
    con.execute("INSERT INTO wuas VALUES ('WUA-3','Shivkrupa Water Users Association','शिवकृपा पाणी वापर संस्था')")
    vid = {'Digras Bk': 'DB', 'Takarkhed Wayal': 'TW'}

    canal_geom = {}
    for f in fc('canals.geojson'):
        p = f['properties']; g = shape(f['geometry']); canal_geom[p['id']] = g
        con.execute('INSERT INTO canals VALUES (?,?,?,?,?,?,?)', (p['id'], p['name'], p['level'], p['parent'],
                    p.get('offtake_rd_m'), round(line_len_m(g)), json.dumps(f['geometry'])))

    outs = [f for f in fc('outlets.geojson') if f['properties']['chak_no']]
    by_canal = {}
    for f in outs: by_canal.setdefault(f['properties']['canal_id'], []).append(f['properties']['chainage_m'])
    seen = set()
    for f in outs:
        p = f['properties']
        if p['chak_no'] in seen: continue      
        seen.add(p['chak_no'])
        lo, hi = min(by_canal[p['canal_id']]), max(by_canal[p['canal_id']])
        pos = (p['chainage_m'] - lo) / ((hi - lo) or 1)
        reach = 'Tail' if p['is_tail'] or pos > 2 / 3 else 'Middle' if pos > 1 / 3 else 'Head'
        con.execute('INSERT INTO outlets VALUES (?,?,?,?,?,?,?,?,?)', (f"OUT-{p['chak_no']}", p['name'], p['canal_id'],
                    p['chainage_m'], p['chak_no'], 'WUA-3', int(p['is_tail']), reach, json.dumps(f['geometry'])))

    rec = {}
    for g in wua['gats']:
        k = (g['village'], g['gat_no']); rec.setdefault(k, []).append(g)
    pdf_dir = {'Digras Bk': 'digras_bk', 'Takarkhed Wayal': 'takarkhed_wayal'}
    for f in fc('parcels.geojson'):
        p = f['properties']
        if p['village'] not in vid: continue
        rows = rec.get((p['village'], p['gat_no']), [])
        gid = f"{vid[p['village']]}-{p['gat_no']}"
        tot = max((r.get('total_ha') or 0 for r in rows), default=None)
        sums = {k: round(max(r.get(k) or 0 for r in rows), 3) if rows else None for k in ('gca_ha', 'waste_ha')}
        sums.update({k: round(sum(r.get(k) or 0 for r in rows), 3) if rows else None for k in ('cca_ha', 'ica_ha')})
        cca_sum = sum(r.get('cca_ha') or 0 for r in rows)
        pdf = f"{pdf_dir[p['village']]}/{p['gat_no']}.pdf"
        has_pdf = os.path.exists(os.path.join(ROOT, 'data', 'raw', '712', pdf))
        poly = shape(f['geometry']); c = poly.representative_point()
        near_c = min(canal_geom.items(), key=lambda kv: kv[1].distance(c))
        near_o = min(outs, key=lambda o: shape(o['geometry']).distance(c))
        dist = lambda g: round(lonlat_m((c.x, c.y), (lambda q: (q.x, q.y))(g.interpolate(g.project(c)) if g.geom_type == 'LineString' else g)))
        con.execute('INSERT INTO gats VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', (gid, vid[p['village']], p['gat_no'], int(bool(rows)),
                    tot, sums['gca_ha'], sums['waste_ha'], sums['cca_ha'], sums['ica_ha'], p['map_area_ha'],
                    int(p['shape_approx']), pdf, near_c[0], dist(near_c[1]),
                    near_o['properties']['chak_no'], dist(shape(near_o['geometry'])), json.dumps(f['geometry'])))
        for r in rows:
            f = (r.get('cca_ha') or 0) / cca_sum if cca_sum else 1 / len(rows)   
            sh = lambda v: round((v or 0) * f, 3)
            con.execute('INSERT OR REPLACE INTO gat_chaks VALUES (?,?,?,?,?,?,?)', (gid, r.get('chak_no'),
                        sh(r.get('total_ha')), sh(r.get('gca_ha')), sh(r.get('waste_ha')), r.get('cca_ha'), r.get('ica_ha')))
        names = set()
        for r in rows:
            for o in r['owners']:
                if o['name'] and o['name'] not in names:
                    names.add(o['name'])
                    con.execute('INSERT INTO owners (gat_id,name,name_en,area_ha,share_note,valid_from) VALUES (?,?,?,?,?,?)',
                                (gid, o['name'], to_english(o['name']), o.get('area_ha'), 'shared area (merged cell)' if o.get('shared_area') else None, None))

    years = ['2022-23', '2023-24', '2024-25']
    kharif = [('Soybean', .52), ('Cotton', .28), ('Tur', .10), ('Jowar', .04), ('Moong', .03), ('Udid', .03)]
    rabi = [('Gram (Harbhara)', .55), ('Wheat', .35), ('Jowar', .05), ('Onion', .05)]
    hot = [('Fodder', .5), ('Groundnut', .3), ('Vegetables', .2)]
    def pick(opts):
        x = rnd.random(); s = 0
        for c, w in opts:
            s += w
            if x <= s: return c
        return opts[0][0]
    gats = con.execute('SELECT id, total_ha, cca_ha, in_command FROM gats').fetchall()
    rows = []
    for gid, tot, cca, inc in gats:
        area = tot or 0.5
        for y in years:
            k = pick(kharif)
            if rnd.random() < 0.12:   
                k = rnd.choice(['Sugarcane', 'Orange'])
            rows.append((gid, y, 'Kharif', k, round(area, 3), 'Rainfed' if rnd.random() < .85 else 'Well', 'sample'))
            if inc and rnd.random() < 0.6:
                rows.append((gid, y, 'Rabi', pick(rabi), round(min(area, (cca or area)), 3),
                             'Canal' if rnd.random() < .75 else 'Well', 'sample'))
            elif not inc and rnd.random() < 0.2:
                rows.append((gid, y, 'Rabi', pick(rabi), round(area * .5, 3), 'Well', 'sample'))
            if inc and rnd.random() < 0.08:
                rows.append((gid, y, 'Hot weather', pick(hot), round(area * .3, 3), 'Canal', 'sample'))
    con.executemany('INSERT INTO crops (gat_id,year,season,crop,area_ha,irrigation,data_source) VALUES (?,?,?,?,?,?,?)', rows)

    st = []
    for cid in ('AMONA TAIL MINOR', 'MINOR-5', 'MINOR-6'):
        g = canal_geom[cid]; head = Point(g.coords[0])
        st.append((f'HR-{cid.replace(" ", "")}', 'Head regulator', f'Head regulator — {cid.title()}', 'LBC',
                   {'AMONA TAIL MINOR': 10005, 'MINOR-5': 9905, 'MINOR-6': 10005}[cid], head, 'DWG: start of minor (HR @ RD noted on drawing)'))
    rivers = unary_union([shape(f['geometry']) for f in fc('rivers.geojson')])
    n = 0
    for cid, g in canal_geom.items():
        x = g.intersection(rivers)
        pts = [x] if x.geom_type == 'Point' else list(getattr(x, 'geoms', []))
        kept = []
        for p in pts:
            if p.geom_type != 'Point' or any(lonlat_m((p.x, p.y), (q.x, q.y)) < 60 for q in kept): continue
            kept.append(p); n += 1
            d = g.project(p); ch_m = round(line_len_m(LineString([g.interpolate(t * d / 20) for t in range(21)])))
            st.append((f'CD-{n:02d}', 'CD work (culvert / siphon)', f'Cross-drainage on {cid.title()}', cid, ch_m, p,
                       'Derived: canal line crosses nalla line in DWG'))
    for f in fc('wells.geojson'):
        p = f['properties']
        st.append((p['id'], 'Well', p['name'], None, None, shape(f['geometry']), 'DWG layer NEW WELL'))
    for i, (cid, frac) in enumerate([('AMONA TAIL MINOR', 0.33), ('AMONA TAIL MINOR', 0.7), ('MINOR-5', 0.55)], start=1):
        g = canal_geom[cid]; pt = g.interpolate(frac, normalized=True)
        ch_m = round(line_len_m(LineString([g.interpolate(t * frac / 20, normalized=True) for t in range(21)])))
        st.append((f'BR-{i:02d}', 'Bridge', f'Cart-track bridge on {cid.title()}', cid, ch_m, pt, 'SAMPLE location (no road layer in DWG)'))
    gao = fc('gaothan.geojson')
    if gao:
        c = shape(gao[0]['geometry']).representative_point()
        st.append(('OFF-01', 'Office', 'Section office (sample location)', None, None, c, 'SAMPLE — placed in gaothan'))
        c2 = shape(gao[-1]['geometry']).representative_point()
        st.append(('BLD-01', 'Building', 'WUA meeting hall (sample location)', None, None, c2, 'SAMPLE — placed in gaothan'))
    conds = ['Good', 'Good', 'Good', 'Needs Repair', 'Damaged']
    agencies = ['Khadakpurna Project Division (departmental)', 'M/s Sample Constructions, Buldhana', 'M/s Demo Infra, Jalna']
    for sid, typ, name, canal, ch, pt, src in st:
        cond = rnd.choice(conds)
        con.execute('INSERT INTO structures VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', (sid, typ, name, canal, ch,
                    rnd.randint(2004, 2014) if typ != 'Well' else rnd.randint(1985, 2015),
                    rnd.choice(agencies) if typ != 'Well' else 'Private (farmer)',
                    'Khadakpurna Project Division, Deulgaon Raja' if typ != 'Well' else 'Owner of the Gat',
                    round(rnd.uniform(2, 40), 1) if typ != 'Well' else None, cond, None, src, 'sample',
                    json.dumps({'type': 'Point', 'coordinates': [round(pt.x, 7), round(pt.y, 7)]})))
        hist = sorted(rnd.sample(['2023-06-12', '2023-11-20', '2024-05-28', '2024-12-03', '2025-06-10', '2025-11-18', '2026-05-22'], rnd.randint(1, 3)))
        for i, d in enumerate(hist):
            last = i == len(hist) - 1
            c = cond if last else rnd.choice(['Good', 'Needs Repair'])
            finding = {'Good': 'Structure sound; minor silt cleared', 'Needs Repair': 'Gate spindle jammed / plaster cracks',
                       'Damaged': 'Wing wall partly collapsed, seepage observed'}[c]
            con.execute('INSERT INTO inspections (structure_id,date,finding,repair_done,condition_after,inspected_by,data_source) VALUES (?,?,?,?,?,?,?)',
                        (sid, d, finding, 'Silt removal and greasing' if c == 'Good' else None, c, 'Sectional Engineer (sample)', 'sample'))
    con.commit()
    for t in ('canals', 'outlets', 'gats', 'gat_chaks', 'owners', 'crops', 'structures', 'inspections'):
        print(f'  {t}: {con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]}')
    print('  gats in command:', con.execute('SELECT COUNT(*) FROM gats WHERE in_command=1').fetchone()[0],
          '| 7/12 PDFs present:', sum(os.path.exists(os.path.join(ROOT, 'data', 'raw', '712', r[0])) for r in con.execute('SELECT record_pdf FROM gats')))
    con.close()

if __name__ == '__main__':
    main()
