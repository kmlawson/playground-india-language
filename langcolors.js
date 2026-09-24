/* Colours for the "Largest language" maps, shared by the province map (app.js) and the district map
 * (districts-app.js), so a language has the same colour on both.
 *
 * Distance in the 1931 classification becomes distance in colour: each language family takes its own
 * stretch of the hue circle, and within a family the languages present on the map are spread along it in
 * the order of the classification tree, so closely related languages get neighbouring shades.
 *   Indo-European   crimson through orange and amber to olive
 *   Dravidian       greens
 *   Karen           teal (a family of its own in 1931)
 *   Tibeto-Chinese  cyans and blues
 *   Austric         violets and purples
 *   anything else   warm grey
 * Neighbouring shades step through three lightness levels so that adjacent entries stay tellable apart.
 * A lighter tint of the same colour marks a leading language spoken by less than half the unit. */
(function () {
  'use strict';
  var FAMILY_HUES = { 'Indo-European Family': [338, 72], 'Dravidian Family': [100, 160], 'Karen Family': [178, 178], 'Tibeto-Chinese Family': [196, 268], 'Austric Family': [282, 318] };
  var ORDER = ['Indo-European Family', 'Dravidian Family', 'Karen Family', 'Tibeto-Chinese Family', 'Austric Family'];
  var OTHER = [30, 12, 58];

  // Every language that leads a unit on either map, as [position in the classification tree (Vol. I entry id;
  // 268.5 = Hindustani as printed, beside Western Hindi), family]. Shades are spread over this fixed list, so a
  // language has the same colour on both maps. Regenerate it if the data change (see docs/regional.md).
  var UNIVERSE = [[0, null], [9, "Austric Family"], [21, "Austric Family"], [35, "Tibeto-Chinese Family"], [56, "Tibeto-Chinese Family"], [61, "Tibeto-Chinese Family"], [77, "Tibeto-Chinese Family"], [93, "Tibeto-Chinese Family"], [95, "Tibeto-Chinese Family"], [116, "Tibeto-Chinese Family"], [142, "Tibeto-Chinese Family"], [144, "Tibeto-Chinese Family"], [145, "Tibeto-Chinese Family"], [178, "Tibeto-Chinese Family"], [190, "Karen Family"], [211, "Dravidian Family"], [212, "Dravidian Family"], [213, "Dravidian Family"], [221, "Dravidian Family"], [226, "Dravidian Family"], [228, "Dravidian Family"], [233, "Indo-European Family"], [234, "Indo-European Family"], [241, "Indo-European Family"], [242, "Indo-European Family"], [253, "Indo-European Family"], [254, "Indo-European Family"], [256, "Indo-European Family"], [259, "Indo-European Family"], [260, "Indo-European Family"], [261, "Indo-European Family"], [262, "Indo-European Family"], [265, "Indo-European Family"], [268, "Indo-European Family"], [268.5, "Indo-European Family"], [269, "Indo-European Family"], [270, "Indo-European Family"], [271, "Indo-European Family"], [273, "Indo-European Family"], [276, "Indo-European Family"], [277, "Indo-European Family"], [278, "Indo-European Family"]];

  // items: [{ key, family (family name or null), order (position in the classification tree), label }]
  // returns { key: [h, s, l] }
  function assign(items) {
    var slots = {}, out = {};
    UNIVERSE.concat(items.map(function (it) { return [it.order, it.family]; })).forEach(function (x) {
      if (!FAMILY_HUES[x[1]]) return;
      var a = slots[x[1]] = slots[x[1]] || [];
      if (a.indexOf(x[0]) < 0) a.push(x[0]);
    });
    Object.keys(slots).forEach(function (f) { slots[f].sort(function (a, b) { return a - b; }); });
    items.forEach(function (it) {
      var f = FAMILY_HUES[it.family] ? it.family : null;
      if (!f) { out[it.key] = OTHER; return; }
      var list = slots[f], i = list.indexOf(it.order), n = list.length, r = FAMILY_HUES[f], span = ((r[1] - r[0]) % 360 + 360) % 360;
      var h = r[0] + (n === 1 ? span / 2 : span * i / (n - 1));
      out[it.key] = [Math.round(((h % 360) + 360) % 360), [66, 58, 72][i % 3], [44, 34, 56][i % 3]];
    });
    return out;
  }
  function css(c, under) {
    if (!c) return null;
    return under ? 'hsl(' + c[0] + ' ' + Math.max(20, c[1] - 18) + '% ' + Math.min(80, c[2] + 24) + '%)' : 'hsl(' + c[0] + ' ' + c[1] + '% ' + c[2] + '%)';
  }
  // legend: chips grouped by family, each a button that opens that language on the map
  function legend(items, colors, title) {
    var groups = {};
    items.forEach(function (it) { var f = FAMILY_HUES[it.family] ? it.family : 'Other'; (groups[f] = groups[f] || []).push(it); });
    var h = '<div class="ttl">' + title + '</div>';
    ORDER.concat(['Other']).forEach(function (f) {
      if (!groups[f]) return;
      h += '<div class="lc-fam"><span class="lc-name">' + f.replace(' Family', '') + '</span>' + groups[f].sort(function (a, b) { return a.order - b.order; }).map(function (it) {
        return '<button type="button" class="lc-chip" data-lang="' + it.key + '" title="Show ' + it.label.replace(/"/g, '&quot;') + ' on the map"><span class="sw" style="background:' + css(colors[it.key]) + '"></span>' + it.label + '</button>';
      }).join('') + '</div>';
    });
    h += '<div class="row"><span class="sw lc-tints"></span> lighter: the largest language, but under half the population</div>';
    return h;
  }
  // one label per contiguous block of units with the same leading language.
  // units: [{ id, key, nb: [neighbour ids], area, pop, x, y (label point) }]; returns [{ key, anchor id, pop, n }]
  function blocks(units) {
    var byId = {}, seen = {}, out = [];
    units.forEach(function (u) { byId[u.id] = u; });
    units.forEach(function (u) {
      if (seen[u.id] || u.key == null) return;
      var st = [u], comp = []; seen[u.id] = 1;
      while (st.length) {
        var x = st.pop(); comp.push(x);
        (x.nb || []).forEach(function (j) { var y = byId[j]; if (y && !seen[j] && y.key === u.key) { seen[j] = 1; st.push(y); } });
      }
      // anchor: the unit nearest the block's area-weighted centre, so the label sits in the main mass of the block
      var A = 0, cx = 0, cy = 0;
      comp.forEach(function (c) { var w = c.area || 1; A += w; cx += w * c.x; cy += w * c.y; });
      cx /= A; cy /= A;
      var best = comp.reduce(function (a, b) {
        var da = (a.x - cx) * (a.x - cx) + (a.y - cy) * (a.y - cy), db = (b.x - cx) * (b.x - cx) + (b.y - cy) * (b.y - cy);
        return db < da ? b : a;
      });
      out.push({ key: u.key, anchor: best.id, pop: comp.reduce(function (s, c) { return s + (c.pop || 0); }, 0), n: comp.length });
    });
    return out;
  }
  window.LangColors = { assign: assign, css: css, legend: legend, blocks: blocks };
})();
