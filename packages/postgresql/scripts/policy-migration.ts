import type {
  ContractSource,
  JsonObject,
  LoadedPolicyProfile,
} from "@keynes/contracts";

import { renderPolicyRuntime } from "./budget-policy-runtime.ts";
import { sqlLiteral } from "./sql-literal.ts";

const EXPECTED_POSTGRES_OBJECTS = [
  "schema:keynes_internal",
  "schema:keynes",
  "table:keynes_internal.schema_migrations",
  "table:keynes_internal.installation_identity",
  "table:keynes_internal.principal_permissions",
  "table:keynes_internal.commands",
  "table:keynes_internal.resource_types",
  "table:keynes_internal.budgets",
  "table:keynes_internal.budget_resources",
  "table:keynes_internal.budget_history_streams",
  "table:keynes_internal.budget_history_entries",
  "function:keynes_internal.raise_domain_error(error_code text,error_details jsonb)",
  "function:keynes_internal.checkpoint(checkpoint_name text)",
  "function:keynes_internal.invalid_command(operation_name text,issue_path text,issue_rule text)",
  "function:keynes_internal.canonical_envelope(operation_name text,value jsonb,issue_path text,allow_null boolean)",
  "function:keynes_internal.event_uuid(seed text)",
  "function:keynes_internal.budget_is_settled(selected_tenant uuid,selected_budget uuid)",
  "function:keynes_internal.subtree_observed(selected_tenant uuid,selected_budget uuid,selected_resource uuid)",
  "function:keynes_internal.budget_charge(selected_tenant uuid,selected_budget uuid,selected_resource uuid)",
  "function:keynes_internal.assert_safe_accounting(selected_tenant uuid,changed_budget uuid,operation_name text)",
  "function:keynes_internal.budget_projection(selected_tenant uuid,selected_budget uuid)",
  "function:keynes_internal.append_history(selected_tenant uuid,selected_stream uuid,selected_command uuid,selected_kind text,selected_subject uuid,details jsonb)",
  "function:keynes_internal.apply_command(operation_name text,input jsonb)",
  "function:keynes_internal.get_budget(input jsonb)",
  "function:keynes.define_resource_type(input jsonb)",
  "function:keynes.create_budget(input jsonb)",
  "function:keynes.request(input jsonb)",
  "function:keynes.settle(input jsonb)",
  "function:keynes.get_budget(input jsonb)",
] as const;
export function renderPolicyMigration(
  profile: LoadedPolicyProfile,
  legacyBudgetSql: string,
  contract: ContractSource,
): string {
  const categories = Object.fromEntries(
    profile.nodeKinds.map((kind) => [
      kind,
      profile.source.nodes[kind]?.category,
    ]),
  );
  const validators = profile.nodeKinds
    .map((kind) => renderPolicyValidator(kind, profile))
    .join("\n\n");
  const renderers = profile.nodeKinds
    .map((kind) => renderPolicyRenderer(kind, profile))
    .join("\n\n");
  const validationDispatch = profile.nodeKinds
    .map(
      (kind) =>
        `    WHEN ${sqlLiteral(kind)} THEN PERFORM keynes_internal.${profile.source.nodes[kind]?.backends.postgresql.validator}(node);`,
    )
    .join("\n");
  const renderingDispatch = profile.nodeKinds
    .map(
      (kind) =>
        `    WHEN ${sqlLiteral(kind)} THEN RETURN keynes_internal.${profile.source.nodes[kind]?.backends.postgresql.renderer}(node);`,
    )
    .join("\n");
  const vectors = profile.nodeKinds.flatMap((kind) =>
    (profile.source.nodes[kind]?.vectors ?? []).map((vector) => ({
      kind,
      ...vector,
      expectedWork: policyWorkBound(vector.input, profile, 1, 1),
    })),
  );
  const work = Object.fromEntries(
    profile.nodeKinds.map((kind) => [
      kind,
      profile.source.nodes[kind]?.work ?? {},
    ]),
  );
  const revokes = policyFunctionSignatures(profile)
    .map(
      (signature) =>
        `REVOKE ALL ON FUNCTION keynes_internal.${signature} FROM PUBLIC;`,
    )
    .join("\n");
  const policyRuntime = renderPolicyRuntime(profile, legacyBudgetSql, contract);

  return `-- Generated from packages/contracts/policy-profile.json. Do not edit.
-- Policy profile SHA-256: ${profile.digest}

CREATE OR REPLACE FUNCTION keynes_internal.invalid_policy(issue_path text, issue_rule text)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  operation_name text := coalesce(nullif(current_setting('keynes.policy_operation', true), ''), 'createBudget');
  policy_name text := nullif(current_setting('keynes.policy_name', true), '');
  policy_revision text := nullif(current_setting('keynes.policy_revision', true), '');
  details jsonb;
BEGIN
  details := jsonb_build_object(
    'operation', operation_name,
    'path', issue_path,
    'rule', issue_rule
  );
  IF policy_name IS NOT NULL THEN
    details := details || jsonb_build_object('policyName', policy_name);
  END IF;
  IF policy_revision ~ '^[1-9][0-9]*$' THEN
    details := details || jsonb_build_object('policyRevision', policy_revision::numeric);
  END IF;
  PERFORM keynes_internal.raise_domain_error(
    'invalid_policy',
    details
  );
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.policy_sum(input_values numeric[])
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog
AS $$
DECLARE
  value numeric;
  total numeric(38,18) := 0;
  present boolean := false;
BEGIN
  FOREACH value IN ARRAY coalesce(input_values, ARRAY[]::numeric[]) LOOP
    IF value IS NOT NULL THEN
      total := (total + value)::numeric(38,18);
      present := true;
    END IF;
  END LOOP;
  RETURN CASE WHEN present THEN total ELSE NULL END;
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.policy_avg(input_values numeric[])
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog
AS $$
DECLARE
  value numeric;
  total numeric(38,18) := 0;
  present integer := 0;
BEGIN
  FOREACH value IN ARRAY coalesce(input_values, ARRAY[]::numeric[]) LOOP
    IF value IS NOT NULL THEN
      total := (total + value)::numeric(38,18);
      present := present + 1;
    END IF;
  END LOOP;
  RETURN CASE
    WHEN present = 0 THEN NULL
    ELSE (total / present)::numeric(38,18)
  END;
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.policy_runtime_numeric(value numeric)
RETURNS numeric
LANGUAGE plpgsql
VOLATILE
SET search_path = pg_catalog
AS $$
BEGIN
  RETURN value;
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.policy_assert_exact_keys(
  value jsonb,
  expected_keys text[],
  issue_path text
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  actual_keys text[];
  canonical_expected text[];
BEGIN
  IF jsonb_typeof(value) IS DISTINCT FROM 'object' THEN
    PERFORM keynes_internal.invalid_policy(issue_path, 'type');
  END IF;
  SELECT array_agg(key ORDER BY key) INTO actual_keys
    FROM jsonb_object_keys(value) key;
  SELECT array_agg(key ORDER BY key) INTO canonical_expected
    FROM unnest(expected_keys) key;
  IF actual_keys IS DISTINCT FROM canonical_expected THEN
    PERFORM keynes_internal.invalid_policy(issue_path, 'properties');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.validate_policy_descriptor(
  value jsonb,
  descriptor jsonb,
  issue_path text
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  descriptor_type text := descriptor->>'type';
  text_value text;
  member jsonb;
  field record;
BEGIN
  CASE descriptor_type
    WHEN 'literal' THEN
      IF value IS DISTINCT FROM descriptor->'value' THEN
        PERFORM keynes_internal.invalid_policy(issue_path, 'const');
      END IF;
    WHEN 'string' THEN
      IF jsonb_typeof(value) IS DISTINCT FROM 'string' THEN
        PERFORM keynes_internal.invalid_policy(issue_path, 'type');
      END IF;
      text_value := value #>> '{}';
      IF descriptor ? 'pattern' AND text_value !~ (descriptor->>'pattern') THEN
        PERFORM keynes_internal.invalid_policy(issue_path, 'pattern');
      END IF;
      IF descriptor ? 'maxLength' AND length(text_value) > (descriptor->>'maxLength')::integer THEN
        PERFORM keynes_internal.invalid_policy(issue_path, 'maxLength');
      END IF;
      IF descriptor ? 'maxUtf8Bytes' AND octet_length(convert_to(text_value, 'UTF8')) > (descriptor->>'maxUtf8Bytes')::integer THEN
        PERFORM keynes_internal.invalid_policy(issue_path, 'maxUtf8Bytes');
      END IF;
    WHEN 'boolean' THEN
      IF jsonb_typeof(value) IS DISTINCT FROM 'boolean' THEN
        PERFORM keynes_internal.invalid_policy(issue_path, 'type');
      END IF;
    WHEN 'decimal' THEN
      IF jsonb_typeof(value) IS DISTINCT FROM 'string' OR (value #>> '{}') !~ '^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$' THEN
        PERFORM keynes_internal.invalid_policy(issue_path, 'numeric');
      END IF;
      IF (value #>> '{}') !~ '^-?(0|[1-9][0-9]{0,19})(\\.[0-9]{1,18})?$' THEN
        PERFORM keynes_internal.invalid_policy(issue_path, 'numeric_precision');
      END IF;
      BEGIN
        PERFORM (value #>> '{}')::numeric(38,18);
      EXCEPTION WHEN numeric_value_out_of_range THEN
        PERFORM keynes_internal.invalid_policy(issue_path, 'numeric_precision');
      END;
    WHEN 'integer' THEN
      IF jsonb_typeof(value) IS DISTINCT FROM 'number' OR (value #>> '{}') !~ '^-?[0-9]+$' THEN
        PERFORM keynes_internal.invalid_policy(issue_path, 'integer');
      END IF;
      IF descriptor ? 'minimum' AND (value #>> '{}')::numeric < (descriptor->>'minimum')::numeric THEN
        PERFORM keynes_internal.invalid_policy(issue_path, 'minimum');
      END IF;
      IF descriptor ? 'maximum' AND (value #>> '{}')::numeric > (descriptor->>'maximum')::numeric THEN
        PERFORM keynes_internal.invalid_policy(issue_path, 'maximum');
      END IF;
    WHEN 'enum' THEN
      IF jsonb_typeof(value) IS DISTINCT FROM 'string' OR NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(descriptor->'values') AS allowed(member)
         WHERE allowed.member = validate_policy_descriptor.value #>> '{}'
      ) THEN
        PERFORM keynes_internal.invalid_policy(issue_path, 'enum');
      END IF;
    WHEN 'node' THEN
      PERFORM keynes_internal.validate_policy_node(value);
      IF descriptor ? 'group' AND (${sqlLiteral(JSON.stringify(categories))}::jsonb->>(value->>'kind')) IS DISTINCT FROM descriptor->>'group' THEN
        PERFORM keynes_internal.invalid_policy(issue_path, 'node_group');
      END IF;
    WHEN 'nullable' THEN
      IF value IS DISTINCT FROM 'null'::jsonb THEN
        PERFORM keynes_internal.validate_policy_descriptor(value, descriptor->'value', issue_path);
      END IF;
    WHEN 'array' THEN
      IF jsonb_typeof(value) IS DISTINCT FROM 'array' THEN
        PERFORM keynes_internal.invalid_policy(issue_path, 'type');
      END IF;
      IF descriptor ? 'minItems' AND jsonb_array_length(value) < (descriptor->>'minItems')::integer THEN
        PERFORM keynes_internal.invalid_policy(issue_path, 'minItems');
      END IF;
      IF descriptor ? 'maxItems' AND jsonb_array_length(value) > (descriptor->>'maxItems')::integer THEN
        PERFORM keynes_internal.invalid_policy(issue_path, 'maxItems');
      END IF;
      FOR member IN SELECT element.member_value FROM jsonb_array_elements(value) AS element(member_value)
      LOOP
        PERFORM keynes_internal.validate_policy_descriptor(member, descriptor->'items', issue_path);
      END LOOP;
    WHEN 'object' THEN
      PERFORM keynes_internal.policy_assert_exact_keys(
        value,
        ARRAY(SELECT key FROM jsonb_object_keys(descriptor->'fields') key),
        issue_path
      );
      FOR field IN SELECT member.key, member.member_value AS descriptor FROM jsonb_each(descriptor->'fields') AS member(key, member_value)
      LOOP
        PERFORM keynes_internal.validate_policy_descriptor(value->field.key, field.descriptor, issue_path || '/' || field.key);
      END LOOP;
    ELSE
      PERFORM keynes_internal.invalid_policy(issue_path, 'descriptor');
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.validate_policy_node(node jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
BEGIN
  IF jsonb_typeof(node) IS DISTINCT FROM 'object' OR node->>'kind' IS NULL THEN
    PERFORM keynes_internal.invalid_policy('$.program', 'node');
  END IF;
  CASE node->>'kind'
${validationDispatch}
    ELSE PERFORM keynes_internal.invalid_policy('$.program.kind', 'enum');
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.render_policy_node(node jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
BEGIN
  PERFORM keynes_internal.validate_policy_node(node);
  CASE node->>'kind'
${renderingDispatch}
    ELSE PERFORM keynes_internal.invalid_policy('$.program.kind', 'enum');
  END CASE;
  RETURN NULL;
END;
$$;

${validators}

${renderers}

CREATE OR REPLACE FUNCTION keynes_internal.validate_policy_program(program jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  node_count bigint;
  node_depth integer;
BEGIN
  IF program->>'kind' IS DISTINCT FROM 'select' THEN
    PERFORM keynes_internal.invalid_policy('$.program.kind', 'const');
  END IF;
  PERFORM keynes_internal.validate_policy_node(program);
  WITH RECURSIVE walk(value, depth) AS (
    VALUES (program, 1)
    UNION ALL
    SELECT child.value,
           walk.depth + CASE WHEN jsonb_typeof(child.value) = 'object' AND child.value ? 'kind' THEN 1 ELSE 0 END
      FROM walk
      CROSS JOIN LATERAL (
        SELECT member.value
          FROM jsonb_each(CASE jsonb_typeof(walk.value) WHEN 'object' THEN walk.value ELSE '{}'::jsonb END) member
        UNION ALL
        SELECT member.value
          FROM jsonb_array_elements(CASE jsonb_typeof(walk.value) WHEN 'array' THEN walk.value ELSE '[]'::jsonb END) member
      ) child
  )
  SELECT count(*) FILTER (WHERE jsonb_typeof(value) = 'object' AND value ? 'kind'),
         max(depth) FILTER (WHERE jsonb_typeof(value) = 'object' AND value ? 'kind')
    INTO node_count, node_depth
    FROM walk;
  IF node_count > ${profile.source.limits.programNodes} THEN
    PERFORM keynes_internal.invalid_policy('$.program', 'node_limit');
  END IF;
  IF node_depth > ${profile.source.limits.programDepth} THEN
    PERFORM keynes_internal.invalid_policy('$.program', 'depth_limit');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.render_policy_program(program jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
BEGIN
  PERFORM keynes_internal.validate_policy_program(program);
  PERFORM ARRAY['requested_resources', 'available_resources', 'policy_context'];
  RETURN keynes_internal.render_select(program);
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.canonical_policy_expression(node jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
BEGIN
  CASE node->>'kind'
    WHEN 'decimal_literal' THEN RETURN node->>'value';
    WHEN 'text_literal' THEN RETURN chr(39) || replace(node->>'value', chr(39), chr(39) || chr(39)) || chr(39);
    WHEN 'boolean_literal' THEN RETURN lower(node->>'value');
    WHEN 'null_literal' THEN RETURN 'null';
    WHEN 'reference' THEN RETURN (node->>'source') || '.' || (node->>'field');
    WHEN 'unary_numeric' THEN
      RETURN (node->>'operator') || keynes_internal.canonical_policy_parenthesize(node->'operand');
    WHEN 'binary_numeric', 'comparison', 'boolean_binary' THEN
      RETURN keynes_internal.canonical_policy_parenthesize(node->'left') || ' ' || (node->>'operator') || ' ' || keynes_internal.canonical_policy_parenthesize(node->'right');
    WHEN 'text_in' THEN
      RETURN keynes_internal.canonical_policy_parenthesize(node->'operand') || ' in (' ||
        (SELECT string_agg(chr(39) || replace(value, chr(39), chr(39) || chr(39)) || chr(39), ', ' ORDER BY ordinality) FROM jsonb_array_elements_text(node->'values') WITH ORDINALITY) || ')';
    WHEN 'is_null' THEN
      RETURN keynes_internal.canonical_policy_parenthesize(node->'operand') || CASE node->>'operator' WHEN 'is_null' THEN ' is null' ELSE ' is not null' END;
    WHEN 'boolean_not' THEN
      RETURN 'not ' || keynes_internal.canonical_policy_parenthesize(node->'operand');
    WHEN 'case' THEN
      RETURN 'case ' || (SELECT string_agg('when ' || keynes_internal.canonical_policy_expression(value->'when') || ' then ' || keynes_internal.canonical_policy_expression(value->'then'), ' ' ORDER BY ordinality) FROM jsonb_array_elements(node->'branches') WITH ORDINALITY) || ' else ' || keynes_internal.canonical_policy_expression(node->'else') || ' end';
    WHEN 'variadic' THEN
      RETURN (node->>'function') || '(' || (SELECT string_agg(keynes_internal.canonical_policy_expression(value), ', ' ORDER BY ordinality) FROM jsonb_array_elements(node->'arguments') WITH ORDINALITY) || ')';
    WHEN 'numeric_function', 'aggregate' THEN
      RETURN (node->>'function') || '(' || keynes_internal.canonical_policy_expression(node->'operand') || ')';
    WHEN 'scale_function' THEN
      RETURN (node->>'function') || '(' || keynes_internal.canonical_policy_expression(node->'operand') || ', ' || (node->>'scale') || ')';
    WHEN 'power' THEN
      RETURN 'power(' || keynes_internal.canonical_policy_expression(node->'base') || ', ' || (node->>'exponent') || ')';
    ELSE
      PERFORM keynes_internal.invalid_policy('$.program.kind', 'enum');
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.canonical_policy_parenthesize(node jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT CASE WHEN node->>'kind' IN ('decimal_literal','text_literal','boolean_literal','null_literal','reference','variadic','numeric_function','scale_function','power','aggregate')
    THEN keynes_internal.canonical_policy_expression(node)
    ELSE '(' || keynes_internal.canonical_policy_expression(node) || ')'
  END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.canonical_policy_sql(program jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  rendered text;
BEGIN
  PERFORM keynes_internal.validate_policy_program(program);
  rendered := 'select ' || keynes_internal.canonical_policy_expression(program->'resource') || ' as resource,' || chr(10)
    || '       ' || keynes_internal.canonical_policy_expression(program->'ceiling') || ' as ceiling,' || chr(10)
    || '       ' || keynes_internal.canonical_policy_expression(program->'reason') || ' as reason' || chr(10)
    || 'from requested_resources as requested' || chr(10)
    || CASE program->'availabilityJoin'->>'kind' WHEN 'inner_join' THEN 'inner join available_resources as available using (resource)' ELSE 'cross join available_resources as available' END || chr(10)
    || 'cross join policy_context as context';
  IF program->'where' IS DISTINCT FROM 'null'::jsonb THEN
    rendered := rendered || chr(10) || 'where ' || keynes_internal.canonical_policy_expression(program->'where');
  END IF;
  IF jsonb_array_length(program->'groupBy') > 0 THEN
    rendered := rendered || chr(10) || 'group by ' || (SELECT string_agg(keynes_internal.canonical_policy_expression(value), ', ' ORDER BY ordinality) FROM jsonb_array_elements(program->'groupBy') WITH ORDINALITY);
  END IF;
  RETURN rendered || chr(10) || 'order by resource asc, reason asc, ceiling asc' || chr(10);
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.policy_work_bound(
  program jsonb,
  requested_rows integer,
  available_rows integer
)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  WITH RECURSIVE metadata(value) AS (
    VALUES (${sqlLiteral(JSON.stringify(work))}::jsonb)
  ), categories(value) AS (
    VALUES (${sqlLiteral(JSON.stringify(categories))}::jsonb)
  ), inputs(requested, available) AS (
    VALUES (GREATEST(requested_rows, 0)::bigint, GREATEST(available_rows, 0)::bigint)
  ), bounds(requested, available, joined) AS (
    SELECT requested,
           available,
           CASE program->'availabilityJoin'->>'kind'
             WHEN 'cross_join' THEN requested * available
             ELSE requested
           END
      FROM inputs
  ), walk(value) AS (
    VALUES (program)
    UNION ALL
    SELECT child.value
      FROM walk
      CROSS JOIN LATERAL (
        SELECT member.value
          FROM jsonb_each(CASE jsonb_typeof(walk.value) WHEN 'object' THEN walk.value ELSE '{}'::jsonb END) member
        UNION ALL
        SELECT member.value
          FROM jsonb_array_elements(CASE jsonb_typeof(walk.value) WHEN 'array' THEN walk.value ELSE '[]'::jsonb END) member
      ) child
  ), expression_stats(unit_work, aggregates) AS (
    SELECT COALESCE(sum(
      COALESCE((metadata.value->(walk.value->>'kind')->>'base')::bigint, 0)
      + COALESCE((metadata.value->(walk.value->>'kind')->>'perMember')::bigint, 0) * CASE WHEN jsonb_typeof(walk.value->'values') = 'array' THEN jsonb_array_length(walk.value->'values') ELSE 0 END
      + COALESCE((metadata.value->(walk.value->>'kind')->>'perBranch')::bigint, 0) * CASE WHEN jsonb_typeof(walk.value->'branches') = 'array' THEN jsonb_array_length(walk.value->'branches') ELSE 0 END
      + COALESCE((metadata.value->(walk.value->>'kind')->>'perArgument')::bigint, 0) * CASE WHEN jsonb_typeof(walk.value->'arguments') = 'array' THEN jsonb_array_length(walk.value->'arguments') ELSE 0 END
      + COALESCE((metadata.value->(walk.value->>'kind')->>'perExponentStep')::bigint, 0) * COALESCE((walk.value->>'exponent')::integer, 0)
    ) FILTER (WHERE categories.value->>(walk.value->>'kind') = 'expression'), 0),
    count(*) FILTER (WHERE walk.value->>'kind' = 'aggregate')
      FROM walk
      CROSS JOIN metadata
      CROSS JOIN categories
     WHERE jsonb_typeof(walk.value) = 'object' AND walk.value ? 'kind'
  )
  SELECT CASE WHEN program->>'kind' = 'select' THEN
      COALESCE((metadata.value->'select'->>'base')::bigint, 0)
      + bounds.requested * COALESCE((metadata.value->'select'->>'perRequestedRow')::bigint, 0)
      + bounds.available * COALESCE((metadata.value->'select'->>'perAvailabilityRow')::bigint, 0)
      + bounds.joined * COALESCE((metadata.value->'select'->>'perGroupTransition')::bigint, 0)
      + ${profile.source.limits.resultRows * Math.ceil(Math.log2(profile.source.limits.resultRows))} * COALESCE((metadata.value->'select'->>'perResultSortComparison')::bigint, 0)
      + CASE program->'availabilityJoin'->>'kind'
          WHEN 'cross_join' THEN bounds.joined * COALESCE((metadata.value->'cross_join'->>'perJoinedRow')::bigint, 0)
          ELSE bounds.requested * COALESCE((metadata.value->'inner_join'->>'perRequestedRow')::bigint, 0)
        END
      + expression_stats.unit_work * bounds.joined
      + expression_stats.aggregates * bounds.joined * COALESCE((metadata.value->'aggregate'->>'perInputRow')::bigint, 0)
    ELSE expression_stats.unit_work END
    FROM metadata
    CROSS JOIN bounds
    CROSS JOIN expression_stats;
$$;

${policyRuntime}

CREATE OR REPLACE FUNCTION keynes_internal.check_policy_canonical_vectors()
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  vector jsonb;
  rendered text;
  actual text;
  actual_type text;
  actual_null boolean;
  expected text;
  actual_work bigint;
BEGIN
  FOR vector IN SELECT value FROM jsonb_array_elements(${sqlLiteral(JSON.stringify(vectors))}::jsonb)
  LOOP
    PERFORM keynes_internal.validate_policy_node(vector->'input');
    rendered := keynes_internal.render_policy_node(vector->'input');
    IF rendered IS NULL THEN
      PERFORM keynes_internal.invalid_policy('$.vectors', 'renderer');
    END IF;
    IF vector->>'kind' = 'select' THEN
      EXECUTE 'SELECT count(*)::text FROM (' || rendered || ') AS policy_result'
        INTO actual
        USING '[{"resource":"model_tokens","amount":1}]'::jsonb,
              '[{"resource":"model_tokens","amount":100}]'::jsonb,
              '{}'::jsonb;
      IF vector->'expected'->>'type' IS DISTINCT FROM 'rows' OR actual IS NULL THEN
        PERFORM keynes_internal.invalid_policy('$.vectors', 'rows');
      END IF;
    ELSIF vector->>'kind' IN ('inner_join', 'cross_join') THEN
      EXECUTE 'WITH available_resources(resource, amount) AS (VALUES (''model_tokens''::text COLLATE "C", 100::numeric(38,18))) SELECT count(*)::text FROM (VALUES (''model_tokens''::text COLLATE "C", 1::numeric(38,18))) AS requested(resource, amount) ' || rendered || ' CROSS JOIN (VALUES (''{}''::jsonb)) AS context(value)'
        INTO actual;
      IF actual IS NULL THEN
        PERFORM keynes_internal.invalid_policy('$.vectors', 'join');
      END IF;
    ELSE
      EXECUTE 'SELECT pg_typeof((' || rendered || '))::text, ((' || rendered || ') IS NULL), (' || rendered || ')::text FROM (VALUES (''model_tokens''::text COLLATE "C", 1::numeric(38,18))) AS requested(resource, amount) CROSS JOIN (VALUES (''model_tokens''::text COLLATE "C", 100::numeric(38,18))) AS available(resource, amount) CROSS JOIN (VALUES (''{}''::jsonb)) AS context(value)'
        INTO actual_type, actual_null, actual;
      IF actual_type IS DISTINCT FROM vector->'expected'->>'type' THEN
        PERFORM keynes_internal.invalid_policy('$.vectors.' || (vector->>'kind'), 'type');
      END IF;
      IF (vector->'input'->>'nullable')::boolean IS DISTINCT FROM (vector->'expected'->>'nullable')::boolean THEN
        PERFORM keynes_internal.invalid_policy('$.vectors', 'nullable');
      END IF;
      IF vector->'expected' ? 'value' THEN
      expected := vector->'expected'->>'value';
      IF actual IS DISTINCT FROM expected THEN
        PERFORM keynes_internal.invalid_policy('$.vectors', 'expected');
      END IF;
        IF actual_null IS DISTINCT FROM (vector->'expected'->'value' = 'null'::jsonb) THEN
          PERFORM keynes_internal.invalid_policy('$.vectors', 'null');
        END IF;
      END IF;
    END IF;
    actual_work := keynes_internal.policy_work_bound(vector->'input', 1, 1);
    IF actual_work IS DISTINCT FROM (vector->>'expectedWork')::bigint OR actual_work > ${profile.source.limits.operationsPerPolicy} THEN
      PERFORM keynes_internal.invalid_policy('$.vectors', 'work');
    END IF;
    IF vector->>'kind' = 'select' AND vector->'input'->'availabilityJoin'->>'kind' = 'inner_join' AND keynes_internal.policy_work_bound(vector->'input', ${profile.source.limits.requestedRows}, ${profile.source.limits.availabilityRowsPerPolicy}) > ${profile.source.limits.operationsPerPolicy} THEN
      PERFORM keynes_internal.invalid_policy('$.vectors', 'inner_join_work');
    END IF;
  END LOOP;
END;
$$;

SELECT keynes_internal.check_policy_canonical_vectors();

${revokes}
`;
}

