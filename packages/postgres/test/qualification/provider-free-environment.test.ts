import { describe, expect, it } from "vitest";

import { providerFreeEnvironment } from "@keynes/testkit/package";

describe("provider-free child process environment", () => {
  it("removes every database credential and forces non-interactive execution", () => {
    expect(
      providerFreeEnvironment({
        PATH: "/bin",
        CI: "false",
        KEYNES_DATABASE_URL: "database-secret",
        KEYNES_QUALIFICATION_TARGET: "target-secret",
        KEYNES_EXTERNAL_PRIMARY_URL: "external-secret",
        PGPASSWORD: "password-secret",
      }),
    ).toEqual({ PATH: "/bin", CI: "true" });
  });
});
