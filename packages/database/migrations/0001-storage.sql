CREATE SCHEMA IF NOT EXISTS keynes_internal;
CREATE SCHEMA IF NOT EXISTS keynes;

REVOKE ALL ON SCHEMA keynes_internal FROM PUBLIC;

CREATE TABLE keynes_internal.installed_contracts (
  contract_digest text PRIMARY KEY,
  installed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT installed_contract_digest_format
    CHECK (contract_digest ~ '^[0-9a-f]{64}$')
);

CREATE TABLE keynes_internal.schema_migrations (
  migration_id text PRIMARY KEY,
  byte_checksum text NOT NULL,
  contract_digest text,
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT migration_id_format
    CHECK (migration_id ~ '^[0-9]{4}-[a-z][a-z0-9-]*$'),
  CONSTRAINT migration_checksum_format
    CHECK (byte_checksum ~ '^[0-9a-f]{64}$'),
  CONSTRAINT migration_contract_digest_format
    CHECK (
      contract_digest IS NULL
      OR contract_digest ~ '^[0-9a-f]{64}$'
    )
);

CREATE TABLE keynes_internal.principal_permissions (
  tenant_id uuid NOT NULL,
  principal_id uuid NOT NULL,
  permission text NOT NULL,
  PRIMARY KEY (tenant_id, principal_id, permission),
  CONSTRAINT principal_permission_name
    CHECK (
      permission IN (
        'publish_resource',
        'create_root_budget',
        'request_budget',
        'settle_budget',
        'read_budget'
      )
    )
);

CREATE TABLE keynes_internal.commands (
  tenant_id uuid NOT NULL,
  command_id uuid NOT NULL,
  operation text NOT NULL,
  target_kind text NOT NULL,
  target_id uuid NOT NULL,
  canonical_body jsonb NOT NULL,
  body_digest text NOT NULL,
  principal_id uuid NOT NULL,
  result jsonb,
  result_digest text,
  committed_at timestamptz,
  PRIMARY KEY (tenant_id, command_id),
  CONSTRAINT command_operation
    CHECK (
      operation IN (
        'publishResource',
        'createBudget',
        'requestBudget',
        'settleBudget'
      )
    ),
  CONSTRAINT command_target_kind
    CHECK (target_kind IN ('resource_type', 'budget')),
  CONSTRAINT command_body_is_object
    CHECK (jsonb_typeof(canonical_body) = 'object'),
  CONSTRAINT command_body_digest_format
    CHECK (body_digest ~ '^command-body:[0-9a-f]{64}$'),
  CONSTRAINT command_result_pair
    CHECK ((result IS NULL) = (result_digest IS NULL)),
  CONSTRAINT command_result_digest_format
    CHECK (
      result_digest IS NULL
      OR result_digest ~ '^command-result:[0-9a-f]{64}$'
    ),
  CONSTRAINT command_commit_pair
    CHECK ((result IS NULL) = (committed_at IS NULL))
);

CREATE TABLE keynes_internal.resource_types (
  tenant_id uuid NOT NULL,
  resource_type_id uuid NOT NULL,
  canonical_name text NOT NULL,
  unit text NOT NULL,
  accounting_behavior text NOT NULL,
  definition jsonb NOT NULL,
  definition_digest text NOT NULL,
  publisher_principal_id uuid NOT NULL,
  publication_command_id uuid NOT NULL,
  PRIMARY KEY (tenant_id, resource_type_id),
  UNIQUE (tenant_id, canonical_name),
  UNIQUE (tenant_id, publication_command_id),
  CONSTRAINT resource_type_name
    CHECK (canonical_name ~ '^[a-z][a-z0-9_]{0,62}$'),
  CONSTRAINT resource_type_unit
    CHECK (
      char_length(unit) BETWEEN 1 AND 64
      AND unit = btrim(unit)
      AND unit !~ '[[:cntrl:]]'
    ),
  CONSTRAINT resource_type_accounting_behavior
    CHECK (accounting_behavior IN ('consumable', 'reusable')),
  CONSTRAINT resource_type_definition_is_object
    CHECK (jsonb_typeof(definition) = 'object'),
  CONSTRAINT resource_type_definition_digest_format
    CHECK (definition_digest ~ '^resource-definition:[0-9a-f]{64}$'),
  FOREIGN KEY (tenant_id, publication_command_id)
    REFERENCES keynes_internal.commands (tenant_id, command_id)
);

