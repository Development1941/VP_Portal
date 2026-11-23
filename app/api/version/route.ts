import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    commit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "local",
    env: process.env.VERCEL_ENV || "local",
    deployedAt: process.env.VERCEL_DEPLOYMENT_ID || "local",
  });
}
