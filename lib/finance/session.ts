import { cache } from "react";
import crypto from "crypto";
import { cookies } from "next/headers";
import { PortalError } from "@/lib/form";
import { financeAuthenticate, financeSessionById } from "@/lib/finance/store";
import type { FinanceSessionUser } from "@/lib/finance/types";

const COOKIE = "finance_session";

function secret() {
  return process.env.DEMO_AUTH_SECRET || "finance-demo-secret";
}

function sign(id: string) {
  const signature = crypto.createHmac("sha256", secret()).update(id).digest("hex");
  return `${id}.${signature}`;
}

function verify(token: string) {
  const [id, signature] = token.split(".");
  if (!id || !signature) return null;
  const expected = crypto.createHmac("sha256", secret()).update(id).digest("hex");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  return id;
}

export const getFinanceSession = cache(async (): Promise<FinanceSessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const id = verify(token);
  return id ? financeSessionById(id) : null;
});

export async function financeSignIn(email: string, password: string) {
  const session = financeAuthenticate(email, password);
  if (!session) throw new PortalError("Those credentials were not recognized.");
  (await cookies()).set(COOKIE, sign(session.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function financeSignOut() {
  (await cookies()).delete(COOKIE);
}
