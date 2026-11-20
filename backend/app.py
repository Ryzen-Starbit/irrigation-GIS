import io, json, os, sqlite3
from collections import defaultdict
from typing import Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from backend.i18n import tr

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, 'backend', 'irrigation.db')
PROCESSED = os.path.join(ROOT, 'data', 'processed')
RECORDS = os.path.join(ROOT, 'data', 'raw', '712')

app = FastAPI(title='Irrigation Command Area GIS — Demo', version='0.1')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])

SEASONS = ['Kharif', 'Rabi', 'Hot weather']
DEV_DIGITS = str.maketrans('०१२३४५६७८९', '0123456789')
VILLAGE_NAMES = {'DB': ['Digras Bk', 'Digras Budruk', 'दिग्रस बुद्रुक', 'दिग्रस बु'], 'TW': ['Takarkhed Wayal', 'टाकरखेड वायाळ']}
CANAL_NAMES = {'LBC': ['Left Bank Canal', 'LBC', 'डावा तीर कालवा', 'कालवा'], 'AMONA TAIL MINOR': ['Amona Tail Minor', 'आमोणा', 'अमोना'],
               'MINOR-5': ['Minor 5', 'Minor-5', 'मायनर ५', 'लघु कालवा ५'], 'MINOR-6': ['Minor 6', 'Minor-6', 'मायनर ६', 'लघु कालवा ६']}

def db():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    return con

def rows(sql, *args):
    with db() as con:
        return [dict(r) for r in con.execute(sql, args).fetchall()]

def one(sql, *args):
    r = rows(sql, *args)
    return r[0] if r else None

def latest_season():
    r = one("SELECT year FROM crops ORDER BY year DESC LIMIT 1")
    return (r['year'] if r else '2024-25'), 'Kharif'

def fc(features):
    return {'type': 'FeatureCollection', 'features': features}

def log(entity, entity_id, action, detail):
    with db() as con:
        con.execute('INSERT INTO change_log (entity, entity_id, action, detail) VALUES (?,?,?,?)',
                    (entity, entity_id, action, json.dumps(detail, ensure_ascii=False)))

def gat_context():
    ctx = {}
    for r in rows("""SELECT gc.gat_id, gc.chak_no, gc.gca_ha, o.id outlet_id, o.name outlet, o.canal_id, o.reach,
                            o.chainage_m, c.name canal_name
                     FROM gat_chaks gc JOIN outlets o ON o.chak_no = gc.chak_no
                     LEFT JOIN canals c ON c.id = o.canal_id ORDER BY gc.gca_ha"""):
        ctx[r['gat_id']] = r      
    return ctx

def season_crops(year, season):
    out = {}
    for r in rows("""SELECT gat_id, crop, area_ha, irrigation, data_source FROM crops
                     WHERE year=? AND season=? ORDER BY area_ha""", year, season):
        out[r['gat_id']] = r
    return out

def gat_rows(year, season):
    ctx = gat_context(); crops = season_crops(year, season)
    owners = {r['gat_id']: r for r in rows("""SELECT gat_id, COUNT(*) n, MIN(id) fid FROM owners
                                               WHERE active=1 GROUP BY gat_id""")}
    first = {r['id']: r for r in rows('SELECT id, name, name_en FROM owners')}
    out = []
    for g in rows('SELECT g.*, v.name village FROM gats g JOIN villages v ON v.id=g.village_id'):
        c = ctx.get(g['id'], {}); cr = crops.get(g['id'], {}); ow = owners.get(g['id'], {})
        tot = g['total_ha'] or g['map_area_ha'] or 0
        out.append({**g, 'chak_no': c.get('chak_no'), 'outlet_id': c.get('outlet_id'), 'outlet': c.get('outlet'),
                    'canal_id': c.get('canal_id'), 'canal_name': c.get('canal_name'), 'reach': c.get('reach'),
                    'crop': cr.get('crop'), 'crop_area_ha': cr.get('area_ha'), 'irrigation': cr.get('irrigation'),
                    'crop_source': cr.get('data_source'),
                    'pot_kharab_pct': round(100 * (g['pot_kharab_ha'] or 0) / tot, 1) if tot else 0,
                    'owner_count': ow.get('n', 0),
                    'owner_first': first.get(ow.get('fid'), {}).get('name'),
                    'owner_first_en': first.get(ow.get('fid'), {}).get('name_en')})
    return out

