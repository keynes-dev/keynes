import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));

describe("separate installation entrypoints", () => {
  it("declares keynes as the CLI executable with one PostgreSQL dependency", () => {
    const manifest: unknown = JSON.parse(
      readFileSync(`${root}/package.json`, "utf8"),
    );
    expect(manifest).toMatchObject({
      name: "@keynes/cli",
      bin: { keynes: "dist/cli.js" },
    });
    if (
      typeof manifest !== "object" ||
      manifest === null ||
      !("dependencies" in manifest)
    )
      throw new Error("CLI manifest has no dependencies");
    expect(manifest.dependencies).toEqual({
      "@keynes/postgres": "workspace:*",
    });
  });
  it("exports the installation API without exposing borrowed rechecks", async () => {
    const installation = await import("@keynes/postgres/install");
    expect(Object.keys(installation).sort()).toEqual([
      "InstallationError",
      "install",
      "parseInstallationConfig",
    ]);
  });
});
