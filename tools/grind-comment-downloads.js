/* grind-comment-downloads.js — bulk-download RM26-4 comment bodies from FERC eLibrary.
 *
 * This runs IN THE BROWSER, not Node: eLibrary sits behind a Cloudflare/F5 challenge that
 * blocks server-side fetches, and the file links are rendered by an Angular SPA. So we drive
 * a real logged-in-looking Chrome tab — paste this into the DevTools console of any
 * elibrary.ferc.gov tab (or send it via the Control_Chrome `execute_javascript` tool).
 *
 * PREREQUISITE — one-time Chrome setting (otherwise every download past the first is blocked):
 *   chrome://settings/content/automaticDownloads → "Allowed to automatically download multiple
 *   files" → Add → https://elibrary.ferc.gov
 *   (or: site-info icon on an eLibrary tab → Site settings → Automatic downloads → Allow).
 *   Without it, iframe-initiated downloads silently fail — the grinder reports links found but
 *   nothing lands in ~/Downloads.
 *
 * HOW IT WORKS: for each accession it loads /eLibrary/filelist?accession_Number=<acc> into a
 * hidden iframe, waits for the Angular table to render the file links, and clicks every
 * PDF/DOCX link. Chrome saves each as "<accession>_<original name>" in ~/Downloads. A small
 * pool of workers runs concurrently; keep the pool small (2–3) — more iframes bootstrapping
 * Angular at once starves the renderer and pushes the link-wait past its timeout (the main
 * cause of "0 links" failures). The pace delay keeps the request rate gentle on the .gov host.
 *
 * USAGE:
 *   window.__ALL = [ ...accessions... ];                 // e.g. comments not yet downloaded
 *   grindCommentDownloads(window.__ALL, { workers: 3 }); // fire-and-forget; progress in window.__g
 *   // poll: JSON of { done:{acc:fileCount}, fail:[acc], total, finished }
 *   window.__g
 *   // retry the stragglers at lower concurrency + a longer wait:
 *   grindCommentDownloads(window.__g.fail, { workers: 2, waitN: 70 });
 *
 * Then, on the shell side, move + text-extract the downloads and rebuild the audit trail:
 *   python3 tools/organize-comment-files.py     # ~/Downloads → sources/comments/files/<acc>/ + .txt
 *   node    tools/build-comment-audit.mjs        # regenerate the audit index + categorization
 *
 * The accession list is the comment subset of sources/comments/rm26-4-comments.json, minus the
 * directories already present under sources/comments/files/ (see the README in that folder).
 */
function grindCommentDownloads(accessions, opts) {
  opts = opts || {};
  var workers = opts.workers || 3; // concurrent iframes; 2–3 is the sweet spot
  var waitN = opts.waitN || 50; // link-wait polls × 400ms (50 = 20s) before giving up on an accession
  var pace = opts.pace == null ? 2000 : opts.pace; // ms a worker idles between accessions (host politeness)
  var fileRe = /\.(pdf|docx?|txt)$/i; // some filers submit a plain-text body (eLibrary names it "<id>.txt")

  window.__g = { done: {}, fail: [], total: accessions.length, finished: false };
  var i = 0;
  var next = async function () {
    while (i < accessions.length) {
      var acc = accessions[i++];
      var f = document.createElement("iframe");
      f.className = "__gf";
      f.style.cssText = "position:fixed;left:-9999px;width:800px;height:600px";
      document.body.appendChild(f);
      try {
        await new Promise(function (res) {
          f.onload = function () { res(); };
          f.src = "/eLibrary/filelist?accession_Number=" + acc + "&optimized=false";
        });
        var links = [];
        for (var t = 0; t < waitN; t++) {
          await new Promise(function (r) { setTimeout(r, 400); });
          var d;
          try { d = f.contentDocument; } catch (e) { break; } // navigated away / detached
          if (d) {
            links = [].slice.call(d.querySelectorAll("a")).filter(function (a) {
              return fileRe.test((a.innerText || "").trim());
            });
            if (links.length) break;
          }
        }
        for (var k = 0; k < links.length; k++) {
          links[k].click();
          await new Promise(function (r) { setTimeout(r, 500); });
        }
        if (links.length) window.__g.done[acc] = links.length;
        else window.__g.fail.push(acc); // 0 links: slow render, no file, or a challenge page
      } catch (e) {
        window.__g.fail.push(acc);
      } finally {
        setTimeout(function () { f.remove(); }, 4000); // let the click's download commit first
      }
      await new Promise(function (r) { setTimeout(r, pace); });
    }
  };
  var pool = [];
  for (var w = 0; w < workers; w++) pool.push(next());
  Promise.all(pool).then(function () { window.__g.finished = true; });
  return "grind started: " + accessions.length + " accessions, " + workers + " workers, wait=" + waitN;
}

// expose for console + Control_Chrome use
if (typeof window !== "undefined") window.grindCommentDownloads = grindCommentDownloads;
