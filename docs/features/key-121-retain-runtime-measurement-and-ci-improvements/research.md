# Research

## Measurement salvage

Decision: extend main instead of copying the branch controller. Main already records archive SHA, contract digest, source before/after, Node/SQLite versions, raw samples and hard limits. Independent read-only research confirmed the branch changes request-only latency into request-plus-settlement and replaces parser timing with SDK import timing. Preserve those original meanings and add separate startup/throughput observations. Reuse the branch module-load identity check and cached offline installation method with no engine selector.

Alternative rejected: the larger PGlite observation/comparison framework bypasses legacy gates and creates an unnecessary ongoing compatibility obligation.

## CI salvage

Decision: dedicated package qualification remains wired and routine SDK tests exclude package tests. Full paired qualification reuses the existing Local group selection and validates required file coverage before shared comparison. Required check names and PostgreSQL version stay unchanged.

## Historical preservation

PR #61 is closed unmerged at aa3bba840a59086db55bf50aac19fe245225d7a8. Branch and acceptance artifacts remain preserved. Final required CI run 35483464795 passed and had no expiring artifacts; its log and PR metadata were retained locally under .artifacts/key-109/. Historical attempts were not modified. KEY-121 is not fresh qualification for that PGlite revision.