function renderPolicyValidator(
  kind: string,
  profile: LoadedPolicyProfile,
): string {
  const node = profile.source.nodes[kind];
  const name = node?.backends.postgresql.validator;
  if (name === undefined || node === undefined) {
    throw new Error(`Policy node ${kind} lacks a validator`);
  }
  const expectedKeys = ["kind", ...Object.keys(node.fields)]
    .sort()
    .map(sqlLiteral)
    .join(", ");
  return `CREATE OR REPLACE FUNCTION keynes_internal.${name}(node jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  field record;
BEGIN
  IF jsonb_typeof(node) IS DISTINCT FROM 'object' OR node->>'kind' IS DISTINCT FROM ${sqlLiteral(kind)} THEN
    PERFORM keynes_internal.invalid_policy('$.program.kind', 'const');
  END IF;
  PERFORM keynes_internal.policy_assert_exact_keys(node, ARRAY[${expectedKeys}], '$.program');
  FOR field IN SELECT key, value AS descriptor FROM jsonb_each(${sqlLiteral(JSON.stringify(node.fields))}::jsonb)
  LOOP
    PERFORM keynes_internal.validate_policy_descriptor(node->field.key, field.descriptor, '$.program/' || field.key);
  END LOOP;
${renderPolicySemanticValidation(kind)}
END;
$$;`;
}

