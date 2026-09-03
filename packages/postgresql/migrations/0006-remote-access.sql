ALTER TABLE keynes_internal.installation_identity
  ADD COLUMN execution_role name NOT NULL,
  ADD COLUMN administration_role name NOT NULL,
  ADD COLUMN policy_profile_digest text NOT NULL
    CHECK (policy_profile_digest ~ '^[0-9a-f]{64}$'),
  ADD COLUMN remote_procedures_digest text NOT NULL
    CHECK (remote_procedures_digest ~ '^[0-9a-f]{64}$');

CREATE TABLE keynes_internal.remote_role_mappings (
  role_oid oid PRIMARY KEY,
  role_name name NOT NULL UNIQUE,
  tenant_id uuid NOT NULL,
  principal_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'enabled'
    CHECK (status IN ('enabled', 'disabled', 'revoked')),
  enabled boolean GENERATED ALWAYS AS (status = 'enabled') STORED,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE keynes_internal.remote_credential_audit (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_oid oid NOT NULL,
  role_name name NOT NULL,
  action text NOT NULL
    CHECK (action IN ('registered', 'disabled', 'enabled', 'revoked')),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor name NOT NULL
);

CREATE TABLE keynes_internal.remote_budget_references (
  tenant_id uuid NOT NULL,
  budget_id uuid NOT NULL,
  budget_reference text NOT NULL UNIQUE
    CHECK (budget_reference ~ '^kbr_v1_[A-Za-z0-9_-]{43}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, budget_id),
  FOREIGN KEY (tenant_id, budget_id)
    REFERENCES keynes_internal.budgets (tenant_id, budget_id)
);

CREATE TABLE keynes_internal.remote_operations (
  tenant_id uuid NOT NULL,
  operation_key text NOT NULL
    CHECK (operation_key ~ '^kop_v1_[A-Za-z0-9_-]{43}$'),
  command_id uuid NOT NULL,
  operation text NOT NULL
    CHECK (operation IN ('createBudget', 'requestBudget', 'settleBudget')),
  canonical_input jsonb NOT NULL CHECK (jsonb_typeof(canonical_input) = 'object'),
  input_digest text NOT NULL CHECK (input_digest ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'unresolved'
    CHECK (status IN ('unresolved', 'committed', 'known_failure')),
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT clock_timestamp() + interval '30 days',
  PRIMARY KEY (tenant_id, operation_key),
  UNIQUE (tenant_id, command_id),
  CHECK ((status = 'unresolved') = (response IS NULL)),
  CHECK ((status = 'unresolved') = (completed_at IS NULL))
);

CREATE TABLE keynes_internal.remote_history_cursors (
  cursor_value text PRIMARY KEY
    CHECK (cursor_value ~ '^khc_v1_[A-Za-z0-9_-]{43}$'),
  tenant_id uuid NOT NULL,
  stream_id uuid NOT NULL,
  next_sequence bigint NOT NULL CHECK (next_sequence > 0),
  terminal_sequence bigint NOT NULL CHECK (terminal_sequence >= next_sequence),
  expires_at timestamptz NOT NULL DEFAULT clock_timestamp() + interval '30 minutes',
  UNIQUE (tenant_id, stream_id, next_sequence, terminal_sequence),
  FOREIGN KEY (tenant_id, stream_id)
    REFERENCES keynes_internal.budget_history_streams (tenant_id, stream_id)
);

CREATE FUNCTION keynes_internal.remote_error_v0006(
  error_code text,
  operation_name text
) RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $function$
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
$function$;

CREATE FUNCTION keynes_internal.remote_token_v0006(
  token_prefix text,
  token_seed text
) RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = pg_catalog, keynes_internal
AS $function$
  SELECT token_prefix || translate(
    encode(
      sha256(convert_to(token_seed || ':' || gen_random_uuid()::text, 'UTF8')),
      'base64'
    ),
    '+/=',
    '-_'
  );
$function$;

CREATE FUNCTION keynes_internal.set_remote_identity_v0006()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
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
$function$;

CREATE FUNCTION keynes_internal.remote_budget_reference_v0006(
  selected_tenant uuid,
  selected_budget uuid
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
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
$function$;

CREATE FUNCTION keynes_internal.remote_budget_id_v0006(
  selected_tenant uuid,
  reference_value text,
  operation_name text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
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
$function$;

CREATE FUNCTION keynes_internal.remote_resource_id_v0006(
  selected_tenant uuid,
  resource_name text,
  operation_name text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
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
$function$;

CREATE FUNCTION keynes_internal.remote_named_amounts_v0006(
  selected_tenant uuid,
  selected_budget uuid,
  values_json jsonb,
  operation_name text,
  input_field text,
  allow_empty boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
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
$function$;

CREATE FUNCTION keynes_internal.remote_project_json_v0006(
  selected_tenant uuid,
  value_json jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
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
$function$;

CREATE FUNCTION keynes_internal.remote_safe_error_v0006(
  operation_name text,
  error_json jsonb
) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $function$
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
    'arithmetic_error',
    'invalid_policy',
    'invalid_policy_context',
    'policy_evaluation_failed'
  ) THEN
    RETURN jsonb_build_object(
      'kind', 'error', 'code', error_code, 'details', '{}'::jsonb
    );
  END IF;
  RETURN jsonb_build_object(
    'kind', 'error', 'code', 'unknown', 'details', '{}'::jsonb
  );
END;
$function$;

CREATE FUNCTION keynes_internal.remote_invalid_v0006(
  operation_name text,
  issue_path text,
  issue_rule text
) RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $function$
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
$function$;

CREATE FUNCTION keynes_internal.remote_operation_lock_key_v0006(
  selected_tenant uuid,
  operation_key_value text
) RETURNS bigint
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $function$
  SELECT hashtextextended(
    selected_tenant::text || ':' || operation_key_value,
    1262836045
  );
$function$;

CREATE FUNCTION keynes_internal.remote_validate_input_v0006(
  operation_name text,
  input jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
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
    allowed_keys := ARRAY['operationKey', 'resources', 'policies'];
    required_keys := ARRAY['operationKey', 'resources'];
  ELSIF operation_name = 'requestBudget' THEN
    allowed_keys := ARRAY[
      'operationKey', 'parentBudgetReference', 'resources', 'context',
      'childPolicies'
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
    array_value := input->'resources';
    IF jsonb_typeof(array_value) IS DISTINCT FROM 'array' THEN
      RETURN keynes_internal.remote_invalid_v0006(
        operation_name, '$.resources', 'type'
      );
    END IF;
    IF jsonb_array_length(array_value) = 0 THEN
      RETURN keynes_internal.remote_invalid_v0006(
        operation_name, '$.resources', 'minItems'
      );
    END IF;
    IF (SELECT count(*) <> count(DISTINCT value)
          FROM jsonb_array_elements(array_value) member(value)) THEN
      RETURN keynes_internal.remote_invalid_v0006(
        operation_name, '$.resources', 'uniqueItems'
      );
    END IF;
    BEGIN
      PERFORM keynes_internal.canonical_root_resources_v0005(
        operation_name, array_value, '$.resources'
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

  FOREACH input_field IN ARRAY ARRAY['policies', 'childPolicies'] LOOP
    IF input ? input_field THEN
      array_value := input->input_field;
      IF jsonb_typeof(array_value) IS DISTINCT FROM 'array' THEN
        RETURN keynes_internal.remote_invalid_v0006(
          operation_name, '$.' || input_field, 'type'
        );
      END IF;
      IF jsonb_array_length(array_value) > 16 THEN
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
      BEGIN
        PERFORM keynes_internal.validate_policy_set(array_value);
      EXCEPTION WHEN SQLSTATE 'K0001' THEN
        RETURN keynes_internal.remote_invalid_v0006(
          operation_name, '$.' || input_field, 'items'
        );
      END;
    END IF;
  END LOOP;

  IF input ? 'context' THEN
    field_value := input->'context';
    IF jsonb_typeof(field_value) IS DISTINCT FROM 'object' THEN
      RETURN keynes_internal.remote_invalid_v0006(
        operation_name, '$.context', 'type'
      );
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(field_value)) > 32 THEN
      RETURN keynes_internal.remote_invalid_v0006(
        operation_name, '$.context', 'maxProperties'
      );
    END IF;
    IF octet_length(convert_to(
      keynes_internal.policy_canonical_json(field_value), 'UTF8'
    )) > 8192 THEN
      RETURN keynes_internal.remote_invalid_v0006(
        operation_name, '$.context', 'maxCanonicalUtf8Bytes'
      );
    END IF;
    FOR field_name, item IN SELECT key, value FROM jsonb_each(field_value)
    LOOP
      IF field_name !~ '^[a-z][a-z0-9_]{0,62}$' THEN
        RETURN keynes_internal.remote_invalid_v0006(
          operation_name, '$.context', 'propertyNames'
        );
      END IF;
      IF jsonb_typeof(item) = 'string'
        AND octet_length(convert_to(item #>> '{}', 'UTF8')) > 256 THEN
        RETURN keynes_internal.remote_invalid_v0006(
          operation_name, '$.context.' || field_name, 'maxLength'
        );
      ELSIF jsonb_typeof(item) = 'number' AND (
        (item #>> '{}')::numeric <> trunc((item #>> '{}')::numeric)
        OR (item #>> '{}')::numeric < 0
        OR (item #>> '{}')::numeric > 9007199254740991
      ) THEN
        RETURN keynes_internal.remote_invalid_v0006(
          operation_name, '$.context.' || field_name, 'range'
        );
      ELSIF jsonb_typeof(item) NOT IN ('string', 'number', 'boolean', 'null') THEN
        RETURN keynes_internal.remote_invalid_v0006(
          operation_name, '$.context.' || field_name, 'type'
        );
      END IF;
    END LOOP;
  END IF;

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
        PERFORM keynes_internal.canonical_resource_definition_v0005(
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
$function$;

CREATE FUNCTION keynes_internal.remote_apply_command_v0006(
  operation_name text,
  input jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
<<remote_apply_command_v0006>>
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
    IF operation_name = 'createBudget' THEN
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
  UPDATE keynes_internal.remote_operations stored
     SET status = 'known_failure', response = response_value,
         completed_at = clock_timestamp()
   WHERE stored.tenant_id = tenant
     AND stored.operation_key = operation_key_value;
  RETURN jsonb_build_object('ok', false, 'error', response_value);
END;
$function$;

CREATE FUNCTION keynes_internal.remote_get_budget_v0006(input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
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
$function$;

CREATE FUNCTION keynes_internal.remote_get_budget_history_page_v0006(
  input jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
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
$function$;

CREATE FUNCTION keynes_internal.remote_open_budget_v0006(input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
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
$function$;

CREATE FUNCTION keynes_internal.remote_recover_operation_v0006(input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
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
$function$;

CREATE FUNCTION keynes_internal.remote_get_compatibility_v0006(input jsonb)
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
      'semanticGeneration', 1,
      'minimumSdkGeneration', 1,
      'procedures', '[{"name":"createBudget","target":"keynes.remote_create_budget","revision":1},{"name":"requestBudget","target":"keynes.remote_request","revision":1},{"name":"settleBudget","target":"keynes.remote_settle","revision":1},{"name":"getBudget","target":"keynes.remote_get_budget","revision":1},{"name":"getBudgetHistoryPage","target":"keynes.remote_get_budget_history_page","revision":1},{"name":"openBudget","target":"keynes.remote_open_budget","revision":1},{"name":"recoverOperation","target":"keynes.remote_recover_operation","revision":1},{"name":"getCompatibility","target":"keynes.remote_get_compatibility","revision":1}]'::jsonb
    )
  );
END;
$function$;

CREATE FUNCTION keynes_internal.remote_login_oid_v0006(login_role name)
RETURNS oid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
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
$function$;

CREATE FUNCTION keynes_internal.register_remote_role_v0006(
  login_role name,
  mapped_tenant uuid,
  mapped_principal uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
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
$function$;

CREATE FUNCTION keynes_internal.rotate_remote_role_v0006(
  old_login_role name,
  new_login_role name
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
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
$function$;

CREATE FUNCTION keynes_internal.set_remote_role_enabled_v0006(
  login_role name,
  next_enabled boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
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
$function$;

CREATE FUNCTION keynes_internal.revoke_remote_role_v0006(login_role name)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
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
$function$;

CREATE FUNCTION keynes_internal.inspect_remote_role_v0006(login_role name)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
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
$function$;

CREATE FUNCTION keynes_internal.audit_remote_role_v0006(
  login_role name,
  entry_limit integer
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
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
$function$;

CREATE FUNCTION keynes_internal.remote_dispatch_v0006(
  operation_name text,
  input jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
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
        RETURN keynes_internal.remote_apply_command_v0006(
          operation_name, input
        );
      WHEN 'requestBudget' THEN
        RETURN keynes_internal.remote_apply_command_v0006(
          operation_name, input
        );
      WHEN 'settleBudget' THEN
        RETURN keynes_internal.remote_apply_command_v0006(
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
        RETURN keynes_internal.remote_get_compatibility_v0006(input);
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
$function$;

CREATE FUNCTION keynes.remote_create_budget(input jsonb) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
  SELECT keynes_internal.remote_dispatch_v0006('createBudget', input);
$function$;

CREATE FUNCTION keynes.remote_request(input jsonb) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
  SELECT keynes_internal.remote_dispatch_v0006('requestBudget', input);
$function$;

CREATE FUNCTION keynes.remote_settle(input jsonb) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
  SELECT keynes_internal.remote_dispatch_v0006('settleBudget', input);
$function$;

CREATE FUNCTION keynes.remote_get_budget(input jsonb) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
  SELECT keynes_internal.remote_dispatch_v0006('getBudget', input);
$function$;

CREATE FUNCTION keynes.remote_get_budget_history_page(input jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
  SELECT keynes_internal.remote_dispatch_v0006(
    'getBudgetHistoryPage', input
  );
$function$;

CREATE FUNCTION keynes.remote_open_budget(input jsonb) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
  SELECT keynes_internal.remote_dispatch_v0006('openBudget', input);
$function$;

CREATE FUNCTION keynes.remote_recover_operation(input jsonb) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
  SELECT keynes_internal.remote_dispatch_v0006('recoverOperation', input);
$function$;

CREATE FUNCTION keynes.remote_get_compatibility(input jsonb) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
  SELECT keynes_internal.remote_dispatch_v0006('getCompatibility', input);
$function$;

REVOKE ALL ON TABLE keynes_internal.remote_role_mappings,
  keynes_internal.remote_credential_audit,
  keynes_internal.remote_budget_references,
  keynes_internal.remote_operations,
  keynes_internal.remote_history_cursors FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA keynes_internal FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes.remote_create_budget(jsonb),
  keynes.remote_request(jsonb),
  keynes.remote_settle(jsonb),
  keynes.remote_get_budget(jsonb),
  keynes.remote_get_budget_history_page(jsonb),
  keynes.remote_open_budget(jsonb),
  keynes.remote_recover_operation(jsonb),
  keynes.remote_get_compatibility(jsonb) FROM PUBLIC;
