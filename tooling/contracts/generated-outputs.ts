export const GENERATED_OUTPUTS = {
  contractDigest: "contracts/generated/contract-digest.json",
  postgresqlInstallation:
    "packages/postgresql/generated/installation-record.json",
  postgresqlPublicSql:
    "packages/postgresql/migrations/0003-public.generated.sql",
  sdkClient: "packages/sdk/src/generated/client.ts",
  sdkTypes: "packages/sdk/src/generated/types.ts",
  sdkValidators: "packages/sdk/src/generated/validators.ts",
  cloudProcedures: "services/cloud/src/generated/procedures.ts",
} as const;

export type GeneratedOutputPath =
  (typeof GENERATED_OUTPUTS)[keyof typeof GENERATED_OUTPUTS];

export const GENERATED_OUTPUT_PATHS: readonly GeneratedOutputPath[] =
  Object.values(GENERATED_OUTPUTS).sort();

export const GENERATED_OUTPUT_DIRECTORIES: readonly string[] = [
  ...new Set(
    GENERATED_OUTPUT_PATHS.map((path) => path.slice(0, path.lastIndexOf("/"))),
  ),
]
  .filter((directory) => directory.endsWith("/generated"))
  .sort();

export const GENERATED_SQL_OUTPUT_DIRECTORIES: readonly string[] = [
  ...new Set(
    GENERATED_OUTPUT_PATHS.filter((path) =>
      path.endsWith(".generated.sql"),
    ).map((path) => path.slice(0, path.lastIndexOf("/"))),
  ),
].sort();
