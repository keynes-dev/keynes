import type { ContractSource } from "@keynes/contracts";

import { renderSecurePublicFunctions } from "./secure-public-functions.ts";

export const RESOURCE_DEFINITION_OBJECTS = [
  "function:keynes_internal.canonical_definitions_v0007(operation_name text,value jsonb)",
  "function:keynes_internal.resolve_resource_v0007(selected_tenant uuid,selected_principal uuid,selected_command uuid,selected_resource uuid,canonical_definition jsonb)",
  "function:keynes_internal.apply_define_resources_v0007(input jsonb)",
  "function:keynes_internal.apply_define_resource_v0007(input jsonb)",
  "function:keynes_internal.apply_create_budget_v0007(input jsonb)",
  "function:keynes_internal.canonical_creation_v0007(resource_source jsonb,allocation_value jsonb)",
  "function:keynes_internal.remote_create_budget_v0007(input jsonb)",
  "function:keynes_internal.remote_apply_command_v0007(operation_name text,input jsonb)",
  "function:keynes_internal.remote_define_resources_v0007(input jsonb)",
  "function:keynes_internal.remote_get_compatibility_v0007(input jsonb)",
  "function:keynes.define_resources(input jsonb)",
  "function:keynes.remote_define_resources(input jsonb)",
] as const;

