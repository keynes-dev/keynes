const CREATE_BUDGET_SIGNATURE =
  "CREATE FUNCTION keynes_internal.apply_create_budget_v0005(input jsonb)";
const REMOTE_APPLY_SIGNATURE =
  "CREATE FUNCTION keynes_internal.remote_apply_command_v0006(";

export function renderCreateBudgetPermissionsMigration(
  resourceBoundBudgetSql: string,
  remoteAccessSql: string,
): string {
  const createBudget = rewriteCreateBudget(
    extractFunction(resourceBoundBudgetSql, CREATE_BUDGET_SIGNATURE),
  );
  const remoteApply = rewriteRemoteApply(
    extractFunction(remoteAccessSql, REMOTE_APPLY_SIGNATURE),
  );

  return `ALTER FUNCTION keynes_internal.apply_command(operation_name text, input jsonb)
  RENAME TO apply_command_v0006;

${createBudget}

CREATE FUNCTION keynes_internal.apply_command(operation_name text, input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
BEGIN
  IF operation_name = 'createBudget' THEN
    RETURN keynes_internal.apply_create_budget_v0007(input);
  END IF;
  RETURN keynes_internal.apply_command_v0006(operation_name, input);
END;
$function$;

${remoteApply}

CREATE FUNCTION keynes_internal.remote_dispatch_v0007(
  operation_name text,
  input jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
DECLARE validation_response jsonb;
BEGIN
  IF operation_name <> 'createBudget' THEN
    RETURN keynes_internal.remote_dispatch_v0006(operation_name, input);
  END IF;
  BEGIN
    validation_response := keynes_internal.remote_validate_input_v0006(
      operation_name, input
    );
    IF validation_response IS NOT NULL THEN
      RETURN validation_response;
    END IF;
    RETURN keynes_internal.remote_apply_command_v0007(operation_name, input);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'kind', 'error', 'code', 'unknown', 'details', '{}'::jsonb
      )
    );
  END;
END;
$function$;

CREATE OR REPLACE FUNCTION keynes.remote_create_budget(input jsonb) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
  SELECT keynes_internal.remote_dispatch_v0007('createBudget', input);
$function$;

REVOKE ALL ON FUNCTION keynes_internal.apply_command_v0006(text, jsonb)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.apply_create_budget_v0007(jsonb)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.apply_command(text, jsonb)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.remote_apply_command_v0007(text, jsonb)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.remote_dispatch_v0007(text, jsonb)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes.remote_create_budget(jsonb) FROM PUBLIC;
`;
}

function rewriteCreateBudget(source: string): string {
  const versioned = source.replaceAll(
    "apply_create_budget_v0005",
    "apply_create_budget_v0007",
  );
  const authorized = replaceSection(
    versioned,
    "    IF coalesce(current_setting('keynes.tenant_id', true), '')",
    "    body_digest_value := 'command-body:'",
    `${rootAuthorization()}\n\n`,
    "createBudget authorization block",
  );
  return replaceSection(
    authorized,
    "    FOR item IN\n      SELECT member.value FROM jsonb_array_elements(items) AS member(value)\n    LOOP",
    "    PERFORM keynes_internal.checkpoint('after_resource_insertion');",
    `${resourceReconciliation()}\n`,
    "createBudget Resource reconciliation block",
  );
}

function rewriteRemoteApply(source: string): string {
  let versioned = source.replaceAll(
    "remote_apply_command_v0006",
    "remote_apply_command_v0007",
  );
  versioned = replaceRequired(
    versioned,
    "OR (item.value->>'amount')::numeric <= 0",
    "OR (item.value->>'amount')::numeric < 0",
    "remote createBudget positive-only check",
  );
  versioned = replaceRequired(
    versioned,
    "  tenant uuid;\n",
    "  tenant uuid;\n  principal uuid;\n",
    "remote principal declaration",
  );
  versioned = replaceRequired(
    versioned,
    "  tenant := current_setting('keynes.tenant_id')::uuid;\n",
    `${remoteRootAuthorization()}\n`,
    "remote root authorization",
  );
  return replaceRequired(
    versioned,
    "  UPDATE keynes_internal.remote_operations stored\n     SET status = 'known_failure'",
    `${conditionalDenialRollback()}\n  UPDATE keynes_internal.remote_operations stored\n     SET status = 'known_failure'`,
    "remote conditional denial rollback",
  );
}

function extractFunction(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`missing migration function ${signature}`);
  const marker = "$function$;";
  const end = source.indexOf(marker, start);
  if (end < 0) throw new Error(`unterminated migration function ${signature}`);
  return source.slice(start, end + marker.length);
}

function replaceRequired(
  source: string,
  search: string | RegExp,
  replacement: string,
  description: string,
): string {
  const rewritten = source.replace(search, replacement);
  if (rewritten === source) throw new Error(`missing ${description}`);
  return rewritten;
}

