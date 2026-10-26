import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import * as demo from "@/lib/demo/store";
import * as cloud from "@/lib/supabase/repo";
import { getSession } from "@/lib/session";
import { PortalError } from "@/lib/form";
import { invalidatePortalCache, keepWorkspace, takeWorkspace } from "@/lib/portal-cache";

const reads = new Set(["workspace", "projectLog", "organizations", "intakeOwners", "projectFile", "clientDirectory"]);

export function db() {
  const source = isSupabaseConfigured() ? cloud : demo;
  return new Proxy(source, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop !== "string" || typeof value !== "function" || reads.has(prop)) return value;
      return (...args: unknown[]) => {
        const result = value.apply(target, args);
        if (result && typeof result.then === "function") return result.finally(invalidatePortalCache);
        invalidatePortalCache();
        return result;
      };
    },
  }) as typeof source;
}

export const loadWorkspace = cache(async (userId: string) => {
  const user = await getSession();
  if (!user || user.id !== userId) throw new PortalError("Your session expired. Sign in again.");
  const stamp = isSupabaseConfigured() ? "cloud" : demo.storeStamp();
  const hit = takeWorkspace(user.id, stamp);
  if (hit) return hit;
  const data = await db().workspace(user);
  keepWorkspace(user.id, stamp, data);
  return data;
});
