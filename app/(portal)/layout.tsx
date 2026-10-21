import { redirect } from "next/navigation";
import { Shell } from "@/components/layout/shell";
import { loadWorkspace } from "@/lib/data";
import { navigation } from "@/lib/nav";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");
  const data = await loadWorkspace(user.id);
  return (
    <Shell user={user} links={navigation(user)} notes={data.notifications} currency={data.currency} fx={data.fxRates[0]}>
      {children}
    </Shell>
  );
}
