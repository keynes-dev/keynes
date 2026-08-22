import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { checkDependencies } from "./check-dependencies.ts";

const fixturesRoot = new URL("./fixtures/dependencies/", import.meta.url);

describe("checkDependencies", () => {
  it("accepts the documented graph", async () => {
    await expect(checkFixture("valid")).resolves.toEqual([]);
  });

  it.each([
    [
      "undeclared",
      [
        "DEP001_UNDECLARED_WORKSPACE: @fixture/sdk imports @fixture/cloud without declaring it",
      ],
    ],
    [
      "forbidden",
      [
        "DEP002_FORBIDDEN_DIRECTION: @fixture/sdk must not depend on @fixture/cloud",
      ],
    ],
    [
      "private-import",
      [
        "DEP002_FORBIDDEN_DIRECTION: @fixture/cloud must not depend on @fixture/sdk",
        "DEP003_PRIVATE_IMPORT: @fixture/cloud imports private path ../../sdk/src/private.ts",
      ],
    ],
    [
      "scripts-runtime",
      [
        "DEP004_SCRIPTS_RUNTIME: @fixture/sdk production source imports ../../scripts/check.ts",
      ],
    ],
    [
      "type-reexport",
      [
        "DEP002_FORBIDDEN_DIRECTION: @fixture/cloud must not depend on @fixture/sdk",
        "DEP003_PRIVATE_IMPORT: @fixture/cloud imports private path @fixture/sdk/another-private",
        "DEP003_PRIVATE_IMPORT: @fixture/cloud imports private path @fixture/sdk/private",
      ],
    ],
    [
      "cycle",
      [
        "DEP002_FORBIDDEN_DIRECTION: @fixture/cloud must not depend on @fixture/sdk",
        "DEP002_FORBIDDEN_DIRECTION: @fixture/sdk must not depend on @fixture/cloud",
        "DEP005_CYCLE: workspace dependency cycle @fixture/sdk -> @fixture/cloud -> @fixture/sdk",
      ],
    ],
  ])("rejects the %s fixture", async (fixture, diagnostics) => {
    await expect(checkFixture(fixture)).resolves.toEqual(diagnostics);
  });
});

async function checkFixture(name: string): Promise<string[]> {
  const fixture = new URL(`${name}/`, fixturesRoot);
  return checkDependencies(fileURLToPath(fixture), ["sdk", "cloud"]);
}
