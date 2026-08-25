import { PGlite } from "@electric-sql/pglite";

import type { TransactionalDatabase } from "./database.js";
import { installDatabase, type DatabaseInstallation } from "./migrations.js";
import type { ProcedureDatabaseOwner } from "./procedure-caller.js";

export class PGliteDatabase implements ProcedureDatabaseOwner {
  readonly database: TransactionalDatabase;
  readonly #pglite: PGlite;
  #tail: Promise<void> = Promise.resolve();
  #closing = false;
  #closePromise: Promise<void> | undefined;

  constructor(pglite: PGlite) {
    this.#pglite = pglite;
    this.database = pglite;
  }

  run<Result>(
    operation: (database: TransactionalDatabase) => Promise<Result>,
  ): Promise<Result> {
    if (this.#closing) {
      return Promise.reject(new Error("The PGlite database is closed"));
    }

    const result = this.#tail.then(() => operation(this.database));
    this.#tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  close(): Promise<void> {
    this.#closing = true;
    return (this.#closePromise ??= this.#tail.then(() => this.#pglite.close()));
  }
}

export async function openPGliteDatabase(): Promise<PGliteDatabase> {
  return new PGliteDatabase(await PGlite.create("memory://"));
}

export async function openInstalledPGliteDatabase(
  installation: DatabaseInstallation,
): Promise<PGliteDatabase> {
  const owner = await openPGliteDatabase();
  try {
    await installDatabase(owner.database, installation);
    return owner;
  } catch (error: unknown) {
    try {
      await owner.close();
    } catch (cleanupFailure: unknown) {
      throw new AggregateError(
        [error, cleanupFailure],
        "PGlite initialization and cleanup failed",
        { cause: error },
      );
    }
    throw error;
  }
}
