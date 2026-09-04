---
description: "Validate the active Keynes feature identity"
---

# Validate the feature identity

Git is required. The current branch must match the exact branch stored from Linear.

Run:

```bash
node .specify/scripts/feature-identity.mjs active --json
```

The command succeeds only when the current branch, version 3 manifest, branch-final-segment feature directory, exact Linear title, specification header, UUID, URL, and stored branch describe the same feature. The check is offline. It rejects malformed identities, duplicate keys, UUIDs, branches, missing artifacts, and mismatches.
