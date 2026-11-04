import { test } from "node:test";
import assert from "node:assert/strict";
import { moreHref, shownCount } from "./listPaging";
import { cachedVoters, forgetVoters, VOTER_CACHE_MS } from "./voterCache";

test("lists start with 10 rows and grow by the address", () => {
  assert.equal(shownCount(undefined, 400), 10);
  assert.equal(shownCount("30", 400), 30);
  assert.equal(shownCount("5", 400), 10);
  assert.equal(shownCount("999", 42), 42);
  assert.equal(shownCount("abc", 3), 3);
  assert.equal(moreHref({ q: "jain", tab: undefined, gap: "" }, 20), "?q=jain&n=20");
});

test("voter results are reused for a few seconds and cleared after a save", async () => {
  forgetVoters();
  let runs = 0;
  const make = async () => ++runs;
  assert.equal(await cachedVoters(make, 1000), 1);
  assert.equal(await cachedVoters(make, 1000 + VOTER_CACHE_MS - 1), 1);
  assert.equal(await cachedVoters(make, 1000 + VOTER_CACHE_MS + 1), 2);
  forgetVoters();
  assert.equal(await cachedVoters(make, 1000 + VOTER_CACHE_MS + 2), 3);
  forgetVoters();
});
