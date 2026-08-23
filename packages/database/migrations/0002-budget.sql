CREATE FUNCTION keynes_internal.raise_domain_error(
  error_code text,
  error_details jsonb
) RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = 'K0001',
    MESSAGE = jsonb_build_object(
      'kind', 'error',
      'code', error_code,
      'details', error_details
    )::text;
END;
$function$;

CREATE FUNCTION keynes_internal.checkpoint(checkpoint_name text)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  IF current_setting('keynes.test_checkpoint', true) = checkpoint_name THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = format('private rollback checkpoint: %s', checkpoint_name);
  END IF;
END;
$function$;

CREATE FUNCTION keynes_internal.invalid_command(
  operation_name text,
  issue_path text,
  issue_rule text
) RETURNS void
LANGUAGE sql
AS $function$
  SELECT keynes_internal.raise_domain_error(
    'invalid_command',
    jsonb_build_object(
      'operation', operation_name,
      'issues', jsonb_build_array(
        jsonb_build_object('path', issue_path, 'rule', issue_rule)
      )
    )
  );
$function$;

CREATE FUNCTION keynes_internal.apply_publish_command(
  input jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal
AS $function$
DECLARE
  operation_name constant text := 'publishResource';
  required_permission constant text := 'publish_resource';
  tenant_text text;
  principal_text text;
  tenant uuid;
  principal uuid;
  command_text text;
  command_uuid uuid;
  canonical_definition jsonb;
  canonical_body jsonb;
  body_digest_value text;
  definition_digest_value text;
  stored_command keynes_internal.commands%ROWTYPE;
  stored_resource keynes_internal.resource_types%ROWTYPE;
  canonical_result jsonb;
  result_digest_value text;
  domain_error_message text;
BEGIN
  BEGIN
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

    command_text := input->>'commandId';
    IF command_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      PERFORM keynes_internal.invalid_command(operation_name, '$.commandId', 'format');
    END IF;
    command_uuid := command_text::uuid;

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
        operation_name,
        '$.definition',
        'additionalProperties'
      );
    END IF;

    IF jsonb_typeof(input->'definition'->'canonicalName') <> 'string'
      OR (input->'definition'->>'canonicalName') !~ '^[a-z][a-z0-9_]{0,62}$' THEN
      PERFORM keynes_internal.invalid_command(
        operation_name,
        '$.definition.canonicalName',
        'pattern'
      );
    END IF;

    IF jsonb_typeof(input->'definition'->'unit') <> 'string'
      OR char_length(input->'definition'->>'unit') NOT BETWEEN 1 AND 64
      OR input->'definition'->>'unit' <> btrim(input->'definition'->>'unit')
      OR input->'definition'->>'unit' ~ '[[:cntrl:]]' THEN
      PERFORM keynes_internal.invalid_command(
        operation_name,
        '$.definition.unit',
        'format'
      );
    END IF;

    IF jsonb_typeof(input->'definition'->'accountingBehavior') <> 'string'
      OR input->'definition'->>'accountingBehavior' NOT IN ('consumable', 'reusable') THEN
      PERFORM keynes_internal.invalid_command(
        operation_name,
        '$.definition.accountingBehavior',
        'enum'
      );
    END IF;

    tenant_text := current_setting('keynes.tenant_id', true);
    principal_text := current_setting('keynes.principal_id', true);

    IF tenant_text IS NULL
      OR tenant_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR principal_text IS NULL
      OR principal_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      PERFORM keynes_internal.raise_domain_error(
        'unauthorized',
        jsonb_build_object(
          'operation', operation_name,
          'requiredPermission', required_permission
        )
      );
    END IF;

    tenant := tenant_text::uuid;
    principal := principal_text::uuid;

    IF NOT EXISTS (
      SELECT 1
      FROM keynes_internal.principal_permissions AS permission
      WHERE permission.tenant_id = tenant
        AND permission.principal_id = principal
        AND permission.permission = required_permission
    ) THEN
      PERFORM keynes_internal.raise_domain_error(
        'unauthorized',
        jsonb_build_object(
          'operation', operation_name,
          'requiredPermission', required_permission
        )
      );
    END IF;

    canonical_definition := jsonb_build_object(
      'canonicalName', input->'definition'->>'canonicalName',
      'unit', input->'definition'->>'unit',
      'accountingBehavior', input->'definition'->>'accountingBehavior'
    );
    canonical_body := jsonb_build_object('definition', canonical_definition);
    body_digest_value := 'command-body:' || encode(
      sha256(convert_to(canonical_body::text, 'UTF8')),
      'hex'
    );

    SELECT *
    INTO stored_command
    FROM keynes_internal.commands AS command
    WHERE command.tenant_id = tenant
      AND command.command_id = command_uuid
    FOR UPDATE;

    IF FOUND THEN
      IF stored_command.operation <> operation_name
        OR stored_command.target_kind <> 'resource_type'
        OR stored_command.target_id <> command_uuid
        OR stored_command.body_digest <> body_digest_value
        OR stored_command.canonical_body <> canonical_body THEN
        PERFORM keynes_internal.raise_domain_error(
          'command_conflict',
          jsonb_build_object(
            'commandId', command_text,
            'existingOperation', stored_command.operation,
            'attemptedOperation', operation_name
          )
        );
      END IF;

      RETURN jsonb_build_object(
        'ok', true,
        'result', stored_command.result,
        'replayed', true
      );
    END IF;

    INSERT INTO keynes_internal.commands (
      tenant_id,
      command_id,
      operation,
      target_kind,
      target_id,
      canonical_body,
      body_digest,
      principal_id
    ) VALUES (
      tenant,
      command_uuid,
      operation_name,
      'resource_type',
      command_uuid,
      canonical_body,
      body_digest_value,
      principal
    );

    PERFORM keynes_internal.checkpoint('after_command_binding');

    definition_digest_value := 'resource-definition:' || encode(
      sha256(convert_to(canonical_definition::text, 'UTF8')),
      'hex'
    );

    SELECT *
    INTO stored_resource
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
        tenant_id,
        resource_type_id,
        canonical_name,
        unit,
        accounting_behavior,
        definition,
        definition_digest,
        publisher_principal_id,
        publication_command_id
      ) VALUES (
        tenant,
        command_uuid,
        canonical_definition->>'canonicalName',
        canonical_definition->>'unit',
        canonical_definition->>'accountingBehavior',
        canonical_definition,
        definition_digest_value,
        principal,
        command_uuid
      )
      RETURNING * INTO stored_resource;
    END IF;

    PERFORM keynes_internal.checkpoint('after_domain_mutation');

    canonical_result := jsonb_build_object(
      'kind', 'published',
      'resourceType', jsonb_build_object(
        'resourceTypeId', stored_resource.resource_type_id::text,
        'canonicalName', stored_resource.canonical_name,
        'unit', stored_resource.unit,
        'accountingBehavior', stored_resource.accounting_behavior,
        'definitionDigest', stored_resource.definition_digest
      ),
      'publicationEvidence', jsonb_build_object(
        'kind', 'resource_type_published',
        'commandId', stored_resource.publication_command_id::text,
        'principalId', stored_resource.publisher_principal_id::text,
        'definitionDigest', stored_resource.definition_digest
      )
    );
    result_digest_value := 'command-result:' || encode(
      sha256(convert_to(canonical_result::text, 'UTF8')),
      'hex'
    );

    UPDATE keynes_internal.commands AS command
    SET result = canonical_result,
        result_digest = result_digest_value,
        committed_at = clock_timestamp()
    WHERE command.tenant_id = tenant
      AND command.command_id = command_uuid;

    PERFORM keynes_internal.checkpoint('after_result_storage');

    RETURN jsonb_build_object(
      'ok', true,
      'result', canonical_result,
      'replayed', false
    );
  EXCEPTION
    WHEN SQLSTATE 'K0001' THEN
      GET STACKED DIAGNOSTICS domain_error_message = MESSAGE_TEXT;
      RETURN jsonb_build_object(
        'ok', false,
        'error', domain_error_message::jsonb
      );
  END;
