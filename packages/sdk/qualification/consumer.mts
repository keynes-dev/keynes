import { Keynes } from "@keynes/sdk";

const keynes = await Keynes.create({ mode: "local" });
try {
  const resources = await keynes.defineResources({
    usdCents: { unit: "cent", accountingBehavior: "consumable" },
    searchQueries: { unit: "query", accountingBehavior: "consumable" },
  });
  assertEqual(
    resources.map(({ canonicalName }) => canonicalName),
    ["search_queries", "usd_cents"],
  );

  const root = await keynes.createBudget({ usdCents: 100, searchQueries: 10 });
  const approved = await root.request({ usdCents: 40, searchQueries: 2 });
  assertEqual(approved.status, "approved");
  if (approved.status !== "approved") throw new Error("expected approval");

  assertEqual(await root.request({ usdCents: 100 }), {
    status: "denied",
    reasons: [
      {
        code: "insufficient_available",
        resource: "usdCents",
        requested: 100,
        available: 60,
      },
    ],
  });

  assertEqual(
    (await approved.budget.settle({ usdCents: 40 })).kind,
    "settling",
  );
  assertEqual(
    (await approved.budget.settle({ searchQueries: 2 })).kind,
    "settled",
  );
  assertEqual(
    (await root.inspect()).history.entries.map(({ kind }) => kind),
    [
      "budget_created",
      "request_approved",
      "request_denied",
      "budget_settlement_recorded",
      "budget_settlement_recorded",
    ],
  );
} finally {
  await keynes.close();
}

function assertEqual(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
}
