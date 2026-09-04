import assert from "node:assert/strict";
import test from "node:test";
import { parseUnits } from "../scripts/issue-bindings.mjs";

test("recognizes a partial issue breakdown without numbered phases", () => {
  const units = parseUnits(`## Define the contract
<!-- publication-id: contract -->
**Linear issue**: \`Unpublished\`
**Git branch**: \`Unpublished\`
**Checkpoint**: Generated consumers agree.
`);
  assert.equal(units.length, 1);
  assert.equal(units[0].publicationId, "contract");
});
