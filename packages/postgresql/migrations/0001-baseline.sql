SET check_function_bodies = false;

CREATE SCHEMA keynes;

CREATE SCHEMA keynes_internal;

CREATE FUNCTION keynes.create_budget(input jsonb) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
  SELECT keynes_internal.apply_command('createBudget', input);
$$;

CREATE FUNCTION keynes.define_resource_type(input jsonb) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
  SELECT keynes_internal.apply_command('defineResource', input);
$$;

CREATE FUNCTION keynes.define_resources(input jsonb) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
  SELECT keynes_internal.apply_command('defineResources', input);
$$;

CREATE FUNCTION keynes.get_budget(input jsonb) RETURNS jsonb
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

CREATE FUNCTION keynes.remote_create_budget(input jsonb) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
  SELECT keynes_internal.remote_create_budget_v0008(input);
$$;

CREATE FUNCTION keynes.remote_define_resources(input jsonb) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
  SELECT keynes_internal.remote_define_resources_v0008(input);
$$;

CREATE FUNCTION keynes.remote_get_budget(input jsonb) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
  SELECT keynes_internal.remote_dispatch_v0006('getBudget', input);
$$;

CREATE FUNCTION keynes.remote_get_budget_history_page(input jsonb) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
  SELECT keynes_internal.remote_dispatch_v0006(
    'getBudgetHistoryPage', input
  );
$$;

CREATE FUNCTION keynes.remote_get_compatibility(input jsonb) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
DECLARE validation_response jsonb;
BEGIN
  validation_response := keynes_internal.remote_validate_input_v0006('getCompatibility', input);
  IF validation_response IS NOT NULL THEN RETURN validation_response; END IF;
  RETURN keynes_internal.remote_get_compatibility_v0008(input);
END;
$$;

CREATE FUNCTION keynes.remote_open_budget(input jsonb) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
  SELECT keynes_internal.remote_dispatch_v0006('openBudget', input);
$$;

CREATE FUNCTION keynes.remote_recover_operation(input jsonb) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
  SELECT keynes_internal.remote_recover_operation_v0008(input);
$$;

CREATE FUNCTION keynes.remote_request(input jsonb) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
  SELECT keynes_internal.remote_dispatch_v0006('requestBudget', input);
$$;

CREATE FUNCTION keynes.remote_settle(input jsonb) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
  SELECT keynes_internal.remote_dispatch_v0006('settleBudget', input);
$$;

CREATE FUNCTION keynes.remote_validate_resources(input jsonb) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
  SELECT keynes_internal.remote_validate_resources_v0008(input);
$$;

CREATE FUNCTION keynes.request(input jsonb) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
  SELECT keynes_internal.apply_command('requestBudget', input);
$$;

CREATE FUNCTION keynes.settle(input jsonb) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
  SELECT keynes_internal.apply_command('settleBudget', input);
$$;

CREATE FUNCTION keynes.validate_resources(input jsonb) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
  SELECT keynes_internal.validate_resources_v0008(input);
$$;

CREATE FUNCTION keynes_internal.append_history(selected_tenant uuid, selected_stream uuid, selected_command uuid, selected_kind text, selected_subject uuid, details jsonb) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  sequence_value bigint;
  event_id uuid;
  entry jsonb;
BEGIN
  SELECT next_sequence INTO sequence_value
  FROM keynes_internal.budget_history_streams
  WHERE tenant_id = selected_tenant AND stream_id = selected_stream FOR UPDATE;
  UPDATE keynes_internal.budget_history_streams SET next_sequence = next_sequence + 1
  WHERE tenant_id = selected_tenant AND stream_id = selected_stream;
  event_id := keynes_internal.event_uuid(
    selected_tenant::text || ':' || selected_command::text || ':' || selected_kind
  );
  entry := jsonb_build_object(
    'kind', selected_kind, 'entryId', event_id::text, 'sequence', sequence_value,
    'commandId', selected_command::text, 'subjectBudgetId', selected_subject::text
  ) || details;
  INSERT INTO keynes_internal.budget_history_entries (
    tenant_id, stream_id, sequence, event_id, command_id, event_kind, subject_id, payload
  ) VALUES (
    selected_tenant, selected_stream, sequence_value, event_id, selected_command,
    selected_kind, selected_subject, entry
  );
END;
$$;

CREATE FUNCTION keynes_internal.apply_command(operation_name text, input jsonb) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
BEGIN
  CASE operation_name
    WHEN 'defineResources' THEN RETURN keynes_internal.apply_define_resources_v0008(input);
    WHEN 'defineResource' THEN RETURN keynes_internal.apply_define_resource_v0008(input);
    WHEN 'createBudget' THEN RETURN keynes_internal.apply_create_budget_v0008(input);
    ELSE RETURN keynes_internal.apply_command_legacy(operation_name, input);
  END CASE;
END;
$$;

CREATE FUNCTION keynes_internal.apply_command_legacy(operation_name text, input jsonb) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $_$
<<apply_command>>
DECLARE
  permission_name text;
  target_kind text;
  tenant uuid;
  principal uuid;
  command_id uuid;
  parent_id uuid;
  target_id uuid;
  items jsonb;
  canonical_definition jsonb;
  body jsonb;
  body_digest_value text;
  definition_digest_value text;
  prior keynes_internal.commands%ROWTYPE;
  stored_resource keynes_internal.resource_types%ROWTYPE;
  budget keynes_internal.budgets%ROWTYPE;
  item jsonb;
  result jsonb;
  projection jsonb;
  newly_known jsonb := '[]'::jsonb;
  unresolved jsonb;
  deficits jsonb;
  denial_reasons jsonb;
  available_amount numeric;
  existing_usage bigint;
  domain_error_message text;
