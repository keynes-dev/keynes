import { vi } from "vitest";

import type { CommandExecutor } from "../../../src/command-executor.js";
import type { DefineResourcesResult } from "../../../src/generated/types.js";

export function mockLocalExecutor() {
  const result = {
    kind: "defined",
    bindingReference: `krs_v1_${"d".repeat(43)}`,
    resources: [
      {
        key: "workUnits",
        resourceType: {
          resourceTypeId: "00000000-0000-4000-8000-000000000001",
          canonicalName: "work_units",
          unit: "unit",
          accountingBehavior: "consumable",
          definitionDigest: `sha256:${"d".repeat(64)}`,
        },
        definitionEvidence: {
          kind: "resource_type_defined",
          commandId: "00000000-0000-4000-8000-000000000101",
          principalId: "00000000-0000-4000-8000-000000000201",
          definitionDigest: `sha256:${"d".repeat(64)}`,
        },
      },
    ],
    replayed: false,
  } satisfies DefineResourcesResult;
  const execute = vi
    .fn<CommandExecutor["execute"]>(async () => {
      throw new Error("Unexpected database command after fixture startup");
    })
    .mockResolvedValueOnce({ ok: true, result, replayed: false });
  const close = vi.fn(async () => undefined);
  const open = vi.fn(async () => ({ execute, close }));
  vi.doMock("../../../src/local/pglite-command-executor.js", () => ({
    openPgliteCommandExecutor: open,
  }));
  return { execute, close, open };
}
