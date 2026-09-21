import type { ContractSource, JsonObject } from "../../src/index.ts";

export function renderSecurePublicFunctions(contract: ContractSource): string {
  const statements = contract.operations.map((operation) => {
    const functionName = operation.target.slice("keynes.".length);
    const body = operation.replay
      ? `keynes_internal.apply_command('${operation.method}', input)`
      : "keynes_internal.get_budget(input)";
    return operation.replay
      ? `CREATE OR REPLACE FUNCTION keynes.${functionName}(input jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
  SELECT ${body};
$$;`
      : `CREATE OR REPLACE FUNCTION keynes.${functionName}(input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
BEGIN
  RETURN ${body};
  EXCEPTION
    WHEN SQLSTATE 'K0001' THEN
      RETURN jsonb_build_object('ok', false, 'error', SQLERRM::jsonb);
END;
$$;`;
  });
  const revokes = contract.operations
    .map(({ target }) => `REVOKE ALL ON FUNCTION ${target}(jsonb) FROM PUBLIC;`)
    .join("\n");
  return `${statements.join("\n\n")}\n\n${revokes}`;
}

export function installationFunctions(
  contract: ContractSource,
): readonly JsonObject[] {
  return contract.operations.map((operation) => ({
    operation: operation.method,
    permissions: operation.permissions,
    target: operation.target,
    argumentType: "jsonb",
    returnType: "jsonb",
    language: operation.method === "getBudget" ? "plpgsql" : "sql",
    securityDefiner: true,
    searchPath: ["pg_catalog", "keynes_internal", "pg_temp"],
  }));
}
