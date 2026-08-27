# Contract: Policy commands, results, and errors

## Existing operations

FEAT-0012 keeps the five operation names and public PostgreSQL targets:

| Operation        | Target                               | Policy change                                                |
| ---------------- | ------------------------------------ | ------------------------------------------------------------ |
| `defineResource` | `keynes.define_resource_type(jsonb)` | None                                                         |
| `createBudget`   | `keynes.create_budget(jsonb)`        | Optional root Policy set                                     |
| `requestBudget`  | `keynes.request(jsonb)`              | Parent context, optional child Policy set, decision evidence |
| `settleBudget`   | `keynes.settle(jsonb)`               | None; never reevaluates Policy                               |
| `getBudget`      | `keynes.get_budget(jsonb)`           | Governed request history includes evidence                   |

No publish, activate, validate, evaluate, or explain operation is added.

## Command extensions

### Create Budget

```ts
interface CreateBudgetCommand {
  readonly commandId: Uuid;
  readonly resources: ResourceEnvelope;
  readonly policies?: readonly PolicyDefinition[];
}
```

`policies` is the root's complete set. Omission and `[]` have the same meaning and canonicalize to omission. Every declared Policy Resource must resolve to a Resource holding on the new root.

### Request Budget

```ts
interface RequestBudgetCommand {
  readonly commandId: Uuid;
  readonly parentBudgetId: Uuid;
  readonly resources: ResourceEnvelope;
  readonly context?: Readonly<Record<string, PolicyScalar>>;
  readonly childPolicies?: readonly PolicyDefinition[];
}
```

`context` is required exactly when the parent has a non-empty Policy set. It must match that set's exact shared schema. `childPolicies` is the complete immutable set for an approved child. Omission and `[]` canonicalize to omission. A denied request creates no child, so the candidates remain only in the command body and replay identity.

Context and child Policy definitions participate in canonical command identity. Object-key order, declaration order, Policy-set order, and an explicitly empty set do not. A completed command identity reused with different canonical context or child Policies returns the existing `command_conflict` error.

## Replay order

Each runtime performs contract-shape validation before storage, then:

1. canonicalizes the command body;
2. authorizes and binds the command identity;
3. returns an exact stored result immediately when the operation and body match; and
4. only for a new command, performs semantic Policy-set validation, context validation, snapshot construction, and evaluation.

Replay returns the stored result, context, Policy identities, rows, reasons, and replay flag. It does not parse Policy source, revalidate a newer profile, call the evaluator, read application data, or observe current availability.

## Governed results

Ungoverned approved and denied results retain their exact existing shape. Governed variants add:

```ts
interface PolicyEvidence {
  readonly context: Readonly<Record<string, PolicyScalar>>;
  readonly policies: readonly {
    readonly name: string;
    readonly revision: number;
    readonly sourceDigest: Digest;
    readonly definitionDigest: Digest;
    readonly rows: readonly PolicyResultRow[];
  }[];
  readonly effectiveCeilings: readonly {
    readonly resourceTypeId: Uuid;
    readonly ceiling: Amount;
    readonly reasons: readonly {
      readonly policyName: string;
      readonly policyRevision: number;
      readonly reason: string;
    }[];
  }[];
  readonly decision: "approved" | "denied";
}
```

Both `RequestApproved` and `RequestDenied` include `policyEvidence` when the parent has active Policies. The corresponding `request_approved` or `request_denied` history entry includes the same canonical evidence. The Budget projection does not expose attached Policies or request context.

## Denial reasons

Add this union member:

```ts
interface PolicyCeilingReason {
  readonly code: "policy_ceiling";
  readonly resourceTypeId: Uuid;
  readonly requested: Amount;
  readonly ceiling: Amount;
  readonly policyName: string;
  readonly policyRevision: number;
  readonly reason: string;
}
```

The result contains one reason for every Policy tied at the lowest effective ceiling below the request. Existing `insufficient_available` reasons may appear beside Policy reasons. Ordering is by canonical Resource name, code, Policy name, revision, and reason. A denial commits result/history but creates no child and changes no holding.

## Error envelopes

### Invalid Policy

```ts
{
  kind: "error";
  code: "invalid_policy";
  details: {
    operation: "createBudget" | "requestBudget";
    policyName?: string;
    policyRevision?: number;
    path: string;
    rule: string;
  };
}
```

Use for artifact shape, profile/version, declaration, source/program, digest, Policy-set, and attachment failures.

### Invalid Policy context

```ts
{
  kind: "error";
  code: "invalid_policy_context";
  details: {
    operation: "requestBudget";
    path: string;
    rule: "required" |
      "additionalProperties" |
      "type" |
      "null" |
      "encoding" |
      "limit";
  }
}
```

Details never contain context values.

### Policy evaluation failed

```ts
{
  kind: "error";
  code: "policy_evaluation_failed";
  details: {
    operation: "requestBudget";
    policyName: string;
    policyRevision: number;
    category:
      | "limit_exceeded"
      | "arithmetic_overflow"
      | "numeric_domain"
      | "numeric_precision"
      | "invalid_result"
      | "execution_failed";
  };
}
```

Do not include SQL text, context values, stack traces, database messages, relation names, or private identifiers. Do not broadly translate connection, serialization, cancellation, or storage failures into this envelope.

Every new Policy error rolls back the command binding, evidence, child, holding changes, result, and history. It is never converted to approval or denial.

## No-Policy compatibility

For an empty parent and child set:

- high-level one-argument calls produce the same command objects as before;
- direct empty arrays canonicalize away;
- `context` is absent and forbidden;
- results and history omit `policyEvidence`;
- denial reasons remain only existing variants;
- exact command-body and result JSON remain unchanged; and
- Cloud continues to forward the same no-Policy operations.

Golden fixtures must compare the complete legacy command, result, history, replay, and error values rather than checking only status.

## Cloud transport restriction

The neutral command schema supports Policy fields for local and embedded PostgreSQL use. The private Cloud service does not expose that capability in FEAT-0012. It rejects before database invocation:

- `createBudget.policies` when present, including an empty array;
- `requestBudget.context` when present; and
- `requestBudget.childPolicies` when present, including an empty array.

This is a transport capability check, not Policy validation. Cloud does not parse the artifact or return Policy-specific evaluator errors. Remote Policy authoring and submission require a later versioned service contract.