function replaceSection(
  source: string,
  startMarker: string,
  endMarker: string,
  replacement: string,
  description: string,
): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`missing ${description}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

function rootAuthorization(): string {
  return `    IF coalesce(current_setting('keynes.tenant_id', true), '')
        !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR coalesce(current_setting('keynes.principal_id', true), '')
        !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      PERFORM keynes_internal.raise_domain_error(
        'unauthorized',
        jsonb_build_object(
          'operation', operation_name,
          'requiredPermission', 'create_root_budget'
        )
      );
    END IF;
    tenant := current_setting('keynes.tenant_id')::uuid;
    principal := current_setting('keynes.principal_id')::uuid;
    IF NOT EXISTS (
      SELECT 1 FROM keynes_internal.principal_permissions
      WHERE tenant_id = tenant AND principal_id = principal
        AND permission = 'create_root_budget'
    ) THEN
      PERFORM keynes_internal.raise_domain_error(
        'unauthorized',
        jsonb_build_object(
          'operation', operation_name,
          'requiredPermission', 'create_root_budget'
        )
      );
    END IF;`;
}

function remoteRootAuthorization(): string {
  return `  tenant := current_setting('keynes.tenant_id')::uuid;
  principal := current_setting('keynes.principal_id')::uuid;
  IF operation_name = 'createBudget' AND NOT EXISTS (
    SELECT 1 FROM keynes_internal.principal_permissions
    WHERE tenant_id = tenant AND principal_id = principal
      AND permission = 'create_root_budget'
  ) THEN
    RETURN keynes_internal.remote_error_v0006(
      'unauthorized', operation_name
    );
  END IF;`;
}

function conditionalDenialRollback(): string {
  return `  IF operation_name = 'createBudget'
    AND response_value->>'code' = 'unauthorized' THEN
    DELETE FROM keynes_internal.remote_operations stored
     WHERE stored.tenant_id = tenant
       AND stored.operation_key = operation_key_value;
    RETURN jsonb_build_object('ok', false, 'error', response_value);
  END IF;`;
}

function resourceReconciliation(): string {
  return `    FOR item IN
      SELECT member.value FROM jsonb_array_elements(items) AS member(value)
    LOOP
      canonical_definition := item->'definition';
      definition_digest_value := 'resource-definition:' || encode(
        sha256(convert_to(canonical_definition::text, 'UTF8')), 'hex'
      );
      SELECT * INTO stored_resource
      FROM keynes_internal.resource_types AS resource_type
      WHERE resource_type.tenant_id = tenant
        AND resource_type.canonical_name = canonical_definition->>'canonicalName'
      FOR UPDATE;
      IF FOUND AND (
        stored_resource.definition_digest <> definition_digest_value
        OR stored_resource.definition <> canonical_definition
      ) THEN
        PERFORM keynes_internal.raise_domain_error(
          'resource_type_conflict',
          jsonb_build_object(
            'canonicalName', canonical_definition->>'canonicalName',
            'existingDefinitionDigest', stored_resource.definition_digest,
            'attemptedDefinitionDigest', definition_digest_value
          )
        );
      END IF;
    END LOOP;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(items) AS member(value)
      WHERE NOT EXISTS (
        SELECT 1
        FROM keynes_internal.resource_types AS resource_type
        WHERE resource_type.tenant_id = tenant
          AND resource_type.canonical_name =
            member.value->'definition'->>'canonicalName'
      )
    ) AND NOT EXISTS (
      SELECT 1 FROM keynes_internal.principal_permissions
      WHERE tenant_id = tenant AND principal_id = principal
        AND permission = 'define_resource_type'
    ) THEN
      PERFORM keynes_internal.raise_domain_error(
        'unauthorized',
        jsonb_build_object(
          'operation', operation_name,
          'requiredPermission', 'define_resource_type'
        )
      );
    END IF;

    FOR item IN
      SELECT member.value FROM jsonb_array_elements(items) AS member(value)
    LOOP
      canonical_definition := item->'definition';
      definition_digest_value := 'resource-definition:' || encode(
        sha256(convert_to(canonical_definition::text, 'UTF8')), 'hex'
      );
      SELECT * INTO stored_resource
      FROM keynes_internal.resource_types AS resource_type
      WHERE resource_type.tenant_id = tenant
        AND resource_type.canonical_name = canonical_definition->>'canonicalName'
      FOR UPDATE;
      IF NOT FOUND THEN
        resource_id := gen_random_uuid();
        WHILE resource_id = command_id LOOP
          resource_id := gen_random_uuid();
        END LOOP;
        INSERT INTO keynes_internal.resource_types (
          tenant_id, resource_type_id, definition_command_id, canonical_name,
          unit, accounting_behavior, definition, definition_digest,
          definer_principal_id
        ) VALUES (
          tenant, resource_id, command_id,
          canonical_definition->>'canonicalName',
          canonical_definition->>'unit',
          canonical_definition->>'accountingBehavior', canonical_definition,
          definition_digest_value, principal
        ) ON CONFLICT (tenant_id, canonical_name) DO NOTHING
        RETURNING * INTO stored_resource;
        IF NOT FOUND THEN
          SELECT * INTO stored_resource
          FROM keynes_internal.resource_types AS resource_type
          WHERE resource_type.tenant_id = tenant
            AND resource_type.canonical_name = canonical_definition->>'canonicalName'
          FOR UPDATE;
        END IF;
      END IF;
      IF stored_resource.definition_digest <> definition_digest_value
        OR stored_resource.definition <> canonical_definition THEN
        PERFORM keynes_internal.raise_domain_error(
          'resource_type_conflict',
          jsonb_build_object(
            'canonicalName', canonical_definition->>'canonicalName',
            'existingDefinitionDigest', stored_resource.definition_digest,
            'attemptedDefinitionDigest', definition_digest_value
          )
        );
      END IF;
      resolved_items := resolved_items || jsonb_build_array(
        jsonb_build_object(
          'resourceTypeId', stored_resource.resource_type_id::text,
          'amount', (item->>'amount')::numeric
        )
      );
    END LOOP;`;
}
