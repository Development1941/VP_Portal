import Link from "next/link";
import { Denied, PageHeader, Stat } from "@/components/common/ui";
import { HourlyTracker } from "@/components/sheets/hourly-tracker";
import { hoursLabel } from "@/lib/format";
import { isResourceAllocation } from "@/lib/hourly-sheet";
import { requireTab } from "@/lib/page";
import { canExportCsv } from "@/lib/tab-access";

export default async function DeliveryPage() {
  const { user, data, allowed } = await requireTab("dsrHourlyTracker");
  if (!allowed) return <Denied title="Task management" />;
  const logs = data.hourlyEntries.filter((entry) => !isResourceAllocation(entry));
  const blocked = logs.filter((entry) => /\bblock/i.test(entry.status));
  const linked = data.escalations.filter((item) => item.sourceEntryId && item.status !== "resolved");

  return (
    <>
      <PageHeader eyebrow="Operations" title="Task management" lede="DSR management and day-wise hourly tracker">
        <Link className="btn ghost" href="/escalations">Open escalations</Link>
      </PageHeader>
      <section className="stats">
        <Stat label="Entries" value={String(logs.length)} />
        <Stat label="Hours logged" value={hoursLabel(logs.reduce((sum, entry) => sum + entry.hours, 0))} />
        <Stat label="Blocked" value={String(blocked.length)} note="Set the status to Blocked and add remarks" />
        <Stat label="Open blocker escalations" value={String(linked.length)} href="/escalations" />
      </section>
      <HourlyTracker entries={data.hourlyEntries} editable exportable={canExportCsv(user, "dsrHourlyTracker")} />
    </>
  );
}