BEGIN
  permission_name := CASE operation_name
    WHEN 'defineResource' THEN 'define_resource_type'
    WHEN 'createBudget' THEN 'create_root_budget'
    WHEN 'requestBudget' THEN 'request_budget'
    WHEN 'settleBudget' THEN 'settle_budget'
    ELSE NULL
  END;
  IF permission_name IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '0A000',
      MESSAGE = format('operation %L is not implemented', operation_name);
  END IF;
  BEGIN
    IF operation_name = 'defineResource' THEN
      IF input IS NULL OR jsonb_typeof(input) <> 'object' THEN
        PERFORM keynes_internal.invalid_command(operation_name, '$', 'type');
      END IF;
      IF NOT (input ? 'commandId') OR NOT (input ? 'definition') THEN
        PERFORM keynes_internal.invalid_command(operation_name, '$', 'required');
      END IF;
      IF input - ARRAY['commandId', 'definition']::text[] <> '{}'::jsonb THEN
        PERFORM keynes_internal.invalid_command(operation_name, '$', 'additionalProperties');
      END IF;
      IF jsonb_typeof(input->'commandId') <> 'string' THEN
        PERFORM keynes_internal.invalid_command(operation_name, '$.commandId', 'type');
      END IF;
      IF input->>'commandId'
        !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        PERFORM keynes_internal.invalid_command(operation_name, '$.commandId', 'format');
      END IF;
    ELSIF input IS NULL OR jsonb_typeof(input) <> 'object'
      OR NOT (input ? 'commandId')
      OR jsonb_typeof(input->'commandId') <> 'string'
      OR input->>'commandId'
        !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        PERFORM keynes_internal.invalid_command(operation_name, '$.commandId', 'format');
    END IF;
    command_id := (input->>'commandId')::uuid;
    CASE operation_name
      WHEN 'defineResource' THEN
        IF jsonb_typeof(input->'definition') <> 'object' THEN
          PERFORM keynes_internal.invalid_command(operation_name, '$.definition', 'type');
        END IF;
        IF NOT (input->'definition' ? 'canonicalName')
          OR NOT (input->'definition' ? 'unit')
          OR NOT (input->'definition' ? 'accountingBehavior') THEN
          PERFORM keynes_internal.invalid_command(operation_name, '$.definition', 'required');
        END IF;
        IF (input->'definition')
          - ARRAY['canonicalName', 'unit', 'accountingBehavior']::text[]
          <> '{}'::jsonb THEN
          PERFORM keynes_internal.invalid_command(
            operation_name, '$.definition', 'additionalProperties'
          );
        END IF;
        IF jsonb_typeof(input->'definition'->'canonicalName') <> 'string'
          OR (input->'definition'->>'canonicalName') !~ '^[a-z][a-z0-9_]{0,62}$' THEN
          PERFORM keynes_internal.invalid_command(
            operation_name, '$.definition.canonicalName', 'pattern'
          );
        END IF;
        IF jsonb_typeof(input->'definition'->'unit') <> 'string'
          OR char_length(input->'definition'->>'unit') NOT BETWEEN 1 AND 64
          OR input->'definition'->>'unit' <> btrim(input->'definition'->>'unit')
          OR input->'definition'->>'unit' ~ '[[:cntrl:]]' THEN
          PERFORM keynes_internal.invalid_command(
            operation_name, '$.definition.unit', 'format'
          );
        END IF;
        IF jsonb_typeof(input->'definition'->'accountingBehavior') <> 'string'
          OR input->'definition'->>'accountingBehavior'
            NOT IN ('consumable', 'reusable') THEN
          PERFORM keynes_internal.invalid_command(
            operation_name, '$.definition.accountingBehavior', 'enum'
          );
        END IF;
        canonical_definition := jsonb_build_object(
          'canonicalName', input->'definition'->>'canonicalName',
          'unit', input->'definition'->>'unit',
          'accountingBehavior', input->'definition'->>'accountingBehavior'
        );
        body := jsonb_build_object('definition', canonical_definition);
        target_kind := 'resource_type';
        target_id := command_id;
      WHEN 'createBudget' THEN
        IF NOT (input ? 'resources')
          OR input - ARRAY['commandId', 'resources']::text[] <> '{}'::jsonb THEN
          PERFORM keynes_internal.invalid_command(operation_name, '$', 'properties');
        END IF;
        items := keynes_internal.canonical_envelope(
          operation_name, input->'resources', '$.resources', false
        );
        body := jsonb_build_object('resources', items);
        target_kind := 'budget';
        target_id := command_id;
      WHEN 'requestBudget' THEN
        IF NOT (input ? 'parentBudgetId') OR NOT (input ? 'resources')
          OR input - ARRAY['commandId', 'parentBudgetId', 'resources']::text[] <> '{}'::jsonb
          OR jsonb_typeof(input->'parentBudgetId') <> 'string'
          OR input->>'parentBudgetId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
          PERFORM keynes_internal.invalid_command(operation_name, '$', 'properties');
        END IF;
        parent_id := (input->>'parentBudgetId')::uuid;
        items := keynes_internal.canonical_envelope(
          operation_name, input->'resources', '$.resources', false
        );
        body := jsonb_build_object('parentBudgetId', parent_id::text, 'resources', items);
        target_kind := 'budget';
        target_id := command_id;
      WHEN 'settleBudget' THEN
        IF NOT (input ? 'budgetId') OR NOT (input ? 'usage')
          OR input - ARRAY['commandId', 'budgetId', 'usage']::text[] <> '{}'::jsonb
          OR jsonb_typeof(input->'budgetId') <> 'string'
          OR input->>'budgetId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
          PERFORM keynes_internal.invalid_command(operation_name, '$', 'properties');
        END IF;
        target_id := (input->>'budgetId')::uuid;
        items := keynes_internal.canonical_envelope(
          operation_name, input->'usage', '$.usage', true
        );
        body := jsonb_build_object('budgetId', target_id::text, 'usage', items);
        target_kind := 'budget';
    END CASE;
    IF coalesce(current_setting('keynes.tenant_id', true), '')
        !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR coalesce(current_setting('keynes.principal_id', true), '')
        !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      PERFORM keynes_internal.raise_domain_error(
        'unauthorized', jsonb_build_object(
          'operation', operation_name, 'requiredPermission', permission_name
        )
      );
    END IF;
    tenant := current_setting('keynes.tenant_id')::uuid;
    principal := current_setting('keynes.principal_id')::uuid;
    IF NOT EXISTS (
      SELECT 1 FROM keynes_internal.principal_permissions
      WHERE tenant_id = tenant AND principal_id = principal AND permission = permission_name
    ) THEN
      PERFORM keynes_internal.raise_domain_error(
        'unauthorized', jsonb_build_object(
          'operation', operation_name, 'requiredPermission', permission_name
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
      tenant, command_id, operation_name, target_kind, target_id,
      body, body_digest_value, principal
    ) ON CONFLICT ON CONSTRAINT commands_pkey DO NOTHING;
    IF NOT FOUND THEN
      SELECT * INTO prior FROM keynes_internal.commands AS stored
      WHERE stored.tenant_id = tenant
        AND stored.command_id = apply_command.command_id FOR UPDATE;
      IF prior.operation <> operation_name OR prior.target_kind <> target_kind
        OR prior.target_id <> target_id OR prior.canonical_body <> body
        OR prior.body_digest <> body_digest_value THEN
        PERFORM keynes_internal.raise_domain_error(
          'command_conflict', jsonb_build_object(
            'commandId', command_id::text, 'existingOperation', prior.operation,
            'attemptedOperation', operation_name
          )
        );
      END IF;
      RETURN jsonb_build_object('ok', true, 'result', prior.result, 'replayed', true);
    END IF;
    PERFORM keynes_internal.checkpoint('after_command_binding');

    IF operation_name = 'defineResource' THEN
      definition_digest_value := 'resource-definition:' || encode(
        sha256(convert_to(canonical_definition::text, 'UTF8')), 'hex'
      );
      SELECT * INTO stored_resource
      FROM keynes_internal.resource_types AS resource_type
      WHERE resource_type.tenant_id = tenant
        AND resource_type.canonical_name = canonical_definition->>'canonicalName'
      FOR UPDATE;
      IF FOUND THEN
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
      ELSE
        INSERT INTO keynes_internal.resource_types (
          tenant_id, resource_type_id, canonical_name, unit,
          accounting_behavior, definition, definition_digest,
          definer_principal_id
        ) VALUES (
          tenant, command_id, canonical_definition->>'canonicalName',
          canonical_definition->>'unit',
          canonical_definition->>'accountingBehavior', canonical_definition,
          definition_digest_value, principal
        )
        RETURNING * INTO stored_resource;
      END IF;
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
          'commandId', stored_resource.resource_type_id::text,
          'principalId', stored_resource.definer_principal_id::text,
          'definitionDigest', stored_resource.definition_digest
        )
      );
    ELSIF operation_name = 'createBudget' THEN
      FOR item IN SELECT element FROM jsonb_array_elements(items) AS element LOOP
        IF NOT EXISTS (
          SELECT 1 FROM keynes_internal.resource_types
          WHERE tenant_id = tenant AND resource_type_id = (item->>'resourceTypeId')::uuid
        ) THEN
          PERFORM keynes_internal.raise_domain_error(
            'resource_type_not_found', jsonb_build_object('resourceTypeId', item->>'resourceTypeId')
          );
        END IF;
      END LOOP;
      INSERT INTO keynes_internal.budgets (
        tenant_id, budget_id, parent_budget_id, root_budget_id,
        depth, lifecycle
      ) VALUES (tenant, command_id, NULL, command_id, 0, 'active');
      FOR item IN SELECT element FROM jsonb_array_elements(items) AS element LOOP
        INSERT INTO keynes_internal.budget_resources (
          tenant_id, budget_id, resource_type_id, allocated_amount
        ) VALUES (tenant, command_id, (item->>'resourceTypeId')::uuid, (item->>'amount')::bigint);
      END LOOP;
      INSERT INTO keynes_internal.budget_history_streams (tenant_id, stream_id)
      VALUES (tenant, command_id);
      PERFORM keynes_internal.checkpoint('after_domain_mutation');
      PERFORM keynes_internal.append_history(
        tenant, command_id, command_id, 'budget_created', command_id,
        jsonb_build_object('rootBudgetId', command_id::text, 'resources', items)
      );
      PERFORM keynes_internal.checkpoint('after_history_insertion');
      result := jsonb_build_object(
        'kind', 'created', 'budget', keynes_internal.budget_projection(tenant, command_id)
      );
    ELSIF operation_name = 'requestBudget' THEN
      SELECT * INTO budget FROM keynes_internal.budgets
      WHERE tenant_id = tenant AND budget_id = parent_id FOR UPDATE;
      IF NOT FOUND THEN
        PERFORM keynes_internal.raise_domain_error(
          'budget_not_found', jsonb_build_object('budgetId', parent_id::text)
        );
      END IF;
      IF budget.lifecycle <> 'active' THEN
        PERFORM keynes_internal.raise_domain_error(
          'budget_not_active', jsonb_build_object(
            'budgetId', parent_id::text, 'lifecycle', budget.lifecycle
          )
        );
      END IF;
      PERFORM 1 FROM keynes_internal.budget_resources AS locked
      WHERE locked.tenant_id = tenant
        AND locked.budget_id = parent_id
        AND locked.resource_type_id IN (
          SELECT (requested->>'resourceTypeId')::uuid
          FROM jsonb_array_elements(items) AS requested
      )
      ORDER BY locked.resource_type_id FOR UPDATE;
      FOR item IN SELECT element FROM jsonb_array_elements(items) AS element LOOP
        IF NOT EXISTS (
          SELECT 1 FROM keynes_internal.resource_types
          WHERE tenant_id = tenant AND resource_type_id = (item->>'resourceTypeId')::uuid
        ) THEN
          PERFORM keynes_internal.raise_domain_error(
            'resource_type_not_found', jsonb_build_object('resourceTypeId', item->>'resourceTypeId')
          );
        END IF;
      END LOOP;
      IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(items) AS requested
        WHERE NOT EXISTS (
          SELECT 1
          FROM keynes_internal.budget_resources AS parent_resource
          WHERE parent_resource.tenant_id = tenant
            AND parent_resource.budget_id = parent_id
            AND parent_resource.resource_type_id =
              (requested->>'resourceTypeId')::uuid
        )
      ) THEN
        PERFORM keynes_internal.invalid_command(
          operation_name, '$.resources', 'allocatedResourceTypes'
        );
      END IF;
      denial_reasons := '[]'::jsonb;
      FOR item IN SELECT element FROM jsonb_array_elements(items) AS element LOOP
        SELECT coalesce((SELECT (resource->>'available')::numeric
          FROM jsonb_array_elements(
            keynes_internal.budget_projection(tenant, parent_id)->'resources'
          ) AS resource
          WHERE resource->'resourceType'->>'resourceTypeId' = item->>'resourceTypeId'), 0)
        INTO available_amount;
        IF available_amount < (item->>'amount')::numeric THEN
          denial_reasons := denial_reasons || jsonb_build_array(jsonb_build_object(
            'code', 'insufficient_available',
            'resourceTypeId', item->>'resourceTypeId',
            'requested', (item->>'amount')::numeric,
            'available', available_amount
          ));
        END IF;
      END LOOP;
      IF jsonb_array_length(denial_reasons) > 0 THEN
        PERFORM keynes_internal.checkpoint('after_domain_mutation');
        PERFORM keynes_internal.append_history(
          tenant, budget.root_budget_id, command_id, 'request_denied', parent_id,
          jsonb_build_object('parentBudgetId', parent_id::text, 'reasons', denial_reasons)
        );
        PERFORM keynes_internal.checkpoint('after_history_insertion');
        result := jsonb_build_object(
          'kind', 'denied', 'commandId', command_id::text,
          'parentBudgetId', parent_id::text, 'reasons', denial_reasons
        );
      ELSE
        INSERT INTO keynes_internal.budgets (
          tenant_id, budget_id, parent_budget_id, root_budget_id,
          depth, lifecycle
        ) VALUES (
          tenant, command_id, parent_id, budget.root_budget_id,
          budget.depth + 1, 'active'
        );
        FOR item IN SELECT element FROM jsonb_array_elements(items) AS element LOOP
          INSERT INTO keynes_internal.budget_resources (
            tenant_id, budget_id, resource_type_id, allocated_amount
          ) VALUES (tenant, command_id, (item->>'resourceTypeId')::uuid, (item->>'amount')::bigint);
        END LOOP;
        PERFORM keynes_internal.checkpoint('after_domain_mutation');
        PERFORM keynes_internal.append_history(
          tenant, budget.root_budget_id, command_id, 'request_approved', command_id,
          jsonb_build_object(
            'parentBudgetId', parent_id::text, 'childBudgetId', command_id::text,
            'resources', items
          )
        );
        PERFORM keynes_internal.checkpoint('after_history_insertion');
        result := jsonb_build_object(
          'kind', 'approved', 'commandId', command_id::text,
          'parentBudgetId', parent_id::text, 'childBudgetId', command_id::text,
          'resources', items
        );
      END IF;
    ELSE
      SELECT * INTO budget FROM keynes_internal.budgets
      WHERE tenant_id = tenant AND budget_id = target_id FOR UPDATE;
      IF NOT FOUND THEN
        PERFORM keynes_internal.raise_domain_error(
          'budget_not_found', jsonb_build_object('budgetId', target_id::text)
        );
      END IF;
      IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(items) AS usage
        WHERE NOT EXISTS (
          SELECT 1 FROM keynes_internal.budget_resources AS fact
          WHERE fact.tenant_id = tenant AND fact.budget_id = target_id
            AND fact.resource_type_id = (usage->>'resourceTypeId')::uuid
        )
      ) THEN
        PERFORM keynes_internal.invalid_command(operation_name, '$.usage', 'allocatedResourceTypes');
      END IF;
      PERFORM 1 FROM keynes_internal.budget_resources AS locked
      WHERE locked.tenant_id = tenant AND locked.budget_id = target_id
      ORDER BY locked.resource_type_id FOR UPDATE;
      FOR item IN SELECT element FROM jsonb_array_elements(items) AS element LOOP
        SELECT fact.direct_usage_amount INTO existing_usage
        FROM keynes_internal.budget_resources AS fact
        WHERE fact.tenant_id = tenant AND fact.budget_id = target_id
          AND fact.resource_type_id = (item->>'resourceTypeId')::uuid;
        IF item->'amount' = 'null'::jsonb THEN
          IF existing_usage IS NOT NULL THEN
            PERFORM keynes_internal.invalid_command(
              operation_name, '$.usage[].amount', 'monotone'
            );
          END IF;
        ELSIF existing_usage IS NULL THEN
          UPDATE keynes_internal.budget_resources
          SET direct_usage_amount = (item->>'amount')::bigint, usage_command_id = command_id
          WHERE tenant_id = tenant AND budget_id = target_id
            AND resource_type_id = (item->>'resourceTypeId')::uuid;
          newly_known := newly_known || jsonb_build_array(item);
        ELSIF existing_usage <> (item->>'amount')::bigint THEN
          PERFORM keynes_internal.raise_domain_error(
            'usage_conflict',
            jsonb_build_object(
              'budgetId', target_id::text,
              'resourceTypeId', item->>'resourceTypeId',
              'existing', existing_usage,
              'attempted', (item->>'amount')::numeric
            )
          );
        END IF;
      END LOOP;
      UPDATE keynes_internal.budgets SET lifecycle = 'settling'
      WHERE tenant_id = tenant AND budget_id = target_id AND lifecycle = 'active';
      PERFORM keynes_internal.assert_safe_accounting(tenant, target_id, operation_name);
      PERFORM keynes_internal.checkpoint('after_domain_mutation');
      SELECT coalesce(jsonb_agg(resource_type_id::text ORDER BY resource_type_id), '[]'::jsonb)
      INTO unresolved FROM keynes_internal.budget_resources
      WHERE tenant_id = tenant AND budget_id = target_id AND direct_usage_amount IS NULL;
      projection := keynes_internal.budget_projection(tenant, target_id);
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'resourceTypeId', resource->'resourceType'->>'resourceTypeId',
        'amount', (resource->>'deficit')::numeric
      ) ORDER BY resource->'resourceType'->>'resourceTypeId'), '[]'::jsonb) INTO deficits
      FROM jsonb_array_elements(projection->'resources') AS resource
      WHERE (resource->>'deficit')::numeric > 0;
      PERFORM keynes_internal.append_history(
        tenant, budget.root_budget_id, command_id, 'budget_settlement_recorded', target_id,
        jsonb_build_object(
          'budgetId', target_id::text, 'newlyKnown', newly_known,
          'unresolvedResourceTypeIds', unresolved,
          'lifecycle', projection->>'lifecycle', 'isolatedDeficits', deficits
        )
      );
      PERFORM keynes_internal.checkpoint('after_history_insertion');
      result := jsonb_build_object(
        'kind', projection->>'lifecycle', 'budget', projection,
        'newlyKnown', newly_known, 'unresolvedResourceTypeIds', unresolved
      );
    END IF;
    UPDATE keynes_internal.commands AS stored
    SET result = apply_command.result, committed_at = clock_timestamp()
    WHERE stored.tenant_id = tenant
      AND stored.command_id = apply_command.command_id;
    PERFORM keynes_internal.checkpoint('after_result_storage');
    RETURN jsonb_build_object('ok', true, 'result', result, 'replayed', false);
  EXCEPTION WHEN SQLSTATE 'K0001' THEN
    GET STACKED DIAGNOSTICS domain_error_message = MESSAGE_TEXT;
    RETURN jsonb_build_object('ok', false, 'error', domain_error_message::jsonb);
  END;
END;
$_$;




