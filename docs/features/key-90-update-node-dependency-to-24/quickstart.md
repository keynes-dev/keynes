# Validation

Use Node.js 25 on PATH with pnpm 11.21.0. Run from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm test:pr
pnpm build:sdk
pnpm pack:sdk
pnpm test:package:sdk -- --archive .artifacts/package-tests/sdk/keynes-sdk-0.0.0.tgz --output .artifacts/key-90-node25.json
```

Run the same archive through the qualifier on Node.js 24 and the latest available runtime, with distinct output paths. The hosted SDK Package workflow covers all supported operating systems. Exact outcomes belong in acceptance.md; do not reuse old records as current proof.
