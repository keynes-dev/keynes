---
description: "Validate the active Keynes feature identity"
---

# Validate the feature identity

Git is required. The current branch must match `feat/XXXX-kebab-name`.

Run:

```bash
node .specify/scripts/feature-identity.mjs active --json
```

The command succeeds only when the branch, `.specify/feature.json`, `docs/features/XXXX-kebab-name/`, and the specification metadata describe the same feature. It rejects malformed identities, duplicate feature numbers, missing artifacts, and mismatches. There is no prefix lookup, directory override, timestamp form, or no-Git fallback.