CREATE FUNCTION keynes_internal.apply_create_budget_v0008(input jsonb) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $_$
<<apply_create_budget_v0008>>
DECLARE
  operation_name constant text := 'createBudget';
  tenant uuid;
  principal uuid;
  command_id uuid;
  body jsonb;
  body_digest_value text;
  prior keynes_internal.commands%ROWTYPE;
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
    IF input - ARRAY['commandId', 'definitions', 'amounts']::text[] <> '{}'::jsonb THEN
      PERFORM keynes_internal.invalid_command(operation_name, '$', 'additionalProperties');
    END IF;
    IF jsonb_typeof(input->'commandId') IS DISTINCT FROM 'string'
      OR input->>'commandId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      PERFORM keynes_internal.invalid_command(operation_name, '$.commandId', 'format');
    END IF;
    command_id := (input->>'commandId')::uuid;
    body := keynes_internal.canonical_creation_v0008(input->'definitions', input->'amounts');
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

    INSERT INTO keynes_internal.budgets (
      tenant_id, budget_id, parent_budget_id, root_budget_id, depth, lifecycle
    ) VALUES (
      tenant, command_id, NULL, command_id, 0, 'active'
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
$_$;


CREATE FUNCTION keynes_internal.apply_define_resource_v0008(input jsonb) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $_$
<<apply_define_resource_v0008>>
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
    canonical_definition := keynes_internal.canonical_resource_definition_v0008(
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
        AND stored.command_id = apply_define_resource_v0008.command_id
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

    stored_resource := keynes_internal.resolve_resource_v0008(
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
    SET result = apply_define_resource_v0008.result,
        committed_at = clock_timestamp()
    WHERE stored.tenant_id = tenant
      AND stored.command_id = apply_define_resource_v0008.command_id;
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
$_$;

CREATE FUNCTION keynes_internal.apply_define_resources_v0008(input jsonb) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $_$
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
    definitions := keynes_internal.canonical_definitions_v0008(operation_name, input->'definitions');
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
      stored_resource := keynes_internal.resolve_resource_v0008(
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
$_$;

CREATE FUNCTION keynes_internal.assert_safe_accounting(selected_tenant uuid, changed_budget uuid, operation_name text) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  resource_id uuid;
  observed numeric;
BEGIN
  FOR resource_id, observed IN
    WITH RECURSIVE ancestry AS (
      SELECT budget_id, parent_budget_id FROM keynes_internal.budgets
      WHERE tenant_id = selected_tenant AND budget_id = changed_budget
      UNION ALL
      SELECT parent.budget_id, parent.parent_budget_id
      FROM keynes_internal.budgets AS parent
      JOIN ancestry AS child ON parent.budget_id = child.parent_budget_id
      WHERE parent.tenant_id = selected_tenant
    )
    SELECT fact.resource_type_id,
      keynes_internal.subtree_observed(
        selected_tenant, ancestry.budget_id, fact.resource_type_id
      )
    FROM ancestry
    JOIN keynes_internal.budget_resources AS fact
      ON fact.tenant_id = selected_tenant AND fact.budget_id = ancestry.budget_id
    ORDER BY ancestry.budget_id, fact.resource_type_id
  LOOP
    IF observed > 9007199254740991 THEN
      PERFORM keynes_internal.raise_domain_error(
        'arithmetic_error',
        jsonb_build_object(
          'operation', operation_name,
          'resourceTypeId', resource_id::text
        )
      );
    END IF;
  END LOOP;
END;
$$;

CREATE FUNCTION keynes_internal.audit_remote_role_v0006(login_role name, entry_limit integer) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
DECLARE events jsonb;
BEGIN
  IF entry_limit IS NULL OR entry_limit < 1 OR entry_limit > 100 THEN
    RAISE EXCEPTION 'remote credential audit limit is out of range';
  END IF;
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'action', audit.action,
        'occurredAt', audit.occurred_at
      ) ORDER BY audit.occurred_at DESC, audit.audit_id DESC
    ),
    '[]'::jsonb
  ) INTO events
  FROM (
    SELECT record.audit_id, record.action, record.occurred_at
      FROM keynes_internal.remote_credential_audit record
     WHERE record.role_name = login_role
     ORDER BY record.occurred_at DESC, record.audit_id DESC
     LIMIT entry_limit
  ) audit;
  RETURN jsonb_build_object('roleName', login_role, 'events', events);
END;
$$;

CREATE FUNCTION keynes_internal.budget_charge(selected_tenant uuid, selected_budget uuid, selected_resource uuid) RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  budget_fact record;
  child_fact record;
  committed numeric := 0;
BEGIN
  SELECT holding.direct_usage_amount, resource.accounting_behavior
  INTO budget_fact
  FROM keynes_internal.budget_resources AS holding
  JOIN keynes_internal.resource_types AS resource
    USING (tenant_id, resource_type_id)
  WHERE holding.tenant_id = selected_tenant
    AND holding.budget_id = selected_budget
    AND holding.resource_type_id = selected_resource;

  FOR child_fact IN
    SELECT child.budget_id, holding.allocated_amount
    FROM keynes_internal.budgets AS child
    JOIN keynes_internal.budget_resources AS holding
      ON holding.tenant_id = child.tenant_id
      AND holding.budget_id = child.budget_id
    WHERE child.tenant_id = selected_tenant
      AND child.parent_budget_id = selected_budget
      AND holding.resource_type_id = selected_resource
  LOOP
    IF keynes_internal.budget_is_settled(selected_tenant, child_fact.budget_id) THEN
      IF budget_fact.accounting_behavior = 'consumable' THEN
        committed := committed + least(
          child_fact.allocated_amount,
          keynes_internal.budget_charge(
            selected_tenant, child_fact.budget_id, selected_resource
          )
        );
      END IF;
    ELSE
      committed := committed + child_fact.allocated_amount;
    END IF;
  END LOOP;

  IF budget_fact.accounting_behavior = 'consumable' THEN
    RETURN coalesce(budget_fact.direct_usage_amount, 0) + committed;
  END IF;
  RETURN committed;
END;
$$;

CREATE FUNCTION keynes_internal.budget_is_settled(selected_tenant uuid, selected_budget uuid) RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT budget.lifecycle = 'settling'
    AND NOT EXISTS (
      SELECT 1 FROM keynes_internal.budget_resources AS fact
      WHERE fact.tenant_id = selected_tenant
        AND fact.budget_id = selected_budget
        AND fact.direct_usage_amount IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM keynes_internal.budgets AS child
      WHERE child.tenant_id = selected_tenant
        AND child.parent_budget_id = selected_budget
        AND NOT keynes_internal.budget_is_settled(selected_tenant, child.budget_id)
    )
  FROM keynes_internal.budgets AS budget
  WHERE budget.tenant_id = selected_tenant AND budget.budget_id = selected_budget;
$$;

CREATE FUNCTION keynes_internal.budget_projection(selected_tenant uuid, selected_budget uuid) RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  budget_row keynes_internal.budgets%ROWTYPE;
  fact record;
  settled boolean;
  committed bigint;
  observed numeric;
  unresolved boolean;
  charge numeric;
  resources jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO budget_row FROM keynes_internal.budgets
  WHERE tenant_id = selected_tenant AND budget_id = selected_budget;
  IF NOT FOUND THEN RETURN NULL; END IF;
  settled := keynes_internal.budget_is_settled(selected_tenant, selected_budget);
  FOR fact IN
    SELECT holding.*, resource.canonical_name, resource.unit,
      resource.accounting_behavior, resource.definition_digest
    FROM keynes_internal.budget_resources AS holding
    JOIN keynes_internal.resource_types AS resource USING (tenant_id, resource_type_id)
    WHERE holding.tenant_id = selected_tenant AND holding.budget_id = selected_budget
    ORDER BY resource.canonical_name COLLATE "C", holding.resource_type_id
  LOOP
    SELECT coalesce(sum(CASE
      WHEN keynes_internal.budget_is_settled(selected_tenant, child.budget_id)
        AND fact.accounting_behavior = 'reusable' THEN 0
      WHEN keynes_internal.budget_is_settled(selected_tenant, child.budget_id)
        THEN least(
          child_fact.allocated_amount,
          keynes_internal.budget_charge(
            selected_tenant, child.budget_id, fact.resource_type_id
          )
        )
      ELSE child_fact.allocated_amount
    END), 0)
    INTO committed
    FROM keynes_internal.budgets AS child
    JOIN keynes_internal.budget_resources AS child_fact
      ON child_fact.tenant_id = child.tenant_id AND child_fact.budget_id = child.budget_id
    WHERE child.tenant_id = selected_tenant
      AND child.parent_budget_id = selected_budget
      AND child_fact.resource_type_id = fact.resource_type_id;
    observed := keynes_internal.subtree_observed(
      selected_tenant, selected_budget, fact.resource_type_id
    );
    WITH RECURSIVE subtree AS (
      SELECT budget_id, lifecycle FROM keynes_internal.budgets
      WHERE tenant_id = selected_tenant AND budget_id = selected_budget
      UNION ALL
      SELECT child.budget_id, child.lifecycle
      FROM keynes_internal.budgets AS child
      JOIN subtree AS parent ON child.parent_budget_id = parent.budget_id
      WHERE child.tenant_id = selected_tenant
    )
    SELECT EXISTS (
      SELECT 1 FROM subtree
      JOIN keynes_internal.budget_resources AS descendant_fact
        ON descendant_fact.tenant_id = selected_tenant
        AND descendant_fact.budget_id = subtree.budget_id
        AND descendant_fact.resource_type_id = fact.resource_type_id
      WHERE subtree.lifecycle = 'active' OR descendant_fact.direct_usage_amount IS NULL
    ) INTO unresolved;
    charge := CASE fact.accounting_behavior
      WHEN 'consumable' THEN coalesce(fact.direct_usage_amount, 0) + committed
      ELSE committed
    END;
    resources := resources || jsonb_build_array(jsonb_build_object(
      'resourceType', jsonb_build_object(
        'resourceTypeId', fact.resource_type_id::text,
        'canonicalName', fact.canonical_name,
        'unit', fact.unit,
        'accountingBehavior', fact.accounting_behavior,
        'definitionDigest', fact.definition_digest
      ),
      'allocated', fact.allocated_amount,
      'available', greatest(fact.allocated_amount - least(fact.allocated_amount, charge), 0),
      'committed', committed,
      'directUsage', fact.direct_usage_amount,
      'subtreeObservedUsage', observed,
      'unresolved', unresolved,
      'deficit', greatest(charge - fact.allocated_amount, 0)
    ));
  END LOOP;
  RETURN jsonb_build_object(
    'budgetId', budget_row.budget_id::text,
    'parentBudgetId', budget_row.parent_budget_id::text,
    'rootBudgetId', budget_row.root_budget_id::text,
    'depth', budget_row.depth,
    'lifecycle', CASE WHEN settled THEN 'settled' ELSE budget_row.lifecycle END,
    'resources', resources
  );
END;
$$;


CREATE FUNCTION keynes_internal.canonical_creation_v0008(definitions_value jsonb, amounts_value jsonb) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $_$
DECLARE
  definitions jsonb;
  item record;
  amount_value numeric;
  amounts jsonb := '{}'::jsonb;
BEGIN
  definitions := keynes_internal.canonical_definitions_v0008('createBudget', definitions_value);
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
$_$;

CREATE FUNCTION keynes_internal.canonical_resource_definition_v0008(operation_name text, value jsonb, issue_path text) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $_$
BEGIN
  IF jsonb_typeof(value) IS DISTINCT FROM 'object' THEN
    PERFORM keynes_internal.invalid_command(operation_name, issue_path, 'type');
  END IF;
  IF NOT (value ? 'canonicalName') OR NOT (value ? 'unit')
    OR NOT (value ? 'accountingBehavior') THEN
    PERFORM keynes_internal.invalid_command(operation_name, issue_path, 'required');
  END IF;
  IF value - ARRAY['canonicalName', 'unit', 'accountingBehavior']::text[]
    <> '{}'::jsonb THEN
    PERFORM keynes_internal.invalid_command(
      operation_name, issue_path, 'additionalProperties'
    );
  END IF;
  IF jsonb_typeof(value->'canonicalName') IS DISTINCT FROM 'string'
    OR value->>'canonicalName' !~ '^[a-z][a-z0-9_]{0,62}$' THEN
    PERFORM keynes_internal.invalid_command(
      operation_name, issue_path || '.canonicalName', 'pattern'
    );
  END IF;
  IF jsonb_typeof(value->'unit') IS DISTINCT FROM 'string'
    OR char_length(value->>'unit') NOT BETWEEN 1 AND 64
    OR value->>'unit' <> btrim(value->>'unit')
    OR value->>'unit' ~ '[[:cntrl:]]' THEN
    PERFORM keynes_internal.invalid_command(
      operation_name, issue_path || '.unit', 'format'
    );
  END IF;
  IF jsonb_typeof(value->'accountingBehavior') IS DISTINCT FROM 'string'
    OR value->>'accountingBehavior' NOT IN ('consumable', 'reusable') THEN
    PERFORM keynes_internal.invalid_command(
      operation_name, issue_path || '.accountingBehavior', 'enum'
    );
  END IF;
  RETURN jsonb_build_object(
    'canonicalName', value->>'canonicalName',
    'unit', value->>'unit',
    'accountingBehavior', value->>'accountingBehavior'
  );
END;
$_$;

CREATE FUNCTION keynes_internal.canonical_definitions_v0008(operation_name text, value jsonb) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $_$
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
    definition := keynes_internal.canonical_resource_definition_v0008(
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
$_$;

CREATE FUNCTION keynes_internal.canonical_envelope(operation_name text, value jsonb, issue_path text, allow_null boolean) RETURNS jsonb
LANGUAGE plpgsql
AS $_$
DECLARE
  item jsonb;
  resource_id text;
  amount numeric;
  normalized jsonb := '[]'::jsonb;
BEGIN
  IF jsonb_typeof(value) <> 'array' OR jsonb_array_length(value) = 0 THEN
    PERFORM keynes_internal.invalid_command(operation_name, issue_path, 'minItems');
  END IF;
  FOR item IN SELECT element FROM jsonb_array_elements(value) AS element LOOP
    IF jsonb_typeof(item) <> 'object'
      OR NOT (item ? 'resourceTypeId') OR NOT (item ? 'amount')
      OR item - ARRAY['resourceTypeId', 'amount']::text[] <> '{}'::jsonb THEN
      PERFORM keynes_internal.invalid_command(operation_name, issue_path, 'items');
    END IF;
    IF jsonb_typeof(item->'resourceTypeId') <> 'string'
      OR item->>'resourceTypeId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      PERFORM keynes_internal.invalid_command(
        operation_name, issue_path || '[].resourceTypeId', 'format'
      );
    END IF;
    resource_id := item->>'resourceTypeId';
    IF item->'amount' = 'null'::jsonb AND allow_null THEN
      normalized := normalized || jsonb_build_array(
        jsonb_build_object('resourceTypeId', resource_id, 'amount', NULL)
      );
    ELSE
      IF jsonb_typeof(item->'amount') <> 'number' THEN
        PERFORM keynes_internal.invalid_command(
          operation_name, issue_path || '[].amount', 'type'
        );
      END IF;
      amount := (item->>'amount')::numeric;
      IF amount <> trunc(amount) OR amount < 0 OR amount > 9007199254740991 THEN
        PERFORM keynes_internal.invalid_command(
          operation_name, issue_path || '[].amount', 'range'
        );
      END IF;
      normalized := normalized || jsonb_build_array(
        jsonb_build_object('resourceTypeId', resource_id, 'amount', amount)
      );
    END IF;
  END LOOP;
  IF jsonb_array_length(normalized) <> (
    SELECT count(DISTINCT element->>'resourceTypeId')
    FROM jsonb_array_elements(normalized) AS element
  ) THEN
    PERFORM keynes_internal.invalid_command(operation_name, issue_path, 'uniqueItems');
  END IF;
  RETURN (
    SELECT jsonb_agg(element ORDER BY element->>'resourceTypeId')
    FROM jsonb_array_elements(normalized) AS element
  );
END;
$_$;








CREATE FUNCTION keynes_internal.checkpoint(checkpoint_name text) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('keynes.test_checkpoint', true) = checkpoint_name THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = format('private rollback checkpoint: %s', checkpoint_name);
  END IF;
END;
$$;


CREATE FUNCTION keynes_internal.event_uuid(seed text) RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (
    substr(hash, 1, 8) || '-' || substr(hash, 9, 4) || '-' ||
    substr(hash, 13, 4) || '-' || substr(hash, 17, 4) || '-' ||
    substr(hash, 21, 12)
  )::uuid
  FROM (SELECT encode(sha256(convert_to(seed, 'UTF8')), 'hex') AS hash) AS value;
$$;

CREATE FUNCTION keynes_internal.get_budget(input jsonb) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $_$
<<get_budget>>
DECLARE
  tenant uuid;
  principal uuid;
  budget_id uuid;
  root_id uuid;
BEGIN
  IF input IS NULL OR jsonb_typeof(input) <> 'object' OR NOT (input ? 'budgetId')
    OR input - 'budgetId'::text <> '{}'::jsonb
    OR jsonb_typeof(input->'budgetId') <> 'string'
    OR input->>'budgetId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    PERFORM keynes_internal.invalid_command('getBudget', '$', 'properties');
  END IF;
  IF coalesce(current_setting('keynes.tenant_id', true), '')
      !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR coalesce(current_setting('keynes.principal_id', true), '')
      !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    PERFORM keynes_internal.raise_domain_error(
      'unauthorized', jsonb_build_object(
        'operation', 'getBudget', 'requiredPermission', 'read_budget'
      )
    );
  END IF;
  tenant := current_setting('keynes.tenant_id')::uuid;
  principal := current_setting('keynes.principal_id')::uuid;
  IF NOT EXISTS (
    SELECT 1 FROM keynes_internal.principal_permissions
    WHERE tenant_id = tenant AND principal_id = principal AND permission = 'read_budget'
  ) THEN
    PERFORM keynes_internal.raise_domain_error(
      'unauthorized', jsonb_build_object(
        'operation', 'getBudget', 'requiredPermission', 'read_budget'
      )
    );
  END IF;
  budget_id := (input->>'budgetId')::uuid;
  SELECT stored.root_budget_id INTO root_id FROM keynes_internal.budgets AS stored
  WHERE stored.tenant_id = tenant AND stored.budget_id = get_budget.budget_id;
  IF NOT FOUND THEN
    PERFORM keynes_internal.raise_domain_error(
      'budget_not_found', jsonb_build_object('budgetId', budget_id::text)
    );
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'result', jsonb_build_object(
      'budget', keynes_internal.budget_projection(tenant, budget_id),
      'history', jsonb_build_object(
        'rootBudgetId', root_id::text,
        'entries', (SELECT coalesce(jsonb_agg(entry.payload ORDER BY entry.sequence), '[]'::jsonb)
          FROM keynes_internal.budget_history_entries AS entry
          WHERE entry.tenant_id = tenant AND entry.stream_id = root_id)
      )
    ),
    'replayed', false
  );
