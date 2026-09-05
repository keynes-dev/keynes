import { createHash } from "node:crypto";
import { lstat, readFile, readlink } from "node:fs/promises";
import { join } from "node:path";
import { runProcess } from "./process.ts";

export interface SourceSnapshot {
  readonly commit: string;
  readonly clean: boolean;
  readonly dirtyInputSha256: string | null;
}

export async function readSourceSnapshot(
  root: string,
  signal?: AbortSignal,
): Promise<SourceSnapshot> {
  const command = (args: readonly string[]) =>
    runProcess({
      executable: "git",
      args,
      cwd: root,
      signal: AbortSignal.any([
        AbortSignal.timeout(10_000),
        ...(signal === undefined ? [] : [signal]),
      ]),
    });
  const [revision, status] = await Promise.all([
    command(["rev-parse", "HEAD"]),
    command(["status", "--porcelain", "--untracked-files=all", "-z"]),
  ]);
  const commit = revision.trim();
  if (!/^[0-9a-f]{40}$/.test(commit))
    throw new Error("Invalid source revision");
  if (status === "") return { commit, clean: true, dirtyInputSha256: null };
  const [patch, untracked] = await Promise.all([
    command(["diff", "HEAD", "--binary", "--no-ext-diff", "--no-textconv"]),
    command(["ls-files", "--others", "--exclude-standard", "-z"]),
  ]);
  const digest = createHash("sha256").update(status).update("\0").update(patch);
  for (const path of untracked.split("\0").filter(Boolean).sort()) {
    signal?.throwIfAborted();
    const absolute = join(root, path);
    const info = await lstat(absolute);
    const bytes = info.isSymbolicLink()
      ? await readlink(absolute)
      : await readFile(absolute);
    digest
      .update("\0")
      .update(path)
      .update("\0")
      .update(String(info.mode))
      .update("\0")
      .update(bytes);
  }
  return { commit, clean: false, dirtyInputSha256: digest.digest("hex") };
}
