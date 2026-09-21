# Validation guide: typed policy parameters

KEY-116 implements a private source contract in `packages/policy-parameters`. [The package README](../../../packages/policy-parameters/README.md) contains raw-schema and Zod examples. KEY-117 owns public tooling distribution; this guide makes no archive or publication claim.

## Run the source checks

Use Node.js >=24, pnpm 11.21.0 and the KEY-116 branch. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @keynes/policy-parameters test
pnpm --filter @keynes/policy-parameters typecheck
pnpm test:pr
```

No Docker, Cloud credentials or provider account is needed. Results belong in [acceptance.md](acceptance.md), with the exact commit, host, dependency versions, command outcomes and fixture hashes. Read that record for executed evidence; commands listed here are not themselves proof of a passing run.

## Local declaration and typed access

Run this from `packages/policy-parameters` after installing dependencies:

```sh
node --input-type=module <<'JS'
import assert from "node:assert/strict";
import { createParameterSnapshot, defineParameters } from "./src/index.ts";
const declaration = defineParameters({
  reviewThreshold: { schema: { type: "number", minimum: 0 }, initial: 100 },
  reviewMode: { schema: { enum: ["manual", "automatic"] }, initial: "manual" },
});
const snapshot = createParameterSnapshot(declaration);
assert.equal(snapshot.values.reviewThreshold, 100);
assert.equal(snapshot.values.reviewMode, "manual");
assert.ok(Object.isFrozen(snapshot.values));
JS
```

`test/parameters.test.ts` covers strict JSON capture, schema restrictions, explicit initials, typed declaration provisioning and frozen snapshots. Invalid cases include missing initials, wrong values, unsupported dialects/keywords/references and non-JSON data. Defaults remain annotations and never provision values.

`test/types.ts` compiles inferred numbers and enums, defaulted optional properties, array values and dynamic-schema uncertainty. Expected errors cover wrong values, unknown names, separately declared excess-key inputs and nested mutation. It also covers overrides and adapter descriptors whose schema or initial value is replaced.

## Explicit overrides and fixtures

`test/snapshot.test.ts` verifies whole-value replacement, rejection of incomplete required objects, equal/empty override identities and mutation isolation. It restores the fixed `test/fixtures/snapshot.json` and compares canonical bytes and digests in a fresh Node process. Object-key reordering preserves identity. Array order, values and schema annotations can change it.

Restoration validates the envelope, schemas and identities before comparing the expected definition and validating values. Changed initials have no effect. Tampered payloads, incompatible versions, foreign definitions and hostile JavaScript inputs reject without repair or fallback. Serialize a validated snapshot with `canonicalize(snapshot)`; the helpers perform no file I/O.

## Optional Zod authoring and core isolation

`test/zod.test.ts` compares accepted Zod 4.6.5 declarations with normalized raw schemas and runs value corpora through both validators. Cases cover repeated and exclusive bounds, exact array lengths, Unicode, optional properties and strict object behavior. Unsupported nested refinements, transforms, defaults, coercion, stripping objects, string checks and converter callbacks reject.

`test/core-consumer.test.ts` creates an isolated temporary source consumer from installed dependencies. It checks that no ancestor `node_modules` can provide a fallback and that Zod is absent. The consumer executes declaration/provisioning and restores an actual Zod-authored snapshot using only core imports; its TypeScript program resolves and typechecks there too. A `finally` block removes the temporary directory. This is source dependency isolation, not archive qualification.

## Repository and Spec Kit checks

```sh
SPECIFY_FEATURE_DIRECTORY=docs/features/key-116-declare-typed-policy-parameters .specify/scripts/bash/check-prerequisites.sh --json --require-spec --require-tasks --include-tasks
specify integration status --json
pnpm exec oxfmt --check packages/policy-parameters docs/features/key-116-declare-typed-policy-parameters
pnpm test:repository
git diff --check
```

The acceptance record retains earlier planning-only results separately from implementation evidence. Native PostgreSQL, shared Budget conformance, installed archives, Cloud behavior and performance qualification remain separate lanes. No provider-free result here qualifies Local preview publication.