END;
$_$;

CREATE FUNCTION keynes_internal.inspect_remote_role_v0006(login_role name) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
  SELECT jsonb_build_object(
    'roleName', mapping.role_name,
    'tenantId', mapping.tenant_id,
    'principalId', mapping.principal_id,
    'status', mapping.status,
    'enabled', mapping.enabled,
    'createdAt', mapping.created_at,
    'updatedAt', mapping.updated_at
  ) FROM keynes_internal.remote_role_mappings mapping
  WHERE mapping.role_name = login_role;
$$;

CREATE FUNCTION keynes_internal.invalid_command(operation_name text, issue_path text, issue_rule text) RETURNS void
LANGUAGE sql
AS $$
  SELECT keynes_internal.raise_domain_error(
    'invalid_command',
    jsonb_build_object(
      'operation', operation_name,
      'issues', jsonb_build_array(
        jsonb_build_object('path', issue_path, 'rule', issue_rule)
      )
    )
  );
$$;








CREATE FUNCTION keynes_internal.raise_domain_error(error_code text, error_details jsonb) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = 'K0001',
    MESSAGE = jsonb_build_object(
      'kind', 'error',
      'code', error_code,
      'details', error_details
    )::text;
END;
$$;

CREATE FUNCTION keynes_internal.register_remote_role_v0006(login_role name, mapped_tenant uuid, mapped_principal uuid) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
DECLARE
  current_oid oid;
  existing_name keynes_internal.remote_role_mappings%ROWTYPE;
  existing_oid keynes_internal.remote_role_mappings%ROWTYPE;
BEGIN
  current_oid := keynes_internal.remote_login_oid_v0006(login_role);
  LOCK TABLE keynes_internal.remote_role_mappings
    IN SHARE ROW EXCLUSIVE MODE;
  SELECT * INTO existing_name
    FROM keynes_internal.remote_role_mappings
   WHERE role_name = login_role;
  SELECT * INTO existing_oid
    FROM keynes_internal.remote_role_mappings
   WHERE role_oid = current_oid;

  IF existing_name.status = 'revoked' THEN
    RAISE EXCEPTION 'remote login role is revoked';
  ELSIF existing_name.role_oid IS NOT NULL
    AND existing_name.tenant_id = mapped_tenant
    AND existing_name.principal_id = mapped_principal
    AND existing_name.role_oid = current_oid THEN
    UPDATE keynes_internal.remote_role_mappings
       SET status = 'enabled', updated_at = clock_timestamp()
     WHERE role_oid = current_oid;
  ELSIF existing_name.role_oid IS NOT NULL
    AND existing_name.tenant_id = mapped_tenant
    AND existing_name.principal_id = mapped_principal
    AND NOT EXISTS (
      SELECT 1 FROM pg_roles WHERE oid = existing_name.role_oid
    )
    AND existing_oid.role_oid IS NULL THEN
    DELETE FROM keynes_internal.remote_role_mappings
     WHERE role_oid = existing_name.role_oid;
    INSERT INTO keynes_internal.remote_role_mappings (
      role_oid, role_name, tenant_id, principal_id, status
    ) VALUES (
      current_oid, login_role, mapped_tenant, mapped_principal, 'enabled'
    );
  ELSIF existing_name.role_oid IS NOT NULL
    OR existing_oid.role_oid IS NOT NULL THEN
    RAISE EXCEPTION 'remote role mapping target is occupied';
  ELSE
    INSERT INTO keynes_internal.remote_role_mappings (
      role_oid, role_name, tenant_id, principal_id, status
    ) VALUES (
      current_oid, login_role, mapped_tenant, mapped_principal, 'enabled'
    );
  END IF;
  INSERT INTO keynes_internal.remote_credential_audit (
    role_oid, role_name, action, actor
  ) VALUES (current_oid, login_role, 'registered', session_user);
  RETURN jsonb_build_object(
    'roleName', login_role, 'status', 'enabled',
    'tenantId', mapped_tenant, 'principalId', mapped_principal
  );
END;
$$;



CREATE FUNCTION keynes_internal.remote_apply_command_v0008(operation_name text, input jsonb) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $_$
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
$_$;

CREATE FUNCTION keynes_internal.remote_budget_id_v0006(selected_tenant uuid, reference_value text, operation_name text) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $_$
DECLARE selected_budget uuid;
BEGIN
  IF reference_value IS NULL
    OR reference_value !~ '^kbr_v1_[A-Za-z0-9_-]{43}$' THEN
    PERFORM keynes_internal.invalid_command(
      operation_name, '$.budgetReference', 'format'
    );
  END IF;
  SELECT budget_id INTO selected_budget
    FROM keynes_internal.remote_budget_references
   WHERE tenant_id = selected_tenant AND budget_reference = reference_value;
  IF NOT FOUND THEN
    PERFORM keynes_internal.raise_domain_error(
      'unauthorized',
      jsonb_build_object(
        'operation', operation_name,
        'requiredPermission', 'remote_access'
      )
    );
  END IF;
  RETURN selected_budget;
END;
$_$;

CREATE FUNCTION keynes_internal.remote_budget_reference_v0006(selected_tenant uuid, selected_budget uuid) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
DECLARE reference_value text;
BEGIN
  SELECT budget_reference INTO reference_value
    FROM keynes_internal.remote_budget_references
   WHERE tenant_id = selected_tenant AND budget_id = selected_budget;
  IF NOT FOUND THEN
    INSERT INTO keynes_internal.remote_budget_references (
      tenant_id, budget_id, budget_reference
    ) VALUES (
      selected_tenant,
      selected_budget,
      keynes_internal.remote_token_v0006(
        'kbr_v1_', selected_tenant::text || ':' || selected_budget::text
      )
    )
    ON CONFLICT (tenant_id, budget_id) DO NOTHING;
    SELECT budget_reference INTO STRICT reference_value
      FROM keynes_internal.remote_budget_references
     WHERE tenant_id = selected_tenant AND budget_id = selected_budget;
  END IF;
  RETURN reference_value;
END;
$$;


CREATE FUNCTION keynes_internal.remote_create_budget_v0008(input jsonb) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $_$
DECLARE
  validation_response jsonb;
  normalized jsonb;
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
    IF input - ARRAY['operationKey', 'definitions', 'amounts']::text[] <> '{}'::jsonb THEN
      PERFORM keynes_internal.invalid_command('createBudget', '$', 'additionalProperties');
    END IF;
    normalized := keynes_internal.canonical_creation_v0008(input->'definitions', input->'amounts');
    normalized := input || jsonb_build_object('amounts', normalized->'amounts');
    RETURN keynes_internal.remote_apply_command_v0008('createBudget', normalized);
  EXCEPTION WHEN SQLSTATE 'K0001' THEN
    GET STACKED DIAGNOSTICS domain_error_message = MESSAGE_TEXT;
    RETURN jsonb_build_object('ok', false, 'error', keynes_internal.remote_safe_error_v0006('createBudget', domain_error_message::jsonb));
  END;
END;
$_$;

CREATE FUNCTION keynes_internal.remote_define_resources_v0008(input jsonb) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $_$
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
    PERFORM keynes_internal.canonical_definitions_v0008('defineResources', input->'definitions');
    RETURN keynes_internal.remote_apply_command_v0008('defineResources', input);
  EXCEPTION WHEN SQLSTATE 'K0001' THEN
    GET STACKED DIAGNOSTICS domain_error_message = MESSAGE_TEXT;
    RETURN jsonb_build_object('ok', false, 'error',
      keynes_internal.remote_safe_error_v0006('defineResources', domain_error_message::jsonb));
  END;
END;
$_$;

CREATE FUNCTION keynes_internal.remote_dispatch_v0006(operation_name text, input jsonb) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $_$
DECLARE validation_response jsonb;
BEGIN
  BEGIN
    validation_response := keynes_internal.remote_validate_input_v0006(
      operation_name, input
    );
    IF validation_response IS NOT NULL THEN
      RETURN validation_response;
    END IF;
    CASE operation_name
      WHEN 'createBudget' THEN
        RETURN keynes_internal.remote_apply_command_v0008(
          operation_name, input
        );
      WHEN 'requestBudget' THEN
        RETURN keynes_internal.remote_apply_command_v0008(
          operation_name, input
        );
      WHEN 'settleBudget' THEN
        RETURN keynes_internal.remote_apply_command_v0008(
          operation_name, input
        );
      WHEN 'getBudget' THEN
        RETURN keynes_internal.remote_get_budget_v0006(input);
      WHEN 'getBudgetHistoryPage' THEN
        RETURN keynes_internal.remote_get_budget_history_page_v0006(input);
      WHEN 'openBudget' THEN
        RETURN keynes_internal.remote_open_budget_v0006(input);
      WHEN 'recoverOperation' THEN
        RETURN keynes_internal.remote_recover_operation_v0006(input);
      WHEN 'getCompatibility' THEN
        RETURN keynes_internal.remote_get_compatibility_v0008(input);
      ELSE
        RETURN keynes_internal.remote_invalid_v0006(
          operation_name, '$', 'operation'
        );
    END CASE;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'kind', 'error', 'code', 'unknown', 'details', '{}'::jsonb
      )
    );
  END;
END;
$_$;

