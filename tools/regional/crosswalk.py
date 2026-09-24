#!/usr/bin/env python3
"""Crosswalk: regional Table XV areas -> 1931 units of the lineage database (tools/lineage.py).
Automatic matching is by normalised name within the volume's province; MANUAL covers
aggregates ('Rest of Agency'), cities, divisions and spelling differences. Areas outside
present-day India (Sind, west Punjab, east Bengal, Baluchistan, NWFP, Burma, parts of J&K)
are handled by OUTSIDE (see tools/build_districts.py). Documented in docs/regional.md."""
import collections, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
import normalize as N

VOLDIV = {'assam': ['Assam'], 'baroda': ['Baroda'], 'bengal': ['Bengal'], 'bihar_orissa': ['Bihar and Orissa', 'Bihar and Orissa-Orissa Tribuatory'],
          'bombay': ['Bombay Presidency'], 'cia': ['Central India Agency'], 'cp_berar': ['Central Province and Berar'], 'gwalior': ['Gwalior'],
          'hyderabad': ['Hyderabad'], 'madras': ['Madras Presidency'], 'mysore': ['Mysore'], 'punjab': ['Punjab'], 'rajputana': ['Rajputhana Agency'],
          'up': ['United Province of Agra and Oudh'], 'wisa': ['Western India State Agency'], 'ajmer': ['Ajmer Merwar'],
          'travancore': ['Madras Presidency'], 'cochin': ['Madras Presidency'], 'andaman': [], 'jk': [], 'nwfp': [], 'baluchistan': [],
          'burma': [], 'aden': []}

