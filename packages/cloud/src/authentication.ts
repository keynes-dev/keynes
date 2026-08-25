import { createHash } from "node:crypto";

export interface AuthenticatedIdentity {
  readonly tenantId: string;
  readonly principalId: string;
}

export interface IdentityBinding extends AuthenticatedIdentity {
  readonly tokenSha256: string;
}

export type AuthenticateBearer = (
  authorization: string | readonly string[] | undefined,
) => AuthenticatedIdentity | undefined;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const BEARER_PATTERN = /^Bearer ([!-~]+)$/;

export function createBearerAuthenticator(source: unknown): AuthenticateBearer {
  const bindings = parseIdentityBindings(source);
  const identities = new Map<string, AuthenticatedIdentity>();
  for (const binding of bindings) {
    if (identities.has(binding.tokenSha256)) {
      throw new Error("Duplicate token digest in Cloud identity registry");
    }
    identities.set(binding.tokenSha256, {
      tenantId: binding.tenantId,
      principalId: binding.principalId,
    });
  }

  return (authorization) => {
    if (typeof authorization !== "string") return undefined;
    const token = BEARER_PATTERN.exec(authorization)?.[1];
    if (token === undefined) return undefined;
    const digest = createHash("sha256").update(token).digest("hex");
    return identities.get(digest);
  };
}

export function parseIdentityBindings(
  source: unknown,
): readonly IdentityBinding[] {
  if (!Array.isArray(source)) throw invalidRegistry();
  return source.map((value) => {
    if (!isRecord(value)) throw invalidRegistry();
    const keys = Object.keys(value).sort();
    if (
      keys.length !== 3 ||
      keys[0] !== "principalId" ||
      keys[1] !== "tenantId" ||
      keys[2] !== "tokenSha256" ||
      typeof value.tokenSha256 !== "string" ||
      typeof value.tenantId !== "string" ||
      typeof value.principalId !== "string" ||
      !SHA256_PATTERN.test(value.tokenSha256) ||
      !UUID_PATTERN.test(value.tenantId) ||
      !UUID_PATTERN.test(value.principalId)
    ) {
      throw invalidRegistry();
    }
    return {
      tokenSha256: value.tokenSha256,
      tenantId: value.tenantId,
      principalId: value.principalId,
    };
  });
}

function invalidRegistry(): Error {
  return new Error("Invalid Cloud identity registry");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