function renderPolicySemanticValidation(kind: string): string {
  switch (kind) {
    case "select":
      return `  IF node->'resource'->>'valueType' IS DISTINCT FROM 'text' OR (node->'resource'->>'nullable')::boolean OR
     node->'ceiling'->>'valueType' IS DISTINCT FROM 'numeric' OR (node->'ceiling'->>'nullable')::boolean OR
     node->'reason'->>'valueType' IS DISTINCT FROM 'text' OR (node->'reason'->>'nullable')::boolean THEN
    PERFORM keynes_internal.invalid_policy('$.program', 'result_type');
  END IF;
  IF node->'where' IS DISTINCT FROM 'null'::jsonb AND node->'where'->>'valueType' IS DISTINCT FROM 'boolean' THEN
    PERFORM keynes_internal.invalid_policy('$.program/where', 'type');
  END IF;`;
    case "inner_join":
    case "cross_join":
    case "decimal_literal":
    case "text_literal":
    case "boolean_literal":
    case "null_literal":
      return "";
    case "reference":
      return `  IF node->>'source' IN ('requested', 'available') AND
     (CASE node->>'field' WHEN 'resource' THEN 'text' WHEN 'amount' THEN 'numeric' END) IS DISTINCT FROM node->>'valueType' THEN
    PERFORM keynes_internal.invalid_policy('$.program/field', 'type');
  END IF;
  IF node->>'source' IN ('requested', 'available') AND (node->>'nullable')::boolean THEN
    PERFORM keynes_internal.invalid_policy('$.program/nullable', 'const');
  END IF;`;
    case "unary_numeric":
    case "numeric_function":
    case "scale_function":
      return `  IF node->'operand'->>'valueType' IS DISTINCT FROM 'numeric' THEN
    PERFORM keynes_internal.invalid_policy('$.program/operand', 'type');
  END IF;
  IF (node->>'nullable')::boolean IS DISTINCT FROM (node->'operand'->>'nullable')::boolean THEN
    PERFORM keynes_internal.invalid_policy('$.program/nullable', 'nullability');
  END IF;`;
    case "power":
      return `  IF node->'base'->>'valueType' IS DISTINCT FROM 'numeric' THEN
    PERFORM keynes_internal.invalid_policy('$.program/base', 'type');
  END IF;
  IF (node->>'nullable')::boolean IS DISTINCT FROM (node->'base'->>'nullable')::boolean THEN
    PERFORM keynes_internal.invalid_policy('$.program/nullable', 'nullability');
  END IF;`;
    case "binary_numeric":
      return `  IF node->'left'->>'valueType' IS DISTINCT FROM 'numeric' OR node->'right'->>'valueType' IS DISTINCT FROM 'numeric' THEN
    PERFORM keynes_internal.invalid_policy('$.program', 'operand_type');
  END IF;
  IF (node->>'nullable')::boolean IS DISTINCT FROM ((node->'left'->>'nullable')::boolean OR (node->'right'->>'nullable')::boolean) THEN
    PERFORM keynes_internal.invalid_policy('$.program/nullable', 'nullability');
  END IF;`;
    case "comparison":
      return `  IF node->'left'->>'valueType' IS DISTINCT FROM node->'right'->>'valueType' OR
     (node->>'operator' IN ('<', '<=', '>', '>=') AND node->'left'->>'valueType' IS DISTINCT FROM 'numeric') THEN
    PERFORM keynes_internal.invalid_policy('$.program', 'operand_type');
  END IF;
  IF (node->>'nullable')::boolean IS DISTINCT FROM ((node->'left'->>'nullable')::boolean OR (node->'right'->>'nullable')::boolean) THEN
    PERFORM keynes_internal.invalid_policy('$.program/nullable', 'nullability');
  END IF;`;
    case "text_in":
      return `  IF node->'operand'->>'valueType' IS DISTINCT FROM 'text' THEN
    PERFORM keynes_internal.invalid_policy('$.program/operand', 'type');
  END IF;
  IF (node->>'nullable')::boolean IS DISTINCT FROM (node->'operand'->>'nullable')::boolean THEN
    PERFORM keynes_internal.invalid_policy('$.program/nullable', 'nullability');
  END IF;`;
    case "is_null":
      return "";
    case "boolean_binary":
      return `  IF node->'left'->>'valueType' IS DISTINCT FROM 'boolean' OR node->'right'->>'valueType' IS DISTINCT FROM 'boolean' THEN
    PERFORM keynes_internal.invalid_policy('$.program', 'operand_type');
  END IF;
  IF (node->>'nullable')::boolean IS DISTINCT FROM ((node->'left'->>'nullable')::boolean OR (node->'right'->>'nullable')::boolean) THEN
    PERFORM keynes_internal.invalid_policy('$.program/nullable', 'nullability');
  END IF;`;
    case "boolean_not":
      return `  IF node->'operand'->>'valueType' IS DISTINCT FROM 'boolean' THEN
    PERFORM keynes_internal.invalid_policy('$.program/operand', 'type');
  END IF;
  IF (node->>'nullable')::boolean IS DISTINCT FROM (node->'operand'->>'nullable')::boolean THEN
    PERFORM keynes_internal.invalid_policy('$.program/nullable', 'nullability');
  END IF;`;
    case "case":
      return `  IF jsonb_path_exists(node, 'strict $.** ? (@.kind == "aggregate")') THEN
    PERFORM keynes_internal.invalid_policy('$.program', 'aggregate');
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(node->'branches') branch
     WHERE branch->'when'->>'valueType' IS DISTINCT FROM 'boolean'
        OR branch->'then'->>'valueType' IS DISTINCT FROM node->>'valueType'
  ) OR node->'else'->>'valueType' IS DISTINCT FROM node->>'valueType' THEN
    PERFORM keynes_internal.invalid_policy('$.program', 'branch_type');
  END IF;
  IF (node->>'nullable')::boolean IS DISTINCT FROM (
    (node->'else'->>'nullable')::boolean OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(node->'branches') branch
       WHERE (branch->'then'->>'nullable')::boolean
    )
  ) THEN
    PERFORM keynes_internal.invalid_policy('$.program/nullable', 'nullability');
  END IF;`;
    case "variadic":
      return `  IF node->>'function' = 'coalesce' AND EXISTS (
    SELECT 1
      FROM jsonb_array_elements(node->'arguments') WITH ORDINALITY AS argument(value, ordinality)
     WHERE argument.ordinality > 1
       AND jsonb_path_exists(argument.value, 'strict $.** ? (@.kind == "aggregate")')
  ) THEN
    PERFORM keynes_internal.invalid_policy('$.program', 'aggregate');
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(node->'arguments') argument
     WHERE argument->>'valueType' IS DISTINCT FROM node->>'valueType'
  ) THEN
    PERFORM keynes_internal.invalid_policy('$.program/arguments', 'type');
  END IF;
  IF (node->>'nullable')::boolean IS DISTINCT FROM (NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(node->'arguments') argument
     WHERE NOT (argument->>'nullable')::boolean
  )) THEN
    PERFORM keynes_internal.invalid_policy('$.program/nullable', 'nullability');
  END IF;`;
    case "aggregate":
      return `  IF node->>'function' IS DISTINCT FROM 'count' AND node->'operand'->>'valueType' IS DISTINCT FROM 'numeric' THEN
    PERFORM keynes_internal.invalid_policy('$.program/operand', 'type');
  END IF;
  IF (node->>'nullable')::boolean IS DISTINCT FROM (node->>'function' IS DISTINCT FROM 'count') THEN
    PERFORM keynes_internal.invalid_policy('$.program/nullable', 'nullability');
  END IF;`;
    default:
      throw new Error(`Policy node ${kind} lacks semantic validation`);
  }
}

