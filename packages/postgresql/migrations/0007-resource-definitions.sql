ALTER TABLE keynes_internal.commands
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
    canonical_name := lower(regexp_replace(entry.key, '([A-Z])', '_\1', 'g'));
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

CREATE FUNCTION keynes_internal.apply_define_resource_v0007(input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
<<apply_define_resource_v0007>>
DECLARE
  operation_name constant text := 'defineResource';
  tenant uuid;
  principal uuid;
  command_id uuid;
  canonical_definition jsonb;
  body jsonb;
  body_digest_value text;
  prior keynes_internal.commands%ROWTYPE;
  stored_resource keynes_internal.resource_types%ROWTYPE;
  result jsonb;
  domain_error_message text;
BEGIN
  BEGIN
    IF jsonb_typeof(input) IS DISTINCT FROM 'object' THEN
      PERFORM keynes_internal.invalid_command(operation_name, '$', 'type');
    END IF;
    IF NOT (input ? 'commandId') OR NOT (input ? 'definition') THEN
      PERFORM keynes_internal.invalid_command(operation_name, '$', 'required');
    END IF;
    IF input - ARRAY['commandId', 'definition']::text[] <> '{}'::jsonb THEN
      PERFORM keynes_internal.invalid_command(
        operation_name, '$', 'additionalProperties'
      );
    END IF;
    IF jsonb_typeof(input->'commandId') IS DISTINCT FROM 'string' THEN
      PERFORM keynes_internal.invalid_command(
        operation_name, '$.commandId', 'type'
      );
    END IF;
    IF input->>'commandId'
      !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      PERFORM keynes_internal.invalid_command(
        operation_name, '$.commandId', 'format'
      );
    END IF;
    command_id := (input->>'commandId')::uuid;
    canonical_definition := keynes_internal.canonical_resource_definition_v0005(
      operation_name, input->'definition', '$.definition'
    );
    body := jsonb_build_object('definition', canonical_definition);

    IF coalesce(current_setting('keynes.tenant_id', true), '')
        !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR coalesce(current_setting('keynes.principal_id', true), '')
        !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      PERFORM keynes_internal.raise_domain_error(
        'unauthorized',
        jsonb_build_object(
          'operation', operation_name,
          'requiredPermission', 'define_resource_type'
        )
      );
    END IF;
    tenant := current_setting('keynes.tenant_id')::uuid;
    principal := current_setting('keynes.principal_id')::uuid;
    IF NOT EXISTS (
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

    body_digest_value := 'command-body:' || encode(
      sha256(convert_to(body::text, 'UTF8')), 'hex'
    );
    INSERT INTO keynes_internal.commands (
      tenant_id, command_id, operation, target_kind, target_id,
      canonical_body, body_digest, principal_id
    ) VALUES (
      tenant, command_id, operation_name, 'resource_type', command_id,
      body, body_digest_value, principal
    ) ON CONFLICT ON CONSTRAINT commands_pkey DO NOTHING;
    IF NOT FOUND THEN
      SELECT * INTO prior FROM keynes_internal.commands AS stored
      WHERE stored.tenant_id = tenant
        AND stored.command_id = apply_define_resource_v0007.command_id
      FOR UPDATE;
      IF prior.operation <> operation_name
        OR prior.target_kind <> 'resource_type'
        OR prior.target_id <> command_id
        OR prior.canonical_body <> body
        OR prior.body_digest <> body_digest_value THEN
        PERFORM keynes_internal.raise_domain_error(
          'command_conflict',
          jsonb_build_object(
            'commandId', command_id::text,
            'existingOperation', prior.operation,
            'attemptedOperation', operation_name
          )
        );
      END IF;
      RETURN jsonb_build_object(
        'ok', true, 'result', prior.result, 'replayed', true
      );
    END IF;
    PERFORM keynes_internal.checkpoint('after_command_binding');

    stored_resource := keynes_internal.resolve_resource_v0007(
      tenant, principal, command_id, command_id, canonical_definition
    );
    PERFORM keynes_internal.checkpoint('after_domain_mutation');
    result := jsonb_build_object(
      'kind', 'defined',
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
    );
    UPDATE keynes_internal.commands AS stored
    SET result = apply_define_resource_v0007.result,
        committed_at = clock_timestamp()
    WHERE stored.tenant_id = tenant
      AND stored.command_id = apply_define_resource_v0007.command_id;
    PERFORM keynes_internal.checkpoint('after_result_storage');
    RETURN jsonb_build_object(
      'ok', true, 'result', result, 'replayed', false
    );
  EXCEPTION WHEN SQLSTATE 'K0001' THEN
    GET STACKED DIAGNOSTICS domain_error_message = MESSAGE_TEXT;
    RETURN jsonb_build_object(
      'ok', false, 'error', domain_error_message::jsonb
    );
  END;
END;
$function$;

CREATE FUNCTION keynes_internal.apply_create_budget_v0007(input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
<<apply_create_budget_v0007>>
DECLARE
  operation_name constant text := 'createBudget';
  tenant uuid;
  principal uuid;
  command_id uuid;
  items jsonb;
  policies jsonb;
  body jsonb;
  body_digest_value text;
  prior keynes_internal.commands%ROWTYPE;
  item jsonb;
  policy jsonb;
  canonical_definition jsonb;
  stored_resource keynes_internal.resource_types%ROWTYPE;
  resolved_items jsonb := '[]'::jsonb;
  result jsonb;
  expected_resources jsonb;
  expected_result jsonb;
  domain_error_message text;
BEGIN
  BEGIN
    PERFORM set_config('keynes.policy_operation', operation_name, true);
    PERFORM set_config('keynes.policy_name', '', true);
    PERFORM set_config('keynes.policy_revision', '', true);
    IF jsonb_typeof(input) IS DISTINCT FROM 'object' THEN
      PERFORM keynes_internal.invalid_command(operation_name, '$', 'type');
    END IF;
    IF NOT (input ? 'commandId') OR NOT (input ? 'resources') THEN
      PERFORM keynes_internal.invalid_command(operation_name, '$', 'required');
    END IF;
    IF input - ARRAY['commandId', 'resources', 'policies']::text[]
      <> '{}'::jsonb THEN
      PERFORM keynes_internal.invalid_command(
        operation_name, '$', 'additionalProperties'
      );
    END IF;
    IF jsonb_typeof(input->'commandId') IS DISTINCT FROM 'string'
      OR input->>'commandId'
        !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      PERFORM keynes_internal.invalid_command(
        operation_name, '$.commandId', 'format'
      );
    END IF;
    command_id := (input->>'commandId')::uuid;
    items := keynes_internal.canonical_root_resources_v0005(
      operation_name, input->'resources', '$.resources'
    );
    policies := keynes_internal.canonical_policy_set(
      coalesce(input->'policies', '[]'::jsonb)
    );
    body := jsonb_build_object('resources', items)
      || CASE
        WHEN jsonb_typeof(policies) = 'array'
          AND jsonb_array_length(policies) = 0 THEN '{}'::jsonb
        ELSE jsonb_build_object('policies', policies)
      END;

    IF coalesce(current_setting('keynes.tenant_id', true), '')
        !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR coalesce(current_setting('keynes.principal_id', true), '')
        !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      PERFORM keynes_internal.raise_domain_error(
        'unauthorized',
        jsonb_build_object(
          'operation', operation_name,
          'requiredPermission', 'define_resource_type'
        )
      );
    END IF;
    tenant := current_setting('keynes.tenant_id')::uuid;
    principal := current_setting('keynes.principal_id')::uuid;
    IF NOT EXISTS (
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
    END IF;

    body_digest_value := 'command-body:' || encode(
      sha256(convert_to(body::text, 'UTF8')), 'hex'
    );
    INSERT INTO keynes_internal.commands (
      tenant_id, command_id, operation, target_kind, target_id,
      canonical_body, body_digest, principal_id
    ) VALUES (
      tenant, command_id, operation_name, 'budget', command_id,
      body, body_digest_value, principal
    ) ON CONFLICT ON CONSTRAINT commands_pkey DO NOTHING;
    IF NOT FOUND THEN
      SELECT * INTO prior FROM keynes_internal.commands AS stored
      WHERE stored.tenant_id = tenant
        AND stored.command_id = apply_create_budget_v0007.command_id
      FOR UPDATE;
      IF prior.operation <> operation_name OR prior.target_kind <> 'budget'
        OR prior.target_id <> command_id OR prior.canonical_body <> body
        OR prior.body_digest <> body_digest_value THEN
        PERFORM keynes_internal.raise_domain_error(
          'command_conflict',
          jsonb_build_object(
            'commandId', command_id::text,
            'existingOperation', prior.operation,
            'attemptedOperation', operation_name
          )
        );
      END IF;
      RETURN jsonb_build_object(
        'ok', true, 'result', prior.result, 'replayed', true
      );
    END IF;
    PERFORM keynes_internal.checkpoint('after_command_binding');

    FOR item IN
      SELECT member.value FROM jsonb_array_elements(items) AS member(value)
    LOOP
      canonical_definition := item->'definition';
    stored_resource := keynes_internal.resolve_resource_v0007(
      tenant, principal, command_id, gen_random_uuid(), canonical_definition
    );
      resolved_items := resolved_items || jsonb_build_array(
        jsonb_build_object(
          'resourceTypeId', stored_resource.resource_type_id::text,
          'amount', (item->>'amount')::numeric
        )
      );
    END LOOP;
    PERFORM keynes_internal.checkpoint('after_resource_insertion');

    PERFORM keynes_internal.validate_policy_set(policies);
    FOR policy IN
      SELECT member.value
      FROM jsonb_array_elements(policies) AS member(value)
    LOOP
      PERFORM set_config(
        'keynes.policy_name', coalesce(policy->>'name', ''), true
      );
      PERFORM set_config(
        'keynes.policy_revision', coalesce(policy->>'revision', ''), true
      );
      IF EXISTS (
        SELECT 1
        FROM (
          SELECT input_name.value AS name
          FROM jsonb_array_elements_text(
            policy->'inputResources'
          ) AS input_name(value)
          UNION ALL
          SELECT output_name.value AS name
          FROM jsonb_array_elements_text(
            policy->'outputResources'
          ) AS output_name(value)
        ) AS referenced
        WHERE NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(items) AS root_resource(value)
          WHERE root_resource.value->'definition'->>'canonicalName'
            = referenced.name
        )
      ) THEN
        PERFORM keynes_internal.invalid_policy(
          '$.policies', 'allocatedResourceTypes'
        );
      END IF;
    END LOOP;
    INSERT INTO keynes_internal.budgets (
      tenant_id, budget_id, parent_budget_id, root_budget_id,
      depth, lifecycle, policies
    ) VALUES (
      tenant, command_id, NULL, command_id, 0, 'active', policies
    );
    FOR item IN
      SELECT member.value
      FROM jsonb_array_elements(resolved_items) AS member(value)
    LOOP
      INSERT INTO keynes_internal.budget_resources (
        tenant_id, budget_id, resource_type_id, allocated_amount
      ) VALUES (
        tenant, command_id, (item->>'resourceTypeId')::uuid,
        (item->>'amount')::bigint
      );
    END LOOP;
    INSERT INTO keynes_internal.budget_history_streams (
      tenant_id, stream_id
    ) VALUES (tenant, command_id);
    PERFORM keynes_internal.checkpoint('after_domain_mutation');
    PERFORM keynes_internal.append_history(
      tenant, command_id, command_id, 'budget_created', command_id,
      jsonb_build_object(
        'rootBudgetId', command_id::text,
        'resources', resolved_items
      )
    );
    PERFORM keynes_internal.checkpoint('after_history_insertion');
    result := jsonb_build_object(
      'kind', 'created',
      'budget', keynes_internal.budget_projection(tenant, command_id)
    );
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'resourceType', jsonb_build_object(
        'resourceTypeId', resource_type.resource_type_id::text,
        'canonicalName', resource_type.canonical_name,
        'unit', resource_type.unit,
        'accountingBehavior', resource_type.accounting_behavior,
        'definitionDigest', resource_type.definition_digest
      ),
      'allocated', (resolved.value->>'amount')::numeric,
      'available', (resolved.value->>'amount')::numeric,
      'committed', 0,
      'directUsage', NULL,
      'subtreeObservedUsage', 0,
      'unresolved', true,
      'deficit', 0
    ) ORDER BY resource_type.canonical_name COLLATE "C",
               resource_type.resource_type_id), '[]'::jsonb)
    INTO expected_resources
    FROM jsonb_array_elements(resolved_items) AS resolved(value)
    JOIN keynes_internal.resource_types AS resource_type
      ON resource_type.tenant_id = tenant
      AND resource_type.resource_type_id =
        (resolved.value->>'resourceTypeId')::uuid;
    expected_result := jsonb_build_object(
      'kind', 'created',
      'budget', jsonb_build_object(
        'budgetId', command_id::text,
        'parentBudgetId', NULL,
        'rootBudgetId', command_id::text,
        'depth', 0,
        'lifecycle', 'active',
        'resources', expected_resources
      )
    );
    IF result IS DISTINCT FROM expected_result THEN
      RAISE EXCEPTION 'invalid CreateBudget result' USING ERRCODE = 'XX000';
    END IF;
    UPDATE keynes_internal.commands AS stored
    SET result = apply_create_budget_v0007.result,
        committed_at = clock_timestamp()
    WHERE stored.tenant_id = tenant
      AND stored.command_id = apply_create_budget_v0007.command_id;
    PERFORM keynes_internal.checkpoint('after_result_storage');
    RETURN jsonb_build_object(
      'ok', true, 'result', result, 'replayed', false
    );
  EXCEPTION WHEN SQLSTATE 'K0001' THEN
    GET STACKED DIAGNOSTICS domain_error_message = MESSAGE_TEXT;
    RETURN jsonb_build_object(
      'ok', false, 'error', domain_error_message::jsonb
    );
  END;
