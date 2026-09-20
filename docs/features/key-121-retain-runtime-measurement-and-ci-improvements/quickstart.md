# Validation

From the repository root with supported Node, pnpm and Docker:

```sh
pnpm install --frozen-lockfile
pnpm --filter @keynes/sdk test:performance
pnpm --filter @keynes/sdk test:package:unit
pnpm test:pr
pnpm test:ci:postgresql
pnpm test:sqlite-postgres -- --output .artifacts/key-121/paired
pnpm --config.node-linker=hoisted --filter @keynes/sdk pack --pack-destination "$PWD/.artifacts/key-121/package"
pnpm --filter @keynes/sdk measure:package -- --archive .artifacts/key-121/package/keynes-sdk-0.0.0.tgz --output .artifacts/key-121/measurement.json
```

Use a clean committed revision and new output paths. Verify preserved limits, exact runtime/source/archive identity, all raw samples and cleanup. Dedicated package tests verify clean archive consumers. Record actual commands/results and digests in acceptance.md; failures and unexecuted lanes remain explicit. This is not final KEY-87/88 qualification.
