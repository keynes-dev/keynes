import { PGlite } from "@electric-sql/pglite";

import {
  installPglite,
  type PgliteDatabase,
} from "../../../src/local/install.ts";

interface ClosablePgliteDatabase extends PgliteDatabase {
  close(): Promise<void>;
}

export interface PgliteHost {
  readonly database: PgliteDatabase;
  close(): Promise<void>;
}

export async function openPgliteHost(
  options: {
    readonly createDatabase?: () => Promise<ClosablePgliteDatabase>;
  } = {},
): Promise<PgliteHost> {
  const database =
    (await options.createDatabase?.()) ??
    ((await PGlite.create("memory://")) as ClosablePgliteDatabase);
  try {
    await installPglite({ database });
  } catch (error: unknown) {
    try {
      await database.close();
    } catch (cleanupFailure: unknown) {
      throw new AggregateError(
        [error, cleanupFailure],
        "PGlite initialization and cleanup failed",
        { cause: error },
      );
    }
    throw error;
  }

  return {
    database,
    close: () => database.close(),
  };
}