export function renderResourceDefinitionsMigration(
  resourceBoundSql: string,
  remoteSql: string,
  contract: ContractSource,
): string {
  const singleton = withSharedResolver(
    extractFunction(resourceBoundSql, "apply_define_resource_v0005"),
    "apply_define_resource_v0005",
    "command_id",
  );
  const creation = withTaggedCreation(
    withSharedResolver(
      extractFunction(resourceBoundSql, "apply_create_budget_v0005"),
      "apply_create_budget_v0005",
      "gen_random_uuid()",
    ),
  );
  const remoteApply = extractFunction(remoteSql, "remote_apply_command_v0006")
    .replaceAll("remote_apply_command_v0006", "remote_apply_command_v0007")
    .replace(
      /    IF operation_name = 'createBudget' THEN[\s\S]*?(?=    ELSIF operation_name = 'requestBudget')/u,
      `    IF operation_name IN ('defineResources', 'createBudget') THEN
      IF operation_name = 'createBudget' AND EXISTS (
        SELECT 1 FROM jsonb_each(input->'allocation') amount WHERE amount.value::numeric = 0
      ) THEN
        PERFORM keynes_internal.invalid_command('createBudget', '$.allocation', 'range');
      END IF;
      core_input := (input - 'operationKey') || jsonb_build_object(
        'commandId', command_id_value::text
      );
`,
    )
    .replace(
      "remote_result := keynes_internal.remote_project_json_v0006(\n        tenant, core_response->'result'\n      ) || jsonb_build_object('replayed', false);",
      `remote_result := CASE WHEN operation_name = 'defineResources'
        THEN core_response->'result'
        ELSE keynes_internal.remote_project_json_v0006(
          tenant, core_response->'result'
        ) END || jsonb_build_object('replayed', false);`,
    );
  const compatibility = extractFunction(
    remoteSql,
    "remote_get_compatibility_v0006",
  )
    .replaceAll(
      "remote_get_compatibility_v0006",
      "remote_get_compatibility_v0007",
    )
    .replace(
      "'semanticGeneration', 1",
      `'semanticGeneration', ${contract.remote.semanticGeneration}`,
    )
    .replace(
      "'minimumSdkGeneration', 1",
      `'minimumSdkGeneration', ${contract.remote.minimumSdkGeneration}`,
    )
    .replace(
      /'procedures', '[^']*'::jsonb/u,
      `'procedures', '${JSON.stringify(contract.remote.procedures.map(({ method, target, revision }) => ({ name: method, target, revision })))}'::jsonb`,
    );

  return `ALTER TABLE keynes_internal.commands
  ADD COLUMN binding_reference text
    CHECK (binding_reference ~ '^krs_v1_[A-Za-z0-9_-]{43}$'),
  DROP CONSTRAINT command_operation,
  ADD CONSTRAINT command_operation CHECK (operation IN (
    'defineResource', 'defineResources', 'createBudget', 'requestBudget', 'settleBudget'
  ));
CREATE UNIQUE INDEX commands_binding_reference_idx
  ON keynes_internal.commands (binding_reference);
ALTER TABLE keynes_internal.remote_operations
  DROP CONSTRAINT remote_operations_operation_check,
  ADD CONSTRAINT remote_operations_operation_check CHECK (operation IN (
    'defineResources', 'createBudget', 'requestBudget', 'settleBudget'
  ));

CREATE FUNCTION keynes_internal.canonical_definitions_v0007(
  operation_name text,
  value jsonb
) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $function$
DECLARE
  entry record;
  canonical_name text;
  definition jsonb;
  normalized jsonb := '[]'::jsonb;
BEGIN
  IF jsonb_typeof(value) IS DISTINCT FROM 'object' THEN
    PERFORM keynes_internal.invalid_command(operation_name, '$.definitions', 'type');
  END IF;
  IF value = '{}'::jsonb THEN
    PERFORM keynes_internal.invalid_command(operation_name, '$.definitions', 'minProperties');
  END IF;
  FOR entry IN SELECT member.key, member.value AS definition FROM jsonb_each(value) member
  LOOP
    IF entry.key !~ '^[a-z][A-Za-z0-9]*$' THEN
      PERFORM keynes_internal.invalid_command(operation_name, '$.definitions', 'propertyNames');
    END IF;
    canonical_name := lower(regexp_replace(entry.key, '([A-Z])', '_\\1', 'g'));
    IF jsonb_typeof(entry.definition) IS DISTINCT FROM 'object' THEN
      PERFORM keynes_internal.invalid_command(operation_name, '$.definitions.' || entry.key, 'type');
    END IF;
    IF entry.definition - ARRAY['unit', 'accountingBehavior']::text[] <> '{}'::jsonb THEN
      PERFORM keynes_internal.invalid_command(operation_name, '$.definitions.' || entry.key, 'additionalProperties');
    END IF;
    definition := keynes_internal.canonical_resource_definition_v0005(
      operation_name,
      entry.definition || jsonb_build_object('canonicalName', canonical_name),
      '$.definitions.' || entry.key
    );
    normalized := normalized || jsonb_build_array(jsonb_build_object(
      'key', entry.key, 'definition', definition
    ));
  END LOOP;
  RETURN (SELECT jsonb_agg(item ORDER BY (item->'definition'->>'canonicalName') COLLATE "C")
    FROM jsonb_array_elements(normalized) item);
END;
$function$;

CREATE FUNCTION keynes_internal.resolve_resource_v0007(
  selected_tenant uuid,
  selected_principal uuid,
  selected_command uuid,
  selected_resource uuid,
  canonical_definition jsonb
) RETURNS keynes_internal.resource_types
LANGUAGE plpgsql
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
DECLARE
  stored_resource keynes_internal.resource_types%ROWTYPE;
  definition_digest_value text := 'resource-definition:' || encode(
    sha256(convert_to(canonical_definition::text, 'UTF8')), 'hex'
  );
BEGIN
  INSERT INTO keynes_internal.resource_types (
    tenant_id, resource_type_id, definition_command_id, canonical_name,
    unit, accounting_behavior, definition, definition_digest, definer_principal_id
  ) VALUES (
    selected_tenant, selected_resource, selected_command,
    canonical_definition->>'canonicalName', canonical_definition->>'unit',
    canonical_definition->>'accountingBehavior', canonical_definition,
    definition_digest_value, selected_principal
  ) ON CONFLICT (tenant_id, canonical_name) DO NOTHING
  RETURNING * INTO stored_resource;
  IF NOT FOUND THEN
    SELECT * INTO STRICT stored_resource FROM keynes_internal.resource_types
    WHERE tenant_id = selected_tenant
      AND canonical_name = canonical_definition->>'canonicalName'
    FOR UPDATE;
  END IF;
  IF stored_resource.definition_digest <> definition_digest_value
    OR stored_resource.definition <> canonical_definition THEN
    PERFORM keynes_internal.raise_domain_error('resource_type_conflict', jsonb_build_object(
      'canonicalName', canonical_definition->>'canonicalName',
      'existingDefinitionDigest', stored_resource.definition_digest,
      'attemptedDefinitionDigest', definition_digest_value
    ));
  END IF;
  RETURN stored_resource;
END;
$function$;

CREATE FUNCTION keynes_internal.canonical_creation_v0007(
  resource_source jsonb,
  allocation_value jsonb
) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $function$
DECLARE
  source_value jsonb;
  item record;
  amount_value numeric;
  allocation_items jsonb := '[]'::jsonb;
BEGIN
  IF jsonb_typeof(resource_source) IS DISTINCT FROM 'object' THEN
    PERFORM keynes_internal.invalid_command('createBudget', '$.resources', 'type');
  END IF;
  IF resource_source->>'kind' = 'definitions' THEN
    IF resource_source - ARRAY['kind', 'definitions']::text[] <> '{}'::jsonb THEN
      PERFORM keynes_internal.invalid_command('createBudget', '$.resources', 'additionalProperties');
    END IF;
    source_value := jsonb_build_object('kind', 'definitions', 'definitions',
      keynes_internal.canonical_definitions_v0007('createBudget', resource_source->'definitions'));
  ELSIF resource_source->>'kind' = 'binding' THEN
    IF resource_source - ARRAY['kind', 'bindingReference']::text[] <> '{}'::jsonb
      OR jsonb_typeof(resource_source->'bindingReference') IS DISTINCT FROM 'string'
      OR resource_source->>'bindingReference' !~ '^krs_v1_[A-Za-z0-9_-]{43}$' THEN
      PERFORM keynes_internal.invalid_command('createBudget', '$.resources.bindingReference', 'resourceBinding');
    END IF;
    source_value := resource_source;
  ELSE
    PERFORM keynes_internal.invalid_command('createBudget', '$.resources', 'kind');
  END IF;
  IF jsonb_typeof(allocation_value) IS DISTINCT FROM 'object' THEN
    PERFORM keynes_internal.invalid_command('createBudget', '$.allocation', 'type');
  END IF;
  IF allocation_value = '{}'::jsonb THEN
    PERFORM keynes_internal.invalid_command('createBudget', '$.allocation', 'minProperties');
  END IF;
  FOR item IN SELECT member.key, member.value FROM jsonb_each(allocation_value) member
  LOOP
    IF item.key !~ '^[a-z][A-Za-z0-9]*$' THEN
      PERFORM keynes_internal.invalid_command('createBudget', '$.allocation', 'propertyNames');
    END IF;
    IF jsonb_typeof(item.value) IS DISTINCT FROM 'number' THEN
      PERFORM keynes_internal.invalid_command('createBudget', '$.allocation.' || item.key, 'type');
    END IF;
    amount_value := item.value::numeric;
    IF amount_value <> trunc(amount_value) OR amount_value < 0 OR amount_value > 9007199254740991 THEN
      PERFORM keynes_internal.invalid_command('createBudget', '$.allocation.' || item.key, 'range');
    END IF;
    allocation_items := allocation_items || jsonb_build_array(jsonb_build_object('key', item.key, 'amount', amount_value));
  END LOOP;
  SELECT jsonb_agg(value ORDER BY lower(regexp_replace(value->>'key', '([A-Z])', '_\\1', 'g')) COLLATE "C")
    INTO allocation_items FROM jsonb_array_elements(allocation_items);
  RETURN jsonb_build_object('resources', source_value, 'allocation', allocation_items);
END;
$function$;

${singleton}

${creation}

CREATE FUNCTION keynes_internal.apply_define_resources_v0007(input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
DECLARE
  operation_name constant text := 'defineResources';
  tenant uuid;
  principal uuid;
  command_id_value uuid;
  definitions jsonb;
  body jsonb;
  body_digest_value text;
  prior keynes_internal.commands%ROWTYPE;
  item jsonb;
  stored_resource keynes_internal.resource_types%ROWTYPE;
  members jsonb := '[]'::jsonb;
  reference_value text;
  result_value jsonb;
  domain_error_message text;
BEGIN
  BEGIN
    IF jsonb_typeof(input) IS DISTINCT FROM 'object' THEN
      PERFORM keynes_internal.invalid_command(operation_name, '$', 'type');
    END IF;
    IF NOT (input ? 'commandId') OR NOT (input ? 'definitions') THEN
      PERFORM keynes_internal.invalid_command(operation_name, '$', 'required');
    END IF;
    IF input - ARRAY['commandId', 'definitions']::text[] <> '{}'::jsonb THEN
      PERFORM keynes_internal.invalid_command(operation_name, '$', 'additionalProperties');
    END IF;
    IF jsonb_typeof(input->'commandId') IS DISTINCT FROM 'string'
      OR input->>'commandId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      PERFORM keynes_internal.invalid_command(operation_name, '$.commandId', 'format');
    END IF;
    command_id_value := (input->>'commandId')::uuid;
    definitions := keynes_internal.canonical_definitions_v0007(operation_name, input->'definitions');
    body := jsonb_build_object('definitions', definitions);
    IF coalesce(current_setting('keynes.tenant_id', true), '')
        !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR coalesce(current_setting('keynes.principal_id', true), '')
        !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      PERFORM keynes_internal.raise_domain_error('unauthorized', jsonb_build_object(
        'operation', operation_name, 'requiredPermission', 'define_resource_type'
      ));
    END IF;
    tenant := current_setting('keynes.tenant_id')::uuid;
    principal := current_setting('keynes.principal_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM keynes_internal.principal_permissions
      WHERE tenant_id = tenant AND principal_id = principal AND permission = 'define_resource_type') THEN
      PERFORM keynes_internal.raise_domain_error('unauthorized', jsonb_build_object(
        'operation', operation_name, 'requiredPermission', 'define_resource_type'
      ));
    END IF;
    body_digest_value := 'command-body:' || encode(sha256(convert_to(body::text, 'UTF8')), 'hex');
    INSERT INTO keynes_internal.commands (
      tenant_id, command_id, operation, target_kind, target_id,
      canonical_body, body_digest, principal_id
    ) VALUES (
      tenant, command_id_value, operation_name, 'resource_type', command_id_value,
      body, body_digest_value, principal
    ) ON CONFLICT ON CONSTRAINT commands_pkey DO NOTHING;
    IF NOT FOUND THEN
      SELECT * INTO STRICT prior FROM keynes_internal.commands
      WHERE tenant_id = tenant AND command_id = command_id_value FOR UPDATE;
      IF prior.operation <> operation_name OR prior.target_kind <> 'resource_type'
        OR prior.target_id <> command_id_value OR prior.canonical_body <> body
        OR prior.body_digest <> body_digest_value THEN
        PERFORM keynes_internal.raise_domain_error('command_conflict', jsonb_build_object(
          'commandId', command_id_value::text, 'existingOperation', prior.operation,
          'attemptedOperation', operation_name
        ));
      END IF;
      RETURN jsonb_build_object('ok', true, 'result', prior.result, 'replayed', true);
    END IF;
    PERFORM keynes_internal.checkpoint('after_command_binding');
    FOR item IN SELECT value FROM jsonb_array_elements(definitions)
    LOOP
      stored_resource := keynes_internal.resolve_resource_v0007(
        tenant, principal, command_id_value, gen_random_uuid(), item->'definition'
      );
      members := members || jsonb_build_array(jsonb_build_object(
        'key', item->>'key',
        'resourceType', jsonb_build_object(
          'resourceTypeId', stored_resource.resource_type_id::text,
          'canonicalName', stored_resource.canonical_name,
          'unit', stored_resource.unit,
          'accountingBehavior', stored_resource.accounting_behavior,
          'definitionDigest', stored_resource.definition_digest
        ),
        'definitionEvidence', jsonb_build_object(
          'kind', 'resource_type_defined',
          'commandId', stored_resource.definition_command_id::text,
          'principalId', stored_resource.definer_principal_id::text,
          'definitionDigest', stored_resource.definition_digest
        )
      ));
    END LOOP;
    PERFORM keynes_internal.checkpoint('after_resource_insertion');
    PERFORM keynes_internal.checkpoint('after_domain_mutation');
    reference_value := keynes_internal.remote_token_v0006('krs_v1_', tenant::text || ':' || command_id_value::text);
    result_value := jsonb_build_object('kind', 'defined', 'bindingReference', reference_value,
      'resources', members);
    UPDATE keynes_internal.commands SET binding_reference = reference_value,
      result = result_value, committed_at = clock_timestamp()
    WHERE tenant_id = tenant AND command_id = command_id_value;
    PERFORM keynes_internal.checkpoint('after_result_storage');
    RETURN jsonb_build_object('ok', true, 'result', result_value, 'replayed', false);
  EXCEPTION WHEN SQLSTATE 'K0001' THEN
    GET STACKED DIAGNOSTICS domain_error_message = MESSAGE_TEXT;
    RETURN jsonb_build_object('ok', false, 'error', domain_error_message::jsonb);
  END;
END;
$function$;

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
    WHEN 'createBudget' THEN RETURN keynes_internal.apply_create_budget_v0007(input);
    ELSE RETURN keynes_internal.apply_command_v0004(operation_name, input);
  END CASE;
END;
$function$;

${renderSecurePublicFunctions(contract)}

${remoteApply}

CREATE FUNCTION keynes_internal.remote_define_resources_v0007(input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
DECLARE domain_error_message text;
BEGIN
  PERFORM set_config('keynes.remote_operation', 'defineResources', true);
  BEGIN
    PERFORM keynes_internal.set_remote_identity_v0006();
    IF NOT EXISTS (SELECT 1 FROM keynes_internal.principal_permissions
      WHERE tenant_id = current_setting('keynes.tenant_id')::uuid
        AND principal_id = current_setting('keynes.principal_id')::uuid
        AND permission = 'define_resource_type') THEN
      PERFORM keynes_internal.raise_domain_error('unauthorized', jsonb_build_object(
        'operation', 'defineResources', 'requiredPermission', 'define_resource_type'
      ));
    END IF;
    IF jsonb_typeof(input) IS DISTINCT FROM 'object' THEN
      PERFORM keynes_internal.invalid_command('defineResources', '$', 'type');
    END IF;
    IF NOT (input ? 'operationKey') OR NOT (input ? 'definitions') THEN
      PERFORM keynes_internal.invalid_command('defineResources', '$', 'required');
    END IF;
    IF input - ARRAY['operationKey', 'definitions']::text[] <> '{}'::jsonb THEN
      PERFORM keynes_internal.invalid_command('defineResources', '$', 'additionalProperties');
    END IF;
    PERFORM keynes_internal.canonical_definitions_v0007('defineResources', input->'definitions');
    RETURN keynes_internal.remote_apply_command_v0007('defineResources', input);
  EXCEPTION WHEN SQLSTATE 'K0001' THEN
    GET STACKED DIAGNOSTICS domain_error_message = MESSAGE_TEXT;
    RETURN jsonb_build_object('ok', false, 'error',
      keynes_internal.remote_safe_error_v0006('defineResources', domain_error_message::jsonb));
  END;
END;
$function$;

CREATE FUNCTION keynes_internal.remote_create_budget_v0007(input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
DECLARE
  permission_name text;
  domain_error_message text;
BEGIN
  PERFORM set_config('keynes.remote_operation', 'createBudget', true);
  BEGIN
    PERFORM keynes_internal.set_remote_identity_v0006();
    IF jsonb_typeof(input) IS DISTINCT FROM 'object' THEN
      PERFORM keynes_internal.invalid_command('createBudget', '$', 'type');
    END IF;
    IF NOT (input ? 'operationKey') OR NOT (input ? 'resources') OR NOT (input ? 'allocation') THEN
      PERFORM keynes_internal.invalid_command('createBudget', '$', 'required');
    END IF;
    IF input - ARRAY['operationKey', 'resources', 'allocation', 'policies']::text[] <> '{}'::jsonb THEN
      PERFORM keynes_internal.invalid_command('createBudget', '$', 'additionalProperties');
    END IF;
    PERFORM keynes_internal.canonical_creation_v0007(input->'resources', input->'allocation');
    FOR permission_name IN SELECT unnest(CASE WHEN input->'resources'->>'kind' = 'definitions'
      THEN ARRAY['create_root_budget', 'define_resource_type'] ELSE ARRAY['create_root_budget'] END)
    LOOP
      IF NOT EXISTS (SELECT 1 FROM keynes_internal.principal_permissions
        WHERE tenant_id = current_setting('keynes.tenant_id')::uuid
          AND principal_id = current_setting('keynes.principal_id')::uuid
          AND permission = permission_name) THEN
        PERFORM keynes_internal.raise_domain_error('unauthorized', jsonb_build_object(
          'operation', 'createBudget', 'requiredPermission', permission_name
        ));
      END IF;
    END LOOP;
    RETURN keynes_internal.remote_apply_command_v0007('createBudget', input);
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
  SELECT keynes_internal.remote_create_budget_v0007(input);
$function$;

${compatibility}

CREATE FUNCTION keynes.remote_define_resources(input jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
  SELECT keynes_internal.remote_define_resources_v0007(input);
$function$;

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
  RETURN keynes_internal.remote_get_compatibility_v0007(input);
END;
$function$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA keynes_internal FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes.remote_define_resources(jsonb) FROM PUBLIC;
`;
}

