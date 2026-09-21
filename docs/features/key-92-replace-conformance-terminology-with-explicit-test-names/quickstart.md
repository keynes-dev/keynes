# Validation guide

Use Node 24 or 26, pnpm 11.21.0, and a running Docker engine. From the selected worktree:

```sh
pnpm install --frozen-lockfile
pnpm test:pr
pnpm format
pnpm test:sqlite-postgres -- --output ".artifacts/sqlite-postgres/$(node -p 'crypto.randomUUID()')"
```

Expect all scenarios to pass, shared names to agree, cleanup to succeed, and manifest.json to use keynes.sqlite-postgres/v1. Review retained hashes and sanitized reports. Do not reuse an output directory. Hosted checks and required policy require separately authorized publication and readback; local success does not prove hosted enforcement.