def totals(gs):
    t = {'gats': len(gs), 'farmers': sum(g['owner_count'] for g in gs)}
    for k in ('total_ha', 'gca_ha', 'pot_kharab_ha', 'cca_ha', 'ica_ha'):
        t[k] = round(sum(g[k] or 0 for g in gs), 2)
    crop = defaultdict(float); irr = defaultdict(float)
    for g in gs:
        if g['crop']:
            crop[g['crop']] += g['crop_area_ha'] or 0
            irr[g['irrigation'] or 'Rainfed'] += g['crop_area_ha'] or 0
    t['crop_area_ha'] = {k: round(v, 2) for k, v in sorted(crop.items(), key=lambda kv: -kv[1])}
    t['irrigation_area_ha'] = {k: round(v, 2) for k, v in irr.items()}
    return t

def slim(g):
    keys = ('id', 'village', 'gat_no', 'total_ha', 'gca_ha', 'pot_kharab_ha', 'cca_ha', 'ica_ha', 'chak_no', 'outlet',
            'canal_id', 'reach', 'crop', 'irrigation', 'owner_count', 'owner_first', 'owner_first_en', 'in_command')
    return {k: g.get(k) for k in keys}

@app.get('/api/meta')
def meta():
    yrs = [r['year'] for r in rows('SELECT DISTINCT year FROM crops ORDER BY year')]
    y, s = latest_season()
    return {
        'project': 'Khadakpurna River Project — Left Bank Canal command',
        'wua': one('SELECT * FROM wuas'), 'villages': rows('SELECT * FROM villages'),
        'years': yrs, 'seasons': SEASONS, 'default': {'year': y, 'season': s},
        'crops': [r['crop'] for r in rows('SELECT crop, SUM(area_ha) a FROM crops GROUP BY crop ORDER BY a DESC')],
        'counts': {t: one(f'SELECT COUNT(*) n FROM {t}')['n'] for t in ('gats', 'owners', 'outlets', 'structures')},
        'in_command': one('SELECT COUNT(*) n FROM gats WHERE in_command=1')['n'],
        'georef': json.load(open(os.path.join(PROCESSED, 'georef_used.json'))),
        'data_notes': [
            'Gat boundaries, canals, outlets, chaks, wells: from the department DWG (approximate placement on the map).',
            'Owners and GCA / CCA / ICA / Pot Kharab: from the Shivkrupa WUA beneficiary list.',
            'Crop register and structure construction / maintenance details are SAMPLE data until the department supplies them.',
        ],
        'sample_flags': {'crops': one("SELECT COUNT(*) n FROM crops WHERE data_source='sample'")['n'],
                         'structures': one("SELECT COUNT(*) n FROM structures WHERE details_source='sample'")['n']},
    }

@app.get('/api/layers/parcels')
def layer_parcels(year: Optional[str] = None, season: Optional[str] = None):
    dy, ds = latest_season(); year = year or dy; season = season or ds
    feats = []
    for g in gat_rows(year, season):
        geom = json.loads(g.pop('geom'))
        props = {k: v for k, v in g.items() if k not in ('record_pdf',)}
        feats.append({'type': 'Feature', 'geometry': geom, 'properties': props})
    return fc(feats)

@app.get('/api/layers/{name}')
def layer(name: str):
    if name == 'canals':
        return fc([{'type': 'Feature', 'geometry': json.loads(r.pop('geom')), 'properties': r}
                   for r in rows('SELECT * FROM canals')])
    if name == 'outlets':
        out = []
        for r in rows("""SELECT o.*, (SELECT COUNT(*) FROM gat_chaks gc WHERE gc.chak_no=o.chak_no) gats,
                                (SELECT ROUND(SUM(cca_ha),2) FROM gat_chaks gc WHERE gc.chak_no=o.chak_no) cca_ha
                         FROM outlets o"""):
            out.append({'type': 'Feature', 'geometry': json.loads(r.pop('geom')), 'properties': r})
        return fc(out)
    if name == 'structures':
        return fc([{'type': 'Feature', 'geometry': json.loads(r.pop('geom')), 'properties': r}
                   for r in rows('SELECT * FROM structures')])
    files = {'chaks': 'chak_boundaries.geojson', 'villages': 'village_boundaries.geojson',
             'rivers': 'rivers.geojson', 'gaothan': 'gaothan.geojson'}
    if name in files:
        return FileResponse(os.path.join(PROCESSED, files[name]), media_type='application/geo+json')
    raise HTTPException(404, 'unknown layer')

