import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import {
  applyGeneratedOutputs,
  canonicalJson,
  jsonFile,
  loadContract,
  loadPolicyProfile,
  type ContractSource,
  type JsonObject,
  type LoadedContract,
  type LoadedPolicyProfile,
} from "@keynes/contracts";
import { format } from "oxfmt";

const POSTGRES_PROFILE = {
  profileId: "embedded-postgresql-18.6-preview",
  serverVersionNum: "180006",
  support: {
    install: true,
    exactRecheck: true,
    deferred: [
      "upgrades",
      "downgrades",
      "rolling-deployment",
      "uninstall",
      "backup",
      "recovery",
      "failover",
      "managed-providers",
      "security-qualification",
      "performance-qualification",
      "production-readiness",
    ],
  },
} as const;

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

const IMMUTABLE_PUBLIC_MIGRATION_SHA256 =
  "b5870fb835851e014e6ac0ccdafe2259482f57d1539bbddf9f996949cf4ec753";

export interface InstallationMigration {
  readonly id: string;
  readonly path: string;
  readonly sha256: string;
  readonly contractDigest?: string;
}

export interface PostgresqlInstallationIdentity {
  readonly contractMigrationId: string;
  readonly migrations: readonly InstallationMigration[];
}

export interface GeneratePostgresqlOptions {
  readonly check: boolean;
  readonly contract: LoadedContract;
  readonly policyProfile: LoadedPolicyProfile;
  readonly repositoryRoot?: string;
}

export async function generatePostgresql(
  options: GeneratePostgresqlOptions,
): Promise<PostgresqlInstallationIdentity> {
  const repositoryRoot = options.repositoryRoot ?? defaultRepositoryRoot();
  const publicMigrationPath = join(
    repositoryRoot,
    "packages/postgresql/migrations/0003-public.generated.sql",
  );
  const publicSql = readFileSync(publicMigrationPath, "utf8");
  assertImmutablePublicMigration(publicSql, "before generation");
  const legacyBudgetSql = readFileSync(
    join(repositoryRoot, "packages/postgresql/migrations/0002-budget.sql"),
    "utf8",
  );
  const policySql = renderPolicyMigration(
    options.policyProfile,
    legacyBudgetSql,
  );
  const manifest = readMigrationManifest(repositoryRoot);
  const contractMigrations = manifest.filter(
    (migration) => migration.contract === true,
  );
  if (contractMigrations.length !== 1) {
    throw new Error("migration manifest must declare one contract migration");
  }
  const contractMigrationId = requireString(contractMigrations[0], "id");
  const migrations = migrationRecords(
    repositoryRoot,
    publicSql,
    policySql,
    manifest,
  ).map((migration) =>
    migration.id === contractMigrationId
      ? { ...migration, contractDigest: options.contract.digest }
      : migration,
  );
  const installationRecord = {
    ...POSTGRES_PROFILE,
    contractDigest: options.contract.digest,
    migrationSetDigest: sha256(canonicalJson(migrations)),
    migrations,
    expectedTargets: options.contract.source.operations.map(
      ({ target }) => target,
    ),
    expectedObjects: expectedPostgresObjects(options.policyProfile),
    functions: installationFunctions(options.contract.source),
  };

  const formattedInstallationRecord = await formatJson(
    "installation-record.json",
    jsonFile(installationRecord),
  );
  applyGeneratedOutputs({
    check: options.check,
    outputRoot: join(repositoryRoot, "packages/postgresql"),
    outputs: new Map([
      ["generated/installation-record.json", formattedInstallationRecord],
      ["migrations/0003-public.generated.sql", publicSql],
      ["migrations/0004-policy.sql", policySql],
    ]),
    generatedDirectories: [
      { path: "generated", accepts: () => true },
      {
        path: "migrations",
        accepts: (fileName) =>
          fileName.endsWith(".generated.sql") || fileName === "0004-policy.sql",
      },
    ],
  });
  assertImmutablePublicMigration(
    readFileSync(publicMigrationPath, "utf8"),
    "after generation",
  );
  return { contractMigrationId, migrations };
}

