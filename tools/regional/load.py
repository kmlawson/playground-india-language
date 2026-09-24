#!/usr/bin/env python3
"""Load the hand transcriptions in source/regional/KEY/ (Table XV Part I, mother tongue)
into one flat list, applying the per-volume selection rules in CONFIG. Every rule is
documented in docs/regional.md."""
import glob, json, os, re, collections
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'source', 'regional')

# which scan leaves hold the district x language grid of Part I, and other selection rules
CONFIG = {
    'assam': {}, 'baluchistan': {}, 'bihar_orissa': {}, 'bombay': {}, 'cp_berar': {}, 'cia': {},
    'hyderabad': {}, 'jk': {}, 'madras': {}, 'mysore': {}, 'nwfp': {}, 'punjab': {},
    'rajputana': {}, 'travancore': {'drop_areas': {'Lowland', 'Midland', 'Highland'}}, 'up': {}, 'wisa': {}, 'baroda': {}, 'andaman': {}, 'ajmer': {'leaf_areas': {'Ajmer-Merwara'}},
    'cochin': {'leaf_areas': {'Cochin State'}},
    'gwalior': {'leaves': list(range(151, 158)), 'total_areas': {'Gwalior State'}},   # 158 = cities (Part B)
    'burma': {'leaves': [234, 235, 236, 237]},          # I-D: all language groups by district
    'bengal': {'leaves': list(range(192, 201)) + [202], 'sections': {None, 'Part C'}},  # A + Sikkim; not cities/supplements
    'calcutta': {'skip': True},                         # duplicates Bengal Part A (Calcutta) and Part B (cities)
    'aden': {'religion': 'All Religions', 'leaf_areas': {'Aden'}},

}

# short volume titles for display
VOL_NAMES = {'india': 'Vol. I, India', 'andaman': 'Vol. II, Andaman and Nicobar Islands', 'assam': 'Vol. III, Assam',
         'baluchistan': 'Vol. IV, Baluchistan', 'bengal': 'Vol. V, Bengal and Sikkim', 'calcutta': 'Vol. VI, Calcutta',
         'bihar_orissa': 'Vol. VII, Bihar and Orissa', 'bombay': 'Vol. VIII, Bombay Presidency', 'aden': 'Vol. VIII Part III, Aden',
         'bombay_cities': 'Vol. IX, Cities of the Bombay Presidency', 'wisa': 'Vol. X, Western India States Agency', 'burma': 'Vol. XI, Burma',
         'cp_berar': 'Vol. XII, Central Provinces and Berar', 'madras': 'Vol. XIV, Madras', 'nwfp': 'Vol. XV, North-West Frontier Province',
         'delhi': 'Vol. XVI, Delhi', 'punjab': 'Vol. XVII, Punjab', 'up': 'Vol. XVIII, United Provinces', 'baroda': 'Vol. XIX, Baroda',
         'cia': 'Vol. XX, Central India Agency', 'cochin': 'Vol. XXI, Cochin', 'gwalior': 'Vol. XXII, Gwalior', 'hyderabad': 'Vol. XXIII, Hyderabad',
         'jk': 'Vol. XXIV, Jammu and Kashmir', 'mysore': 'Vol. XXV, Mysore', 'ajmer': 'Vol. XXVI, Ajmer-Merwara',
         'rajputana': 'Vol. XXVII, Rajputana Agency', 'travancore': 'Vol. XXVIII, Travancore'}

def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

def load():
    out = []
    for key in sorted(CONFIG):
        cfg = CONFIG[key]
        if cfg.get('skip'):
            continue
        for f in sorted(glob.glob(os.path.join(ROOT, key, 'leaf*.json'))):
            d = json.load(open(f))
            t = str(d.get('table', ''))
            if 'Part II' in t and 'Part I ' not in t and not t.endswith('Part I'):
                continue
            if 'leaves' in cfg and d['leaf'] not in cfg['leaves']:
                continue
            for r in d.get('records', []):
                if 'language' not in r:
                    continue
                if 'sections' in cfg and r.get('section') not in cfg['sections']:
                    continue
                if 'religion' in cfg and r.get('religion') != cfg['religion']:
                    continue
                if r.get('area') in cfg.get('drop_areas', ()):
                    continue
                atot = bool(r.get('area_is_total'))
                if 'total_areas' in cfg:
                    atot = r.get('area') in cfg['total_areas']
                if r.get('area') in cfg.get('leaf_areas', ()):
                    atot = False
                path = [p for p in (r.get('area_path') or [])]
                out.append({
                    'vol': key, 'leaf': d['leaf'], 'page': d.get('printed_page'), 'identifier': d.get('identifier'),
                    'area': r.get('area'), 'area_path': path, 'area_total': atot,
                    'language': r['language'], 'lang_path': r.get('lang_path') or [], 'lang_total': bool(r.get('lang_is_total')),
                    'p': r.get('persons'), 'm': r.get('males'), 'f': r.get('females'), 'cols': r.get('cols'),
                })
    return out

def num(x):
    return x if isinstance(x, int) else None

if __name__ == '__main__':
    R = load()
    print(len(R), 'records')
    by = collections.defaultdict(list)
    for r in R:
        by[r['vol']].append(r)
    for v, rs in by.items():
        areas = collections.OrderedDict()
        for r in rs:
            areas.setdefault(tuple(r['area_path']) + (r['area'],), r['area_total'])
        leafareas = [a for a, t in areas.items() if not t]
        # population per area: 'Population' record, else sum of leaf languages
        pop = collections.defaultdict(int); langsum = collections.defaultdict(int)
        for r in rs:
            a = tuple(r['area_path']) + (r['area'],)
            val = num(r['p']) if num(r['p']) is not None else (num(r['m']) or 0) + (num(r['f']) or 0)
            if re.match(r'(?i)^(population|all languages|total)$', r['language'].strip()) and not r['lang_path']:
                pop[a] = val
            elif not r['lang_total']:
                langsum[a] += val or 0
        top = [a for a, t in areas.items() if t][:1]
        tp = pop.get(top[0]) if top else None
        ls = sum(pop.get(a, langsum[a]) for a in leafareas)
        mism = [(a[-1], pop[a], langsum[a]) for a in leafareas if a in pop and pop[a] != langsum[a]]
        print(f'{v:13s} areas {len(areas):3d} leaf {len(leafareas):3d} top={top[0][-1] if top else None} toppop={tp} sumleafpop={ls} pop-vs-langsum mismatches={len(mism)} {mism[:3]}')