CREATE FUNCTION keynes_internal.remote_error_v0006(error_code text, operation_name text) RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT jsonb_build_object(
    'ok', false,
    'error', jsonb_build_object(
      'kind', 'error',
      'code', error_code,
      'details', CASE error_code
        WHEN 'unauthorized' THEN jsonb_build_object(
          'operation', operation_name,
          'requiredPermission', 'remote_access'
        )
        ELSE '{}'::jsonb
      END
    )
  );
$$;

CREATE FUNCTION keynes_internal.remote_get_budget_history_page_v0006(input jsonb) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $_$
DECLARE
  tenant uuid;
  selected_budget uuid;
  selected_stream uuid;
  start_sequence bigint := 1;
  terminal_sequence_value bigint;
  next_sequence_value bigint;
  entry_count integer;
  entries jsonb;
  next_cursor text := NULL;
  domain_error_message text;
BEGIN
  PERFORM set_config('keynes.remote_operation', 'getBudgetHistoryPage', true);
  BEGIN
    PERFORM keynes_internal.set_remote_identity_v0006();
    tenant := current_setting('keynes.tenant_id')::uuid;
    selected_budget := keynes_internal.remote_budget_id_v0006(
      tenant, input->>'budgetReference', 'getBudgetHistoryPage'
    );
    SELECT root_budget_id INTO selected_stream
      FROM keynes_internal.budgets
     WHERE tenant_id = tenant AND budget_id = selected_budget;
    IF NOT FOUND THEN
      RETURN keynes_internal.remote_error_v0006(
        'unauthorized', 'getBudgetHistoryPage'
      );
    END IF;

    DELETE FROM keynes_internal.remote_history_cursors cursor_record
     WHERE cursor_record.ctid IN (
       SELECT expired.ctid
         FROM keynes_internal.remote_history_cursors expired
        WHERE expired.expires_at <= clock_timestamp()
        ORDER BY expired.expires_at, expired.cursor_value
        LIMIT 256
     );

    IF input ? 'cursor' THEN
      DELETE FROM keynes_internal.remote_history_cursors cursor_record
       WHERE cursor_record.cursor_value = input->>'cursor'
         AND cursor_record.tenant_id = tenant
         AND cursor_record.stream_id = selected_stream
         AND cursor_record.expires_at > clock_timestamp()
      RETURNING cursor_record.next_sequence,
                cursor_record.terminal_sequence
           INTO start_sequence, terminal_sequence_value;
      IF NOT FOUND THEN
        PERFORM keynes_internal.invalid_command(
          'getBudgetHistoryPage', '$.cursor', 'format'
        );
      END IF;
    ELSE
      SELECT coalesce(max(history.sequence), 0)
        INTO terminal_sequence_value
        FROM keynes_internal.budget_history_entries history
       WHERE history.tenant_id = tenant
         AND history.stream_id = selected_stream;
    END IF;
    SELECT count(*)::integer,
           coalesce(jsonb_agg(
             keynes_internal.remote_project_json_v0006(tenant, page.payload)
             ORDER BY page.sequence
           ) FILTER (WHERE page.ordinal <= 256), '[]'::jsonb)
      INTO entry_count, entries
      FROM (
        SELECT history.sequence, history.payload,
               row_number() OVER (ORDER BY history.sequence) AS ordinal
          FROM keynes_internal.budget_history_entries history
         WHERE history.tenant_id = tenant
           AND history.stream_id = selected_stream
           AND history.sequence >= start_sequence
           AND history.sequence <= terminal_sequence_value
         ORDER BY history.sequence
         LIMIT 257
      ) page;
    IF entry_count > 256 THEN
      SELECT history.sequence INTO STRICT next_sequence_value
        FROM keynes_internal.budget_history_entries history
       WHERE history.tenant_id = tenant
         AND history.stream_id = selected_stream
         AND history.sequence >= start_sequence
         AND history.sequence <= terminal_sequence_value
       ORDER BY history.sequence
       OFFSET 256 LIMIT 1;
      INSERT INTO keynes_internal.remote_history_cursors (
        cursor_value, tenant_id, stream_id, next_sequence, terminal_sequence
      ) VALUES (
        keynes_internal.remote_token_v0006(
          'khc_v1_', tenant::text || ':' || selected_stream::text || ':' ||
            next_sequence_value::text
        ),
        tenant, selected_stream, next_sequence_value, terminal_sequence_value
      )
      ON CONFLICT (
        tenant_id, stream_id, next_sequence, terminal_sequence
      ) DO UPDATE
        SET expires_at = clock_timestamp() + interval '30 minutes'
      RETURNING cursor_value INTO next_cursor;
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'result', jsonb_build_object(
        'budgetReference', input->>'budgetReference',
        'entries', entries,
        'nextCursor', next_cursor
      )
    );
  EXCEPTION WHEN SQLSTATE 'K0001' THEN
    GET STACKED DIAGNOSTICS domain_error_message = MESSAGE_TEXT;
    RETURN jsonb_build_object(
      'ok', false,
      'error', keynes_internal.remote_safe_error_v0006(
        'getBudgetHistoryPage', domain_error_message::jsonb
      )
    );
  END;
END;
$_$;

CREATE FUNCTION keynes_internal.remote_get_budget_v0006(input jsonb) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
DECLARE
  tenant uuid;
  selected_budget uuid;
  projection jsonb;
BEGIN
  PERFORM set_config('keynes.remote_operation', 'getBudget', true);
  BEGIN
    PERFORM keynes_internal.set_remote_identity_v0006();
    tenant := current_setting('keynes.tenant_id')::uuid;
    selected_budget := keynes_internal.remote_budget_id_v0006(
      tenant, input->>'budgetReference', 'getBudget'
    );
    projection := keynes_internal.budget_projection(tenant, selected_budget);
    IF projection IS NULL THEN
      RETURN keynes_internal.remote_error_v0006('unauthorized', 'getBudget');
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'result', jsonb_build_object(
        'budget', keynes_internal.remote_project_json_v0006(tenant, projection)
      )
    );
  EXCEPTION WHEN SQLSTATE 'K0001' THEN
    RETURN keynes_internal.remote_error_v0006('unauthorized', 'getBudget');
  END;
END;
$$;



CREATE FUNCTION keynes_internal.remote_get_compatibility_v0008(input jsonb) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
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
      'remoteProceduresDigest', identity.remote_procedures_digest,
      'semanticGeneration', 4,
      'minimumSdkGeneration', 4,
      'procedures', '[{"name":"defineResources","target":"keynes.remote_define_resources","revision":1},{"name":"validateResources","target":"keynes.remote_validate_resources","revision":1},{"name":"createBudget","target":"keynes.remote_create_budget","revision":4},{"name":"requestBudget","target":"keynes.remote_request","revision":2},{"name":"settleBudget","target":"keynes.remote_settle","revision":1},{"name":"getBudget","target":"keynes.remote_get_budget","revision":2},{"name":"getBudgetHistoryPage","target":"keynes.remote_get_budget_history_page","revision":2},{"name":"openBudget","target":"keynes.remote_open_budget","revision":2},{"name":"recoverOperation","target":"keynes.remote_recover_operation","revision":2},{"name":"getCompatibility","target":"keynes.remote_get_compatibility","revision":2}]'::jsonb
    )
  );
END;
$$;

CREATE FUNCTION keynes_internal.remote_invalid_v0006(operation_name text, issue_path text, issue_rule text) RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT jsonb_build_object(
    'ok', false,
    'error', jsonb_build_object(
      'kind', 'error',
      'code', 'invalid_command',
      'details', jsonb_build_object(
        'operation', operation_name,
        'issues', jsonb_build_array(
          jsonb_build_object('path', issue_path, 'rule', issue_rule)
        )
      )
    )
  );
$$;

CREATE FUNCTION keynes_internal.remote_login_oid_v0006(login_role name) RETURNS oid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
DECLARE
  role_record record;
  identity_record keynes_internal.installation_identity%ROWTYPE;
BEGIN
  SELECT * INTO STRICT identity_record
    FROM keynes_internal.installation_identity WHERE singleton = true;
  SELECT oid, rolcanlogin, rolinherit, rolsuper, rolcreaterole, rolcreatedb,
         rolreplication, rolbypassrls
    INTO role_record
    FROM pg_roles
   WHERE rolname = login_role;
  IF NOT FOUND OR NOT role_record.rolcanlogin OR role_record.rolinherit
    OR role_record.rolsuper OR role_record.rolcreaterole
    OR role_record.rolcreatedb OR role_record.rolreplication
    OR role_record.rolbypassrls
    OR login_role IN (
      identity_record.owner_role,
      identity_record.execution_role,
      identity_record.administration_role
    )
    OR pg_has_role(role_record.oid, identity_record.owner_role, 'MEMBER')
    OR pg_has_role(role_record.oid, identity_record.execution_role, 'MEMBER')
    OR pg_has_role(
      role_record.oid, identity_record.administration_role, 'MEMBER'
    )
    OR has_database_privilege(
      role_record.oid, current_database(), 'CREATE'
    ) THEN
    RAISE EXCEPTION 'remote login role is missing or unsafe';
  END IF;
  RETURN role_record.oid;
END;
$$;

CREATE FUNCTION keynes_internal.remote_named_amounts_v0006(selected_tenant uuid, selected_budget uuid, values_json jsonb, operation_name text, input_field text, allow_empty boolean) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $_$
DECLARE
  item jsonb;
  translated jsonb := '[]'::jsonb;
BEGIN
  IF jsonb_typeof(values_json) IS DISTINCT FROM 'array' THEN
    PERFORM keynes_internal.invalid_command(
      operation_name, '$.' || input_field, 'type'
    );
  END IF;
  IF jsonb_array_length(values_json) = 0 AND NOT allow_empty THEN
    PERFORM keynes_internal.invalid_command(
      operation_name, '$.' || input_field, 'minItems'
    );
  END IF;
  IF jsonb_array_length(values_json) = 0 THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'resourceTypeId', resource_type_id::text,
      'amount', 0
    ) ORDER BY resource_type_id), '[]'::jsonb)
      INTO translated
      FROM keynes_internal.budget_resources
     WHERE tenant_id = selected_tenant AND budget_id = selected_budget;
    RETURN translated;
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(values_json) member(value)
  LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object'
      OR NOT (item ? 'resource') OR NOT (item ? 'amount')
      OR item - ARRAY['resource', 'amount']::text[] <> '{}'::jsonb THEN
      PERFORM keynes_internal.invalid_command(
        operation_name, '$.' || input_field, 'items'
      );
    END IF;
    translated := translated || jsonb_build_array(jsonb_build_object(
      'resourceTypeId', keynes_internal.remote_resource_id_v0006(
        selected_tenant, item->>'resource', operation_name
      )::text,
      'amount', item->'amount'
    ));
  END LOOP;
  RETURN translated;
END;
$_$;

CREATE FUNCTION keynes_internal.remote_open_budget_v0006(input jsonb) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
DECLARE
  tenant uuid;
  selected_budget uuid;
  actual_resources jsonb;
  expected_resources jsonb;
  projection jsonb;
BEGIN
  PERFORM set_config('keynes.remote_operation', 'openBudget', true);
  BEGIN
    PERFORM keynes_internal.set_remote_identity_v0006();
    tenant := current_setting('keynes.tenant_id')::uuid;
    selected_budget := keynes_internal.remote_budget_id_v0006(
      tenant, input->>'budgetReference', 'openBudget'
    );
    SELECT coalesce(jsonb_agg(resource_type.definition ORDER BY
             resource_type.canonical_name COLLATE "C"), '[]'::jsonb)
      INTO actual_resources
      FROM keynes_internal.budget_resources budget_resource
      JOIN keynes_internal.resource_types resource_type
        USING (tenant_id, resource_type_id)
     WHERE budget_resource.tenant_id = tenant
       AND budget_resource.budget_id = selected_budget;
    SELECT coalesce(jsonb_agg(value ORDER BY
             (value->>'canonicalName') COLLATE "C"), '[]'::jsonb)
      INTO expected_resources
      FROM jsonb_array_elements(
        coalesce(input->'expectedResources', '[]'::jsonb)
      );
    IF actual_resources IS DISTINCT FROM expected_resources THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'kind', 'error', 'code', 'resource_binding_mismatch',
          'details', '{}'::jsonb
        )
      );
    END IF;
    projection := keynes_internal.budget_projection(tenant, selected_budget);
    RETURN jsonb_build_object(
      'ok', true,
      'result', jsonb_build_object(
        'budgetReference', input->>'budgetReference',
        'budget', keynes_internal.remote_project_json_v0006(tenant, projection)
      )
    );
  EXCEPTION WHEN SQLSTATE 'K0001' THEN
    RETURN keynes_internal.remote_error_v0006('unauthorized', 'openBudget');
  END;
END;
$$;

CREATE FUNCTION keynes_internal.remote_operation_lock_key_v0006(selected_tenant uuid, operation_key_value text) RETURNS bigint
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT hashtextextended(
    selected_tenant::text || ':' || operation_key_value,
    1262836045
  );
$$;

CREATE FUNCTION keynes_internal.remote_project_json_v0006(selected_tenant uuid, value_json jsonb) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
DECLARE
  key_name text;
  item jsonb;
  projected jsonb := '{}'::jsonb;
  resource_name text;
  projected_key text;
  projected_value jsonb;
  budget_id_value uuid;