# (vol, area as printed) -> list of lineage 1931 unit names ([] = outside present-day India; see OUTSIDE)
MANUAL = {
    ('assam', 'Khasi and Jaintia Hills (British)'): ['Khasi and Jaintia Hills'],
    ('assam', 'Sadiya Frontier Tract'): ['Sadiya Frontier Tract (N.E.F.A.)'],
    ('assam', 'Balipara Frontier Tract'): ['Balipara Frontier Tract (N.E.F.A.)'],
    ('assam', '(2) Manipur State'): ['Manipur'], ('assam', '(3) Khasi States'): ['Khasi States'],
    ('baroda', 'Baroda City'): ['Baroda'], ('baroda', 'Amreli Division'): ['Amreli'], ('baroda', 'Baroda Division'): ['Baroda'],
    ('baroda', 'Mehsana Division'): ['Mehsana'], ('baroda', 'Navsari Division'): ['Navsari'],
    ('bengal', '24-Parganas District'): ['24 - Parganas'], ('bengal', 'Cooch Behar State'): ['Cooch Behar'], ('bengal', 'Tripura State'): ['Tripura'],
    ('bengal', 'Sikkim'): ['@Sikkim'],
    ('bihar_orissa', 'Orissa States'): ['Athgarh', 'Athmallik', 'Bamra', 'Baramba', 'Baud', 'Bonai', 'Daspalla', 'Dhenkanal', 'Gangpur', 'Hindol',
                                        'Kalahandi', 'Keonjhar', 'Khandpara', 'Mayurbhanj', 'Nayagarh', 'Nilgiri', 'Pal Lahara', 'Patna|Bihar and Orissa-Orissa Tribuatory',
                                        'Rairakhol', 'Ranpur', 'Sonpur', 'Talcher', 'Tigiria'],
    ('bihar_orissa', 'Chota Nagpur States'): ['Kharsawan', 'Saraikela'],
    ('bihar_orissa', 'Patna'): ['Patna|Bihar and Orissa'],
    ('bombay', 'Bombay City'): ['Bombay Suburban'], ('bombay', 'Bombay Suburban District'): ['Bombay Suburban'],
    ('bombay', 'Khandesh-East'): ['Khandesh East'], ('bombay', 'Khandesh-West'): ['Khandesh West'], ('bombay', 'Panch-Mahals'): ['Panch Mahals'],
    ('bombay', '(i) Idar'): ['Mahikantha Agency'], ('bombay', '(ii) Rest of the Agency|Mahikantha Agency'): ['Mahikantha Agency'],
    ('bombay', '(i) Rajpipla'): ['Rajpipla'], ('bombay', '(ii) Chota-Udepur'): ['Chota Udepur'], ('bombay', '(iii) Devgad-Baria'): ['Devgad Baria'],
    ('bombay', '(iv) Lunawada'): ['Lunawada'], ('bombay', '(v) Balasinor'): ['Balasinor'], ('bombay', '(vi) Santh'): ['Santh'],
    ('bombay', '(vii) Sankhed-Mewas'): ['Sankheda Mewas'], ('bombay', '(viii) Rest of the Agency|Rewakantha Agency'): ['Kadana', 'Pandu Mewas', 'Sanjeli'],
    ('bombay', 'Sawantwadi'): ['Savantvadi'], ('bombay', 'Kurundwad (Senior)'): ['Sangli'], ('bombay', 'Kurundwad (Junior)'): ['Sangli'],
    ('bombay', 'Miraj (Senior)'): ['Miraj'], ('bombay', 'Miraj (Junior)'): ['Miraj'], ('bombay', 'Wadi-Jhagir'): ['Sangli'],
    ('cia', 'British Pargana of Manpur'): ['Indore'], ('cia', 'Indore'): ['Indore', 'Kukshi (Indore)', 'Mehidpur (Indore)', 'Nemawar (Indore)', 'Rampura (Indore)'],
    ('cia', 'Kurwai'): ['Bhopal'], ('cia', 'Other States|Bhopal Agency'): ['Bhopal'],
    ('cia', 'Dewas (Senior)'): ['Dewas'], ('cia', 'Dewas (Junior)'): ['Dewas'], ('cia', 'Rest of Agency|Malwa Agency'): ['Jaora', 'Sitamau'],
    ('cia', 'Ali-Rajpur'): ['Ali Rajpur'], ('cia', 'Other States|Southern Central India States Agency'): ['Mathwar', 'Bori'],
    ('cia', 'Rest of Agency|Bundelkhand Agency'): ['Beri', 'Jigni', 'Sarila'], ('cia', 'Other States|Baghelkhand Agency'): ['Jaso'],
    ('cia', 'Khaniadhana (Gwalior Residency)'): ['Khaniadhana'],
    ('cp_berar', 'Changbhakar'): ['Chang Bhakar'],
    ('hyderabad', 'Hyderabad City'): ['Atraf-i-Balda'],
    ('madras', 'Agency|Ganjam'): ['Ganjam'], ('madras', 'Plains|Ganjam'): ['Ganjam'],
    ('madras', 'Agency|Vizagapatam'): ['Vizagapatam'], ('madras', 'Plains|Vizagapatam'): ['Vizagapatam'],
    ('madras', 'Agency|Godavari, East'): ['Godavari East'], ('madras', 'Plains|Godavari, East'): ['Godavari East'],
    ('bombay', 'Sachin'): ['Surat'],
    ('madras', 'Godavari, East'): ['Godavari East'], ('madras', 'Godavari, West'): ['Godavari West'],
    ('mysore', 'Bangalore City'): ['Bangalore'], ('mysore', 'Bangalore District'): ['Bangalore'], ('mysore', 'Civil and Military Station, Bangalore'): ['Bangalore'],
    ('mysore', 'Kolar Gold Fields (City)'): ['Kolar'], ('mysore', 'Kolar District'): ['Kolar'], ('mysore', 'Mysore City'): ['Mysore'],
    ('mysore', 'Mysore District'): ['Mysore'], ('mysore', 'Tumkur District'): ['Tumkur'], ('mysore', 'Chitaldrug District'): ['Chitaldrug'],
    ('mysore', 'Hassan District'): ['Hassan'], ('mysore', 'Kadur District'): ['Kadur'], ('mysore', 'Shimoga District'): ['Shimoga'],
    ('punjab', 'Ferozepore'): ['Ferozepur'], ('punjab', 'Keonthal'): ['Simla'], ('punjab', 'Baghal'): ['Simla'], ('punjab', 'Other Simla Hill States'): ['Simla'],
    ('punjab', 'Maler Kotla'): ['Malerkotla'], ('punjab', 'Bilaspur'): ['Bilaspur|Punjab'],
    ('rajputana', 'Abu District'): ['Abu'], ('rajputana', 'Kushalgarh (Chiefship)'): ['Kushalgarh (chiefship)'], ('rajputana', 'Lawa (Estate)'): ['Lawa (estate)'],
    ('rajputana', 'Partabgarh'): ['Partabgarh|Rajputhana Agency'],
    ('up', 'Naini Tal'): ['Nainital'], ('up', 'Shahjahanpur'): ['Shahajahanpur'], ('up', 'Partabgarh'): ['Partabgarh|United Province of Agra and Oudh'],
    ('wisa', 'Junagad'): ['Junagadh'], ('wisa', 'Limbdi'): ['Eastern Kathiawar Agency'], ('wisa', 'Wadhwan'): ['Eastern Kathiawar Agency'],
    ('wisa', 'Lakhtar'): ['Eastern Kathiawar Agency'], ('wisa', 'Sayla'): ['Eastern Kathiawar Agency'], ('wisa', 'Chuda'): ['Eastern Kathiawar Agency'],
    ('wisa', 'Vala'): ['Eastern Kathiawar Agency'], ('wisa', 'Muli'): ['Eastern Kathiawar Agency'], ('wisa', 'Bajana'): ['Eastern Kathiawar Agency'],
    ('wisa', 'Patdi'): ['Eastern Kathiawar Agency'], ('wisa', 'Wadhwan Civil Station'): ['Eastern Kathiawar Agency'],
    ('wisa', 'Rest of the Agency|B. Eastern Kathiawar Agency'): ['Eastern Kathiawar Agency'],
    ('wisa', 'Manavadar'): ['Bantva'], ('wisa', 'Thana Devli'): ['Jetpur'], ('wisa', 'Wadia'): ['Jetpur'],
    ('wisa', 'D. S. Vala Mulu Surang of Jetpur (Pithadia)'): ['Jetpur'], ('wisa', 'D. S. Vala Rawat Ram of Jetpur (Bilkho)'): ['Jetpur'],
    ('wisa', 'Rajkot Civil Station'): ['Rajkot'], ('wisa', 'Rest of the Agency|C. Western Kathiawar Agency'): ['Bagasra', 'Jetpur'],
    ("wisa", "Malek Shri Joravarkhan's State (Varahi)"): ['Santalpur'], ('wisa', 'Rest of the Agency|D. Banaskantha Agency'): ['Deodar', 'Kankarej', 'Suigam', 'Wardhi'],
    ('travancore', 'Southern'): ['Travancore'], ('travancore', 'Central'): ['Travancore'], ('travancore', 'Northern'): ['Travancore'], ('travancore', 'High Range'): ['Travancore'],
    ('cochin', 'Cochin State'): ['Cochin'], ('ajmer', 'Ajmer-Merwara'): ['Ajmer Merwara'],
    ('andaman', 'Andamans'): ['@Andaman and Nicobar Islands'], ('andaman', 'Nicobars'): ['@Andaman and Nicobar Islands'],
}

