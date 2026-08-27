import { resolve } from "node:path";

import {
  packAndInstallWorkspacePackage,
  type InstalledPackage,
} from "@keynes/testkit/package";

export type PackedPostgresqlPackage = InstalledPackage;

export function packAndInstallPostgresql(
  repositoryRoot: string,
): Promise<PackedPostgresqlPackage> {
  return packAndInstallWorkspacePackage({
    workspaceRoot: resolve(repositoryRoot, "packages/postgresql"),
    archiveFileName: "keynes-postgresql-0.0.0.tgz",
    consumerName: "keynes-cloud-postgresql-consumer",
    executable: "keynes-postgresql",
  });
}
