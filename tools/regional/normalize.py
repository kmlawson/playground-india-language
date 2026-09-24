#!/usr/bin/env python3
"""Normalise the regional Table XV Part I records (see docs/regional.md):

1. leaves:  a record is a *leaf* if no other record for the same area names it as a parent
   (in lang_path). Totals, group rows and "Population" are not leaves. Leaves partition
   the population and are the only rows summed.
2. derived: where exactly one member of a printed total is illegible ("?"), it is derived
   as total minus the other members and flagged 'Σ'.
3. languages: each leaf is mapped to a node of the Vol. I classification (data/census.js)
   by its printed name, then by the groups above it (lang_path), using ALIAS for spellings.
   Hindustani / Hindi / Urdu as printed in the provincial volumes have no Vol. I equivalent
   (Vol. I re-sorted them by locality into Western Hindi, Eastern Hindi and Bihari), so
   they map to the composite 'HU'. The composite 'HB' = HU + Western Hindi + Eastern Hindi
   + Bihari is comparable across volumes.
"""
import collections, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import load

HERE = os.path.dirname(os.path.abspath(__file__))
cs = open(os.path.join(HERE, '..', '..', 'data', 'census.js')).read()
C = json.loads(cs[cs.index('{'):cs.rindex('}') + 1])
L = C['langs']

SECTION = re.compile(r"(languag|vernacul|famil|branch|group|asiatic|european|indian|^part|^[a-d]$|proper to|beyond)")
TOPISH = re.compile(r"(?i)^(population|total|all languages)( \(all languages\))?$")
TOP = re.compile(r"(?i)^(population( \(all languages\))?|total population|all languages|total( \(all languages\))?)$")

import unicodedata
def norm(s):
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(ch for ch in s if not unicodedata.combining(ch))
    s = s.lower().replace('’', "'")
    s = re.sub(r'^[a-z]\s*[-.–—]+\s*\d*\s*[-.–—]*\s*', '', s) if re.match(r'^[a-z]\s*[-.–—]', s) else s  # "A-1.-Burmese"
    s = re.sub(r'^\([a-z0-9]+\)\s*', '', s)            # "(a) Hindi"
    s = re.sub(r'\b(total|group total|family total|branch total|sub-family total)\b', '', s)
    s = s.replace('†', '').replace('*', '')
    s = re.sub(r'[^a-z ]+', ' ', s)
    return ' '.join(s.split())

