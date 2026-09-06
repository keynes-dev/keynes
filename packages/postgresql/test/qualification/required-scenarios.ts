import { rootResources } from "@keynes/contracts/contract-tests";
import { randomUUID } from "node:crypto";

import type { Client } from "pg";

import {
  REQUIRED_EXTERNAL_SCENARIOS,
  type ExternalPostgresqlAcceptanceRecord,
} from "./external-record.ts";

export type DatabaseActor =
  | "operator"
  | "administrator"
  | "primary"
  | "replacement"
  | "secondary";

export type TlsRejectionKind = "untrusted-chain" | "hostname-mismatch";

export const QUALIFICATION_IDENTITIES = {
  primaryTenantId: "00000000-0000-4000-8000-000000000021",
  primaryPrincipalId: "00000000-0000-4000-8000-000000000121",
  secondaryTenantId: "00000000-0000-4000-8000-000000000022",
  secondaryPrincipalId: "00000000-0000-4000-8000-000000000122",
} as const;

export interface DatabaseTarget {
  prepare(postgresqlArchivePath: string): Promise<void>;
  qualifySdkArchive(sdkArchivePath: string): Promise<void>;
  inspect(): Promise<{
    readonly target: ExternalPostgresqlAcceptanceRecord["target"];
    readonly semantics: ExternalPostgresqlAcceptanceRecord["semantics"];
  }>;
  connect(actor: DatabaseActor): Promise<Client>;
  closeClient(client: Client): Promise<void>;
  roleName(actor: DatabaseActor): string;
  recreateCredentialRole(actor: "replacement"): Promise<void>;
  inspectAcceptedTls(): Promise<ExternalPostgresqlAcceptanceRecord["tls"]>;
  assertUnsafeTlsModeRejected(): void;
  inspectTlsRejection(kind: TlsRejectionKind): Promise<{
    readonly code: string;
    readonly diagnostics: "secret-safe";
  }>;
  close(): Promise<"passed">;
}

type RemoteProcedure =
  | "keynes.remote_create_budget"
  | "keynes.remote_request"
  | "keynes.remote_settle"
  | "keynes.remote_get_budget"
  | "keynes.remote_open_budget"
  | "keynes.remote_recover_operation"
  | "keynes.remote_get_compatibility";