BEGIN
  IF value_json IS NULL OR value_json = 'null'::jsonb THEN RETURN value_json; END IF;
  IF jsonb_typeof(value_json) = 'array' THEN
    RETURN coalesce((
      SELECT jsonb_agg(keynes_internal.remote_project_json_v0006(
        selected_tenant, member.value
      )) FROM jsonb_array_elements(value_json) member(value)
    ), '[]'::jsonb);
  END IF;
  IF jsonb_typeof(value_json) <> 'object' THEN RETURN value_json; END IF;
  FOR key_name, item IN SELECT key, value FROM jsonb_each(value_json)
  LOOP
    IF key_name IN (
      'commandId', 'entryId', 'subjectBudgetId', 'definitionEvidence'
    ) THEN CONTINUE; END IF;
    IF key_name = 'resourceType' THEN
      projected := projected || jsonb_build_object(
        'resource', item - ARRAY['resourceTypeId', 'definitionDigest']::text[]
      );
      CONTINUE;
    END IF;
    IF key_name = 'resourceTypeId' THEN
      SELECT canonical_name INTO resource_name
        FROM keynes_internal.resource_types
       WHERE tenant_id = selected_tenant
         AND resource_type_id = (item #>> '{}')::uuid;
      IF resource_name IS NULL THEN
        RAISE EXCEPTION 'missing Resource projection';
      END IF;
      projected := projected || jsonb_build_object('resource', resource_name);
      CONTINUE;
    END IF;
    IF key_name = 'unresolvedResourceTypeIds' THEN
      SELECT coalesce(jsonb_agg(resource_type.canonical_name ORDER BY
               resource_type.canonical_name COLLATE "C"), '[]'::jsonb)
        INTO projected_value
        FROM jsonb_array_elements_text(item) member(value)
        JOIN keynes_internal.resource_types resource_type
          ON resource_type.tenant_id = selected_tenant
         AND resource_type.resource_type_id = member.value::uuid;
      projected := projected || jsonb_build_object(
        'unresolvedResources', projected_value
      );
      CONTINUE;
    END IF;
    IF key_name IN (
      'budgetId', 'parentBudgetId', 'rootBudgetId', 'childBudgetId'
    ) THEN
      projected_key := CASE key_name
        WHEN 'budgetId' THEN 'budgetReference'
        WHEN 'parentBudgetId' THEN 'parentBudgetReference'
        WHEN 'rootBudgetId' THEN 'rootBudgetReference'
        ELSE 'childBudgetReference'
      END;
      IF item = 'null'::jsonb THEN
        projected_value := 'null'::jsonb;
      ELSE
        budget_id_value := (item #>> '{}')::uuid;
        projected_value := to_jsonb(
          keynes_internal.remote_budget_reference_v0006(
            selected_tenant, budget_id_value
          )
        );
      END IF;
      projected := projected || jsonb_build_object(
        projected_key, projected_value
      );
      CONTINUE;
    END IF;
    projected := projected || jsonb_build_object(
      key_name,
      keynes_internal.remote_project_json_v0006(selected_tenant, item)
    );
  END LOOP;
  RETURN projected;
END;
$$;


CREATE FUNCTION keynes_internal.remote_recover_operation_v0006(input jsonb) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $_$
DECLARE
  tenant uuid;
  operation_record keynes_internal.remote_operations%ROWTYPE;
  operation_key_value text := input->>'operationKey';
  recovered jsonb;
  recovery_lock_acquired boolean;
BEGIN
  PERFORM set_config('keynes.remote_operation', 'recoverOperation', true);
  BEGIN
    PERFORM keynes_internal.set_remote_identity_v0006();
  EXCEPTION WHEN SQLSTATE 'K0001' THEN
    RETURN keynes_internal.remote_error_v0006(
      'unauthorized', 'recoverOperation'
    );
  END;
  tenant := current_setting('keynes.tenant_id')::uuid;
  IF operation_key_value IS NULL
    OR operation_key_value !~ '^kop_v1_[A-Za-z0-9_-]{43}$' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'kind', 'error', 'code', 'invalid_command',
        'details', jsonb_build_object(
          'operation', 'recoverOperation',
          'issues', jsonb_build_array(
            jsonb_build_object('path', '$.operationKey', 'rule', 'format')
          )
        )
      )
    );
  END IF;
  recovery_lock_acquired := pg_try_advisory_xact_lock(
    keynes_internal.remote_operation_lock_key_v0006(
      tenant, operation_key_value
    )
  );
  IF NOT recovery_lock_acquired THEN
    RETURN jsonb_build_object(
      'ok', true,
      'result', jsonb_build_object(
        'kind', 'unresolved', 'operationKey', operation_key_value,
        'retryAfterMilliseconds', 100
      )
    );
  END IF;
  SELECT * INTO operation_record
    FROM keynes_internal.remote_operations
   WHERE tenant_id = tenant AND operation_key = operation_key_value;
  IF NOT FOUND OR operation_record.expires_at <= clock_timestamp() THEN
    recovered := jsonb_build_object(
      'kind', 'expired', 'operationKey', operation_key_value
    );
  ELSIF operation_record.status = 'unresolved' THEN
    recovered := jsonb_build_object(
      'kind', 'unresolved', 'operationKey', operation_key_value,
      'retryAfterMilliseconds', 100
    );
  ELSIF operation_record.status = 'known_failure' THEN
    recovered := jsonb_build_object(
      'kind', 'known_failure', 'operationKey', operation_key_value,
      'error', operation_record.response
    );
  ELSE
    recovered := jsonb_build_object(
      'kind', 'committed', 'operationKey', operation_key_value,
      'operation', operation_record.operation,
      'result', operation_record.response
    );
  END IF;
  RETURN jsonb_build_object('ok', true, 'result', recovered);
END;
$_$;

CREATE FUNCTION keynes_internal.remote_recover_operation_v0008(input jsonb) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
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
$$;

CREATE FUNCTION keynes_internal.remote_resource_id_v0006(selected_tenant uuid, resource_name text, operation_name text) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $_$
DECLARE selected_resource uuid;
BEGIN
  IF resource_name IS NULL OR resource_name !~ '^[a-z][a-z0-9_]{0,62}$' THEN
    PERFORM keynes_internal.invalid_command(
      operation_name, '$.resources[].resource', 'pattern'
    );
  END IF;
  SELECT resource_type_id INTO selected_resource
    FROM keynes_internal.resource_types
   WHERE tenant_id = selected_tenant AND canonical_name = resource_name;
  IF NOT FOUND THEN
    PERFORM keynes_internal.invalid_command(
      operation_name, '$.resources[].resource', 'allocatedResourceTypes'
    );
  END IF;
  RETURN selected_resource;
END;
$_$;

CREATE FUNCTION keynes_internal.remote_safe_error_v0006(operation_name text, error_json jsonb) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE error_code text := error_json->>'code';
BEGIN
  IF error_code = 'invalid_command' THEN
    RETURN jsonb_build_object(
      'kind', 'error',
      'code', 'invalid_command',
      'details', jsonb_build_object(
        'operation', operation_name,
        'issues', coalesce(error_json->'details'->'issues', '[]'::jsonb)
      )
    );
  END IF;
  IF error_code = 'unauthorized' THEN
    RETURN keynes_internal.remote_error_v0006(
      'unauthorized', operation_name
    )->'error';
  END IF;
  IF error_code IN (
    'command_conflict',
    'resource_type_conflict',
    'resource_type_not_found',
    'budget_not_found',
    'budget_not_active',
    'usage_conflict',
    'arithmetic_error'
  ) THEN
    RETURN jsonb_build_object(
      'kind', 'error', 'code', error_code, 'details', '{}'::jsonb
    );
  END IF;
  RETURN jsonb_build_object(
    'kind', 'error', 'code', 'unknown', 'details', '{}'::jsonb
  );
END;
$$;

CREATE FUNCTION keynes_internal.remote_token_v0006(token_prefix text, token_seed text) RETURNS text
LANGUAGE sql
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT token_prefix || translate(
    encode(
      sha256(convert_to(token_seed || ':' || gen_random_uuid()::text, 'UTF8')),
      'base64'
    ),
    '+/=',
    '-_'
  );
$$;

CREATE FUNCTION keynes_internal.remote_validate_input_v0006(operation_name text, input jsonb) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $_$
DECLARE
  allowed_keys text[];
  required_keys text[];
  array_value jsonb;
  item jsonb;
  field_value jsonb;
  field_name text;
  input_field text;
  domain_error_message text;
BEGIN
  PERFORM set_config('keynes.remote_operation', operation_name, true);
  BEGIN
    PERFORM keynes_internal.set_remote_identity_v0006();
  EXCEPTION WHEN SQLSTATE 'K0001' THEN
    RETURN keynes_internal.remote_error_v0006('unauthorized', operation_name);
  END;

  IF operation_name = 'createBudget' THEN
    allowed_keys := ARRAY['operationKey', 'definitions', 'amounts'];
    required_keys := ARRAY['operationKey', 'definitions', 'amounts'];
  ELSIF operation_name = 'requestBudget' THEN
    allowed_keys := ARRAY[
      'operationKey', 'parentBudgetReference', 'resources'
    ];
    required_keys := ARRAY[
      'operationKey', 'parentBudgetReference', 'resources'
    ];
  ELSIF operation_name = 'settleBudget' THEN
    allowed_keys := ARRAY['operationKey', 'budgetReference', 'usage'];
    required_keys := ARRAY['operationKey', 'budgetReference', 'usage'];
  ELSIF operation_name = 'getBudget' THEN
    allowed_keys := ARRAY['budgetReference'];
    required_keys := allowed_keys;
  ELSIF operation_name = 'getBudgetHistoryPage' THEN
    allowed_keys := ARRAY['budgetReference', 'cursor'];
    required_keys := ARRAY['budgetReference'];
  ELSIF operation_name = 'openBudget' THEN
    allowed_keys := ARRAY['budgetReference', 'expectedResources'];
    required_keys := allowed_keys;
  ELSIF operation_name = 'recoverOperation' THEN
    allowed_keys := ARRAY['operationKey'];
    required_keys := allowed_keys;
  ELSIF operation_name = 'getCompatibility' THEN
    allowed_keys := ARRAY[]::text[];
    required_keys := allowed_keys;
  ELSE
    RETURN keynes_internal.remote_invalid_v0006(
      operation_name, '$', 'operation'
    );
  END IF;

  IF jsonb_typeof(input) IS DISTINCT FROM 'object' THEN
    RETURN keynes_internal.remote_invalid_v0006(operation_name, '$', 'type');
  END IF;
  IF input - allowed_keys <> '{}'::jsonb THEN
    RETURN keynes_internal.remote_invalid_v0006(
      operation_name, '$', 'additionalProperties'
    );
  END IF;
  FOREACH field_name IN ARRAY required_keys LOOP
    IF NOT (input ? field_name) THEN
      RETURN keynes_internal.remote_invalid_v0006(
        operation_name, '$.' || field_name, 'required'
      );
    END IF;
  END LOOP;

  IF input ? 'operationKey' AND (
    jsonb_typeof(input->'operationKey') IS DISTINCT FROM 'string'
    OR input->>'operationKey' !~ '^kop_v1_[A-Za-z0-9_-]{43}$'
  ) THEN
    RETURN keynes_internal.remote_invalid_v0006(
      operation_name, '$.operationKey', 'format'
    );
  END IF;
  FOREACH field_name IN ARRAY ARRAY[
    'budgetReference', 'parentBudgetReference'
  ] LOOP
    IF input ? field_name AND (
      jsonb_typeof(input->field_name) IS DISTINCT FROM 'string'
      OR input->>field_name !~ '^kbr_v1_[A-Za-z0-9_-]{43}$'
    ) THEN
      RETURN keynes_internal.remote_invalid_v0006(
        operation_name, '$.' || field_name, 'format'
      );
    END IF;
  END LOOP;
  IF input ? 'cursor' AND (
    jsonb_typeof(input->'cursor') IS DISTINCT FROM 'string'
    OR input->>'cursor' !~ '^khc_v1_[A-Za-z0-9_-]{43}$'
  ) THEN
    RETURN keynes_internal.remote_invalid_v0006(
      operation_name, '$.cursor', 'format'
    );
  END IF;

  IF operation_name = 'createBudget' THEN
    BEGIN
      PERFORM keynes_internal.canonical_creation_v0008(
        input->'definitions', input->'amounts'
      );
    EXCEPTION WHEN SQLSTATE 'K0001' THEN
      GET STACKED DIAGNOSTICS domain_error_message = MESSAGE_TEXT;
      RETURN jsonb_build_object(
        'ok', false,
        'error', keynes_internal.remote_safe_error_v0006(
          operation_name, domain_error_message::jsonb
        )
      );
    END;
  END IF;

  FOREACH input_field IN ARRAY ARRAY['resources', 'usage'] LOOP
    IF input ? input_field AND operation_name <> 'createBudget' THEN
      array_value := input->input_field;
      IF jsonb_typeof(array_value) IS DISTINCT FROM 'array' THEN
        RETURN keynes_internal.remote_invalid_v0006(
          operation_name, '$.' || input_field, 'type'
        );
      END IF;
      IF jsonb_array_length(array_value) = 0 THEN
        RETURN keynes_internal.remote_invalid_v0006(
          operation_name, '$.' || input_field, 'minItems'
        );
      END IF;
      IF jsonb_array_length(array_value) > 64 THEN
        RETURN keynes_internal.remote_invalid_v0006(
          operation_name, '$.' || input_field, 'maxItems'
        );
      END IF;
      IF (SELECT count(*) <> count(DISTINCT value)
            FROM jsonb_array_elements(array_value) member(value)) THEN
        RETURN keynes_internal.remote_invalid_v0006(
          operation_name, '$.' || input_field, 'uniqueItems'
        );
      END IF;
      FOR item IN SELECT value FROM jsonb_array_elements(array_value) member(value)
      LOOP
        IF jsonb_typeof(item) IS DISTINCT FROM 'object'
          OR NOT (item ? 'resource') OR NOT (item ? 'amount')
          OR item - ARRAY['resource', 'amount']::text[] <> '{}'::jsonb THEN
          RETURN keynes_internal.remote_invalid_v0006(
            operation_name, '$.' || input_field || '[]', 'items'
          );
        END IF;
        IF jsonb_typeof(item->'resource') IS DISTINCT FROM 'string'
          OR item->>'resource' !~ '^[a-z][a-z0-9_]{0,62}$' THEN
          RETURN keynes_internal.remote_invalid_v0006(
            operation_name, '$.' || input_field || '[].resource', 'pattern'
          );
        END IF;
        IF operation_name = 'settleBudget' AND item->'amount' = 'null'::jsonb THEN
          CONTINUE;
        END IF;
        IF jsonb_typeof(item->'amount') IS DISTINCT FROM 'number'
          OR (item->>'amount')::numeric <> trunc((item->>'amount')::numeric)
          OR (item->>'amount')::numeric < 0
          OR (item->>'amount')::numeric > 9007199254740991 THEN
          RETURN keynes_internal.remote_invalid_v0006(
            operation_name, '$.' || input_field || '[].amount', 'range'
          );
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  IF input ? 'expectedResources' THEN
    array_value := input->'expectedResources';
    IF jsonb_typeof(array_value) IS DISTINCT FROM 'array' THEN
      RETURN keynes_internal.remote_invalid_v0006(
        operation_name, '$.expectedResources', 'type'
      );
    END IF;
    IF jsonb_array_length(array_value) = 0 THEN
      RETURN keynes_internal.remote_invalid_v0006(
        operation_name, '$.expectedResources', 'minItems'
      );
    END IF;
    IF jsonb_array_length(array_value) > 64 THEN
      RETURN keynes_internal.remote_invalid_v0006(
        operation_name, '$.expectedResources', 'maxItems'
      );
    END IF;
    IF (SELECT count(*) <> count(DISTINCT value)
          FROM jsonb_array_elements(array_value) member(value)) THEN
      RETURN keynes_internal.remote_invalid_v0006(
        operation_name, '$.expectedResources', 'uniqueItems'
      );
    END IF;
    BEGIN
      FOR item IN SELECT value FROM jsonb_array_elements(array_value) member(value)
      LOOP
        PERFORM keynes_internal.canonical_resource_definition_v0008(
          operation_name, item, '$.expectedResources[]'
        );
      END LOOP;
    EXCEPTION WHEN SQLSTATE 'K0001' THEN
      GET STACKED DIAGNOSTICS domain_error_message = MESSAGE_TEXT;
      RETURN jsonb_build_object(
        'ok', false,
        'error', keynes_internal.remote_safe_error_v0006(
          operation_name, domain_error_message::jsonb
        )
      );
    END;
  END IF;

  RETURN NULL;
