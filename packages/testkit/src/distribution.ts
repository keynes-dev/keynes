import { access, readdir, rename, rm } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

export async function replaceDistribution(
  source: string,
  destination: string,
  label = "Distribution",
): Promise<void> {
  const backup = `${destination}.previous`;
  await rm(backup, { recursive: true, force: true });
  const hadDestination = await exists(destination);
  if (hadDestination) await rename(destination, backup);
  try {
    await rename(source, destination);
  } catch (error: unknown) {
    if (hadDestination) await rename(backup, destination);
    throw error;
  }
  try {
    await rm(backup, { recursive: true, force: true });
  } catch (cleanupFailure: unknown) {
    if (!hadDestination) throw cleanupFailure;
    try {
      await rename(destination, source);
      await rename(backup, destination);
    } catch (restorationFailure: unknown) {
      throw new AggregateError(
        [cleanupFailure, restorationFailure],
        `${label} cleanup and restoration failed`,
        { cause: cleanupFailure },
      );
    }
    throw cleanupFailure;
  }
}

export async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter((entry) => !entry.isDirectory())
    .map((entry) =>
      relative(root, resolve(entry.parentPath, entry.name))
        .split(sep)
        .join("/"),
    )
    .sort();
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === "ENOENT") return false;
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
