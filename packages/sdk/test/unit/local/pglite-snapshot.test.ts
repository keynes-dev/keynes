import "../support/pglite-snapshot.js";

import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("restores independent empty databases without retaining prior schema or data", async () => {
  const first = await PGlite.create("memory://");
  try {
    await first.exec(
      "create table fixture_probe (value integer); insert into fixture_probe values (1)",
    );
  } finally {
    await first.close();
  }
  const second = await PGlite.create("memory://");
  try {
    expect(
      (
        await second.query(
          "select to_regclass('public.fixture_probe') as relation",
        )
      ).rows,
    ).toEqual([{ relation: null }]);
  } finally {
    await second.close();
  }
});