@app.get('/api/gats/{gat_id}')
def gat_detail(gat_id: str, year: Optional[str] = None, season: Optional[str] = None):
    g = one('SELECT g.*, v.name village FROM gats g JOIN villages v ON v.id=g.village_id WHERE g.id=?', gat_id)
    if not g: raise HTTPException(404, 'Gat not found')
    g.pop('geom')
    tot = g['total_ha'] or 0
    g['cultivable_ha'] = round(tot - (g['pot_kharab_ha'] or 0), 3) if tot else None
    g['pot_kharab_pct'] = round(100 * (g['pot_kharab_ha'] or 0) / tot, 1) if tot else None
    g['owners'] = rows('SELECT id, name, name_en, area_ha, share_note FROM owners WHERE gat_id=? AND active=1 ORDER BY id', gat_id)
    g['past_owners'] = rows('SELECT name, name_en, area_ha, valid_to FROM owners WHERE gat_id=? AND active=0', gat_id)
    for o in g['owners']:
        o['share_pct'] = round(100 * o['area_ha'] / tot, 1) if o['area_ha'] and tot else None
    g['chaks'] = rows("""SELECT gc.*, o.id outlet_id, o.name outlet, o.chainage_m, o.reach, c.id canal_id, c.name canal,
                                c.parent_id canal_parent FROM gat_chaks gc JOIN outlets o ON o.chak_no=gc.chak_no
                         LEFT JOIN canals c ON c.id=o.canal_id WHERE gc.gat_id=?""", gat_id)
    g['crops'] = rows('SELECT * FROM crops WHERE gat_id=? ORDER BY year DESC, season', gat_id)
    dy, ds = latest_season(); year = year or dy; season = season or ds
    g['current'] = [c for c in g['crops'] if c['year'] == year and c['season'] == season]
    has_pdf = bool(g['record_pdf']) and os.path.isfile(os.path.join(RECORDS, g['record_pdf']))
    g['record_url'] = f"/records/{g['record_pdf']}" if has_pdf else None
    g['record_expected'] = f"data/raw/712/{g['record_pdf']}" if g['record_pdf'] and not has_pdf else None
    if not g['in_command']:
        o = one('SELECT o.name, o.chak_no, c.name canal FROM outlets o JOIN canals c ON c.id=o.canal_id WHERE chak_no=?', g['nearest_outlet_chak'])
        c = one('SELECT name FROM canals WHERE id=?', g['nearest_canal_id'])
        g['nearest'] = {'canal': c['name'] if c else None, 'canal_m': g['nearest_canal_m'],
                        'outlet': o, 'outlet_m': g['nearest_outlet_m']}
    g['tail_end'] = any(c['reach'] == 'Tail' for c in g['chaks'])
    return g

@app.get('/api/structures/{sid}')
def structure_detail(sid: str):
    s = one('SELECT s.*, c.name canal FROM structures s LEFT JOIN canals c ON c.id=s.canal_id WHERE s.id=?', sid)
    if not s: raise HTTPException(404)
    s['geom'] = json.loads(s['geom'])
    s['inspections'] = rows('SELECT * FROM inspections WHERE structure_id=? ORDER BY date DESC', sid)
    return s

@app.post('/api/structures/{sid}/inspections')
def add_inspection(sid: str, body: dict = Body(...)):
    if not one('SELECT id FROM structures WHERE id=?', sid): raise HTTPException(404)
    if body.get('condition_after') not in ('Good', 'Needs Repair', 'Damaged'):
        raise HTTPException(400, 'condition_after must be Good / Needs Repair / Damaged')
    with db() as con:
        con.execute("""INSERT INTO inspections (structure_id,date,finding,repair_done,condition_after,inspected_by)
                       VALUES (?,?,?,?,?,?)""", (sid, body['date'], body.get('finding'), body.get('repair_done'),
                                                 body['condition_after'], body.get('inspected_by')))
        con.execute('UPDATE structures SET condition=? WHERE id=?', (body['condition_after'], sid))
    log('structure', sid, 'inspection', body)
    return structure_detail(sid)

