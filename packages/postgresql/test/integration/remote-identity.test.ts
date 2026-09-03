import { afterEach, describe, expect, it } from "vitest";

import { POSTGRESQL_SYSTEM_CONTEXT_ENV } from "../system/run.js";
import {
  identifier,
  openRemoteIdentityFixture,
  REMOTE_ADMIN_PROCEDURES,
  REMOTE_RUNTIME_PROCEDURES,
  type RemoteIdentityFixture,
} from "../system/support/remote-identity.js";

describe.skipIf(process.env[POSTGRESQL_SYSTEM_CONTEXT_ENV] === undefined)(
  "remote PostgreSQL installation and administration",
  () => {
    let fixture: RemoteIdentityFixture | undefined;

    afterEach(async () => {
      await fixture?.close();
      fixture = undefined;
    });

    it("installs and rechecks the complete remote procedure contract without changing state", async () => {
      fixture = await openRemoteIdentityFixture();
      const before = await installationState(fixture);

      await fixture.recheck();

      expect(await installationState(fixture)).toEqual(before);
      expect(before.migrations).toContain("0006-remote-access");
      expect(before.missingProcedures).toEqual([]);
    });

    it("gives the runtime role only remote procedures and no private authority", async () => {
      fixture = await openRemoteIdentityFixture();
      const result = await fixture.administrator.query<{
        readonly remote_execute: boolean;
        readonly canonical_execute: boolean;
        readonly private_execute: boolean;
        readonly private_tables: boolean;
      }>(
        `select
           bool_and(coalesce(has_function_privilege($1, to_regprocedure(target), 'EXECUTE'), false))
             as remote_execute,
           has_function_privilege($1, 'keynes.create_budget(jsonb)', 'EXECUTE')
             or has_function_privilege($1, 'keynes_internal.apply_command(text,jsonb)', 'EXECUTE')
             as canonical_execute,
           exists (
             select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'keynes_internal'
                and has_function_privilege($1, p.oid, 'EXECUTE')
           ) as private_execute,
           exists (
             select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'keynes_internal' and c.relkind in ('r', 'p')
                and has_table_privilege($1, c.oid, 'SELECT,INSERT,UPDATE,DELETE')
           ) as private_tables
         from unnest($2::text[]) target`,
        [fixture.primary.role, REMOTE_RUNTIME_PROCEDURES],
      );

      expect(result.rows[0]).toEqual({
        remote_execute: true,
        canonical_execute: false,
        private_execute: false,
        private_tables: false,
      });
    });

    it("keeps owner, execution, administration, and runtime roles distinct", async () => {
      fixture = await openRemoteIdentityFixture();
      const result = await fixture.administrator.query<{
        readonly rolname: string;
        readonly can_login: boolean;
        readonly inherits: boolean;
        readonly owner_member: boolean;
        readonly runtime_execute: boolean;
        readonly admin_execute: boolean;
      }>(
        `select r.rolname,
                r.rolcanlogin as can_login,
                r.rolinherit as inherits,
                pg_has_role(r.rolname, $1, 'MEMBER') as owner_member,
                coalesce(has_function_privilege(r.rolname, to_regprocedure('keynes.remote_get_compatibility(jsonb)'), 'EXECUTE'), false)
                  as runtime_execute,
                coalesce(has_function_privilege(r.rolname, to_regprocedure('keynes_internal.inspect_remote_role_v0006(name)'), 'EXECUTE'), false)
                  as admin_execute
           from pg_roles r
          where r.rolname = any($2::text[])
          order by r.rolname`,
        [
          fixture.ownerRole,
          [
            fixture.ownerRole,
            fixture.executionRole,
            fixture.administrationRole,
            fixture.primary.role,
          ],
        ],
      );
      const roles = new Map(result.rows.map((row) => [row.rolname, row]));

      expect(roles.get(fixture.ownerRole)).toMatchObject({ can_login: false });
      expect(roles.get(fixture.executionRole)).toMatchObject({
        can_login: false,
        inherits: false,
        owner_member: false,
      });
      expect(roles.get(fixture.administrationRole)).toMatchObject({
        can_login: true,
        inherits: false,
        owner_member: false,
        runtime_execute: false,
        admin_execute: true,
      });
      expect(roles.get(fixture.primary.role)).toMatchObject({
        can_login: true,
        inherits: false,
        owner_member: false,
        runtime_execute: true,
        admin_execute: false,
      });
    });

    it("records OID and name mappings without credential secrets", async () => {
      fixture = await openRemoteIdentityFixture();

      const result = await fixture.administrator.query<{
        readonly role_oid: number;
        readonly role_name: string;
        readonly tenant_id: string;
        readonly principal_id: string;
        readonly enabled: boolean;
        readonly secret_columns: number;
      }>(
        `select mapping.role_oid,
                mapping.role_name::text,
                mapping.tenant_id::text,
                mapping.principal_id::text,
                mapping.enabled,
                (select count(*)::int from information_schema.columns
                  where table_schema = 'keynes_internal'
                    and table_name = 'remote_role_mappings'
                    and column_name ~ '(password|secret|token|connection)') as secret_columns
           from keynes_internal.remote_role_mappings mapping
          where mapping.role_name = $1`,
        [fixture.primary.role],
      );

      expect(result.rows).toEqual([
        {
          role_oid: await fixture.roleOid(fixture.primary.role),
          role_name: fixture.primary.role,
          tenant_id: fixture.primary.tenantId,
          principal_id: fixture.primary.principalId,
          enabled: true,
          secret_columns: 0,
        },
      ]);
      expect(JSON.stringify(result.rows)).not.toContain(
        fixture.primary.password,
      );
    });

    it.each([
      {
        name: "INHERIT",
        apply: (selected: RemoteIdentityFixture) =>
          selected.administrator.query(
            `alter role ${identifier(selected.secondary.role)} inherit`,
          ),
      },
      ...(["ownerRole", "executionRole", "administrationRole"] as const).map(
        (protectedRole) => ({
          name: `${protectedRole} membership`,
          apply: (selected: RemoteIdentityFixture) =>
            selected.administrator.query(
              `grant ${identifier(selected[protectedRole])} to ${identifier(selected.secondary.role)}`,
            ),
        }),
      ),
    ])(
      "rejects $name candidates for registration and rotation",
      async ({ apply }) => {
        fixture = await openRemoteIdentityFixture();
        await apply(fixture);

        await expect(fixture.register(fixture.secondary)).rejects.toThrow(
          "remote login role is missing or unsafe",
        );
        await expect(
          fixture.rotate(fixture.primary.role, fixture.secondary.role),
        ).rejects.toThrow("remote login role is missing or unsafe");
      },
    );

    it("rejects registration over a mapping occupied by another identity", async () => {
      fixture = await openRemoteIdentityFixture();
      await fixture.register({
        ...fixture.secondary,
        tenantId: fixture.primary.tenantId,
        principalId: fixture.primary.principalId,
      });

      await expect(fixture.register(fixture.secondary)).rejects.toThrow(
        "remote role mapping target is occupied",
      );
    });

    it("rejects rotation onto an occupied mapped role", async () => {
      fixture = await openRemoteIdentityFixture();
      await fixture.register(fixture.secondary);

      await expect(
        fixture.rotate(fixture.primary.role, fixture.secondary.role),
      ).rejects.toThrow("remote role mapping target is occupied");
    });

    it("lets the private administration role manage metadata but not run Budget calls", async () => {
      fixture = await openRemoteIdentityFixture();
      await fixture.register(fixture.primary);
      const administrator = await fixture.connect({
        role: fixture.administrationRole,
        password: fixture.administrationPassword,
      });

      await expect(
        administrator.query(
          "select keynes_internal.set_remote_role_enabled_v0006($1::name, false)",
          [fixture.primary.role],
        ),
      ).resolves.toBeDefined();
      await expect(
        administrator.query(
          "select keynes_internal.inspect_remote_role_v0006($1::name)",
          [fixture.primary.role],
        ),
      ).resolves.toBeDefined();
      await expect(
        administrator.query(
          "select keynes.remote_get_compatibility('{}'::jsonb)",
        ),
      ).rejects.toThrow();
    });

    it("exposes bounded credential audit without table access", async () => {
      fixture = await openRemoteIdentityFixture();
      await fixture.register(fixture.primary);
      const administrator = await fixture.connect({
        role: fixture.administrationRole,
        password: fixture.administrationPassword,
      });

      const result = await administrator.query<{
        readonly response: unknown;
      }>(
        "select keynes_internal.audit_remote_role_v0006($1::name, $2::integer) as response",
        [fixture.primary.role, 10],
      );
      expect(result.rows).toMatchObject([
        {
          response: {
            roleName: fixture.primary.role,
            events: expect.arrayContaining([
              expect.objectContaining({ action: "registered" }),
            ]),
          },
        },
      ]);
      expect(JSON.stringify(result.rows)).not.toMatch(
        new RegExp(
          [
            fixture.primary.password,
            fixture.primary.tenantId,
            fixture.primary.principalId,
            fixture.administrationRole,
          ].join("|"),
          "u",
        ),
      );
      await expect(
        administrator.query(
          "select * from keynes_internal.remote_credential_audit",
        ),
      ).rejects.toThrow();
      for (const invalidLimit of [null, 0, 101]) {
        await expect(
          administrator.query(
            "select keynes_internal.audit_remote_role_v0006($1::name, $2::integer)",
            [fixture.primary.role, invalidLimit],
          ),
        ).rejects.toThrow("remote credential audit limit is out of range");
      }
    });

    it("makes remote privilege and schema CREATE drift fail exact recheck", async () => {
      fixture = await openRemoteIdentityFixture();
      await fixture.administrator.query(
        `revoke execute on function keynes.remote_get_budget(jsonb) from ${identifier(fixture.primary.role)}`,
      );

      await expect(fixture.recheck()).rejects.toMatchObject({
        code: "incompatible_target",
        check: "access-boundary",
      });

      await fixture.administrator.query(
        `grant execute on function keynes.remote_get_budget(jsonb) to ${identifier(fixture.primary.role)}`,
      );
      await fixture.administrator.query(
        `grant create on schema keynes to ${identifier(fixture.primary.role)}`,
      );
      await expect(fixture.recheck()).rejects.toMatchObject({
        code: "incompatible_target",
        check: "access-boundary",
      });
    });

    it("rejects unsafe enabled mappings during exact recheck", async () => {
      fixture = await openRemoteIdentityFixture();
      await fixture.register(fixture.secondary);
      await fixture.administrator.query(
        `alter role ${identifier(fixture.secondary.role)} inherit`,
      );

      await expect(fixture.recheck()).rejects.toMatchObject({
        code: "incompatible_target",
        check: "mapped-role-boundary",
      });
    });
  },
);

async function installationState(fixture: RemoteIdentityFixture): Promise<{
  readonly migrations: string[];
  readonly missingProcedures: string[];
}> {
  const migrations = await fixture.administrator.query<{
    readonly migration_id: string;
  }>(
    "select migration_id from keynes_internal.schema_migrations order by migration_id",
  );
  const procedures = [...REMOTE_RUNTIME_PROCEDURES, ...REMOTE_ADMIN_PROCEDURES];
  const inventory = await fixture.administrator.query<{
    readonly procedure: string;
    readonly present: boolean;
  }>(
    `select procedure, to_regprocedure(procedure) is not null as present
       from unnest($1::text[]) procedure
      order by procedure`,
    [procedures],
  );
  return {
    migrations: migrations.rows.map(({ migration_id }) => migration_id),
    missingProcedures: inventory.rows
      .filter(({ present }) => !present)
      .map(({ procedure }) => procedure),
  };
}
