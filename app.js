/* Languages of India, 1931 — an SVG map of Census of India 1931, Imperial Table XV Part I.
 * Data: window.CENSUS (data/census.js), geometry: window.GEO (data/geo.js),
 * transcription checks: window.CHECKS (data/checks.js). No libraries. */
(function () {
  'use strict';
  var C = window.CENSUS, G = window.GEO;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var fmt = new Intl.NumberFormat('en-IN');           // lakh grouping, as the tables print
  var fmtW = new Intl.NumberFormat('en-GB');
  var useIndian = true;
  function num(n) { return n == null ? '–' : (useIndian ? fmt : fmtW).format(n); }
  function pct(x) {
    if (x == null || isNaN(x)) return '–';
    if (x === 0) return '0%';
    if (x < 0.01) return '<0.01%';
    if (x < 1) return x.toFixed(2) + '%';
    if (x < 10) return x.toFixed(1) + '%';
    return Math.round(x) + '%';
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------------------------------------------------------------- data model */
  var UNITS = C.units;                                   // code -> {name, short, type, pop}
  var MAP_UNITS = Object.keys(UNITS).filter(function (k) { return UNITS[k].type === 'prov' || UNITS[k].type === 'state'; });
  var SUBS = { '7': ['7a'], '27': ['27a', '27b', '27c'] };
  var L = C.langs;
  L.forEach(function (l) { l.v = l.v || {}; });
  var ROOTS = L.filter(function (l) { return l.parent == null; });
  var LEAVES = L.filter(function (l) { return !l.kids.length; });
  var GENERIC = /^(others?\b|other\b|.*unspecified|unclassed$|.*not stated|.*n\.o\.s)/i;
  function disp(l) {
    if (GENERIC.test(l.name) && l.parent != null) return l.name + ' (' + L[l.parent].name + ')';
    return l.name;
  }
  function pathOf(l) { var p = []; while (l) { p.unshift(l); l = l.parent != null ? L[l.parent] : null; } return p; }
  function persons(l, u) { var t = l.v[u]; return t ? (t[0] || 0) : 0; }
  function popOf(u) { var p = UNITS[u].pop; return p ? p[0] : 0; }
  // a stable key for links: the printed column number where it is unique, else the node id
  var colCount = {};
  L.forEach(function (l) { if (l.col) colCount[l.col] = (colCount[l.col] || 0) + 1; });
  function key(l) { return l.col && colCount[l.col] === 1 ? String(l.col) : 'g' + l.id; }
  function byKey(k) {
    if (!k) return null;
    if (/^g\d+$/.test(k)) return L[+k.slice(1)] || null;
    for (var i = 0; i < L.length; i++) if (String(L[i].col) === k) return L[i];
    return null;
  }
  // leaf rank by all-India speakers
  var leafRank = LEAVES.slice().sort(function (a, b) { return persons(b, 'INDIA') - persons(a, 'INDIA'); });
  leafRank.forEach(function (l, i) { l.rank = i + 1; });

  function leading(u) {
    var best = null, bv = -1;
    LEAVES.forEach(function (l) { var v = persons(l, u); if (v > bv) { bv = v; best = l; } });
    return { lang: best, n: bv, share: popOf(u) ? bv / popOf(u) * 100 : 0 };
  }
  // Diversity is computed within the census's own classification, at a chosen level:
  // the finest entries, or everything merged up to branch, sub-family or family.
  var DIV_LEVELS = { entry: 'language entries', branch: 'branches', subfamily: 'sub-families', family: 'families' };
  var DEPTH = { branch: 3, subfamily: 2, family: 1 };
  function levelNode(l, lev) {
    if (lev === 'entry') return l;
    var p = pathOf(l);
    return p[Math.min(DEPTH[lev], p.length - 1)];
  }
  function diversity(u, lev) {
    var agg = {}, tot = 0, s = 0;
    LEAVES.forEach(function (l) { var v = persons(l, u); if (v) { var k = levelNode(l, lev || 'entry').id; agg[k] = (agg[k] || 0) + v; tot += v; } });
    Object.keys(agg).forEach(function (k) { s += (agg[k] / tot) * (agg[k] / tot); });
    return tot ? 1 - s : null;
  }
  // units whose enumerated population is not comparable (figures describe garrisons, not the area)
  var NOT_COMPARABLE = { '29': 1 };
  var LEAD = {}, DIVS = { entry: {}, branch: {}, subfamily: {}, family: {} };
  MAP_UNITS.concat(['INDIA', '7a', '27a', '27b', '27c']).forEach(function (u) {
    LEAD[u] = leading(u);
    Object.keys(DIVS).forEach(function (lev) { DIVS[lev][u] = diversity(u, lev); });
  });
  var divLevel = 'entry', DIV = DIVS.entry;
  function divRank(lev) {
    var r = {}; MAP_UNITS.filter(function (u) { return !NOT_COMPARABLE[u]; })
      .sort(function (a, b) { return (DIVS[lev][b] || 0) - (DIVS[lev][a] || 0); }).forEach(function (u, i) { r[u] = i + 1; });
    return r;
  }

  /* ---------------------------------------------------------------- source flags */
  // ! printed inconsistency · ? illegible · Σ calculated (derived) · ≈ estimated / approximate
  function flagOf(l, u) { return l && l.f ? l.f[u] || null : null; }
  function mark(fl) {
    if (!fl) return '';
    return ' <span class="flag-m" tabindex="0" role="note" title="' + esc(fl[1]) + '" aria-label="' + esc(fl[1]) + '">' + esc(fl[0]) + '</span>';
  }
  var ESTIMATED = { '29': 'The agencies and tribal areas were not enumerated; only 46,451 people in posts and garrisons are counted.',
    '7': 'Excludes the estimated population of Ahmedabad (75,735), where the census was boycotted.',
    '8': 'Excludes the estimated population of East Manglun (19,649) and unadministered frontier tracts.' };

  /* ---------------------------------------------------------------- Part II: bilingualism */
  var BIL = window.BILINGUAL || [];
  var BIL_BY_LANG = {};
  BIL.forEach(function (e) { if (e.lang != null) BIL_BY_LANG[e.lang] = e; });
  function bilPct(e) { return e.bilingual != null && e.total ? e.bilingual / e.total * 100 : null; }
  function bilLink(e) { return 'https://archive.org/details/india.history.resource.92539/page/n' + e.leaf + '/mode/1up'; }

  /* ---------------------------------------------------------------- state */
  var state = { mode: 'lang', measure: 'share', lang: null, unit: null };
  function defaultLang() {
    return L.filter(function (l) { return l.name === 'Bengali'; })[0] || leafRank[0];
  }

  /* ---------------------------------------------------------------- scales */
  var SEQ = ['--s0', '--s1', '--s2', '--s3', '--s4', '--s5', '--s6'];
  var DIVG = ['--d-3', '--d-2', '--d-1', '--d0', '--d1', '--d2', '--d3'];
  var SCALES = {
    share: { cuts: [0.1, 1, 5, 15, 35, 65], vars: SEQ, ticks: ['>0', '0.1', '1', '5', '15', '35', '65%'], title: 'Speakers as % of the unit’s population' },
    dist: { cuts: [0.5, 2, 5, 10, 20, 40], vars: SEQ, ticks: ['>0', '0.5', '2', '5', '10', '20', '40%'], title: 'Share of all India’s speakers living in each unit' },
    sex: { cuts: [500, 800, 950, 1050, 1250, 2000], vars: DIVG, ticks: ['', '500', '800', '950', '1,050', '1,250', '2,000'], title: 'Female speakers per 1,000 male speakers' },
    lead: { cuts: [30, 40, 50, 65, 80, 90], vars: SEQ, ticks: ['', '30', '40', '50', '65', '80', '90%'], title: 'Largest language’s share of the population' },
    div: { cuts: [0.1, 0.2, 0.3, 0.45, 0.6, 0.75], vars: SEQ, ticks: ['0', '.1', '.2', '.3', '.45', '.6', '.75'], title: 'Diversity within the 1931 classification: chance two people fall in different categories' }
  };
  function bin(sc, v) { var i = 0; while (i < sc.cuts.length && v >= sc.cuts[i]) i++; return i; }
  function cssv(name) { return 'var(' + name + ')'; }
  var SEX_MIN = 200;   // too few speakers for a ratio to mean much

  /* ---------------------------------------------------------------- map build */
  var svg = $('#map'), vp = $('#viewport');
  var VB = G.viewBox.slice();
  var view = { x: VB[0], y: VB[1], w: VB[2], h: VB[3] };
  $('#sea').setAttribute('x', VB[0] - 2000); $('#sea').setAttribute('y', VB[1] - 2000);
  $('#sea').setAttribute('width', VB[2] + 4000); $('#sea').setAttribute('height', VB[3] + 4000);
  function el(tag, attrs, parent) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  var P = G.proj, R = P.pxPerDeg * 180 / Math.PI, YTOP = R * Math.log(Math.tan(Math.PI / 4 + P.latMax * Math.PI / 360));
  function fwd(lon, lat) { return [(lon - P.lon0) * P.pxPerDeg, YTOP - R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))]; }

  G.graticule.forEach(function (g) { el('path', { d: g.d, class: 'grat' }, $('#g-grat')); });
  G.neighbours.forEach(function (n) { el('path', { d: n.d, class: 'neigh' }, $('#g-neigh')); });
  var NEIGH_LABELS = [['Afghanistan', 66.5, 34.2], ['Persia', 60.9, 30.8], ['Nepal', 84.2, 28.2], ['Bhutan', 90.4, 27.4],
    ['Tibet', 88, 31.5], ['China', 99.5, 25.5], ['Siam', 100.2, 15.8], ['Ceylon', 80.7, 7.8], ['French Indo-China', 102.6, 20.2]];
  NEIGH_LABELS.forEach(function (n) {
    var p = fwd(n[1], n[2]); var t = el('text', { x: p[0], y: p[1], class: 'neigh-label' }, $('#g-neigh')); t.textContent = n[0];
  });
  var EXTRA_NAMES = {
    tribal_ne: 'North-east frontier tracts: largely unadministered, not enumerated (or only along the plains edge, counted in Assam)',
    goa: 'Portuguese India (Goa, Daman, Diu, Dadra and Nagar Haveli)',
    french: 'French India (Pondicherry, Karikal, Mahé, Yanam; Chandernagore is too small to draw)',
    gwadar: 'Gwadar: a possession of Muscat until 1958',
    rann: 'Rann of Kutch: salt waste, not counted in any unit’s area'
  };
  // Aden (part of Bombay in 1931) lies off the map to the west
  (function () {
    var p = fwd(60.9, 14.2), g = el('g', { class: 'aden-note' }, $('#g-neigh'));
    var t = el('text', { x: p[0], y: p[1], class: 'neigh-label', style: 'text-anchor:start' }, g);
    t.textContent = '← Aden (with Bombay)';
  })();
  Object.keys(G.extra).forEach(function (k) {
    var p = el('path', { d: G.extra[k].d, class: 'extra' }, $('#g-extra'));
    p.addEventListener('pointermove', function (ev) { showTip(ev, '<b>' + esc(EXTRA_NAMES[k] || k) + '</b><span class="m">Not a census unit in Table XV.</span>'); });
    p.addEventListener('pointerleave', hideTip);
  });
  var unitEls = {};
  MAP_UNITS.forEach(function (u) {
    var g = G.units[u]; if (!g) return;
    var p = el('path', { d: g.d, class: 'unit', tabindex: '0', role: 'button', 'aria-label': UNITS[u].name, 'data-u': u }, $('#g-units'));
    unitEls[u] = p;
    p.addEventListener('pointermove', function (ev) { if (!drag.moved) { hover(u); showTip(ev, tipHTML(u)); } });
    p.addEventListener('pointerleave', function () { hover(null); hideTip(); });
    p.addEventListener('click', function () { if (!drag.moved) selectUnit(u); });
    p.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); selectUnit(u); } });
    p.addEventListener('focus', function () {
      hover(u);
      var r = p.getBoundingClientRect();
      showTip({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }, tipHTML(u));
    });
    p.addEventListener('blur', function () { hover(null); hideTip(); });
  });
  // units whose figures do not describe the population of the area drawn
  var UNIT_NOTES = {
    '29': 'Only 46,451 people were enumerated here, 44,635 of them men: in effect the garrisons, posts and cantonments. ' +
          'The tribal population (estimated at 2,212,837) was not enumerated and is not in Table XV, so these figures describe troops and officials, not the tribes.',
    '7': 'Includes Aden (51,478 people, shown separately below). Sind was part of Bombay in 1931. The estimated population of Ahmedabad city (75,735), where the census was boycotted, is not in Table XV.',
    '8': 'Burma was part of British India until 1937. The map draws modern Myanmar’s outline. The census area (233,492 sq. mi) left out unadministered tracts on the northern frontier, and the 19,649 people estimated for East Manglun (Shan States) are not in Table XV.',
    '3': 'The hatched frontier tracts to the north and east were largely unadministered and not enumerated.',
    '35': 'Kathiawar, Cutch and the Palanpur agency, as constituted in 1931. The Rann of Kutch (hatched) is not counted in the area.'
  };
  Object.keys(UNIT_NOTES).forEach(function (u) {
    if (u === '29' && G.units[u]) el('path', { d: G.units[u].d, class: 'over-hatch' }, $('#g-units'));
  });
  var hovered = null;
  function hover(u) {
    if (hovered && unitEls[hovered]) unitEls[hovered].classList.remove('hover');
    hovered = u;
    if (u && unitEls[u]) { unitEls[u].classList.add('hover'); unitEls[u].parentNode.appendChild(unitEls[u]); }
    if (state.unit && unitEls[state.unit]) unitEls[state.unit].parentNode.appendChild(unitEls[state.unit]);
    [].forEach.call(document.querySelectorAll('.over-hatch'), function (o) { o.parentNode.appendChild(o); });
  }
  if (G.modern) el('path', { d: G.modern, class: 'modern' }, $('#g-modern'));
  G.cities.forEach(function (c) {
    var g = el('g', { class: 'city' }, $('#g-cities'));
    el('circle', { cx: c.x, cy: c.y, r: 2.2 }, g);
    var t = el('text', { x: c.x + 4, y: c.y - 3 }, g); t.textContent = c.n;
  });

  // label anchors: generated representative points, with hand placement where a
  // unit is scattered or its largest piece is not where a reader looks for it.
  var LABEL_AT = { '21': [74.3, 17.1], '31': [75.9, 30.1], '30': [77.4, 31.3], '4': [67.6, 30.4], '17': [65.3, 27.6],
    '13': [72.0, 33.0], '29': [70.8, 34.9], '35': [70.6, 22.3], '22': [78.4, 24.3], '23': [83.2, 20.2], '20': [84.9, 21.6],
    '19': [91.3, 23.8], '16': [93.9, 24.7], '34': [78.9, 30.4], '27': [76.7, 9.3], '18': [73.1, 22.3], '1': [74.6, 26.2],
    '11': [77.2, 28.6], '10': [75.8, 12.4], '33': [88.5, 27.6], '2': [92.8, 11.8], '8': [96.0, 21.0], '3': [92.6, 26.5],
    '26': [75.8, 34.2], '14': [73.4, 31.0], '32': [73.6, 26.5], '24': [77.8, 25.4], '12': [79.3, 14.0], '25': [78.3, 17.8],
    '28': [76.4, 13.4], '9': [79.3, 21.4], '6': [85.7, 24.6], '5': [89.2, 23.6], '15': [80.8, 27.0], '7': [74.6, 19.5] };
  var SMALL = { '11': 1, '1': 1, '10': 1, '33': 1, '34': 1, '30': 1, '18': 1, '19': 1, '2': 1, '16': 1 };
  function anchor(u) {
    if (LABEL_AT[u]) return fwd(LABEL_AT[u][0], LABEL_AT[u][1]);
    return [G.units[u].lx, G.units[u].ly];
  }

  /* ---------------------------------------------------------------- view (pan/zoom) */
  function applyView() {
    svg.setAttribute('viewBox', view.x + ' ' + view.y + ' ' + view.w + ' ' + view.h);
    var k = VB[2] / view.w;   // zoom factor: keep text a constant screen size
    var s = 1 / Math.sqrt(k);
    document.documentElement.style.setProperty('--lab-scale', s);
    [].forEach.call(document.querySelectorAll('#g-labels text, #g-cities text, .neigh-label'), function (t) {
      t.style.fontSize = '';
    });
    $('#g-labels').setAttribute('data-k', k.toFixed(2));
    scaleText(k);
  }
  function scaleText(k) {
    var f = 1 / k;
    [].forEach.call(document.querySelectorAll('#g-labels text'), function (t) {
      var base = t.classList.contains('small') ? 10 : 11.5;
      t.setAttribute('font-size', (base * f * pxPerUnit()).toFixed(2));
    });
    [].forEach.call(document.querySelectorAll('#g-cities text'), function (t) { t.setAttribute('font-size', (10.5 * f * pxPerUnit()).toFixed(2)); });
    [].forEach.call(document.querySelectorAll('#g-cities circle'), function (c) { c.setAttribute('r', (2.4 * f * pxPerUnit()).toFixed(2)); });
    [].forEach.call(document.querySelectorAll('.neigh-label'), function (t) { t.setAttribute('font-size', (11 * f * pxPerUnit()).toFixed(2)); });
    declutter();
  }
  // hide labels that collide with a label of a more populous unit
  function declutter() {
    var labs = [].slice.call(document.querySelectorAll('#g-labels text'));
    labs.sort(function (a, b) { return (+b.getAttribute('data-pri')) - (+a.getAttribute('data-pri')); });
    var kept = [];
    // city names (when shown) are fixed obstacles: value labels move out of their way
    if (stage.classList.contains('show-cities')) {
      [].forEach.call(document.querySelectorAll('#g-cities text, #g-cities circle'), function (c) { try { kept.push(c.getBBox()); } catch (e) { } });
    }
    function hits(b, pad) { return kept.some(function (k) { return b.x < k.x + k.width + pad && k.x < b.x + b.width + pad && b.y < k.y + k.height + pad && k.y < b.y + b.height + pad; }); }
    labs.forEach(function (t) {
      t.style.display = '';
      var y0 = t.getAttribute('data-y0') || t.getAttribute('y');
      t.setAttribute('data-y0', y0); t.setAttribute('y', y0);
      [].forEach.call(t.querySelectorAll('tspan'), function (ts) { ts.setAttribute('dy', '1.15em'); });
      var b; try { b = t.getBBox(); } catch (e) { return; }
      var pad = b.height * 0.08, placed = false;
      [0, -1.05, 1.05, -2.1, 2.1].some(function (m) {
        var bb = { x: b.x, y: b.y + m * b.height, width: b.width, height: b.height };
        if (!hits(bb, pad)) { t.setAttribute('y', +y0 + m * b.height); kept.push(bb); placed = true; return true; }
        return false;
      });
      if (!placed) t.style.display = 'none';
    });
  }
  // svg user units per screen pixel at zoom 1
  function pxPerUnit() {
    var r = svg.getBoundingClientRect();
    if (!r.width) return 1;
    return Math.max(VB[2] / r.width, VB[3] / r.height);
  }
  function clampView() {
    var minW = VB[2] / 12;
    if (view.w < minW) { var c = [view.x + view.w / 2, view.y + view.h / 2]; view.h *= minW / view.w; view.w = minW; view.x = c[0] - view.w / 2; view.y = c[1] - view.h / 2; }
    if (view.w > VB[2] * 1.4) { view.h *= VB[2] * 1.4 / view.w; view.w = VB[2] * 1.4; }
    view.x = Math.min(Math.max(view.x, VB[0] - view.w * 0.5), VB[0] + VB[2] - view.w * 0.5);
    view.y = Math.min(Math.max(view.y, VB[1] - view.h * 0.5), VB[1] + VB[3] - view.h * 0.5);
  }
  function zoomAt(f, cx, cy) {
    view.x = cx - (cx - view.x) / f; view.y = cy - (cy - view.y) / f; view.w /= f; view.h /= f;
    clampView(); applyView();
  }
  function toSvg(ev) {
    var r = svg.getBoundingClientRect();
    var s = Math.max(view.w / r.width, view.h / r.height);
    var ox = (r.width * s - view.w) / 2, oy = (r.height * s - view.h) / 2;
    return [view.x - ox + (ev.clientX - r.left) * s, view.y - oy + (ev.clientY - r.top) * s];
  }
  svg.addEventListener('wheel', function (ev) {
    ev.preventDefault();
    var p = toSvg(ev); zoomAt(Math.exp(-ev.deltaY * (ev.deltaMode ? 0.05 : 0.0018)), p[0], p[1]);
  }, { passive: false });
  var drag = { on: false, moved: false, pts: {} };
  svg.addEventListener('pointerdown', function (ev) {
    drag.pts[ev.pointerId] = [ev.clientX, ev.clientY];
    drag.on = true; drag.moved = false; drag.start = [ev.clientX, ev.clientY]; drag.view = Object.assign({}, view);
    if (Object.keys(drag.pts).length === 2) {
      var a = Object.values(drag.pts); drag.d0 = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); drag.view = Object.assign({}, view);
      drag.mid = toSvg({ clientX: (a[0][0] + a[1][0]) / 2, clientY: (a[0][1] + a[1][1]) / 2 });
    }
  });
  window.addEventListener('pointermove', function (ev) {
    if (!drag.on || !drag.pts[ev.pointerId]) return;
    drag.pts[ev.pointerId] = [ev.clientX, ev.clientY];
    var ids = Object.keys(drag.pts);
    var r = svg.getBoundingClientRect();
    if (ids.length === 2) {
      var a = Object.values(drag.pts), d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]);
      var f = d / drag.d0; view = Object.assign({}, drag.view);
      zoomAt(f, drag.mid[0], drag.mid[1]); drag.moved = true; return;
    }
    var dx = ev.clientX - drag.start[0], dy = ev.clientY - drag.start[1];
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    if (!drag.moved) { svg.classList.add('dragging'); hideTip(); }
    drag.moved = true;
    var s = Math.max(drag.view.w / r.width, drag.view.h / r.height);
    view.x = drag.view.x - dx * s; view.y = drag.view.y - dy * s; clampView(); applyView();
  });
  function endDrag(ev) {
    delete drag.pts[ev.pointerId];
    if (!Object.keys(drag.pts).length) { drag.on = false; svg.classList.remove('dragging'); setTimeout(function () { drag.moved = false; }, 0); }
  }
  window.addEventListener('pointerup', endDrag); window.addEventListener('pointercancel', endDrag);
  $('#zoom').addEventListener('click', function (ev) {
    var z = ev.target.getAttribute('data-z'); if (!z) return;
    var cx = view.x + view.w / 2, cy = view.y + view.h / 2;
    if (z === 'in') zoomAt(1.5, cx, cy); else if (z === 'out') zoomAt(1 / 1.5, cx, cy);
    else { view = { x: VB[0], y: VB[1], w: VB[2], h: VB[3] }; applyView(); }
  });
  window.addEventListener('resize', function () { applyView(); });

  /* ---------------------------------------------------------------- tooltip */
  var tip = $('#tooltip'), stage = $('#stage');
  function showTip(ev, html) {
    tip.innerHTML = html; tip.hidden = false;
    var r = stage.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    var x = ev.clientX - r.left + 14, y = ev.clientY - r.top + 14;
    if (x + tw > r.width - 6) x = ev.clientX - r.left - tw - 14;
    if (y + th > r.height - 6) y = ev.clientY - r.top - th - 14;
    tip.style.left = Math.max(6, x) + 'px'; tip.style.top = Math.max(6, y) + 'px';
  }
  function hideTip() { tip.hidden = true; }
  function tipHTML(u) {
    var U = UNITS[u], h = '<b>' + esc(U.name) + '</b>';
    if (state.mode === 'lang') {
      var l = state.lang, t = l.v[u];
      var n = t ? t[0] : 0;
      h += '<span class="m">' + esc(disp(l)) + '</span><br>';
      var fl = flagOf(l, u);
      if (state.measure === 'share') h += '<span class="big">' + pct(n / popOf(u) * 100) + '</span> <span class="m">of ' + num(popOf(u)) + '</span><br>' + num(n) + ' speakers';
      else if (state.measure === 'count') h += '<span class="big">' + num(n) + '</span> speakers<br><span class="m">' + pct(n / popOf(u) * 100) + ' of the population</span>';
      else if (state.measure === 'dist') h += '<span class="big">' + pct(n / persons(l, 'INDIA') * 100) + '</span> <span class="m">of all speakers in India</span><br>' + num(n) + ' speakers';
      else {
        if (n < SEX_MIN) h += '<span class="m">' + num(n) + ' speakers: too few for a ratio</span>';
        else h += '<span class="big">' + fmtW.format(Math.round(t[2] / t[1] * 1000)) + '</span> females per 1,000 males<br><span class="m">' + num(t[1]) + ' m · ' + num(t[2]) + ' f</span>';
      }
      if (fl) h += '<br><span class="m warn">' + esc(fl[0] + ' ' + fl[1]) + '</span>';
    } else if (state.mode === 'lead') {
      var d = LEAD[u];
      h += '<span class="big">' + esc(disp(d.lang)) + '</span><br>' + pct(d.share) + ' · ' + num(d.n) + ' speakers';
      var second = topLangs(u, 2)[1];
      if (second) h += '<br><span class="m">next: ' + esc(disp(second.l)) + ' ' + pct(second.n / popOf(u) * 100) + '</span>';
    } else {
      if (NOT_COMPARABLE[u]) h += '<span class="m">Not comparable: excluded from the ranking</span><br>';
      h += '<span class="big">' + (DIV[u] == null ? '–' : DIV[u].toFixed(2)) + '</span> diversity across ' + DIV_LEVELS[divLevel] + '<br><span class="m">largest: ' + esc(disp(LEAD[u].lang)) + ' ' + pct(LEAD[u].share) + '</span>';
    }
    if (UNIT_NOTES[u] && u === '29') h += '<br><span class="m warn">≈ Enumerated population only 46,451 (troops and posts). Not the tribal population.</span>';
    if (UNITS[u].flag) h += '<br><span class="m warn">' + esc(UNITS[u].flag[0] + ' Population row: ' + UNITS[u].flag[1]) + '</span>';
    return h + '<br><span class="m">Click or press Enter for the unit’s languages</span>';
  }

  /* ---------------------------------------------------------------- render */
  function valueFor(u) {
    var l = state.lang;
    if (state.mode === 'lead') return LEAD[u].share;
    if (state.mode === 'div') return DIV[u];
    var t = l.v[u], n = t ? t[0] : 0;
    if (state.measure === 'share') return n ? n / popOf(u) * 100 : 0;
    if (state.measure === 'dist') return n ? n / persons(l, 'INDIA') * 100 : 0;
    if (state.measure === 'sex') return n >= SEX_MIN && t[1] ? t[2] / t[1] * 1000 : null;
    return n;
  }
  function scaleKey() { return state.mode === 'lang' ? state.measure : state.mode; }
  function render() {
    var sk = scaleKey(), sc = SCALES[sk];
    var gC = $('#g-circles'); gC.textContent = '';
    var gL = $('#g-labels'); gL.textContent = '';
    var maxN = 0;
    if (sk === 'count') MAP_UNITS.forEach(function (u) { maxN = Math.max(maxN, persons(state.lang, u)); });
    var RMAX = 34;
    MAP_UNITS.forEach(function (u) {
      var p = unitEls[u]; if (!p) return;
      var v = valueFor(u);
      p.classList.remove('zero'); p.style.fill = '';
      if (sk === 'count') {
        p.classList.add('zero');
        if (v > 0) {
          var a = anchor(u);
          el('circle', { cx: a[0], cy: a[1], r: Math.max(1.2, Math.sqrt(v / maxN) * RMAX), class: 'circle' }, gC);
        }
      } else if (sk === 'div' && NOT_COMPARABLE[u]) {
        p.style.fill = 'url(#hatch)';
      } else if (sk === 'sex') {
        if (v == null) p.style.fill = 'url(#hatch)';
        else p.style.fill = cssv(sc.vars[bin(sc, v)]);
      } else if (v == null || v === 0) {
        p.classList.add('zero');
      } else {
        p.style.fill = cssv(sc.vars[bin(sc, v)]);
      }
      // labels
      var a2 = anchor(u), txt = null, sub = null;
      if (state.mode === 'lead') { txt = shortName(LEAD[u].lang); sub = pct(LEAD[u].share); }
      else if (state.mode === 'div') { txt = DIV[u] == null || NOT_COMPARABLE[u] ? null : DIV[u].toFixed(2); }
      else if (sk === 'share' || sk === 'dist') { if (v > 0) txt = pct(v); }
      else if (sk === 'count') { if (v > 0 && v / maxN > 0.02) txt = compact(v); }
      else if (sk === 'sex') { if (v != null) txt = fmtW.format(Math.round(v)); }
      p.setAttribute('aria-label', UNITS[u].name + ': ' + (txt ? txt + (sub ? ' ' + sub : '') : 'no value') + (state.mode === 'lang' ? ' (' + disp(state.lang) + ')' : state.mode === 'div' ? ' (diversity)' : ''));
      if (txt) {
        var t = el('text', { x: a2[0], y: a2[1] + (sk === 'count' ? 0 : 3), class: 'label' + (SMALL[u] ? ' small' : ''), 'data-pri': popOf(u) }, gL);
        t.textContent = txt;
        if (sub) { var ts = el('tspan', { x: a2[0], dy: '1.15em', class: 'v' }, t); ts.textContent = sub; }
      }
    });
    // provinces from which the language's Part II returns came
    var gB = $('#g-bil'); gB.textContent = '';
    var be = state.mode === 'lang' ? BIL_BY_LANG[state.lang.id] : null;
    if (be) be.units.forEach(function (u) {
      var mu = u === '27a' || u === '27b' ? '27' : u;
      if (G.units[mu]) el('path', { d: G.units[mu].d, class: 'bil-area' }, gB);
    });
    if (state.unit && unitEls[state.unit]) unitEls[state.unit].classList.add('sel');
    applyView();
    renderLegend(sk, sc, maxN, RMAX);
    renderSummary();
    renderUnit();
    renderTable();
    var live = $('#map-title-live');
    if (state.mode === 'lang') live.textContent = disp(state.lang) + ' — ' + { share: '% of population', count: 'number of speakers', dist: 'where its speakers lived', sex: 'females per 1,000 males' }[state.measure];
    else live.textContent = state.mode === 'lead' ? 'Largest mother tongue in each unit' : 'Diversity within the 1931 classification (' + DIV_LEVELS[divLevel] + ')';
    writeHash();
  }
  function compact(n) { return n >= 1e7 ? (n / 1e7).toFixed(n >= 1e8 ? 0 : 1) + ' cr' : n >= 1e5 ? (n / 1e5).toFixed(n >= 1e6 ? 0 : 1) + ' lakh' : n >= 1000 ? Math.round(n / 1000) + 'k' : String(n); }
  function shortName(l) {
    var n = disp(l);
    return n.replace(/ \(.*\)$/, '').replace(/^Kanarese$/, 'Kanarese').replace(/ or .*$/, '');
  }

  function renderLegend(sk, sc, maxN, RMAX) {
    var h = '<div class="ttl">' + esc(sk === 'count' ? 'Number of speakers (circle area)' : sc.title) + '</div>';
    if (sk === 'count') {
      var steps = niceSteps(maxN), k = VB[2] / view.w / pxPerUnit();   // svg units -> screen px
      var rs = steps.map(function (v) { return Math.max(1.5, Math.sqrt(v / maxN) * RMAX * k); });
      var hh = rs[0] * 2 + 4, x = 4, s = '';
      steps.forEach(function (v, i) {
        var r = rs[i], cell = Math.max(2 * r, 54);
        s += '<circle cx="' + (x + cell / 2) + '" cy="' + (hh - r) + '" r="' + r + '" class="circle" style="fill-opacity:.55"></circle>';
        s += '<text x="' + (x + cell / 2) + '" y="' + (hh + 14) + '" text-anchor="middle" font-size="11.5" fill="currentColor">' + compact(v) + '</text>';
        x += cell + 12;
      });
      s = '<svg width="' + x + '" height="' + (hh + 18) + '" aria-hidden="true">' + s;
      h += s + '</svg><div class="note">1 lakh = 100,000 · 1 crore (cr) = 10 million</div>';
    } else {
      h += '<div class="bins">' + sc.vars.map(function (v) { return '<span style="background:' + cssv(v) + '"></span>'; }).join('') + '</div>';
      h += '<div class="ticks">' + sc.ticks.map(function (t) { return '<span>' + t + '</span>'; }).join('') + '</div>';
      if (sk === 'share' || sk === 'dist') h += '<div class="row"><span class="sw" style="background:var(--land)"></span> none recorded</div>';
      if (sk === 'sex') h += '<div class="row"><span class="sw hatch"></span> fewer than ' + SEX_MIN + ' speakers</div><div class="note">Blue: mostly men (often migrants). Red: mostly women. All India overall: ' + Math.round(UNITS.INDIA.pop[2] / UNITS.INDIA.pop[1] * 1000) + '.</div>';
      if (sk === 'div') h += '<div class="note">1 − Σp² over the table’s ' + DIV_LEVELS[divLevel] + '. 0 = everyone in one category. It depends on how finely the census divided languages, so the level changes the ranking.</div><div class="row"><span class="sw hatch"></span> not comparable (garrisons only)</div>';
    }
    h += '<div class="row"><span class="sw hatch"></span> not enumerated / not a census unit</div>';
    h += '<div class="note symbols">Source marks: <b>!</b> printed inconsistency · <b>?</b> illegible · <b>Σ</b> calculated · <b>≈</b> estimated or approximate</div>';
    if (state.mode === 'lang' && BIL_BY_LANG[state.lang.id]) h += '<div class="row"><span class="sw dash"></span> provinces with second-language returns</div>';
    $('#legend').innerHTML = h;
  }
  function niceSteps(max) {
    var out = [], e = Math.pow(10, Math.floor(Math.log10(max)));
    [e, e / 10, e / 100].forEach(function (v) { if (v >= 1 && v <= max) out.push(v); });
    if (max / e >= 5) out.unshift(5 * e);
    return out.slice(0, 3);
  }

  function crumbs(l) {
    var p = pathOf(l).slice(0, -1);
    if (!p.length) return '';
    return '<div class="crumbs">' + p.map(function (a) { return '<button type="button" data-lang="' + key(a) + '">' + esc(a.name) + '</button>'; }).join(' › ') + '</div>';
  }
  function iaLink(l) {
    if (!l.leaf) return '';
    return 'https://archive.org/details/india.history.resource.92539/page/n' + l.leaf + '/mode/1up';
  }
  function renderSummary() {
    var box = $('#summary');
    if (state.mode !== 'lang') {
      if (state.mode === 'div') { box.innerHTML = divSummary(); return; }
      var rows = MAP_UNITS.slice().sort(function (a, b) { return state.mode === 'lead' ? LEAD[b].share - LEAD[a].share : (DIV[b] || 0) - (DIV[a] || 0); });
      var h = state.mode === 'lead'
        ? '<h2>Largest mother tongue</h2><p class="cite">Each unit is labelled with the language returned by the most people, and shaded by that language’s share. Ranking uses the finest entries in the table (e.g. Western Hindi, Bengali), not families.</p>'
        : '<h2>Linguistic diversity</h2><p class="cite">The probability that two people drawn at random from a unit returned different mother tongues (Greenberg’s index), computed over the table’s finest entries. The split between Western Hindi, Eastern Hindi and Bihari was made by locality (see Cautions), so it can make areas look more or less diverse than they were.</p>';
      h += '<ul class="bars">' + rows.slice(0, 12).map(function (u) {
        var val = state.mode === 'lead' ? LEAD[u].share : (DIV[u] || 0) * 100;
        var lab = state.mode === 'lead' ? esc(disp(LEAD[u].lang)) + ' · ' + pct(LEAD[u].share) : (DIV[u] || 0).toFixed(2);
        return '<li data-unit="' + u + '"><span class="nm">' + esc(UNITS[u].short) + '</span><span class="val">' + lab + '</span><span class="track"><span class="fill" style="width:' + val + '%"></span></span></li>';
      }).join('') + '</ul><p class="cite">Showing 12 of ' + MAP_UNITS.length + ' units. The full list is in the table under the map.</p>';
      box.innerHTML = h; return;
    }
    var l = state.lang, t = l.v.INDIA || [0, 0, 0];
    var h2 = crumbs(l) + '<h2>' + esc(disp(l)) + '</h2>';
    h2 += '<div class="stat"><div><b>' + num(t[0]) + mark(flagOf(l, 'INDIA')) + '</b><span>speakers in India</span></div><div><b>' + pct(t[0] / popOf('INDIA') * 100) + '</b><span>of the population</span></div>';
    if (!l.kids.length) h2 += '<div><b>#' + l.rank + '</b><span>of ' + LEAVES.length + ' entries</span></div>';
    h2 += '</div><div class="cite">' + num(t[1]) + ' males · ' + num(t[2]) + ' females';
    if (t[1]) h2 += ' · ' + fmtW.format(Math.round(t[2] / t[1] * 1000)) + ' females per 1,000 males';
    h2 += '</div>';
    if (l.computed) h2 += '<div class="note-box">The printed table gives no total for this group. The figures here are the sum of its members.</div>';
    if (l.note) h2 += '<div class="note-box">Transcription note: ' + esc(l.note) + '</div>';
    if (l.col) h2 += '<div class="cite">Source: Table XV Part I, cols. ' + l.col + '–' + (l.col + 2) + ', printed p. ' + (l.page || '?') + ' · <a href="' + iaLink(l) + '" target="_blank" rel="noopener">view page scan ↗</a></div>';
    h2 += '<div class="cite"><a href="data.html#q=' + encodeURIComponent(l.name) + '&level=all">All figures for ' + esc(disp(l)) + ' in the table browser →</a></div>';
    var be = BIL_BY_LANG[l.id];
    if (be) h2 += bilBlock(be);
    if (l.kids.length) {
      var kids = l.kids.map(function (i) { return L[i]; }).sort(function (a, b) { return persons(b, 'INDIA') - persons(a, 'INDIA'); });
      var mx = persons(kids[0], 'INDIA') || 1;
      h2 += '<div class="kids"><span class="lbl">Members</span><ul class="bars">' + kids.map(function (k) {
        var n = persons(k, 'INDIA');
        return '<li data-lang="' + key(k) + '"><span class="nm">' + esc(disp(k)) + (k.kids.length ? ' ›' : '') + '</span><span class="val">' + num(n) + '</span><span class="track"><span class="fill" style="width:' + (n / mx * 100) + '%"></span></span></li>';
      }).join('') + '</ul></div>';
    }
    box.innerHTML = h2;
  }

  function divSummary() {
    var levs = ['entry', 'branch', 'subfamily', 'family'], ranks = {};
    levs.forEach(function (lv) { ranks[lv] = divRank(lv); });
    var rows = MAP_UNITS.filter(function (u) { return !NOT_COMPARABLE[u]; }).sort(function (a, b) { return ranks[divLevel][a] - ranks[divLevel][b]; });
    var h = '<h2>Diversity within the 1931 classification</h2><p class="cite">The chance that two people drawn at random from a unit fall in different categories of the census’s classification (Greenberg’s index, 1 − Σp²). It measures the <i>classification</i> as much as the population. Where the census split speech finely, a unit looks diverse. Where it merged speech, as when the United Provinces’ Hindustani was all classed Western Hindi, a unit looks uniform. Change the level to see how stable a unit’s rank is. The NWFP Agencies &amp; Tribal Areas are left out, because their 46,451 enumerated people were mostly garrisons.</p>';
    h += '<table class="data sens"><caption class="cite" style="text-align:left">Rank of each unit at each level (1 = most diverse). Large moves are highlighted.</caption><thead><tr><th scope="col">Unit</th>' + levs.map(function (lv) { return '<th scope="col"' + (lv === divLevel ? ' class="cur"' : '') + '>' + DIV_LEVELS[lv].replace('language ', '') + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (u) {
      var r0 = ranks[divLevel][u];
      h += '<tr data-unit="' + u + '" tabindex="0" role="button"><td>' + esc(UNITS[u].short) + '</td>' + levs.map(function (lv) {
        var r = ranks[lv][u], big = Math.abs(r - r0) >= 6;
        return '<td class="' + (lv === divLevel ? 'cur' : '') + (big ? ' moved' : '') + '" title="index ' + (DIVS[lv][u] == null ? '–' : DIVS[lv][u].toFixed(2)) + '">' + r + '</td>';
      }).join('') + '</tr>';
    });
    return h + '</tbody></table>';
  }

  function bilBlock(e) {
    var p = bilPct(e), subs = e.subs.slice().sort(function (a, b) { return (b.n || 0) - (a.n || 0); });
    var mx = subs.length ? (subs[0].n || 1) : 1, shown = subs.slice(0, 8);
    var h = '<div class="bil-block"><span class="lbl">Second languages (Table XV Part II)</span>';
    h += '<div class="stat"><div><b>' + pct(p) + '</b><span>returned a second language</span></div><div><b>' + num(e.bilingual) + '</b><span>of ' + num(e.total) + ' speakers</span></div></div>';
    if (e.coverage != null) {
      h += '<div class="coverage"><span class="lbl">Coverage</span><div class="cov-track" role="img" aria-label="Covers ' + e.coverage + '% of all-India speakers"><span style="width:' + Math.min(100, e.coverage) + '%"></span></div>';
      h += '<div class="cite">Part II covers <b>' + num(e.total) + '</b> of the <b>' + num(e.india) + '</b> ' + esc(e.mt) + ' speakers in Part I (<b>' + e.coverage + '%</b>). Returns come from ' + esc(e.areas.join(', ')) + ' only (dashed on the map).';
      if (e.omitted && e.omitted.length) h += ' Not covered: ' + e.omitted.slice(0, 6).map(function (o) { return esc(o[1]) + ' (' + fmtW.format(o[2]) + ')'; }).join(', ') + (e.omitted.length > 6 ? '…' : '') + '.';
      h += '</div>' + (e.coverage < 50 ? '<div class="note-box">≈ Under half of this language’s speakers are covered. Don’t read these shares as the language’s overall bilingualism.</div>' : '') + '</div>';
    } else {
      h += '<div class="cite">Returns from ' + esc(e.areas.join(', ')) + ' only (dashed on the map).</div>';
    }
    h += '<div class="cite">' + (e.diff ? '<b>!</b> Breakdown does not reconcile with the printed total (see below).' : '✓ Breakdown reconciles with the printed total.') + '</div>';
    h += '<ul class="bars">' + shown.map(function (x) {
      return '<li class="static"><span class="nm">' + esc(x.name) + '</span><span class="val">' + (x.n == null ? '?' : num(x.n)) + (e.total && x.n ? ' · ' + pct(x.n / e.total * 100) : '') + '</span><span class="track"><span class="fill alt" style="width:' + ((x.n || 0) / mx * 100) + '%"></span></span></li>';
    }).join('') + '</ul>';
    if (subs.length > shown.length) h += '<div class="cite">…and ' + (subs.length - shown.length) + ' more: ' + esc(subs.slice(8).map(function (x) { return x.name + ' (' + (x.n == null ? '?' : fmtW.format(x.n)) + ')'; }).join(', ')) + '</div>';
    if (e.diff) h += '<div class="note-box">In the print, these counts add up to ' + num(e.sum) + ', not the ' + num(e.bilingual) + ' given as the total (a difference of ' + (e.diff > 0 ? '+' : '') + fmtW.format(e.diff) + '). Both are shown as printed.</div>';
    if (e.note) h += '<div class="cite">Transcription note: ' + esc(e.note) + '</div>';
    h += '<div class="cite">Source: Table XV Part II, printed p. ' + e.page + ' · <a href="' + bilLink(e) + '" target="_blank" rel="noopener">view page scan ↗</a> · <a href="#bilingual">all second languages</a></div></div>';
    return h;
  }

  function topLangs(u, n, level) {
    var pool = level === 'fam' ? famPool() : LEAVES;
    return pool.map(function (l) { return { l: l, n: persons(l, u) }; })
      .filter(function (x) { return x.n > 0; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, n);
  }
  function famPool() {
    // families: children of each section root (or the roots themselves if they are families)
    var out = [];
    ROOTS.forEach(function (r) { if (/^[ABC]\./.test(r.name)) r.kids.forEach(function (i) { out.push(L[i]); }); else out.push(r); });
    return out;
  }
  var unitLevel = 'lang', unitAll = false;
  function renderUnit() {
    var box = $('#unit-panel'), u = state.unit;
    if (!u) { box.hidden = true; return; }
    box.hidden = false;
    var U = UNITS[u], p = U.pop || [0, 0, 0];
    var h = '<button type="button" class="close" aria-label="Close">×</button><h2>' + esc(U.name) + '</h2>';
    h += '<div class="cite">' + (U.type === 'prov' ? 'Province' : 'State or agency') + ' · population ' + num(p[0]) + ' (' + num(p[1]) + ' m, ' + num(p[2]) + ' f)' + mark(U.flag) + (ESTIMATED[u] ? mark(['≈', ESTIMATED[u]]) : '') + '</div>';
    h += '<div class="cite"><a href="data.html#unit=' + u + '">Every language returned in ' + esc(U.short) + ' →</a></div>';
    if (UNIT_NOTES[u]) h += '<div class="note-box">' + esc(UNIT_NOTES[u]) + '</div>';
    h += '<div class="stat"><div><b>' + (DIV[u] == null ? '–' : DIV[u].toFixed(2)) + '</b><span>diversity (' + DIV_LEVELS[divLevel] + ')</span></div><div><b>' + countLangs(u) + '</b><span>entries with speakers</span></div></div>';
    h += '<div class="seg small" role="radiogroup" aria-label="Level" style="margin:6px 0"><button type="button" role="radio" data-level="lang" aria-checked="' + (unitLevel === 'lang') + '">Languages</button><button type="button" role="radio" data-level="fam" aria-checked="' + (unitLevel === 'fam') + '">Families</button></div>';
    var list = topLangs(u, unitAll ? 999 : 12, unitLevel), mx = list.length ? list[0].n : 1;
    h += '<ul class="bars">' + list.map(function (x) {
      return '<li data-lang="' + key(x.l) + '" class="' + (state.mode === 'lang' && state.lang === x.l ? 'on' : '') + '"><span class="nm">' + esc(disp(x.l)) + '</span><span class="val">' + num(x.n) + mark(flagOf(x.l, u)) + ' · ' + pct(x.n / p[0] * 100) + '</span><span class="track"><span class="fill" style="width:' + (x.n / mx * 100) + '%"></span></span></li>';
    }).join('') + '</ul>';
    var total = unitLevel === 'fam' ? famPool().length : countLangs(u);
    if (total > 12) h += '<button type="button" class="linkish" data-all="1">' + (unitAll ? 'Show top 12' : 'Show all ' + total) + '</button>';
    if (SUBS[u]) {
      h += '<div class="subunits"><span class="lbl">Printed separately inside this row</span>';
      SUBS[u].forEach(function (s) {
        var sp = UNITS[s].pop || [0], ld = LEAD[s];
        h += '<div><b>' + esc(UNITS[s].name) + '</b>: ' + num(sp[0]) + ' people; largest ' + (ld && ld.lang ? esc(disp(ld.lang)) + ' ' + pct(ld.share) : '–');
        if (state.mode === 'lang') { var n = persons(state.lang, s); h += '; ' + esc(disp(state.lang)) + ' ' + num(n); }
        h += '</div>';
      });
      h += '</div>';
    }
    box.innerHTML = h;
  }
  function countLangs(u) { var c = 0; LEAVES.forEach(function (l) { if (persons(l, u)) c++; }); return c; }

  /* ---------------------------------------------------------------- table */
  var sortCol = null, sortDir = -1;
  function renderTable() {
    var host = $('#table-host'), rows = [], head;
    var order = Object.keys(UNITS);
    if (state.mode === 'lang') {
      var l = state.lang;
      head = ['Unit', 'Persons', 'Males', 'Females', '% of population', '% of India’s speakers'];
      order.forEach(function (u) {
        var t = l.v[u] || [0, 0, 0];
        rows.push({ u: u, cells: [UNITS[u].name, t[0] || 0, t[1] || 0, t[2] || 0, popOf(u) ? (t[0] || 0) / popOf(u) * 100 : 0, persons(l, 'INDIA') ? (t[0] || 0) / persons(l, 'INDIA') * 100 : 0] });
      });
    } else {
      head = ['Unit', 'Population', 'Largest language', 'Its share', 'Diversity index'];
      order.forEach(function (u) {
        var d = LEAD[u] || leading(u);
        if (DIV[u] === undefined) DIV[u] = diversity(u);
        rows.push({ u: u, cells: [UNITS[u].name, popOf(u), d.lang ? disp(d.lang) : '–', d.share, DIV[u]] });
      });
    }
    if (sortCol != null) rows.sort(function (a, b) {
      var x = a.cells[sortCol], y = b.cells[sortCol];
      return (typeof x === 'string' ? x.localeCompare(y) : (x || 0) - (y || 0)) * sortDir;
    });
    var h = '<table class="data"><caption class="cite" style="text-align:left;padding:4px 0">' + esc($('#map-title-live').textContent || '') + ' · use a heading to sort</caption><thead><tr>' + head.map(function (t, i) { return '<th scope="col" aria-sort="' + (sortCol === i ? (sortDir > 0 ? 'ascending' : 'descending') : 'none') + '"><button type="button" class="th-btn" data-i="' + i + '">' + t + '</button></th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) {
      var ty = UNITS[r.u].type;
      h += '<tr class="' + (ty === 'total' ? 'tot' : ty === 'sub' ? 'sub' : '') + '">' + r.cells.map(function (c, i) {
        if (i === 0 || typeof c === 'string') return '<td>' + esc(c) + '</td>';
        if (state.mode === 'lang' && i >= 4) return '<td>' + pct(c) + '</td>';
        if (state.mode !== 'lang' && i === 3) return '<td>' + pct(c) + '</td>';
        if (state.mode !== 'lang' && i === 4) return '<td>' + (c == null ? '–' : c.toFixed(2)) + '</td>';
        return '<td>' + num(c) + (i === 1 ? mark(state.mode === 'lang' ? flagOf(state.lang, r.u) : UNITS[r.u].flag) : '') + '</td>';
      }).join('') + '</tr>';
    });
    host.innerHTML = h + '</tbody></table>';
  }
  $('#table-host').addEventListener('click', function (ev) {
    var th = ev.target.closest('[data-i]'); if (!th) return;
    var i = +th.getAttribute('data-i'); if (sortCol === i) sortDir = -sortDir; else { sortCol = i; sortDir = i === 0 ? 1 : -1; }
    renderTable();
  });

  /* ---------------------------------------------------------------- controls */
  function setMode(m) {
    state.mode = m;
    [].forEach.call(document.querySelectorAll('#mode-seg button'), function (b) { b.setAttribute('aria-selected', b.getAttribute('data-mode') === m); });
    $('#lang-controls').hidden = m !== 'lang';
    $('#div-controls').hidden = m !== 'div';
    render();
  }
  function setDivLevel(lv) {
    divLevel = lv; DIV = DIVS[lv];
    [].forEach.call(document.querySelectorAll('#div-seg button'), function (b) { b.setAttribute('aria-checked', b.getAttribute('data-level') === lv); });
    render();
  }
  $('#div-seg').addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (b) setDivLevel(b.getAttribute('data-level')); });
  function setMeasure(m) {
    state.measure = m;
    [].forEach.call(document.querySelectorAll('#measure-seg button'), function (b) { b.setAttribute('aria-checked', b.getAttribute('data-measure') === m); });
    render();
  }
  function setLang(l) {
    if (!l) return;
    state.lang = l;
    if (state.mode !== 'lang') { state.mode = 'lang'; [].forEach.call(document.querySelectorAll('#mode-seg button'), function (b) { b.setAttribute('aria-selected', b.getAttribute('data-mode') === 'lang'); }); $('#lang-controls').hidden = false; $('#div-controls').hidden = true; }
    $('#lang-search').value = '';
    [].forEach.call(document.querySelectorAll('#quick button'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-lang') === key(l)); });
    render();
  }
  function selectUnit(u) {
    if (state.unit && unitEls[state.unit]) unitEls[state.unit].classList.remove('sel');
    state.unit = state.unit === u ? null : u; unitAll = false;
    if (state.unit) { unitEls[u].classList.add('sel'); unitEls[u].parentNode.appendChild(unitEls[u]); }
    renderUnit(); writeHash();
    if (state.unit && window.matchMedia('(max-width: 900px)').matches) $('#unit-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  $('#mode-seg').addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (b) setMode(b.getAttribute('data-mode')); });
  $('#measure-seg').addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (b) setMeasure(b.getAttribute('data-measure')); });
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-lang]');
    if (t && (t.closest('#side') || t.closest('#quick'))) { setLang(byKey(t.getAttribute('data-lang'))); return; }
    var uu = ev.target.closest('[data-unit]');
    if (uu && uu.closest('#side')) { selectUnit(uu.getAttribute('data-unit')); return; }
    if (ev.target.closest('#unit-panel .close')) { selectUnit(state.unit); return; }
    var lv = ev.target.closest('#unit-panel [data-level]');
    if (lv) { unitLevel = lv.getAttribute('data-level'); renderUnit(); return; }
    if (ev.target.closest('#unit-panel [data-all]')) { unitAll = !unitAll; renderUnit(); }
  });
  ['opt-labels', 'opt-cities', 'opt-modern'].forEach(function (id) {
    $('#' + id).addEventListener('change', function () {
      stage.classList.toggle('no-labels', !$('#opt-labels').checked);
      stage.classList.toggle('show-cities', $('#opt-cities').checked);
      stage.classList.toggle('show-modern', $('#opt-modern').checked);
      declutter();
    });
  });
  // quick picks: the largest languages
  var QUICK = leafRank.slice(0, 14).concat(L.filter(function (l) { return /^(Gondi|Santali|English|Kurukh or Oraon|Khasi|Pashto|Kashmiri)$/.test(l.name) && !l.kids.length; }));
  $('#quick').innerHTML = QUICK.filter(function (l, i, a) { return a.indexOf(l) === i; }).map(function (l) {
    return '<button type="button" data-lang="' + key(l) + '" aria-pressed="false">' + esc(shortName(l)) + '</button>';
  }).join('');

  // search
  var inp = $('#lang-search'), list = $('#lang-list'), hits = [], hi = -1;
  var norm = function (s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  L.forEach(function (l) { l._s = norm(disp(l) + ' ' + pathOf(l).map(function (p) { return p.name; }).join(' ')); });
  function doSearch() {
    var q = norm(inp.value.trim());
    if (!q) { hits = leafRank.slice(0, 20); }
    else {
      var words = q.split(/\s+/);
      hits = L.filter(function (l) { return words.every(function (w) { return l._s.indexOf(w) >= 0; }); })
        .sort(function (a, b) {
          var an = norm(a.name).indexOf(q) === 0 ? 0 : 1, bn = norm(b.name).indexOf(q) === 0 ? 0 : 1;
          return an - bn || persons(b, 'INDIA') - persons(a, 'INDIA');
        }).slice(0, 40);
    }
    hi = hits.length ? 0 : -1;
    list.innerHTML = hits.length ? hits.map(function (l, i) {
      var p = pathOf(l).slice(0, -1).map(function (x) { return x.name; }).join(' › ');
      return '<li role="option" id="opt-' + i + '" data-i="' + i + '" aria-selected="' + (i === hi) + '"><span>' + esc(disp(l)) + (l.kids.length ? ' <small>(group)</small>' : '') + '<span class="p">' + esc(p) + '</span></span><span class="n">' + compact(persons(l, 'INDIA')) + '</span></li>';
    }).join('') : '<li aria-disabled="true">No match</li>';
    list.hidden = false; inp.setAttribute('aria-expanded', 'true');
  }
  function closeList() { list.hidden = true; inp.setAttribute('aria-expanded', 'false'); }
  inp.addEventListener('input', doSearch);
  inp.addEventListener('focus', doSearch);
  inp.addEventListener('keydown', function (ev) {
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault(); if (list.hidden) doSearch();
      hi = Math.max(0, Math.min(hits.length - 1, hi + (ev.key === 'ArrowDown' ? 1 : -1)));
      [].forEach.call(list.children, function (li, i) { li.setAttribute('aria-selected', i === hi); });
      var cur = list.children[hi]; if (cur) { cur.scrollIntoView({ block: 'nearest' }); inp.setAttribute('aria-activedescendant', 'opt-' + hi); }
    } else if (ev.key === 'Enter') { ev.preventDefault(); if (hits[hi]) { setLang(hits[hi]); closeList(); inp.blur(); } }
    else if (ev.key === 'Escape') closeList();
  });
  list.addEventListener('pointerdown', function (ev) {
    var li = ev.target.closest('li[data-i]'); if (!li) return; ev.preventDefault();
    setLang(hits[+li.getAttribute('data-i')]); closeList(); inp.blur();
  });
  inp.addEventListener('blur', function () { setTimeout(closeList, 120); });

  // theme
  var root = document.documentElement;
  try { var th = localStorage.getItem('il-theme'); if (th) root.setAttribute('data-theme', th); } catch (e) { }
  $('#btn-theme').addEventListener('click', function () {
    var dark = root.getAttribute('data-theme') ? root.getAttribute('data-theme') === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', dark ? 'light' : 'dark');
    try { localStorage.setItem('il-theme', dark ? 'light' : 'dark'); } catch (e) { }
  });

  /* ---------------------------------------------------------------- hash state */
  // Map state lives in the query string (?mode=…&lang=…); the #fragment is left for sections.
  function writeHash() {
    var h = 'mode=' + state.mode;
    if (state.mode === 'lang') h += '&lang=' + key(state.lang) + '&m=' + state.measure;
    if (state.mode === 'div' && divLevel !== 'entry') h += '&level=' + divLevel;
    if (state.unit) h += '&unit=' + state.unit;
    var frag = /(^|&)(mode|lang|m|unit)=/.test(location.hash.slice(1)) ? '' : location.hash;
    try { history.replaceState(null, '', location.pathname + '?' + h + frag); } catch (e) { }
  }
  function readHash() {
    var src = location.search.slice(1);
    if (!src && /(^|&)(mode|lang)=/.test(location.hash.slice(1))) src = location.hash.slice(1);   // old #mode=… links
    var q = {}; src.split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) q[p[0]] = decodeURIComponent(p[1] || ''); });
    if (q.level && DIVS[q.level]) { divLevel = q.level; DIV = DIVS[q.level]; }
    if (q.mode && /^(lang|lead|div)$/.test(q.mode)) state.mode = q.mode;
    if (q.m && SCALES[q.m] || q.m === 'count') state.measure = q.m;
    state.lang = byKey(q.lang) || defaultLang();
    if (q.unit && UNITS[q.unit] && unitEls[q.unit]) state.unit = q.unit;
  }

  /* ---------------------------------------------------------------- checks section */
  function renderChecks() {
    var K = window.CHECKS; if (!K) return;
    var h = '';
    $('#check-summary').innerHTML = K.summary;
    K.groups.forEach(function (g) {
      h += '<details' + (g.open ? ' open' : '') + '><summary>' + esc(g.title) + ' (' + g.items.length + ')</summary><ul>' + g.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul></details>';
    });
    $('#check-list').innerHTML = h;
    var A = window.AREAS; if (!A) return;
    var t = '<details><summary>Mapped area compared with Table I, by unit</summary><table class="data"><thead><tr><th>Unit</th><th>Printed (sq. mi)</th><th>Mapped</th><th>Difference</th></tr></thead><tbody>';
    A.rows.forEach(function (r) {
      if (!UNITS[r.code]) return;
      t += '<tr><td>' + esc(UNITS[r.code].name) + '</td><td>' + fmtW.format(r.printed) + '</td><td>' + fmtW.format(r.map) + '</td><td>' + (r.diff > 0 ? '+' : '') + r.diff + '%</td></tr>';
    });
    t += '<tr class="tot"><td>India</td><td>' + fmtW.format(A.india) + '</td><td>' + fmtW.format(A.total) + '</td><td>' + ((A.total / A.india - 1) * 100).toFixed(1) + '%</td></tr></tbody></table></details>';
    $('#area-table').innerHTML = t;
  }

  /* ---------------------------------------------------------------- second languages section */
  var bilSort = 'pct', bilOpen = null, lfOpen = null;
  function renderBilSection() {
    if (!BIL.length || !$('#bil-list')) return;
    var comparable = $('#lf-comparable') && $('#lf-comparable').checked;
    var rows = BIL.filter(function (e) { return e.bilingual != null; }).slice().sort(function (a, b) {
      return bilSort === 'pct' ? bilPct(b) - bilPct(a) : b.bilingual - a.bilingual;
    });
    var mx = bilSort === 'pct' ? 100 : rows[0].bilingual;
    $('#bil-list').innerHTML = rows.map(function (e, i) {
      var v = bilSort === 'pct' ? bilPct(e) : e.bilingual, open = bilOpen === i + ':' + e.mt;
      var h = '<li data-bil="' + esc(i + ':' + e.mt) + '" class="' + (open ? 'on' : '') + '"><span class="nm">' + esc(e.mt) + (e.diff ? ' <span class="flag-s" title="Breakdown does not add up in the print">≠</span>' : '') + '</span><span class="val">' + pct(bilPct(e)) + ' · ' + num(e.bilingual) + ' <span class="cov-chip' + (e.coverage != null && e.coverage < 50 ? ' low' : '') + '" title="Share of Part I speakers covered by the Part II returns">' + (e.coverage == null ? '' : 'covers ' + (e.coverage < 1 ? '<1' : Math.round(e.coverage)) + '%') + '</span></span><span class="track"><span class="fill" style="width:' + (v / mx * 100) + '%"></span></span></li>';
      if (open) h += '<li class="detail">' + bilBlock(e).replace('<div class="bil-block">', '<div class="bil-block inline">') + (e.lang != null ? '<button type="button" class="linkish" data-lang="' + key(L[e.lang]) + '">Map ' + esc(disp(L[e.lang])) + ' →</button>' : '') + '</li>';
      return h;
    }).join('');
    // lingua francas
    var agg = {};
    BIL.filter(function (e) { return !comparable || (e.coverage != null && e.coverage >= 50); }).forEach(function (e) { e.subs.forEach(function (x) { if (x.n) { (agg[x.as] = agg[x.as] || { n: 0, from: [] }); agg[x.as].n += x.n; agg[x.as].from.push({ mt: e.mt, n: x.n, tot: e.total }); } }); });
    var lf = Object.keys(agg).map(function (k) { return { name: k, n: agg[k].n, from: agg[k].from }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 25);
    var m2 = lf[0].n;
    $('#lf-list').innerHTML = lf.map(function (x) {
      var open = lfOpen === x.name;
      var h = '<li data-lf="' + esc(x.name) + '" class="' + (open ? 'on' : '') + '"><span class="nm">' + esc(x.name) + '</span><span class="val">' + num(x.n) + '</span><span class="track"><span class="fill alt" style="width:' + (x.n / m2 * 100) + '%"></span></span></li>';
      if (open) {
        var fr = x.from.sort(function (a, b) { return b.n - a.n; });
        h += '<li class="detail"><span class="cite">Returned as a second language by speakers of: ' + fr.map(function (f) { return esc(f.mt) + ' ' + fmtW.format(f.n); }).join(', ') + '.</span></li>';
      }
      return h;
    }).join('');
  }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('#bil-list [data-bil]'); if (b) { var k = b.getAttribute('data-bil'); bilOpen = bilOpen === k ? null : k; renderBilSection(); return; }
    var f = ev.target.closest('#lf-list [data-lf]'); if (f) { var n = f.getAttribute('data-lf'); lfOpen = lfOpen === n ? null : n; renderBilSection(); return; }
    var sb = ev.target.closest('#bil-sort [data-s]'); if (sb) { bilSort = sb.getAttribute('data-s'); [].forEach.call(document.querySelectorAll('#bil-sort button'), function (x) { x.setAttribute('aria-checked', x === sb); }); renderBilSection(); return; }
    var ml = ev.target.closest('#bil-list [data-lang]'); if (ml) { setLang(byKey(ml.getAttribute('data-lang'))); document.getElementById('explore').scrollIntoView({ behavior: 'smooth' }); }
  });

  /* ---------------------------------------------------------------- keyboard */
  // make every clickable list row reachable and operable from the keyboard
  function focusableRows(root) {
    [].forEach.call((root || document).querySelectorAll('.bars li[data-lang], .bars li[data-unit], .bars li[data-bil], .bars li[data-lf]'), function (li) {
      if (!li.hasAttribute('tabindex')) { li.setAttribute('tabindex', '0'); li.setAttribute('role', 'button'); }
    });
  }
  new MutationObserver(function () { focusableRows(); }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('keydown', function (ev) {
    var t = ev.target;
    if ((ev.key === 'Enter' || ev.key === ' ') && t.matches && t.matches('.bars li[tabindex], tr[role="button"]')) { ev.preventDefault(); t.click(); return; }
    // arrow keys move between tabs / radios in a segmented control
    if (/^Arrow(Left|Right|Up|Down)$/.test(ev.key) && t.closest && t.closest('[role="tablist"],[role="radiogroup"]') && t.tagName === 'BUTTON') {
      var btns = [].slice.call(t.closest('[role="tablist"],[role="radiogroup"]').querySelectorAll('button'));
      var i = btns.indexOf(t), d = /Left|Up/.test(ev.key) ? -1 : 1;
      var n = btns[(i + d + btns.length) % btns.length];
      ev.preventDefault(); n.focus(); n.click();
    }
  });
  $('#lf-comparable') && $('#lf-comparable').addEventListener('change', renderBilSection);

  /* ---------------------------------------------------------------- guided tour */
  var TOUR = [
    { title: '1. Why Western Hindi fills the United Provinces', go: function () { setMode('lang'); setLang(findLang('Western Hindi')); setMeasure('share'); },
      text: 'The census used one word, <i>Hindustani</i>, for both Hindi and Urdu, and in the United Provinces allowed no other. The India table then assigned Hindustani to Grierson’s languages by locality. All 48 million UP speakers went to “Western Hindi”, including the Awadhi-speaking east and the Bhojpuri districts. The dark block on the map is an artefact of that decision, not a finding about speech.' },
    { title: '2. How census evidence entered the making of Orissa', go: function () { setMode('lang'); setLang(findLang('Oriya')); setMeasure('dist'); },
      text: 'Oriya speakers were spread across Bihar and Orissa, the Madras Presidency (Ganjam and Vizagapatam), the Central Provinces and the feudatory states. The Orissa Boundary Committee asked for the 1931 returns before they were even tabulated, and Orissa became a province in 1936. Hutton warns that rival campaigns pushed people to “plump” for one language and hide their bilingualism, so read the borderland figures with care.' },
    { title: '3. How sex ratios reveal soldiers, traders and migrant labour', go: function () { setMode('lang'); setLang(findLang('Telugu')); setMeasure('sex'); },
      text: 'Where a language’s speakers are far from home, men usually outnumber women. There were 160,640 Telugu speakers in Burma, mostly labourers in Rangoon and the delta, with only 290 women for every 1,000 men. Oriya speakers in Burma had 60, and Pashto speakers in Bengal 64. Try English (soldiers and officials) or Panjabi to see the same pattern.' },
    { title: '4. Why Part II is not a bilingualism census', go: function () { location.hash = 'bilingual'; },
      text: 'Second languages were tabulated only for certain mother tongues and only in the provinces where “concurrent vernaculars” were found. For Kuki-Chin, the Part II returns cover 36,606 of 972,886 speakers, under 4%. Each entry in the <b>Second languages</b> section shows its coverage. The ranked list can be limited to entries that cover at least half their speakers.' }
  ];
  function findLang(n) { return L.filter(function (l) { return l.name === n; })[0]; }
  var tourI = -1;
  function showTour(i) {
    tourI = i;
    var box = $('#tour');
    if (i < 0 || i >= TOUR.length) { box.hidden = true; return; }
    var s = TOUR[i];
    box.hidden = false;
    box.innerHTML = '<div class="tour-head"><span class="lbl">Start here · ' + (i + 1) + ' of ' + TOUR.length + '</span><button type="button" class="close" data-tour="close" aria-label="Close the tour">×</button></div><h2>' + s.title + '</h2><p>' + s.text + '</p><div class="tour-nav">' +
      (i > 0 ? '<button type="button" class="btn ghost" data-tour="prev">‹ Previous</button>' : '') +
      (i < TOUR.length - 1 ? '<button type="button" class="btn" data-tour="next">Next ›</button>' : '<button type="button" class="btn" data-tour="close">Explore on your own</button>') + '</div>';
    s.go();
    box.focus();
  }
  $('#btn-tour').addEventListener('click', function () { showTour(0); });
  $('#tour').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-tour]'); if (!b) return;
    var a = b.getAttribute('data-tour');
    showTour(a === 'next' ? tourI + 1 : a === 'prev' ? tourI - 1 : -1);
  });

  /* ---------------------------------------------------------------- go */
  readHash();
  [].forEach.call(document.querySelectorAll('#mode-seg button'), function (b) { b.setAttribute('aria-selected', b.getAttribute('data-mode') === state.mode); });
  [].forEach.call(document.querySelectorAll('#measure-seg button'), function (b) { b.setAttribute('aria-checked', b.getAttribute('data-measure') === state.measure); });
  $('#lang-controls').hidden = state.mode !== 'lang';
  $('#div-controls').hidden = state.mode !== 'div';
  [].forEach.call(document.querySelectorAll('#div-seg button'), function (b) { b.setAttribute('aria-checked', b.getAttribute('data-level') === divLevel); });
  [].forEach.call(document.querySelectorAll('#quick button'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-lang') === key(state.lang)); });
  $('#lang-search').placeholder = 'Search ' + L.length + ' languages and groups…';
  render();
  if (state.unit) { unitEls[state.unit].classList.add('sel'); renderUnit(); }
  renderChecks();
  renderBilSection();
})();