def outlet_summary_data(chak_no: int, year, season):
    o = one('SELECT o.*, c.name canal FROM outlets o LEFT JOIN canals c ON c.id=o.canal_id WHERE chak_no=?', chak_no)
    if not o: raise HTTPException(404)
    o.pop('geom')
    ids = {r['gat_id'] for r in rows('SELECT gat_id FROM gat_chaks WHERE chak_no=?', chak_no)}
    gs = [g for g in gat_rows(year, season) if g['id'] in ids]
    part = {r['gat_id']: r for r in rows('SELECT * FROM gat_chaks WHERE chak_no=?', chak_no)}
    for g in gs:
        p = part[g['id']]
        g.update(total_ha=p['total_ha'], gca_ha=p['gca_ha'], cca_ha=p['cca_ha'], ica_ha=p['ica_ha'], pot_kharab_ha=p['pot_kharab_ha'])
        g['split'] = len(rows('SELECT 1 FROM gat_chaks WHERE gat_id=?', g['id'])) > 1
    return o, gs

@app.get('/api/outlets/{chak_no}/summary')
def outlet_summary(chak_no: int, year: Optional[str] = None, season: Optional[str] = None):
    dy, ds = latest_season(); year = year or dy; season = season or ds
    o, gs = outlet_summary_data(chak_no, year, season)
    return {'outlet': o, 'totals': totals(gs), 'gats': [slim(g) for g in sorted(gs, key=lambda g: int(g['gat_no']) if g['gat_no'].isdigit() else 0)]}

def tree(year, season):
    canals = rows('SELECT id, name, level, parent_id, offtake_rd_m, length_m FROM canals')
    outs = rows('SELECT id, name, canal_id, chainage_m, chak_no, reach, is_tail FROM outlets ORDER BY chainage_m')
    gs = gat_rows(year, season)
    part = defaultdict(list)
    for r in rows('SELECT * FROM gat_chaks'): part[r['chak_no']].append(r)
    gby = {g['id']: g for g in gs}

    def outlet_node(o):
        members = []
        for p in part[o['chak_no']]:
            g = dict(gby[p['gat_id']]); g.update(total_ha=p['total_ha'], gca_ha=p['gca_ha'], cca_ha=p['cca_ha'],
                                               ica_ha=p['ica_ha'], pot_kharab_ha=p['pot_kharab_ha'])
            members.append(g)
        return {**o, 'type': 'outlet', 'totals': totals(members), 'gats': [slim(g) for g in members]}

    def canal_node(c):
        kids = [canal_node(k) for k in canals if k['parent_id'] == c['id']]
        on = [outlet_node(o) for o in outs if o['canal_id'] == c['id']]
        members = []
        for o in on: members += o['gats']
        for k in kids: members += k['_members']
        merged = {}
        for m in members:
            if m['id'] in merged:
                for k in ('total_ha', 'gca_ha', 'cca_ha', 'ica_ha', 'pot_kharab_ha'):
                    merged[m['id']][k] = round((merged[m['id']][k] or 0) + (m[k] or 0), 3)
            else:
                merged[m['id']] = dict(gby[m['id']], **{k: m[k] for k in ('total_ha', 'gca_ha', 'cca_ha', 'ica_ha', 'pot_kharab_ha')})
        full = list(merged.values())
        return {**c, 'type': 'canal', 'children': kids, 'outlets': on, 'totals': totals(full), '_members': members}

    roots = [canal_node(c) for c in canals if c['parent_id'] is None]

    def strip(n):
        n.pop('_members', None)
        for k in n.get('children', []): strip(k)
        return n
    return [strip(r) for r in roots]

@app.get('/api/tree')
def api_tree(year: Optional[str] = None, season: Optional[str] = None):
    dy, ds = latest_season()
    return tree(year or dy, season or ds)

@app.get('/api/canals/{cid}/summary')
def canal_summary(cid: str, year: Optional[str] = None, season: Optional[str] = None):
    def find(nodes):
        for n in nodes:
            if n['id'] == cid: return n
            f = find(n['children'])
            if f: return f
    dy, ds = latest_season()
    n = find(tree(year or dy, season or ds))
    if not n: raise HTTPException(404)
    return n

