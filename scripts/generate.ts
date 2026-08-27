import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { generateCloud } from "../apps/cloud/scripts/generate.ts";
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
await generateSdk({ check, contract, repositoryRoot });
const installation = await generatePostgresql({
  check,
  contract,
  repositoryRoot,
});
await generateCloud({ check, contract, installation, repositoryRoot });
