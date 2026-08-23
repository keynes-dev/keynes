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

CREATE FUNCTION keynes_internal.apply_command(
  operation_name text,
  input jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal
AS $function$
DECLARE
  required_permission text;
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
  required_permission := CASE operation_name
    WHEN 'publishResource' THEN 'publish_resource'
    WHEN 'createBudget' THEN 'create_root_budget'
    WHEN 'requestBudget' THEN 'request_budget'
    WHEN 'settleBudget' THEN 'settle_budget'
    ELSE NULL
  END;

  IF required_permission IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '0A000',
      MESSAGE = format('operation %L is not implemented', operation_name);
  END IF;

  IF operation_name <> 'publishResource' THEN
    RAISE EXCEPTION USING
      ERRCODE = '0A000',
      MESSAGE = format('operation %L is not implemented', operation_name);
  END IF;

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
REVOKE ALL ON FUNCTION keynes_internal.apply_command(text, jsonb) FROM PUBLIC;

CREATE FUNCTION keynes_internal.get_budget(input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal
AS $function$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '0A000',
    MESSAGE = 'operation ''getBudget'' is not implemented';
END;
$function$;

REVOKE ALL ON FUNCTION keynes_internal.get_budget(jsonb) FROM PUBLIC;
