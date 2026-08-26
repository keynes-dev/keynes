import { createHash } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { loadInstallationAssets } from "../src/private/run-installation.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("canonical PostgreSQL installation runner", () => {
  it("loads the manifest assets in declared order", async () => {
    const directory = await makeMigrationDirectory();
    const first = "CREATE TABLE first (id integer);\n";
    const second = "CREATE TABLE second (id integer);\n";
    await writeMigration(directory, "0002-second.sql", second);
    await writeMigration(directory, "0001-first.sql", first);

    const assets = await loadInstallationAssets({
      installationRecord: {
        migrations: [
          {
            id: "0001-first",
            path: "0001-first.sql",
            sha256: checksum(first),
          },
          {
            id: "0002-second",
            path: "0002-second.sql",
            sha256: checksum(second),
          },
        ],
      },
      migrationsDirectory: directory,
    });

    expect(assets.map(({ id }) => id)).toEqual(["0001-first", "0002-second"]);
  });

  it("rejects an asset whose bytes do not match its recorded checksum", async () => {
    const directory = await makeMigrationDirectory();
    await writeMigration(directory, "0001-first.sql", "changed\n");

    await expect(
      loadInstallationAssets({
        installationRecord: {
          migrations: [
            {
              id: "0001-first",
              path: "0001-first.sql",
              sha256: checksum("canonical\n"),
            },
          ],
        },
        migrationsDirectory: directory,
      }),
    ).rejects.toThrow(/checksum/i);
  });
});

async function makeMigrationDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "keynes-installation-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function writeMigration(
  directory: string,
  path: string,
  contents: string,
): Promise<void> {
  await writeFile(join(directory, path), contents);
}

function checksum(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}