CREATE TABLE keynes_internal.budgets (
  tenant_id uuid NOT NULL,
  budget_id uuid NOT NULL,
  parent_budget_id uuid,
  root_budget_id uuid NOT NULL,
  depth bigint NOT NULL,
  lifecycle text NOT NULL,
  created_command_id uuid NOT NULL,
  PRIMARY KEY (tenant_id, budget_id),
  UNIQUE (tenant_id, created_command_id),
  CONSTRAINT budget_depth_safe
    CHECK (depth BETWEEN 0 AND 9007199254740991),
  CONSTRAINT budget_lifecycle
    CHECK (lifecycle IN ('active', 'settling')),
  CONSTRAINT budget_root_shape
    CHECK (
      (parent_budget_id IS NULL AND root_budget_id = budget_id AND depth = 0)
      OR (parent_budget_id IS NOT NULL AND depth > 0)
    ),
  FOREIGN KEY (tenant_id, parent_budget_id)
    REFERENCES keynes_internal.budgets (tenant_id, budget_id),
  FOREIGN KEY (tenant_id, root_budget_id)
    REFERENCES keynes_internal.budgets (tenant_id, budget_id),
  FOREIGN KEY (tenant_id, created_command_id)
    REFERENCES keynes_internal.commands (tenant_id, command_id)
);

CREATE TABLE keynes_internal.budget_resources (
  tenant_id uuid NOT NULL,
  budget_id uuid NOT NULL,
  resource_type_id uuid NOT NULL,
  allocated_amount bigint NOT NULL,
  direct_usage_amount bigint,
  usage_command_id uuid,
  PRIMARY KEY (tenant_id, budget_id, resource_type_id),
  CONSTRAINT budget_resource_allocation_safe
    CHECK (allocated_amount BETWEEN 0 AND 9007199254740991),
  CONSTRAINT budget_resource_usage_safe
    CHECK (
      direct_usage_amount IS NULL
      OR direct_usage_amount BETWEEN 0 AND 9007199254740991
    ),
  CONSTRAINT budget_resource_usage_pair
    CHECK ((direct_usage_amount IS NULL) = (usage_command_id IS NULL)),
  FOREIGN KEY (tenant_id, budget_id)
    REFERENCES keynes_internal.budgets (tenant_id, budget_id),
  FOREIGN KEY (tenant_id, resource_type_id)
    REFERENCES keynes_internal.resource_types (tenant_id, resource_type_id),
  FOREIGN KEY (tenant_id, usage_command_id)
    REFERENCES keynes_internal.commands (tenant_id, command_id)
);

CREATE TABLE keynes_internal.budget_history_streams (
  tenant_id uuid NOT NULL,
  stream_id uuid NOT NULL,
  next_sequence bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, stream_id),
  CONSTRAINT history_next_sequence_safe
    CHECK (next_sequence BETWEEN 1 AND 9007199254740991),
  FOREIGN KEY (tenant_id, stream_id)
    REFERENCES keynes_internal.budgets (tenant_id, budget_id)
);

CREATE TABLE keynes_internal.budget_history_entries (
  tenant_id uuid NOT NULL,
  stream_id uuid NOT NULL,
  sequence bigint NOT NULL,
  event_id uuid NOT NULL,
  command_id uuid NOT NULL,
  event_kind text NOT NULL,
  subject_id uuid NOT NULL,
  payload jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, stream_id, sequence),
  UNIQUE (tenant_id, event_id),
  UNIQUE (tenant_id, command_id),
  CONSTRAINT history_sequence_safe
    CHECK (sequence BETWEEN 1 AND 9007199254740991),
  CONSTRAINT history_event_kind
    CHECK (
      event_kind IN (
        'budget_created',
        'request_approved',
        'request_denied',
        'budget_settlement_recorded'
      )
    ),
  CONSTRAINT history_payload_is_object
    CHECK (jsonb_typeof(payload) = 'object'),
  FOREIGN KEY (tenant_id, stream_id)
    REFERENCES keynes_internal.budget_history_streams (tenant_id, stream_id),
  FOREIGN KEY (tenant_id, command_id)
    REFERENCES keynes_internal.commands (tenant_id, command_id),
  FOREIGN KEY (tenant_id, subject_id)
    REFERENCES keynes_internal.budgets (tenant_id, budget_id)
);
