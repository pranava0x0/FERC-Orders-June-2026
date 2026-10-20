/* extract-abeyance-docs.py --check must run off macOS (Codex, PR 24): DOCX extraction uses macOS textutil,
 * so without it the tool compares DOCX sources word for word with a portable zipfile reader, and says so.
 * This simulates "no textutil" by shadowing shutil.which; it needs python3 (and PyMuPDF for the PDFs). */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const py = (code) => spawnSync("python3", ["-c", code], { cwd: ROOT, encoding: "utf8" });
const ready = py("import fitz").status === 0;

test("--check compares every document without macOS textutil, DOCX word for word", { skip: !ready && "python3 with PyMuPDF not available" }, () => {
  const r = py([
    "import runpy, shutil, sys",
    "orig = shutil.which",
    "shutil.which = lambda n, *a, **k: None if n == 'textutil' else orig(n, *a, **k)",
    "sys.argv = ['extract', '--check']",
    "runpy.run_path('tools/extract-abeyance-docs.py', run_name='__main__')",
  ].join("\n"));
  const out = r.stdout + r.stderr;
  assert.equal(r.status, 0, out);
  const m = out.match(/--check compared (\d+) of (\d+) document/);
  assert.ok(m && m[1] === m[2] && +m[1] > 0, out);
  assert.match(out, /DOCX source\(s\) compared word for word/);
});

test("the portable DOCX comparison keeps case and punctuation, so quote-affecting drift is caught", { skip: !ready && "python3 with PyMuPDF not available" }, () => {
  // Codex, PR 24: lowercasing and stripping punctuation let "Commission" -> "commission" or "20.5" -> "20,5" pass.
  const r = py([
    "import importlib.util",
    "spec = importlib.util.spec_from_file_location('x', 'tools/extract-abeyance-docs.py')",
    "m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)",
    "w = m.words_of",
    "assert w('the Commission found 20.5 MW.') != w('the commission found 20.5 MW.'), 'case'",
    "assert w('the Commission found 20.5 MW.') != w('the Commission found 20,5 MW.'), 'decimal'",
    "assert w('it ends.') != w('it ends?'), 'terminal punctuation'",
    "assert w('a  b\\n c') == w('a b c'), 'layout whitespace folds'",
    "print('ok')",
  ].join("\n"));
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