# printed spelling -> Vol. I name (normalised forms on both sides)
ALIAS = {
    'panjabi': 'panjabi', 'punjabi': 'panjabi', 'gurumukhi': 'panjabi', 'western panjabi': 'lahnda or western punjabi',
    'lahnda': 'lahnda or western punjabi', 'lahnda chabhali': 'lahnda or western punjabi', 'siraiki': 'lahnda or western punjabi',
    'siraiki or jatki': 'lahnda or western punjabi', 'jatki': 'lahnda or western punjabi', 'jattki or jagdali': 'lahnda or western punjabi',
    'gujrati': 'gujarati', 'gujarathi': 'gujarati', 'gujarati standard': 'gujarati', 'kachchhi': 'sindhi', 'kachchi sindhi': 'sindhi',
    'jattki sindhi': 'sindhi', 'lasi': 'sindhi', 'thareli or dhatki': 'sindhi', 'memani': 'sindhi',
    'telegu': 'telugu', 'kannada': 'kanarese', 'coorgi': 'kodagu or coorgi', 'kodagu': 'kodagu or coorgi',
    'rajsthani': 'rajasthani', 'marwari': 'rajasthani', 'mewari': 'rajasthani', 'mewati': 'rajasthani', 'malvi': 'rajasthani',
    'jaipuri': 'rajasthani', 'nimadi': 'rajasthani', 'nimari gurvi': 'rajasthani', 'banjari': 'rajasthani', 'banajari': 'rajasthani',
    'labhani or banjari naiki': 'rajasthani', 'lambadi': 'rajasthani', 'lambadi banjari': 'rajasthani', 'central eastern rajasthani': 'rajasthani',
    'north eastern rajasthani': 'rajasthani', 'rajasthani marwari': 'rajasthani', 'rajasthani others': 'rajasthani', 'sondhi sondwari': 'rajasthani',
    'bundelkhandi': 'western hindi', 'braj bhasha': 'western hindi', 'urdu western hindi': 'HU',
    'awadhi': 'eastern hindi', 'awadhi including purbi': 'eastern hindi', 'purbi': 'eastern hindi', 'baghelkhandi': 'eastern hindi',
    'chhattisgarhi': 'eastern hindi', 'chhatrisgarhi': 'eastern hindi', 'eastern hindi awadhi': 'eastern hindi',
    'hindustani': 'HU', 'hindi': 'HU', 'urdu': 'HU', 'hindustani hindi and urdu': 'HU', 'b hindustani': 'HU', 'a hindi': 'HU',
    'naipali': 'eastern pahari khas kura or naipali', 'nepali': 'eastern pahari khas kura or naipali', 'naipali khas kura': 'eastern pahari khas kura or naipali',
    'naipali gorkhali': 'eastern pahari khas kura or naipali', 'eastern pahari': 'eastern pahari khas kura or naipali',
    'eastern pahari khaskura or naipali': 'eastern pahari khas kura or naipali', 'naipali and garhwali': 'eastern pahari khas kura or naipali',
    'oraon': 'kurukh or oraon', 'kurukh oraon': 'kurukh or oraon', 'oraon kurukh': 'kurukh or oraon', 'kurukh or oraon dhangari': 'kurukh or oraon',
    'kandhi kui': 'kandhi or kui', 'meithei manipuri': 'kathe ponna including meithei manipuri', 'manipuri': 'kathe ponna including meithei manipuri',
    'kathe': 'kathe ponna including meithei manipuri', 'khasi': 'khasi', 'singhalese': 'sinhalese', 'goanese': 'konkani', 'kankani': 'konkani',
    'kherwari unspecified': 'kherwari santali mundari ho etc', 'kherwari': 'kherwari santali mundari ho etc', 'santali': 'kherwari santali mundari ho etc',
    'mundari': 'kherwari santali mundari ho etc', 'ho': 'kherwari santali mundari ho etc', 'bhumij': 'kherwari santali mundari ho etc',
    'koda kora': 'kherwari santali mundari ho etc', 'kora koda': 'kherwari santali mundari ho etc', 'turi': 'kherwari santali mundari ho etc',
    'mahili': 'kherwari santali mundari ho etc', 'karmali': 'kherwari santali mundari ho etc', 'korwa': 'kherwari santali mundari ho etc',
    'bhotia of tibet tibetan': 'bhotia of tibet or tibetan', 'tibetan': 'bhotia of tibet or tibetan', 'rong lepcha': 'rong or lepcha',
    'lepcha': 'rong or lepcha', 'rong': 'rong or lepcha', 'bara bodo kachari mech': 'bara bodo or plains kachari', 'bodo': 'bara bodo or plains kachari',
    'kachari': 'bara bodo or plains kachari', 'mech': 'bara bodo or plains kachari', 'dehwari local persian': 'persian',
    'kashmeri': 'kashmiri', 'kashmiri and chitrali': 'kashmiri', 'pahari unspecified': 'pahari unspecified', 'gujuri': 'rajasthani',
    'gipsy': 'gipsy languages', 'gipsy language ladar': 'gipsy languages', 'unclassed gipsy': 'gipsy languages',
    'sourashtra': 'gujarati', 'khandeshi': 'khandesi', 'ahirani or khandeshi': 'khandesi', 'marathi standard': 'marathi',
    'halbi': 'marathi', 'koshti': 'marathi', 'c p dialects': 'marathi', 'bhatri': 'oriya', 'kachin': 'kachin',
    'slavonic russian': 'slavonic russian polish and others', 'russian': 'slavonic russian polish and others', 'polish': 'slavonic russian polish and others',
    'greek romaic': 'greek romaic', 'greek': 'greek romaic', 'gaelic': 'gaelic scotch', 'scotch': 'gaelic scotch', 'flemish with belgian': 'flemish',
    'belgian': 'flemish', 'hebrew with jewish': 'hebrew', 'jewish': 'hebrew', 'africaans': 'dutch', 'swiss': 'german',
    'arakanese': 'burmese', 'yanbye': 'burmese', 'tavoyan': 'burmese', 'merguese': 'burmese', 'chaungtha': 'burmese', 'yaw': 'burmese',
    'a burmese': 'burmese', 'a and a arakanese and yanbye': 'burmese', 'talaing': 'talaing', 'shan': 'shan unspecified',
    'i shan': 'shan unspecified', 'karen unspecified': 'karen unspecified', 'n karen unspecified': 'karen unspecified', 'n sgaw': 'sgaw', 'n pwo': 'pwo',
    'c kath': 'kathe ponna including meithei manipuri', 'burmese': 'burmese', 'panchali bhili': 'bhili', 'bhil dialects': 'bhili',
    'buroshaski': 'burushaski', 'chinese': 'chinese group', 'chinese languages other than yunnanese': 'chinese group',
    'semitic family arabic': 'arabic', 'indo european family persian': 'persian', 'portuguese': 'portuguese',
    'western hindi': 'western hindi', 'eastern hindi': 'eastern hindi', 'bihari': 'bihari', 'madrassi': 'tamil',
    # district-table names absent from Vol. I, placed where Vol. I (or the volume itself) counts them
    'miri': 'abor', 'savara': 'sawara', 'kurku': 'korku', 'saurashtri': 'gujarati', 'rathi dialect of panjabi': 'panjabi',
    'korava or yerukala': 'tamil', 'korava': 'tamil', 'yerukala': 'tamil', 'erakala': 'tamil', 'erakala kaikadi': 'tamil', 'kaikadi': 'tamil',
    'unspecified chin or poi': 'other or unspecified chin sub group', 'kuki unspecified': 'other or unspecified kuki sub group',
    'zahao': 'other or unspecified chin sub group', 'kuki': 'other or unspecified kuki sub group',
    'limbu': 'kiranti', 'lahuli': 'tibeto himalayan branch',
    # residual rows printed as "Other ... languages": the group they belong to
    'other indo aryan languages': 'indo aryan branch', 'other munda languages': 'munda branch', 'other dravidian languages': 'dravidian family',
    'other indian languages': 'vernaculars of india', 'other asiatic languages': 'vernaculars of other asiatic countries and africa',
    'asiatic non indian and african languages': 'vernaculars of other asiatic countries and africa',
    'asiatic languages foreign to india': 'vernaculars of other asiatic countries and africa',
    'vernaculars of asiatic countries beyond india all families': 'vernaculars of other asiatic countries and africa',
    'vernaculars of asiatic and african countries': 'vernaculars of other asiatic countries and africa',
    'other european languages': 'european languages',
}
# a dialect printed with its group in brackets, e.g. "Vaiphei (Kuki)", "Maram (Naga)"
SUFFIX_ALIAS = {'kuki': 'other or unspecified kuki sub group', 'naga': 'other or unspecified naga languages'}
# groups whose printed names differ from Vol. I group names (used for lang_path fall-back)
GROUP_ALIAS = {
    'burma group': 'burma group', 'kuki chin group': 'kuki chin group', 'naga group': 'naga group', 'sak lui group': 'sak lui group',
    'mro group': 'mro group', 'tai shan group': 'tai group', 'palaung wa group': 'palaung wa group', 'karen group': 'karen group',
    'chinese group': 'chinese group', 'european languages': 'C. European languages', 'y european languages': 'C. European languages',
    'indian languages': None, 'x indian languages': None, 'other languages': None, 'z other languages': None,
}

