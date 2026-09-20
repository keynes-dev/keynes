import { createHash, X509Certificate } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TLSSocket } from "node:tls";
import { fileURLToPath } from "node:url";

import { Client } from "pg";
import { providerFreeEnvironment } from "@keynes/testkit/package";

import {
  installPostgresqlArchive,
  runPackedPostgresql,
} from "../support/packed-package.ts";
import type { ExternalPostgresqlProfile } from "./external-profile.ts";
import type { ExternalPostgresqlAcceptanceRecord } from "./external-record.ts";
import {
  QUALIFICATION_IDENTITIES,
  type DatabaseActor,
  type DatabaseTarget,
  type TlsRejectionKind,
} from "./required-scenarios.ts";

export const EXTERNAL_TARGET_ENVIRONMENT_KEYS = [
  "KEYNES_EXTERNAL_OPERATOR_URL",
  "KEYNES_EXTERNAL_ADMIN_URL",
  "KEYNES_EXTERNAL_PRIMARY_URL",
  "KEYNES_EXTERNAL_REPLACEMENT_URL",
  "KEYNES_EXTERNAL_SECONDARY_URL",
  "KEYNES_EXTERNAL_UNTRUSTED_CA_URL",
  "KEYNES_EXTERNAL_HOSTNAME_MISMATCH_URL",
] as const;

export interface ExternalTargetEnvironment {
  readonly operator: URL;
  readonly administrator: URL;
  readonly primary: URL;
  readonly replacement: URL;
  readonly secondary: URL;
  readonly untrustedCa: URL;
  readonly hostnameMismatch: URL;
}

type TargetStage =
  | "preparation"
  | "SDK archive qualification"
  | "inspection"
  | "accepted TLS inspection"
  | "TLS rejection inspection"
  | "credential recreation"
  | "cleanup";

const OWNER_ROLE = "keynes_owner";
const EXECUTION_ROLE = "keynes_execution";
const ROLE = /^[a-z_][a-z0-9_$]{0,62}$/u;
const REPOSITORY_ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
const SDK_QUALIFIER = fileURLToPath(
  new URL("../../../sdk/test/package/qualify.ts", import.meta.url),
);
const REMOTE_RUNTIME_PROCEDURES = [
  "keynes.remote_create_budget(jsonb)",
  "keynes.remote_request(jsonb)",
  "keynes.remote_settle(jsonb)",
  "keynes.remote_get_budget(jsonb)",
  "keynes.remote_get_budget_history_page(jsonb)",
  "keynes.remote_open_budget(jsonb)",
  "keynes.remote_recover_operation(jsonb)",
  "keynes.remote_get_compatibility(jsonb)",
] as const;

export function parseExternalTargetEnvironment(
  environment: NodeJS.ProcessEnv,
): ExternalTargetEnvironment {
  try {
    const target = {
      operator: parseStrictDatabaseUrl(
        environment.KEYNES_EXTERNAL_OPERATOR_URL,
      ),
      administrator: parseStrictDatabaseUrl(
        environment.KEYNES_EXTERNAL_ADMIN_URL,
      ),
      primary: parseStrictDatabaseUrl(environment.KEYNES_EXTERNAL_PRIMARY_URL),
      replacement: parseStrictDatabaseUrl(
        environment.KEYNES_EXTERNAL_REPLACEMENT_URL,
      ),
      secondary: parseStrictDatabaseUrl(
        environment.KEYNES_EXTERNAL_SECONDARY_URL,
      ),
      untrustedCa: parseStrictDatabaseUrl(
        environment.KEYNES_EXTERNAL_UNTRUSTED_CA_URL,
      ),
      hostnameMismatch: parseStrictDatabaseUrl(
        environment.KEYNES_EXTERNAL_HOSTNAME_MISMATCH_URL,
      ),
    } satisfies ExternalTargetEnvironment;
    const database = target.primary.pathname;
    const runtimeEndpoint = `${target.primary.hostname}:${target.primary.port || "5432"}`;
    if (
      database === "/" ||
      Object.values(target).some((url) => url.pathname !== database) ||
      [
        target.operator,
        target.administrator,
        target.replacement,
        target.secondary,
        target.untrustedCa,
      ].some(
        (url) => `${url.hostname}:${url.port || "5432"}` !== runtimeEndpoint,
      ) ||
      (target.hostnameMismatch.port || "5432") !==
        (target.primary.port || "5432") ||
      target.hostnameMismatch.hostname === target.primary.hostname ||
      target.untrustedCa.searchParams.getAll("sslrootcert").length !== 1 ||
      target.untrustedCa.searchParams.get("sslrootcert") === "" ||
      target.untrustedCa.searchParams.get("sslrootcert") ===
        target.primary.searchParams.get("sslrootcert") ||
      new Set([
        target.operator.username,
        target.administrator.username,
        target.primary.username,
        target.replacement.username,
        target.secondary.username,
      ]).size !== 5 ||
      [
        target.operator,
        target.administrator,
        target.primary,
        target.replacement,
        target.secondary,
      ].some(
        ({ username }) =>
          username === OWNER_ROLE || username === EXECUTION_ROLE,
      )
    ) {
      invalidEnvironment();
    }
    return target;
  } catch {
    invalidEnvironment();
  }
}