END;
$function$;

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

CREATE OR REPLACE FUNCTION keynes.define_resource_type(input jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
  SELECT keynes_internal.apply_command('defineResource', input);
$$;

CREATE OR REPLACE FUNCTION keynes.define_resources(input jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
  SELECT keynes_internal.apply_command('defineResources', input);
$$;

CREATE OR REPLACE FUNCTION keynes.create_budget(input jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
  SELECT keynes_internal.apply_command('createBudget', input);
$$;

CREATE OR REPLACE FUNCTION keynes.request(input jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
  SELECT keynes_internal.apply_command('requestBudget', input);
$$;

CREATE OR REPLACE FUNCTION keynes.settle(input jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
  SELECT keynes_internal.apply_command('settleBudget', input);
$$;

CREATE OR REPLACE FUNCTION keynes.get_budget(input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
BEGIN
  RETURN keynes_internal.get_budget(input);
  EXCEPTION
    WHEN SQLSTATE 'K0001' THEN
      RETURN jsonb_build_object('ok', false, 'error', SQLERRM::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION keynes.define_resource_type(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes.define_resources(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes.create_budget(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes.request(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes.settle(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes.get_budget(jsonb) FROM PUBLIC;

CREATE FUNCTION keynes_internal.remote_apply_command_v0007(
  operation_name text,
  input jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
<<remote_apply_command_v0007>>
DECLARE
  tenant uuid;
  operation_key_value text;
  command_id_value uuid;
  digest_value text;
  prior keynes_internal.remote_operations%ROWTYPE;
  core_input jsonb;
  core_response jsonb;
  remote_result jsonb;
  response_value jsonb;
  parent_budget uuid;
  target_budget uuid;
  domain_error_message text;
BEGIN
  PERFORM set_config('keynes.remote_operation', operation_name, true);
  BEGIN
    PERFORM keynes_internal.set_remote_identity_v0006();
  EXCEPTION WHEN SQLSTATE 'K0001' THEN
    RETURN keynes_internal.remote_error_v0006('unauthorized', operation_name);
  END;
  tenant := current_setting('keynes.tenant_id')::uuid;
  IF jsonb_typeof(input) IS DISTINCT FROM 'object'
    OR jsonb_typeof(input->'operationKey') IS DISTINCT FROM 'string'
    OR input->>'operationKey' !~ '^kop_v1_[A-Za-z0-9_-]{43}$' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'kind', 'error', 'code', 'invalid_command',
        'details', jsonb_build_object(
          'operation', operation_name,
          'issues', jsonb_build_array(
            jsonb_build_object('path', '$.operationKey', 'rule', 'format')
          )
        )
      )
    );
  END IF;
  operation_key_value := input->>'operationKey';
  PERFORM pg_advisory_xact_lock(
    keynes_internal.remote_operation_lock_key_v0006(
      tenant, operation_key_value
    )
  );
  command_id_value := keynes_internal.event_uuid(
    'remote-operation:' || tenant::text || ':' || operation_key_value
  );
  digest_value := encode(sha256(convert_to(input::text, 'UTF8')), 'hex');
  INSERT INTO keynes_internal.remote_operations (
    tenant_id, operation_key, command_id, operation,
    canonical_input, input_digest
  ) VALUES (
    tenant, operation_key_value, command_id_value, operation_name,
    input, digest_value
  ) ON CONFLICT (tenant_id, operation_key) DO NOTHING;
  IF NOT FOUND THEN
    SELECT * INTO STRICT prior FROM keynes_internal.remote_operations stored
     WHERE stored.tenant_id = tenant
       AND stored.operation_key = operation_key_value
     FOR UPDATE;
    IF prior.operation <> operation_name
      OR prior.input_digest <> digest_value
      OR prior.canonical_input <> input THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'kind', 'error', 'code', 'command_conflict', 'details', '{}'::jsonb
        )
      );
    END IF;
    IF prior.status = 'unresolved' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'kind', 'error', 'code', 'unavailable',
          'details', jsonb_build_object('retryAfterMilliseconds', 100)
        )
      );
    END IF;
    IF prior.status = 'known_failure' THEN
      RETURN jsonb_build_object('ok', false, 'error', prior.response);
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'result', prior.response || jsonb_build_object('replayed', true)
    );
  END IF;

  BEGIN
    IF operation_name = 'defineResources' THEN
      core_input := (input - 'operationKey') || jsonb_build_object(
        'commandId', command_id_value::text
      );
    ELSIF operation_name = 'createBudget' THEN
      IF jsonb_typeof(input->'resources') IS DISTINCT FROM 'array'
        OR jsonb_array_length(input->'resources') = 0
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(input->'resources') item(value)
           WHERE jsonb_typeof(item.value->'amount') IS DISTINCT FROM 'number'
              OR (item.value->>'amount')::numeric <= 0
        ) THEN
        PERFORM keynes_internal.invalid_command(
          operation_name, '$.resources', 'range'
        );
      END IF;
      core_input := (input - 'operationKey') || jsonb_build_object(
        'commandId', command_id_value::text
      );
    ELSIF operation_name = 'requestBudget' THEN
      parent_budget := keynes_internal.remote_budget_id_v0006(
        tenant, input->>'parentBudgetReference', operation_name
      );
      core_input := (
        input - ARRAY[
          'operationKey', 'parentBudgetReference', 'resources'
        ]::text[]
      ) || jsonb_build_object(
        'commandId', command_id_value::text,
        'parentBudgetId', parent_budget::text,
        'resources', keynes_internal.remote_named_amounts_v0006(
          tenant, parent_budget, coalesce(input->'resources', '[]'::jsonb),
          operation_name, 'resources', true
        )
      );
    ELSIF operation_name = 'settleBudget' THEN
      target_budget := keynes_internal.remote_budget_id_v0006(
        tenant, input->>'budgetReference', operation_name
      );
      core_input := (
        input - ARRAY['operationKey', 'budgetReference', 'usage']::text[]
      ) || jsonb_build_object(
        'commandId', command_id_value::text,
        'budgetId', target_budget::text,
        'usage', keynes_internal.remote_named_amounts_v0006(
          tenant, target_budget, coalesce(input->'usage', '[]'::jsonb),
          operation_name, 'usage', false
        )
      );
    ELSE
      RAISE EXCEPTION 'unsupported remote mutation';
    END IF;
    core_response := keynes_internal.apply_command(operation_name, core_input);
    IF coalesce((core_response->>'ok')::boolean, false) THEN
      IF operation_name = 'createBudget' THEN
        PERFORM keynes_internal.remote_budget_reference_v0006(
          tenant, command_id_value
        );
      ELSIF operation_name = 'requestBudget'
        AND core_response->'result'->>'kind' = 'approved' THEN
        PERFORM keynes_internal.remote_budget_reference_v0006(
          tenant, command_id_value
        );
      END IF;
      remote_result := CASE WHEN operation_name = 'defineResources'
        THEN core_response->'result'
        ELSE keynes_internal.remote_project_json_v0006(
          tenant, core_response->'result'
        ) END || jsonb_build_object('replayed', false);
      UPDATE keynes_internal.remote_operations stored
         SET status = 'committed', response = remote_result,
             completed_at = clock_timestamp()
       WHERE stored.tenant_id = tenant
         AND stored.operation_key = operation_key_value;
      RETURN jsonb_build_object('ok', true, 'result', remote_result);
    END IF;
    response_value := keynes_internal.remote_safe_error_v0006(
      operation_name, core_response->'error'
    );
  EXCEPTION WHEN SQLSTATE 'K0001' THEN
    GET STACKED DIAGNOSTICS domain_error_message = MESSAGE_TEXT;
    response_value := keynes_internal.remote_safe_error_v0006(
      operation_name, domain_error_message::jsonb
    );
  END;
  UPDATE keynes_internal.remote_operations stored
     SET status = 'known_failure', response = response_value,
         completed_at = clock_timestamp()
   WHERE stored.tenant_id = tenant
     AND stored.operation_key = operation_key_value;
  RETURN jsonb_build_object('ok', false, 'error', response_value);
END;
$function$;

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

CREATE FUNCTION keynes_internal.remote_get_compatibility_v0007(input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
DECLARE identity keynes_internal.installation_identity%ROWTYPE;
BEGIN
  PERFORM set_config('keynes.remote_operation', 'getCompatibility', true);
  BEGIN
    PERFORM keynes_internal.set_remote_identity_v0006();
  EXCEPTION WHEN SQLSTATE 'K0001' THEN
    RETURN keynes_internal.remote_error_v0006(
      'unauthorized', 'getCompatibility'
    );
  END;
  SELECT * INTO STRICT identity
    FROM keynes_internal.installation_identity WHERE singleton = true;
  RETURN jsonb_build_object(
    'ok', true,
    'result', jsonb_build_object(
      'installationId', identity.profile_id,
      'contractDigest', identity.contract_digest,
      'policyProfileDigest', identity.policy_profile_digest,
      'remoteProceduresDigest', identity.remote_procedures_digest,
      'semanticGeneration', 2,
      'minimumSdkGeneration', 2,
      'procedures', '[{"name":"defineResources","target":"keynes.remote_define_resources","revision":1},{"name":"createBudget","target":"keynes.remote_create_budget","revision":2},{"name":"requestBudget","target":"keynes.remote_request","revision":1},{"name":"settleBudget","target":"keynes.remote_settle","revision":1},{"name":"getBudget","target":"keynes.remote_get_budget","revision":1},{"name":"getBudgetHistoryPage","target":"keynes.remote_get_budget_history_page","revision":1},{"name":"openBudget","target":"keynes.remote_open_budget","revision":1},{"name":"recoverOperation","target":"keynes.remote_recover_operation","revision":1},{"name":"getCompatibility","target":"keynes.remote_get_compatibility","revision":1}]'::jsonb
    )
  );
END;
$function$;

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
