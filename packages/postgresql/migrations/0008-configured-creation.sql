CREATE FUNCTION keynes_internal.remote_get_compatibility_v0008(input jsonb)
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
      'semanticGeneration', 3,
      'minimumSdkGeneration', 3,
      'procedures', '[{"name":"defineResources","target":"keynes.remote_define_resources","revision":1},{"name":"validateResources","target":"keynes.remote_validate_resources","revision":1},{"name":"createBudget","target":"keynes.remote_create_budget","revision":3},{"name":"requestBudget","target":"keynes.remote_request","revision":1},{"name":"settleBudget","target":"keynes.remote_settle","revision":1},{"name":"getBudget","target":"keynes.remote_get_budget","revision":1},{"name":"getBudgetHistoryPage","target":"keynes.remote_get_budget_history_page","revision":1},{"name":"openBudget","target":"keynes.remote_open_budget","revision":1},{"name":"recoverOperation","target":"keynes.remote_recover_operation","revision":1},{"name":"getCompatibility","target":"keynes.remote_get_compatibility","revision":1}]'::jsonb
    )
  );
END;
$function$;

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

CREATE FUNCTION keynes_internal.canonical_creation_v0008(definitions_value jsonb, amounts_value jsonb)
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
        AND stored.command_id = apply_create_budget_v0008.command_id
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
    SET result = apply_create_budget_v0008.result,
        committed_at = clock_timestamp()
    WHERE stored.tenant_id = tenant
      AND stored.command_id = apply_create_budget_v0008.command_id;
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

CREATE FUNCTION keynes_internal.remote_apply_command_v0008(
  operation_name text,
  input jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
<<remote_apply_command_v0008>>
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
    IF operation_name IN ('defineResources', 'createBudget') THEN
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
$function$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA keynes_internal FROM PUBLIC;