export function openExternalQualificationTarget(input: {
  readonly profile: ExternalPostgresqlProfile;
  readonly environment?: NodeJS.ProcessEnv;
}): DatabaseTarget {
  const environment = parseExternalTargetEnvironment(
    input.environment ?? process.env,
  );
  return new ExternalQualificationTarget(input.profile, environment);
}

class ExternalQualificationTarget implements DatabaseTarget {
  readonly #clients = new Set<Client>();
  readonly #profile: ExternalPostgresqlProfile;
  readonly #environment: ExternalTargetEnvironment;
  #closed = false;

  constructor(
    profile: ExternalPostgresqlProfile,
    environment: ExternalTargetEnvironment,
  ) {
    this.#profile = profile;
    this.#environment = environment;
  }

  prepare(postgresqlArchivePath: string): Promise<void> {
    return this.#protect("preparation", async () => {
      this.#requireOpen();
      await this.#installAndPrepare(postgresqlArchivePath);
    });
  }

  qualifySdkArchive(sdkArchivePath: string): Promise<void> {
    return this.#protect("SDK archive qualification", async () => {
      this.#requireOpen();
      qualifySdkArchive(sdkArchivePath, this.#environment.primary);
    });
  }

  connect(actor: DatabaseActor): Promise<Client> {
    this.#requireOpen();
    return this.#connect(this.#environment[actor]);
  }

  closeClient(client: Client): Promise<void> {
    return this.#closeClient(client);
  }

  roleName(actor: DatabaseActor): string {
    return this.#environment[actor].username;
  }

  recreateCredentialRole(actor: "replacement"): Promise<void> {
    return this.#protect("credential recreation", async () => {
      this.#requireOpen();
      const url = this.#environment[actor];
      const role = url.username;
      const operator = await this.#connect(this.#environment.operator);
      try {
        await operator.query(`drop owned by ${identifier(role)}`);
        await operator.query(`drop role ${identifier(role)}`);
        await operator.query(
          `create role ${identifier(role)} login noinherit password ${literal(decodeURIComponent(url.password))}`,
        );
        await operator.query(
          `grant connect on database ${identifier(decodeURIComponent(url.pathname.slice(1)))} to ${identifier(role)}`,
        );
        await operator.query(
          `grant usage on schema keynes to ${identifier(role)}`,
        );
        for (const procedure of REMOTE_RUNTIME_PROCEDURES) {
          await operator.query(
            `grant execute on function ${procedure} to ${identifier(role)}`,
          );
        }
      } finally {
        await this.#closeClient(operator);
      }
    });
  }

  assertUnsafeTlsModeRejected(): void {
    const unsafe = new URL(this.#environment.primary);
    unsafe.searchParams.set("sslmode", "require");
    try {
      parseStrictDatabaseUrl(unsafe.toString());
    } catch {
      return;
    }
    throw new Error("unsafe TLS mode was accepted");
  }

  inspectTlsRejection(kind: TlsRejectionKind): Promise<{
    readonly code: string;
    readonly diagnostics: "secret-safe";
  }> {
    return this.#protect("TLS rejection inspection", async () => {
      this.#requireOpen();
      const url =
        kind === "untrusted-chain"
          ? this.#environment.untrustedCa
          : this.#environment.hostnameMismatch;
      return inspectTlsRejection(
        url,
        kind === "hostname-mismatch"
          ? this.#profile.expectedLeafCertificateSha256
          : undefined,
      );
    });
  }

  inspect(): Promise<{
    readonly target: ExternalPostgresqlAcceptanceRecord["target"];
    readonly semantics: ExternalPostgresqlAcceptanceRecord["semantics"];
  }> {
    return this.#protect("inspection", async () => {
      this.#requireOpen();
      const operator = await this.#connect(this.#environment.operator);
      const primary = await this.#connect(this.#environment.primary);
      try {
        const server = await operator.query<{
          readonly serverVersionNum: string;
        }>(
          "select current_setting('server_version_num') as \"serverVersionNum\"",
        );
        const serverVersionNum = server.rows[0]?.serverVersionNum;
        if (serverVersionNum !== "180006") {
          throw new Error("unexpected server profile");
        }
        const installed = await operator.query<{
          readonly profileId: string;
          readonly contractDigest: string;
          readonly remoteProceduresDigest: string;
          readonly migrationSetDigest: string;
        }>(
          `select profile_id as "profileId",
                  contract_digest as "contractDigest",
                  remote_procedures_digest as "remoteProceduresDigest",
                  migration_set_digest as "migrationSetDigest"
             from keynes_internal.installation_identity
            where singleton = true`,
        );
        const compatible = await primary.query<{
          readonly response: unknown;
        }>("select keynes.remote_get_compatibility($1::jsonb) as response", [
          Object.create(null),
        ]);
        const compatibility = parseCompatibility(compatible.rows[0]?.response);
        const identity = installed.rows[0];
        if (
          identity?.profileId !== compatibility.installationId ||
          identity.contractDigest !== compatibility.contractDigest ||
          identity.remoteProceduresDigest !==
            compatibility.remoteProceduresDigest ||
          !isSha256(identity.migrationSetDigest)
        ) {
          throw new Error("installation identities disagree");
        }
        const inspection: {
          readonly target: ExternalPostgresqlAcceptanceRecord["target"];
          readonly semantics: ExternalPostgresqlAcceptanceRecord["semantics"];
        } = {
          target: {
            provider: this.#profile.provider,
            serverProfile: this.#profile.serverProfile,
            serverVersionNum,
            hostClass: this.#profile.hostClass,
            topology: this.#profile.topology,
            downstreamTlsOwner: this.#profile.downstreamTlsOwner,
          },
          semantics: {
            installationIdentitySha256: sha256(compatibility.installationId),
            contractDigest: compatibility.contractDigest,
            remoteProcedureIdentitySha256: compatibility.remoteProceduresDigest,
            migrationSetDigest: identity.migrationSetDigest,
            remoteProcedureCount: 10,
          },
        };
        return inspection;
      } finally {
        await Promise.all([
          this.#closeClient(operator),
          this.#closeClient(primary),
        ]);
      }
    });
  }

  async #installAndPrepare(postgresqlArchivePath: string): Promise<void> {
    const safeEnvironment = providerFreeEnvironment(process.env);
    const installed = await installPostgresqlArchive(
      postgresqlArchivePath,
      undefined,
      undefined,
      safeEnvironment,
    );
    const configRoot = await mkdtemp(join(tmpdir(), "keynes-external-config-"));
    try {
      const configPath = join(configRoot, "installation.json");
      await writeFile(
        configPath,
        `${JSON.stringify({
          ownerRole: OWNER_ROLE,
          executionRole: EXECUTION_ROLE,
          administrationRole: this.#environment.administrator.username,
          applicationRole: this.#environment.primary.username,
          tenantId: QUALIFICATION_IDENTITIES.primaryTenantId,
          principalId: QUALIFICATION_IDENTITIES.primaryPrincipalId,
        })}\n`,
        { mode: 0o600 },
      );
      const result = runPackedPostgresql(
        installed.commandPath,
        ["install", "--config", configPath],
        postgresEnvironment(this.#environment.operator, safeEnvironment),
      );
      if (result.status !== 0 || !isSuccessfulInstallation(result.stdout)) {
        throw new Error("exact PostgreSQL archive installation failed");
      }
      await this.#prepareAdditionalRuntimeRoles();
    } finally {
      await Promise.all([
        installed.close(),
        rm(configRoot, { recursive: true, force: true }),
      ]);
    }
  }

  async #prepareAdditionalRuntimeRoles(): Promise<void> {
    const operator = await this.#connect(this.#environment.operator);
    const administrator = await this.#connect(this.#environment.administrator);
    try {
      for (const url of [
        this.#environment.replacement,
        this.#environment.secondary,
      ]) {
        await operator.query(
          `grant usage on schema keynes to ${identifier(url.username)}`,
        );
        for (const procedure of REMOTE_RUNTIME_PROCEDURES) {
          await operator.query(
            `grant execute on function ${procedure} to ${identifier(url.username)}`,
          );
        }
      }
      for (const permission of [
        "create_root_budget",
        "define_resource_type",
        "read_budget",
        "request_budget",
        "settle_budget",
      ]) {
        await operator.query(
          `insert into keynes_internal.principal_permissions
             (tenant_id, principal_id, permission)
           values ($1::uuid, $2::uuid, $3)
           on conflict do nothing`,
          [
            QUALIFICATION_IDENTITIES.secondaryTenantId,
            QUALIFICATION_IDENTITIES.secondaryPrincipalId,
            permission,
          ],
        );
      }
      await administrator.query(
        "select keynes_internal.register_remote_role_v0006($1::name, $2::uuid, $3::uuid)",
        [
          this.#environment.secondary.username,
          QUALIFICATION_IDENTITIES.secondaryTenantId,
          QUALIFICATION_IDENTITIES.secondaryPrincipalId,
        ],
      );
    } finally {
      await Promise.all([
        this.#closeClient(operator),
        this.#closeClient(administrator),
      ]);
    }
  }

  inspectAcceptedTls(): Promise<ExternalPostgresqlAcceptanceRecord["tls"]> {
    return this.#protect("accepted TLS inspection", async () => {
      this.#requireOpen();
      return this.#inspectAcceptedTls();
    });
  }

  close(): Promise<"passed"> {
    return this.#protect("cleanup", async () => {
      if (this.#closed) return "passed" as const;
      this.#closed = true;
      await Promise.all([...this.#clients].map((client) => client.end()));
      this.#clients.clear();
      return "passed" as const;
    });
  }

  async #inspectAcceptedTls(): Promise<
    ExternalPostgresqlAcceptanceRecord["tls"]
  > {
    const client = await this.#connect(this.#environment.primary);
    try {
      const result = await client.query<{
        readonly ssl: boolean;
        readonly version: string | null;
        readonly cipher: string | null;
        readonly bits: number | null;
      }>(
        `select ssl, version, cipher, bits
           from pg_stat_ssl
          where pid = pg_backend_pid()`,
      );
      const row = result.rows[0];
      if (
        row?.ssl !== true ||
        typeof row.version !== "string" ||
        typeof row.cipher !== "string" ||
        !Number.isInteger(row.bits) ||
        row.bits === null ||
        row.bits <= 0
      ) {
        throw new Error("database did not report an accepted TLS session");
      }
      const stream = client.connection.stream;
      if (!(stream instanceof TLSSocket) || !stream.authorized) {
        throw new Error("connection stream is not authorized TLS");
      }
      const protocol = stream.getProtocol();
      const peer = stream.getPeerX509Certificate();
      if (protocol === null || peer === undefined) {
        throw new Error("accepted TLS identity is unavailable");
      }
      const certificate = new X509Certificate(peer.raw);
      const issuer = peer.issuerCertificate;
      if (
        issuer === undefined ||
        !certificateMatchesHost(certificate, this.#environment.primary.hostname)
      ) {
        throw new Error("accepted TLS identity is incomplete");
      }
      const leafCertificateSha256 = fingerprint(certificate);
      if (
        leafCertificateSha256 !== this.#profile.expectedLeafCertificateSha256
      ) {
        throw new Error("accepted TLS identity does not match profile");
      }
      if (protocol !== row.version) {
        throw new Error("TLS observations disagree");
      }
      return {
        protocol,
        cipher: row.cipher,
        keyBits: row.bits,
        leafCertificateSha256,
        issuerCertificateSha256: fingerprint(issuer),
        validFrom: isoDate(certificate.validFrom),
        validTo: isoDate(certificate.validTo),
        hostnameVerification: "passed",
      };
    } finally {
      await this.#closeClient(client);
    }
  }

  async #connect(url: URL): Promise<Client> {
    const client = new Client({ connectionString: url.toString() });
    try {
      await client.connect();
    } catch (error: unknown) {
      await client.end().catch(() => undefined);
      throw error;
    }
    this.#clients.add(client);
    return client;
  }

  async #closeClient(client: Client): Promise<void> {
    await client.end();
    this.#clients.delete(client);
  }

  #requireOpen(): void {
    if (this.#closed) throw new Error("target is closed");
  }

  async #protect<Result>(
    stage: TargetStage,
    operation: () => Promise<Result>,
  ): Promise<Result> {
    try {
      return await operation();
    } catch {
      throw new Error(`external qualification target failed: ${stage}`);
    }
  }
}

