// Per-docket static pages: which comment letters a page quotes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickRepresentative } from "../tools/build-docket-pages.mjs";

test("a docket page quotes one letter of each stance before repeating any", () => {
  const l = (org, stance) => ({ org, stance });
  const letters = [l("A", "support"), l("B", "support"), l("C", "support"), l("D", "oppose"), l("E", "mixed")];
  assert.deepEqual(pickRepresentative(letters).map((x) => x.org), ["A", "D", "E", "B"]);
  assert.deepEqual(pickRepresentative(letters, 2).map((x) => x.org), ["A", "D"]);
  assert.deepEqual(pickRepresentative([]), []);
});
