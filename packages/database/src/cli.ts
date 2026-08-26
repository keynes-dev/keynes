import { readFile } from "node:fs/promises";
import { parseInstallationConfig } from "./config.ts";
import { InstallationError, install } from "./install.ts";

const PACKAGE_NAME = "keynes-postgresql";

export async function main(
  arguments_: readonly string[] = process.argv.slice(2),
): Promise<void> {
  if (
    arguments_.length !== 3 ||
    arguments_[0] !== "install" ||
    arguments_[1] !== "--config" ||
    arguments_[2] === undefined
  ) {
    fail(
      "invalid_arguments",
      arguments_.length === 0 ||
        arguments_.filter((value) => value === "--config").length > 1
        ? "config-path"
        : "arguments",
    );
    return;
  }
  let config: ReturnType<typeof parseInstallationConfig>;
  let contents: string;
  try {
    contents = await readFile(arguments_[2], "utf8");
  } catch {
    fail("invalid_config", "config-file");
    return;
  }
  try {
    const value: unknown = JSON.parse(contents);
    config = parseInstallationConfig(value);
  } catch (error) {
    fail(
      "invalid_config",
      error instanceof SyntaxError ? "config-file" : "config",
    );
    return;
  }
  try {
    process.stdout.write(`${JSON.stringify(await install({ config }))}\n`);
  } catch (error) {
    if (error instanceof InstallationError)
      fail(error.code, error.check ?? "installation");
    else fail("database_unavailable", "connection");
  }
}

function fail(code: string, check: string): void {
  process.stdout.write(
    `${JSON.stringify({ ok: false, error: { kind: "postgresql_installation_error", code, check } })}\n`,
  );
  process.stderr.write(`${PACKAGE_NAME} installation failed: ${check}\n`);
  process.exitCode = 1;
}

if (process.argv[1]?.endsWith("/cli.js")) void main();
