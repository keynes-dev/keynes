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

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA keynes_internal FROM PUBLIC;
