import { createKeynes, createOperationKey } from "@keynes/sdk";
import type {
  Keynes,
  NodeSqliteRuntime,
  PostgresRuntime,
  RemoteKeynes,
} from "@keynes/sdk";

declare const local: NodeSqliteRuntime;
declare const remote: PostgresRuntime;
function typesOnly() {
  const resources = {
    units: { unit: "unit", accountingBehavior: "consumable" },
  };
  const first: Promise<Keynes<"units">> = createKeynes({
    resources,
    runtime: local,
  });
  const second: Promise<RemoteKeynes<"units">> = createKeynes({
    resources,
    runtime: remote,
  });
  // @ts-expect-error Runtime selection is required.
  createKeynes({ resources });
  // @ts-expect-error databaseUrl belongs to the selected adapter.
  createKeynes({ resources, databaseUrl: "postgresql://localhost/unused" });
  return [first, second];
}
void typesOnly;
if (!createOperationKey().startsWith("kop_v1_"))
  throw new Error("Invalid operation key");
let rejected = false;
try {
  await Reflect.apply(createKeynes, undefined, [{ resources: {} }]);
} catch (error: unknown) {
  rejected =
    error instanceof Error &&
    "code" in error &&
    error.code === "invalid_configuration";
}
if (!rejected) throw new Error("Missing runtime was accepted");
for (const moduleName of [
  "pg",
  "@keynes/node-sqlite",
  "@keynes/postgres",
  "@keynes/database",
]) {
  let imported = false;
  try {
    await import(moduleName);
    imported = true;
  } catch (error: unknown) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "ERR_MODULE_NOT_FOUND"
    )
      throw error;
  }
  if (imported) throw new Error(`Unexpected dependency ${moduleName}`);
}
