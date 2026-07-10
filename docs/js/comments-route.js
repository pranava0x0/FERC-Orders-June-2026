/* comments-route.js — parse/serialize the Comments-tab hash route.
   One helper, shared by app.js (browser global) and the node test suite, so the grammar
   has a single source of truth and a round-trip test can guard it.

   Grammar — the part of the hash after "#comments":
     (empty)                       -> the default sub-tab (overview)
     /<sub>                        -> a sub-tab id (overview | types | summaries | …)
     /c=<accession>                -> a row permalink (implies the All-comments sub)
     /<sub>?k=v&k2=v2              -> a sub-tab plus readable state (filters, an issue id)

   Readable on purpose: these URLs get pasted into emails and briefs. */
(function (g) {
  "use strict";
  // Known sub-tab ids, in tablist order. Extended as the Who-filed view lands.
  var SUBS = ["overview", "issue", "types", "summaries"];
  var DEFAULT_SUB = "overview";

  function parseQuery(s) {
    var out = {};
    if (!s) return out;
    s.split("&").forEach(function (pair) {
      if (!pair) return;
      var i = pair.indexOf("=");
      var k = i < 0 ? pair : pair.slice(0, i);
      var v = i < 0 ? "" : pair.slice(i + 1);
      if (k) out[decodeURIComponent(k)] = decodeURIComponent(v);
    });
    return out;
  }
  // Stable key order so serialize is deterministic (the round-trip test depends on it).
  function serializeQuery(params) {
    var keys = Object.keys(params || {}).filter(function (k) {
      return params[k] != null && params[k] !== "";
    }).sort();
    return keys.map(function (k) {
      return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]);
    }).join("&");
  }

  // rest = the hash with the leading "#comments" already stripped (may start with "/").
  function parse(rest) {
    var state = { sub: DEFAULT_SUB, acc: null, params: {} };
    if (!rest) return state;
    rest = String(rest).replace(/^\//, "");
    var qi = rest.indexOf("?");
    var path = qi < 0 ? rest : rest.slice(0, qi);
    var query = qi < 0 ? "" : rest.slice(qi + 1);
    if (/^c=/.test(path)) {
      state.acc = decodeURIComponent(path.slice(2));
      state.sub = "summaries"; // a permalink opens the All-comments list
    } else if (path) {
      state.sub = decodeURIComponent(path);
    }
    state.params = parseQuery(query);
    return state;
  }

  // Returns the full hash body including the "comments" tab prefix (no leading "#").
  function serialize(state) {
    state = state || {};
    if (state.acc) return "comments/c=" + encodeURIComponent(state.acc);
    var sub = state.sub || DEFAULT_SUB;
    var q = serializeQuery(state.params);
    // The default sub with no state serializes to a bare "#comments" (back-compatible, cleanest).
    var seg = sub === DEFAULT_SUB && !q ? "" : "/" + sub;
    return "comments" + seg + (q ? "?" + q : "");
  }

  g.CommentsRoute = { parse: parse, serialize: serialize, SUBS: SUBS, DEFAULT_SUB: DEFAULT_SUB };
})(typeof window !== "undefined" ? window : globalThis);