function parseStrictDatabaseUrl(value: string | undefined): URL {
  if (value === undefined) invalidEnvironment();
  const url = new URL(value);
  if (
    url.protocol !== "postgresql:" ||
    url.hostname.length === 0 ||
    url.username.length === 0 ||
    url.password.length === 0 ||
    url.hash.length > 0 ||
    url.searchParams.getAll("sslmode").length !== 1 ||
    url.searchParams.get("sslmode") !== "verify-full" ||
    [...url.searchParams.keys()].some(
      (name) => name !== "sslmode" && name !== "sslrootcert",
    ) ||
    !ROLE.test(url.username)
  ) {
    invalidEnvironment();
  }
  return url;
}

function qualificationTarget(url: URL): string {
  return `${url.username}@${url.hostname}:${url.port || "5432"}${decodeURIComponent(url.pathname)}`;
}

function qualifySdkArchive(archivePath: string, databaseUrl: URL): void {
  const secret = databaseUrl.toString();
  const result = spawnSync(
    process.execPath,
    [SDK_QUALIFIER, "--archive", archivePath, "--authorized-database"],
    {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
      env: {
        ...providerFreeEnvironment(process.env),
        CI: "true",
        KEYNES_DATABASE_URL: secret,
        KEYNES_QUALIFICATION_TARGET: qualificationTarget(databaseUrl),
      },
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120_000,
    },
  );
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    const output = `${result.stderr || result.stdout}`.replaceAll(
      secret,
      "[REDACTED]",
    );
    throw new Error(`exact SDK archive qualification failed\n${output}`);
  }
}

