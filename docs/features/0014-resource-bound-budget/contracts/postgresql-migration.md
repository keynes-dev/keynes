# PostgreSQL migration contract

## Additive migrations

FEAT-0014 added `0005-resource-bound-budget.sql`. The Phase 2 review adds `0007-create-budget-permissions.sql` and keeps migrations `0001` through `0006` byte-for-byte unchanged.

Migration `0005` must:

1. Add nullable `keynes_internal.resource_types.definition_command_id`.
2. Backfill it from `resource_type_id` for every existing row.
3. Add the tenant-scoped foreign key to `keynes_internal.commands` and make the column non-null.
4. Remove only the foreign key that forced Resource identity to equal definition-command identity.
5. Install the revised combined root implementation without changing the public `keynes.create_budget(jsonb)` name.
6. Preserve the standalone definition procedure and existing Resource, Budget, command, and history rows.
7. Record the new migration checksum and current contract digest in the generated installation record.

Migration `0007` installs `apply_create_budget_v0007`, routes the unversioned dispatcher to it, and retains the named v5 behavior. It always requires `create_root_budget`, requires `define_resource_type` only for a missing definition, and accepts zero initial allocation. Its v7 remote apply and dispatch path corrects the same zero-allocation rule without changing the named v6 implementation.

The generator retains the historical contract digests and checksums for migrations `0001` through `0006` and assigns the current digest to `0007`. Clean installation and exact recheck remain supported. Upgrade, downgrade, uninstall, rolling deployment, backup, recovery, and repair remain unsupported and `NOT RUN`.

## Verification

Installation tests must prove a clean seven-migration install, exact recheck, expected object and function inventory, checksum enforcement, and rejection of a target that lacks `0007`. Native tests must prove conditional permission enforcement, exact definition reuse, conflict rollback, absent-name contention, replay, caller-owned transaction rollback, and zero-allocation parity.
