ALTER FUNCTION keynes_internal.apply_command(operation_name text, input jsonb)
  RENAME TO apply_command_v0006;

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
  definition_digest_value text;
  resource_id uuid;
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
  principal uuid;
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
  principal := current_setting('keynes.principal_id')::uuid;
  IF operation_name = 'createBudget' AND NOT EXISTS (
    SELECT 1 FROM keynes_internal.principal_permissions
    WHERE tenant_id = tenant AND principal_id = principal
      AND permission = 'create_root_budget'
  ) THEN
    RETURN keynes_internal.remote_error_v0006(
      'unauthorized', operation_name
    );
  END IF;
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
    IF operation_name = 'createBudget' THEN
      IF jsonb_typeof(input->'resources') IS DISTINCT FROM 'array'
        OR jsonb_array_length(input->'resources') = 0
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(input->'resources') item(value)
           WHERE jsonb_typeof(item.value->'amount') IS DISTINCT FROM 'number'
              OR (item.value->>'amount')::numeric < 0
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
      remote_result := keynes_internal.remote_project_json_v0006(
        tenant, core_response->'result'
      ) || jsonb_build_object('replayed', false);
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
  IF operation_name = 'createBudget'
    AND response_value->>'code' = 'unauthorized' THEN
    DELETE FROM keynes_internal.remote_operations stored
     WHERE stored.tenant_id = tenant
       AND stored.operation_key = operation_key_value;
    RETURN jsonb_build_object('ok', false, 'error', response_value);
  END IF;
  UPDATE keynes_internal.remote_operations stored
     SET status = 'known_failure', response = response_value,
         completed_at = clock_timestamp()
   WHERE stored.tenant_id = tenant
     AND stored.operation_key = operation_key_value;
  RETURN jsonb_build_object('ok', false, 'error', response_value);
END;
$function$;

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