function postgresEnvironment(
  url: URL,
  environment: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const rootCertificate = url.searchParams.get("sslrootcert");
  return {
    ...environment,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: "verify-full",
    ...(rootCertificate === null ? {} : { PGSSLROOTCERT: rootCertificate }),
  };
}

function isSuccessfulInstallation(stdout: string): boolean {
  let value: unknown;
  try {
    value = JSON.parse(stdout);
  } catch {
    return false;
  }
  return (
    isRecord(value) &&
    value.ok === true &&
    (value.outcome === "installed" || value.outcome === "already-installed")
  );
}

function invalidEnvironment(): never {
  throw new Error("invalid external target environment");
}

async function inspectTlsRejection(
  url: URL,
  expectedLeafCertificateSha256?: string,
): Promise<{
  readonly code: string;
  readonly diagnostics: "secret-safe";
}> {
  const client = new Client({ connectionString: url.toString() });
  try {
    await client.connect();
  } catch (error: unknown) {
    assertFailureDoesNotDiscloseCredential(error, url);
    await client.end().catch(() => undefined);
    if (isRecord(error) && typeof error.code === "string") {
      if (
        expectedLeafCertificateSha256 !== undefined &&
        peerFingerprintFromTlsError(error) !== expectedLeafCertificateSha256
      ) {
        throw new Error("TLS rejection peer identity did not match profile");
      }
      return { code: error.code, diagnostics: "secret-safe" };
    }
    throw new Error("external TLS rejection had no error code");
  }
  await client.end();
  throw new Error("external TLS rejection endpoint connected");
}

