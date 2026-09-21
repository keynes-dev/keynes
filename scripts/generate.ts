import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { generateContracts } from "../packages/database/scripts/generate.ts";
import { generatePostgresql } from "../packages/postgres/scripts/generate.ts";
import { generateNodeSqlite } from "../packages/node-sqlite/scripts/generate.ts";
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
await generatePostgresql({ check, repositoryRoot });

await generateNodeSqlite({ check, repositoryRoot });
