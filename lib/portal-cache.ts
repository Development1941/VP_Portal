import type { Workspace } from "@/lib/types";

const entries = new Map<string, { at: number; stamp: string; data: Workspace }>();
const freshFor = 30_000;

export function takeWorkspace(key: string, stamp: string) {
  const hit = entries.get(key);
  if (!hit || hit.stamp !== stamp || Date.now() - hit.at > freshFor) return null;
  return hit.data;
}

export function keepWorkspace(key: string, stamp: string, data: Workspace) {
  entries.set(key, { at: Date.now(), stamp, data });
}

export function invalidatePortalCache() {
  entries.clear();
}
