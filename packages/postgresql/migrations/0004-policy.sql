-- Generated from packages/contracts/policy-profile.json. Do not edit.
-- Policy profile SHA-256: 7122249f6b0a5402c13cdb54f9af6dfbb454357cfe3e7ff0ca9f036854c0b486

CREATE OR REPLACE FUNCTION keynes_internal.invalid_policy(issue_path text, issue_rule text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog
AS $$
BEGIN
  PERFORM keynes_internal.raise_domain_error(
    'invalid_policy',
    jsonb_build_object('issues', jsonb_build_array(jsonb_build_object('path', issue_path, 'rule', issue_rule)))
  );
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
      IF jsonb_typeof(value) IS DISTINCT FROM 'string' OR (value #>> '{}') !~ '^-?(0|[1-9][0-9]*)(\.[0-9]+)?$' THEN
        PERFORM keynes_internal.invalid_policy(issue_path, 'numeric');
      END IF;
      BEGIN
        PERFORM (value #>> '{}')::numeric(38,18);
      EXCEPTION WHEN numeric_value_out_of_range THEN
        PERFORM keynes_internal.invalid_policy(issue_path, 'numeric');
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
      IF descriptor ? 'group' AND ('{"select":"program","inner_join":"join","cross_join":"join","decimal_literal":"expression","text_literal":"expression","boolean_literal":"expression","null_literal":"expression","reference":"expression","unary_numeric":"expression","binary_numeric":"expression","comparison":"expression","text_in":"expression","is_null":"expression","boolean_binary":"expression","boolean_not":"expression","case":"expression","variadic":"expression","numeric_function":"expression","scale_function":"expression","power":"expression","aggregate":"expression"}'::jsonb->>(value->>'kind')) IS DISTINCT FROM descriptor->>'group' THEN
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
    WHEN 'select' THEN PERFORM keynes_internal.validate_select(node);
    WHEN 'inner_join' THEN PERFORM keynes_internal.validate_inner_join(node);
    WHEN 'cross_join' THEN PERFORM keynes_internal.validate_cross_join(node);
    WHEN 'decimal_literal' THEN PERFORM keynes_internal.validate_decimal_literal(node);
    WHEN 'text_literal' THEN PERFORM keynes_internal.validate_text_literal(node);
    WHEN 'boolean_literal' THEN PERFORM keynes_internal.validate_boolean_literal(node);
    WHEN 'null_literal' THEN PERFORM keynes_internal.validate_null_literal(node);
    WHEN 'reference' THEN PERFORM keynes_internal.validate_reference(node);
    WHEN 'unary_numeric' THEN PERFORM keynes_internal.validate_unary_numeric(node);
    WHEN 'binary_numeric' THEN PERFORM keynes_internal.validate_binary_numeric(node);
    WHEN 'comparison' THEN PERFORM keynes_internal.validate_comparison(node);
    WHEN 'text_in' THEN PERFORM keynes_internal.validate_text_in(node);
    WHEN 'is_null' THEN PERFORM keynes_internal.validate_is_null(node);
    WHEN 'boolean_binary' THEN PERFORM keynes_internal.validate_boolean_binary(node);
    WHEN 'boolean_not' THEN PERFORM keynes_internal.validate_boolean_not(node);
    WHEN 'case' THEN PERFORM keynes_internal.validate_case(node);
    WHEN 'variadic' THEN PERFORM keynes_internal.validate_variadic(node);
    WHEN 'numeric_function' THEN PERFORM keynes_internal.validate_numeric_function(node);
    WHEN 'scale_function' THEN PERFORM keynes_internal.validate_scale_function(node);
    WHEN 'power' THEN PERFORM keynes_internal.validate_power(node);
    WHEN 'aggregate' THEN PERFORM keynes_internal.validate_aggregate(node);
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
    WHEN 'select' THEN RETURN keynes_internal.render_select(node);
    WHEN 'inner_join' THEN RETURN keynes_internal.render_inner_join(node);
    WHEN 'cross_join' THEN RETURN keynes_internal.render_cross_join(node);
    WHEN 'decimal_literal' THEN RETURN keynes_internal.render_decimal_literal(node);
    WHEN 'text_literal' THEN RETURN keynes_internal.render_text_literal(node);
    WHEN 'boolean_literal' THEN RETURN keynes_internal.render_boolean_literal(node);
    WHEN 'null_literal' THEN RETURN keynes_internal.render_null_literal(node);
    WHEN 'reference' THEN RETURN keynes_internal.render_reference(node);
    WHEN 'unary_numeric' THEN RETURN keynes_internal.render_unary_numeric(node);
    WHEN 'binary_numeric' THEN RETURN keynes_internal.render_binary_numeric(node);
    WHEN 'comparison' THEN RETURN keynes_internal.render_comparison(node);
    WHEN 'text_in' THEN RETURN keynes_internal.render_text_in(node);
    WHEN 'is_null' THEN RETURN keynes_internal.render_is_null(node);
    WHEN 'boolean_binary' THEN RETURN keynes_internal.render_boolean_binary(node);
    WHEN 'boolean_not' THEN RETURN keynes_internal.render_boolean_not(node);
    WHEN 'case' THEN RETURN keynes_internal.render_case(node);
    WHEN 'variadic' THEN RETURN keynes_internal.render_variadic(node);
    WHEN 'numeric_function' THEN RETURN keynes_internal.render_numeric_function(node);
    WHEN 'scale_function' THEN RETURN keynes_internal.render_scale_function(node);
    WHEN 'power' THEN RETURN keynes_internal.render_power(node);
    WHEN 'aggregate' THEN RETURN keynes_internal.render_aggregate(node);
    ELSE PERFORM keynes_internal.invalid_policy('$.program.kind', 'enum');
  END CASE;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.validate_select(node jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  field record;
BEGIN
  IF jsonb_typeof(node) IS DISTINCT FROM 'object' OR node->>'kind' IS DISTINCT FROM 'select' THEN
    PERFORM keynes_internal.invalid_policy('$.program.kind', 'const');
  END IF;
  PERFORM keynes_internal.policy_assert_exact_keys(node, ARRAY['availabilityJoin', 'ceiling', 'groupBy', 'kind', 'orderBy', 'reason', 'resource', 'where'], '$.program');
  FOR field IN SELECT key, value AS descriptor FROM jsonb_each('{"availabilityJoin":{"type":"node","group":"join"},"resource":{"type":"node","group":"expression"},"ceiling":{"type":"node","group":"expression"},"reason":{"type":"node","group":"expression"},"where":{"type":"nullable","value":{"type":"node","group":"expression"}},"groupBy":{"type":"array","items":{"type":"node","group":"expression"},"maxItems":32},"orderBy":{"type":"literal","value":["resource","reason","ceiling"]}}'::jsonb)
  LOOP
    PERFORM keynes_internal.validate_policy_descriptor(node->field.key, field.descriptor, '$.program/' || field.key);
  END LOOP;
  IF node->'resource'->>'valueType' IS DISTINCT FROM 'text' OR (node->'resource'->>'nullable')::boolean OR
     node->'ceiling'->>'valueType' IS DISTINCT FROM 'numeric' OR (node->'ceiling'->>'nullable')::boolean OR
     node->'reason'->>'valueType' IS DISTINCT FROM 'text' OR (node->'reason'->>'nullable')::boolean THEN
    PERFORM keynes_internal.invalid_policy('$.program', 'result_type');
  END IF;
  IF node->'where' IS DISTINCT FROM 'null'::jsonb AND node->'where'->>'valueType' IS DISTINCT FROM 'boolean' THEN
    PERFORM keynes_internal.invalid_policy('$.program/where', 'type');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.validate_inner_join(node jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  field record;
BEGIN
  IF jsonb_typeof(node) IS DISTINCT FROM 'object' OR node->>'kind' IS DISTINCT FROM 'inner_join' THEN
    PERFORM keynes_internal.invalid_policy('$.program.kind', 'const');
  END IF;
  PERFORM keynes_internal.policy_assert_exact_keys(node, ARRAY['kind'], '$.program');
  FOR field IN SELECT key, value AS descriptor FROM jsonb_each('{}'::jsonb)
  LOOP
    PERFORM keynes_internal.validate_policy_descriptor(node->field.key, field.descriptor, '$.program/' || field.key);
  END LOOP;

END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.validate_cross_join(node jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  field record;
BEGIN
  IF jsonb_typeof(node) IS DISTINCT FROM 'object' OR node->>'kind' IS DISTINCT FROM 'cross_join' THEN
    PERFORM keynes_internal.invalid_policy('$.program.kind', 'const');
  END IF;
  PERFORM keynes_internal.policy_assert_exact_keys(node, ARRAY['kind'], '$.program');
  FOR field IN SELECT key, value AS descriptor FROM jsonb_each('{}'::jsonb)
  LOOP
    PERFORM keynes_internal.validate_policy_descriptor(node->field.key, field.descriptor, '$.program/' || field.key);
  END LOOP;

END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.validate_decimal_literal(node jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  field record;
BEGIN
  IF jsonb_typeof(node) IS DISTINCT FROM 'object' OR node->>'kind' IS DISTINCT FROM 'decimal_literal' THEN
    PERFORM keynes_internal.invalid_policy('$.program.kind', 'const');
  END IF;
  PERFORM keynes_internal.policy_assert_exact_keys(node, ARRAY['kind', 'nullable', 'value', 'valueType'], '$.program');
  FOR field IN SELECT key, value AS descriptor FROM jsonb_each('{"value":{"type":"decimal"},"valueType":{"type":"literal","value":"numeric"},"nullable":{"type":"literal","value":false}}'::jsonb)
  LOOP
    PERFORM keynes_internal.validate_policy_descriptor(node->field.key, field.descriptor, '$.program/' || field.key);
  END LOOP;

END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.validate_text_literal(node jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  field record;
BEGIN
  IF jsonb_typeof(node) IS DISTINCT FROM 'object' OR node->>'kind' IS DISTINCT FROM 'text_literal' THEN
    PERFORM keynes_internal.invalid_policy('$.program.kind', 'const');
  END IF;
  PERFORM keynes_internal.policy_assert_exact_keys(node, ARRAY['kind', 'nullable', 'value', 'valueType'], '$.program');
  FOR field IN SELECT key, value AS descriptor FROM jsonb_each('{"value":{"type":"string","pattern":"^[^\\u0000]*$","maxLength":256,"maxUtf8Bytes":256},"valueType":{"type":"literal","value":"text"},"nullable":{"type":"literal","value":false}}'::jsonb)
  LOOP
    PERFORM keynes_internal.validate_policy_descriptor(node->field.key, field.descriptor, '$.program/' || field.key);
  END LOOP;

END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.validate_boolean_literal(node jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  field record;
BEGIN
  IF jsonb_typeof(node) IS DISTINCT FROM 'object' OR node->>'kind' IS DISTINCT FROM 'boolean_literal' THEN
    PERFORM keynes_internal.invalid_policy('$.program.kind', 'const');
  END IF;
  PERFORM keynes_internal.policy_assert_exact_keys(node, ARRAY['kind', 'nullable', 'value', 'valueType'], '$.program');
  FOR field IN SELECT key, value AS descriptor FROM jsonb_each('{"value":{"type":"boolean"},"valueType":{"type":"literal","value":"boolean"},"nullable":{"type":"literal","value":false}}'::jsonb)
  LOOP
    PERFORM keynes_internal.validate_policy_descriptor(node->field.key, field.descriptor, '$.program/' || field.key);
  END LOOP;

END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.validate_null_literal(node jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  field record;
BEGIN
  IF jsonb_typeof(node) IS DISTINCT FROM 'object' OR node->>'kind' IS DISTINCT FROM 'null_literal' THEN
    PERFORM keynes_internal.invalid_policy('$.program.kind', 'const');
  END IF;
  PERFORM keynes_internal.policy_assert_exact_keys(node, ARRAY['kind', 'nullable', 'value', 'valueType'], '$.program');
  FOR field IN SELECT key, value AS descriptor FROM jsonb_each('{"value":{"type":"literal","value":null},"valueType":{"type":"enum","values":["numeric","text","boolean"]},"nullable":{"type":"literal","value":true}}'::jsonb)
  LOOP
    PERFORM keynes_internal.validate_policy_descriptor(node->field.key, field.descriptor, '$.program/' || field.key);
  END LOOP;

END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.validate_reference(node jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  field record;
BEGIN
  IF jsonb_typeof(node) IS DISTINCT FROM 'object' OR node->>'kind' IS DISTINCT FROM 'reference' THEN
    PERFORM keynes_internal.invalid_policy('$.program.kind', 'const');
  END IF;
  PERFORM keynes_internal.policy_assert_exact_keys(node, ARRAY['field', 'kind', 'nullable', 'source', 'valueType'], '$.program');
  FOR field IN SELECT key, value AS descriptor FROM jsonb_each('{"source":{"type":"enum","values":["requested","available","context"]},"field":{"type":"string","pattern":"^[a-z][a-z0-9_]{0,62}$"},"valueType":{"type":"enum","values":["numeric","text","boolean"]},"nullable":{"type":"boolean"}}'::jsonb)
  LOOP
    PERFORM keynes_internal.validate_policy_descriptor(node->field.key, field.descriptor, '$.program/' || field.key);
  END LOOP;
  IF node->>'source' IN ('requested', 'available') AND
     (CASE node->>'field' WHEN 'resource' THEN 'text' WHEN 'amount' THEN 'numeric' END) IS DISTINCT FROM node->>'valueType' THEN
    PERFORM keynes_internal.invalid_policy('$.program/field', 'type');
  END IF;
  IF node->>'source' IN ('requested', 'available') AND (node->>'nullable')::boolean THEN
    PERFORM keynes_internal.invalid_policy('$.program/nullable', 'const');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.validate_unary_numeric(node jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  field record;
BEGIN
  IF jsonb_typeof(node) IS DISTINCT FROM 'object' OR node->>'kind' IS DISTINCT FROM 'unary_numeric' THEN
    PERFORM keynes_internal.invalid_policy('$.program.kind', 'const');
  END IF;
  PERFORM keynes_internal.policy_assert_exact_keys(node, ARRAY['kind', 'nullable', 'operand', 'operator', 'valueType'], '$.program');
  FOR field IN SELECT key, value AS descriptor FROM jsonb_each('{"operator":{"type":"enum","values":["+","-"]},"operand":{"type":"node","group":"expression"},"valueType":{"type":"literal","value":"numeric"},"nullable":{"type":"boolean"}}'::jsonb)
  LOOP
    PERFORM keynes_internal.validate_policy_descriptor(node->field.key, field.descriptor, '$.program/' || field.key);
  END LOOP;
  IF node->'operand'->>'valueType' IS DISTINCT FROM 'numeric' THEN
    PERFORM keynes_internal.invalid_policy('$.program/operand', 'type');
  END IF;
  IF (node->>'nullable')::boolean IS DISTINCT FROM (node->'operand'->>'nullable')::boolean THEN
    PERFORM keynes_internal.invalid_policy('$.program/nullable', 'nullability');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.validate_binary_numeric(node jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  field record;
BEGIN
  IF jsonb_typeof(node) IS DISTINCT FROM 'object' OR node->>'kind' IS DISTINCT FROM 'binary_numeric' THEN
    PERFORM keynes_internal.invalid_policy('$.program.kind', 'const');
  END IF;
  PERFORM keynes_internal.policy_assert_exact_keys(node, ARRAY['kind', 'left', 'nullable', 'operator', 'right', 'valueType'], '$.program');
  FOR field IN SELECT key, value AS descriptor FROM jsonb_each('{"operator":{"type":"enum","values":["+","-","*","/","%"]},"left":{"type":"node","group":"expression"},"right":{"type":"node","group":"expression"},"valueType":{"type":"literal","value":"numeric"},"nullable":{"type":"boolean"}}'::jsonb)
  LOOP
    PERFORM keynes_internal.validate_policy_descriptor(node->field.key, field.descriptor, '$.program/' || field.key);
  END LOOP;
  IF node->'left'->>'valueType' IS DISTINCT FROM 'numeric' OR node->'right'->>'valueType' IS DISTINCT FROM 'numeric' THEN
    PERFORM keynes_internal.invalid_policy('$.program', 'operand_type');
  END IF;
  IF (node->>'nullable')::boolean IS DISTINCT FROM ((node->'left'->>'nullable')::boolean OR (node->'right'->>'nullable')::boolean) THEN
    PERFORM keynes_internal.invalid_policy('$.program/nullable', 'nullability');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.validate_comparison(node jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  field record;
BEGIN
  IF jsonb_typeof(node) IS DISTINCT FROM 'object' OR node->>'kind' IS DISTINCT FROM 'comparison' THEN
    PERFORM keynes_internal.invalid_policy('$.program.kind', 'const');
  END IF;
  PERFORM keynes_internal.policy_assert_exact_keys(node, ARRAY['kind', 'left', 'nullable', 'operator', 'right', 'valueType'], '$.program');
  FOR field IN SELECT key, value AS descriptor FROM jsonb_each('{"operator":{"type":"enum","values":["=","<>","<","<=",">",">="]},"left":{"type":"node","group":"expression"},"right":{"type":"node","group":"expression"},"valueType":{"type":"literal","value":"boolean"},"nullable":{"type":"boolean"}}'::jsonb)
  LOOP
    PERFORM keynes_internal.validate_policy_descriptor(node->field.key, field.descriptor, '$.program/' || field.key);
  END LOOP;
  IF node->'left'->>'valueType' IS DISTINCT FROM node->'right'->>'valueType' OR
     (node->>'operator' IN ('<', '<=', '>', '>=') AND node->'left'->>'valueType' IS DISTINCT FROM 'numeric') THEN
    PERFORM keynes_internal.invalid_policy('$.program', 'operand_type');
  END IF;
  IF (node->>'nullable')::boolean IS DISTINCT FROM ((node->'left'->>'nullable')::boolean OR (node->'right'->>'nullable')::boolean) THEN
    PERFORM keynes_internal.invalid_policy('$.program/nullable', 'nullability');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.validate_text_in(node jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  field record;
BEGIN
  IF jsonb_typeof(node) IS DISTINCT FROM 'object' OR node->>'kind' IS DISTINCT FROM 'text_in' THEN
    PERFORM keynes_internal.invalid_policy('$.program.kind', 'const');
  END IF;
  PERFORM keynes_internal.policy_assert_exact_keys(node, ARRAY['kind', 'nullable', 'operand', 'valueType', 'values'], '$.program');
  FOR field IN SELECT key, value AS descriptor FROM jsonb_each('{"operand":{"type":"node","group":"expression"},"values":{"type":"array","items":{"type":"string","pattern":"^[^\\u0000]*$","maxLength":256,"maxUtf8Bytes":256},"minItems":1,"maxItems":64},"valueType":{"type":"literal","value":"boolean"},"nullable":{"type":"boolean"}}'::jsonb)
  LOOP
    PERFORM keynes_internal.validate_policy_descriptor(node->field.key, field.descriptor, '$.program/' || field.key);
  END LOOP;
  IF node->'operand'->>'valueType' IS DISTINCT FROM 'text' THEN
    PERFORM keynes_internal.invalid_policy('$.program/operand', 'type');
  END IF;
  IF (node->>'nullable')::boolean IS DISTINCT FROM (node->'operand'->>'nullable')::boolean THEN
    PERFORM keynes_internal.invalid_policy('$.program/nullable', 'nullability');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.validate_is_null(node jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  field record;
BEGIN
  IF jsonb_typeof(node) IS DISTINCT FROM 'object' OR node->>'kind' IS DISTINCT FROM 'is_null' THEN
    PERFORM keynes_internal.invalid_policy('$.program.kind', 'const');
  END IF;
  PERFORM keynes_internal.policy_assert_exact_keys(node, ARRAY['kind', 'nullable', 'operand', 'operator', 'valueType'], '$.program');
  FOR field IN SELECT key, value AS descriptor FROM jsonb_each('{"operator":{"type":"enum","values":["is_null","is_not_null"]},"operand":{"type":"node","group":"expression"},"valueType":{"type":"literal","value":"boolean"},"nullable":{"type":"literal","value":false}}'::jsonb)
  LOOP
    PERFORM keynes_internal.validate_policy_descriptor(node->field.key, field.descriptor, '$.program/' || field.key);
  END LOOP;

END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.validate_boolean_binary(node jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  field record;
BEGIN
  IF jsonb_typeof(node) IS DISTINCT FROM 'object' OR node->>'kind' IS DISTINCT FROM 'boolean_binary' THEN
    PERFORM keynes_internal.invalid_policy('$.program.kind', 'const');
  END IF;
  PERFORM keynes_internal.policy_assert_exact_keys(node, ARRAY['kind', 'left', 'nullable', 'operator', 'right', 'valueType'], '$.program');
  FOR field IN SELECT key, value AS descriptor FROM jsonb_each('{"operator":{"type":"enum","values":["and","or"]},"left":{"type":"node","group":"expression"},"right":{"type":"node","group":"expression"},"valueType":{"type":"literal","value":"boolean"},"nullable":{"type":"boolean"}}'::jsonb)
  LOOP
    PERFORM keynes_internal.validate_policy_descriptor(node->field.key, field.descriptor, '$.program/' || field.key);
  END LOOP;
  IF node->'left'->>'valueType' IS DISTINCT FROM 'boolean' OR node->'right'->>'valueType' IS DISTINCT FROM 'boolean' THEN
    PERFORM keynes_internal.invalid_policy('$.program', 'operand_type');
  END IF;
  IF (node->>'nullable')::boolean IS DISTINCT FROM ((node->'left'->>'nullable')::boolean OR (node->'right'->>'nullable')::boolean) THEN
    PERFORM keynes_internal.invalid_policy('$.program/nullable', 'nullability');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.validate_boolean_not(node jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  field record;
BEGIN
  IF jsonb_typeof(node) IS DISTINCT FROM 'object' OR node->>'kind' IS DISTINCT FROM 'boolean_not' THEN
    PERFORM keynes_internal.invalid_policy('$.program.kind', 'const');
  END IF;
  PERFORM keynes_internal.policy_assert_exact_keys(node, ARRAY['kind', 'nullable', 'operand', 'valueType'], '$.program');
  FOR field IN SELECT key, value AS descriptor FROM jsonb_each('{"operand":{"type":"node","group":"expression"},"valueType":{"type":"literal","value":"boolean"},"nullable":{"type":"boolean"}}'::jsonb)
  LOOP
    PERFORM keynes_internal.validate_policy_descriptor(node->field.key, field.descriptor, '$.program/' || field.key);
  END LOOP;
  IF node->'operand'->>'valueType' IS DISTINCT FROM 'boolean' THEN
    PERFORM keynes_internal.invalid_policy('$.program/operand', 'type');
  END IF;
  IF (node->>'nullable')::boolean IS DISTINCT FROM (node->'operand'->>'nullable')::boolean THEN
    PERFORM keynes_internal.invalid_policy('$.program/nullable', 'nullability');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.validate_case(node jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  field record;
BEGIN
  IF jsonb_typeof(node) IS DISTINCT FROM 'object' OR node->>'kind' IS DISTINCT FROM 'case' THEN
    PERFORM keynes_internal.invalid_policy('$.program.kind', 'const');
  END IF;
  PERFORM keynes_internal.policy_assert_exact_keys(node, ARRAY['branches', 'else', 'kind', 'nullable', 'valueType'], '$.program');
  FOR field IN SELECT key, value AS descriptor FROM jsonb_each('{"branches":{"type":"array","items":{"type":"object","fields":{"when":{"type":"node","group":"expression"},"then":{"type":"node","group":"expression"}}},"minItems":1,"maxItems":32},"else":{"type":"node","group":"expression"},"valueType":{"type":"enum","values":["numeric","text","boolean"]},"nullable":{"type":"boolean"}}'::jsonb)
  LOOP
    PERFORM keynes_internal.validate_policy_descriptor(node->field.key, field.descriptor, '$.program/' || field.key);
  END LOOP;
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
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.validate_variadic(node jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  field record;
BEGIN
  IF jsonb_typeof(node) IS DISTINCT FROM 'object' OR node->>'kind' IS DISTINCT FROM 'variadic' THEN
    PERFORM keynes_internal.invalid_policy('$.program.kind', 'const');
  END IF;
  PERFORM keynes_internal.policy_assert_exact_keys(node, ARRAY['arguments', 'function', 'kind', 'nullable', 'valueType'], '$.program');
  FOR field IN SELECT key, value AS descriptor FROM jsonb_each('{"function":{"type":"enum","values":["coalesce","least","greatest"]},"arguments":{"type":"array","items":{"type":"node","group":"expression"},"minItems":1,"maxItems":64},"valueType":{"type":"enum","values":["numeric","text","boolean"]},"nullable":{"type":"boolean"}}'::jsonb)
  LOOP
    PERFORM keynes_internal.validate_policy_descriptor(node->field.key, field.descriptor, '$.program/' || field.key);
  END LOOP;
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
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.validate_numeric_function(node jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  field record;
BEGIN
  IF jsonb_typeof(node) IS DISTINCT FROM 'object' OR node->>'kind' IS DISTINCT FROM 'numeric_function' THEN
    PERFORM keynes_internal.invalid_policy('$.program.kind', 'const');
  END IF;
  PERFORM keynes_internal.policy_assert_exact_keys(node, ARRAY['function', 'kind', 'nullable', 'operand', 'valueType'], '$.program');
  FOR field IN SELECT key, value AS descriptor FROM jsonb_each('{"function":{"type":"enum","values":["abs","ceil","floor","sqrt"]},"operand":{"type":"node","group":"expression"},"valueType":{"type":"literal","value":"numeric"},"nullable":{"type":"boolean"}}'::jsonb)
  LOOP
    PERFORM keynes_internal.validate_policy_descriptor(node->field.key, field.descriptor, '$.program/' || field.key);
  END LOOP;
  IF node->'operand'->>'valueType' IS DISTINCT FROM 'numeric' THEN
    PERFORM keynes_internal.invalid_policy('$.program/operand', 'type');
  END IF;
  IF (node->>'nullable')::boolean IS DISTINCT FROM (node->'operand'->>'nullable')::boolean THEN
    PERFORM keynes_internal.invalid_policy('$.program/nullable', 'nullability');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.validate_scale_function(node jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  field record;
BEGIN
  IF jsonb_typeof(node) IS DISTINCT FROM 'object' OR node->>'kind' IS DISTINCT FROM 'scale_function' THEN
    PERFORM keynes_internal.invalid_policy('$.program.kind', 'const');
  END IF;
  PERFORM keynes_internal.policy_assert_exact_keys(node, ARRAY['function', 'kind', 'nullable', 'operand', 'scale', 'valueType'], '$.program');
  FOR field IN SELECT key, value AS descriptor FROM jsonb_each('{"function":{"type":"enum","values":["round","trunc"]},"operand":{"type":"node","group":"expression"},"scale":{"type":"integer","minimum":0,"maximum":18},"valueType":{"type":"literal","value":"numeric"},"nullable":{"type":"boolean"}}'::jsonb)
  LOOP
    PERFORM keynes_internal.validate_policy_descriptor(node->field.key, field.descriptor, '$.program/' || field.key);
  END LOOP;
  IF node->'operand'->>'valueType' IS DISTINCT FROM 'numeric' THEN
    PERFORM keynes_internal.invalid_policy('$.program/operand', 'type');
  END IF;
  IF (node->>'nullable')::boolean IS DISTINCT FROM (node->'operand'->>'nullable')::boolean THEN
    PERFORM keynes_internal.invalid_policy('$.program/nullable', 'nullability');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.validate_power(node jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  field record;
BEGIN
  IF jsonb_typeof(node) IS DISTINCT FROM 'object' OR node->>'kind' IS DISTINCT FROM 'power' THEN
    PERFORM keynes_internal.invalid_policy('$.program.kind', 'const');
  END IF;
  PERFORM keynes_internal.policy_assert_exact_keys(node, ARRAY['base', 'exponent', 'kind', 'nullable', 'valueType'], '$.program');
  FOR field IN SELECT key, value AS descriptor FROM jsonb_each('{"base":{"type":"node","group":"expression"},"exponent":{"type":"integer","minimum":0,"maximum":18},"valueType":{"type":"literal","value":"numeric"},"nullable":{"type":"boolean"}}'::jsonb)
  LOOP
    PERFORM keynes_internal.validate_policy_descriptor(node->field.key, field.descriptor, '$.program/' || field.key);
  END LOOP;
  IF node->'base'->>'valueType' IS DISTINCT FROM 'numeric' THEN
    PERFORM keynes_internal.invalid_policy('$.program/base', 'type');
  END IF;
  IF (node->>'nullable')::boolean IS DISTINCT FROM (node->'base'->>'nullable')::boolean THEN
    PERFORM keynes_internal.invalid_policy('$.program/nullable', 'nullability');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.validate_aggregate(node jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  field record;
BEGIN
  IF jsonb_typeof(node) IS DISTINCT FROM 'object' OR node->>'kind' IS DISTINCT FROM 'aggregate' THEN
    PERFORM keynes_internal.invalid_policy('$.program.kind', 'const');
  END IF;
  PERFORM keynes_internal.policy_assert_exact_keys(node, ARRAY['function', 'kind', 'nullable', 'operand', 'valueType'], '$.program');
  FOR field IN SELECT key, value AS descriptor FROM jsonb_each('{"function":{"type":"enum","values":["sum","avg","min","max","count"]},"operand":{"type":"node","group":"expression"},"valueType":{"type":"literal","value":"numeric"},"nullable":{"type":"boolean"}}'::jsonb)
  LOOP
    PERFORM keynes_internal.validate_policy_descriptor(node->field.key, field.descriptor, '$.program/' || field.key);
  END LOOP;
  IF node->>'function' IS DISTINCT FROM 'count' AND node->'operand'->>'valueType' IS DISTINCT FROM 'numeric' THEN
    PERFORM keynes_internal.invalid_policy('$.program/operand', 'type');
  END IF;
  IF (node->>'nullable')::boolean IS DISTINCT FROM (node->>'function' IS DISTINCT FROM 'count') THEN
    PERFORM keynes_internal.invalid_policy('$.program/nullable', 'nullability');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.render_select(node jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT 'WITH requested_resources AS (SELECT resource COLLATE "C" AS resource, amount::numeric(38,18) AS amount FROM jsonb_to_recordset($1::jsonb) AS input(resource text, amount numeric)), available_resources AS (SELECT resource COLLATE "C" AS resource, amount::numeric(38,18) AS amount FROM jsonb_to_recordset($2::jsonb) AS input(resource text, amount numeric)), policy_context AS (SELECT $3::jsonb AS value) SELECT ' || keynes_internal.render_policy_node(node->'resource') || ' AS resource, (' || keynes_internal.render_policy_node(node->'ceiling') || ')::numeric(38,18) AS ceiling, ' || keynes_internal.render_policy_node(node->'reason') || ' AS reason FROM requested_resources AS requested ' || keynes_internal.render_policy_node(node->'availabilityJoin') || ' CROSS JOIN policy_context AS context' || CASE WHEN node->'where' = 'null'::jsonb THEN '' ELSE ' WHERE ' || keynes_internal.render_policy_node(node->'where') END || CASE WHEN jsonb_array_length(node->'groupBy') = 0 THEN '' ELSE ' GROUP BY ' || (SELECT string_agg(keynes_internal.render_policy_node(value), ', ' ORDER BY ordinality) FROM jsonb_array_elements(node->'groupBy') WITH ORDINALITY) END || ' ORDER BY resource ASC, reason ASC, ceiling ASC';
$$;

CREATE OR REPLACE FUNCTION keynes_internal.render_inner_join(node jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT 'INNER JOIN available_resources AS available USING (resource)';
$$;

CREATE OR REPLACE FUNCTION keynes_internal.render_cross_join(node jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT 'CROSS JOIN available_resources AS available';
$$;

CREATE OR REPLACE FUNCTION keynes_internal.render_decimal_literal(node jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT quote_literal(node->>'value') || '::numeric(38,18)';
$$;

CREATE OR REPLACE FUNCTION keynes_internal.render_text_literal(node jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT quote_literal(node->>'value') || '::text COLLATE "C"';
$$;

CREATE OR REPLACE FUNCTION keynes_internal.render_boolean_literal(node jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT CASE node->>'value' WHEN 'true' THEN 'TRUE' ELSE 'FALSE' END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.render_null_literal(node jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT CASE node->>'valueType' WHEN 'numeric' THEN 'NULL::numeric(38,18)' WHEN 'boolean' THEN 'NULL::boolean' ELSE 'NULL::text COLLATE "C"' END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.render_reference(node jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT CASE (node->>'source') || '.' || (node->>'field') WHEN 'requested.resource' THEN 'requested.resource' WHEN 'requested.amount' THEN 'requested.amount' WHEN 'available.resource' THEN 'available.resource' WHEN 'available.amount' THEN 'available.amount' ELSE CASE node->>'valueType' WHEN 'numeric' THEN '(context.value->>' || quote_literal(node->>'field') || ')::numeric(38,18)' WHEN 'boolean' THEN '(context.value->>' || quote_literal(node->>'field') || ')::boolean' ELSE '(context.value->>' || quote_literal(node->>'field') || ') COLLATE "C"' END END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.render_unary_numeric(node jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT '( ' || (node->>'operator') || keynes_internal.render_policy_node(node->'operand') || ' )::numeric(38,18)';
$$;

CREATE OR REPLACE FUNCTION keynes_internal.render_binary_numeric(node jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT '( ' || keynes_internal.render_policy_node(node->'left') || ' ' || (node->>'operator') || ' ' || keynes_internal.render_policy_node(node->'right') || ' )::numeric(38,18)';
$$;

CREATE OR REPLACE FUNCTION keynes_internal.render_comparison(node jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT '( ' || keynes_internal.render_policy_node(node->'left') || ' ' || (node->>'operator') || ' ' || keynes_internal.render_policy_node(node->'right') || ' )';
$$;

CREATE OR REPLACE FUNCTION keynes_internal.render_text_in(node jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT '(' || keynes_internal.render_policy_node(node->'operand') || ' IN (' || (SELECT string_agg(quote_literal(value), ', ' ORDER BY ordinality) FROM jsonb_array_elements_text(node->'values') WITH ORDINALITY) || '))';
$$;

CREATE OR REPLACE FUNCTION keynes_internal.render_is_null(node jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT '(' || keynes_internal.render_policy_node(node->'operand') || CASE node->>'operator' WHEN 'is_null' THEN ' IS NULL)' ELSE ' IS NOT NULL)' END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.render_boolean_binary(node jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT '(' || keynes_internal.render_policy_node(node->'left') || ' ' || upper(node->>'operator') || ' ' || keynes_internal.render_policy_node(node->'right') || ')';
$$;

CREATE OR REPLACE FUNCTION keynes_internal.render_boolean_not(node jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT '(NOT ' || keynes_internal.render_policy_node(node->'operand') || ')';
$$;

CREATE OR REPLACE FUNCTION keynes_internal.render_case(node jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT '(' || 'CASE ' || (SELECT string_agg('WHEN ' || keynes_internal.render_policy_node(value->'when') || ' THEN ' || keynes_internal.render_policy_node(value->'then'), ' ' ORDER BY ordinality) FROM jsonb_array_elements(node->'branches') WITH ORDINALITY) || ' ELSE ' || keynes_internal.render_policy_node(node->'else') || ' END)' || CASE node->>'valueType' WHEN 'numeric' THEN '::numeric(38,18)' ELSE '' END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.render_variadic(node jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT '(' || lower(node->>'function') || '(' || (SELECT string_agg(keynes_internal.render_policy_node(value), ', ' ORDER BY ordinality) FROM jsonb_array_elements(node->'arguments') WITH ORDINALITY) || '))' || CASE node->>'valueType' WHEN 'numeric' THEN '::numeric(38,18)' ELSE '' END;
$$;

CREATE OR REPLACE FUNCTION keynes_internal.render_numeric_function(node jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT lower(node->>'function') || '(' || keynes_internal.render_policy_node(node->'operand') || ')::numeric(38,18)';
$$;

CREATE OR REPLACE FUNCTION keynes_internal.render_scale_function(node jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT lower(node->>'function') || '(' || keynes_internal.render_policy_node(node->'operand') || ', ' || (node->>'scale')::integer || ')::numeric(38,18)';
$$;

CREATE OR REPLACE FUNCTION keynes_internal.render_power(node jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT 'power(' || keynes_internal.render_policy_node(node->'base') || ', ' || (node->>'exponent')::integer || ')::numeric(38,18)';
$$;

CREATE OR REPLACE FUNCTION keynes_internal.render_aggregate(node jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT lower(node->>'function') || '(' || keynes_internal.render_policy_node(node->'operand') || ')::numeric(38,18)';
$$;

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
  IF node_count > 512 THEN
    PERFORM keynes_internal.invalid_policy('$.program', 'node_limit');
  END IF;
  IF node_depth > 32 THEN
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
    VALUES ('{"select":{"base":1,"perRequestedRow":1,"perAvailabilityRow":1,"perGroupTransition":1,"perResultSortComparison":1},"inner_join":{"perRequestedRow":1},"cross_join":{"perJoinedRow":1},"decimal_literal":{"base":1},"text_literal":{"base":1},"boolean_literal":{"base":1},"null_literal":{"base":1},"reference":{"base":1},"unary_numeric":{"base":1},"binary_numeric":{"base":1},"comparison":{"base":1},"text_in":{"base":1,"perMember":1},"is_null":{"base":1},"boolean_binary":{"base":1},"boolean_not":{"base":1},"case":{"base":1,"perBranch":1},"variadic":{"base":1,"perArgument":1},"numeric_function":{"base":1},"scale_function":{"base":1},"power":{"base":1,"perExponentStep":1},"aggregate":{"base":1,"perInputRow":1}}'::jsonb)
  ), categories(value) AS (
    VALUES ('{"select":"program","inner_join":"join","cross_join":"join","decimal_literal":"expression","text_literal":"expression","boolean_literal":"expression","null_literal":"expression","reference":"expression","unary_numeric":"expression","binary_numeric":"expression","comparison":"expression","text_in":"expression","is_null":"expression","boolean_binary":"expression","boolean_not":"expression","case":"expression","variadic":"expression","numeric_function":"expression","scale_function":"expression","power":"expression","aggregate":"expression"}'::jsonb)
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
      + 384 * COALESCE((metadata.value->'select'->>'perResultSortComparison')::bigint, 0)
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

ALTER TABLE keynes_internal.budgets
  ADD COLUMN policies jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD CONSTRAINT budget_policies_shape CHECK (
    jsonb_typeof(policies) = 'array' AND jsonb_array_length(policies) <= 16
  );

CREATE FUNCTION keynes_internal.apply_command_legacy(operation_name text, input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal
AS $function$
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
$function$;

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

CREATE OR REPLACE FUNCTION keynes_internal.validate_policy_set(policies jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, keynes_internal
AS $$
DECLARE
  policy jsonb;
  first_context jsonb;
  ordinal integer := 0;
BEGIN
  IF jsonb_typeof(policies) IS DISTINCT FROM 'array'
    OR jsonb_array_length(policies) > 16 THEN
    PERFORM keynes_internal.invalid_policy('$.policies', 'type_or_limit');
  END IF;
  FOR policy IN SELECT value FROM jsonb_array_elements(policies) LOOP
    ordinal := ordinal + 1;
    PERFORM keynes_internal.policy_assert_exact_keys(
      policy,
      ARRAY['kind','name','revision','inputResources','outputResources','contextSchema','reasons','programVersion','queryProfileVersion','validatorVersion','limitsVersion','policyProfileDigest','program','canonicalSql','sourceDigest','definitionDigest'],
      '$.policies[' || (ordinal - 1)::text || ']'
    );
    IF policy->>'kind' IS DISTINCT FROM 'keynes.policy'
      OR policy->>'programVersion' IS DISTINCT FROM 'keynes-policy-program/v1'
      OR policy->>'queryProfileVersion' IS DISTINCT FROM 'keynes-policy-query/v1'
      OR policy->>'validatorVersion' IS DISTINCT FROM 'keynes-policy-validator/v1'
      OR policy->>'limitsVersion' IS DISTINCT FROM 'keynes-policy-limits/v1'
      OR policy->>'policyProfileDigest' IS DISTINCT FROM '7122249f6b0a5402c13cdb54f9af6dfbb454357cfe3e7ff0ca9f036854c0b486'
      OR policy->>'sourceDigest' IS DISTINCT FROM encode(sha256(convert_to(policy->>'canonicalSql', 'UTF8')), 'hex')
      OR policy->>'definitionDigest' IS DISTINCT FROM encode(sha256(convert_to(keynes_internal.policy_canonical_json(policy - 'definitionDigest'), 'UTF8')), 'hex')
      OR jsonb_typeof(policy->'inputResources') IS DISTINCT FROM 'array'
      OR jsonb_array_length(policy->'inputResources') NOT BETWEEN 1 AND 64
      OR jsonb_typeof(policy->'outputResources') IS DISTINCT FROM 'array'
      OR jsonb_array_length(policy->'outputResources') NOT BETWEEN 1 AND 64
      OR jsonb_typeof(policy->'contextSchema') IS DISTINCT FROM 'array'
      OR jsonb_array_length(policy->'contextSchema') > 32
      OR jsonb_typeof(policy->'reasons') IS DISTINCT FROM 'array'
      OR jsonb_array_length(policy->'reasons') NOT BETWEEN 1 AND 64 THEN
      PERFORM keynes_internal.invalid_policy('$.policies[' || (ordinal - 1)::text || ']', 'artifact');
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(policy->'inputResources') WITH ORDINALITY item(value, n)
      WHERE value !~ '^[a-z][a-z0-9_]{0,62}$'
         OR (n > 1 AND value <= (policy->'inputResources'->>((n - 2)::integer)))
    ) OR EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(policy->'outputResources') WITH ORDINALITY item(value, n)
      WHERE value !~ '^[a-z][a-z0-9_]{0,62}$'
         OR (n > 1 AND value <= (policy->'outputResources'->>((n - 2)::integer)))
    ) OR EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(policy->'reasons') WITH ORDINALITY item(value, n)
      WHERE value = '' OR octet_length(convert_to(value, 'UTF8')) > 256
         OR (n > 1 AND value <= (policy->'reasons'->>((n - 2)::integer)))
    ) THEN
      PERFORM keynes_internal.invalid_policy('$.policies[' || (ordinal - 1)::text || ']', 'canonical_order');
    END IF;
    PERFORM keynes_internal.validate_policy_program(policy->'program');
    IF keynes_internal.policy_work_bound(
      policy->'program', 64, 64
    ) > 65536 THEN
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
      PERFORM keynes_internal.raise_domain_error('invalid_policy_context', jsonb_build_object('issues', jsonb_build_array(jsonb_build_object('path', '$.context', 'rule', 'ungoverned'))));
    END IF;
    RETURN;
  END IF;
  IF jsonb_typeof(context) IS DISTINCT FROM 'object'
    OR octet_length(convert_to(context::text, 'UTF8')) > 8192
    OR ARRAY(SELECT member.key FROM jsonb_object_keys(context) AS member(key) ORDER BY member.key)
       IS DISTINCT FROM ARRAY(SELECT field.member->>'name' FROM jsonb_array_elements(schema) AS field(member) ORDER BY field.member->>'name') THEN
    PERFORM keynes_internal.raise_domain_error('invalid_policy_context', jsonb_build_object('issues', jsonb_build_array(jsonb_build_object('path', '$.context', 'rule', 'schema'))));
  END IF;
  FOR field IN SELECT member FROM jsonb_array_elements(schema) member LOOP
    value := context->(field->>'name');
    IF value = 'null'::jsonb AND (field->>'nullable')::boolean THEN CONTINUE; END IF;
    IF (field->>'type' = 'integer' AND (jsonb_typeof(value) IS DISTINCT FROM 'number' OR value::text !~ '^-?[0-9]+$' OR abs((value::text)::numeric) > 9007199254740991))
      OR (field->>'type' = 'text' AND (jsonb_typeof(value) IS DISTINCT FROM 'string' OR octet_length(convert_to(value #>> '{}', 'UTF8')) > 256))
      OR (field->>'type' = 'boolean' AND jsonb_typeof(value) IS DISTINCT FROM 'boolean') THEN
      PERFORM keynes_internal.raise_domain_error('invalid_policy_context', jsonb_build_object('issues', jsonb_build_array(jsonb_build_object('path', '$.context.' || (field->>'name'), 'rule', 'type'))));
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
  SELECT jsonb_agg(jsonb_build_object('resource', resource_type.canonical_name, 'amount', (item->>'amount')::numeric) ORDER BY resource_type.canonical_name)
    INTO requested_named
    FROM jsonb_array_elements(requested_items) item
    JOIN keynes_internal.resource_types resource_type
      ON resource_type.tenant_id = selected_tenant AND resource_type.resource_type_id = (item->>'resourceTypeId')::uuid;
  SELECT coalesce(jsonb_agg(jsonb_build_object('resource', resource_type.canonical_name, 'amount', (resource->>'available')::numeric) ORDER BY resource_type.canonical_name), '[]'::jsonb)
    INTO available_named
    FROM jsonb_array_elements(keynes_internal.budget_projection(selected_tenant, selected_budget)->'resources') resource
    JOIN keynes_internal.resource_types resource_type
      ON resource_type.tenant_id = selected_tenant AND resource_type.resource_type_id = (resource->'resourceType'->>'resourceTypeId')::uuid;
  FOR policy IN SELECT value FROM jsonb_array_elements(policies) LOOP
    rendered := keynes_internal.render_policy_program(policy->'program');
    BEGIN
      EXECUTE 'SELECT coalesce(jsonb_agg(to_jsonb(policy_result) ORDER BY resource COLLATE "C", reason COLLATE "C", ceiling), ''[]''::jsonb) FROM (' || rendered || ') policy_result'
        INTO rows USING requested_named, available_named, context;
    EXCEPTION WHEN OTHERS THEN
      PERFORM keynes_internal.raise_domain_error('policy_evaluation_failed', jsonb_build_object('policyName', policy->>'name', 'policyRevision', (policy->>'revision')::numeric));
    END;
    IF jsonb_array_length(rows) > 64 OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(rows) row
      WHERE row - ARRAY['resource','ceiling','reason']::text[] <> '{}'::jsonb
         OR jsonb_typeof(row->'resource') IS DISTINCT FROM 'string'
         OR jsonb_typeof(row->'ceiling') IS DISTINCT FROM 'number'
         OR (row->>'ceiling')::numeric < 0 OR (row->>'ceiling')::numeric > 9007199254740991
         OR (row->>'ceiling')::numeric <> trunc((row->>'ceiling')::numeric)
         OR NOT (policy->'outputResources' ? (row->>'resource'))
         OR NOT (policy->'reasons' ? (row->>'reason'))
         OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(requested_named) requested WHERE requested->>'resource' = row->>'resource')
    ) THEN
      PERFORM keynes_internal.raise_domain_error('policy_evaluation_failed', jsonb_build_object('policyName', policy->>'name', 'policyRevision', (policy->>'revision')::numeric));
    END IF;
    policy_rows := policy_rows || jsonb_build_array(jsonb_build_object(
      'name', policy->>'name', 'revision', (policy->>'revision')::numeric,
      'sourceDigest', policy->>'sourceDigest', 'definitionDigest', policy->>'definitionDigest', 'rows', rows
    ));
  END LOOP;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'resourceTypeId', resource_type.resource_type_id::text, 'ceiling', grouped.ceiling,
    'reasons', grouped.reasons
  ) ORDER BY resource_type.resource_type_id), '[]'::jsonb)
  INTO effective
  FROM (
    SELECT row->>'resource' resource, min((row->>'ceiling')::numeric) ceiling,
           jsonb_agg(jsonb_build_object('policyName', policy_row->>'name', 'policyRevision', (policy_row->>'revision')::numeric, 'reason', row->>'reason') ORDER BY policy_row->>'name', (policy_row->>'revision')::numeric, row->>'reason') FILTER (WHERE (row->>'ceiling')::numeric = minimum.minimum) reasons
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
SET search_path = pg_catalog, keynes_internal
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
  budget keynes_internal.budgets%ROWTYPE;
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
  command_id := (input->>'commandId')::uuid;
  IF operation_name = 'requestBudget' AND jsonb_typeof(input->'parentBudgetId') = 'string' THEN
    parent_id := (input->>'parentBudgetId')::uuid;
    SELECT stored.policies INTO parent_policies FROM keynes_internal.budgets stored
      WHERE stored.tenant_id = nullif(current_setting('keynes.tenant_id', true), '')::uuid AND stored.budget_id = parent_id;
    parent_policies := coalesce(parent_policies, '[]'::jsonb);
  END IF;
  IF operation_name = 'createBudget' THEN policies := coalesce(input->'policies', '[]'::jsonb); END IF;
  IF operation_name = 'requestBudget' THEN child_policies := coalesce(input->'childPolicies', '[]'::jsonb); END IF;
  IF jsonb_array_length(policies) = 0 AND jsonb_array_length(parent_policies) = 0
    AND jsonb_array_length(child_policies) = 0 AND NOT (input ? 'context') THEN
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
      IF EXISTS (SELECT 1 FROM jsonb_array_elements(policies) policy CROSS JOIN LATERAL jsonb_array_elements_text(policy->'inputResources') name WHERE NOT EXISTS (SELECT 1 FROM keynes_internal.resource_types WHERE tenant_id = tenant AND canonical_name = name)) THEN
        PERFORM keynes_internal.invalid_policy('$.policies.inputResources', 'defined_resources');
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
      PERFORM keynes_internal.validate_policy_context(parent_policies, input->'context');
      PERFORM 1 FROM keynes_internal.budget_resources locked
        WHERE locked.tenant_id = tenant AND locked.budget_id = parent_id AND locked.resource_type_id IN (
          SELECT (requested->>'resourceTypeId')::uuid FROM jsonb_array_elements(items) requested
          UNION
          SELECT resource_type.resource_type_id FROM jsonb_array_elements(parent_policies) policy
            CROSS JOIN LATERAL jsonb_array_elements_text(policy->'inputResources') name
            JOIN keynes_internal.resource_types resource_type ON resource_type.tenant_id = tenant AND resource_type.canonical_name = name
        ) ORDER BY locked.resource_type_id FOR UPDATE;
      evidence := keynes_internal.evaluate_policy_set(tenant,parent_id,parent_policies,items,input->'context');
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
      evidence := evidence || jsonb_build_object('decision', CASE WHEN jsonb_array_length(denial_reasons) = 0 THEN 'approved' ELSE 'denied' END);
      IF jsonb_array_length(denial_reasons) > 0 THEN
        PERFORM keynes_internal.checkpoint('after_domain_mutation');
        PERFORM keynes_internal.append_history(tenant,budget.root_budget_id,command_id,'request_denied',parent_id,jsonb_build_object('parentBudgetId',parent_id::text,'reasons',denial_reasons,'policyEvidence',evidence));
        PERFORM keynes_internal.checkpoint('after_history_insertion');
        result := jsonb_build_object('kind','denied','commandId',command_id::text,'parentBudgetId',parent_id::text,'reasons',denial_reasons,'policyEvidence',evidence);
      ELSE
        INSERT INTO keynes_internal.budgets (tenant_id,budget_id,parent_budget_id,root_budget_id,depth,lifecycle,policies)
          VALUES (tenant,command_id,parent_id,budget.root_budget_id,budget.depth + 1,'active',child_policies);
        FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
          INSERT INTO keynes_internal.budget_resources (tenant_id,budget_id,resource_type_id,allocated_amount) VALUES (tenant,command_id,(item->>'resourceTypeId')::uuid,(item->>'amount')::bigint);
        END LOOP;
        PERFORM keynes_internal.checkpoint('after_domain_mutation');
        PERFORM keynes_internal.append_history(tenant,budget.root_budget_id,command_id,'request_approved',command_id,jsonb_build_object('parentBudgetId',parent_id::text,'childBudgetId',command_id::text,'resources',items,'policyEvidence',evidence));
        PERFORM keynes_internal.checkpoint('after_history_insertion');
        result := jsonb_build_object('kind','approved','commandId',command_id::text,'parentBudgetId',parent_id::text,'childBudgetId',command_id::text,'resources',items,'policyEvidence',evidence);
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
REVOKE ALL ON FUNCTION keynes_internal.validate_policy_set(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_policy_context(jsonb,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.evaluate_policy_set(uuid,uuid,jsonb,jsonb,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.apply_command(text,jsonb) FROM PUBLIC;

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
  FOR vector IN SELECT value FROM jsonb_array_elements('[{"kind":"select","name":"constant ceiling select","input":{"kind":"select","availabilityJoin":{"kind":"inner_join"},"resource":{"kind":"reference","source":"requested","field":"resource","valueType":"text","nullable":false},"ceiling":{"kind":"decimal_literal","value":"10","valueType":"numeric","nullable":false},"reason":{"kind":"text_literal","value":"fixed_limit","valueType":"text","nullable":false},"where":null,"groupBy":[],"orderBy":["resource","reason","ceiling"]},"expected":{"canonical":"select","type":"rows"},"expectedWork":392},{"kind":"inner_join","name":"same resource join","input":{"kind":"inner_join"},"expected":{"canonical":"inner_join"},"expectedWork":0},{"kind":"cross_join","name":"bounded availability product","input":{"kind":"cross_join"},"expected":{"canonical":"cross_join"},"expectedWork":0},{"kind":"decimal_literal","name":"integer spelling","input":{"kind":"decimal_literal","value":"1","valueType":"numeric","nullable":false},"expected":{"value":"1.000000000000000000","type":"numeric","nullable":false},"expectedWork":1},{"kind":"text_literal","name":"canonical reason","input":{"kind":"text_literal","value":"tier_limit","valueType":"text","nullable":false},"expected":{"value":"tier_limit","type":"text","nullable":false},"expectedWork":1},{"kind":"boolean_literal","name":"true literal","input":{"kind":"boolean_literal","value":true,"valueType":"boolean","nullable":false},"expected":{"value":true,"type":"boolean","nullable":false},"expectedWork":1},{"kind":"null_literal","name":"nullable text","input":{"kind":"null_literal","value":null,"valueType":"text","nullable":true},"expected":{"value":null,"type":"text","nullable":true},"expectedWork":1},{"kind":"reference","name":"requested amount","input":{"kind":"reference","source":"requested","field":"amount","valueType":"numeric","nullable":false},"expected":{"canonical":"requested.amount","type":"numeric","nullable":false},"expectedWork":1},{"kind":"unary_numeric","name":"negative one","input":{"kind":"unary_numeric","operator":"-","operand":{"kind":"decimal_literal","value":"1","valueType":"numeric","nullable":false},"valueType":"numeric","nullable":false},"expected":{"value":"-1.000000000000000000","type":"numeric","nullable":false},"expectedWork":2},{"kind":"binary_numeric","name":"exact addition","input":{"kind":"binary_numeric","operator":"+","left":{"kind":"decimal_literal","value":"1","valueType":"numeric","nullable":false},"right":{"kind":"decimal_literal","value":"2","valueType":"numeric","nullable":false},"valueType":"numeric","nullable":false},"expected":{"value":"3.000000000000000000","type":"numeric","nullable":false},"expectedWork":3},{"kind":"comparison","name":"text equality","input":{"kind":"comparison","operator":"=","left":{"kind":"text_literal","value":"a","valueType":"text","nullable":false},"right":{"kind":"text_literal","value":"a","valueType":"text","nullable":false},"valueType":"boolean","nullable":false},"expected":{"value":true,"type":"boolean","nullable":false},"expectedWork":3},{"kind":"text_in","name":"literal membership","input":{"kind":"text_in","operand":{"kind":"text_literal","value":"a","valueType":"text","nullable":false},"values":["a","b"],"valueType":"boolean","nullable":false},"expected":{"value":true,"type":"boolean","nullable":false},"expectedWork":4},{"kind":"is_null","name":"null is null","input":{"kind":"is_null","operator":"is_null","operand":{"kind":"null_literal","value":null,"valueType":"text","nullable":true},"valueType":"boolean","nullable":false},"expected":{"value":true,"type":"boolean","nullable":false},"expectedWork":2},{"kind":"boolean_binary","name":"false and null","input":{"kind":"boolean_binary","operator":"and","left":{"kind":"boolean_literal","value":false,"valueType":"boolean","nullable":false},"right":{"kind":"null_literal","value":null,"valueType":"boolean","nullable":true},"valueType":"boolean","nullable":true},"expected":{"value":false,"type":"boolean","nullable":true},"expectedWork":3},{"kind":"boolean_not","name":"not true","input":{"kind":"boolean_not","operand":{"kind":"boolean_literal","value":true,"valueType":"boolean","nullable":false},"valueType":"boolean","nullable":false},"expected":{"value":false,"type":"boolean","nullable":false},"expectedWork":2},{"kind":"case","name":"first matching branch","input":{"kind":"case","branches":[{"when":{"kind":"boolean_literal","value":true,"valueType":"boolean","nullable":false},"then":{"kind":"decimal_literal","value":"1","valueType":"numeric","nullable":false}}],"else":{"kind":"decimal_literal","value":"2","valueType":"numeric","nullable":false},"valueType":"numeric","nullable":false},"expected":{"value":"1.000000000000000000","type":"numeric","nullable":false},"expectedWork":5},{"kind":"variadic","name":"coalesce null text","input":{"kind":"variadic","function":"coalesce","arguments":[{"kind":"null_literal","value":null,"valueType":"text","nullable":true},{"kind":"text_literal","value":"fallback","valueType":"text","nullable":false}],"valueType":"text","nullable":false},"expected":{"value":"fallback","type":"text","nullable":false},"expectedWork":5},{"kind":"numeric_function","name":"absolute negative","input":{"kind":"numeric_function","function":"abs","operand":{"kind":"unary_numeric","operator":"-","operand":{"kind":"decimal_literal","value":"2","valueType":"numeric","nullable":false},"valueType":"numeric","nullable":false},"valueType":"numeric","nullable":false},"expected":{"value":"2.000000000000000000","type":"numeric","nullable":false},"expectedWork":3},{"kind":"scale_function","name":"round half away from zero","input":{"kind":"scale_function","function":"round","operand":{"kind":"decimal_literal","value":"1.5","valueType":"numeric","nullable":false},"scale":0,"valueType":"numeric","nullable":false},"expected":{"value":"2.000000000000000000","type":"numeric","nullable":false},"expectedWork":2},{"kind":"power","name":"square","input":{"kind":"power","base":{"kind":"decimal_literal","value":"3","valueType":"numeric","nullable":false},"exponent":2,"valueType":"numeric","nullable":false},"expected":{"value":"9.000000000000000000","type":"numeric","nullable":false},"expectedWork":4},{"kind":"aggregate","name":"count one value","input":{"kind":"aggregate","function":"count","operand":{"kind":"decimal_literal","value":"1","valueType":"numeric","nullable":false},"valueType":"numeric","nullable":false},"expected":{"value":"1.000000000000000000","type":"numeric","nullable":false},"expectedWork":2}]'::jsonb)
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
    IF actual_work IS DISTINCT FROM (vector->>'expectedWork')::bigint OR actual_work > 65536 THEN
      PERFORM keynes_internal.invalid_policy('$.vectors', 'work');
    END IF;
    IF vector->>'kind' = 'select' AND vector->'input'->'availabilityJoin'->>'kind' = 'inner_join' AND keynes_internal.policy_work_bound(vector->'input', 64, 64) > 65536 THEN
      PERFORM keynes_internal.invalid_policy('$.vectors', 'inner_join_work');
    END IF;
  END LOOP;
END;
$$;

SELECT keynes_internal.check_policy_canonical_vectors();

REVOKE ALL ON FUNCTION keynes_internal.apply_command_legacy(operation_name text,input jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.policy_canonical_json(value jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.invalid_policy(issue_path text,issue_rule text) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.policy_assert_exact_keys(value jsonb,expected_keys text[],issue_path text) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_policy_descriptor(value jsonb,descriptor jsonb,issue_path text) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_policy_node(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.render_policy_node(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_policy_program(program jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.render_policy_program(program jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.policy_work_bound(program jsonb,requested_rows integer,available_rows integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_policy_set(policies jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_policy_context(policies jsonb,context jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.evaluate_policy_set(selected_tenant uuid,selected_budget uuid,policies jsonb,requested_items jsonb,context jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.check_policy_canonical_vectors() FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_select(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.render_select(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_inner_join(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.render_inner_join(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_cross_join(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.render_cross_join(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_decimal_literal(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.render_decimal_literal(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_text_literal(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.render_text_literal(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_boolean_literal(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.render_boolean_literal(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_null_literal(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.render_null_literal(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_reference(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.render_reference(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_unary_numeric(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.render_unary_numeric(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_binary_numeric(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.render_binary_numeric(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_comparison(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.render_comparison(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_text_in(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.render_text_in(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_is_null(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.render_is_null(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_boolean_binary(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.render_boolean_binary(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_boolean_not(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.render_boolean_not(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_case(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.render_case(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_variadic(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.render_variadic(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_numeric_function(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.render_numeric_function(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_scale_function(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.render_scale_function(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_power(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.render_power(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.validate_aggregate(node jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION keynes_internal.render_aggregate(node jsonb) FROM PUBLIC;
