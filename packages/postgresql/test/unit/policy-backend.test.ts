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