function extractFunction(sql: string, name: string): string {
  const start = sql.indexOf(`CREATE FUNCTION keynes_internal.${name}(`);
  const end = sql.indexOf("\n$function$;", start);
  if (start < 0 || end < 0)
    throw new Error(`Missing historical function: ${name}`);
  return sql.slice(start, end + "\n$function$;".length);
}

function withSharedResolver(
  sql: string,
  name: string,
  resourceId: string,
): string {
  const singleton = name === "apply_define_resource_v0005";
  const indent = singleton ? "    " : "      ";
  const resolverStart =
    sql.indexOf(
      `\n${indent}definition_digest_value := 'resource-definition:'`,
    ) + 1;
  const end = sql.indexOf(
    singleton
      ? "    PERFORM keynes_internal.checkpoint('after_domain_mutation');"
      : "      resolved_items :=",
    resolverStart,
  );
  if (resolverStart === 0 || end < 0)
    throw new Error(`Missing Resource resolver: ${name}`);
  return (
    sql.slice(0, resolverStart) +
    `    stored_resource := keynes_internal.resolve_resource_v0007(
      tenant, principal, command_id, ${resourceId}, canonical_definition
    );
` +
    sql.slice(end)
  )
    .replaceAll(name, name.replace("v0005", "v0007"))
    .replace("  definition_digest_value text;\n", "")
    .replace("  resource_id uuid;\n", "");
}

