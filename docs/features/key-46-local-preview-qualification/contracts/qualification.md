# Local preview qualification contract

This reference defines the internal command and evidence boundaries for KEY-46. It does not add a public SDK method or publish a package.

## Package build

```sh
pnpm --filter @keynes/sdk build
pnpm --filter @keynes/sdk pack --pack-destination <directory>
```

The build starts from `packages/sdk/src/index.ts`, emits JavaScript and declarations under `packages/sdk/dist/sdk/src/`, and copies `packages/database/` to `packages/sdk/dist/database/` with `node:fs.cp`. The pack command creates one archive and prints its path. Callers pass that path to later commands. No later command packs implicitly.

Build failure conditions are a TypeScript error, a missing or changed copied database file, a missing declaration, an undeclared production import, or a package file outside the allowlist.

## Package acceptance

```sh
pnpm test:package -- --archive <path>
```

The command:

1. verifies the archive SHA-256 and pack file list;
2. checks the compressed-size limit and forbidden paths;
3. installs the archive in a temporary consumer outside the repository;
4. checks the production installation size;
5. compiles one `consumer.mts` against package-root declarations; and
6. executes that consumer's public Budget-loop, isolation, closure, and process-exit cases.

The command exits nonzero on the first failed qualification group after releasing its child processes and temporary resources. It prints the archive digest and every completed group. It does not publish, contact a Keynes service, or preserve a temporary consumer as evidence.

## Reference measurement

```sh
pnpm qualify:local -- --archive <path> --output <record.json>
```

The command accepts exactly one existing archive and one new output path. It rejects unknown arguments and refuses to overwrite an output file.

The JSON record has this shape:

```ts
interface LocalPreviewQualificationRecord {
  readonly archive: {
    readonly sha256: string;
    readonly compressedBytes: number;
    readonly productionBytes: number;
    readonly packageVersion: string;
    readonly pgliteVersion: "0.5.5";
    readonly contractDigest: string;
  };
  readonly environment: {
    readonly commit: string;
    readonly os: string;
    readonly release: string;
    readonly architecture: string;
    readonly nodeVersion: string;
    readonly runnerName: string;
  };
  readonly method: {
    readonly coldWarmup: number;
    readonly coldProcesses: number;
    readonly firstRequestProcesses: number;
    readonly steadyWarmup: number;
    readonly steadySamples: number;
    readonly percentile: "nearest-rank";
  };
  readonly samples: {
    readonly readyRssDeltaBytes: readonly number[];
    readonly coldCreateMilliseconds: readonly number[];
    readonly firstRequestMilliseconds: readonly number[];
    readonly steadyRequestMilliseconds: readonly number[];
  };
  readonly observed: {
    readonly readyRssDeltaBytes: {
      readonly count: number;
      readonly p95: number;
    };
    readonly coldCreateMilliseconds: {
      readonly count: number;
      readonly p95: number;
    };
    readonly firstRequestMilliseconds: {
      readonly count: number;
      readonly p95: number;
    };
    readonly steadyRequestMilliseconds: {
      readonly count: number;
      readonly p95: number;
    };
  };
  readonly limits: {
    readonly archiveBytes: 524288;
    readonly productionBytes: 36700160;
    readonly readyRssDeltaBytes: 1073741824;
    readonly coldCreateP95Milliseconds: 3000;
    readonly firstRequestP95Milliseconds: 250;
    readonly steadyRequestP95Milliseconds: 100;
  };
}
```

The output uses integers for byte counts and finite non-negative numbers for elapsed milliseconds. The command retains every sample in collection order. It computes nearest-rank percentiles from a sorted copy.

## Hosted matrix

The manual Local Preview workflow builds one archive on Linux x64 with Node.js 24. Every downstream job verifies its SHA-256 before installation.

| Runner         | Architecture | Node.js |
| -------------- | ------------ | ------- |
| `ubuntu-24.04` | x64          | 24, 26  |
| `macos-15`     | arm64        | 24, 26  |
| `windows-2025` | x64          | 24, 26  |

Only the Linux x64 Node.js 24 job runs `pnpm qualify:local`. Every matrix job runs `pnpm test:package` against the downloaded archive. A skipped, cancelled, timed-out, or failed job does not qualify its environment.

## Public-contract boundary

KEY-46 adds no package-root export. Qualification scripts, fixtures, raw measurements, archive paths, copied database files, and fault controls stay outside the public SDK contract. Public consumers continue to import only the KEY-45 facade and generated domain types from `@keynes/sdk`.
