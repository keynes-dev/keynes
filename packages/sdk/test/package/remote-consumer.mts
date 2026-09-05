import { createKeynes, createOperationKey, defineResources } from "@keynes/sdk";

declare const process: {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly stdout: { write(value: string): void };
};
const target: {
  primaryUrl: string;
  secondaryUrl: string;
  wrongCaUrl: string;
  wrongHostnameUrl: string;
  unavailableUrl: string;
} = JSON.parse(process.env.KEYNES_CONSUMER_TARGET ?? "{}");
const resources = defineResources({
  units: { unit: "unit", accountingBehavior: "consumable" },
});
const observations: {
  check: string;
  status: "passed" | "failed";
  failureCode?: string;
}[] = [];

async function check(
  name: string,
  operation: () => Promise<void>,
): Promise<void> {
  try {
    await operation();
    observations.push({ check: name, status: "passed" });
  } catch (error: unknown) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined;
    observations.push({
      check: name,
      status: "failed",
      failureCode:
        typeof code === "string" &&
        [
          "unknown",
          "unauthorized",
          "compatibility_error",
          "resource_definition_failed",
          "invalid_configuration",
          "authentication_failed",
          "tls_error",
          "budget_not_found",
          "command_conflict",
          "insufficient_budget",
          "invalid_request",
          "unavailable",
        ].includes(code)
          ? code
          : "assertion_failed",
    });
  }
}
async function rejectsCode(
  operation: Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await operation;
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === code
    )
      return;
    throw error;
  }
  throw new Error("Expected public failure");
}

await check("verified-budget-workflow", async () => {
  await using remote = await createKeynes({ databaseUrl: target.primaryUrl });
  const root = await remote.createBudget(
    resources,
    { units: 10 },
    { operationKey: createOperationKey() },
  );
  const requested = await root.request(
    { units: 2 },
    { operationKey: createOperationKey() },
  );
  if (requested.status !== "approved") throw new Error("Expected approval");
  await requested.budget.settle(
    { units: 1 },
    { operationKey: createOperationKey() },
  );
  const opened = await remote.openBudget({
    reference: root.reference,
    resourceTypes: resources,
  });
  if (opened.reference !== root.reference) throw new Error("Reference changed");
});
await check("tenant-isolation", async () => {
  await using primary = await createKeynes({ databaseUrl: target.primaryUrl });
  await using secondary = await createKeynes({
    databaseUrl: target.secondaryUrl,
  });
  const root = await primary.createBudget(
    resources,
    { units: 10 },
    { operationKey: createOperationKey() },
  );
  await secondary.createBudget(
    resources,
    { units: 10 },
    { operationKey: createOperationKey() },
  );
  await rejectsCode(
    secondary.openBudget({
      reference: root.reference,
      resourceTypes: resources,
    }),
    "unauthorized",
  );
});
await check("reconnect-exact-replay", async () => {
  const operationKey = createOperationKey();
  const reference = await (async () => {
    await using remote = await createKeynes({ databaseUrl: target.primaryUrl });
    return (
      await remote.createBudget(resources, { units: 10 }, { operationKey })
    ).reference;
  })();
  await using reconnected = await createKeynes({
    databaseUrl: target.primaryUrl,
  });
  const replay = await reconnected.createBudget(
    resources,
    { units: 10 },
    { operationKey },
  );
  if (replay.reference !== reference)
    throw new Error("Replay changed reference");
  const recovered = await reconnected.recoverOperation(operationKey);
  if (recovered.kind !== "committed")
    throw new Error("Recovery lost committed operation");
});
await check("operation-conflict", async () => {
  await using remote = await createKeynes({ databaseUrl: target.primaryUrl });
  const operationKey = createOperationKey();
  await remote.createBudget(resources, { units: 10 }, { operationKey });
  await rejectsCode(
    remote.createBudget(resources, { units: 11 }, { operationKey }),
    "command_conflict",
  );
});
await check("unavailable-endpoint", () =>
  rejectsCode(
    createKeynes({ databaseUrl: target.unavailableUrl }),
    "unavailable",
  ),
);
await check("wrong-ca", () =>
  rejectsCode(createKeynes({ databaseUrl: target.wrongCaUrl }), "tls_error"),
);
await check("wrong-hostname", () =>
  rejectsCode(
    createKeynes({ databaseUrl: target.wrongHostnameUrl }),
    "tls_error",
  ),
);
process.stdout.write(JSON.stringify(observations));
