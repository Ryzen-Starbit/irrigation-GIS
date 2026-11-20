import sys, re, json, subprocess, tempfile, os
from concurrent.futures import ThreadPoolExecutor
import pymupdf

DEV = str.maketrans('०१२३४५६७८९', '0123456789')
COLS = [('sr', 30, 57), ('name', 57, 166), ('village', 166, 233), ('gat', 233, 281), ('total', 281, 337),
        ('gca', 337, 389), ('waste', 389, 435), ('cca', 435, 486), ('ica', 486, 536), ('remark', 536, 620)]

def col_of(x):
    for n, a, b in COLS:
        if a <= x < b: return n
    return None

def num(s):
    s = s.translate(DEV).replace(',', '')
    try: return float(s)
    except ValueError: return None

def ocr(img_path):
    r = subprocess.run(['tesseract', img_path, '-', '-l', 'mar', '--psm', '6'], capture_output=True, text=True)
    t = r.stdout.strip().split('\n')[0]
    t = t.split('|')[0]                      
    t = re.sub(r'[\[\]_(){}]', '', t).strip()
    for bad, good in (('परऱ्हाड', 'पऱ्हाड'), ('पऱहाड', 'पऱ्हाड'), ('परऱहाड', 'पऱ्हाड'), ('जञा', 'ज्ञा')):
        t = t.replace(bad, good)        
    return re.sub(r'\s+', ' ', t)

def parse_chak(s):
    s = s.replace('CHAK NO.', '').strip()
    m = re.match(r'(\d+)\s*/\s*([^@]+)@\s*([\d.]+)\s*m\s*/(.*)', s)
    if not m: return {'chak_no': s}
    no, outlet, ch, rest = m.groups()
    parts = [p.strip() for p in rest.split('/') if p.strip()]
    minor = None
    for p in parts:
        if p.upper().startswith('OF'):
            minor = re.sub(r'^OF\s*', '', p, flags=re.I).strip()
    outlet = outlet.strip().replace('(WC)', ' (WC)')
    return {'chak_no': int(no), 'outlet': outlet, 'chainage_m': float(ch),
            'minor': minor, 'canal': 'LBC', 'on_lbc_directly': minor is None,
            'is_tail': 'TAIL' in outlet.upper()}

def main(pdf, out):
    doc = pymupdf.open(pdf)
    rows = [] 
    for pi, page in enumerate(doc):
        words = [w for w in page.get_text('words') if 80 < w[1] < 765]
        words.sort(key=lambda w: ((w[1] + w[3]) / 2, w[0]))
        cur = None
        for w in words:
            yc = (w[1] + w[3]) / 2
            if cur is None or yc - cur['yc'] > 5:
                cur = {'page': pi, 'yc': yc, 'y0': w[1], 'y1': w[3], 'words': []}; rows.append(cur)
            cur['words'].append(w); cur['y0'] = min(cur['y0'], w[1]); cur['y1'] = max(cur['y1'], w[3])
    tmp = tempfile.mkdtemp()
    jobs = []
    gats, chaks = [], []
    chak = None; cur_gat = None; pending = []
    for r in rows:
        line = ' '.join(w[4] for w in r['words'])
        if 'CHAK' in line:
            chak = parse_chak(re.search(r'CHAK.*', line).group(0)); chaks.append(chak); continue
        if any(t in line for t in ('TOTAL', 'Remark', 'G.C.A.', 'लाभधारकाचे')) or line.strip() in ('Ha. Ha. Ha. Ha.', 'Ha.'):
            continue
        if 'WUA' in line or 'संस्थेचे' in line or 'एकुण' in line or 'एकसण' in line:
            continue
        cells = {}
        for w in r['words']:
            c = col_of((w[0] + w[2]) / 2)
            if c: cells.setdefault(c, []).append(w[4])
        if 'sr' in cells and 'gat' in cells:  
            gat_no = cells['gat'][0].translate(DEV)
            vil_raw = ' '.join(cells.get('village', []))
            village = 'Digras Bk' if 'ग्रव' in vil_raw or 'ददग' in vil_raw else 'Takarkhed Wayal'
            if cur_gat is None or cur_gat['gat_no'] != gat_no or cur_gat['village'] != village or cur_gat.get('_closed'):
                if cur_gat is None or cur_gat['gat_no'] != gat_no or cur_gat['village'] != village:
                    cur_gat = {'village': village, 'gat_no': gat_no, 'owners': [], **{k: v for k, v in (chak or {}).items()}}
                    gats.append(cur_gat)
            own_area = num(cells['total'][0]) if 'total' in cells else None
            owner = {'name': None, 'area_ha': own_area}
            cur_gat['owners'].append(owner)
            png = os.path.join(tmp, f'{len(jobs)}.png')
            yc = r['yc']
            doc[r['page']].get_pixmap(dpi=400, clip=pymupdf.Rect(58.5, yc - 11.5, 164, yc + 11.5)).save(png)
            jobs.append((owner, png))
        elif os.environ.get('DEBUG') and cur_gat is not None and cur_gat['gat_no'] in os.environ['DEBUG'].split(','):
            print('ROW', cur_gat['gat_no'], cells)
        if not ('sr' in cells or 'gat' in cells) and cur_gat is not None and 'total' in cells and 'cca' not in cells:
            for o in reversed(cur_gat['owners']):
                if o['area_ha'] is None:
                    o['area_ha'] = num(cells['total'][0]); o['shared_area'] = True; break
        if not ('sr' in cells and 'gat' in cells) and cur_gat is not None and all(k in cells for k in ('total', 'gca', 'cca', 'ica')):
            cur_gat.update(total_ha=num(cells['total'][0]), gca_ha=num(cells['gca'][0]),
                           waste_ha=num(cells['waste'][0]) if 'waste' in cells else 0.0,
                           cca_ha=num(cells['cca'][0]), ica_ha=num(cells['ica'][0]))
            cur_gat['_closed'] = True
    with ThreadPoolExecutor(max_workers=os.cpu_count() or 4) as ex:
        for (owner, png), name in zip(jobs, ex.map(ocr, [p for _, p in jobs])):
            owner['name'] = name
    for g in gats: g.pop('_closed', None)
    json.dump({'source': os.path.basename(pdf), 'chaks': chaks, 'gats': gats}, open(out, 'w'), ensure_ascii=False, indent=1)
    print(f'{len(chaks)} chaks, {len(gats)} gats, {len(jobs)} owner rows OCR\'d')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
