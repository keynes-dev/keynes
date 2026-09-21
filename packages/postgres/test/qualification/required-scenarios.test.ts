import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  runRequiredScenarios,
  type DatabaseTarget,
} from "./required-scenarios.js";

describe("provider-neutral database qualification scenarios", () => {
  it("rejects missing exact archives before touching a target", async () => {
    const events: string[] = [];

    await expect(
      runRequiredScenarios(fakeTarget(events), "", "postgresql.tgz"),
    ).rejects.toThrow("required database qualification scenarios failed");
    expect(events).toEqual([]);
  });

  it("prepares the target before any inspection or scenario", async () => {
    const events: string[] = [];

    await expect(
      runRequiredScenarios(
        fakeTarget(events, { prepare: new Error("stop after preparation") }),
        "sdk.tgz",
        "postgresql.tgz",
      ),
    ).rejects.toThrow("required database qualification scenarios failed");
    expect(events).toEqual(["prepare:postgresql.tgz"]);
  });

  it("does not depend on the external environment adapter", async () => {
    const implementation = await readFile(
      new URL("./required-scenarios.ts", import.meta.url),
      "utf8",
    );

    expect(implementation).not.toContain("KEYNES_EXTERNAL_");
    expect(implementation).not.toContain("process.env");
    expect(implementation).not.toContain("external-target");
  });
});

function fakeTarget(
  events: string[],
  failures: { readonly prepare?: Error } = {},
): DatabaseTarget {
  return {
    prepare: async (archivePath) => {
      events.push(`prepare:${archivePath}`);
      if (failures.prepare !== undefined) throw failures.prepare;
    },
    qualifySdkArchive: async () => undefined,
    inspect: async () => {
      throw new Error("unused inspection");
    },
    connect: async () => {
      throw new Error("unused connection");
    },
    closeClient: async () => undefined,
    roleName: () => "role",
    recreateCredentialRole: async () => undefined,
    inspectAcceptedTls: async () => {
      throw new Error("unused TLS inspection");
    },
    assertUnsafeTlsModeRejected: () => undefined,
    inspectTlsRejection: async () => {
      throw new Error("unused TLS rejection");
    },
    close: async () => "passed",
  };
}