index = collections.defaultdict(list)
for l in L:
    index[norm(l['name'])].append(l)
    for part in re.split(r' or |, |\(|\)', l['name']):
        if part.strip() and not l['kids']:
            index.setdefault('~' + norm(part), []).append(l)

def pick(cands):
    # prefer section A (vernaculars of India) and leaves
    cands = sorted(cands, key=lambda l: (0 if pathroot(l).startswith('A') else 1, 1 if l['kids'] else 0))
    return cands[0]

def pathroot(l):
    while l['parent'] is not None:
        l = L[l['parent']]
    return l['name']

def lookup(name):
    for v in variants(name):
        r = lookup1(v)
        if r is not None:
            return r
    m = re.search(r'\((kuki|naga)\.?\)\s*$', name, re.I)
    if m:
        return pick(index[SUFFIX_ALIAS[m.group(1).lower()]])['id']
    return None

def variants(name):
    out = [name]
    nop = re.sub(r'\([^)]*\)', ' ', name).strip()
    if nop and nop != name:
        out.append(nop)
    inner = re.findall(r'\(([^)]*)\)', name)
    for part in re.split(r' or |, ', nop):
        if part.strip() and part.strip() not in out:
            out.append(part.strip())
    out += [i for i in inner if i.strip()]
    return out

