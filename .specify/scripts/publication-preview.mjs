#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { resolveActiveFeature } from "./feature-identity.mjs";
import {
  parseUnits,
  planPublication,
  planBlockerChanges,
} from "./issue-bindings.mjs";
try {
  const { values } = parseArgs({
    options: {
      existing: { type: "string" },
      dependencies: { type: "string" },
      select: { type: "string", multiple: true },
    },
  });
  if (!values.existing)
    throw new Error(
      "Provide --existing with a fully paginated child-issue snapshot",
    );
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  }).trim();
  const identity = resolveActiveFeature(root);
  const units = parseUnits(
    readFileSync(join(root, identity.feature_directory, "tasks.md"), "utf8"),
  );
  const existing = JSON.parse(readFileSync(values.existing, "utf8"));
  if (
    !Array.isArray(existing) ||
    existing.some(
      (issue) =>
        typeof issue.uuid !== "string" || typeof issue.title !== "string",
    )
  )
    throw new Error("Expected an array of child issues with UUID and title");
  const publication = planPublication(
    identity,
    units,
    values.select ?? [],
    existing,
  );
  let dependencies = [];
  if (values.dependencies) {
    const snapshot = JSON.parse(readFileSync(values.dependencies, "utf8"));
    const selectedKeys = new Set(
      units
        .filter((unit) =>
          publication.some((item) => item.publicationId === unit.publicationId),
        )
        .map((unit) => unit.issue?.identifier),
    );
    if (snapshot.changes.some((change) => !selectedKeys.has(change.id)))
      throw new Error(
        "Dependency changes must target selected bound sub-issues",
      );
    dependencies = planBlockerChanges(
      identity.feature_id,
      snapshot.issues,
      snapshot.changes,
    );
  }
  process.stdout.write(
    `${JSON.stringify({ publication, dependencies }, null, 2)}\n`,
  );
} catch (error) {
  process.stderr.write(`ERROR: ${error.message}\n`);
  process.exitCode = 1;
}