const TLS_CHAIN_ERROR_CODES = new Set([
  "CERT_UNTRUSTED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);
const TLS_HOSTNAME_ERROR_CODES = new Set(["ERR_TLS_CERT_ALTNAME_INVALID"]);

export async function runRequiredScenarios(
  target: DatabaseTarget,
  sdkArchivePath: string,
  postgresqlArchivePath: string,
): Promise<{
  readonly inspection: Awaited<ReturnType<DatabaseTarget["inspect"]>>;
  readonly scenarios: ExternalPostgresqlAcceptanceRecord["scenarios"];
  readonly tls: ExternalPostgresqlAcceptanceRecord["tls"];
}> {
  try {
    if (sdkArchivePath.length === 0 || postgresqlArchivePath.length === 0) {
      throw new Error("missing exact archive");
    }

    await target.prepare(postgresqlArchivePath);
    const inspection = await target.inspect();
    await target.qualifySdkArchive(sdkArchivePath);
    await runBudgetLifecycle(target);
    await runTenantIsolation(target);
    await runDisableEnable(target);
    await runRotation(target);
    await runRevocation(target);
    await runPrivateAuthorityDenial(target);
    const tls = await target.inspectAcceptedTls();
    target.assertUnsafeTlsModeRejected();
    await requireTlsRejection(target, "untrusted-chain", TLS_CHAIN_ERROR_CODES);
    await requireTlsRejection(
      target,
      "hostname-mismatch",
      TLS_HOSTNAME_ERROR_CODES,
    );

    return {
      inspection,
      scenarios: REQUIRED_EXTERNAL_SCENARIOS.map((id) => ({
        id,
        outcome: "passed" as const,
      })),
      tls,
    };
  } catch {
    throw new Error("required database qualification scenarios failed");
  }
}

async function runBudgetLifecycle(target: DatabaseTarget): Promise<void> {
  const resource = resourceName();
  const createKey = operationKey();
  let client = await target.connect("primary");
  const created = requireOkResult(
    await callRemote(client, "keynes.remote_create_budget", {
      operationKey: createKey,
      ...rootResources([
        { definition: resourceDefinition(resource), amount: 10 },
      ]),
    }),
  );
  const root = requireString(created, "budget", "budgetReference");
  const requested = requireOkResult(
    await callRemote(client, "keynes.remote_request", {
      operationKey: operationKey(),
      parentBudgetReference: root,
      resources: [{ resource, amount: 4 }],
    }),
  );
  const child = requireString(requested, "childBudgetReference");
  requireOkResult(
    await callRemote(client, "keynes.remote_get_budget", {
      budgetReference: child,
    }),
  );
  requireOkResult(
    await callRemote(client, "keynes.remote_settle", {
      operationKey: operationKey(),
      budgetReference: child,
      usage: [{ resource, amount: 4 }],
    }),
  );
  await target.closeClient(client);
  client = await target.connect("primary");
  try {
    requireOkResult(
      await callRemote(client, "keynes.remote_open_budget", {
        budgetReference: root,
        expectedResources: [resourceDefinition(resource)],
      }),
    );
    const recovered = requireOkResult(
      await callRemote(client, "keynes.remote_recover_operation", {
        operationKey: createKey,
      }),
    );
    if (recovered.kind !== "committed") {
      throw new Error("operation was not recoverable");
    }
  } finally {
    await target.closeClient(client);
  }
}

async function runTenantIsolation(target: DatabaseTarget): Promise<void> {
  const primary = await target.connect("primary");
  const secondary = await target.connect("secondary");
  const resource = resourceName();
  const sharedKey = operationKey();
  try {
    const primaryCreated = requireOkResult(
      await callRemote(primary, "keynes.remote_create_budget", {
        operationKey: sharedKey,
        ...rootResources([
          { definition: resourceDefinition(resource), amount: 7 },
        ]),
      }),
    );
    const secondaryCreated = requireOkResult(
      await callRemote(secondary, "keynes.remote_create_budget", {
        operationKey: sharedKey,
        ...rootResources([
          { definition: resourceDefinition(resource), amount: 11 },
        ]),
      }),
    );
    const primaryReference = requireString(
      primaryCreated,
      "budget",
      "budgetReference",
    );
    const secondaryReference = requireString(
      secondaryCreated,
      "budget",
      "budgetReference",
    );
    if (primaryReference === secondaryReference) {
      throw new Error("tenant references were not isolated");
    }
    requireErrorCode(
      await callRemote(secondary, "keynes.remote_get_budget", {
        budgetReference: primaryReference,
      }),
      "unauthorized",
    );
    const primaryBefore = requireOkResult(
      await callRemote(primary, "keynes.remote_get_budget", {
        budgetReference: primaryReference,
      }),
    );
    requireErrorCode(
      await callRemote(secondary, "keynes.remote_request", {
        operationKey: operationKey(),
        parentBudgetReference: primaryReference,
        resources: [{ resource, amount: 1 }],
      }),
      "unauthorized",
    );
    const primaryAfter = requireOkResult(
      await callRemote(primary, "keynes.remote_get_budget", {
        budgetReference: primaryReference,
      }),
    );
    if (JSON.stringify(primaryAfter) !== JSON.stringify(primaryBefore)) {
      throw new Error("cross-tenant denial changed protected state");
    }
    requireOkResult(
      await callRemote(secondary, "keynes.remote_get_budget", {
        budgetReference: secondaryReference,
      }),
    );
  } finally {
    await Promise.all([
      target.closeClient(primary),
      target.closeClient(secondary),
    ]);
  }
}

async function runDisableEnable(target: DatabaseTarget): Promise<void> {
  const primary = await target.connect("primary");
  const administrator = await target.connect("administrator");
  try {
    requireOkResult(
      await callRemote(
        primary,
        "keynes.remote_get_compatibility",
        Object.create(null),
      ),
    );
    await administrator.query(
      "select keynes_internal.set_remote_role_enabled_v0006($1::name, false)",
      [target.roleName("primary")],
    );
    requireErrorCode(
      await callRemote(
        primary,
        "keynes.remote_get_compatibility",
        Object.create(null),
      ),
      "unauthorized",
    );
    await administrator.query(
      "select keynes_internal.set_remote_role_enabled_v0006($1::name, true)",
      [target.roleName("primary")],
    );
    requireOkResult(
      await callRemote(
        primary,
        "keynes.remote_get_compatibility",
        Object.create(null),
      ),
    );
  } finally {
    await Promise.all([
      target.closeClient(primary),
      target.closeClient(administrator),
    ]);
  }
}

async function runRotation(target: DatabaseTarget): Promise<void> {
  const primary = await target.connect("primary");
  const administrator = await target.connect("administrator");
  try {
    await administrator.query(
      "select keynes_internal.rotate_remote_role_v0006($1::name, $2::name)",
      [target.roleName("primary"), target.roleName("replacement")],
    );
    requireErrorCode(
      await callRemote(
        primary,
        "keynes.remote_get_compatibility",
        Object.create(null),
      ),
      "unauthorized",
    );
    const replacement = await target.connect("replacement");
    try {
      requireOkResult(
        await callRemote(
          replacement,
          "keynes.remote_get_compatibility",
          Object.create(null),
        ),
      );
    } finally {
      await target.closeClient(replacement);
    }
  } finally {
    await Promise.all([
      target.closeClient(primary),
      target.closeClient(administrator),
    ]);
  }
}

async function runRevocation(target: DatabaseTarget): Promise<void> {
  const replacement = await target.connect("replacement");
  const administrator = await target.connect("administrator");
  try {
    await administrator.query(
      "select keynes_internal.revoke_remote_role_v0006($1::name)",
      [target.roleName("replacement")],
    );
    requireErrorCode(
      await callRemote(
        replacement,
        "keynes.remote_get_compatibility",
        Object.create(null),
      ),
      "unauthorized",
    );
  } finally {
    await Promise.all([
      target.closeClient(replacement),
      target.closeClient(administrator),
    ]);
  }

  await target.recreateCredentialRole("replacement");
  const administration = await target.connect("administrator");
  try {
    await expectQueryFailure(
      administration,
      "select keynes_internal.register_remote_role_v0006($1::name, $2::uuid, $3::uuid)",
      [
        target.roleName("replacement"),
        QUALIFICATION_IDENTITIES.primaryTenantId,
        QUALIFICATION_IDENTITIES.primaryPrincipalId,
      ],
      "P0001",
      "remote login role is revoked",
    );
    const recreated = await target.connect("replacement");
    try {
      requireErrorCode(
        await callRemote(
          recreated,
          "keynes.remote_get_compatibility",
          Object.create(null),
        ),
        "unauthorized",
      );
    } finally {
      await target.closeClient(recreated);
    }
  } finally {
    await target.closeClient(administration);
  }
}

async function runPrivateAuthorityDenial(
  target: DatabaseTarget,
): Promise<void> {
  const secondary = await target.connect("secondary");
  const operator = await target.connect("operator");
  try {
    const identityKey = operationKey();
    await secondary.query("begin");
    await secondary.query(
      "select set_config('keynes.tenant_id', $1, true), set_config('keynes.principal_id', $2, true)",
      [
        QUALIFICATION_IDENTITIES.primaryTenantId,
        QUALIFICATION_IDENTITIES.primaryPrincipalId,
      ],
    );
    requireOkResult(
      await callRemote(secondary, "keynes.remote_create_budget", {
        operationKey: identityKey,
        ...rootResources([
          {
            definition: resourceDefinition(resourceName()),
            amount: 1,
          },
        ]),
      }),
    );
    await secondary.query("commit");
    const identity = await operator.query<{ readonly tenantId: string }>(
      `select tenant_id::text as "tenantId"
         from keynes_internal.remote_operations
        where operation_key = $1`,
      [identityKey],
    );
    if (
      identity.rows[0]?.tenantId !== QUALIFICATION_IDENTITIES.secondaryTenantId
    ) {
      throw new Error("runtime credential overrode its mapped identity");
    }
    await expectPermissionDenied(
      secondary,
      "select count(*) from keynes_internal.remote_role_mappings",
    );
    await expectPermissionDenied(
      secondary,
      "select keynes_internal.inspect_remote_role_v0006(current_user)",
    );
    await expectPermissionDenied(
      secondary,
      `set role ${identifier(target.roleName("administrator"))}`,
    );
    await expectPermissionDenied(
      secondary,
      "create table keynes.qualification_probe(value integer)",
    );
  } finally {
    await Promise.all([
      target.closeClient(secondary),
      target.closeClient(operator),
    ]);
  }
}

async function requireTlsRejection(
  target: DatabaseTarget,
  kind: TlsRejectionKind,
  acceptedCodes: ReadonlySet<string>,
): Promise<void> {
  const observation = await target.inspectTlsRejection(kind);
  if (
    observation.diagnostics !== "secret-safe" ||
    !acceptedCodes.has(observation.code)
  ) {
    throw new Error("TLS rejection had an unexpected category");
  }
}

async function callRemote(
  client: Client,
  procedure: RemoteProcedure,
  input: unknown,
): Promise<unknown> {
  const result = await client.query<{ readonly response: unknown }>(
    `select ${procedure}($1::jsonb) as response`,
    [input],
  );
  return result.rows[0]?.response;
}

function expectPermissionDenied(
  client: Client,
  statement: string,
): Promise<void> {
  return expectQueryFailure(client, statement, undefined, "42501");
}

async function expectQueryFailure(
  client: Client,
  statement: string,
  parameters: readonly unknown[] | undefined,
  expectedCode: string,
  expectedMessage?: string,
): Promise<void> {
  try {
    await client.query(
      statement,
      parameters === undefined ? undefined : [...parameters],
    );
  } catch (error: unknown) {
    if (
      isRecord(error) &&
      error.code === expectedCode &&
      (expectedMessage === undefined || error.message === expectedMessage)
    ) {
      return;
    }
    throw new Error("query failed for an unexpected reason");
  }
  throw new Error("query unexpectedly retained authority");
}

function requireOkResult(value: unknown): Record<string, unknown> {
  if (!isRecord(value) || value.ok !== true || !isRecord(value.result)) {
    throw new Error("remote operation did not succeed");
  }
  return value.result;
}

function requireErrorCode(value: unknown, expected: string): void {
  if (
    !isRecord(value) ||
    value.ok !== false ||
    !isRecord(value.error) ||
    value.error.code !== expected
  ) {
    throw new Error("remote operation did not return the expected denial");
  }
}

function requireString(
  value: Record<string, unknown>,
  first: string,
  second?: string,
): string {
  const firstValue = value[first];
  const selected =
    second === undefined
      ? firstValue
      : isRecord(firstValue)
        ? firstValue[second]
        : undefined;
  if (typeof selected !== "string") {
    throw new Error("remote operation did not return a required reference");
  }
  return selected;
}

function operationKey(): string {
  return `kop_v1_${randomUUID().replaceAll("-", "").padEnd(43, "x")}`;
}

function resourceName(): string {
  return `qualification_resource${randomUUID().replaceAll("-", "")}`;
}

type ResourceDefinition = Parameters<
  typeof rootResources
>[0][number]["definition"];

function resourceDefinition(canonicalName: string): ResourceDefinition {
  return { canonicalName, unit: "token", accountingBehavior: "consumable" };
}

function identifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
