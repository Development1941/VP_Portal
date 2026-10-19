import { db } from "@/lib/data";
import { PortalError } from "@/lib/form";
import { getSession } from "@/lib/session";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return new Response("Sign in required.", { status: 401 });
  const { id } = await context.params;
  try {
    const file = await db().projectFile(user, id);
    return new Response(Buffer.from(file.bytes), {
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${file.name.replaceAll('"', "")}"`,
      },
    });
  } catch (error) {
    const message = error instanceof PortalError ? error.message : "That file could not be downloaded.";
    return new Response(message, { status: 404 });
  }
}
