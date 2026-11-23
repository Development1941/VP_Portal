import fs from "fs";
import os from "os";
import path from "path";

/** Prefer project `.data` locally; on Vercel use `/tmp` because the deploy FS is read-only. */
export function localDataFile(name: string) {
  const base = process.env.VERCEL ? path.join(os.tmpdir(), "embee-vp-data") : path.join(process.cwd(), ".data");
  return path.join(base, name);
}

export function writeLocalJson(filePath: string, value: unknown) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temp = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(value, null, 2), "utf8");
    fs.renameSync(temp, filePath);
    return true;
  } catch {
    return false;
  }
}

export function readLocalJson<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}
