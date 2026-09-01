import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  POLICY_POSTGRESQL_RENDERERS,
  POLICY_POSTGRESQL_VALIDATORS,
} from "@keynes/contracts";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../migrations/0004-policy.sql", import.meta.url),
  "utf8",
);

describe("generated PostgreSQL Policy backend", () => {
  it.each([
    [
      "0001-storage.sql",
      "1f1745d223274d9ddafa253b01ae61cc6e11fe9e65841667123f9914cad470dd",
    ],
    [
      "0002-budget.sql",
      "464fabeb3119048d1f08c5d387268aede428d92db97513ec9e168b16783c6e6b",
    ],
    [
      "0003-public.generated.sql",
      "b5870fb835851e014e6ac0ccdafe2259482f57d1539bbddf9f996949cf4ec753",
    ],
  ])("keeps immutable migration %s byte exact", (path, expected) => {
    const contents = readFileSync(
      new URL(`../../migrations/${path}`, import.meta.url),
    );
    expect(createHash("sha256").update(contents).digest("hex")).toBe(expected);
  });

  it("defines every validator and renderer declared by the Policy profile", () => {
    for (const validator of Object.values(POLICY_POSTGRESQL_VALIDATORS)) {
      expect(migration).toContain(`FUNCTION keynes_internal.${validator}(`);
    }
    for (const renderer of Object.values(POLICY_POSTGRESQL_RENDERERS)) {
      expect(migration).toContain(`FUNCTION keynes_internal.${renderer}(`);
    }
  });

  it("renders only fixed virtual-input templates and their parameter order", () => {
    expect(migration).toContain("$1::jsonb");
    expect(migration).toContain("$2::jsonb");
    expect(migration).toContain("$3::jsonb");
    expect(migration).toContain(
      "ARRAY['requested_resources', 'available_resources', 'policy_context']",
    );
    expect(migration).toContain('COLLATE "C"');
    expect(migration).toContain("numeric(38,18)");
  });

  it("preserves Policy handling for every contract UUID and canonicalizes evidence order", () => {
    expect(migration).toContain(
      "'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'",
    );
    expect(migration).not.toContain(
      "'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'",
    );
    expect(migration).toContain('ORDER BY grouped.resource COLLATE "C"');
    expect(migration).toContain(
      "ORDER BY (policy_row->>'name') COLLATE \"C\", (policy_row->>'revision')::numeric, (row->>'reason') COLLATE \"C\"",
    );
  });

  it("renders boolean operators once and fences decimal planning", () => {
    expect(migration).toContain(
      "WHEN 'and' THEN '(SELECT CASE lhs.value WHEN FALSE THEN FALSE ELSE (' || keynes_internal.render_policy_node(node->'right') || ' AND lhs.value) END FROM (VALUES (' || keynes_internal.render_policy_node(node->'left') || ')) AS lhs(value))'",
    );
    expect(migration).toContain(
      "WHEN 'or' THEN '(SELECT CASE lhs.value WHEN TRUE THEN TRUE ELSE (' || keynes_internal.render_policy_node(node->'right') || ' OR lhs.value) END FROM (VALUES (' || keynes_internal.render_policy_node(node->'left') || ')) AS lhs(value))'",
    );
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION keynes_internal.policy_runtime_numeric(value numeric)\nRETURNS numeric\nLANGUAGE plpgsql\nVOLATILE",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION keynes_internal.policy_runtime_numeric(value numeric) FROM PUBLIC",
    );
  });

  it("includes generated work estimation and canonical-vector checks", () => {
    expect(migration).toContain("FUNCTION keynes_internal.policy_work_bound(");
    expect(migration).toContain(
      "FUNCTION keynes_internal.check_policy_canonical_vectors(",
    );
  });

  it("enforces generated node groups, semantic types, and structural limits", () => {
    expect(migration).toContain("descriptor->>'group'");
    expect(migration).toContain("'node_group'");
    expect(migration).toContain("'operand_type'");
    expect(migration).toContain("'nullability'");
    expect(migration).toContain("node_count > 512");
    expect(migration).toContain("node_depth > 32");
    expect(migration).toContain(
      "jsonb_path_exists(node, 'strict $.** ? (@.kind == \"aggregate\")')",
    );
    expect(migration).toContain("argument.ordinality > 1");
  });

  it("uses join-aware SDK-compatible conservative work bounds", () => {
    expect(migration).toContain("WHEN 'cross_join' THEN requested * available");
    expect(migration).toContain("ELSE requested");
    expect(migration).toContain("expression_stats.unit_work * bounds.joined");
    expect(migration).toContain("384 * COALESCE");
    expect(migration).not.toContain(
      "GREATEST(requested_rows * GREATEST(available_rows, 1)",
    );
  });

  it("executes every canonical vector shape and checks its metadata", () => {
    expect(migration).toContain("FROM (' || rendered || ') AS policy_result");
    expect(migration).toContain("pg_typeof((' || rendered || '))::text");
    expect(migration).toContain("vector->'expected'->>'nullable'");
    expect(migration).toContain("vector->>'expectedWork'");
    expect(migration).toContain("'inner_join_work'");
  });
});