@app.get('/api/search')
def search(q: str):
    q = q.strip().translate(DEV_DIGITS)
    if not q: return []
    out = []
    num = q.lower().replace('gat', '').replace('no.', '').replace('गट', '').strip()   
    if num.isdigit():
        for g in rows("""SELECT g.id, g.gat_no, g.village_id FROM gats g WHERE g.gat_no=? OR g.gat_no LIKE ?
                         ORDER BY LENGTH(g.gat_no), g.gat_no""", num, num + '%')[:12]:
            out.append({'kind': 'gat', 'type': 'gat', 'id': g['id'], 'gat_no': g['gat_no'], 'village_id': g['village_id']})
    for o in rows("""SELECT o.gat_id, o.name, o.name_en, g.gat_no, g.village_id FROM owners o JOIN gats g ON g.id=o.gat_id
                     WHERE o.active=1 AND (o.name LIKE ? OR o.name_en LIKE ?) LIMIT 15""", f'%{q}%', f'%{q}%'):
        out.append({'kind': 'gat', 'type': 'owner', 'id': o['gat_id'], 'name': o['name'], 'name_en': o['name_en'],
                    'gat_no': o['gat_no'], 'village_id': o['village_id']})
    for vid, names in VILLAGE_NAMES.items():
        if any(q.lower() in n.translate(DEV_DIGITS).lower() for n in names):
            out.append({'kind': 'village', 'type': 'village', 'id': vid})
    for o in rows("""SELECT chak_no, name, canal_id FROM outlets WHERE name LIKE ? OR 'chak ' || chak_no LIKE ? OR 'चक ' || chak_no LIKE ?""",
                  f'%{q}%', f'%{q.lower()}%', f'%{q}%')[:10]:
        out.append({'kind': 'outlet', 'type': 'outlet', 'id': o['chak_no'], 'name': o['name'], 'canal_id': o['canal_id']})
    for cid, names in CANAL_NAMES.items():
        if any(q.lower() in n.translate(DEV_DIGITS).lower() for n in names):
            out.append({'kind': 'canal', 'type': 'canal', 'id': cid})
    for st in rows('SELECT id, name, type FROM structures WHERE name LIKE ? OR type LIKE ? OR id LIKE ? LIMIT 10', f'%{q}%', f'%{q}%', f'%{q}%'):
        out.append({'kind': 'structure', 'type': 'structure', 'id': st['id'], 'name': st['name'], 'stype': st['type']})
    return out[:30]

def apply_filter(gs, crop=None, canal=None, village=None, irrigation=None, reach=None, chak=None, in_command=None):
    def canal_ids(cid):
        ids = {cid}
        for c in rows('SELECT id FROM canals WHERE parent_id=?', cid): ids |= canal_ids(c['id'])
        return ids
    cids = canal_ids(canal) if canal else None
    out = []
    for g in gs:
        if crop and g['crop'] != crop: continue
        if cids is not None and g['canal_id'] not in cids: continue
        if village and g['village_id'] != village and g['village'] != village: continue
        if irrigation and (g['irrigation'] or 'Rainfed') != irrigation: continue
        if reach and g['reach'] != reach: continue
        if chak and str(g['chak_no']) != str(chak): continue
        if in_command is not None and bool(g['in_command']) != in_command: continue
        out.append(g)
    return out

@app.get('/api/filter')
def api_filter(year: Optional[str] = None, season: Optional[str] = None, crop: Optional[str] = None,
               canal: Optional[str] = None, village: Optional[str] = None, irrigation: Optional[str] = None,
               reach: Optional[str] = None):
    dy, ds = latest_season(); year = year or dy; season = season or ds
    gs = apply_filter(gat_rows(year, season), crop, canal, village, irrigation, reach)
    return {'ids': [g['id'] for g in gs], 'totals': totals(gs)}

@app.get('/api/tail-analysis')
def tail_analysis(year: Optional[str] = None, season: Optional[str] = None):
    dy, ds = latest_season(); year = year or dy; season = season or ds
    gs = [g for g in gat_rows(year, season) if g['in_command']]
    out = []
    for c in rows('SELECT id, name FROM canals ORDER BY level, name'):
        mine = [g for g in gs if g['canal_id'] == c['id']]
        if not mine: continue
        rr = {}
        for reach in ('Head', 'Middle', 'Tail'):
            sub = [g for g in mine if g['reach'] == reach]
            t = totals(sub)
            cropped = sum(t['crop_area_ha'].values())
            canal_irr = t['irrigation_area_ha'].get('Canal', 0)
            rr[reach] = {'gats': t['gats'], 'cca_ha': t['cca_ha'], 'cropped_ha': round(cropped, 2),
                         'canal_irrigated_ha': canal_irr,
                         'canal_irrigated_pct_of_cca': round(100 * canal_irr / t['cca_ha'], 1) if t['cca_ha'] else 0,
                         'top_crops': list(t['crop_area_ha'].items())[:3]}
        out.append({'canal_id': c['id'], 'canal': c['name'], 'reaches': rr,
                    'tail_gats': [g['id'] for g in mine if g['reach'] == 'Tail']})
    return {'year': year, 'season': season, 'canals': out}

