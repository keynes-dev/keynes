import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { loadPolicyProfile } from "../packages/contracts/src/load-policy-profile.ts";
import { generateContracts } from "../packages/contracts/scripts/generate.ts";
import { generatePostgresql } from "../packages/postgresql/scripts/generate.ts";
import { generateSdk } from "../packages/sdk/scripts/generate.ts";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: { check: { type: "boolean" } },
  strict: true,
});

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const check = values.check === true;

const contract = await generateContracts({ check, repositoryRoot });
const policyProfile = loadPolicyProfile(
  fileURLToPath(new URL("../packages/contracts", import.meta.url)),
);
await generateSdk({ check, contract, policyProfile, repositoryRoot });
await generatePostgresql({
  check,
  contract,
  policyProfile,
  repositoryRoot,
});
