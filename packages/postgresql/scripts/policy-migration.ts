import type { LoadedPolicyProfile } from "@keynes/contracts";

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
  "function:keynes_internal.apply_command_v0004(operation_name text,input jsonb)",
  "function:keynes_internal.canonical_resource_definition_v0005(operation_name text,value jsonb,issue_path text)",
  "function:keynes_internal.canonical_root_resources_v0005(operation_name text,value jsonb,issue_path text)",
  "function:keynes_internal.apply_define_resource_v0005(input jsonb)",
  "function:keynes_internal.apply_create_budget_v0005(input jsonb)",
  "function:keynes_internal.get_budget(input jsonb)",
  "function:keynes.define_resource_type(input jsonb)",
  "function:keynes.create_budget(input jsonb)",
  "function:keynes.request(input jsonb)",
  "function:keynes.settle(input jsonb)",
  "function:keynes.get_budget(input jsonb)",
] as const;

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
      if (backend === undefined) {
        throw new Error(`Policy node ${kind} lacks PostgreSQL metadata`);
      }
      return [
        `${backend.validator}(node jsonb)`,
        `${backend.renderer}(node jsonb)`,
      ];
    }),
  ];
}
