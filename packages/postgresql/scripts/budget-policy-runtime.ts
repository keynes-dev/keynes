import type { ContractSource, LoadedPolicyProfile } from "@keynes/contracts";

import { renderSecurePublicFunctions } from "./secure-public-functions.ts";
import { sqlLiteral } from "./sql-literal.ts";

export function renderPolicyRuntime(
  profile: LoadedPolicyProfile,
  legacyBudgetSql: string,
  contract: ContractSource,
): string {
  if (
    !legacyBudgetSql.includes(
      "CREATE FUNCTION keynes_internal.apply_command(operation_name text, input jsonb)",
    )
  ) {
    throw new Error("immutable 0002 apply_command anchor is missing");
  }
  const legacyApplyMatch = legacyBudgetSql.match(
    /CREATE FUNCTION keynes_internal\.apply_command\(operation_name text, input jsonb\)[\s\S]*?\$function\$;/u,
  );
  if (legacyApplyMatch === null) {
    throw new Error("immutable 0002 apply_command definition is missing");
  }
  const legacyApply = legacyApplyMatch[0]
    .replace(
      "CREATE FUNCTION keynes_internal.apply_command(operation_name text, input jsonb)",
      "CREATE FUNCTION keynes_internal.apply_command_legacy(operation_name text, input jsonb)",
    )
    .replace(
      "SET search_path = pg_catalog, keynes_internal",
      "SET search_path = pg_catalog, keynes_internal, pg_temp",
    );
  const legacyGetMatch = legacyBudgetSql.match(
    /CREATE FUNCTION keynes_internal\.get_budget\(input jsonb\)[\s\S]*?\$function\$;/u,
  );
  if (legacyGetMatch === null) {
    throw new Error("immutable 0002 get_budget definition is missing");
  }
  const secureGet = legacyGetMatch[0]
    .replace(
      "CREATE FUNCTION keynes_internal.get_budget(input jsonb)",
      "CREATE OR REPLACE FUNCTION keynes_internal.get_budget(input jsonb)",
    )
    .replace(
      "SET search_path = pg_catalog, keynes_internal",
      "SET search_path = pg_catalog, keynes_internal, pg_temp",
    );
  const securePublic = renderSecurePublicFunctions(contract);
  const versions = profile.source.versions;
  const limits = profile.source.limits;
  return `ALTER TABLE keynes_internal.budgets
  ADD COLUMN policies jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD CONSTRAINT budget_policies_shape CHECK (
    jsonb_typeof(policies) = 'array' AND jsonb_array_length(policies) <= ${limits.policiesPerBudget}
  );

${legacyApply}

${secureGet}

CREATE OR REPLACE FUNCTION keynes_internal.policy_canonical_json(value jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT CASE jsonb_typeof(value)
    WHEN 'object' THEN '{' || coalesce((
      SELECT string_agg(to_jsonb(member.key)::text || ':' || keynes_internal.policy_canonical_json(member.member_value), ',' ORDER BY member.key COLLATE "C")
      FROM jsonb_each(value) AS member(key, member_value)
    ), '') || '}'
    WHEN 'array' THEN '[' || coalesce((
      SELECT string_agg(keynes_internal.policy_canonical_json(member.member_value), ',' ORDER BY member.ordinality)
      FROM jsonb_array_elements(value) WITH ORDINALITY AS member(member_value, ordinality)
    ), '') || ']'
    ELSE value::text
  END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.canonical_policy_set(policies jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  policy jsonb;
  normalized jsonb;
  result jsonb := '[]'::jsonb;
BEGIN
  IF jsonb_typeof(policies) IS DISTINCT FROM 'array' THEN
    RETURN policies;
  END IF;
  FOR policy IN SELECT value FROM jsonb_array_elements(policies) LOOP
    normalized := policy;
    IF jsonb_typeof(policy) = 'object'
      AND jsonb_typeof(policy->'inputResources') = 'array'
      AND jsonb_typeof(policy->'outputResources') = 'array'
      AND jsonb_typeof(policy->'contextSchema') = 'array'
      AND jsonb_typeof(policy->'reasons') = 'array' THEN
      normalized := normalized || jsonb_build_object(
        'inputResources', (SELECT coalesce(jsonb_agg(member.value ORDER BY member.value COLLATE "C"), '[]'::jsonb) FROM jsonb_array_elements_text(policy->'inputResources') AS member(value)),
        'outputResources', (SELECT coalesce(jsonb_agg(member.value ORDER BY member.value COLLATE "C"), '[]'::jsonb) FROM jsonb_array_elements_text(policy->'outputResources') AS member(value)),
        'contextSchema', (SELECT coalesce(jsonb_agg(member.value ORDER BY (member.value->>'name') COLLATE "C"), '[]'::jsonb) FROM jsonb_array_elements(policy->'contextSchema') AS member(value)),
        'reasons', (SELECT coalesce(jsonb_agg(member.value ORDER BY member.value COLLATE "C"), '[]'::jsonb) FROM jsonb_array_elements_text(policy->'reasons') AS member(value))
      );
      IF normalized ? 'definitionDigest' THEN
        normalized := jsonb_set(
          normalized,
          '{definitionDigest}',
          to_jsonb(encode(sha256(convert_to(keynes_internal.policy_canonical_json(normalized - 'definitionDigest'), 'UTF8')), 'hex'))
        );
      END IF;
    END IF;
    result := result || jsonb_build_array(normalized);
  END LOOP;
  RETURN coalesce((
    SELECT jsonb_agg(member.value ORDER BY
      (member.value->>'name') COLLATE "C",
      CASE WHEN jsonb_typeof(member.value->'revision') = 'number' AND member.value->>'revision' ~ '^[0-9]+$' THEN (member.value->>'revision')::numeric END,
      (member.value->>'definitionDigest') COLLATE "C"
    )
    FROM jsonb_array_elements(result) AS member(value)
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.validate_policy_set(policies jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  policy jsonb;
  first_context jsonb;
  seen_names text[] := ARRAY[]::text[];
  source_bytes integer := 0;
  ordinal integer := 0;
BEGIN
  IF jsonb_typeof(policies) IS DISTINCT FROM 'array'
    OR jsonb_array_length(policies) > ${limits.policiesPerBudget} THEN
    PERFORM keynes_internal.invalid_policy('$.policies', 'type_or_limit');
  END IF;
  FOR policy IN SELECT value FROM jsonb_array_elements(policies) LOOP
    ordinal := ordinal + 1;
    PERFORM set_config('keynes.policy_name', coalesce(policy->>'name', ''), true);
    PERFORM set_config('keynes.policy_revision', coalesce(policy->>'revision', ''), true);
    PERFORM keynes_internal.policy_assert_exact_keys(
      policy,
      ARRAY['kind','name','revision','inputResources','outputResources','contextSchema','reasons','programVersion','queryProfileVersion','validatorVersion','limitsVersion','policyProfileDigest','program','canonicalSql','sourceDigest','definitionDigest'],
      '$.policies[' || (ordinal - 1)::text || ']'
    );
    IF jsonb_typeof(policy->'revision') IS DISTINCT FROM 'number'
      OR (policy->>'revision') !~ '^[0-9]+$' THEN
      PERFORM keynes_internal.invalid_policy('$.policies[' || (ordinal - 1)::text || '].revision', 'artifact');
    END IF;
    IF (policy->>'revision')::numeric NOT BETWEEN 1 AND ${profile.source.numeric.maximumSafeInteger} THEN
      PERFORM keynes_internal.invalid_policy('$.policies[' || (ordinal - 1)::text || '].revision', 'artifact');
    END IF;
    IF policy->>'kind' IS DISTINCT FROM 'keynes.policy'
      OR jsonb_typeof(policy->'name') IS DISTINCT FROM 'string'
      OR policy->>'name' !~ '^[a-z][a-z0-9_]{0,62}$'
      OR policy->>'programVersion' IS DISTINCT FROM ${sqlLiteral(versions.program)}
      OR policy->>'queryProfileVersion' IS DISTINCT FROM ${sqlLiteral(versions.query)}
      OR policy->>'validatorVersion' IS DISTINCT FROM ${sqlLiteral(versions.validator)}
      OR policy->>'limitsVersion' IS DISTINCT FROM ${sqlLiteral(versions.limits)}
      OR policy->>'policyProfileDigest' IS DISTINCT FROM ${sqlLiteral(profile.digest)}
      OR policy->>'sourceDigest' IS DISTINCT FROM encode(sha256(convert_to(policy->>'canonicalSql', 'UTF8')), 'hex')
      OR policy->>'definitionDigest' IS DISTINCT FROM encode(sha256(convert_to(keynes_internal.policy_canonical_json(policy - 'definitionDigest'), 'UTF8')), 'hex')
      OR jsonb_typeof(policy->'inputResources') IS DISTINCT FROM 'array'
      OR jsonb_array_length(policy->'inputResources') NOT BETWEEN 1 AND ${limits.inputResourcesPerPolicy}
      OR jsonb_typeof(policy->'outputResources') IS DISTINCT FROM 'array'
      OR jsonb_array_length(policy->'outputResources') NOT BETWEEN 1 AND ${limits.outputResourcesPerPolicy}
      OR jsonb_typeof(policy->'contextSchema') IS DISTINCT FROM 'array'
      OR jsonb_array_length(policy->'contextSchema') > ${limits.contextFields}
      OR jsonb_typeof(policy->'reasons') IS DISTINCT FROM 'array'
      OR jsonb_array_length(policy->'reasons') NOT BETWEEN 1 AND ${limits.resultRows}
      OR jsonb_typeof(policy->'canonicalSql') IS DISTINCT FROM 'string'
      OR octet_length(convert_to(policy->>'canonicalSql', 'UTF8')) > ${limits.sourceBytesPerPolicy} THEN
      PERFORM keynes_internal.invalid_policy('$.policies[' || (ordinal - 1)::text || ']', 'artifact');
    END IF;
    IF policy->>'name' = ANY(seen_names) THEN
      PERFORM keynes_internal.invalid_policy('$.policies', 'duplicate_name');
    END IF;
    seen_names := array_append(seen_names, policy->>'name');
    source_bytes := source_bytes + octet_length(convert_to(policy->>'canonicalSql', 'UTF8'));
    IF source_bytes > ${limits.sourceBytesPerPolicySet} THEN
      PERFORM keynes_internal.invalid_policy('$.policies', 'limit');
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(policy->'inputResources') WITH ORDINALITY item(value, n)
      WHERE value !~ '^[a-z][a-z0-9_]{0,62}$'
         OR (n > 1 AND value COLLATE "C" <= (policy->'inputResources'->>((n - 2)::integer)) COLLATE "C")
    ) OR EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(policy->'outputResources') WITH ORDINALITY item(value, n)
      WHERE value !~ '^[a-z][a-z0-9_]{0,62}$'
         OR (n > 1 AND value COLLATE "C" <= (policy->'outputResources'->>((n - 2)::integer)) COLLATE "C")
    ) OR EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(policy->'reasons') WITH ORDINALITY item(value, n)
      WHERE value !~ '^[a-z][a-z0-9_]{0,62}$'
         OR octet_length(convert_to(value, 'UTF8')) > ${profile.source.text.maximumUtf8Bytes}
         OR (n > 1 AND value COLLATE "C" <= (policy->'reasons'->>((n - 2)::integer)) COLLATE "C")
    ) THEN
      PERFORM keynes_internal.invalid_policy('$.policies[' || (ordinal - 1)::text || ']', 'canonical_order');
    END IF;
    IF EXISTS (
      SELECT 1
        FROM jsonb_array_elements_text(policy->'outputResources') item(value)
       WHERE NOT (policy->'inputResources' ? value)
    ) THEN
      PERFORM keynes_internal.invalid_policy('$.policies', 'not_input_resource');
    END IF;
    PERFORM keynes_internal.validate_policy_program(policy->'program');
    IF policy->>'canonicalSql' IS DISTINCT FROM keynes_internal.canonical_policy_sql(policy->'program') THEN
      PERFORM keynes_internal.invalid_policy('$.policies[' || (ordinal - 1)::text || '].canonicalSql', 'canonicalSql');
    END IF;
    IF EXISTS (
      SELECT 1
        FROM jsonb_array_elements(policy->'contextSchema') WITH ORDINALITY AS member(value, n)
       WHERE CASE
         WHEN jsonb_typeof(value) IS DISTINCT FROM 'object' THEN true
         ELSE value - ARRAY['name','type','nullable']::text[] <> '{}'::jsonb
           OR NOT (value ?& ARRAY['name','type','nullable']::text[])
           OR jsonb_typeof(value->'name') IS DISTINCT FROM 'string'
           OR value->>'name' !~ '^[a-z][a-z0-9_]{0,62}$'
           OR jsonb_typeof(value->'type') IS DISTINCT FROM 'string'
           OR value->>'type' NOT IN ('integer','text','boolean')
           OR jsonb_typeof(value->'nullable') IS DISTINCT FROM 'boolean'
           OR (n > 1 AND (value->>'name') COLLATE "C" <= ((policy->'contextSchema'->((n - 2)::integer))->>'name') COLLATE "C")
       END
    ) THEN
      PERFORM keynes_internal.invalid_policy('$.policies[' || (ordinal - 1)::text || '].contextSchema', 'artifact');
    END IF;
    IF EXISTS (
      SELECT 1
        FROM jsonb_path_query(policy->'program', '$.** ? (@.kind == "reference")') reference(value)
       WHERE (
         value->>'source' IN ('requested','available')
         AND NOT (
           (value->>'field' = 'resource' AND value->>'valueType' = 'text' AND value->'nullable' = 'false'::jsonb)
           OR (value->>'field' = 'amount' AND value->>'valueType' = 'numeric' AND value->'nullable' = 'false'::jsonb)
         )
       ) OR (
         value->>'source' = 'context'
         AND NOT EXISTS (
           SELECT 1
             FROM jsonb_array_elements(policy->'contextSchema') field(member)
            WHERE member->>'name' = value->>'field'
              AND CASE member->>'type' WHEN 'integer' THEN 'numeric' ELSE member->>'type' END = value->>'valueType'
              AND member->'nullable' = value->'nullable'
         )
       )
    ) THEN
      PERFORM keynes_internal.invalid_policy('$.policies', 'reference_scope');
    END IF;
    IF keynes_internal.policy_work_bound(
      policy->'program', ${limits.requestedRows}, ${limits.availabilityRowsPerPolicy}
    ) > ${limits.operationsPerPolicy} THEN
      PERFORM keynes_internal.invalid_policy('$.policies[' || (ordinal - 1)::text || '].program', 'work_limit');
    END IF;
    IF first_context IS NULL THEN
      first_context := policy->'contextSchema';
    ELSIF first_context IS DISTINCT FROM policy->'contextSchema' THEN
      PERFORM keynes_internal.invalid_policy('$.policies', 'shared_context_schema');
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.validate_policy_context(policies jsonb, context jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  schema jsonb := policies->0->'contextSchema';
  field jsonb;
  value jsonb;
BEGIN
  IF jsonb_array_length(policies) = 0 THEN
    IF context IS NOT NULL THEN
      PERFORM keynes_internal.raise_domain_error('invalid_policy_context', jsonb_build_object('operation', 'requestBudget', 'path', '$.context', 'rule', 'additionalProperties'));
    END IF;
    RETURN;
  END IF;
  IF context IS NULL THEN
    PERFORM keynes_internal.raise_domain_error('invalid_policy_context', jsonb_build_object('operation', 'requestBudget', 'path', '$.context', 'rule', 'required'));
  END IF;
  IF jsonb_typeof(context) IS DISTINCT FROM 'object' THEN
    PERFORM keynes_internal.raise_domain_error('invalid_policy_context', jsonb_build_object('operation', 'requestBudget', 'path', '$.context', 'rule', 'type'));
  END IF;
  IF octet_length(convert_to(keynes_internal.policy_canonical_json(context), 'UTF8')) > ${limits.canonicalContextBytes} THEN
    PERFORM keynes_internal.raise_domain_error('invalid_policy_context', jsonb_build_object('operation', 'requestBudget', 'path', '$.context', 'rule', 'limit'));
  END IF;
  IF ARRAY(SELECT member.key FROM jsonb_object_keys(context) AS member(key) ORDER BY member.key)
       IS DISTINCT FROM ARRAY(SELECT field.member->>'name' FROM jsonb_array_elements(schema) AS field(member) ORDER BY field.member->>'name') THEN
    PERFORM keynes_internal.raise_domain_error('invalid_policy_context', jsonb_build_object(
      'operation', 'requestBudget', 'path', '$.context',
      'rule', CASE WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(schema) expected WHERE NOT (context ? (expected->>'name'))) THEN 'required' ELSE 'additionalProperties' END
    ));
  END IF;
  FOR field IN SELECT member FROM jsonb_array_elements(schema) member LOOP
    value := context->(field->>'name');
    IF value = 'null'::jsonb AND (field->>'nullable')::boolean THEN CONTINUE; END IF;
    IF value = 'null'::jsonb THEN
      PERFORM keynes_internal.raise_domain_error('invalid_policy_context', jsonb_build_object('operation', 'requestBudget', 'path', '$.context.' || (field->>'name'), 'rule', 'null'));
    END IF;
    IF (field->>'type' = 'integer' AND (jsonb_typeof(value) IS DISTINCT FROM 'number' OR value::text !~ '^-?[0-9]+$' OR (value::text)::numeric < 0 OR (value::text)::numeric > ${profile.source.numeric.maximumSafeInteger}))
      OR (field->>'type' = 'text' AND (jsonb_typeof(value) IS DISTINCT FROM 'string' OR octet_length(convert_to(value #>> '{}', 'UTF8')) > ${limits.contextTextBytes}))
      OR (field->>'type' = 'boolean' AND jsonb_typeof(value) IS DISTINCT FROM 'boolean') THEN
      PERFORM keynes_internal.raise_domain_error('invalid_policy_context', jsonb_build_object('operation', 'requestBudget', 'path', '$.context.' || (field->>'name'), 'rule', 'type'));
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.evaluate_policy_set(
  selected_tenant uuid, selected_budget uuid, policies jsonb, requested_items jsonb, context jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  policy jsonb;
  rendered text;
  rows jsonb;
  policy_rows jsonb := '[]'::jsonb;
  requested_named jsonb;
  available_named jsonb;
  effective jsonb;
BEGIN
  FOR policy IN SELECT value FROM jsonb_array_elements(policies) LOOP
    SELECT coalesce(jsonb_agg(jsonb_build_object('resource', resource_type.canonical_name, 'amount', (item->>'amount')::numeric) ORDER BY resource_type.canonical_name), '[]'::jsonb)
      INTO requested_named
      FROM jsonb_array_elements(requested_items) item
      JOIN keynes_internal.resource_types resource_type
        ON resource_type.tenant_id = selected_tenant AND resource_type.resource_type_id = (item->>'resourceTypeId')::uuid
     WHERE policy->'inputResources' ? resource_type.canonical_name;
    SELECT coalesce(jsonb_agg(jsonb_build_object('resource', resource_type.canonical_name, 'amount', (resource->>'available')::numeric) ORDER BY resource_type.canonical_name), '[]'::jsonb)
      INTO available_named
      FROM jsonb_array_elements(keynes_internal.budget_projection(selected_tenant, selected_budget)->'resources') resource
      JOIN keynes_internal.resource_types resource_type
        ON resource_type.tenant_id = selected_tenant AND resource_type.resource_type_id = (resource->'resourceType'->>'resourceTypeId')::uuid
     WHERE policy->'inputResources' ? resource_type.canonical_name;
    rendered := keynes_internal.render_policy_program(policy->'program');
    BEGIN
      EXECUTE 'SELECT coalesce(jsonb_agg(to_jsonb(policy_result) ORDER BY resource COLLATE "C", reason COLLATE "C", ceiling), ''[]''::jsonb) FROM (' || rendered || ') policy_result'
        INTO rows USING requested_named, available_named, context;
    EXCEPTION
      WHEN division_by_zero OR invalid_argument_for_power_function OR invalid_argument_for_logarithm THEN
        PERFORM keynes_internal.raise_domain_error('policy_evaluation_failed', jsonb_build_object(
          'operation', 'requestBudget', 'policyName', policy->>'name',
          'policyRevision', (policy->>'revision')::numeric, 'category', 'numeric_domain'
        ));
      WHEN numeric_value_out_of_range THEN
        PERFORM keynes_internal.raise_domain_error('policy_evaluation_failed', jsonb_build_object(
          'operation', 'requestBudget', 'policyName', policy->>'name',
          'policyRevision', (policy->>'revision')::numeric, 'category', 'arithmetic_overflow'
        ));
      WHEN OTHERS THEN
      PERFORM keynes_internal.raise_domain_error('policy_evaluation_failed', jsonb_build_object(
        'operation', 'requestBudget', 'policyName', policy->>'name',
        'policyRevision', (policy->>'revision')::numeric, 'category', 'execution_failed'
      ));
    END;
    IF jsonb_array_length(rows) > ${limits.resultRows} OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(rows) row
      WHERE row - ARRAY['resource','ceiling','reason']::text[] <> '{}'::jsonb
         OR jsonb_typeof(row->'resource') IS DISTINCT FROM 'string'
         OR jsonb_typeof(row->'ceiling') IS DISTINCT FROM 'number'
         OR (row->>'ceiling')::numeric < 0 OR (row->>'ceiling')::numeric > ${profile.source.numeric.maximumSafeInteger}
         OR (row->>'ceiling')::numeric <> trunc((row->>'ceiling')::numeric)
         OR NOT (policy->'outputResources' ? (row->>'resource'))
         OR NOT (policy->'reasons' ? (row->>'reason'))
         OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(requested_named) requested WHERE requested->>'resource' = row->>'resource')
    ) OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(rows) row GROUP BY row->>'resource' HAVING count(*) > 1
    ) THEN
      PERFORM keynes_internal.raise_domain_error('policy_evaluation_failed', jsonb_build_object(
        'operation', 'requestBudget', 'policyName', policy->>'name',
        'policyRevision', (policy->>'revision')::numeric, 'category', 'invalid_result'
      ));
    END IF;
    policy_rows := policy_rows || jsonb_build_array(jsonb_build_object(
      'name', policy->>'name', 'revision', (policy->>'revision')::numeric,
      'sourceDigest', policy->>'sourceDigest', 'definitionDigest', policy->>'definitionDigest', 'rows', rows
    ));
  END LOOP;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'resourceTypeId', resource_type.resource_type_id::text, 'ceiling', grouped.ceiling,
    'reasons', grouped.reasons
  ) ORDER BY grouped.resource COLLATE "C"), '[]'::jsonb)
  INTO effective
  FROM (
    SELECT row->>'resource' resource, min((row->>'ceiling')::numeric) ceiling,
           jsonb_agg(jsonb_build_object('policyName', policy_row->>'name', 'policyRevision', (policy_row->>'revision')::numeric, 'reason', row->>'reason') ORDER BY (policy_row->>'name') COLLATE "C", (policy_row->>'revision')::numeric, (row->>'reason') COLLATE "C") FILTER (WHERE (row->>'ceiling')::numeric = minimum.minimum) reasons
    FROM jsonb_array_elements(policy_rows) policy_row
    CROSS JOIN LATERAL jsonb_array_elements(policy_row->'rows') row
    CROSS JOIN LATERAL (SELECT min((candidate->>'ceiling')::numeric) minimum FROM jsonb_array_elements(policy_rows) p CROSS JOIN LATERAL jsonb_array_elements(p->'rows') candidate WHERE candidate->>'resource' = row->>'resource') minimum
    GROUP BY row->>'resource'
  ) grouped
  JOIN keynes_internal.resource_types resource_type ON resource_type.tenant_id = selected_tenant AND resource_type.canonical_name = grouped.resource;
  RETURN jsonb_build_object('context', context, 'policies', policy_rows, 'effectiveCeilings', effective);
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.apply_command(operation_name text, input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal, pg_temp
AS $function$
<<apply_command>>
DECLARE
  tenant uuid;
  principal uuid;
  command_id uuid;
  parent_id uuid;
  permission_name text;
  items jsonb;
  policies jsonb := '[]'::jsonb;
  parent_policies jsonb := '[]'::jsonb;
  child_policies jsonb := '[]'::jsonb;
  body jsonb;
  body_digest_value text;
  prior keynes_internal.commands%ROWTYPE;
  budget record;
  item jsonb;
  evidence jsonb;
  denial_reasons jsonb := '[]'::jsonb;
  available_amount numeric;
  ceiling jsonb;
  result jsonb;
  domain_error_message text;
BEGIN
  IF operation_name NOT IN ('createBudget', 'requestBudget')
    OR input IS NULL OR jsonb_typeof(input) <> 'object'
    OR jsonb_typeof(input->'commandId') IS DISTINCT FROM 'string' THEN
    RETURN keynes_internal.apply_command_legacy(operation_name, input);
  END IF;
  IF input->>'commandId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN keynes_internal.apply_command_legacy(operation_name, input - ARRAY['policies','childPolicies','context']::text[]);
  END IF;
  command_id := (input->>'commandId')::uuid;
  PERFORM set_config('keynes.policy_operation', operation_name, true);
  IF operation_name = 'createBudget' THEN
    policies := keynes_internal.canonical_policy_set(coalesce(input->'policies', '[]'::jsonb));
  END IF;
  IF operation_name = 'requestBudget' THEN
    child_policies := keynes_internal.canonical_policy_set(coalesce(input->'childPolicies', '[]'::jsonb));
  END IF;
  IF operation_name = 'requestBudget' AND jsonb_typeof(input->'parentBudgetId') = 'string' THEN
    IF input->>'parentBudgetId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RETURN keynes_internal.apply_command_legacy(operation_name, input - ARRAY['policies','childPolicies','context']::text[]);
    END IF;
    parent_id := (input->>'parentBudgetId')::uuid;
    IF NOT (input ? 'context')
      AND jsonb_typeof(child_policies) = 'array'
      AND jsonb_array_length(child_policies) = 0 THEN
      SELECT stored.policies INTO parent_policies FROM keynes_internal.budgets stored
        WHERE stored.tenant_id = nullif(current_setting('keynes.tenant_id', true), '')::uuid AND stored.budget_id = parent_id;
      parent_policies := coalesce(parent_policies, '[]'::jsonb);
    END IF;
  END IF;
  IF jsonb_typeof(policies) = 'array' AND jsonb_array_length(policies) = 0
    AND jsonb_typeof(parent_policies) = 'array' AND jsonb_array_length(parent_policies) = 0
    AND jsonb_typeof(child_policies) = 'array' AND jsonb_array_length(child_policies) = 0
    AND NOT (input ? 'context') THEN
    RETURN keynes_internal.apply_command_legacy(operation_name, input - ARRAY['policies','childPolicies']::text[]);
  END IF;
  BEGIN
    IF operation_name = 'createBudget' THEN
      IF NOT (input ? 'resources') OR input - ARRAY['commandId','resources','policies']::text[] <> '{}'::jsonb THEN
        PERFORM keynes_internal.invalid_command(operation_name, '$', 'properties');
      END IF;
      items := keynes_internal.canonical_envelope(operation_name, input->'resources', '$.resources', false);
      body := jsonb_build_object('resources', items, 'policies', policies);
      permission_name := 'create_root_budget';
    ELSE
      IF NOT (input ? 'parentBudgetId') OR NOT (input ? 'resources')
        OR input - ARRAY['commandId','parentBudgetId','resources','context','childPolicies']::text[] <> '{}'::jsonb THEN
        PERFORM keynes_internal.invalid_command(operation_name, '$', 'properties');
      END IF;
      items := keynes_internal.canonical_envelope(operation_name, input->'resources', '$.resources', false);
      body := jsonb_build_object('parentBudgetId', parent_id::text, 'resources', items, 'context', coalesce(input->'context', 'null'::jsonb), 'childPolicies', child_policies);
      permission_name := 'request_budget';
    END IF;
    IF coalesce(current_setting('keynes.tenant_id', true), '') !~ '^[0-9a-f-]{36}$'
      OR coalesce(current_setting('keynes.principal_id', true), '') !~ '^[0-9a-f-]{36}$' THEN
      PERFORM keynes_internal.raise_domain_error('unauthorized', jsonb_build_object('operation', operation_name, 'requiredPermission', permission_name));
    END IF;
    tenant := current_setting('keynes.tenant_id')::uuid;
    principal := current_setting('keynes.principal_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM keynes_internal.principal_permissions WHERE tenant_id = tenant AND principal_id = principal AND permission = permission_name) THEN
      PERFORM keynes_internal.raise_domain_error('unauthorized', jsonb_build_object('operation', operation_name, 'requiredPermission', permission_name));
    END IF;
    body_digest_value := 'command-body:' || encode(sha256(convert_to(body::text, 'UTF8')), 'hex');
    INSERT INTO keynes_internal.commands (tenant_id,command_id,operation,target_kind,target_id,canonical_body,body_digest,principal_id)
      VALUES (tenant,command_id,operation_name,'budget',command_id,body,body_digest_value,principal)
      ON CONFLICT ON CONSTRAINT commands_pkey DO NOTHING;
    IF NOT FOUND THEN
      SELECT * INTO prior FROM keynes_internal.commands stored WHERE stored.tenant_id = tenant AND stored.command_id = apply_command.command_id FOR UPDATE;
      IF prior.operation <> operation_name OR prior.target_kind <> 'budget' OR prior.target_id <> command_id OR prior.canonical_body <> body OR prior.body_digest <> body_digest_value THEN
        PERFORM keynes_internal.raise_domain_error('command_conflict', jsonb_build_object('commandId', command_id::text, 'existingOperation', prior.operation, 'attemptedOperation', operation_name));
      END IF;
      RETURN jsonb_build_object('ok', true, 'result', prior.result, 'replayed', true);
    END IF;
    PERFORM keynes_internal.checkpoint('after_command_binding');
    IF operation_name = 'createBudget' THEN
      PERFORM keynes_internal.validate_policy_set(policies);
      FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
        IF NOT EXISTS (SELECT 1 FROM keynes_internal.resource_types WHERE tenant_id = tenant AND resource_type_id = (item->>'resourceTypeId')::uuid) THEN
          PERFORM keynes_internal.raise_domain_error('resource_type_not_found', jsonb_build_object('resourceTypeId', item->>'resourceTypeId'));
        END IF;
      END LOOP;
      IF EXISTS (
        SELECT 1
          FROM jsonb_array_elements(policies) policy
          CROSS JOIN LATERAL jsonb_array_elements_text(policy->'inputResources') name
         WHERE NOT EXISTS (
           SELECT 1
             FROM jsonb_array_elements(items) holding
             JOIN keynes_internal.resource_types resource_type
               ON resource_type.tenant_id = tenant
              AND resource_type.resource_type_id = (holding->>'resourceTypeId')::uuid
            WHERE resource_type.canonical_name = name
         )
      ) THEN
        PERFORM keynes_internal.invalid_policy('$.policies', 'allocatedResourceTypes');
      END IF;
      INSERT INTO keynes_internal.budgets (tenant_id,budget_id,parent_budget_id,root_budget_id,depth,lifecycle,policies)
        VALUES (tenant,command_id,NULL,command_id,0,'active',policies);
      FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
        INSERT INTO keynes_internal.budget_resources (tenant_id,budget_id,resource_type_id,allocated_amount)
          VALUES (tenant,command_id,(item->>'resourceTypeId')::uuid,(item->>'amount')::bigint);
      END LOOP;
      INSERT INTO keynes_internal.budget_history_streams (tenant_id,stream_id) VALUES (tenant,command_id);
      PERFORM keynes_internal.checkpoint('after_domain_mutation');
      PERFORM keynes_internal.append_history(tenant,command_id,command_id,'budget_created',command_id,jsonb_build_object('rootBudgetId',command_id::text,'resources',items));
      PERFORM keynes_internal.checkpoint('after_history_insertion');
      result := jsonb_build_object('kind','created','budget',keynes_internal.budget_projection(tenant,command_id));
    ELSE
      SELECT * INTO budget FROM keynes_internal.budgets WHERE tenant_id = tenant AND budget_id = parent_id FOR UPDATE;
      IF NOT FOUND THEN PERFORM keynes_internal.raise_domain_error('budget_not_found', jsonb_build_object('budgetId',parent_id::text)); END IF;
      IF budget.lifecycle <> 'active' THEN PERFORM keynes_internal.raise_domain_error('budget_not_active', jsonb_build_object('budgetId',parent_id::text,'lifecycle',budget.lifecycle)); END IF;
      parent_policies := budget.policies;
      PERFORM keynes_internal.validate_policy_set(child_policies);
      IF EXISTS (
        SELECT 1
          FROM jsonb_array_elements(child_policies) policy
          CROSS JOIN LATERAL jsonb_array_elements_text(policy->'inputResources') name
         WHERE NOT EXISTS (
           SELECT 1
             FROM jsonb_array_elements(items) holding
             JOIN keynes_internal.resource_types resource_type
               ON resource_type.tenant_id = tenant
              AND resource_type.resource_type_id = (holding->>'resourceTypeId')::uuid
            WHERE resource_type.canonical_name = name
         )
      ) THEN
        PERFORM keynes_internal.invalid_policy('$.policies', 'allocatedResourceTypes');
      END IF;
      PERFORM keynes_internal.validate_policy_context(parent_policies, input->'context');
      PERFORM 1 FROM keynes_internal.budget_resources locked
        WHERE locked.tenant_id = tenant AND locked.budget_id = parent_id AND locked.resource_type_id IN (
          SELECT (requested->>'resourceTypeId')::uuid FROM jsonb_array_elements(items) requested
          UNION
          SELECT resource_type.resource_type_id FROM jsonb_array_elements(parent_policies) policy
            CROSS JOIN LATERAL jsonb_array_elements_text(policy->'inputResources') name
            JOIN keynes_internal.resource_types resource_type ON resource_type.tenant_id = tenant AND resource_type.canonical_name = name
        ) ORDER BY locked.resource_type_id FOR UPDATE;
      IF jsonb_array_length(parent_policies) > 0 THEN
        PERFORM keynes_internal.checkpoint('before_policy_evaluation');
        evidence := keynes_internal.evaluate_policy_set(tenant,parent_id,parent_policies,items,input->'context');
        PERFORM keynes_internal.checkpoint('after_policy_evaluation');
      ELSE
        evidence := NULL;
      END IF;
      FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
        SELECT coalesce((SELECT (resource->>'available')::numeric FROM jsonb_array_elements(keynes_internal.budget_projection(tenant,parent_id)->'resources') resource WHERE resource->'resourceType'->>'resourceTypeId' = item->>'resourceTypeId'),0) INTO available_amount;
        IF available_amount < (item->>'amount')::numeric THEN
          denial_reasons := denial_reasons || jsonb_build_array(jsonb_build_object('code','insufficient_available','resourceTypeId',item->>'resourceTypeId','requested',(item->>'amount')::numeric,'available',available_amount));
        END IF;
        SELECT value INTO ceiling FROM jsonb_array_elements(evidence->'effectiveCeilings') value WHERE value->>'resourceTypeId' = item->>'resourceTypeId';
        IF ceiling IS NOT NULL AND (item->>'amount')::numeric > (ceiling->>'ceiling')::numeric THEN
          denial_reasons := denial_reasons || (SELECT jsonb_agg(jsonb_build_object('code','policy_ceiling','resourceTypeId',item->>'resourceTypeId','requested',(item->>'amount')::numeric,'ceiling',(ceiling->>'ceiling')::numeric,'policyName',reason->>'policyName','policyRevision',(reason->>'policyRevision')::numeric,'reason',reason->>'reason') ORDER BY reason->>'policyName',(reason->>'policyRevision')::numeric,reason->>'reason') FROM jsonb_array_elements(ceiling->'reasons') reason);
        END IF;
      END LOOP;
      SELECT coalesce(jsonb_agg(reason.value ORDER BY
               resource_type.canonical_name COLLATE "C",
               (reason.value->>'code') COLLATE "C",
               (reason.value->>'policyName') COLLATE "C",
               CASE WHEN reason.value->>'policyRevision' ~ '^[0-9]+$' THEN (reason.value->>'policyRevision')::numeric END,
               (reason.value->>'reason') COLLATE "C"
             ), '[]'::jsonb)
        INTO denial_reasons
        FROM jsonb_array_elements(denial_reasons) reason(value)
        JOIN keynes_internal.resource_types resource_type
          ON resource_type.tenant_id = tenant
         AND resource_type.resource_type_id = (reason.value->>'resourceTypeId')::uuid;
      IF evidence IS NOT NULL THEN
        evidence := evidence || jsonb_build_object('decision', CASE WHEN jsonb_array_length(denial_reasons) = 0 THEN 'approved' ELSE 'denied' END);
      END IF;
      PERFORM keynes_internal.checkpoint('after_policy_evidence');
      IF jsonb_array_length(denial_reasons) > 0 THEN
        PERFORM keynes_internal.checkpoint('after_domain_mutation');
        PERFORM keynes_internal.append_history(tenant,budget.root_budget_id,command_id,'request_denied',parent_id,jsonb_build_object('parentBudgetId',parent_id::text,'reasons',denial_reasons) || CASE WHEN evidence IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('policyEvidence',evidence) END);
        PERFORM keynes_internal.checkpoint('after_history_insertion');
        result := jsonb_build_object('kind','denied','commandId',command_id::text,'parentBudgetId',parent_id::text,'reasons',denial_reasons) || CASE WHEN evidence IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('policyEvidence',evidence) END;
      ELSE
        INSERT INTO keynes_internal.budgets (tenant_id,budget_id,parent_budget_id,root_budget_id,depth,lifecycle,policies)
          VALUES (tenant,command_id,parent_id,budget.root_budget_id,budget.depth + 1,'active',child_policies);
        FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
          INSERT INTO keynes_internal.budget_resources (tenant_id,budget_id,resource_type_id,allocated_amount) VALUES (tenant,command_id,(item->>'resourceTypeId')::uuid,(item->>'amount')::bigint);
        END LOOP;
        PERFORM keynes_internal.checkpoint('after_domain_mutation');
        PERFORM keynes_internal.append_history(tenant,budget.root_budget_id,command_id,'request_approved',command_id,jsonb_build_object('parentBudgetId',parent_id::text,'childBudgetId',command_id::text,'resources',items) || CASE WHEN evidence IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('policyEvidence',evidence) END);
        PERFORM keynes_internal.checkpoint('after_history_insertion');
        result := jsonb_build_object('kind','approved','commandId',command_id::text,'parentBudgetId',parent_id::text,'childBudgetId',command_id::text,'resources',items) || CASE WHEN evidence IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('policyEvidence',evidence) END;
      END IF;
    END IF;
    UPDATE keynes_internal.commands stored SET result = apply_command.result, committed_at = clock_timestamp() WHERE stored.tenant_id = tenant AND stored.command_id = apply_command.command_id;
    PERFORM keynes_internal.checkpoint('after_result_storage');
    RETURN jsonb_build_object('ok',true,'result',result,'replayed',false);
  EXCEPTION WHEN SQLSTATE 'K0001' THEN
    GET STACKED DIAGNOSTICS domain_error_message = MESSAGE_TEXT;
    RETURN jsonb_build_object('ok',false,'error',domain_error_message::jsonb);
  END;
END;
$function$;

REVOKE ALL ON FUNCTION keynes_internal.apply_command_legacy(text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.policy_canonical_json(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.canonical_policy_set(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_policy_set(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_policy_context(jsonb,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.evaluate_policy_set(uuid,uuid,jsonb,jsonb,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.apply_command(text,jsonb) FROM PUBLIC;

${securePublic}`;
}
