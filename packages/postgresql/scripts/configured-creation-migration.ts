import type { ContractSource } from "@keynes/contracts";

export function renderConfiguredCreationMigration(
  resourceDefinitionsSql: string,
  contract: ContractSource,
): string {
  const compatibility = resourceDefinitionsSql.match(
    /CREATE FUNCTION keynes_internal\.remote_get_compatibility_v0007\(input jsonb\)[\s\S]*?\n\$function\$;/u,
  )?.[0];
  if (compatibility === undefined) {
    throw new Error("Missing historical compatibility function in 0007");
  }
  const currentCompatibility = compatibility
    .replaceAll(
      "remote_get_compatibility_v0007",
      "remote_get_compatibility_v0008",
    )
    .replace(
      "'semanticGeneration', 2",
      `'semanticGeneration', ${contract.remote.semanticGeneration}`,
    )
    .replace(
      "'minimumSdkGeneration', 2",
      `'minimumSdkGeneration', ${contract.remote.minimumSdkGeneration}`,
    )
    .replace(
      /'procedures', '[^']*'::jsonb/u,
      `'procedures', '${JSON.stringify(contract.remote.procedures.map(({ method, target, revision }) => ({ name: method, target, revision })))}'::jsonb`,
    );

  return `${currentCompatibility}

CREATE OR REPLACE FUNCTION keynes.remote_get_compatibility(input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
DECLARE validation_response jsonb;
BEGIN
  validation_response := keynes_internal.remote_validate_input_v0006('getCompatibility', input);
  IF validation_response IS NOT NULL THEN RETURN validation_response; END IF;
  RETURN keynes_internal.remote_get_compatibility_v0008(input);
END;
$function$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA keynes_internal FROM PUBLIC;
`;
}