def lookup1(name):
    n = norm(name)
    if n in ALIAS:
        a = ALIAS[n]
        if a in ('HU',):
            return a
        if a in index:
            return pick(index[a])['id']
        if a.startswith('C. '):
            return next(l['id'] for l in L if l['name'] == a)
    if n in GROUP_ALIAS:
        a = GROUP_ALIAS[n]
        if a is None:
            return None
        if a in index:
            return pick(index[a])['id']
        return next((l['id'] for l in L if l['name'] == a), None)
    if n in index:
        return pick(index[n])['id']
    if '~' + n in index:
        return pick(index['~' + n])['id']
    return None

def num(x):
    return x if isinstance(x, int) else None

AREA_ALIAS = {('jk', 'muzaffrabad'): 'muzaffarabad'}
def akey(s):
    s = norm(re.sub(r'^\(\w+\)\s*', '', s or ''))
    return s
def area_key(vol, path, area):
    a = akey(area); a = AREA_ALIAS.get((vol, a), a)
    return (vol, tuple(akey(x) for x in path), a)

CHECK = []
def build():
    CHECK.clear()
    R = load.load()
    byarea = collections.defaultdict(list)
    first = {}
    for r in R:
        k = area_key(r['vol'], r['area_path'], r['area'])
        first.setdefault(k, (tuple(r['area_path']), r['area']))
        byarea[(r['vol'],) + first[k]].append(r)
    leaves = []
    report = collections.Counter(); unmapped = collections.Counter(); derived = []
    for (vol, path, area), rs in byarea.items():
        pop = None
        for r in rs:
            if TOP.match(r['language'].strip()) or (not r['lang_path'] and norm(r['language']) == norm(area)):
                v_ = num(r['p']) if num(r['p']) is not None else (num(r['m']) or 0) + (num(r['f']) or 0)
                if pop is None or (v_ or 0) > (num(pop['p']) if num(pop['p']) is not None else (num(pop['m']) or 0) + (num(pop['f']) or 0)):
                    pop = r
        rest = [r for r in rs if r is not pop]
        def val(x):
            return num(x['p']) if num(x['p']) is not None else ((num(x['m']) or 0) + (num(x['f']) or 0) if (num(x['m']) is not None or num(x['f']) is not None) else None)
        def gname(r):
            return norm(re.sub(r'(?i)\btotal\b[:.]*', '', r['language']))
        # members of a row: rows further down whose lang_path passes through it
        mem = {}
        for i, r in enumerate(rest):
            X, P = gname(r), r['lang_path']
            if not X or (not r['lang_total'] and P and norm(P[-1]) == X):
                mem[i] = []; continue          # a leaf that sits in a group of its own name
            start = max(0, len(P) - 1) if r['lang_total'] else len(P)
            mem[i] = [j for j, q in enumerate(rest) if j != i
                      and X in [norm(e) for e in q['lang_path'][start:]]
                      and not (q['lang_total'] and gname(q) == X)]
            if r['lang_total'] and P:
                last = norm(P[-1])
                if last and (X == last or X in last or last in X):
                    # CIA style: "Total Bhil Dialects" printed in the same group as its members
                    mem[i] += [j for j, q in enumerate(rest) if j != i and j not in mem[i]
                               and not q['lang_total'] and q['lang_path'] == P]
        cand = []
        nontot = [q for q in rest if not q['lang_total']]
        for i, r in enumerate(rest):
            if not mem[i]:
                P = r['lang_path']
                if r['lang_total'] and SECTION.search(gname(r) or 'x') and any(q is not r and q['lang_path'][:len(P)] == P for q in nontot):
                    continue                     # a section total whose detail is printed under it
                if TOPISH.match(r['language'].strip()) and nontot:
                    continue
                cand.append(r); continue
            inner = set(k for j in mem[i] for k in mem[j])
            if SECTION.search(gname(r) or 'x'):
                continue                         # structural total (family, branch, group, section): never a residual
            leafm = [rest[j] for j in mem[i] if j not in inner]      # maximal members
            v = val(r); s_ = sum(val(q) or 0 for q in leafm)
            if v is not None and v - s_ > 0:
                rr = dict(r); rr['p'] = v - s_
                rr['m'] = (num(r['m']) - sum(num(q['m']) or 0 for q in leafm)) if num(r['m']) is not None else None
                rr['f'] = (num(r['f']) - sum(num(q['f']) or 0 for q in leafm)) if num(r['f']) is not None else None
                rr['residual'] = True
                rr['language'] = re.sub(r'(?i)^total\s*[:.]?\s*', '', r['language']).strip()
                cand.append(rr)
        if pop is not None and num(pop['p']):
            tot = sum((num(r['p']) if num(r['p']) is not None else (num(r['m']) or 0) + (num(r['f']) or 0)) for r in cand)
            CHECK.append((vol, area, num(pop['p']), tot))
        # a flagged total with no members is a leaf (e.g. Burma I-D groups); drop totals whose members exist
        for r in cand:
            p, m, f = r['p'], r['m'], r['f']
            flag = None
            if any(isinstance(x, str) for x in (p, m, f)):
                if not isinstance(m, str) and not isinstance(f, str) and m is not None:
                    p = (m or 0) + (f or 0); flag = ['Σ', 'persons illegible; males + females']
                else:
                    flag = ['?', 'figure illegible in the scan']
            node = None; how = None
            for i, nm in enumerate([r['language']] + list(reversed(r['lang_path']))):
                node = lookup(nm)
                if node is not None:
                    how = 'name' if i == 0 else 'group'
                    break
            if node is None:
                unmapped[(vol, r['language'])] += num(p) or (num(m) or 0) + (num(f) or 0)
            if r.get('residual'):
                flag = ['Σ', f"{r['language']}: printed total less the entries listed under it (includes any illegible entries)"]
            leaves.append({'vol': vol, 'area': area, 'area_path': list(path), 'leaf': r['leaf'], 'page': r['page'],
                           'language': r['language'], 'lang_path': r['lang_path'],
                           'p': num(p) if num(p) is not None else ((num(m) or 0) + (num(f) or 0) if (num(m) or num(f)) else None),
                           'm': num(m), 'f': num(f), 'node': node, 'how': how, 'flag': flag,
                           'pop': [num(pop['p']), num(pop['m']), num(pop['f'])] if pop else None,
                           'area_total': rs[0]['area_total']})
    return leaves, unmapped

if __name__ == '__main__':
    leaves, unmapped = build()
    print(len(leaves), 'leaf records;', sum(1 for l in leaves if l['node'] is None), 'unmapped')
    tot = sum(v for v in unmapped.values())
    print('unmapped persons', tot)
    for (v, n), c in unmapped.most_common(60):
        print(f'  {c:>9,} {v:12s} {n}')
