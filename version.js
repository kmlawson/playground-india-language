/* Shared by every page: the site version and last-update date (shown at the foot of each page; bump both
 * on each release, see "Versions" in README.md), the number-format switch in the header, and the offset
 * that keeps in-page links below the sticky header. */
(function () {
  // number format: Indian grouping (1,23,456; lakh, crore) or international (123,456; thousand, million)
  var mode = 'in';
  try { if (localStorage.getItem('il-numfmt') === 'intl') mode = 'intl'; } catch (e) { }
  var qm = /[?&]num=(in|intl)\b/.exec(location.search); if (qm) mode = qm[1];      // a link can set it
  var F = { in: new Intl.NumberFormat('en-IN'), intl: new Intl.NumberFormat('en-GB') };
  function fix(x, big) { return x.toFixed(big ? 0 : 1).replace(/\.0$/, ''); }
  window.NUMFMT = {
    mode: function () { return mode; },
    num: function (n) { return n == null ? '–' : F[mode].format(n); },
    compact: function (n) {
      if (mode === 'in') return n >= 0.995e7 ? fix(n / 1e7, n >= 1e8) + ' cr' : n >= 1e5 ? fix(n / 1e5, n >= 1e6) + ' lakh' : n >= 1000 ? Math.round(n / 1000) + 'k' : String(n);
      return n >= 0.9995e9 ? fix(n / 1e9, n >= 1e10) + ' bn' : n >= 0.9995e6 ? fix(n / 1e6, n >= 1e7) + ' m' : n >= 1000 ? Math.round(n / 1000) + 'k' : String(n);
    },
    set: function (m) {
      mode = m === 'intl' ? 'intl' : 'in';
      try { localStorage.setItem('il-numfmt', mode); } catch (e) { }
      label();
      document.dispatchEvent(new CustomEvent('numfmt'));
    }
  };
  function label() {
    var c = document.getElementById('opt-num'); if (c) c.checked = mode === 'in';
    var b = document.getElementById('btn-num'); if (!b) return;
    b.textContent = mode === 'in' ? '1,23,456' : '123,456';
    b.setAttribute('aria-label', 'Number format: ' + (mode === 'in' ? 'Indian (lakh, crore)' : 'international (thousand, million)') + '. Switch');
    b.title = mode === 'in' ? 'Numbers in Indian grouping (1,23,456; lakh and crore). Click for international (123,456).'
      : 'Numbers in international grouping (123,456; thousand and million). Click for Indian (1,23,456).';
  }
  // the switch is a header button on the table pages and a map toggle ("Indian numbering") on the map pages
  function numInit() {
    label();
    var b = document.getElementById('btn-num');
    if (b) b.addEventListener('click', function () { window.NUMFMT.set(mode === 'in' ? 'intl' : 'in'); });
    var c = document.getElementById('opt-num');
    if (c) c.addEventListener('change', function () { window.NUMFMT.set(c.checked ? 'in' : 'intl'); });
  }
  var SITE = { version: '2.2', updated: '24 September 2026' };
  window.SITE = SITE;
  function fill() {
    [].forEach.call(document.querySelectorAll('.version'), function (el) {
      el.innerHTML = 'Version ' + SITE.version + ' · last updated ' + SITE.updated +
        ' · <a href="https://github.com/kmlawson/playground-india-language#versions">what changed</a>';
    });
  }
  // in-page links (#cautions etc.) stop below the sticky header, whose height changes as it wraps
  function pad() {
    var bar = document.getElementById('bar');
    if (bar) document.documentElement.style.scrollPaddingTop = (bar.offsetHeight + 12) + 'px';
  }
  window.addEventListener('resize', pad);
  window.addEventListener('load', function () {
    pad();
    if (location.hash.length > 1) { var t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
  });
  function init() { fill(); pad(); numInit(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