END;
$_$;

CREATE FUNCTION keynes_internal.remote_validate_resources_v0008(input jsonb) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
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
$$;
























SET default_tablespace = '';

SET default_table_access_method = heap;

CREATE TABLE keynes_internal.resource_types (
    tenant_id uuid NOT NULL,
    resource_type_id uuid NOT NULL,
    canonical_name text NOT NULL,
    unit text NOT NULL,
    accounting_behavior text NOT NULL,
    definition jsonb NOT NULL,
    definition_digest text NOT NULL,
    definer_principal_id uuid NOT NULL,
    definition_command_id uuid NOT NULL,
    CONSTRAINT resource_type_accounting_behavior CHECK ((accounting_behavior = ANY (ARRAY['consumable'::text, 'reusable'::text]))),
    CONSTRAINT resource_type_definition_digest_format CHECK ((definition_digest ~ '^resource-definition:[0-9a-f]{64}$'::text)),
    CONSTRAINT resource_type_definition_is_object CHECK ((jsonb_typeof(definition) = 'object'::text)),
    CONSTRAINT resource_type_name CHECK ((canonical_name ~ '^[a-z][a-z0-9_]{0,62}$'::text)),
    CONSTRAINT resource_type_unit CHECK ((((char_length(unit) >= 1) AND (char_length(unit) <= 64)) AND (unit = btrim(unit)) AND (unit !~ '[[:cntrl:]]'::text)))
);

CREATE FUNCTION keynes_internal.resolve_resource_v0008(selected_tenant uuid, selected_principal uuid, selected_command uuid, selected_resource uuid, canonical_definition jsonb) RETURNS keynes_internal.resource_types
LANGUAGE plpgsql
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
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
$$;

CREATE FUNCTION keynes_internal.revoke_remote_role_v0006(login_role name) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
DECLARE role_oid_value oid;
BEGIN
  UPDATE keynes_internal.remote_role_mappings
     SET status = 'revoked', updated_at = clock_timestamp()
   WHERE role_name = login_role
   RETURNING role_oid INTO role_oid_value;
  IF NOT FOUND THEN RAISE EXCEPTION 'remote login role is not mapped'; END IF;
  INSERT INTO keynes_internal.remote_credential_audit (
    role_oid, role_name, action, actor
  ) VALUES (role_oid_value, login_role, 'revoked', session_user);
  RETURN jsonb_build_object('roleName', login_role, 'status', 'revoked');
END;
$$;

CREATE FUNCTION keynes_internal.rotate_remote_role_v0006(old_login_role name, new_login_role name) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
DECLARE
  old_mapping keynes_internal.remote_role_mappings%ROWTYPE;
  new_oid oid;
BEGIN
  new_oid := keynes_internal.remote_login_oid_v0006(new_login_role);
  LOCK TABLE keynes_internal.remote_role_mappings
    IN SHARE ROW EXCLUSIVE MODE;
  SELECT * INTO old_mapping
    FROM keynes_internal.remote_role_mappings
   WHERE role_name = old_login_role AND status = 'enabled'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'old remote login role is not enabled';
  END IF;
  IF EXISTS (
    SELECT 1 FROM keynes_internal.remote_role_mappings
     WHERE role_name = new_login_role OR role_oid = new_oid
  ) THEN
    RAISE EXCEPTION 'remote role mapping target is occupied';
  END IF;
  UPDATE keynes_internal.remote_role_mappings
     SET status = 'disabled', updated_at = clock_timestamp()
   WHERE role_oid = old_mapping.role_oid;
  INSERT INTO keynes_internal.remote_role_mappings (
    role_oid, role_name, tenant_id, principal_id, status
  ) VALUES (
    new_oid, new_login_role, old_mapping.tenant_id,
    old_mapping.principal_id, 'enabled'
  );
  INSERT INTO keynes_internal.remote_credential_audit (
    role_oid, role_name, action, actor
  ) VALUES
    (old_mapping.role_oid, old_login_role, 'disabled', session_user),
    (new_oid, new_login_role, 'registered', session_user);
  RETURN jsonb_build_object(
    'oldRoleName', old_login_role, 'oldStatus', 'disabled',
    'newRoleName', new_login_role, 'newStatus', 'enabled'
  );
END;
$$;

CREATE FUNCTION keynes_internal.set_remote_identity_v0006() RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
DECLARE
  authenticated_oid oid;
  mapped keynes_internal.remote_role_mappings%ROWTYPE;
  operation_name text := coalesce(
    nullif(current_setting('keynes.remote_operation', true), ''),
    'getCompatibility'
  );
BEGIN
  SELECT oid INTO authenticated_oid FROM pg_roles WHERE rolname = session_user;
  SELECT * INTO mapped
    FROM keynes_internal.remote_role_mappings
   WHERE role_oid = authenticated_oid
     AND role_name = session_user
     AND status = 'enabled'
   FOR SHARE;
  IF NOT FOUND THEN
    PERFORM keynes_internal.raise_domain_error(
      'unauthorized',
      jsonb_build_object(
        'operation', operation_name,
        'requiredPermission', 'remote_access'
      )
    );
  END IF;
  PERFORM set_config('keynes.tenant_id', mapped.tenant_id::text, true);
  PERFORM set_config('keynes.principal_id', mapped.principal_id::text, true);
END;
$$;

CREATE FUNCTION keynes_internal.set_remote_role_enabled_v0006(login_role name, next_enabled boolean) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $$
DECLARE
  role_oid_value oid;
  current_oid oid;
BEGIN
  IF next_enabled THEN
    current_oid := keynes_internal.remote_login_oid_v0006(login_role);
  END IF;
  UPDATE keynes_internal.remote_role_mappings
     SET status = CASE WHEN next_enabled THEN 'enabled' ELSE 'disabled' END,
         updated_at = clock_timestamp()
   WHERE role_name = login_role AND status <> 'revoked'
     AND (NOT next_enabled OR role_oid = current_oid)
   RETURNING role_oid INTO role_oid_value;
  IF NOT FOUND THEN RAISE EXCEPTION 'remote login role is not mapped'; END IF;
  INSERT INTO keynes_internal.remote_credential_audit (
    role_oid, role_name, action, actor
  ) VALUES (
    role_oid_value, login_role,
    CASE WHEN next_enabled THEN 'enabled' ELSE 'disabled' END,
    session_user
  );
  RETURN jsonb_build_object(
    'roleName', login_role,
    'status', CASE WHEN next_enabled THEN 'enabled' ELSE 'disabled' END
  );
END;
$$;

CREATE FUNCTION keynes_internal.subtree_observed(selected_tenant uuid, selected_budget uuid, selected_resource uuid) RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE subtree AS (
    SELECT budget_id FROM keynes_internal.budgets
    WHERE tenant_id = selected_tenant AND budget_id = selected_budget
    UNION ALL
    SELECT child.budget_id FROM keynes_internal.budgets AS child
    JOIN subtree AS parent ON child.parent_budget_id = parent.budget_id
    WHERE child.tenant_id = selected_tenant
  )
  SELECT coalesce(sum(fact.direct_usage_amount), 0)
  FROM subtree
  JOIN keynes_internal.budget_resources AS fact
    ON fact.tenant_id = selected_tenant AND fact.budget_id = subtree.budget_id
  WHERE fact.resource_type_id = selected_resource;
$$;





















CREATE FUNCTION keynes_internal.validate_resources_v0008(input jsonb) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $_$
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
    definitions := keynes_internal.canonical_definitions_v0008(operation_name, input->'definitions');
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
$_$;







CREATE TABLE keynes_internal.budget_history_entries (
    tenant_id uuid NOT NULL,
    stream_id uuid NOT NULL,
    sequence bigint NOT NULL,
    event_id uuid NOT NULL,
    command_id uuid NOT NULL,
    event_kind text NOT NULL,
    subject_id uuid NOT NULL,
    payload jsonb NOT NULL,
    recorded_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT history_event_kind CHECK ((event_kind = ANY (ARRAY['budget_created'::text, 'request_approved'::text, 'request_denied'::text, 'budget_settlement_recorded'::text]))),
    CONSTRAINT history_payload_is_object CHECK ((jsonb_typeof(payload) = 'object'::text)),
    CONSTRAINT history_sequence_safe CHECK (((sequence >= 1) AND (sequence <= '9007199254740991'::bigint)))
);

CREATE TABLE keynes_internal.budget_history_streams (
    tenant_id uuid NOT NULL,
    stream_id uuid NOT NULL,
    next_sequence bigint DEFAULT 1 NOT NULL,
    CONSTRAINT history_next_sequence_safe CHECK (((next_sequence >= 1) AND (next_sequence <= '9007199254740991'::bigint)))
);

CREATE TABLE keynes_internal.budget_resources (
    tenant_id uuid NOT NULL,
    budget_id uuid NOT NULL,
    resource_type_id uuid NOT NULL,
    allocated_amount bigint NOT NULL,
    direct_usage_amount bigint,
    usage_command_id uuid,
    CONSTRAINT budget_resource_allocation_safe CHECK (((allocated_amount >= 0) AND (allocated_amount <= '9007199254740991'::bigint))),
    CONSTRAINT budget_resource_usage_pair CHECK (((direct_usage_amount IS NULL) = (usage_command_id IS NULL))),
    CONSTRAINT budget_resource_usage_safe CHECK (((direct_usage_amount IS NULL) OR ((direct_usage_amount >= 0) AND (direct_usage_amount <= '9007199254740991'::bigint))))
);

CREATE TABLE keynes_internal.budgets (
    tenant_id uuid NOT NULL,
    budget_id uuid NOT NULL,
    parent_budget_id uuid,
    root_budget_id uuid NOT NULL,
    depth bigint NOT NULL,
    lifecycle text NOT NULL,
    CONSTRAINT budget_depth_safe CHECK (((depth >= 0) AND (depth <= '9007199254740991'::bigint))),
    CONSTRAINT budget_lifecycle CHECK ((lifecycle = ANY (ARRAY['active'::text, 'settling'::text]))),
    CONSTRAINT budget_root_shape CHECK ((((parent_budget_id IS NULL) AND (root_budget_id = budget_id) AND (depth = 0)) OR ((parent_budget_id IS NOT NULL) AND (depth > 0))))
);