@app.get('/api/crop-history')
def crop_history(gat_id: Optional[str] = None, canal: Optional[str] = None, village: Optional[str] = None):
    years = [r['year'] for r in rows('SELECT DISTINCT year FROM crops ORDER BY year')]
    out = []
    for y in years:
        for s in SEASONS:
            gs = gat_rows(y, s)
            gs = [g for g in gs if (not gat_id or g['id'] == gat_id)]
            gs = apply_filter(gs, canal=canal, village=village)
            t = totals(gs)
            out.append({'year': y, 'season': s, 'crop_area_ha': t['crop_area_ha'], 'irrigation_area_ha': t['irrigation_area_ha']})
    return out

@app.post('/api/admin/crops')
def admin_crop(body: dict = Body(...)):
    need = ('gat_id', 'year', 'season', 'crop', 'area_ha', 'irrigation')
    if any(body.get(k) in (None, '') for k in need): raise HTTPException(400, f'required: {need}')
    if not one('SELECT id FROM gats WHERE id=?', body['gat_id']): raise HTTPException(404, 'unknown Gat')
    with db() as con:
        if body.get('replace_season', True):
            con.execute('DELETE FROM crops WHERE gat_id=? AND year=? AND season=?', (body['gat_id'], body['year'], body['season']))
        con.execute('INSERT INTO crops (gat_id,year,season,crop,area_ha,irrigation,data_source) VALUES (?,?,?,?,?,?,?)',
                    (body['gat_id'], body['year'], body['season'], body['crop'], float(body['area_ha']), body['irrigation'], 'entered'))
    log('crop', body['gat_id'], 'set', body)
    return {'ok': True}

@app.post('/api/admin/ownership')
def admin_ownership(body: dict = Body(...)):
    gid = body.get('gat_id')
    if not one('SELECT id FROM gats WHERE id=?', gid): raise HTTPException(404, 'unknown Gat')
    date = body.get('date')
    with db() as con:
        for oid in body.get('remove_owner_ids', []):
            con.execute('UPDATE owners SET active=0, valid_to=? WHERE id=? AND gat_id=?', (date, oid, gid))
        for o in body.get('add_owners', []):
            con.execute('INSERT INTO owners (gat_id,name,area_ha,valid_from) VALUES (?,?,?,?)',
                        (gid, o['name'], o.get('area_ha'), date))
    log('ownership', gid, 'change', body)
    return gat_detail(gid)

