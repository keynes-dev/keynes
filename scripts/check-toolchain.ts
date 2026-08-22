import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const expectedNodeVersion = "24.19.0";
const expectedPnpmVersion = "11.21.0";

export function validateToolchain(
  nodeVersion: string,
  pnpmVersion: string,
): string[] {
  const diagnostics: string[] = [];
  const normalizedNodeVersion = nodeVersion.replace(/^v/, "");

  if (normalizedNodeVersion !== expectedNodeVersion) {
    diagnostics.push(
      `TOOL001_NODE_VERSION: expected Node.js ${expectedNodeVersion}, received ${normalizedNodeVersion}`,
    );
  }

  if (pnpmVersion !== expectedPnpmVersion) {
    diagnostics.push(
      `TOOL002_PNPM_VERSION: expected pnpm ${expectedPnpmVersion}, received ${pnpmVersion}`,
    );
  }

  return diagnostics;
}

function currentPnpmVersion(): string {
  const userAgent = process.env.npm_config_user_agent;
  const userAgentVersion = userAgent?.match(/pnpm\/([^\s]+)/)?.[1];

  if (userAgentVersion !== undefined) {
    return userAgentVersion;
  }

  const result = spawnSync("pnpm", ["--version"], {
    encoding: "utf8",
    shell: false,
  });

  if (result.status !== 0) {
    return "unavailable";
  }

  return result.stdout.trim();
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1];
  return (
    entrypoint !== undefined &&
    import.meta.url === pathToFileURL(entrypoint).href
  );
}

if (isMainModule()) {
  const diagnostics = validateToolchain(process.version, currentPnpmVersion());

  if (diagnostics.length > 0) {
    console.error(diagnostics.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(
      `Toolchain verified: Node.js ${expectedNodeVersion}, pnpm ${expectedPnpmVersion}`,
    );
  }
}