def akey(s):
    return N.norm(re.sub(r'(?i)\b(district|state|agency)\b', '', re.sub(r'^\(\w+\)\s*', '', s or '')))

def build():
    import lineage
    G, info = lineage.build()
    units = collections.defaultdict(list)          # (div, akey) -> node
    for k, v in info.items():
        if v['year'] == 1931:
            units[(v['div'], akey(v['name']))].append(k)
    leaves, _ = N.build()
    areas = collections.OrderedDict()
    for l in leaves:
        if l['area_total']:
            continue
        areas.setdefault((l['vol'], tuple(l['area_path']), l['area']), None)
    xw, unmatched = {}, []
    for (vol, path, area) in areas:
        key = None
        for cand in [(vol, area + '|' + pe) for pe in reversed(path)] + [(vol, area)]:
            if cand in MANUAL:
                key = cand; break
        if key:
            nodes = []
            for nm in MANUAL[key]:
                if nm.startswith('@'):
                    nodes.append('@' + nm[1:]); continue
                name, _, div = nm.partition('|')
                divs = [div] if div else VOLDIV[vol]
                hit = [n for d in divs for n in units.get((d, akey(name)), [])]
                if not hit:
                    unmatched.append((vol, area, 'manual target missing: ' + nm))
                nodes += hit
            xw[(vol, path, area)] = nodes
            continue
        hit = [n for d in VOLDIV[vol] for n in units.get((d, akey(area)), [])]
        if len(hit) == 1:
            xw[(vol, path, area)] = hit
        else:
            xw[(vol, path, area)] = None
            unmatched.append((vol, area, f'{len(hit)} candidates'))
    return xw, unmatched, info

if __name__ == '__main__':
    xw, un, info = build()
    print(len(xw), 'areas;', sum(1 for v in xw.values() if v), 'matched')
    for u in un:
        print('  ', u)
    used = set(n for v in xw.values() if v for n in v)
    for vol, divs in VOLDIV.items():
        miss = sorted(info[k]['name'] for k, v in info.items() if v['year'] == 1931 and v.get('div') in divs and k not in used)
        if miss and vol not in ('travancore', 'cochin'):
            print('  lineage units with no regional area:', vol, miss)
