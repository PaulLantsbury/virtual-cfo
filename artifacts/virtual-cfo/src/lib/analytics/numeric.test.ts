import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRpcNumber } from "./numeric.ts";

test("legitimate numeric zeros and decimal strings remain valid", () => {
  assert.equal(parseRpcNumber(0), 0);
  assert.equal(parseRpcNumber("0"), 0);
  assert.equal(parseRpcNumber("-120.25"), -120.25);
});

test("missing or malformed database values never become zero", () => {
  for (const value of [null, undefined, "", "  ", [], {}, true, false, "wrong", NaN, Infinity]) {
    assert.equal(parseRpcNumber(value), null);
  }
});
