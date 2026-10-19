import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import * as demo from "@/lib/demo/store";
import * as cloud from "@/lib/supabase/repo";
import { getSession } from "@/lib/session";
import { PortalError } from "@/lib/form";

export function db() {
  return isSupabaseConfigured() ? cloud : demo;
}

export const loadWorkspace = cache(async (userId: string) => {
  const user = await getSession();
  if (!user || user.id !== userId) throw new PortalError("Your session expired. Sign in again.");
  return db().workspace(user);
});
