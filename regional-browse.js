/* District-table browser: every record transcribed from Table XV of the provincial and state volumes,
 * as printed, each linked to its scan and (for Part I) to the district map. Data: window.REGIONAL
 * (tools/regional/build_browser.py). No libraries. */
(function () {
  'use strict';
  var R = window.REGIONAL, S = R.S, $ = function (s) { return document.querySelector(s); };
  var fmt = new Intl.NumberFormat('en-IN');
  function num(n) { return n == null ? '' : n === '?' ? '?' : fmt.format(n); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function scan(vol, leaf) { var v = R.vols[vol]; return v && v.id ? 'https://archive.org/details/' + v.id + '/page/n' + leaf + '/mode/1up' : null; }
  function vol1(x) { return x === -1 ? '' : typeof x === 'number' ? (R.vol1[x] || '') : S[x] === 'HU' ? 'Hindustani, Hindi or Urdu (as printed)' : S[x]; }
  var VOLNAME = {};
  Object.keys(R.vols).forEach(function (k) { var t = R.vols[k].title || k; VOLNAME[k] = t; });

  var AREAS = R.areas.map(function (a) {
    return { vol: S[a[0]], path: S[a[1]], name: S[a[2]], tot: !!a[3], unit: a[4], s: norm(S[a[2]] + ' ' + S[a[1]]) };
  });
  var P1 = R.p1.map(function (r) {
    var a = AREAS[r[0]];
    return { a: a, lang: S[r[1]], lpath: S[r[2]], p: r[3], m: r[4], f: r[5], leaf: r[6], page: S[r[7]], role: r[8], v1: vol1(r[9]), v1id: r[9], mark: S[r[10]],
      s: norm(S[r[1]] + ' ' + S[r[2]] + ' ' + vol1(r[9])) };
  });
  var P2 = R.p2.map(function (r) {
    var a = AREAS[r[0]];
    return { a: a, lang: S[r[1]], lpath: S[r[2]], sub: S[r[3]], meas: S[r[4]], p: r[5], m: r[6], f: r[7], leaf: r[8], page: S[r[9]],
      s: norm(S[r[1]] + ' ' + S[r[2]] + ' ' + S[r[3]]) };
  });
  var ROLE = { L: 'Leaf', T: 'Total', D: 'Derived' };

  /* ---------------------------------------------------------------- state */
  var st = { tab: 'p1', q: '', qa: '', vol: '', role: 'LD', min: 0, notot: true, unit: null, page: 0, per: 100, sort: null, dir: 1 };
  (function readQuery() {
    var q = {}; location.search.slice(1).split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) q[p[0]] = decodeURIComponent((p[1] || '').replace(/\+/g, ' ')); });
    if (q.tab === 'p2') st.tab = 'p2';
    if (q.q) st.q = q.q; if (q.area) st.qa = q.area; if (q.vol && R.vols[q.vol]) st.vol = q.vol;
    if (q.role !== undefined && /^(|LD|T)$/.test(q.role)) st.role = q.role;
    if (q.unit && /^\d+$/.test(q.unit)) st.unit = +q.unit;
  })();
  $('#vol').innerHTML = '<option value="">All volumes</option>' + Object.keys(VOLNAME).filter(function (k) { return AREAS.some(function (a) { return a.vol === k; }); })
    .map(function (k) { return '<option value="' + k + '">' + esc(VOLNAME[k]) + '</option>'; }).join('');
  function syncForm() {
    $('#q').value = st.q; $('#qa').value = st.qa; $('#vol').value = st.vol; $('#role').value = st.role; $('#min').value = st.min; $('#notot').checked = st.notot;
    $('#role-f').hidden = st.tab !== 'p1';
    [].forEach.call(document.querySelectorAll('#tab-seg button'), function (b) { b.setAttribute('aria-selected', b.getAttribute('data-tab') === st.tab); });
  }

  /* ---------------------------------------------------------------- filter */
  var COLS = {
    p1: [['a', 'Area'], ['lang', 'Language as printed'], ['p', 'Persons'], ['m', 'Males'], ['f', 'Females'], ['role', 'Role'], ['v1', 'Vol. I entry'], ['src', 'Source']],
    p2: [['a', 'Area'], ['lang', 'Mother tongue'], ['sub', 'Subsidiary language'], ['meas', 'Measure'], ['p', 'Persons'], ['m', 'Males'], ['f', 'Females'], ['src', 'Source']]
  };
  function persons(r) { return typeof r.p === 'number' ? r.p : (typeof r.m === 'number' ? r.m : 0) + (typeof r.f === 'number' ? r.f : 0); }
  function filtered() {
    var q = norm(st.q.trim()).split(/\s+/).filter(Boolean), qa = norm(st.qa.trim()).split(/\s+/).filter(Boolean);
    var src = st.tab === 'p1' ? P1 : P2;
    var out = src.filter(function (r) {
      if (st.unit != null ? r.a.unit !== st.unit : false) return false;
      if (st.vol && r.a.vol !== st.vol) return false;
      if (st.notot && r.a.tot && st.unit == null) return false;
      if (st.tab === 'p1' && st.role && st.role.indexOf(r.role) < 0) return false;
      if (st.min && persons(r) < st.min) return false;
      if (q.length && !q.every(function (w) { return r.s.indexOf(w) >= 0; })) return false;
      if (qa.length && !qa.every(function (w) { return r.a.s.indexOf(w) >= 0; })) return false;
      return true;
    });
    if (st.sort) {
      var k = st.sort;
      out = out.slice().sort(function (x, y) {
        var a = k === 'a' ? x.a.name : k === 'p' ? persons(x) : x[k], b = k === 'a' ? y.a.name : k === 'p' ? persons(y) : y[k];
        if (typeof a === 'number' || typeof b === 'number') return ((typeof a === 'number' ? a : -1) - (typeof b === 'number' ? b : -1)) * st.dir;
        return String(a || '').localeCompare(String(b || '')) * st.dir;
      });
    }
    return out;
  }

  /* ---------------------------------------------------------------- render */
  function render() {
    syncForm();
    var rows = filtered(), n = rows.length, pages = Math.max(1, Math.ceil(n / st.per));
    st.page = Math.min(st.page, pages - 1);
    $('#thead').innerHTML = '<tr>' + COLS[st.tab].map(function (c) {
      var s = st.sort === c[0] ? (st.dir > 0 ? 'ascending' : 'descending') : 'none';
      return '<th scope="col" aria-sort="' + s + '">' + (c[0] === 'src' ? c[1] : '<button type="button" class="th-btn" data-k="' + c[0] + '">' + c[1] + '</button>') + '</th>';
    }).join('') + '</tr>';
    var slice = rows.slice(st.page * st.per, (st.page + 1) * st.per);
    $('#rows').innerHTML = slice.length ? slice.map(function (r) {
      var a = r.a, sc = scan(a.vol, r.leaf);
      var src = (sc ? '<a href="' + sc + '" target="_blank" rel="noopener" title="' + esc(VOLNAME[a.vol]) + ', scan leaf ' + r.leaf + '">p.&nbsp;' + esc(r.page || 'n' + r.leaf) + '</a>' : '') +
        (a.unit >= 0 ? ' · <a href="districts.html?mode=lang' + (st.tab === 'p1' && r.v1id !== -1 ? '&lang=' + (typeof r.v1id === 'number' ? r.v1id : encodeURIComponent(S[r.v1id])) : '') + '&unit=' + a.unit + '">map</a>' : '');
      var area = '<td class="nm"><span class="n">' + esc(a.name) + (a.tot ? ' <small>(total)</small>' : '') + '</span><span class="p">' + esc(VOLNAME[a.vol]) + (a.path ? ' › ' + esc(a.path) : '') + '</span></td>';
      var lang = '<td class="nm"><span class="n">' + esc(r.lang) + '</span>' + (r.lpath ? '<span class="p">' + esc(r.lpath) + '</span>' : '') + '</td>';
      var figs = '<td>' + num(r.p) + (r.mark ? ' <span class="flag-m">' + esc(r.mark) + '</span>' : '') + '</td><td>' + num(r.m) + '</td><td>' + num(r.f) + '</td>';
      if (st.tab === 'p1') return '<tr class="' + (r.role === 'T' ? 'tot' : '') + '">' + area + lang + figs + '<td>' + ROLE[r.role] + '</td><td class="nm">' + esc(r.v1) + '</td><td class="src">' + src + '</td></tr>';
      return '<tr>' + area + lang + '<td class="nm">' + esc(r.sub) + '</td><td class="nm">' + esc(r.meas) + '</td>' + figs + '<td class="src">' + src + '</td></tr>';
    }).join('') : '<tr><td colspan="8" class="empty">No rows match these filters.</td></tr>';
    $('#count').textContent = fmt.format(n) + ' rows';
    $('#pageinfo').textContent = 'Page ' + (st.page + 1) + ' of ' + pages;
    $('#prev').disabled = st.page === 0; $('#next').disabled = st.page >= pages - 1;
    $('#unit-filter').innerHTML = st.unit != null ? 'Map unit: <b>' + esc(unitName(st.unit)) + '</b> <button type="button" class="linkish" id="clear-unit">show all areas</button>' : '';
    writeQuery();
  }
  function unitName(u) {
    var names = AREAS.filter(function (a) { return a.unit === u; }).map(function (a) { return a.name; });
    names = names.filter(function (x, i) { return names.indexOf(x) === i; });
    return names.slice(0, 4).join(', ') + (names.length > 4 ? ' +' + (names.length - 4) + ' more' : '');
  }
  function writeQuery() {
    var q = [];
    if (st.tab !== 'p1') q.push('tab=' + st.tab);
    if (st.q) q.push('q=' + encodeURIComponent(st.q)); if (st.qa) q.push('area=' + encodeURIComponent(st.qa));
    if (st.vol) q.push('vol=' + st.vol); if (st.role !== 'LD') q.push('role=' + st.role); if (st.unit != null) q.push('unit=' + st.unit);
    try { history.replaceState(null, '', location.pathname + (q.length ? '?' + q.join('&') : '')); } catch (e) { }
  }

  /* ---------------------------------------------------------------- events */
  var timer = null;
  function later() { clearTimeout(timer); timer = setTimeout(function () { st.page = 0; render(); }, 150); }
  $('#q').addEventListener('input', function () { st.q = this.value; later(); });
  $('#qa').addEventListener('input', function () { st.qa = this.value; later(); });
  $('#vol').addEventListener('change', function () { st.vol = this.value; st.page = 0; render(); });
  $('#role').addEventListener('change', function () { st.role = this.value; st.page = 0; render(); });
  $('#min').addEventListener('input', function () { st.min = +this.value || 0; later(); });
  $('#notot').addEventListener('change', function () { st.notot = this.checked; st.page = 0; render(); });
  $('#per').addEventListener('change', function () { st.per = +this.value; st.page = 0; render(); });
  $('#prev').addEventListener('click', function () { st.page--; render(); });
  $('#next').addEventListener('click', function () { st.page++; render(); });
  $('#tab-seg').addEventListener('click', function (ev) { var b = ev.target.closest('[data-tab]'); if (b) { st.tab = b.getAttribute('data-tab'); st.sort = null; st.page = 0; render(); } });
  $('#thead').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-k]'); if (!b) return;
    var k = b.getAttribute('data-k');
    if (st.sort === k) st.dir = -st.dir; else { st.sort = k; st.dir = /^(p|m|f)$/.test(k) ? -1 : 1; }
    render();
  });
  document.addEventListener('click', function (ev) { if (ev.target.id === 'clear-unit') { st.unit = null; st.page = 0; render(); } });
  $('#reset').addEventListener('click', function () { st = { tab: st.tab, q: '', qa: '', vol: '', role: 'LD', min: 0, notot: true, unit: null, page: 0, per: st.per, sort: null, dir: 1 }; render(); });
  $('#dl').addEventListener('click', function () {
    var rows = filtered(), q = function (v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var head = st.tab === 'p1' ? ['volume', 'area_path', 'area', 'area_is_total', 'language_as_printed', 'lang_path', 'persons', 'males', 'females', 'mark', 'role', 'vol1_entry', 'scan_leaf', 'printed_page', 'scan_url']
      : ['volume', 'area_path', 'area', 'area_is_total', 'mother_tongue', 'mother_tongue_path', 'subsidiary', 'measure', 'persons', 'males', 'females', 'scan_leaf', 'printed_page', 'scan_url'];
    var lines = [head.join(',')].concat(rows.map(function (r) {
      var a = r.a, base = [a.vol, a.path, a.name, a.tot];
      var v = st.tab === 'p1' ? base.concat([r.lang, r.lpath, r.p, r.m, r.f, r.mark, ROLE[r.role], r.v1, r.leaf, r.page, scan(a.vol, r.leaf)])
        : base.concat([r.lang, r.lpath, r.sub, r.meas, r.p, r.m, r.f, r.leaf, r.page, scan(a.vol, r.leaf)]);
      return v.map(q).join(',');
    }));
    var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    var el = document.createElement('a'); el.href = URL.createObjectURL(blob); el.download = 'census1931-district-table15-' + (st.tab === 'p1' ? 'part1' : 'part2') + '.csv';
    document.body.appendChild(el); el.click(); setTimeout(function () { URL.revokeObjectURL(el.href); el.remove(); }, 500);
  });

  var root = document.documentElement;
  try { var th = localStorage.getItem('il-theme'); if (th) root.setAttribute('data-theme', th); } catch (e) { }
  $('#btn-theme').addEventListener('click', function () {
    var dark = root.getAttribute('data-theme') ? root.getAttribute('data-theme') === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', dark ? 'light' : 'dark');
    try { localStorage.setItem('il-theme', dark ? 'light' : 'dark'); } catch (e) { }
  });
  render();
})();