function renderPolicyRenderer(
  kind: string,
  profile: LoadedPolicyProfile,
): string {
  const name = profile.source.nodes[kind]?.backends.postgresql.renderer;
  if (name === undefined)
    throw new Error(`Policy node ${kind} lacks a renderer`);
  return `CREATE OR REPLACE FUNCTION keynes_internal.${name}(node jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT ${policyRendererExpression(kind)};
$$;`;
}

function policyRendererExpression(kind: string): string {
  const child = (field: string) =>
    `keynes_internal.render_policy_node(node->${sqlLiteral(field)})`;
  switch (kind) {
    case "select":
      return `'WITH requested_resources AS (SELECT resource COLLATE "C" AS resource, amount::numeric(38,18) AS amount FROM jsonb_to_recordset($1::jsonb) AS input(resource text, amount numeric)), available_resources AS (SELECT resource COLLATE "C" AS resource, amount::numeric(38,18) AS amount FROM jsonb_to_recordset($2::jsonb) AS input(resource text, amount numeric)), policy_context AS (SELECT $3::jsonb AS value) SELECT ' || ${child("resource")} || ' AS resource, (' || ${child("ceiling")} || ')::numeric(38,18) AS ceiling, ' || ${child("reason")} || ' AS reason FROM requested_resources AS requested ' || keynes_internal.render_policy_node(node->'availabilityJoin') || ' CROSS JOIN policy_context AS context' || CASE WHEN node->'where' = 'null'::jsonb THEN '' ELSE ' WHERE ' || ${child("where")} END || CASE WHEN jsonb_array_length(node->'groupBy') = 0 THEN '' ELSE ' GROUP BY ' || (SELECT string_agg(keynes_internal.render_policy_node(value), ', ' ORDER BY ordinality) FROM jsonb_array_elements(node->'groupBy') WITH ORDINALITY) END || ' ORDER BY resource ASC, reason ASC, ceiling ASC'`;
    case "inner_join":
      return `'INNER JOIN available_resources AS available USING (resource)'`;
    case "cross_join":
      return `'CROSS JOIN available_resources AS available'`;
    case "decimal_literal":
      return `'keynes_internal.policy_runtime_numeric(' || quote_literal(node->>'value') || '::numeric(38,18))'`;
    case "text_literal":
      return `quote_literal(node->>'value') || '::text COLLATE "C"'`;
    case "boolean_literal":
      return `CASE node->>'value' WHEN 'true' THEN 'TRUE' ELSE 'FALSE' END`;
    case "null_literal":
      return `CASE node->>'valueType' WHEN 'numeric' THEN 'NULL::numeric(38,18)' WHEN 'boolean' THEN 'NULL::boolean' ELSE 'NULL::text COLLATE "C"' END`;
    case "reference":
      return `CASE (node->>'source') || '.' || (node->>'field') WHEN 'requested.resource' THEN 'requested.resource' WHEN 'requested.amount' THEN 'requested.amount' WHEN 'available.resource' THEN 'available.resource' WHEN 'available.amount' THEN 'available.amount' ELSE CASE node->>'valueType' WHEN 'numeric' THEN '(context.value->>' || quote_literal(node->>'field') || ')::numeric(38,18)' WHEN 'boolean' THEN '(context.value->>' || quote_literal(node->>'field') || ')::boolean' ELSE '(context.value->>' || quote_literal(node->>'field') || ') COLLATE "C"' END END`;
    case "unary_numeric":
      return `'( ' || (node->>'operator') || ${child("operand")} || ' )::numeric(38,18)'`;
    case "binary_numeric":
      return `'( ' || ${child("left")} || ' ' || (node->>'operator') || ' ' || ${child("right")} || ' )::numeric(38,18)'`;
    case "comparison":
      return `'( ' || ${child("left")} || ' ' || (node->>'operator') || ' ' || ${child("right")} || ' )'`;
    case "text_in":
      return `'(' || ${child("operand")} || ' IN (' || (SELECT string_agg(quote_literal(value), ', ' ORDER BY ordinality) FROM jsonb_array_elements_text(node->'values') WITH ORDINALITY) || '))'`;
    case "is_null":
      return `'(' || ${child("operand")} || CASE node->>'operator' WHEN 'is_null' THEN ' IS NULL)' ELSE ' IS NOT NULL)' END`;
    case "boolean_binary":
      return `CASE node->>'operator'
        WHEN 'and' THEN '(SELECT CASE lhs.value WHEN FALSE THEN FALSE ELSE (' || ${child("right")} || ' AND lhs.value) END FROM (VALUES (' || ${child("left")} || ')) AS lhs(value))'
        WHEN 'or' THEN '(SELECT CASE lhs.value WHEN TRUE THEN TRUE ELSE (' || ${child("right")} || ' OR lhs.value) END FROM (VALUES (' || ${child("left")} || ')) AS lhs(value))'
      END`;
    case "boolean_not":
      return `'(NOT ' || ${child("operand")} || ')'`;
    case "case":
      return `'(' || 'CASE ' || (SELECT string_agg('WHEN ' || keynes_internal.render_policy_node(value->'when') || ' THEN ' || keynes_internal.render_policy_node(value->'then'), ' ' ORDER BY ordinality) FROM jsonb_array_elements(node->'branches') WITH ORDINALITY) || ' ELSE ' || ${child("else")} || ' END)' || CASE node->>'valueType' WHEN 'numeric' THEN '::numeric(38,18)' ELSE '' END`;
    case "variadic":
      return `'(' || lower(node->>'function') || '(' || (SELECT string_agg(keynes_internal.render_policy_node(value), ', ' ORDER BY ordinality) FROM jsonb_array_elements(node->'arguments') WITH ORDINALITY) || '))' || CASE node->>'valueType' WHEN 'numeric' THEN '::numeric(38,18)' ELSE '' END`;
    case "numeric_function":
      return `lower(node->>'function') || '(' || ${child("operand")} || ')::numeric(38,18)'`;
    case "scale_function":
      return `lower(node->>'function') || '(' || ${child("operand")} || ', ' || (node->>'scale')::integer || ')::numeric(38,18)'`;
    case "power":
      return `'power(' || ${child("base")} || ', ' || (node->>'exponent')::integer || ')::numeric(38,18)'`;
    case "aggregate":
      return `CASE node->>'function'
        WHEN 'sum' THEN 'keynes_internal.policy_sum(array_agg(' || ${child("operand")} || ' ORDER BY requested.resource COLLATE "C", available.resource COLLATE "C"))'
        WHEN 'avg' THEN 'keynes_internal.policy_avg(array_agg(' || ${child("operand")} || ' ORDER BY requested.resource COLLATE "C", available.resource COLLATE "C"))'
        ELSE lower(node->>'function') || '(' || ${child("operand")} || ')'
      END || '::numeric(38,18)'`;
    default:
      throw new Error(`Policy node ${kind} lacks a renderer template`);
  }
}