CREATE TABLE keynes_internal.commands (
    tenant_id uuid NOT NULL,
    command_id uuid NOT NULL,
    operation text NOT NULL,
    target_kind text NOT NULL,
    target_id uuid NOT NULL,
    canonical_body jsonb NOT NULL,
    body_digest text NOT NULL,
    principal_id uuid NOT NULL,
    result jsonb,
    committed_at timestamp with time zone,
    binding_reference text,
    CONSTRAINT command_body_digest_format CHECK ((body_digest ~ '^command-body:[0-9a-f]{64}$'::text)),
    CONSTRAINT command_body_is_object CHECK ((jsonb_typeof(canonical_body) = 'object'::text)),
    CONSTRAINT command_commit_pair CHECK (((result IS NULL) = (committed_at IS NULL))),
    CONSTRAINT command_operation CHECK ((operation = ANY (ARRAY['defineResource'::text, 'defineResources'::text, 'createBudget'::text, 'requestBudget'::text, 'settleBudget'::text]))),
    CONSTRAINT command_target_kind CHECK ((target_kind = ANY (ARRAY['resource_type'::text, 'budget'::text]))),
    CONSTRAINT commands_binding_reference_check CHECK ((binding_reference ~ '^krs_v1_[A-Za-z0-9_-]{43}$'::text))
);

CREATE TABLE keynes_internal.installation_identity (
    singleton boolean NOT NULL,
    profile_id text NOT NULL,
    server_version_num text NOT NULL,
    contract_digest text NOT NULL,
    migration_set_digest text NOT NULL,
    owner_role name NOT NULL,
    application_role name NOT NULL,
    tenant_id uuid NOT NULL,
    principal_id uuid NOT NULL,
    execution_role name NOT NULL,
    administration_role name NOT NULL,
    remote_procedures_digest text NOT NULL,
    CONSTRAINT installation_identity_contract_digest_check CHECK ((contract_digest ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT installation_identity_migration_set_digest_check CHECK ((migration_set_digest ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT installation_identity_remote_procedures_digest_check CHECK ((remote_procedures_digest ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT installation_identity_singleton_check CHECK (singleton)
);

CREATE TABLE keynes_internal.principal_permissions (
    tenant_id uuid NOT NULL,
    principal_id uuid NOT NULL,
    permission text NOT NULL,
    CONSTRAINT principal_permission_name CHECK ((permission = ANY (ARRAY['define_resource_type'::text, 'create_root_budget'::text, 'request_budget'::text, 'settle_budget'::text, 'read_budget'::text])))
);

CREATE TABLE keynes_internal.remote_budget_references (
    tenant_id uuid NOT NULL,
    budget_id uuid NOT NULL,
    budget_reference text NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT remote_budget_references_budget_reference_check CHECK ((budget_reference ~ '^kbr_v1_[A-Za-z0-9_-]{43}$'::text))
);

CREATE TABLE keynes_internal.remote_credential_audit (
    audit_id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_oid oid NOT NULL,
    role_name name NOT NULL,
    action text NOT NULL,
    occurred_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    actor name NOT NULL,
    CONSTRAINT remote_credential_audit_action_check CHECK ((action = ANY (ARRAY['registered'::text, 'disabled'::text, 'enabled'::text, 'revoked'::text])))
);

CREATE TABLE keynes_internal.remote_history_cursors (
    cursor_value text NOT NULL,
    tenant_id uuid NOT NULL,
    stream_id uuid NOT NULL,
    next_sequence bigint NOT NULL,
    terminal_sequence bigint NOT NULL,
    expires_at timestamp with time zone DEFAULT (clock_timestamp() + '00:30:00'::interval) NOT NULL,
    CONSTRAINT remote_history_cursors_check CHECK ((terminal_sequence >= next_sequence)),
    CONSTRAINT remote_history_cursors_cursor_value_check CHECK ((cursor_value ~ '^khc_v1_[A-Za-z0-9_-]{43}$'::text)),
    CONSTRAINT remote_history_cursors_next_sequence_check CHECK ((next_sequence > 0))
);

CREATE TABLE keynes_internal.remote_operations (
    tenant_id uuid NOT NULL,
    operation_key text NOT NULL,
    command_id uuid NOT NULL,
    operation text NOT NULL,
    canonical_input jsonb NOT NULL,
    input_digest text NOT NULL,
    status text DEFAULT 'unresolved'::text NOT NULL,
    response jsonb,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    completed_at timestamp with time zone,
    expires_at timestamp with time zone DEFAULT (clock_timestamp() + '30 days'::interval) NOT NULL,
    CONSTRAINT remote_operations_canonical_input_check CHECK ((jsonb_typeof(canonical_input) = 'object'::text)),
    CONSTRAINT remote_operations_check CHECK (((status = 'unresolved'::text) = (response IS NULL))),
    CONSTRAINT remote_operations_check1 CHECK (((status = 'unresolved'::text) = (completed_at IS NULL))),
    CONSTRAINT remote_operations_input_digest_check CHECK ((input_digest ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT remote_operations_operation_check CHECK ((operation = ANY (ARRAY['defineResources'::text, 'createBudget'::text, 'requestBudget'::text, 'settleBudget'::text]))),
    CONSTRAINT remote_operations_operation_key_check CHECK ((operation_key ~ '^kop_v1_[A-Za-z0-9_-]{43}$'::text)),
    CONSTRAINT remote_operations_status_check CHECK ((status = ANY (ARRAY['unresolved'::text, 'committed'::text, 'known_failure'::text])))
);

CREATE TABLE keynes_internal.remote_role_mappings (
    role_oid oid NOT NULL,
    role_name name NOT NULL,
    tenant_id uuid NOT NULL,
    principal_id uuid NOT NULL,
    status text DEFAULT 'enabled'::text NOT NULL,
    enabled boolean GENERATED ALWAYS AS ((status = 'enabled'::text)) STORED,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    updated_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT remote_role_mappings_status_check CHECK ((status = ANY (ARRAY['enabled'::text, 'disabled'::text, 'revoked'::text])))
);

CREATE TABLE keynes_internal.schema_migrations (
    migration_id text NOT NULL,
    byte_checksum text NOT NULL,
    contract_digest text,
    applied_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT migration_checksum_format CHECK ((byte_checksum ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT migration_contract_digest_format CHECK (((contract_digest IS NULL) OR (contract_digest ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT migration_id_format CHECK ((migration_id ~ '^[0-9]{4}-[a-z][a-z0-9-]*$'::text))
);

ALTER TABLE ONLY keynes_internal.budget_history_entries
    ADD CONSTRAINT budget_history_entries_pkey PRIMARY KEY (tenant_id, stream_id, sequence);

ALTER TABLE ONLY keynes_internal.budget_history_entries
    ADD CONSTRAINT budget_history_entries_tenant_id_command_id_key UNIQUE (tenant_id, command_id);

ALTER TABLE ONLY keynes_internal.budget_history_entries
    ADD CONSTRAINT budget_history_entries_tenant_id_event_id_key UNIQUE (tenant_id, event_id);

ALTER TABLE ONLY keynes_internal.budget_history_streams
    ADD CONSTRAINT budget_history_streams_pkey PRIMARY KEY (tenant_id, stream_id);

ALTER TABLE ONLY keynes_internal.budget_resources
    ADD CONSTRAINT budget_resources_pkey PRIMARY KEY (tenant_id, budget_id, resource_type_id);

ALTER TABLE ONLY keynes_internal.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (tenant_id, budget_id);

ALTER TABLE ONLY keynes_internal.commands
    ADD CONSTRAINT commands_pkey PRIMARY KEY (tenant_id, command_id);

ALTER TABLE ONLY keynes_internal.installation_identity
    ADD CONSTRAINT installation_identity_pkey PRIMARY KEY (singleton);

ALTER TABLE ONLY keynes_internal.principal_permissions
    ADD CONSTRAINT principal_permissions_pkey PRIMARY KEY (tenant_id, principal_id, permission);

ALTER TABLE ONLY keynes_internal.remote_budget_references
    ADD CONSTRAINT remote_budget_references_budget_reference_key UNIQUE (budget_reference);

ALTER TABLE ONLY keynes_internal.remote_budget_references
    ADD CONSTRAINT remote_budget_references_pkey PRIMARY KEY (tenant_id, budget_id);

ALTER TABLE ONLY keynes_internal.remote_credential_audit
    ADD CONSTRAINT remote_credential_audit_pkey PRIMARY KEY (audit_id);

ALTER TABLE ONLY keynes_internal.remote_history_cursors
    ADD CONSTRAINT remote_history_cursors_pkey PRIMARY KEY (cursor_value);

ALTER TABLE ONLY keynes_internal.remote_history_cursors
    ADD CONSTRAINT remote_history_cursors_tenant_id_stream_id_next_sequence_te_key UNIQUE (tenant_id, stream_id, next_sequence, terminal_sequence);

ALTER TABLE ONLY keynes_internal.remote_operations
    ADD CONSTRAINT remote_operations_pkey PRIMARY KEY (tenant_id, operation_key);

ALTER TABLE ONLY keynes_internal.remote_operations
    ADD CONSTRAINT remote_operations_tenant_id_command_id_key UNIQUE (tenant_id, command_id);

ALTER TABLE ONLY keynes_internal.remote_role_mappings
    ADD CONSTRAINT remote_role_mappings_pkey PRIMARY KEY (role_oid);

ALTER TABLE ONLY keynes_internal.remote_role_mappings
    ADD CONSTRAINT remote_role_mappings_role_name_key UNIQUE (role_name);

ALTER TABLE ONLY keynes_internal.resource_types
    ADD CONSTRAINT resource_types_pkey PRIMARY KEY (tenant_id, resource_type_id);

ALTER TABLE ONLY keynes_internal.resource_types
    ADD CONSTRAINT resource_types_tenant_id_canonical_name_key UNIQUE (tenant_id, canonical_name);

ALTER TABLE ONLY keynes_internal.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (migration_id);

CREATE UNIQUE INDEX commands_binding_reference_idx ON keynes_internal.commands USING btree (binding_reference);

ALTER TABLE ONLY keynes_internal.budget_history_entries
    ADD CONSTRAINT budget_history_entries_tenant_id_command_id_fkey FOREIGN KEY (tenant_id, command_id) REFERENCES keynes_internal.commands(tenant_id, command_id);

ALTER TABLE ONLY keynes_internal.budget_history_entries
    ADD CONSTRAINT budget_history_entries_tenant_id_stream_id_fkey FOREIGN KEY (tenant_id, stream_id) REFERENCES keynes_internal.budget_history_streams(tenant_id, stream_id);

ALTER TABLE ONLY keynes_internal.budget_history_entries
    ADD CONSTRAINT budget_history_entries_tenant_id_subject_id_fkey FOREIGN KEY (tenant_id, subject_id) REFERENCES keynes_internal.budgets(tenant_id, budget_id);

ALTER TABLE ONLY keynes_internal.budget_history_streams
    ADD CONSTRAINT budget_history_streams_tenant_id_stream_id_fkey FOREIGN KEY (tenant_id, stream_id) REFERENCES keynes_internal.budgets(tenant_id, budget_id);

ALTER TABLE ONLY keynes_internal.budget_resources
    ADD CONSTRAINT budget_resources_tenant_id_budget_id_fkey FOREIGN KEY (tenant_id, budget_id) REFERENCES keynes_internal.budgets(tenant_id, budget_id);

ALTER TABLE ONLY keynes_internal.budget_resources
    ADD CONSTRAINT budget_resources_tenant_id_resource_type_id_fkey FOREIGN KEY (tenant_id, resource_type_id) REFERENCES keynes_internal.resource_types(tenant_id, resource_type_id);

ALTER TABLE ONLY keynes_internal.budget_resources
    ADD CONSTRAINT budget_resources_tenant_id_usage_command_id_fkey FOREIGN KEY (tenant_id, usage_command_id) REFERENCES keynes_internal.commands(tenant_id, command_id);

ALTER TABLE ONLY keynes_internal.budgets
    ADD CONSTRAINT budgets_tenant_id_budget_id_fkey FOREIGN KEY (tenant_id, budget_id) REFERENCES keynes_internal.commands(tenant_id, command_id);

ALTER TABLE ONLY keynes_internal.budgets
    ADD CONSTRAINT budgets_tenant_id_parent_budget_id_fkey FOREIGN KEY (tenant_id, parent_budget_id) REFERENCES keynes_internal.budgets(tenant_id, budget_id);

ALTER TABLE ONLY keynes_internal.budgets
    ADD CONSTRAINT budgets_tenant_id_root_budget_id_fkey FOREIGN KEY (tenant_id, root_budget_id) REFERENCES keynes_internal.budgets(tenant_id, budget_id);

ALTER TABLE ONLY keynes_internal.remote_budget_references
    ADD CONSTRAINT remote_budget_references_tenant_id_budget_id_fkey FOREIGN KEY (tenant_id, budget_id) REFERENCES keynes_internal.budgets(tenant_id, budget_id);

ALTER TABLE ONLY keynes_internal.remote_history_cursors
    ADD CONSTRAINT remote_history_cursors_tenant_id_stream_id_fkey FOREIGN KEY (tenant_id, stream_id) REFERENCES keynes_internal.budget_history_streams(tenant_id, stream_id);

ALTER TABLE ONLY keynes_internal.resource_types
    ADD CONSTRAINT resource_types_definition_command_fkey FOREIGN KEY (tenant_id, definition_command_id) REFERENCES keynes_internal.commands(tenant_id, command_id);

REVOKE ALL ON SCHEMA keynes, keynes_internal FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA keynes_internal FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA keynes_internal FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA keynes, keynes_internal FROM PUBLIC;

SET check_function_bodies = true;
