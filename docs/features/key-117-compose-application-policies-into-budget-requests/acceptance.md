# Acceptance evidence: Compose application policies into Budget requests

**Implementation source revision**: `95d38762fd00ca1b4da1934decb3f7c7e5abf681` (`key-117-compose-application-policies-into-budget-requests`; clean before Phase 1 setup writes).

This record is revision-scoped. Phase 1 establishes the failing consumer only;
it does not qualify behavior or installed artifacts.

| Lane              | Result    |
| ----------------- | --------- |
| Provider-free     | `NOT RUN` |
| Local             | `NOT RUN` |
| Native PostgreSQL | `NOT RUN` |
| SDK archive       | `NOT RUN` |
| Toolkit archive   | `NOT RUN` |
| Runtime archive   | `NOT RUN` |
| Live provider     | `NOT RUN` |

## Phase 1 contract consumer

**Command**:

```sh
pnpm --filter @keynes/sdk exec vitest run test/package/qualify.test.ts --maxWorkers=1 --testNamePattern 'imports and typechecks the SDK-only archive'
```

**Outcome**: expected red, exit 1. The packaged SDK-only consumer rejects the
absent `Policy`, `PolicyOutput` and `PolicyResult` exports, the missing
`policy` request option, and the missing `submitted` result wrapper. The
remaining diagnostics are consequences of those missing contracts; no
unrelated consumer or archive error was reported.

**T003**: no toolkit-contract edit required. The consumer confirms the planned
`Policy<ProposalNames, FinalNames>` shape, retains the policy-free
`BudgetRequestResult`, and requires a submitted transformed child to use its
declared final Resource names.
