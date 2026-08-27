import { createGunzip } from "node:zlib";
import { readFile } from "node:fs/promises";

export interface ArchiveEntry {
  readonly body: Buffer;
  readonly mode: number;
  readonly path: string;
}

export async function readPackageArchive(
  path: string,
): Promise<ArchiveEntry[]> {
  const compressed = await readFile(path);
  const bytes = Buffer.from(
    await new Promise<Buffer>((resolve, reject) => {
      const stream = createGunzip();
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.end(compressed);
    }),
  );
  return readTar(bytes);
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
    const size = Number.parseInt(tarText(header.subarray(124, 136)).trim(), 8);
    const bodyStart = offset + 512;
    const bodyEnd = bodyStart + size;
    if (header[156] === 0 || header[156] === 48) {
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
