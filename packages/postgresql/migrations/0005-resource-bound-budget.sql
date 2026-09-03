ALTER TABLE keynes_internal.resource_types
  ADD COLUMN definition_command_id uuid;

UPDATE keynes_internal.resource_types
SET definition_command_id = resource_type_id;

ALTER TABLE keynes_internal.resource_types
  DROP CONSTRAINT resource_types_tenant_id_resource_type_id_fkey,
  ALTER COLUMN definition_command_id SET NOT NULL,
  ADD CONSTRAINT resource_types_definition_command_fkey
    FOREIGN KEY (tenant_id, definition_command_id)
    REFERENCES keynes_internal.commands (tenant_id, command_id);

ALTER FUNCTION keynes_internal.apply_command(operation_name text, input jsonb)
  RENAME TO apply_command_v0004;

CREATE OR REPLACE FUNCTION keynes_internal.budget_projection(
  selected_tenant uuid,
  selected_budget uuid
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $function$
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
$function$;

CREATE FUNCTION keynes_internal.canonical_resource_definition_v0005(
  operation_name text,
  value jsonb,
  issue_path text
) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $function$
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
$function$;

CREATE FUNCTION keynes_internal.canonical_root_resources_v0005(
  operation_name text,
  value jsonb,
  issue_path text
) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $function$
DECLARE
  item jsonb;
  canonical_definition jsonb;
  amount numeric;
  normalized jsonb := '[]'::jsonb;
BEGIN
  IF jsonb_typeof(value) IS DISTINCT FROM 'array' THEN
    PERFORM keynes_internal.invalid_command(operation_name, issue_path, 'type');
  END IF;
  IF jsonb_array_length(value) = 0 THEN
    PERFORM keynes_internal.invalid_command(operation_name, issue_path, 'minItems');
  END IF;
  FOR item IN SELECT member.value FROM jsonb_array_elements(value) AS member(value)
  LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object'
      OR NOT (item ? 'definition') OR NOT (item ? 'amount') THEN
      PERFORM keynes_internal.invalid_command(operation_name, issue_path, 'items');
    END IF;
    IF item - ARRAY['definition', 'amount']::text[] <> '{}'::jsonb THEN
      PERFORM keynes_internal.invalid_command(
        operation_name, issue_path || '[]', 'additionalProperties'
      );
    END IF;
    canonical_definition := keynes_internal.canonical_resource_definition_v0005(
      operation_name, item->'definition', issue_path || '[].definition'
    );
    IF jsonb_typeof(item->'amount') IS DISTINCT FROM 'number' THEN
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
    normalized := normalized || jsonb_build_array(jsonb_build_object(
      'definition', canonical_definition,
      'amount', amount
    ));
  END LOOP;
  IF jsonb_array_length(normalized) <> (
    SELECT count(DISTINCT member.value->'definition'->>'canonicalName')
    FROM jsonb_array_elements(normalized) AS member(value)
  ) THEN
    PERFORM keynes_internal.invalid_command(
      operation_name, issue_path, 'uniqueItems'
    );
  END IF;
  RETURN (
    SELECT jsonb_agg(member.value ORDER BY
      (member.value->'definition'->>'canonicalName') COLLATE "C")
    FROM jsonb_array_elements(normalized) AS member(value)
  );
END;
$function$;

CREATE FUNCTION keynes_internal.apply_define_resource_v0005(input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
<<apply_define_resource_v0005>>
DECLARE
  operation_name constant text := 'defineResource';
  tenant uuid;
  principal uuid;
  command_id uuid;
  canonical_definition jsonb;
  body jsonb;
  body_digest_value text;
  definition_digest_value text;
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
        AND stored.command_id = apply_define_resource_v0005.command_id
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

    definition_digest_value := 'resource-definition:' || encode(
      sha256(convert_to(canonical_definition::text, 'UTF8')), 'hex'
    );
    SELECT * INTO stored_resource
    FROM keynes_internal.resource_types AS resource_type
    WHERE resource_type.tenant_id = tenant
      AND resource_type.canonical_name = canonical_definition->>'canonicalName'
    FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO keynes_internal.resource_types (
        tenant_id, resource_type_id, definition_command_id, canonical_name,
        unit, accounting_behavior, definition, definition_digest,
        definer_principal_id
      ) VALUES (
        tenant, command_id, command_id, canonical_definition->>'canonicalName',
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
    SET result = apply_define_resource_v0005.result,
        committed_at = clock_timestamp()
    WHERE stored.tenant_id = tenant
      AND stored.command_id = apply_define_resource_v0005.command_id;
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

CREATE FUNCTION keynes_internal.apply_create_budget_v0005(input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
<<apply_create_budget_v0005>>
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
        AND stored.command_id = apply_create_budget_v0005.command_id
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
    SET result = apply_create_budget_v0005.result,
        committed_at = clock_timestamp()
    WHERE stored.tenant_id = tenant
      AND stored.command_id = apply_create_budget_v0005.command_id;
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
  CASE operation_name
    WHEN 'defineResource' THEN
      RETURN keynes_internal.apply_define_resource_v0005(input);
    WHEN 'createBudget' THEN
      RETURN keynes_internal.apply_create_budget_v0005(input);
    ELSE
      RETURN keynes_internal.apply_command_v0004(operation_name, input);
  END CASE;
END;
$function$;

REVOKE ALL ON FUNCTION
  keynes_internal.canonical_resource_definition_v0005(text, jsonb, text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION
  keynes_internal.canonical_root_resources_v0005(text, jsonb, text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.apply_command_v0004(text, jsonb)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.apply_define_resource_v0005(jsonb)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.apply_create_budget_v0005(jsonb)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.apply_command(text, jsonb)
  FROM PUBLIC;