END;
$function$;

REVOKE ALL ON FUNCTION keynes_internal.raise_domain_error(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.invalid_command(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.checkpoint(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.apply_publish_command(jsonb) FROM PUBLIC;

CREATE FUNCTION keynes_internal.canonical_envelope(
  operation_name text,
  value jsonb,
  issue_path text,
  allow_null boolean
) RETURNS jsonb
LANGUAGE plpgsql
AS $function$
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
$function$;

CREATE FUNCTION keynes_internal.event_uuid(seed text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT (
    substr(hash, 1, 8) || '-' || substr(hash, 9, 4) || '-' ||
    substr(hash, 13, 4) || '-' || substr(hash, 17, 4) || '-' ||
    substr(hash, 21, 12)
  )::uuid
  FROM (SELECT encode(sha256(convert_to(seed, 'UTF8')), 'hex') AS hash) AS value;
$function$;

CREATE FUNCTION keynes_internal.budget_is_settled(
  selected_tenant uuid,
  selected_budget uuid
) RETURNS boolean
LANGUAGE sql
STABLE
AS $function$
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
$function$;

CREATE FUNCTION keynes_internal.subtree_observed(
  selected_tenant uuid,
  selected_budget uuid,
  selected_resource uuid
) RETURNS numeric
LANGUAGE sql
STABLE
AS $function$
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
$function$;

CREATE FUNCTION keynes_internal.assert_safe_accounting(
  selected_tenant uuid,
  changed_budget uuid,
  operation_name text
) RETURNS void
LANGUAGE plpgsql
AS $function$
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
$function$;

CREATE FUNCTION keynes_internal.budget_projection(
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
    ORDER BY holding.resource_type_id
  LOOP
    SELECT coalesce(sum(CASE
      WHEN keynes_internal.budget_is_settled(selected_tenant, child.budget_id)
        AND fact.accounting_behavior = 'reusable' THEN 0
      WHEN keynes_internal.budget_is_settled(selected_tenant, child.budget_id)
        THEN least(
          child_fact.allocated_amount,
          keynes_internal.subtree_observed(
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

CREATE FUNCTION keynes_internal.append_history(
  selected_tenant uuid,
  selected_stream uuid,
  selected_command uuid,
  selected_kind text,
  selected_subject uuid,
  details jsonb
) RETURNS void
LANGUAGE plpgsql
AS $function$
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
$function$;

CREATE FUNCTION keynes_internal.apply_command(operation_name text, input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal
AS $function$
<<apply_command>>
DECLARE
  permission_name text;
  tenant uuid;
  principal uuid;
  command_id uuid;
  parent_id uuid;
  target_id uuid;
  items jsonb;
  body jsonb;
  body_digest_value text;
  result_digest_value text;
  prior keynes_internal.commands%ROWTYPE;
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
  IF operation_name = 'publishResource' THEN
    RETURN keynes_internal.apply_publish_command(input);
  END IF;
  permission_name := CASE operation_name
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
    IF input IS NULL OR jsonb_typeof(input) <> 'object' OR NOT (input ? 'commandId')
      OR jsonb_typeof(input->'commandId') <> 'string'
      OR input->>'commandId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      PERFORM keynes_internal.invalid_command(operation_name, '$.commandId', 'format');
    END IF;
    command_id := (input->>'commandId')::uuid;
    CASE operation_name
      WHEN 'createBudget' THEN
        IF NOT (input ? 'resources')
          OR input - ARRAY['commandId', 'resources']::text[] <> '{}'::jsonb THEN
          PERFORM keynes_internal.invalid_command(operation_name, '$', 'properties');
        END IF;
        items := keynes_internal.canonical_envelope(
          operation_name, input->'resources', '$.resources', false
        );
        body := jsonb_build_object('resources', items);
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
    SELECT * INTO prior FROM keynes_internal.commands AS stored
    WHERE stored.tenant_id = tenant
      AND stored.command_id = apply_command.command_id FOR UPDATE;
    IF FOUND THEN
      IF prior.operation <> operation_name OR prior.target_kind <> 'budget'
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
    INSERT INTO keynes_internal.commands (
      tenant_id, command_id, operation, target_kind, target_id,
      canonical_body, body_digest, principal_id
    ) VALUES (
      tenant, command_id, operation_name, 'budget', target_id,
      body, body_digest_value, principal
    );
    PERFORM keynes_internal.checkpoint('after_command_binding');

    IF operation_name = 'createBudget' THEN
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
        depth, lifecycle, created_command_id
      ) VALUES (tenant, command_id, NULL, command_id, 0, 'active', command_id);
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
          depth, lifecycle, created_command_id
        ) VALUES (
          tenant, command_id, parent_id, budget.root_budget_id,
          budget.depth + 1, 'active', command_id
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
    result_digest_value := 'command-result:' || encode(
      sha256(convert_to(result::text, 'UTF8')), 'hex'
    );
    UPDATE keynes_internal.commands AS stored SET result = apply_command.result,
      result_digest = result_digest_value, committed_at = clock_timestamp()
    WHERE stored.tenant_id = tenant
      AND stored.command_id = apply_command.command_id;
    PERFORM keynes_internal.checkpoint('after_result_storage');
    RETURN jsonb_build_object('ok', true, 'result', result, 'replayed', false);
  EXCEPTION WHEN SQLSTATE 'K0001' THEN
    GET STACKED DIAGNOSTICS domain_error_message = MESSAGE_TEXT;
    RETURN jsonb_build_object('ok', false, 'error', domain_error_message::jsonb);
  END;
END;
$function$;

CREATE FUNCTION keynes_internal.get_budget(input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal
AS $function$
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
$function$;

REVOKE ALL ON FUNCTION keynes_internal.canonical_envelope(text, jsonb, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.event_uuid(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.budget_is_settled(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.subtree_observed(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.assert_safe_accounting(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.budget_projection(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.append_history(uuid, uuid, uuid, text, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.apply_command(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.get_budget(jsonb) FROM PUBLIC;