function policyWorkBound(
  program: JsonObject,
  profile: LoadedPolicyProfile,
  requestedRows: number,
  availableRows: number,
): number {
  const stats = policyExpressionWork(program, profile);
  if (program.kind !== "select") return stats.unitWork;

  const requested = Math.max(requestedRows, 0);
  const available = Math.max(availableRows, 0);
  const availabilityJoin = asJsonObject(program.availabilityJoin);
  const joined =
    availabilityJoin?.kind === "cross_join" ? requested * available : requested;
  const select = profile.source.nodes.select?.work ?? {};
  const join =
    availabilityJoin?.kind === "cross_join"
      ? profile.source.nodes.cross_join?.work
      : profile.source.nodes.inner_join?.work;
  const resultRows = profile.source.limits.resultRows ?? 0;
  return (
    (select.base ?? 0) +
    requested * (select.perRequestedRow ?? 0) +
    available * (select.perAvailabilityRow ?? 0) +
    joined * (select.perGroupTransition ?? 0) +
    resultRows *
      Math.ceil(Math.log2(Math.max(resultRows, 1))) *
      (select.perResultSortComparison ?? 0) +
    joined *
      (availabilityJoin?.kind === "cross_join"
        ? (join?.perJoinedRow ?? 0)
        : (join?.perRequestedRow ?? 0)) +
    stats.unitWork * joined +
    stats.aggregates *
      joined *
      (profile.source.nodes.aggregate?.work.perInputRow ?? 0)
  );
}

