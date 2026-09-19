import { vi } from "vitest";

vi.mock("@electric-sql/pglite", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@electric-sql/pglite")>();
  let snapshot: Promise<Blob> | undefined;

  async function seed() {
    const database = await actual.PGlite.create("memory://");
    try {
      return await database.dumpDataDir();
    } finally {
      await database.close();
    }
  }

  return {
    ...actual,
    PGlite: {
      async create(dataDir: string) {
        if (dataDir !== "memory://")
          throw new Error(
            "Snapshot fixtures support only private memory databases",
          );
        snapshot ??= seed();
        return actual.PGlite.create({ loadDataDir: await snapshot });
      },
    },
  };
});
