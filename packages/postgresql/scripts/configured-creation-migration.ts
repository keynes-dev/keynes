import type { ContractSource } from "@keynes/contracts";

export const CONFIGURED_CREATION_OBJECTS = [
  "function:keynes_internal.remote_get_compatibility_v0008(input jsonb)",
  "function:keynes_internal.canonical_creation_v0008(definitions_value jsonb,amounts_value jsonb)",
  "function:keynes_internal.apply_create_budget_v0008(input jsonb)",
  "function:keynes_internal.remote_create_budget_v0008(input jsonb)",
  "function:keynes_internal.remote_recover_operation_v0008(input jsonb)",
  "function:keynes_internal.remote_apply_command_v0008(operation_name text,input jsonb)",
  "function:keynes_internal.validate_resources_v0008(input jsonb)",
  "function:keynes_internal.remote_validate_resources_v0008(input jsonb)",
  "function:keynes.validate_resources(input jsonb)",
  "function:keynes.remote_validate_resources(input jsonb)",
] as const;

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

CREATE FUNCTION keynes_internal.validate_resources_v0008(input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
DECLARE
  operation_name constant text := 'validateResources';
  tenant uuid;
  principal uuid;
  definitions jsonb;
  item jsonb;
  stored_resource keynes_internal.resource_types%ROWTYPE;
  definition_digest_value text;
  domain_error_message text;
BEGIN
  BEGIN
    IF coalesce(current_setting('keynes.tenant_id', true), '')
        !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR coalesce(current_setting('keynes.principal_id', true), '')
        !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      PERFORM keynes_internal.raise_domain_error('unauthorized', jsonb_build_object(
        'operation', operation_name, 'requiredPermission', 'create_root_budget'
      ));
    END IF;
    tenant := current_setting('keynes.tenant_id')::uuid;
    principal := current_setting('keynes.principal_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM keynes_internal.principal_permissions
      WHERE tenant_id = tenant AND principal_id = principal AND permission = 'create_root_budget') THEN
      PERFORM keynes_internal.raise_domain_error('unauthorized', jsonb_build_object(
        'operation', operation_name, 'requiredPermission', 'create_root_budget'
      ));
    END IF;
    IF jsonb_typeof(input) IS DISTINCT FROM 'object' THEN
      PERFORM keynes_internal.invalid_command(operation_name, '$', 'type');
    END IF;
    IF NOT (input ? 'definitions') THEN
      PERFORM keynes_internal.invalid_command(operation_name, '$', 'required');
    END IF;
    IF input - ARRAY['definitions']::text[] <> '{}'::jsonb THEN
      PERFORM keynes_internal.invalid_command(operation_name, '$', 'additionalProperties');
    END IF;
    definitions := keynes_internal.canonical_definitions_v0007(operation_name, input->'definitions');
    FOR item IN SELECT value FROM jsonb_array_elements(definitions)
    LOOP
      SELECT * INTO stored_resource FROM keynes_internal.resource_types
      WHERE tenant_id = tenant AND canonical_name = item->'definition'->>'canonicalName';
      IF NOT FOUND THEN
        PERFORM keynes_internal.raise_domain_error('resource_type_not_found', jsonb_build_object(
          'canonicalName', item->'definition'->>'canonicalName'
        ));
      END IF;
      definition_digest_value := 'resource-definition:' || encode(
        sha256(convert_to((item->'definition')::text, 'UTF8')), 'hex'
      );
      IF stored_resource.definition <> item->'definition'
        OR stored_resource.definition_digest <> definition_digest_value THEN
        PERFORM keynes_internal.raise_domain_error('resource_type_conflict', jsonb_build_object(
          'canonicalName', item->'definition'->>'canonicalName',
          'existingDefinitionDigest', stored_resource.definition_digest,
          'attemptedDefinitionDigest', definition_digest_value
        ));
      END IF;
    END LOOP;
    RETURN jsonb_build_object('ok', true, 'result', jsonb_build_object('valid', true), 'replayed', false);
  EXCEPTION WHEN SQLSTATE 'K0001' THEN
    GET STACKED DIAGNOSTICS domain_error_message = MESSAGE_TEXT;
    RETURN jsonb_build_object('ok', false, 'error', domain_error_message::jsonb);
  END;
END;
$function$;

CREATE FUNCTION keynes.validate_resources(input jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
  SELECT keynes_internal.validate_resources_v0008(input);
$function$;

CREATE FUNCTION keynes_internal.remote_validate_resources_v0008(input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
DECLARE
  response jsonb;
  domain_error_message text;
BEGIN
  PERFORM set_config('keynes.remote_operation', 'validateResources', true);
  BEGIN
    PERFORM keynes_internal.set_remote_identity_v0006();
    response := keynes_internal.validate_resources_v0008(input);
    IF response->>'ok' = 'false' THEN
      RETURN jsonb_build_object('ok', false, 'error',
        keynes_internal.remote_safe_error_v0006('validateResources', response->'error'));
    END IF;
    RETURN response - 'replayed';
  EXCEPTION WHEN SQLSTATE 'K0001' THEN
    GET STACKED DIAGNOSTICS domain_error_message = MESSAGE_TEXT;
    RETURN jsonb_build_object('ok', false, 'error',
      keynes_internal.remote_safe_error_v0006('validateResources', domain_error_message::jsonb));
  END;
END;
$function$;

CREATE FUNCTION keynes.remote_validate_resources(input jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
  SELECT keynes_internal.remote_validate_resources_v0008(input);
$function$;

REVOKE ALL ON FUNCTION keynes.validate_resources(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes.remote_validate_resources(jsonb) FROM PUBLIC;

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

${renderBudgetCreation(resourceDefinitionsSql)}

CREATE FUNCTION keynes_internal.remote_recover_operation_v0008(input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
DECLARE
  response jsonb;
  definitions jsonb;
  validation_response jsonb;
BEGIN
  response := keynes_internal.remote_dispatch_v0006('recoverOperation', input);
  IF response #>> '{result,kind}' = 'committed'
    AND response #>> '{result,operation}' = 'createBudget' THEN
    SELECT canonical_input->'definitions' INTO definitions
    FROM keynes_internal.remote_operations
    WHERE tenant_id = current_setting('keynes.tenant_id')::uuid
      AND operation_key = input->>'operationKey';
    validation_response := keynes_internal.validate_resources_v0008(
      jsonb_build_object('definitions', definitions)
    );
    IF validation_response->>'ok' = 'false' THEN
      RETURN jsonb_build_object('ok', false, 'error',
        keynes_internal.remote_safe_error_v0006('recoverOperation', validation_response->'error'));
    END IF;
  END IF;
  RETURN response;
END;
$function$;

CREATE OR REPLACE FUNCTION keynes.remote_recover_operation(input jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
  SELECT keynes_internal.remote_recover_operation_v0008(input);
$function$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA keynes_internal FROM PUBLIC;
`;
}

function historicalFunction(source: string, name: string): string {
  const start = source.indexOf(`CREATE FUNCTION keynes_internal.${name}(`);
  const end = source.indexOf("\n$function$;", start);
  if (start < 0 || end < 0)
    throw new Error(`Missing historical function ${name}`);
  return source.slice(start, end + "\n$function$;".length);
}

function renderBudgetCreation(source: string): string {
  const historical = historicalFunction(source, "apply_create_budget_v0007");
  const commandStart = historical.indexOf("    body_digest_value :=");
  const commandEnd = historical.indexOf(
    "    IF source_value->>'kind' = 'definitions' THEN",
    commandStart,
  );
  const accountingStart = historical.indexOf(
    "    PERFORM keynes_internal.checkpoint('after_resource_insertion');",
    commandEnd,
  );
  if (commandStart < 0 || commandEnd < 0 || accountingStart < 0)
    throw new Error("Missing historical creation accounting sections");
  const command = historical
    .slice(commandStart, commandEnd)
    .replaceAll("apply_create_budget_v0007", "apply_create_budget_v0008");
  const accounting = historical
    .slice(accountingStart)
    .replaceAll("apply_create_budget_v0007", "apply_create_budget_v0008");
  const remoteApply = historicalFunction(source, "remote_apply_command_v0007")
    .replaceAll("remote_apply_command_v0007", "remote_apply_command_v0008")
    .replace(
      /      IF operation_name = 'createBudget' AND EXISTS \([\s\S]*?      END IF;\n/u,
      "",
    );
  return `CREATE FUNCTION keynes_internal.canonical_creation_v0008(definitions_value jsonb, amounts_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $function$
DECLARE
  definitions jsonb;
  item record;
  amount_value numeric;
  amounts jsonb := '{}'::jsonb;
BEGIN
  definitions := keynes_internal.canonical_definitions_v0007('createBudget', definitions_value);
  IF jsonb_typeof(amounts_value) IS DISTINCT FROM 'object' THEN
    PERFORM keynes_internal.invalid_command('createBudget', '$.amounts', 'type');
  END IF;
  IF amounts_value = '{}'::jsonb THEN
    PERFORM keynes_internal.invalid_command('createBudget', '$.amounts', 'minProperties');
  END IF;
  IF (SELECT array_agg(key ORDER BY key COLLATE "C") FROM jsonb_object_keys(definitions_value) key)
    IS DISTINCT FROM (SELECT array_agg(key ORDER BY key COLLATE "C") FROM jsonb_object_keys(amounts_value) key) THEN
    PERFORM keynes_internal.invalid_command('createBudget', '$.amounts', 'resourceBinding');
  END IF;
  FOR item IN SELECT key, value FROM jsonb_each(amounts_value)
  LOOP
    IF jsonb_typeof(item.value) IS DISTINCT FROM 'number' THEN
      PERFORM keynes_internal.invalid_command('createBudget', '$.amounts.' || item.key, 'type');
    END IF;
    amount_value := item.value::numeric;
    IF amount_value <> trunc(amount_value) OR amount_value < 0 OR amount_value > 9007199254740991 THEN
      PERFORM keynes_internal.invalid_command('createBudget', '$.amounts.' || item.key, 'range');
    END IF;
    amounts := amounts || jsonb_build_object(item.key, amount_value::bigint);
  END LOOP;
  RETURN jsonb_build_object('definitions', definitions, 'amounts', amounts);
END;
$function$;

CREATE FUNCTION keynes_internal.apply_create_budget_v0008(input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
<<apply_create_budget_v0008>>
DECLARE
  operation_name constant text := 'createBudget';
  tenant uuid;
  principal uuid;
  command_id uuid;
  body jsonb;
  body_digest_value text;
  prior keynes_internal.commands%ROWTYPE;
  policies jsonb;
  policy jsonb;
  item jsonb;
  items jsonb := '[]'::jsonb;
  resolved_items jsonb := '[]'::jsonb;
  stored_resource keynes_internal.resource_types%ROWTYPE;
  validation_response jsonb;
  result jsonb;
  expected_resources jsonb;
  expected_result jsonb;
  domain_error_message text;
BEGIN
  BEGIN
    PERFORM set_config('keynes.policy_operation', operation_name, true);
    PERFORM set_config('keynes.policy_name', '', true);
    PERFORM set_config('keynes.policy_revision', '', true);
    validation_response := keynes_internal.validate_resources_v0008(jsonb_build_object('definitions', input->'definitions'));
    IF validation_response->>'ok' = 'false' THEN
      IF validation_response->'error'->'details' ? 'operation' THEN
        validation_response := jsonb_set(validation_response, '{error,details,operation}', '"createBudget"'::jsonb);
      END IF;
      RETURN validation_response;
    END IF;
    tenant := current_setting('keynes.tenant_id')::uuid;
    principal := current_setting('keynes.principal_id')::uuid;
    IF jsonb_typeof(input) IS DISTINCT FROM 'object' THEN
      PERFORM keynes_internal.invalid_command(operation_name, '$', 'type');
    END IF;
    IF NOT (input ? 'commandId') OR NOT (input ? 'definitions') OR NOT (input ? 'amounts') THEN
      PERFORM keynes_internal.invalid_command(operation_name, '$', 'required');
    END IF;
    IF input - ARRAY['commandId', 'definitions', 'amounts', 'policies']::text[] <> '{}'::jsonb THEN
      PERFORM keynes_internal.invalid_command(operation_name, '$', 'additionalProperties');
    END IF;
    IF jsonb_typeof(input->'commandId') IS DISTINCT FROM 'string'
      OR input->>'commandId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      PERFORM keynes_internal.invalid_command(operation_name, '$.commandId', 'format');
    END IF;
    command_id := (input->>'commandId')::uuid;
    body := keynes_internal.canonical_creation_v0008(input->'definitions', input->'amounts');
    policies := keynes_internal.canonical_policy_set(coalesce(input->'policies', '[]'::jsonb));
    IF policies <> '[]'::jsonb THEN body := body || jsonb_build_object('policies', policies); END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(body->'definitions')
    LOOP
      SELECT * INTO STRICT stored_resource FROM keynes_internal.resource_types
      WHERE tenant_id = tenant AND canonical_name = item->'definition'->>'canonicalName';
      items := items || jsonb_build_array(jsonb_build_object('definition', item->'definition', 'amount', body->'amounts'->(item->>'key')));
      resolved_items := resolved_items || jsonb_build_array(jsonb_build_object(
        'resourceTypeId', stored_resource.resource_type_id::text, 'amount', body->'amounts'->(item->>'key')
      ));
    END LOOP;
${command}
${accounting}

CREATE OR REPLACE FUNCTION keynes_internal.apply_command(operation_name text, input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
BEGIN
  CASE operation_name
    WHEN 'defineResources' THEN RETURN keynes_internal.apply_define_resources_v0007(input);
    WHEN 'defineResource' THEN RETURN keynes_internal.apply_define_resource_v0007(input);
    WHEN 'createBudget' THEN RETURN keynes_internal.apply_create_budget_v0008(input);
    ELSE RETURN keynes_internal.apply_command_v0004(operation_name, input);
  END CASE;
END;
$function$;

${remoteApply}

CREATE FUNCTION keynes_internal.remote_create_budget_v0008(input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
DECLARE
  validation_response jsonb;
  normalized jsonb;
  policies jsonb;
  domain_error_message text;
BEGIN
  PERFORM set_config('keynes.remote_operation', 'createBudget', true);
  BEGIN
    PERFORM keynes_internal.set_remote_identity_v0006();
    validation_response := keynes_internal.validate_resources_v0008(jsonb_build_object('definitions', input->'definitions'));
    IF validation_response->>'ok' = 'false' THEN
      RETURN jsonb_build_object('ok', false, 'error', keynes_internal.remote_safe_error_v0006('createBudget', validation_response->'error'));
    END IF;
    IF jsonb_typeof(input) IS DISTINCT FROM 'object' THEN
      PERFORM keynes_internal.invalid_command('createBudget', '$', 'type');
    END IF;
    IF NOT (input ? 'operationKey') OR NOT (input ? 'definitions') OR NOT (input ? 'amounts') THEN
      PERFORM keynes_internal.invalid_command('createBudget', '$', 'required');
    END IF;
    IF input - ARRAY['operationKey', 'definitions', 'amounts', 'policies']::text[] <> '{}'::jsonb THEN
      PERFORM keynes_internal.invalid_command('createBudget', '$', 'additionalProperties');
    END IF;
    normalized := keynes_internal.canonical_creation_v0008(input->'definitions', input->'amounts');
    normalized := (input - 'policies') || jsonb_build_object('amounts', normalized->'amounts');
    policies := keynes_internal.canonical_policy_set(coalesce(input->'policies', '[]'::jsonb));
    IF policies <> '[]'::jsonb THEN normalized := normalized || jsonb_build_object('policies', policies); END IF;
    RETURN keynes_internal.remote_apply_command_v0008('createBudget', normalized);
  EXCEPTION WHEN SQLSTATE 'K0001' THEN
    GET STACKED DIAGNOSTICS domain_error_message = MESSAGE_TEXT;
    RETURN jsonb_build_object('ok', false, 'error', keynes_internal.remote_safe_error_v0006('createBudget', domain_error_message::jsonb));
  END;
END;
$function$;

CREATE OR REPLACE FUNCTION keynes.remote_create_budget(input jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
  SELECT keynes_internal.remote_create_budget_v0008(input);
$function$;`;
}