function policyExpressionWork(
  value: unknown,
  profile: LoadedPolicyProfile,
): { readonly unitWork: number; readonly aggregates: number } {
  const node = asJsonObject(value);
  const members = Array.isArray(value)
    ? value
    : node === undefined
      ? []
      : Object.values(node);
  let unitWork = 0;
  let aggregates = 0;
  for (const member of members) {
    const child = policyExpressionWork(member, profile);
    unitWork += child.unitWork;
    aggregates += child.aggregates;
  }
  const children = { unitWork, aggregates };
  if (node === undefined) return children;
  if (typeof node.kind !== "string") return children;
  const definition = profile.source.nodes[node.kind];
  if (definition?.category !== "expression") return children;
  const work = definition.work;
  return {
    unitWork:
      children.unitWork +
      (work.base ?? 0) +
      (work.perMember ?? 0) * arrayLength(node.values) +
      (work.perBranch ?? 0) * arrayLength(node.branches) +
      (work.perArgument ?? 0) * arrayLength(node.arguments) +
      (work.perExponentStep ?? 0) *
        (typeof node.exponent === "number" ? node.exponent : 0),
    aggregates: children.aggregates + (node.kind === "aggregate" ? 1 : 0),
  };
}

function asJsonObject(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export function expectedPostgresObjects(
  profile: LoadedPolicyProfile,
): readonly string[] {
  return [
    ...EXPECTED_POSTGRES_OBJECTS,
    ...policyFunctionSignatures(profile).map(
      (signature) => `function:keynes_internal.${signature}`,
    ),
  ];
}

function policyFunctionSignatures(
  profile: LoadedPolicyProfile,
): readonly string[] {
  return [
    "apply_command_legacy(operation_name text,input jsonb)",
    "policy_canonical_json(value jsonb)",
    "canonical_policy_set(policies jsonb)",
    "policy_sum(input_values numeric[])",
    "policy_avg(input_values numeric[])",
    "policy_runtime_numeric(value numeric)",
    "invalid_policy(issue_path text,issue_rule text)",
    "policy_assert_exact_keys(value jsonb,expected_keys text[],issue_path text)",
    "validate_policy_descriptor(value jsonb,descriptor jsonb,issue_path text)",
    "validate_policy_node(node jsonb)",
    "render_policy_node(node jsonb)",
    "validate_policy_program(program jsonb)",
    "render_policy_program(program jsonb)",
    "canonical_policy_expression(node jsonb)",
    "canonical_policy_parenthesize(node jsonb)",
    "canonical_policy_sql(program jsonb)",
    "policy_work_bound(program jsonb,requested_rows integer,available_rows integer)",
    "validate_policy_set(policies jsonb)",
    "validate_policy_context(policies jsonb,context jsonb)",
    "evaluate_policy_set(selected_tenant uuid,selected_budget uuid,policies jsonb,requested_items jsonb,context jsonb)",
    "check_policy_canonical_vectors()",
    ...profile.nodeKinds.flatMap((kind) => {
      const backend = profile.source.nodes[kind]?.backends.postgresql;
      if (backend === undefined)
        throw new Error(`Policy node ${kind} lacks PostgreSQL metadata`);
      return [
        `${backend.validator}(node jsonb)`,
        `${backend.renderer}(node jsonb)`,
      ];
    }),
  ];
}
