import { cache } from "react";
import crypto from "crypto";
import { cookies } from "next/headers";
import { isSupabaseConfigured } from "@/lib/env";
import { demoAuthenticate, sessionById } from "@/lib/demo/store";
import { PortalError } from "@/lib/form";
import { ALL_PERMISSIONS, type PermissionKey } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/lib/types";

function textMeta(value: unknown) {
  return typeof value === "string" ? value : "";
}

function secret() {
  return process.env.DEMO_AUTH_SECRET || "vp-demo-secret";
}

function signDemo(id: string) {
  const signature = crypto.createHmac("sha256", secret()).update(id).digest("hex");
  return `${id}.${signature}`;
}

function verifyDemo(token: string) {
  const [id, signature] = token.split(".");
  if (!id || !signature) return null;
  const expected = crypto.createHmac("sha256", secret()).update(id).digest("hex");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  return id;
}

async function supabaseSession(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, title, phone, about, role_id, status, company_scope, sheet_editor, roles(name, slug, locked)")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile) return null;
  const role = Array.isArray(profile.roles) ? profile.roles[0] : profile.roles;
  if (!role) return null;
  let permissions: PermissionKey[] = ALL_PERMISSIONS;
  if (!role.locked) {
    const { data: grants } = await supabase.from("role_permissions").select("permission_key").eq("role_id", profile.role_id);
    permissions = (grants ?? []).map((grant) => grant.permission_key as PermissionKey);
  }
  return {
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    title: profile.title ?? "",
    phone: profile.phone ?? "",
    roleId: profile.role_id,
    roleName: role.name,
    roleSlug: role.slug,
    permissions,
    status: profile.status,
    avatarUrl: textMeta(data.user.user_metadata?.avatar_url),
    about: textMeta(profile.about) || textMeta(data.user.user_metadata?.about),
    companyScope: profile.company_scope ?? "",
    sheetEditor: Boolean(profile.sheet_editor),
  };
}

export const getSession = cache(async () => {
  if (isSupabaseConfigured()) return supabaseSession();
  const token = (await cookies()).get("vp_session")?.value;
  if (!token) return null;
  const id = verifyDemo(token);
  return id ? sessionById(id) : null;
});

export async function signIn(email: string, password: string) {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new PortalError("Those credentials were not recognized.");
    const session = await supabaseSession();
    if (!session) {
      await supabase.auth.signOut();
      throw new PortalError("No portal profile is linked to this account. Apply supabase/schema.sql, then sign in again.");
    }
    if (session.status !== "active") {
      await supabase.auth.signOut();
      throw new PortalError("This account is not active.");
    }
    return;
  }
  const session = demoAuthenticate(email, password);
  if (!session) throw new PortalError("Those credentials were not recognized.");
  (await cookies()).set("vp_session", signDemo(session.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return;
  }
  (await cookies()).delete("vp_session");
}
