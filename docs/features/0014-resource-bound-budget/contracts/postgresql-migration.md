# PostgreSQL migration contract

## Additive migration

FEAT-0014 adds `0005-resource-bound-budget.sql`. Migrations `0001` through `0004` remain byte-for-byte unchanged.

The migration must:

1. Add nullable `keynes_internal.resource_types.definition_command_id`.
2. Backfill it from `resource_type_id` for every existing row.
3. Add the tenant-scoped foreign key to `keynes_internal.commands` and make the column non-null.
4. Remove only the foreign key that forced Resource identity to equal definition-command identity.
5. Install the revised combined root implementation without changing the public `keynes.create_budget(jsonb)` name.
6. Preserve the standalone definition procedure and existing Resource, Budget, command, and history rows.
7. Record the new migration checksum and current contract digest in the generated installation record.

The generator must retain the historical contract digest for `0004` and assign the new digest to `0005`. Clean installation and exact recheck remain supported. Upgrade, downgrade, uninstall, rolling deployment, backup, recovery, and repair remain unsupported and `NOT RUN`.

## Verification

Installation tests must prove a clean five-migration install, exact recheck, expected object and function inventory, checksum enforcement, and rejection of a target that lacks `0005`. Native tests must prove two-permission enforcement, exact definition reuse, conflict rollback, absent-name contention, replay, and caller-owned transaction rollback.
