import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

export interface ArchiveEntry {
  readonly body: Buffer;
  readonly mode: number;
  readonly path: string;
}

export async function readPackageArchive(
  path: string,
): Promise<ArchiveEntry[]> {
  return readPackageArchiveBytes(await readFile(path));
}

export function readPackageArchiveBytes(compressed: Buffer): ArchiveEntry[] {
  return readTar(gunzipSync(compressed));
}

function readTar(bytes: Buffer): ArchiveEntry[] {
  const result: ArchiveEntry[] = [];
  for (let offset = 0; offset + 512 <= bytes.length;) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = tarText(header.subarray(0, 100));
    const prefix = tarText(header.subarray(345, 500));
    const path = prefix === "" ? name : `${prefix}/${name}`;
    const mode = Number.parseInt(tarText(header.subarray(100, 108)).trim(), 8);
    const sizeText = tarText(header.subarray(124, 136)).trim();
    const size = sizeText === "" ? 0 : Number.parseInt(sizeText, 8);
    if (!Number.isSafeInteger(size) || size < 0) {
      throw new Error(`Archive has invalid size for ${path}`);
    }
    const bodyStart = offset + 512;
    const bodyEnd = bodyStart + size;
    if (bodyEnd > bytes.length)
      throw new Error(`Archive is truncated at ${path}`);
    if (header[156] === 0 || header[156] === 48) {
      if (
        path === "" ||
        path.startsWith("/") ||
        path.split("/").includes("..")
      ) {
        throw new Error(`Archive has invalid path ${path}`);
      }
      result.push({ body: bytes.subarray(bodyStart, bodyEnd), mode, path });
    }
    offset = bodyStart + Math.ceil(size / 512) * 512;
  }
  return result;
}

function tarText(bytes: Buffer): string {
  const end = bytes.indexOf(0);
  return bytes.subarray(0, end === -1 ? bytes.length : end).toString("utf8");
}
