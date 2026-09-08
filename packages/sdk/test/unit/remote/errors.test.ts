import { describe, expect, it } from "vitest";

import { REMOTE_CONTRACT } from "../../../src/generated/client.js";
import {
  projectPostgresqlFailure,
  type PostgresqlFailurePhase,
} from "../../../src/remote/errors.js";

const createBudget = REMOTE_CONTRACT.procedures[2];
const getBudget = REMOTE_CONTRACT.procedures[5];
const operationKey = `kop_v1_${"a".repeat(43)}`;

describe("remote PostgreSQL error projection", () => {
  it.each([
    ["certificate", driverError("ERR_TLS_CERT_ALTNAME_INVALID"), "tls_error"],
    ["authentication", driverError("28P01"), "authentication_failed"],
    ["authorization", driverError("42501"), "unauthorized"],
    ["procedure compatibility", driverError("42883"), "compatibility_error"],
    ["connection pressure", driverError("53300"), "rate_limited"],
    ["connection loss", driverError("ECONNRESET"), "unavailable"],
    ["query timeout", driverError("57014"), "timeout"],
    ["unrecognized SQLSTATE", driverError("42P01"), "unknown"],
  ])("allowlists %s without driver detail", (_name, error, code) => {
    const failure = project(error, "acquire");

    expect(failure.error.code).toBe(code);
    expect(JSON.stringify(failure)).not.toMatch(
      /postgresql:\/\/|password|private_table|select|42P01/iu,
    );
  });

  it("includes only stable details for actionable categories", () => {
    expect(project(driverError("42501"), "query")).toEqual({
      ok: false,
      error: {
        kind: "error",
        code: "unauthorized",
        details: {
          operation: "createBudget",
          requiredPermission: "remote_access",
        },
      },
    });
    expect(project(driverError("57014"), "acquire")).toEqual({
      ok: false,
      error: {
        kind: "error",
        code: "timeout",
        details: { operation: "createBudget", operationKey },
      },
    });
    expect(project(driverError("42883"), "query")).toEqual({
      ok: false,
      error: {
        kind: "error",
        code: "compatibility_error",
        details: { category: "remote_procedures" },
      },
    });
  });

  it.each([
    driverError("ECONNRESET"),
    driverError("ETIMEDOUT"),
    new Error("Connection terminated unexpectedly"),
  ])("preserves an uncertain mutation after dispatch", (error) => {
    expect(project(error, "query")).toEqual({
      ok: false,
      error: {
        kind: "error",
        code: "uncertain_outcome",
        details: { operation: "createBudget", operationKey },
      },
    });
  });

  it("treats server-confirmed statement cancellation as definitive", () => {
    expect(project(driverError("57014"), "query")).toEqual({
      ok: false,
      error: {
        kind: "error",
        code: "timeout",
        details: { operation: "createBudget", operationKey },
      },
    });
  });

  it("does not classify a read failure as uncertain", () => {
    expect(
      projectPostgresqlFailure(
        driverError("ECONNRESET"),
        getBudget,
        { budgetReference: `kbr_v1_${"b".repeat(43)}` },
        "query",
        false,
      ),
    ).toEqual({
      ok: false,
      error: { kind: "error", code: "unavailable", details: {} },
    });
  });
});

function project(error: unknown, phase: PostgresqlFailurePhase) {
  return projectPostgresqlFailure(
    error,
    createBudget,
    { operationKey, definitions: {}, amounts: {} },
    phase,
    false,
  );
}

function driverError(code: string): Error & { readonly code: string } {
  return Object.assign(
    new Error(
      "postgresql://application:password@private.example/keynes select private_table",
    ),
    { code },
  );
}
