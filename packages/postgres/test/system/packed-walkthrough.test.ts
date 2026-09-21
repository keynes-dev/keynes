import { describe, it } from "vitest";
import { runPackedPostgresqlWalkthrough } from "../qualification/packed-walkthrough.ts";
import { openRemoteIdentityFixture } from "./support/remote-identity.ts";
import {
  requirePostgresqlSystemInstallation,
  requirePostgresqlSystemTlsRootCertificate,
} from "./support/test-keynes.ts";

describe("packed PostgreSQL walkthrough", () => {
  it("settles and reopens through the selected archives over verified TLS", async () => {
    const installation = requirePostgresqlSystemInstallation();
    if (installation.kind !== "packed")
      throw new Error("Packed consumer required");
    const fixture = await openRemoteIdentityFixture();
    try {
      await fixture.register(fixture.primary);
      const url = new URL(fixture.databaseUrl);
      url.username = fixture.primary.role;
      url.password = fixture.primary.password;
      url.searchParams.set("sslmode", "verify-full");
      url.searchParams.set(
        "sslrootcert",
        requirePostgresqlSystemTlsRootCertificate(),
      );
      await runPackedPostgresqlWalkthrough(installation.consumerRoot, url);
    } finally {
      await fixture.close();
    }
  });
});