function assertFailureDoesNotDiscloseCredential(
  error: unknown,
  url: URL,
): void {
  const text = diagnosticStrings(error).join("\n");
  const encodedUrl = url.toString();
  const prohibited = [
    encodedUrl,
    decodeURIComponent(encodedUrl),
    url.username,
    decodeURIComponent(url.username),
    url.password,
    decodeURIComponent(url.password),
  ];
  if (prohibited.some((value) => value.length > 0 && text.includes(value))) {
    throw new Error("external TLS failure disclosed credentials");
  }
}

function peerFingerprintFromTlsError(error: Record<string, unknown>): string {
  const certificate = error.cert;
  if (!isRecord(certificate) || !Buffer.isBuffer(certificate.raw)) {
    throw new Error("TLS rejection peer identity was unavailable");
  }
  return fingerprint(new X509Certificate(certificate.raw));
}

function diagnosticStrings(value: unknown): readonly string[] {
  const strings: string[] = [];
  const pending: unknown[] = [value];
  const visited = new Set<object>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current === "string") {
      strings.push(current);
      continue;
    }
    if (
      typeof current !== "object" ||
      current === null ||
      Buffer.isBuffer(current) ||
      visited.has(current)
    ) {
      continue;
    }
    visited.add(current);
    for (const name of Object.getOwnPropertyNames(current)) {
      try {
        pending.push(Reflect.get(current, name));
      } catch {
        throw new Error("external TLS failure diagnostics were unreadable");
      }
    }
  }
  return strings;
}

