/* District map: Census of India 1931, Table XV Part I of the provincial and state volumes,
 * grouped onto present-day districts (tools/regional/build_districts.py, docs/regional.md).
 * Data: window.DISTRICTS, classification: window.CENSUS, base map: window.GEO. No libraries. */
(function () {
  'use strict';
  var D = window.DISTRICTS, C = window.CENSUS, G = window.GEO, L = C.langs;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var $ = function (s, el) { return (el || document).querySelector(s); };
  function num(n) { return window.NUMFMT.num(n); }
  function pct(x) {
    if (x == null || isNaN(x)) return '–';
    if (x === 0) return '0%';
    if (x < 0.1) return '<0.1%';
    return (x < 10 ? x.toFixed(1) : Math.round(x)) + '%';
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function compact(n) { return window.NUMFMT.compact(n); }
  function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' '); }

  /* ---------------------------------------------------------------- languages */
  // Vol. I nodes, plus two entries the district tables need (see "Read this first")
  var IA = L.filter(function (l) { return l.name === 'Indo-Aryan Branch'; })[0];
  var HU = { id: 'HU', name: 'Hindustani, Hindi or Urdu (as printed)', kids: [], parent: IA ? IA.id : null,
    note: 'Returned as Hindustani, Hindi or Urdu in volumes that did not divide it into Western Hindi, Eastern Hindi and Bihari (chiefly the United Provinces and Bihar and Orissa). Compare across provinces only with the composite below.' };
  var HB = { id: 'HB', name: 'Hindustani + Western Hindi + Eastern Hindi + Bihari', kids: [], parent: null, composite: ['HU', 268, 265, 260],
    note: 'The only Hindi-area figure that means the same thing in every volume: Hindustani, Hindi or Urdu as printed, plus Western Hindi, Eastern Hindi and Bihari wherever a volume did divide them.' };
  var NM = { id: '?', name: 'Not matched to the Vol. I classification', kids: [], parent: null,
    note: 'Leaves whose printed name could not be placed in the all-India classification, mostly Burma’s “Indian languages” returned without further detail.' };
  var BYID = {}; L.forEach(function (l) { BYID[l.id] = l; }); BYID.HU = HU; BYID.HB = HB; BYID['?'] = NM;
  function anc(id) { var out = [], l = BYID[id]; while (l) { out.push(l.id); l = l.parent != null ? BYID[l.parent] : null; } return out; }
  function pathOf(l) { var p = []; l = l.parent != null ? BYID[l.parent] : null; while (l) { p.unshift(l); l = l.parent != null ? BYID[l.parent] : null; } return p; }
  // names used in more than one section of the classification (Indo-European Family, Tibeto-Chinese Family,
  // Indo-Aryan Branch...) carry their section, so the European Indo-European family is not mistaken for India's
  var SECTION_TAG = { A: 'languages of India', B: 'other Asiatic and African languages', C: 'European languages' };
  var NAME_COUNT = {};
  L.forEach(function (l) { NAME_COUNT[l.name] = (NAME_COUNT[l.name] || 0) + 1; });
  function sectionOf(l) { while (l.parent != null) l = L[l.parent]; var m = /^([ABC])\./.exec(l.name); return m ? m[1] : null; }
  function tagged(l, name) { var sec = NAME_COUNT[l.name] > 1 && l.kids.length ? sectionOf(l) : null; return sec ? name + ' (' + SECTION_TAG[sec] + ')' : name; }
  function disp(l) { var n = l.name.replace(/^[A-Z]\.\s*/, ''); return typeof l.id === 'number' ? tagged(l, n) : n; }

  var U = D.units;
  U.forEach(function (u, i) {
    u.i = i;
    u.agg = {};
    Object.keys(u.vals).forEach(function (k) {
      var v = u.vals[k], id = k === 'HU' || k === '?' ? k : +k;
      anc(id).forEach(function (a) { u.agg[a] = (u.agg[a] || 0) + v[0]; });
    });
    u.agg.HB = HB.composite.reduce(function (s, k) { return s + (u.vals[k] ? u.vals[k][0] : 0); }, 0);
    // denominator: the printed population, unless the language figures add up to more (a misprint, e.g. Hazara)
    u.S = Object.keys(u.vals).reduce(function (a, k) { return a + u.vals[k][0]; }, 0);
    u.P = Math.max(u.pop[0] || 0, u.S);
    // language figures covering under 80% of the printed population (Gwalior's damaged pages): too incomplete to map
    u.popMissing = u.members.some(function (m) { return m.vol !== 'india' && !(m.check && m.check[0]); });
    u.A31 = u.series ? u.series[3] : null;     // 1931 population of the area drawn, on 2011 boundaries (Census 2011, A-2)
    u.damaged = !!u.P && (u.S / u.P < 0.8 || (u.popMissing && u.A31 > 0 && u.S < 0.8 * u.A31));
    // members whose language figures fall short of (or exceed) the printed population by more than 1%
    u.gaps = u.members.filter(function (m) { return m.check && m.check[0] && Math.abs(m.check[0] - m.check[1]) / m.check[0] > 0.01; });
    var nm = u.names31.length ? u.names31 : u.members.length ? u.members.map(function (m) { return m.area; })
      : u.shapes.map(function (x) { return x.replace(/ \((India|Pakistan|Bangladesh|Burma, 1931)\)$/, ''); });
    u.short = nm.slice(0, 3).join(', ') + (nm.length > 3 ? ' +' + (nm.length - 3) + ' more' : '');
    // largest leaf
    var best = null;
    Object.keys(u.vals).forEach(function (k) { if (k !== '?' && (!best || u.vals[k][0] > u.vals[best][0])) best = k; });
    u.lead = best ? { l: BYID[best === 'HU' ? 'HU' : +best], n: u.vals[best][0] } : null;
  });
  var TOT = {};
  U.forEach(function (u) { Object.keys(u.agg).forEach(function (k) { TOT[k] = (TOT[k] || 0) + u.agg[k]; }); });
  var LANGS = L.concat([HU, HB, NM]).filter(function (l) { return TOT[l.id] > 0; });
  LANGS.forEach(function (l) { l._s = norm(l.name + ' ' + pathOf(l).map(function (p) { return p.name; }).join(' ')); });
  var LEAVES = LANGS.filter(function (l) { return !l.kids.length && l !== HB; }).sort(function (a, b) { return TOT[b.id] - TOT[a.id]; });

  /* ---------------------------------------------------------------- state and scales */
  var state = { mode: 'lang', lang: BYID[261], unit: null };
  var SEQ = ['--s0', '--s1', '--s2', '--s3', '--s4', '--s5', '--s6'];
  var SCALES = {
    share: { cuts: [0.1, 1, 5, 15, 35, 65], ticks: ['>0', '0.1', '1', '5', '15', '35', '65%'], title: 'Speakers as % of the unit’s population' },
    lead: { cuts: [30, 40, 50, 65, 80, 90], ticks: ['', '30', '40', '50', '65', '80', '90%'], title: 'Largest language’s share of the population' }
  };
  function bin(sc, v) { var i = 0; while (i < sc.cuts.length && v >= sc.cuts[i]) i++; return i; }

  /* ---------------------------------------------------------------- map build */
  var svg = $('#map'), stage = $('#stage');
  var VB = G.viewBox.slice(), view = { x: VB[0], y: VB[1], w: VB[2], h: VB[3] };
  var sea = $('#sea');
  sea.setAttribute('x', VB[0] - 2000); sea.setAttribute('y', VB[1] - 2000); sea.setAttribute('width', VB[2] + 4000); sea.setAttribute('height', VB[3] + 4000);
  function el(tag, attrs, parent) { var e = document.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  G.graticule.forEach(function (g) { el('path', { d: g.d, class: 'grat' }, $('#g-grat')); });
  G.neighbours.forEach(function (n) { el('path', { d: n.d, class: 'neigh' }, $('#g-neigh')); });
  // outlines of the 1931 provinces and states, drawn from the district units (build_districts.py)
  (D.prov || []).forEach(function (p) { el('path', { d: p.d, class: 'prov-line' }, $('#g-prov')); });
  var unitEls = [];
  U.forEach(function (u) {
    if (!u.d) return;
    var p = el('path', { d: u.d, class: 'unit', tabindex: '0', role: 'button', 'aria-label': u.short }, $('#g-units'));
    unitEls[u.i] = p;
    p.addEventListener('pointermove', function (ev) { if (!drag.moved) { hover(u.i); showTip(ev, tipHTML(u)); } });
    p.addEventListener('pointerleave', function () { hover(null); hideTip(); });
    p.addEventListener('click', function () { if (!drag.moved) select(u.i); });
    p.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(u.i); } });
    p.addEventListener('focus', function () { hover(u.i); var r = p.getBoundingClientRect(); showTip({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }, tipHTML(u)); });
    p.addEventListener('blur', function () { hover(null); hideTip(); });
  });
  var hovered = null;
  function hover(i) {
    if (hovered != null && unitEls[hovered]) unitEls[hovered].classList.remove('hover');
    hovered = i;
    if (i != null && unitEls[i]) { unitEls[i].classList.add('hover'); unitEls[i].parentNode.appendChild(unitEls[i]); }
    if (state.unit != null && unitEls[state.unit]) unitEls[state.unit].parentNode.appendChild(unitEls[state.unit]);
  }
  $('#opt-labels').addEventListener('change', function () { stage.classList.toggle('no-labels', !this.checked); });
  $('#opt-prov').addEventListener('change', function () { $('#g-prov').style.display = this.checked ? '' : 'none'; });

  /* ---------------------------------------------------------------- pan / zoom */
  function applyView() { svg.setAttribute('viewBox', view.x + ' ' + view.y + ' ' + view.w + ' ' + view.h); scaleHatch(); scheduleLabels(); }
  // hatching keeps a constant screen size at any zoom
  function scaleHatch() {
    var k = view.w / VB[2], w = (4 * k).toFixed(3);
    [].forEach.call(document.querySelectorAll('pattern'), function (pt) {
      pt.setAttribute('width', w); pt.setAttribute('height', w);
      [].forEach.call(pt.querySelectorAll('rect'), function (r) { r.setAttribute('width', w); r.setAttribute('height', w); });
      [].forEach.call(pt.querySelectorAll('line'), function (l) { l.setAttribute('y2', w); l.style.strokeWidth = (0.6 * k).toFixed(3); });
    });
  }

  // labels keep a constant screen size; those that collide with a more populous unit's label are hidden
  var labelFrame = null;
  function scheduleLabels() { if (labelFrame) return; labelFrame = requestAnimationFrame(function () { labelFrame = null; placeLabels(); }); }
  function placeLabels() {
    var r = svg.getBoundingClientRect(); if (!r.width) return;
    var s = Math.max(view.w / r.width, view.h / r.height), fs = (11 * s).toFixed(2);
    var labs = [].slice.call(document.querySelectorAll('#g-labels text')), kept = [];
    labs.forEach(function (t) { t.setAttribute('font-size', fs); t.style.display = ''; });
    labs.forEach(function (t) {
      var b; try { b = t.getBBox(); } catch (e) { return; }
      var pad = b.height * 0.1;
      if (b.x + b.width < view.x || b.x > view.x + view.w || b.y + b.height < view.y || b.y > view.y + view.h ||
          kept.some(function (k) { return b.x < k.x + k.width + pad && k.x < b.x + b.width + pad && b.y < k.y + k.height + pad && k.y < b.y + b.height + pad; })) t.style.display = 'none';
      else kept.push(b);
    });
  }
  function clampView() {
    var minW = VB[2] / 16;
    if (view.w < minW) { var c = [view.x + view.w / 2, view.y + view.h / 2]; view.h *= minW / view.w; view.w = minW; view.x = c[0] - view.w / 2; view.y = c[1] - view.h / 2; }
    if (view.w > VB[2] * 1.4) { view.h *= VB[2] * 1.4 / view.w; view.w = VB[2] * 1.4; }
    view.x = Math.min(Math.max(view.x, VB[0] - view.w * 0.5), VB[0] + VB[2] - view.w * 0.5);
    view.y = Math.min(Math.max(view.y, VB[1] - view.h * 0.5), VB[1] + VB[3] - view.h * 0.5);
  }
  function zoomAt(f, cx, cy) { view.x = cx - (cx - view.x) / f; view.y = cy - (cy - view.y) / f; view.w /= f; view.h /= f; clampView(); applyView(); }
  function toSvg(ev) {
    var r = svg.getBoundingClientRect(), s = Math.max(view.w / r.width, view.h / r.height);
    return [view.x - (r.width * s - view.w) / 2 + (ev.clientX - r.left) * s, view.y - (r.height * s - view.h) / 2 + (ev.clientY - r.top) * s];
  }
  svg.addEventListener('wheel', function (ev) { ev.preventDefault(); var p = toSvg(ev); zoomAt(Math.exp(-ev.deltaY * (ev.deltaMode ? 0.05 : 0.0018)), p[0], p[1]); }, { passive: false });
  var drag = { on: false, moved: false, pts: {} };
  svg.addEventListener('pointerdown', function (ev) {
    drag.pts[ev.pointerId] = [ev.clientX, ev.clientY];
    drag.on = true; drag.moved = false; drag.start = [ev.clientX, ev.clientY]; drag.view = Object.assign({}, view);
    if (Object.keys(drag.pts).length === 2) {
      var a = Object.values(drag.pts); drag.d0 = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]);
      drag.mid = toSvg({ clientX: (a[0][0] + a[1][0]) / 2, clientY: (a[0][1] + a[1][1]) / 2 });
    }
  });
  window.addEventListener('pointermove', function (ev) {
    if (!drag.on || !drag.pts[ev.pointerId]) return;
    drag.pts[ev.pointerId] = [ev.clientX, ev.clientY];
    var r = svg.getBoundingClientRect();
    if (Object.keys(drag.pts).length === 2) {
      var a = Object.values(drag.pts), d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]);
      view = Object.assign({}, drag.view); zoomAt(d / drag.d0, drag.mid[0], drag.mid[1]); drag.moved = true; return;
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

  /* ---------------------------------------------------------------- tooltip */
  var tip = $('#tooltip');
  function showTip(ev, html) {
    tip.innerHTML = html; tip.hidden = false;
    var r = stage.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    var x = ev.clientX - r.left + 14, y = ev.clientY - r.top + 14;
    if (x + tw > r.width - 6) x = ev.clientX - r.left - tw - 14;
    if (y + th > r.height - 6) y = ev.clientY - r.top - th - 14;
    tip.style.left = Math.max(6, x) + 'px'; tip.style.top = Math.max(6, y) + 'px';
  }
  function hideTip() { tip.hidden = true; }
  function statusNote(u) {
    if (u.status === 'nodata' || u.status === 'nc') return u.note || 'No 1931 figures.';
    var out = [];
    if (u.damaged) out.push(u.S / u.P < 0.8 ? 'Not mapped: the language figures legible in the scan cover only ' + pct(u.S / u.P * 100) + ' of the printed population.'
      : 'Not mapped: the printed population is illegible, and the legible language figures (' + num(u.S) + ') are far below the 1931 population of this area (' + num(u.A31) + ', Census 2011 Table A-2).');
    if (u.missing31.length) out.push('Incomplete: no district figures for ' + u.missing31.join(', ') + '.');
    u.gaps.forEach(function (m) { out.push(m.area + ': the language figures add up to ' + num(m.check[1]) + ', the printed population is ' + num(m.check[0]) + ' (illegible or damaged cells, or a misprint).'); });
    return out.length ? out.join(' ') : null;
  }
  function tipHTML(u) {
    var h = '<b>' + esc(u.short) + '</b>';
    var sn = statusNote(u);
    var hint = '<span class="m"><i>No figures to show here. Click to open its card with the reason and, where available, its 1901–2011 population.</i></span>';
    if (u.status === 'nodata' || u.status === 'nc') return h + '<span class="m">' + esc(sn) + '</span>' + hint;
    if (u.damaged) return h + '<span class="m">' + esc(statusNote(u)) + '</span>' + hint;
    if (!itemised(u)) return h + '<span class="m">' + esc(COARSE) + '</span>' + hint;
    if (state.mode === 'lang') {
      var n = u.agg[state.lang.id] || 0;
      h += '<span class="big">' + pct(u.P ? n / u.P * 100 : 0) + '</span><span class="m">' + num(n) + ' of ' + num(u.P) + ' · ' + esc(disp(state.lang)) + '</span>';
    } else if (u.lead) {
      h += '<span class="big">' + esc(leadName(u)) + '</span><span class="m">' + pct(u.lead.n / u.P * 100) + ' of ' + num(u.P) + '</span>';
    }
    if (sn) h += '<span class="m">' + esc(sn) + '</span>';
    return h;
  }

  /* ---------------------------------------------------------------- render */
  // Burma's district tables give language groups only, with every Indian language in one lump
  function itemised(u) { return !u.damaged && (!u.coarse || (state.mode === 'lang' ? state.lang.id in u.agg : true)); }
  var COARSE = 'Burma’s district tables give language groups only; the Indian languages are one lump (“Indian languages”). This entry is not itemised here: see the province map for Burma as a whole.';
  // a group matched only at group level is the volume's unitemised remainder of that group
  function leadName(u) { return u.lead.l.kids.length && !u.coarse ? disp(u.lead.l) + ': other or unspecified' : disp(u.lead.l); }
  function value(u) {
    if (!u.P) return null;
    if (state.mode === 'lang') return (u.agg[state.lang.id] || 0) / u.P * 100;
    return u.lead ? u.lead.n / u.P * 100 : null;
  }
  // "Largest language": a colour per leading language (langcolors.js), one label per contiguous block
  function familyOf(l) { var p = pathOf(l).concat([l]); return p.length > 1 ? p[1].name : null; }
  function leadKey(u) { return u.status === 'ok' && u.lead && u.P && !u.damaged ? String(u.lead.l.id) : null; }
  function leadLabel(l, u) {
    if (l.kids.length && !(u && u.coarse)) return 'Other (not itemised)';
    return l.name.replace(/^[A-Z]\.\s*/, '').replace(/ \(as printed\)$/, '').replace(/, Hindi or Urdu$/, '').replace(/ or .*$/, '').replace(/ \(.*\)$/, '').replace(/ Group$/, '');
  }
  var LEAD_ITEMS = [], LEAD_COLORS = {};
  (function () {
    var seen = {};
    U.forEach(function (u) {
      var k = leadKey(u); if (k == null || seen[k]) return; seen[k] = 1;
      var l = u.lead.l;
      LEAD_ITEMS.push({ key: k, family: l === NM ? null : familyOf(l), order: l === HU ? 268.5 : typeof l.id === 'number' ? l.id : 9999, label: leadLabel(l, u) });
    });
    LEAD_COLORS = window.LangColors.assign(LEAD_ITEMS);
  })();
  function render() {
    var sc = SCALES[state.mode === 'lang' ? 'share' : 'lead'];
    U.forEach(function (u) {
      var p = unitEls[u.i]; if (!p) return;
      p.classList.remove('zero', 'sel', 'nofig'); p.style.fill = '';
      if (u.status === 'nodata' || u.status === 'nc' || !itemised(u)) { p.classList.add('nofig'); return; }
      var v = value(u);
      if (state.mode === 'lead') { var k = leadKey(u); if (k == null) p.classList.add('nofig'); else p.style.fill = window.LangColors.css(LEAD_COLORS[k], v < 50); return; }
      if (!v) p.classList.add('zero'); else p.style.fill = 'var(' + SEQ[bin(sc, v)] + ')';
    });
    var gL = $('#g-labels'); gL.textContent = '';
    if (state.mode === 'lead') {
      window.LangColors.blocks(U.map(function (u) { return { id: u.i, key: unitEls[u.i] ? leadKey(u) : null, nb: u.nb, area: u.ar, pop: u.P }; }))
        .sort(function (a, b) { return b.pop - a.pop; }).forEach(function (bk) {
          var u = U[bk.anchor], t = el('text', { x: u.lx, y: u.ly, class: 'label' }, gL); t.textContent = leadLabel(u.lead.l, u);
        });
    } else U.slice().sort(function (a, b) { return b.P - a.P; }).forEach(function (u) {
      if (!unitEls[u.i] || !u.P || u.status !== 'ok' || !itemised(u)) return;
      var v = value(u); if (!(v >= 0.5)) return;
      var t = el('text', { x: u.lx, y: u.ly, class: 'label' }, gL); t.textContent = pct(v);
    });
    scheduleLabels();
    if (state.unit != null && unitEls[state.unit]) { unitEls[state.unit].classList.add('sel'); unitEls[state.unit].parentNode.appendChild(unitEls[state.unit]); }
    var h = state.mode === 'lead' ? window.LangColors.legend(LEAD_ITEMS, LEAD_COLORS, 'Largest mother tongue in each unit')
      : '<div class="ttl">' + esc(sc.title) + '</div><div class="bins">' + SEQ.map(function (v) { return '<span style="background:var(' + v + ')"></span>'; }).join('') + '</div>' +
        '<div class="ticks">' + sc.ticks.map(function (t) { return '<span>' + t + '</span>'; }).join('') + '</div>';
    if (state.mode === 'lang') h += '<div class="row"><span class="sw" style="background:var(--land)"></span> none recorded</div>';
    h += '<div class="row" title="Grey areas have no figures to show. Click one to open its card with the reason and, where available, its 1901–2011 population." tabindex="0"><span class="sw nofig"></span> no figures to show here · click an area to see why</div>';
    $('#legend').innerHTML = h;
    $('#mode-seg').querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-mode') === state.mode); });
    $('#lang-controls').hidden = state.mode !== 'lang';
    [].forEach.call(document.querySelectorAll('#quick button'), function (b) { b.setAttribute('aria-pressed', state.mode === 'lang' && String(state.lang.id) === b.getAttribute('data-lang')); });
    $('#map-title-live').textContent = state.mode === 'lang' ? disp(state.lang) + ' — % of population' : 'Largest mother tongue in each unit';
    renderSummary(); renderUnit(); renderTable(); writeQuery();
  }
  function renderSummary() {
    var box = $('#summary');
    if (state.mode !== 'lang') { box.innerHTML = '<p class="cite">Colour shows which entry is largest: related languages have related colours. Hindustani as printed is one entry; see the notes below the map. Click a language above to map it.</p>'; return; }
    var l = state.lang, crumbs = pathOf(l);
    var h = '<h2>' + esc(disp(l)) + '</h2>';
    if (crumbs.length) h += '<div class="crumbs">' + crumbs.map(function (a) { return TOT[a.id] ? '<button type="button" data-lang="' + a.id + '">' + esc(a.name) + '</button>' : esc(a.name); }).join(' › ') + '</div>';
    h += '<div class="stat"><div><b>' + compact(TOT[l.id] || 0) + '</b><span>in the district tables</span></div>';
    if (l.v && l.v.INDIA) h += '<div><b>' + compact(l.v.INDIA[0]) + '</b><span>Vol. I, all India</span></div>';
    h += '</div>';
    if (l.note && typeof l.id === 'string') h += '<div class="note-box">' + esc(l.note) + '</div>';   // only this page's own notes (HU, HB, not matched)
    if (l.id === 268 || l.id === 265 || l.id === 260) h += '<div class="note-box">In the United Provinces and Bihar and Orissa volumes these speakers are mostly inside “Hindustani, Hindi or Urdu (as printed)”. Use the composite for a comparable map.</div>';
    if (l.kids.length) {
      var ks = l.kids.map(function (k) { return BYID[k]; }).filter(function (k) { return TOT[k.id]; }).sort(function (a, b) { return TOT[b.id] - TOT[a.id]; });
      if (l === IA) ks.push(HU);
      h += '<div class="kids"><span class="lbl">Includes</span>' + ks.map(function (k) { return '<button type="button" class="linkish" data-lang="' + k.id + '">' + esc(disp(k)) + '</button>'; }).join(' · ') + '</div>';
    }
    box.innerHTML = h;
  }
  function scan(vol, leaf) {
    var v = D.vols[vol]; return v && v.identifier ? 'https://archive.org/details/' + v.identifier + '/page/n' + leaf + '/mode/1up' : null;
  }
  // the provincial plates of the Imperial Gazetteer of India, Atlas (1931), at the Digital South Asia Library
  // DSAL's Mirador viewer shows the plate image; its canvas number is DSAL's object number minus one
  var DSAL = 'https://dsal.uchicago.edu/reference/gaz_atlas_1931/gaz_atlas_mirador?https://dsal.uchicago.edu/reference/gaz_atlas_1931/manifests/gazetteer_atlas_1931.json&canvasID=';
  var PLATES = { 37: 'Bengal, with Sikkim', 38: 'Bihar and Orissa', 39: 'Assam, with Bhutan', 40: 'The United Provinces',
    41: 'Punjab, Delhi and Punjab States', 42: 'North-West Frontier Province and Kashmir and Jammu', 43: 'Rajputana, with Ajmer-Merwara',
    44: 'Baluchistan', 45: 'Bombay, Sind, Baroda and States of Western India, northern section',
    46: 'Bombay, Sind, Baroda and States of Western India, southern section', 47: 'Central India and Gwalior',
    48: 'Central Provinces and Berar', 49: 'Hyderabad', 50: 'Madras, southern section, Mysore, Coorg and Madras States',
    51: 'Madras, northern section', 53: 'Burma, northern section', 54: 'Burma, central section',
    55: 'Burma, southern section, with Andaman and Nicobar Islands' };
  var VOL_PLATES = { bengal: [37], bihar_orissa: [38], assam: [39], up: [40], punjab: [41], Delhi: [41], nwfp: [42], jk: [42],
    rajputana: [43], ajmer: [43], baluchistan: [44], bombay: [45, 46], wisa: [45], baroda: [45, 46], cia: [47], gwalior: [47],
    cp_berar: [48], hyderabad: [49], madras: [51, 50], mysore: [50], travancore: [50], cochin: [50], Coorg: [50],
    burma: [53, 54, 55], andaman: [55] };
  function atlas(u) {
    var seen = {}, ids = [];
    u.members.forEach(function (m) {
      (VOL_PLATES[m.vol === 'india' ? m.area : m.vol] || []).forEach(function (o) { if (!seen[o]) { seen[o] = 1; ids.push(o); } });
    });
    // areas without 1931 figures: the plate that shows them
    if (!u.members.length) u.shapes.forEach(function (x) {
      var o = /Goa/.test(x) ? [46] : /Daman|Diu|Dadra/.test(x) ? [45] : /Karaikal|Mahe|Puducherry|Lakshadweep/.test(x) ? [50] : /Yanam/.test(x) ? [51]
        : /Hukawng|Triangle/.test(x) ? [53] : /Wa States/.test(x) ? [53, 54] : /Gwadar/.test(x) ? [44] : /\(Pakistan\)/.test(x) ? [42] : [];
      o.forEach(function (k) { if (!seen[k]) { seen[k] = 1; ids.push(k); } });
    });
    if (!ids.length) return '';
    return '<div class="subunits"><span class="lbl" style="display:block">1931 map</span>' + ids.map(function (o) {
      return '<a href="' + DSAL + (o - 1) + '" target="_blank" rel="noopener">' + esc(PLATES[o]) + '</a>';
    }).join(' · ') + '<div class="cite">' + (ids.length > 1 ? 'Plates' : 'Plate') + ' of the <i>Imperial Gazetteer of India, Atlas</i> (1931), at the Digital South Asia Library' + (ids.length > 1 ? '. The province spans more than one sheet.' : '.') + '</div></div>';
  }
  function renderUnit() {
    var box = $('#unit-panel');
    if (state.unit == null) { box.hidden = true; return; }
    var u = U[state.unit]; box.hidden = false;
    var h = '<button type="button" class="close" aria-label="Close">×</button><h2>' + esc(u.short) + '</h2>';
    h += '<div class="cite">' + (u.popMissing && u.damaged ? 'Population, 1931: not legible in the scan' : 'Population, 1931: ' + num(u.pop[0]) + ' (' + num(u.pop[1]) + ' m, ' + num(u.pop[2]) + ' f)') + '</div>';
    var sn = statusNote(u); if (sn) h += '<div class="note-box">' + esc(sn) + '</div>';
    if (u.coarse) h += '<div class="note-box">' + esc(COARSE.replace(/ This entry.*$/, '')) + '</div>';
    h += popBlock(u);
    if (u.lead) h += '<span class="lbl" style="display:block;margin-top:10px">Mother tongues, 1931</span>';
    if (u.lead) {
      var list = Object.keys(u.vals).map(function (k) { return { l: BYID[k === 'HU' || k === '?' ? k : +k], n: u.vals[k][0] }; })
        .filter(function (x) { return x.n > 0; }).sort(function (a, b) { return b.n - a.n; });
      var mx = list[0].n, all = box.getAttribute('data-all') === '1';
      h += '<ul class="bars">' + list.slice(0, all ? 999 : 12).map(function (x) {
        var nm = x.l.kids.length && !u.coarse ? disp(x.l) + ': other or unspecified' : disp(x.l);
        return '<li data-lang="' + x.l.id + '" class="' + (state.mode === 'lang' && state.lang === x.l ? 'on' : '') + '"><span class="nm" title="' + esc(nm) + '">' + esc(nm) + '</span><span class="val">' + num(x.n) + ' · ' + pct(u.P ? x.n / u.P * 100 : 0) + '</span><span class="track"><span class="fill" style="width:' + (x.n / mx * 100) + '%"></span></span></li>';
      }).join('') + '</ul>';
      if (list.length > 12) h += '<button type="button" class="linkish" data-all="1">' + (all ? 'Show top 12' : 'Show all ' + list.length) + '</button>';
    }
    if (u.members.length) {
      var nareas = u.members.filter(function (m) { return m.vol !== 'india'; }).length;
      h += '<div class="subunits"><span class="lbl">1931 areas in this unit</span>' + (nareas > 1 ? '<div class="cite" style="margin:2px 0 4px">Shown together because present-day districts were formed from parts of more than one of these areas, and no accurate 1931 boundaries between them are available. The figures are the sum of the areas as printed; none are split by estimate.</div>' : '') + '<ul class="members">' + u.members.map(function (m) {
        var v = D.vols[m.vol], links = (m.leaves || []).map(function (lf, i) { var s = scan(m.vol, lf); return s ? '<a href="' + s + '" target="_blank" rel="noopener">p. ' + esc(m.pages[i] == null ? 'n' + lf : m.pages[i]) + '</a>' : ''; }).join(' ');
        var fl = (m.flags || []).filter(function (f) { return f !== 'V'; });
        return '<li><b>' + esc(m.area) + '</b>' + (m.path.length ? ' <span class="cite">' + esc(m.path.slice(1).join(' › ')) + '</span>' : '') +
          '<br><span class="cite">' + (m.vol === 'india' ? 'Vol. I (no district table)' : esc(v && v.title ? v.title : m.vol)) + ' ' + links + (fl.length ? ' · marks: ' + esc(fl.join(' ')) : '') + '</span></li>';
      }).join('') + '</ul></div>';
    }
    if (u.members.some(function (m) { return m.vol !== 'india'; })) h += '<div class="subunits"><a href="regional.html?unit=' + u.i + '&role=">Every printed figure for these areas →</a> · <a href="regional.html?tab=p2&unit=' + u.i + '">Subsidiary languages →</a></div>';
    h += atlas(u);
    h += '<div class="subunits"><span class="lbl">Present-day districts drawn</span> ' + esc(u.shapes.join(', ')) + '</div>';
    if (u.names31.length) h += '<div class="subunits"><span class="lbl">1931 units in the lineage</span> ' + esc(u.names31.join(', ')) + '</div>';
    box.innerHTML = h;
  }
  // population of the area drawn, 1901-2011, on 2011 district boundaries (Census of India 2011, Table A-2)
  var YEARS = [1901, 1911, 1921, 1931, 1941, 1951, 1961, 1971, 1981, 1991, 2001, 2011];
  function popBlock(u) {
    var h = '<div class="subunits pop-block"><span class="lbl">Population of this area, 1901–2011</span>';
    if (!u.series) return u.snote ? h + '<span class="cite">' + esc(u.snote) + '</span></div>' : '';
    var v = u.series, mx = Math.max.apply(null, v.filter(function (x) { return x != null; })), W = 300, H = 74, bw = W / v.length;
    var svg = '<svg class="pop-chart" viewBox="0 0 ' + W + ' ' + (H + 14) + '" role="img" aria-label="Population by census year">';
    v.forEach(function (x, i) {
      var y = YEARS[i], bh = x == null ? 0 : Math.max(1, x / mx * H);
      svg += '<g data-i="' + i + '" tabindex="0" aria-label="' + y + ': ' + (x == null ? 'not available' : num(x)) + '">' +
        (x == null ? '<rect x="' + (i * bw + 3) + '" y="' + (H - 2) + '" width="' + (bw - 6) + '" height="2" class="pc-na"/>' :
          '<rect x="' + (i * bw + 3) + '" y="' + (H - bh) + '" width="' + (bw - 6) + '" height="' + bh + '" rx="2" class="' + (y === 1931 ? 'pc-31' : 'pc') + '"/>') +
        '<rect x="' + (i * bw) + '" y="0" width="' + bw + '" height="' + (H + 14) + '" fill="transparent"/></g>';
      if (y % 30 === 1 || y === 2011) svg += '<text x="' + (i * bw + bw / 2) + '" y="' + (H + 12) + '" class="pc-t">' + y + '</text>';
    });
    h += svg + '</svg><div class="pop-tip" hidden></div>';
    var a = u.A31, last = v[v.length - 1];
    h += '<div class="stat"><div><b>' + (a ? compact(a) : '–') + '</b><span>1931, this area</span></div><div><b>' + (last ? compact(last) : '–') + '</b><span>2011</span></div>' +
      (a && last ? '<div><b>×' + (last / a).toFixed(1) + '</b><span>growth 1931–2011</span></div>' : '') + '</div>';
    if (a && u.P && !u.damaged) {
      var r = a / u.P;
      h += '<div class="cite">Census 2011 recomputed each census on 2011 district boundaries. For 1931 it gives ' + num(a) + ' for the area drawn. The 1931 tables print ' + num(u.P) + ' for the areas in this unit' +
        (Math.abs(r - 1) <= 0.1 ? ', a close match.' : ' (×' + r.toFixed(2) + '). The present-day outline covers ' + (r > 1 ? 'more' : 'less') + ' ground than the 1931 areas. Territory moved between districts in ways the lineage does not record, so read the language shares as describing the 1931 areas, not the whole outline.') + '</div>';
    }
    if (v.indexOf(null) >= 0) h += '<div class="cite">Years left blank are not given in Table A-2 (for example, the princely states of Punjab and Haryana before 1951).</div>';
    h += '<div class="cite">2011 districts: ' + esc(u.d2011.map(function (n) { return n.replace(/ \(T\)$/, ''); }).join(', ')) + '.</div></div>';
    return h;
  }
  // hover card for the population chart
  function popTip(g) {
    var blk = g.closest('.pop-block'), tipEl = blk && blk.querySelector('.pop-tip'), u = U[state.unit];
    if (!tipEl || !u || !u.series) return;
    var i = +g.getAttribute('data-i'), x = u.series[i], prev = i > 0 ? u.series[i - 1] : null;
    var h = '<b>' + YEARS[i] + '</b><span class="big">' + (x == null ? 'not available' : num(x)) + '</span>';
    if (x != null && prev) { var d = (x - prev) / prev * 100; h += '<span class="m">' + (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(1) + '% since ' + YEARS[i - 1] + '</span>'; }
    if (YEARS[i] === 1931 && u.P && !u.damaged) h += '<span class="m">1931 tables, for the areas in this unit: ' + num(u.P) + '</span>';
    if (x == null) h += '<span class="m">Not given in Census 2011 Table A-2</span>';
    tipEl.innerHTML = h; tipEl.hidden = false;
    var br = blk.getBoundingClientRect(), gr = g.getBoundingClientRect();
    var left = gr.left - br.left + gr.width / 2 - tipEl.offsetWidth / 2;
    tipEl.style.left = Math.max(0, Math.min(br.width - tipEl.offsetWidth, left)) + 'px';
    tipEl.style.top = (gr.top - br.top - tipEl.offsetHeight - 6) + 'px';
    [].forEach.call(blk.querySelectorAll('.pop-chart g'), function (o) { o.classList.toggle('on', o === g); });
  }
  function popTipOff(blk) {
    if (!blk) return;
    var t = blk.querySelector('.pop-tip'); if (t) t.hidden = true;
    [].forEach.call(blk.querySelectorAll('.pop-chart g.on'), function (o) { o.classList.remove('on'); });
  }
  $('#unit-panel').addEventListener('pointerover', function (ev) { var g = ev.target.closest('.pop-chart g[data-i]'); if (g) popTip(g); });
  $('#unit-panel').addEventListener('pointerleave', function () { popTipOff($('#unit-panel .pop-block')); });
  $('#unit-panel').addEventListener('pointerout', function (ev) { if (ev.target.closest('.pop-chart') && !(ev.relatedTarget && ev.relatedTarget.closest && ev.relatedTarget.closest('.pop-chart g[data-i]'))) popTipOff(ev.target.closest('.pop-block')); });
  $('#unit-panel').addEventListener('focusin', function (ev) { var g = ev.target.closest('.pop-chart g[data-i]'); if (g) popTip(g); });
  $('#unit-panel').addEventListener('focusout', function (ev) { if (ev.target.closest('.pop-chart')) popTipOff(ev.target.closest('.pop-block')); });
  var sortCol = 2, sortDir = -1;
  function renderTable() {
    var head = state.mode === 'lang' ? ['Unit', 'Population', 'Speakers', '% of population'] : ['Unit', 'Population', 'Largest entry', 'Its share'];
    var rows = U.filter(function (u) { return u.P && itemised(u); }).map(function (u) {
      if (state.mode === 'lang') { var n = u.agg[state.lang.id] || 0; return { u: u, c: [u.short, u.P, n, n / u.P * 100] }; }
      return { u: u, c: [u.short, u.P, u.lead ? leadName(u) : '–', u.lead ? u.lead.n / u.P * 100 : 0] };
    });
    var k = state.mode === 'lang' ? sortCol : (sortCol === 2 ? 3 : sortCol);
    rows.sort(function (a, b) { var x = a.c[k], y = b.c[k]; return (typeof x === 'string' ? x.localeCompare(y) : x - y) * sortDir; });
    var h = '<table class="data"><thead><tr>' + head.map(function (t, i) { return '<th scope="col"><button type="button" class="th-btn" data-i="' + i + '">' + t + '</button></th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr data-u="' + r.u.i + '">' + r.c.map(function (c, i) { return '<td>' + (i === 0 || typeof c === 'string' ? esc(c) : i === 3 ? pct(c) : num(c)) + (i === 0 && (r.u.missing31.length || r.u.gaps.length) ? ' <span class="cite">(incomplete)</span>' : '') + '</td>'; }).join('') + '</tr>';
    });
    $('#table-host').innerHTML = h + '</tbody></table>';
  }
  $('#table-host').addEventListener('click', function (ev) {
    var th = ev.target.closest('[data-i]');
    if (th) { var i = +th.getAttribute('data-i'); if (sortCol === i) sortDir = -sortDir; else { sortCol = i; sortDir = i === 0 ? 1 : -1; } renderTable(); return; }
    var tr = ev.target.closest('tr[data-u]'); if (tr) select(+tr.getAttribute('data-u'));
  });

  /* ---------------------------------------------------------------- interaction */
  // a selection puts its card at the top of the side panel; × (or clicking the unit again) removes it
  function select(i) {
    state.unit = state.unit === i ? null : i; $('#unit-panel').removeAttribute('data-all'); render();
    if (state.unit != null) {
      $('#unit-panel').scrollTop = 0;
      var r = $('#unit-panel').getBoundingClientRect();
      if (r.top < 0 || r.top > window.innerHeight - 80) $('#unit-panel').scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }
  function setLang(l) { state.lang = l; state.mode = 'lang'; inp.value = ''; render(); }
  $('#mode-seg').addEventListener('click', function (ev) { var b = ev.target.closest('[data-mode]'); if (b) { state.mode = b.getAttribute('data-mode'); render(); } });
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('#side [data-lang]');
    if (b) { var id = b.getAttribute('data-lang'); setLang(BYID[/^\d+$/.test(id) ? +id : id]); return; }
    if (ev.target.closest('#unit-panel .close')) { state.unit = null; render(); return; }
    var a = ev.target.closest('#unit-panel [data-all]');
    if (a) { var box = $('#unit-panel'); box.setAttribute('data-all', box.getAttribute('data-all') === '1' ? '0' : '1'); renderUnit(); }
  });
  // quick picks: the composite, then the largest single languages in the district tables
  var quick = [HB].concat(LEAVES.filter(function (l) { return l !== HU && l !== NM; }).slice(0, 22));
  if (BYID[144] && TOT[144]) quick.push(BYID[144]);     // Burma's district tables give groups only: its largest group
  function quickLabel(l) { return l === HB ? 'Hindi composite' : l.id === 144 ? 'Burma group' : disp(l).replace(/ \(.*\)$/, '').replace(/ or .*$/, '').replace(/, .*$/, ''); }
  $('#quick').innerHTML = quick.map(function (l) { return '<button type="button" data-lang="' + l.id + '" title="' + esc(disp(l)) + ' · ' + compact(TOT[l.id]) + ' speakers">' + esc(quickLabel(l)) + '</button>'; }).join('');
  var inp = $('#lang-search'), list = $('#lang-list'), hits = [], hi = -1;
  function doSearch() {
    var q = norm(inp.value.trim()).trim();
    if (!q) hits = [HB, HU].concat(LEAVES.filter(function (l) { return l !== HU; }).slice(0, 20));
    else {
      var words = q.split(/\s+/);
      hits = LANGS.filter(function (l) { return words.every(function (w) { return l._s.indexOf(w) >= 0; }); })
        .sort(function (a, b) { return (norm(a.name).indexOf(q) === 0 ? 0 : 1) - (norm(b.name).indexOf(q) === 0 ? 0 : 1) || TOT[b.id] - TOT[a.id]; }).slice(0, 40);
    }
    hi = hits.length ? 0 : -1;
    list.innerHTML = hits.length ? hits.map(function (l, i) {
      return '<li role="option" id="opt-' + i + '" data-i="' + i + '" aria-selected="' + (i === hi) + '"><span>' + esc(disp(l)) + (l.kids.length ? ' <small>(group)</small>' : '') + '<span class="p">' + esc(pathOf(l).map(function (x) { return x.name; }).join(' › ')) + '</span></span><span class="n">' + compact(TOT[l.id]) + '</span></li>';
    }).join('') : '<li aria-disabled="true">No match</li>';
    list.hidden = false; inp.setAttribute('aria-expanded', 'true');
  }
  function closeList() { list.hidden = true; inp.setAttribute('aria-expanded', 'false'); }
  inp.addEventListener('input', doSearch); inp.addEventListener('focus', doSearch);
  inp.addEventListener('keydown', function (ev) {
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault(); if (list.hidden) doSearch();
      hi = Math.max(0, Math.min(hits.length - 1, hi + (ev.key === 'ArrowDown' ? 1 : -1)));
      [].forEach.call(list.children, function (li, i) { li.setAttribute('aria-selected', i === hi); });
      var cur = list.children[hi]; if (cur) { cur.scrollIntoView({ block: 'nearest' }); inp.setAttribute('aria-activedescendant', 'opt-' + hi); }
    } else if (ev.key === 'Enter') { ev.preventDefault(); if (hits[hi]) { setLang(hits[hi]); closeList(); inp.blur(); } }
    else if (ev.key === 'Escape') closeList();
  });
  list.addEventListener('pointerdown', function (ev) { var li = ev.target.closest('li[data-i]'); if (!li) return; ev.preventDefault(); setLang(hits[+li.getAttribute('data-i')]); closeList(); inp.blur(); });
  inp.addEventListener('blur', function () { setTimeout(closeList, 120); });

  var root = document.documentElement;
  try { var th = localStorage.getItem('il-theme'); if (th) root.setAttribute('data-theme', th); } catch (e) { }
  $('#btn-theme').addEventListener('click', function () {
    var dark = root.getAttribute('data-theme') ? root.getAttribute('data-theme') === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', dark ? 'light' : 'dark');
    try { localStorage.setItem('il-theme', dark ? 'light' : 'dark'); } catch (e) { }
  });

  function writeQuery() {
    var q = 'mode=' + state.mode + (state.mode === 'lang' ? '&lang=' + state.lang.id : '') + (state.unit != null ? '&unit=' + state.unit : '');
    try { history.replaceState(null, '', location.pathname + '?' + q + location.hash); } catch (e) { }
  }
  (function readQuery() {
    var q = {}; location.search.slice(1).split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) q[p[0]] = decodeURIComponent(p[1] || ''); });
    if (q.mode === 'lead') state.mode = 'lead';
    if (q.lang) { var l = BYID[/^\d+$/.test(q.lang) ? +q.lang : q.lang]; if (l && TOT[l.id]) state.lang = l; }
    if (q.unit && U[+q.unit]) state.unit = +q.unit;
  })();
  document.addEventListener('numfmt', function () { render(); });
  applyView();
  render();
})();