@app.post('/api/admin/structures')
def admin_structure(body: dict = Body(...)):
    for k in ('type', 'name', 'lat', 'lon'):
        if body.get(k) in (None, ''): raise HTTPException(400, f'{k} required')
    n = one('SELECT COUNT(*) n FROM structures')['n'] + 1
    sid = body.get('id') or f'NEW-{n:03d}'
    with db() as con:
        con.execute("""INSERT INTO structures (id,type,name,canal_id,chainage_m,year_built,built_by,owner_office,cost_lakh,
                       condition,photo,location_source,details_source,geom) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (sid, body['type'], body['name'], body.get('canal_id') or None, body.get('chainage_m') or None,
                     body.get('year_built') or None, body.get('built_by'), body.get('owner_office'), body.get('cost_lakh') or None,
                     body.get('condition') or 'Good', None, 'Entered in admin panel', 'entered',
                     json.dumps({'type': 'Point', 'coordinates': [float(body['lon']), float(body['lat'])]})))
    log('structure', sid, 'create', body)
    return structure_detail(sid)

CROP_COLS = ['village', 'gat_no', 'year', 'season', 'crop', 'area_ha', 'irrigation']

@app.get('/api/admin/template.xlsx')
def crop_template():
    from openpyxl import Workbook
    wb = Workbook(); ws = wb.active; ws.title = 'crops'
    ws.append(CROP_COLS)
    ws.append(['Digras Bk', '100', '2025-26', 'Kharif', 'Soybean', 0.6, 'Rainfed'])
    ws.append(['Digras Bk', '100', '2025-26', 'Rabi', 'Gram (Harbhara)', 0.5, 'Canal'])
    info = wb.create_sheet('how to fill')
    for line in ['One row per Gat / year / season / crop.', 'season: Kharif, Rabi or Hot weather',
                 'irrigation: Canal, Well or Rainfed', 'Uploading replaces that Gat\'s rows for the same year + season.',
                 'village: Digras Bk or Takarkhed Wayal']:
        info.append([line])
    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    return StreamingResponse(buf, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                             headers={'Content-Disposition': 'attachment; filename=crop_upload_template.xlsx'})

@app.post('/api/admin/upload')
async def upload_crops(file: UploadFile = File(...)):
    from openpyxl import load_workbook
    wb = load_workbook(io.BytesIO(await file.read()), read_only=True)
    ws = wb['crops'] if 'crops' in wb.sheetnames else wb.active
    it = ws.iter_rows(values_only=True)
    head = [str(h).strip().lower() if h else '' for h in next(it)]
    missing = [c for c in CROP_COLS if c not in head]
    if missing: raise HTTPException(400, f'missing columns: {missing}')
    vmap = {v['name'].lower(): v['id'] for v in rows('SELECT * FROM villages')}
    ok, errors, cleared = 0, [], set()
    with db() as con:
        for i, r in enumerate(it, start=2):
            if not any(r): continue
            d = dict(zip(head, r))
            vid = vmap.get(str(d['village']).strip().lower())
            gid = f"{vid}-{str(d['gat_no']).strip().split('.')[0]}" if vid else None
            if not gid or not con.execute('SELECT 1 FROM gats WHERE id=?', (gid,)).fetchone():
                errors.append(f'row {i}: unknown village/Gat'); continue
            if d['season'] not in SEASONS or d['irrigation'] not in ('Canal', 'Well', 'Rainfed'):
                errors.append(f'row {i}: bad season or irrigation'); continue
            key = (gid, str(d['year']), d['season'])
            if key not in cleared:
                con.execute('DELETE FROM crops WHERE gat_id=? AND year=? AND season=?', key); cleared.add(key)
            con.execute('INSERT INTO crops (gat_id,year,season,crop,area_ha,irrigation,data_source) VALUES (?,?,?,?,?,?,?)',
                        (gid, str(d['year']), d['season'], d['crop'], float(d['area_ha'] or 0), d['irrigation'], 'upload'))
            ok += 1
    log('crop', file.filename, 'bulk upload', {'rows': ok, 'errors': len(errors)})
    return {'imported': ok, 'errors': errors[:50]}

@app.get('/api/admin/log')
def change_log():
    return rows('SELECT * FROM change_log ORDER BY id DESC LIMIT 100')

def report_data(scope, id, year, season, **flt):
    dy, ds = latest_season(); year = year or dy; season = season or ds
    gs = gat_rows(year, season)
    if scope == 'gat':
        d = gat_detail(id, year, season)
        sel = [g for g in gs if g['id'] == id]
        title = f"Gat {d['gat_no']}, {d['village']}"
        subject = {'gat_no': d['gat_no'], 'village': d['village']}
    elif scope == 'outlet':
        o, sel = outlet_summary_data(int(id), year, season)
        title = f"Outlet {o['name']} (Chak {o['chak_no']}) on {o['canal']}"
        subject = {'outlet': o['name'], 'chak_no': o['chak_no'], 'canal': o['canal']}
    elif scope == 'canal':
        n = canal_summary(id, year, season)
        members = []
        def walk(x):
            for o in x['outlets']: members.extend(m['id'] for m in o['gats'])
            for k in x['children']: walk(k)
        walk(n)
        ids = set(members); sel = [g for g in gs if g['id'] in ids]
        title = f"{n['name']} — full command"
        subject = {'canal': n['name']}
    elif scope == 'village':
        sel = [g for g in gs if g['village_id'] == id]
        title = f"Village {sel[0]['village'] if sel else id}"
        subject = {'village': sel[0]['village'] if sel else id}
    else:
        sel = apply_filter(gs, **flt)
        title = 'Filtered selection: ' + ', '.join(f'{k}={v}' for k, v in flt.items() if v)
        subject = {'filter': flt}
    return {'title': title, 'scope': scope, 'subject': subject, 'year': year, 'season': season, 'totals': totals(sel),
            'gats': [slim(g) for g in sorted(sel, key=lambda g: (g['village'], int(g['gat_no']) if g['gat_no'].isdigit() else 0))]}

@app.get('/api/report')
def report_json(scope: str, id: Optional[str] = None, year: Optional[str] = None, season: Optional[str] = None,
                crop: Optional[str] = None, canal: Optional[str] = None, village: Optional[str] = None,
                irrigation: Optional[str] = None, reach: Optional[str] = None):
    flt = {k: v for k, v in dict(crop=crop, canal=canal, village=village, irrigation=irrigation, reach=reach).items() if v}
    return report_data(scope, id, year, season, **flt)

@app.get('/api/report.xlsx')
def report_xlsx(scope: str, id: Optional[str] = None, year: Optional[str] = None, season: Optional[str] = None,
                crop: Optional[str] = None, canal: Optional[str] = None, village: Optional[str] = None,
                irrigation: Optional[str] = None, reach: Optional[str] = None, lang: str = 'en', title: Optional[str] = None):
    """Excel report in English or Marathi (lang=mr): headings, crops, seasons and owner names follow the language."""
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment
    T = lambda w: tr(w, lang)
    flt = {k: v for k, v in dict(crop=crop, canal=canal, village=village, irrigation=irrigation, reach=reach).items() if v}
    d = report_data(scope, id, year, season, **flt)
    wb = Workbook(); ws = wb.active; ws.title = T('Summary')
    bold = Font(bold=True); head_fill = PatternFill('solid', fgColor='D8EEF0')
    ws.append([title or d['title']]); ws['A1'].font = Font(bold=True, size=14)
    ws.append([f"{T('Season')}: {T(d['season'])} {d['year']}"]); ws.append([])
    t = d['totals']
    for k, label in [('gats', 'Gat Nos.'), ('farmers', 'Farmers'), ('total_ha', 'Total area (ha)'), ('gca_ha', 'GCA (ha)'),
                     ('pot_kharab_ha', 'Pot Kharab (ha)'), ('cca_ha', 'CCA (ha)'), ('ica_ha', 'ICA (ha)')]:
        ws.append([T(label), t[k]]); ws.cell(ws.max_row, 1).font = bold
    ws.append([]); ws.append([T('Crop'), T('Area (ha)')]); ws.cell(ws.max_row, 1).font = bold; ws.cell(ws.max_row, 2).font = bold
    for c, a in t['crop_area_ha'].items(): ws.append([T(c), a])
    ws.column_dimensions['A'].width = 28; ws.column_dimensions['B'].width = 14
    g = wb.create_sheet(T('Gats'))
    cols = ['village', 'gat_no', 'total_ha', 'gca_ha', 'pot_kharab_ha', 'cca_ha', 'ica_ha', 'chak_no', 'outlet', 'canal_id',
            'reach', 'crop', 'irrigation', 'owner_count', 'owner_first']
    g.append([T(c) for c in cols])
    for c in g[1]: c.font = bold; c.fill = head_fill; c.alignment = Alignment(horizontal='center')
    for r in d['gats']:
        r = dict(r, owner_first=r['owner_first_en'] if lang == 'en' else r['owner_first'])
        g.append([T(r.get(c)) if c in ('village', 'canal_id', 'reach', 'crop', 'irrigation') else r.get(c) for c in cols])
    for i, w in enumerate([16, 8, 10, 10, 12, 10, 10, 8, 10, 18, 10, 16, 10, 8, 30], start=1):
        g.column_dimensions[g.cell(1, i).column_letter].width = w
    g.freeze_panes = 'A2'
    o = wb.create_sheet(T('Owners')); o.append([T('village'), T('gat_no'), T('owner'), T('area_ha')])
    for c in o[1]: c.font = bold; c.fill = head_fill
    ids = [r['id'] for r in d['gats']]
    if ids:
        q = ','.join('?' * len(ids))
        for r in rows(f"""SELECT v.name village, g.gat_no, o.name, o.name_en, o.area_ha FROM owners o JOIN gats g ON g.id=o.gat_id
                          JOIN villages v ON v.id=g.village_id WHERE o.active=1 AND o.gat_id IN ({q})""", *ids):
            o.append([T(r['village']), r['gat_no'], r['name_en'] if lang == 'en' else r['name'], r['area_ha']])
    o.column_dimensions['A'].width = 18; o.column_dimensions['C'].width = 34
    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    fname = f"report_{scope}_{(id or 'selection')}_{lang}.xlsx".replace(' ', '_').replace('/', '-')
    return StreamingResponse(buf, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                             headers={'Content-Disposition': f'attachment; filename={fname}'})

app.mount('/records', StaticFiles(directory=RECORDS), name='records')

@app.get('/')
def root():
    return {'service': 'Command Area GIS API', 'docs': '/docs', 'frontend': 'http://localhost:5173'}