function assertImmutablePublicMigration(value: string, phase: string): void {
  const actual = sha256(value);
  if (actual !== IMMUTABLE_PUBLIC_MIGRATION_SHA256) {
    throw new Error(
      `immutable migration 0003 changed ${phase}: expected ${IMMUTABLE_PUBLIC_MIGRATION_SHA256}, received ${actual}`,
    );
  }
}

function renderPolicyMigration(
  profile: LoadedPolicyProfile,
  legacyBudgetSql: string,
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
  const policyRuntime = renderPolicyRuntime(profile, legacyBudgetSql);

  return `-- Generated from packages/contracts/policy-profile.json. Do not edit.
-- Policy profile SHA-256: ${profile.digest}

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
      IF jsonb_typeof(value) IS DISTINCT FROM 'string' OR (value #>> '{}') !~ '^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$' THEN
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

function renderPolicyRuntime(
  profile: LoadedPolicyProfile,
  legacyBudgetSql: string,
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
  const legacyApply = legacyApplyMatch[0].replace(
    "CREATE FUNCTION keynes_internal.apply_command(operation_name text, input jsonb)",
    "CREATE FUNCTION keynes_internal.apply_command_legacy(operation_name text, input jsonb)",
  );
  const versions = profile.source.versions;
  const limits = profile.source.limits;
  return `ALTER TABLE keynes_internal.budgets
  ADD COLUMN policies jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD CONSTRAINT budget_policies_shape CHECK (
    jsonb_typeof(policies) = 'array' AND jsonb_array_length(policies) <= ${limits.policiesPerBudget}
  );

${legacyApply}

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
    OR jsonb_array_length(policies) > ${limits.policiesPerBudget} THEN
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
      OR jsonb_array_length(policy->'reasons') NOT BETWEEN 1 AND ${limits.resultRows} THEN
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
      WHERE value = '' OR octet_length(convert_to(value, 'UTF8')) > ${profile.source.text.maximumUtf8Bytes}
         OR (n > 1 AND value <= (policy->'reasons'->>((n - 2)::integer)))
    ) THEN
      PERFORM keynes_internal.invalid_policy('$.policies[' || (ordinal - 1)::text || ']', 'canonical_order');
    END IF;
    PERFORM keynes_internal.validate_policy_program(policy->'program');
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
      PERFORM keynes_internal.raise_domain_error('invalid_policy_context', jsonb_build_object('issues', jsonb_build_array(jsonb_build_object('path', '$.context', 'rule', 'ungoverned'))));
    END IF;
    RETURN;
  END IF;
  IF jsonb_typeof(context) IS DISTINCT FROM 'object'
    OR octet_length(convert_to(context::text, 'UTF8')) > ${limits.canonicalContextBytes}
    OR ARRAY(SELECT member.key FROM jsonb_object_keys(context) AS member(key) ORDER BY member.key)
       IS DISTINCT FROM ARRAY(SELECT field.member->>'name' FROM jsonb_array_elements(schema) AS field(member) ORDER BY field.member->>'name') THEN
    PERFORM keynes_internal.raise_domain_error('invalid_policy_context', jsonb_build_object('issues', jsonb_build_array(jsonb_build_object('path', '$.context', 'rule', 'schema'))));
  END IF;
  FOR field IN SELECT member FROM jsonb_array_elements(schema) member LOOP
    value := context->(field->>'name');
    IF value = 'null'::jsonb AND (field->>'nullable')::boolean THEN CONTINUE; END IF;
    IF (field->>'type' = 'integer' AND (jsonb_typeof(value) IS DISTINCT FROM 'number' OR value::text !~ '^-?[0-9]+$' OR abs((value::text)::numeric) > ${profile.source.numeric.maximumSafeInteger}))
      OR (field->>'type' = 'text' AND (jsonb_typeof(value) IS DISTINCT FROM 'string' OR octet_length(convert_to(value #>> '{}', 'UTF8')) > ${limits.contextTextBytes}))
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
REVOKE ALL ON FUNCTION keynes_internal.apply_command(text,jsonb) FROM PUBLIC;`;
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
      return `  IF EXISTS (
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
      return `  IF EXISTS (
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
      return `quote_literal(node->>'value') || '::numeric(38,18)'`;
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
      return `'(' || ${child("left")} || ' ' || upper(node->>'operator') || ' ' || ${child("right")} || ')'`;
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
      return `lower(node->>'function') || '(' || ${child("operand")} || ')::numeric(38,18)'`;
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

function expectedPostgresObjects(
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
    "invalid_policy(issue_path text,issue_rule text)",
    "policy_assert_exact_keys(value jsonb,expected_keys text[],issue_path text)",
    "validate_policy_descriptor(value jsonb,descriptor jsonb,issue_path text)",
    "validate_policy_node(node jsonb)",
    "render_policy_node(node jsonb)",
    "validate_policy_program(program jsonb)",
    "render_policy_program(program jsonb)",
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

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function installationFunctions(
  contract: ContractSource,
): readonly JsonObject[] {
  return contract.operations.map((operation) => ({
    operation: operation.method,
    permission: operation.permission,
    target: operation.target,
    argumentType: "jsonb",
    returnType: "jsonb",
    language: operation.method === "getBudget" ? "plpgsql" : "sql",
    securityDefiner: true,
    searchPath: ["pg_catalog", "keynes_internal"],
  }));
}

function readMigrationManifest(repositoryRoot: string): readonly JsonObject[] {
  const path = join(
    repositoryRoot,
    "packages/postgresql/migrations/manifest.json",
  );
  if (!existsSync(path)) throw new Error("migration manifest is required");
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isObject(value) || !Array.isArray(value.migrations)) {
    throw new Error("migration manifest must contain a migrations array");
  }
  return value.migrations.map((migration) => {
    if (!isObject(migration))
      throw new Error("migration manifest entry must be an object");
    requireString(migration, "id");
    requireString(migration, "path");
    return migration;
  });
}

function migrationRecords(
  repositoryRoot: string,
  publicSql: string,
  policySql: string,
  migrations: readonly JsonObject[],
): readonly InstallationMigration[] {
  return migrations.map((migration) => {
    const id = requireString(migration, "id");
    const path = requireString(migration, "path");
    const contents =
      path === "0003-public.generated.sql"
        ? publicSql
        : path === "0004-policy.sql"
          ? policySql
          : readFileSync(
              join(repositoryRoot, "packages/postgresql/migrations", path),
              "utf8",
            );
    return { id, path, sha256: sha256(contents) };
  });
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function formatJson(path: string, source: string): Promise<string> {
  const result = await format(path, source, { printWidth: 80 });
  const error = result.errors.find(
    (diagnostic) => diagnostic.severity === "Error",
  );
  if (error !== undefined) {
    throw new Error(
      `cannot format generated ${path}: ${error.message ?? "parse error"}`,
    );
  }
  return result.code;
}

function requireString(object: JsonObject, key: string): string {
  const value = object[key];
  if (typeof value !== "string")
    throw new Error(`migration field ${key} must be a string`);
  return value;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function defaultRepositoryRoot(): string {
  return fileURLToPath(new URL("../../../", import.meta.url));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { check: { type: "boolean" } },
    strict: true,
  });
  const repositoryRoot = defaultRepositoryRoot();
  await generatePostgresql({
    check: values.check === true,
    contract: loadContract(join(repositoryRoot, "packages/contracts")),
    policyProfile: loadPolicyProfile(
      join(repositoryRoot, "packages/contracts"),
    ),
    repositoryRoot,
  });
}
