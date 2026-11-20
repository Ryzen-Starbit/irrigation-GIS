import sys, os, re, json, subprocess, tempfile
from concurrent.futures import ThreadPoolExecutor
import numpy as np, pymupdf
from PIL import Image

DEV = str.maketrans('०१२३४५६७८९', '0123456789')
SEASONS = {'खरीप': 'Kharif', 'खरिप': 'Kharif', 'रब्बी': 'Rabi', 'रबी': 'Rabi', 'उन्हाळी': 'Hot weather', 'उन्हाळ': 'Hot weather'}
CROPS = {'सोयाबीन': 'Soybean', 'खोयाबीन': 'Soybean', 'सोयाबिन': 'Soybean', 'कापूस': 'Cotton', 'कापुस': 'Cotton', 'कापू': 'Cotton',
         'तूर': 'Tur', 'तुर': 'Tur', 'हरभरा': 'Gram (Harbhara)', 'हरबरा': 'Gram (Harbhara)', 'दुरभरा': 'Gram (Harbhara)',
         'गहू': 'Wheat', 'गहु': 'Wheat', 'ज्वारी': 'Jowar', 'मका': 'Maize', 'ऊस': 'Sugarcane', 'उस': 'Sugarcane',
         'मूग': 'Moong', 'मुग': 'Moong', 'उडीद': 'Udid', 'बाजरी': 'Bajra', 'कांदा': 'Onion', 'मिरची': 'Chilli',
         'भुईमूग': 'Groundnut', 'सूर्यफूल': 'Sunflower', 'केळी': 'Banana', 'चारा': 'Fodder', 'पडीक': 'Fallow',
         'चालू पड': 'Fallow', 'फळबाग': 'Orchard', 'संत्रा': 'Orange', 'मोसंबी': 'Mosambi', 'आंबा': 'Mango', 'भाजीपाला': 'Vegetables'}
SOURCES = {'विहिर': 'Well', 'विहीर': 'Well', 'विंधन': 'Borewell', 'कालवा': 'Canal', 'कॅनाल': 'Canal', 'नदी': 'River', 'तलाव': 'Tank', 'शेततळे': 'Farm pond'}
YEAR = re.compile(r'(20\d\d)\s*[-–]\s*(\d\d)')
AREA = re.compile(r'\b(\d{1,3}\.\d{3,4})\b')

def page_images(pdf):
    d = pymupdf.open(pdf)
    for p in d:
        pix = p.get_pixmap(dpi=300)
        a = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)[:, :, :3]
        dark = a.max(axis=2) < 125
        from scipy.ndimage import binary_opening
        h = binary_opening(dark, structure=np.ones((1, 60)))
        v = binary_opening(dark, structure=np.ones((60, 1)))
        dark &= ~(h | v)
        img = Image.fromarray(np.where(dark, 0, 255).astype(np.uint8))
        yield img.resize((img.width * 2, img.height * 2), Image.LANCZOS)

def ocr_text(img):
    with tempfile.NamedTemporaryFile(suffix='.png') as f:
        img.save(f.name)
        return subprocess.run(['tesseract', f.name, '-', '-l', 'mar+eng', '--psm', '6'], capture_output=True, text=True).stdout

def lookup(s, table):
    for k, v in table.items():
        if k in s: return v
    return None

def parse(text):
    out = {'crops': [], 'pot_kharab_ha': None, 'total_area_ha': None}
    t = text.translate(DEV)
    m = re.search(r'(पोट\s*खराब|पो\.?\s*ख)[^\n]*?(\d+\.\d\d)\.?(\d\d)?', t)
    i = t.find('बारा')
    body = t[i:] if i >= 0 else t[len(t) // 2:]
    year = None; season = None
    for line in body.splitlines():
        y = YEAR.search(line)
        if y: year = f'{y.group(1)}-{y.group(2)}'
        s = lookup(line, SEASONS)
        if s: season = s
        crop = lookup(line, CROPS)
        areas = [float(a) for a in AREA.findall(line)]
        if year and crop and areas:
            src = lookup(line, SOURCES)
            irrigated = bool(src)
            out['crops'].append({'year': year, 'season': season or 'Kharif', 'crop': crop,
                                 'area_ha': areas[0], 'irrigated': irrigated, 'source': src})
    return out

def one(pdf):
    text = '\n'.join(ocr_text(img) for img in page_images(pdf))
    r = parse(text)
    r['gat_no'] = os.path.splitext(os.path.basename(pdf))[0]
    return r

def main(folder, village, out):
    pdfs = sorted(os.path.join(folder, f) for f in os.listdir(folder) if f.endswith('.pdf'))
    with ThreadPoolExecutor(max_workers=os.cpu_count() or 2) as ex:
        res = list(ex.map(one, pdfs))
    for r in res: r['village'] = village
    json.dump(res, open(out, 'w'), ensure_ascii=False, indent=1)
    print(f'{village}: {len(res)} extracts, {sum(1 for r in res if r["crops"])} with crop rows, '
          f'{sum(len(r["crops"]) for r in res)} crop rows')

if __name__ == '__main__':
    if len(sys.argv) == 2:  
        r = one(sys.argv[1]); print(json.dumps(r, ensure_ascii=False, indent=1))
    else:
        main(*sys.argv[1:4])
