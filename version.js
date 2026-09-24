/* Site version and last-update date, shown at the foot of every page. Bump both on each release
 * (see "Versions" in README.md). */
(function () {
  var SITE = { version: '2.0', updated: '24 September 2026' };
  window.SITE = SITE;
  function fill() {
    [].forEach.call(document.querySelectorAll('.version'), function (el) {
      el.innerHTML = 'Version ' + SITE.version + ' · last updated ' + SITE.updated +
        ' · <a href="https://github.com/kmlawson/playground-india-language#versions">what changed</a>';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fill); else fill();
})();
