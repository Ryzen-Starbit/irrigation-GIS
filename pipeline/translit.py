import re

CONS = {
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'ळ': 'l', 'व': 'v',
    'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h', 'ऱ': 'r', 'ऩ': 'n', 'क़': 'k', 'ख़': 'kh', 'ग़': 'g', 'ज़': 'z', 'फ़': 'f',
}
VOW = {'अ': 'a', 'आ': 'a', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
       'ऋ': 'ru', 'ऍ': 'e', 'ऑ': 'o'}
MATRA = {'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ृ': 'ru',
         'ॅ': 'e', 'ॉ': 'o'}
VIRAMA, ANUSVARA, VISARGA, CANDRA, NUKTA = '्', 'ं', 'ः', 'ँ', '़'
DIGITS = str.maketrans('०१२३४५६७८९', '0123456789')

def _word(w):
    w = w.replace(NUKTA, '')
    syl = []
    i = 0
    while i < len(w):
        ch = w[i]
        if w.startswith('क्ष', i):
            cons = ['ksh']; i += 3
        elif w.startswith('ज्ञ', i):
            cons = ['dny']; i += 3
        elif ch in CONS:
            cons = [CONS[ch]]; i += 1
        elif ch in VOW:
            syl.append({'c': [], 'v': VOW[ch], 'inh': False, 'coda': ''}); i += 1; continue
        elif ch in (ANUSVARA, CANDRA) and syl:
            syl[-1]['coda'] += 'N'; i += 1; continue
        elif ch == VISARGA and syl:
            syl[-1]['coda'] += 'h'; i += 1; continue
        else:
            syl.append({'raw': ch}); i += 1; continue
        while i + 1 < len(w) and w[i] == VIRAMA and (w[i + 1] in CONS or w.startswith('क्ष', i + 1) or w.startswith('ज्ञ', i + 1)):
            if w.startswith('क्ष', i + 1): cons.append('ksh'); i += 4
            elif w.startswith('ज्ञ', i + 1): cons.append('dny'); i += 4
            else: cons.append(CONS[w[i + 1]]); i += 2
        if i < len(w) and w[i] == VIRAMA:
            syl.append({'c': cons, 'v': '', 'inh': False, 'coda': ''}); i += 1; continue
        if i < len(w) and w[i] in MATRA:
            syl.append({'c': cons, 'v': MATRA[w[i]], 'inh': False, 'coda': ''}); i += 1
        else:
            syl.append({'c': cons, 'v': 'a', 'inh': True, 'coda': ''})
    letters = [s for s in syl if 'raw' not in s]
    n = len(letters)
    for k in range(n - 1, -1, -1):
        s = letters[k]
        if not s['inh'] or s['coda']:
            continue
        if k == n - 1 and n > 1:
            if len(s['c']) == 1:         
                s['v'] = ''
            continue
        if 0 < k < n - 1:
            prev_has_v = letters[k - 1]['v'] != ''
            nxt = letters[k + 1]
            prev = letters[k - 1]
            if (prev_has_v and nxt['c'] and nxt['v'] != '' and len(s['c']) == 1
                    and len(nxt['c']) == 1 and len(prev['c']) <= 1 and not prev['coda']):
                s['v'] = ''
    out = []
    for s in syl:
        if 'raw' in s:
            out.append(s['raw']); continue
        cons = s['c']
        if cons:
            cons = [cons[0]] + ['w' if c == 'v' else c for c in cons[1:]]
        out.append(''.join(cons) + s['v'] + s['coda'])
    r = ''.join(out)
    r = re.sub(r'N(?=[nm])', '', r)                
    r = re.sub(r'N(?=[pbm])', 'm', r).replace('N', 'n')
    r = re.sub(r'rav$', 'rao', r)         
    return r

def to_english(text):
    if not text:
        return text
    text = text.translate(DIGITS)
    parts = re.split(r'(\s+|[.,()/-])', text)
    res = []
    for p in parts:
        if re.search(r'[ऀ-ॿ]', p):
            t = _word(p)
            res.append(t[:1].upper() + t[1:])
        else:
            res.append(p)
    s = ''.join(res)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


if __name__ == '__main__':
    for t in ['गजानन एकनाथ मान्टे', 'ज्ञानेश्वर दिनकरराव पऱ्हाड', 'वंदना सुरेश ताठे', 'महादू विठोबा मघाडे',
              'शिवशंकर आश्रुबा पऱ्हाड', 'सै. रईस सै. जानी', 'रत्नाबाई ज. शंकर देव्हरे', 'डिगांबर राघोजी साळवे',
              'त्र्यंबकेश्वर जगन्नाथ पऱ्हाड', 'लक्ष्मण जयवंता पऱ्हाड', 'संजय प्रभाकर कुलकर्णी', 'सुमनबाई सौंदाजी काकड',
              'दिग्रस बुद्रुक', 'टाकरखेड वायाळ', 'भगवान', 'मधुकर', 'विठ्ठल नारायण पऱ्हाड', 'श्री संत गजानन महाराज',
              'चंद्रकला तेजराव', 'अंकुश विश्वनाथ पऱ्हाड', 'किरण ज्ञानेश्वर पऱ्हाड']:
        print(t, '->', to_english(t))