function withTaggedCreation(sql: string): string {
  const validationStart = sql.indexOf(
    "    items := keynes_internal.canonical_root_resources_v0005(",
  );
  const validationEnd = sql.indexOf("    policies :=", validationStart);
  const bodyStart = sql.indexOf(
    "    body := jsonb_build_object('resources', items)",
  );
  if (validationStart < 0 || validationEnd < 0 || bodyStart < 0) {
    throw new Error("Missing historical creation validation");
  }
  let tagged =
    sql.slice(0, validationStart) +
    `    body := keynes_internal.canonical_creation_v0007(input->'resources', input->'allocation');
    source_value := body->'resources';
` +
    sql.slice(validationEnd);
  tagged = tagged
    .replace(
      "  items jsonb;",
      "  items jsonb := '[]'::jsonb;\n  source_value jsonb;\n  members jsonb;\n  allocation_item jsonb;\n  member jsonb;\n  receipt keynes_internal.commands%ROWTYPE;",
    )
    .replace(
      "IF NOT (input ? 'commandId') OR NOT (input ? 'resources') THEN",
      "IF NOT (input ? 'commandId') OR NOT (input ? 'resources') OR NOT (input ? 'allocation') THEN",
    )
    .replace(
      "ARRAY['commandId', 'resources', 'policies']",
      "ARRAY['commandId', 'resources', 'allocation', 'policies']",
    )
    .replace("body := jsonb_build_object('resources', items)", "body := body")
    .replace(
      "    IF NOT EXISTS (\n      SELECT 1 FROM keynes_internal.principal_permissions",
      "    IF source_value->>'kind' = 'definitions' AND NOT EXISTS (\n      SELECT 1 FROM keynes_internal.principal_permissions",
    );
  const resolution = `
    IF source_value->>'kind' = 'definitions' THEN
      members := source_value->'definitions';
    ELSE
      SELECT * INTO receipt FROM keynes_internal.commands
      WHERE tenant_id = tenant AND binding_reference = source_value->>'bindingReference'
        AND operation = 'defineResources' AND committed_at IS NOT NULL;
      IF NOT FOUND OR jsonb_typeof(receipt.result) IS DISTINCT FROM 'object'
        OR receipt.result->>'kind' IS DISTINCT FROM 'defined'
        OR receipt.result->>'bindingReference' IS DISTINCT FROM source_value->>'bindingReference'
        OR jsonb_typeof(receipt.result->'resources') IS DISTINCT FROM 'array' THEN
        PERFORM keynes_internal.invalid_command(operation_name, '$.resources.bindingReference', 'resourceBinding');
      END IF;
      members := receipt.result->'resources';
      IF jsonb_array_length(members) = 0 OR (SELECT count(DISTINCT value->>'key') FROM jsonb_array_elements(members)) <> jsonb_array_length(members)
        OR EXISTS (SELECT 1 FROM jsonb_array_elements(members) bound_member
          WHERE jsonb_typeof(bound_member->'key') IS DISTINCT FROM 'string'
            OR bound_member->>'key' !~ '^[a-z][A-Za-z0-9]*$'
            OR bound_member->'definitionEvidence'->>'kind' IS DISTINCT FROM 'resource_type_defined'
            OR NOT EXISTS (SELECT 1 FROM keynes_internal.resource_types r
              WHERE r.tenant_id = tenant
                AND r.resource_type_id::text = bound_member->'resourceType'->>'resourceTypeId'
                AND r.canonical_name = lower(regexp_replace(bound_member->>'key', '([A-Z])', '_\\1', 'g'))
                AND r.canonical_name = bound_member->'resourceType'->>'canonicalName'
                AND r.unit = bound_member->'resourceType'->>'unit'
                AND r.accounting_behavior = bound_member->'resourceType'->>'accountingBehavior'
                AND r.definition_digest = bound_member->'resourceType'->>'definitionDigest'
                AND r.definition_digest = bound_member->'definitionEvidence'->>'definitionDigest'
                AND r.definition_command_id::text = bound_member->'definitionEvidence'->>'commandId'
                AND r.definer_principal_id::text = bound_member->'definitionEvidence'->>'principalId')) THEN
        PERFORM keynes_internal.invalid_command(operation_name, '$.resources.bindingReference', 'resourceBinding');
      END IF;
    END IF;
    FOR allocation_item IN SELECT value FROM jsonb_array_elements(body->'allocation')
    LOOP
      SELECT value INTO member FROM jsonb_array_elements(members) WHERE value->>'key' = allocation_item->>'key';
      IF NOT FOUND THEN
        PERFORM keynes_internal.invalid_command(operation_name, '$.allocation.' || (allocation_item->>'key'), 'resourceBinding');
      END IF;
      items := items || jsonb_build_array(jsonb_build_object(
        'definition', CASE WHEN source_value->>'kind' = 'definitions' THEN member->'definition'
          ELSE (member->'resourceType') - ARRAY['resourceTypeId', 'definitionDigest']::text[] END,
        'resourceTypeId', member->'resourceType'->'resourceTypeId',
        'amount', allocation_item->'amount'
      ));
    END LOOP;
`;
  tagged = tagged.replace(
    "    PERFORM keynes_internal.checkpoint('after_command_binding');",
    () =>
      "    PERFORM keynes_internal.checkpoint('after_command_binding');\n" +
      resolution,
  );
  const resolver = `    stored_resource := keynes_internal.resolve_resource_v0007(
      tenant, principal, command_id, gen_random_uuid(), canonical_definition
    );`;
  if (!tagged.includes(resolver))
    throw new Error("Missing shared creation resolver");
  return tagged.replace(
    resolver,
    `      IF source_value->>'kind' = 'definitions' THEN
        stored_resource := keynes_internal.resolve_resource_v0007(
          tenant, principal, command_id, gen_random_uuid(), canonical_definition
        );
      ELSE
        SELECT * INTO STRICT stored_resource FROM keynes_internal.resource_types
          WHERE tenant_id = tenant AND resource_type_id::text = item->>'resourceTypeId';
      END IF;`,
  );
}
