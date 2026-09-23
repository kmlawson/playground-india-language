/* Table XV browser: filter, sort and page through every figure of the transcription,
 * each row linked to its printed page on the Internet Archive. Data: window.CENSUS. */
(function () {
  'use strict';
  var C = window.CENSUS, L = C.langs, U = C.units;
  var $ = function (s) { return document.querySelector(s); };
  var IA = 'https://archive.org/details/india.history.resource.92539/page/n';
  var fmtIN = new Intl.NumberFormat('en-IN'), fmtW = new Intl.NumberFormat('en-GB');
  var fmt = fmtIN;
  function num(n) { return n == null ? '..' : fmt.format(n); }
  function pct(x) { if (x == null || !isFinite(x)) return ''; if (x === 0) return '0'; if (x < 0.01) return '<0.01'; if (x < 10) return x.toFixed(2); return x.toFixed(1); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  var GENERIC = /^(others?\b|other\b|.*unspecified|unclassed$)/i;
  function pathOf(l) { var p = []; while (l) { p.unshift(l); l = l.parent != null ? L[l.parent] : null; } return p; }
  function disp(l) { return GENERIC.test(l.name) && l.parent != null ? l.name + ' (' + L[l.parent].name + ')' : l.name; }
  // the family a node belongs to: the child of its section root
  function family(l) { var p = pathOf(l); return p.length > 1 ? p[1] : p[0]; }
  // nearest printed ancestor-or-self, for a source link on computed groups
  function srcNode(l) { while (l && !l.col) { var k = l.kids.map(function (i) { return L[i]; }).filter(function (x) { return x.col; })[0]; return k || null; } return l; }

  var UNIT_ORDER = Object.keys(U);
  var popOf = function (u) { return U[u].pop ? U[u].pop[0] : 0; };

  /* flatten: one record per (node, unit) with persons > 0 or any figure */
  var ROWS = [];
  L.forEach(function (l) {
    var path = pathOf(l), pathTxt = path.map(function (p) { return p.name; }).join(' › ');
    var india = l.v.INDIA ? l.v.INDIA[0] : 0;
    var s = norm(disp(l) + ' ' + pathTxt);
    var fam = family(l);
    UNIT_ORDER.forEach(function (u, ui) {
      var t = l.v[u]; if (!t) return;
      var p = t[0] || 0, m = t[1], f = t[2];
      ROWS.push({
        l: l, u: u, ui: ui, name: disp(l), path: pathTxt, s: s, fam: fam.id,
        group: l.kids.length > 0, p: p, m: m, f: f,
        share: popOf(u) ? p / popOf(u) * 100 : null,
        ofl: india ? p / india * 100 : null,
        sr: m ? Math.round((f || 0) / m * 1000) : null,
        col: l.col || 0, note: !!l.note
      });
    });
  });

  /* controls */
  var sel = $('#unit');
  sel.innerHTML = '<option value="">All units</option>' + UNIT_ORDER.map(function (u) {
    var t = U[u].type, pre = t === 'sub' ? ' ' : '';
    return '<option value="' + u + '">' + pre + esc(U[u].name) + (t === 'total' ? ' (total)' : '') + '</option>';
  }).join('');
  var fams = [];
  L.forEach(function (l) { if (l.parent != null && L[l.parent].parent == null) fams.push(l); });
  $('#fam').innerHTML = '<option value="">All families</option>' + fams.map(function (f) {
    return '<option value="' + f.id + '">' + esc(f.name) + ' — ' + esc(L[f.parent].name.replace(/^[ABC]\. /, '')) + '</option>';
  }).join('');

  var st = { q: '', unit: '', fam: '', level: 'lang', min: 0, noted: false, sort: 'p', dir: -1, page: 0, per: 100 };
  function readHash() {
    location.hash.replace(/^#/, '').split('&').forEach(function (kv) {
      var p = kv.split('='); if (!p[0]) return; var v = decodeURIComponent(p[1] || '');
      if (p[0] in st) st[p[0]] = typeof st[p[0]] === 'number' ? +v : typeof st[p[0]] === 'boolean' ? v === '1' : v;
    });
    $('#q').value = st.q; sel.value = st.unit; $('#fam').value = st.fam; $('#level').value = st.level;
    $('#min').value = st.min; $('#noted').checked = st.noted; $('#per').value = String(st.per);
  }
  function writeHash() {
    var d = { q: '', unit: '', fam: '', level: 'lang', min: 0, noted: false, sort: 'p', dir: -1, page: 0, per: 100 };
    var h = Object.keys(st).filter(function (k) { return st[k] !== d[k]; }).map(function (k) {
      return k + '=' + encodeURIComponent(typeof st[k] === 'boolean' ? (st[k] ? 1 : 0) : st[k]);
    }).join('&');
    try { history.replaceState(null, '', h ? '#' + h : location.pathname); } catch (e) { }
  }

  var filtered = [];
  function apply() {
    var words = norm(st.q.trim()).split(/\s+/).filter(Boolean);
    var famId = st.fam === '' ? null : +st.fam;
    filtered = ROWS.filter(function (r) {
      if (st.unit ? r.u !== st.unit : U[r.u].type === 'sub') return false;   // sub-rows only when asked for
      if (st.level === 'lang' && r.group) return false;
      if (st.level === 'group' && !r.group) return false;
      if (famId != null && r.fam !== famId && r.l.id !== famId) return false;
      if (st.min && r.p < st.min) return false;
      if (st.noted && !r.note) return false;
      for (var i = 0; i < words.length; i++) if (r.s.indexOf(words[i]) < 0) return false;
      return true;
    });
    var k = st.sort, d = st.dir;
    filtered.sort(function (a, b) {
      var x = a[k], y = b[k];
      if (k === 'unit') { x = a.ui; y = b.ui; }
      if (k === 'name') return a.name.localeCompare(b.name) * d || a.ui - b.ui;
      if (x == null) x = -Infinity; if (y == null) y = -Infinity;
      return (x - y) * d || a.ui - b.ui;
    });
    var pages = Math.max(1, Math.ceil(filtered.length / st.per));
    if (st.page >= pages) st.page = pages - 1;
    render(pages);
    writeHash();
  }

  function sourceCell(r) {
    var l = r.l;
    if (l.col) {
      return '<a href="' + IA + l.leaf + '/mode/1up" target="_blank" rel="noopener" title="Open scan leaf ' + l.leaf + ' (printed p. ' + l.page + ')">p.&nbsp;' + l.page + '</a> <span class="cols">cols ' + l.col + '–' + (l.col + 2) + '</span>';
    }
    var s = srcNode(l);
    return '<span class="flag sum" title="Not printed: sum of the group’s members">Σ</span>' + (s ? ' <a href="' + IA + s.leaf + '/mode/1up" target="_blank" rel="noopener" title="Members begin on printed p. ' + s.page + '">from p.&nbsp;' + s.page + '</a>' : '');
  }
  function render(pages) {
    var a = st.page * st.per, rows = filtered.slice(a, a + st.per);
    $('#count').textContent = fmtW.format(filtered.length) + ' rows' + (filtered.length ? ', showing ' + fmtW.format(a + 1) + '–' + fmtW.format(a + rows.length) : '');
    $('#pageinfo').textContent = 'Page ' + (st.page + 1) + ' of ' + pages;
    $('#prev').disabled = st.page === 0; $('#next').disabled = st.page >= pages - 1;
    $('#rows').innerHTML = rows.length ? rows.map(function (r, i) {
      var ty = U[r.u].type;
      return '<tr class="' + (ty === 'total' ? 'tot' : ty === 'sub' ? 'sub' : '') + '">' +
        '<td class="nm"><span class="n">' + esc(r.name) + (r.group ? ' <small>(group)</small>' : '') +
        (r.note ? ' <button type="button" class="flag" data-note="' + r.l.id + '" title="Transcriber’s note on this printed column">!</button>' : '') +
        '</span><span class="p">' + esc(r.path.split(' › ').slice(0, -1).join(' › ')) + '</span></td>' +
        '<td>' + esc(U[r.u].name) + '</td>' +
        '<td>' + num(r.p) + '</td><td>' + num(r.m) + '</td><td>' + num(r.f) + '</td>' +
        '<td>' + pct(r.share) + '</td><td>' + pct(r.ofl) + '</td><td>' + (r.sr == null ? '' : fmtW.format(r.sr)) + '</td>' +
        '<td class="src">' + sourceCell(r) + '</td></tr>';
    }).join('') : '<tr><td colspan="9" class="empty">No rows match these filters.</td></tr>';
    [].forEach.call(document.querySelectorAll('.browse-table th'), function (th) {
      th.setAttribute('aria-sort', th.getAttribute('data-k') === st.sort ? (st.dir > 0 ? 'ascending' : 'descending') : 'none');
    });
  }

  /* events */
  var timer;
  $('#q').addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { st.q = $('#q').value; st.page = 0; apply(); }, 120); });
  sel.addEventListener('change', function () { st.unit = sel.value; st.page = 0; apply(); });
  $('#fam').addEventListener('change', function () { st.fam = $('#fam').value; st.page = 0; apply(); });
  $('#level').addEventListener('change', function () { st.level = $('#level').value; st.page = 0; apply(); });
  $('#min').addEventListener('input', function () { st.min = Math.max(0, +$('#min').value || 0); st.page = 0; apply(); });
  $('#noted').addEventListener('change', function () { st.noted = $('#noted').checked; st.page = 0; apply(); });
  $('#per').addEventListener('change', function () { st.per = +$('#per').value; st.page = 0; apply(); });
  $('#prev').addEventListener('click', function () { st.page--; apply(); window.scrollTo({ top: $('.tbl-wrap').offsetTop - 80 }); });
  $('#next').addEventListener('click', function () { st.page++; apply(); window.scrollTo({ top: $('.tbl-wrap').offsetTop - 80 }); });
  $('#fmt').addEventListener('change', function () { fmt = $('#fmt').value === 'in' ? fmtIN : fmtW; apply(); });
  $('#reset').addEventListener('click', function () {
    st = { q: '', unit: '', fam: '', level: 'lang', min: 0, noted: false, sort: 'p', dir: -1, page: 0, per: 100 };
    $('#q').value = ''; sel.value = ''; $('#fam').value = ''; $('#level').value = 'lang'; $('#min').value = 0; $('#noted').checked = false; $('#per').value = '100';
    apply();
  });
  document.querySelector('.browse-table thead').addEventListener('click', function (ev) {
    var th = ev.target.closest('th'); if (!th) return;
    var k = th.getAttribute('data-k'); if (k === 'col') k = 'col';
    if (st.sort === k) st.dir = -st.dir; else { st.sort = k; st.dir = (k === 'name' || k === 'unit' || k === 'col') ? 1 : -1; }
    st.page = 0; apply();
  });
  $('#rows').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-note]'); if (!b) return;
    var l = L[+b.getAttribute('data-note')], np = $('#note-panel');
    np.hidden = false;
    np.innerHTML = '<button type="button" class="close btn ghost" aria-label="Close">×</button><h2>' + esc(disp(l)) + '</h2><p class="p">' + esc(pathOf(l).map(function (p) { return p.name; }).join(' › ')) + '</p><p>' + esc(l.note) + '</p>' +
      (l.col ? '<p><a href="' + IA + l.leaf + '/mode/1up" target="_blank" rel="noopener">Open printed p. ' + l.page + ' (cols ' + l.col + '–' + (l.col + 2) + ')</a></p>' : '');
    np.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  $('#note-panel').addEventListener('click', function (ev) { if (ev.target.closest('.close')) this.hidden = true; });
  $('#dl').addEventListener('click', function () {
    var head = ['classification_path', 'name', 'is_group', 'unit_code', 'unit', 'persons', 'males', 'females', 'pct_of_unit', 'pct_of_india_speakers', 'females_per_1000_males', 'table_columns', 'printed_page', 'scan_url', 'note'];
    var q = function (v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [head.join(',')].concat(filtered.map(function (r) {
      var l = r.l;
      return [r.path, r.name, r.group ? 1 : 0, r.u, U[r.u].name, r.p, r.m, r.f, r.share == null ? '' : r.share.toFixed(4), r.ofl == null ? '' : r.ofl.toFixed(4), r.sr,
        l.col ? l.col + '-' + (l.col + 2) : 'sum of members', l.page || '', l.leaf ? IA + l.leaf + '/mode/1up' : '', l.note || ''].map(q).join(',');
    }));
    var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'census1931-table15-filtered.csv';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });

  /* list of printed pages with what is on each */
  var byLeaf = {};
  L.forEach(function (l) { if (l.leaf) (byLeaf[l.leaf] = byLeaf[l.leaf] || { page: l.page, items: [] }).items.push(l); });
  $('#pages').innerHTML = Object.keys(byLeaf).sort(function (a, b) { return a - b; }).map(function (leaf) {
    var P = byLeaf[leaf], items = P.items.sort(function (a, b) { return a.col - b.col; });
    return '<li><a href="' + IA + leaf + '/mode/1up" target="_blank" rel="noopener">p. ' + P.page + '</a> <span class="cols">cols ' + items[0].col + '–' + (items[items.length - 1].col + 2) + '</span> ' +
      items.map(function (l) { return '<a href="#q=' + encodeURIComponent(l.name) + '&level=all" class="plain" data-q="' + esc(l.name) + '">' + esc(disp(l)) + '</a>'; }).join(', ') + '</li>';
  }).join('');
  $('#pages').addEventListener('click', function (ev) {
    var a = ev.target.closest('[data-q]'); if (!a) return; ev.preventDefault();
    st.q = a.getAttribute('data-q'); st.level = 'all'; st.unit = ''; st.fam = ''; st.page = 0;
    $('#q').value = st.q; $('#level').value = 'all'; sel.value = ''; $('#fam').value = '';
    apply(); window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // theme (shared with the map page)
  var root = document.documentElement;
  try { var th = localStorage.getItem('il-theme'); if (th) root.setAttribute('data-theme', th); } catch (e) { }
  $('#btn-theme').addEventListener('click', function () {
    var dark = root.getAttribute('data-theme') ? root.getAttribute('data-theme') === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', dark ? 'light' : 'dark');
    try { localStorage.setItem('il-theme', dark ? 'light' : 'dark'); } catch (e) { }
  });

  readHash();
  apply();
})();