function parseCompatibility(value: unknown): {
  readonly installationId: string;
  readonly contractDigest: string;
  readonly remoteProceduresDigest: string;
} {
  const result = requireOkResult(value);
  const installationId = result.installationId;
  const contractDigest = result.contractDigest;
  const remoteProceduresDigest = result.remoteProceduresDigest;
  const procedures = result.procedures;
  if (
    typeof installationId !== "string" ||
    !isSha256(contractDigest) ||
    !isSha256(remoteProceduresDigest) ||
    !Array.isArray(procedures) ||
    procedures.length !== 10
  ) {
    throw new Error("invalid compatibility identity");
  }
  return {
    installationId,
    contractDigest,
    remoteProceduresDigest,
  };
}

function requireOkResult(value: unknown): Record<string, unknown> {
  if (!isRecord(value) || value.ok !== true || !isRecord(value.result)) {
    throw new Error("remote operation did not succeed");
  }
  return value.result;
}

function identifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function certificateMatchesHost(
  certificate: X509Certificate,
  hostname: string,
): boolean {
  return isIP(hostname) === 0
    ? certificate.checkHost(hostname) !== undefined
    : certificate.checkIP(hostname) !== undefined;
}

function fingerprint(certificate: X509Certificate): string {
  return certificate.fingerprint256.replaceAll(":", "").toLowerCase();
}

function isoDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw new Error("invalid certificate date");
  return date.toISOString();
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
