import Link from "next/link";
import { Denied, PageHeader, Stat } from "@/components/common/ui";
import { DsrIntakeForm } from "@/components/sheets/dsr-intake";
import { HourlyTracker } from "@/components/sheets/hourly-tracker";
import { addDays, startOfWeek, todayIso } from "@/lib/dates";
import { hoursLabel } from "@/lib/format";
import { isResourceAllocation } from "@/lib/hourly-sheet";
import { requireTab } from "@/lib/page";

export default async function DsrPage() {
  const { user, data, allowed } = await requireTab("dsrIntake");
  if (!allowed) return <Denied title="DSR" />;
  const mine = data.hourlyEntries.filter((entry) => !isResourceAllocation(entry) && entry.userId === user.id);
  const ids = new Set(mine.map((entry) => entry.id));
  const weekStart = startOfWeek();
  const weekEnd = addDays(weekStart, 6);
  const weekHours = mine.filter((entry) => entry.workDate >= weekStart && entry.workDate <= weekEnd).reduce((sum, entry) => sum + entry.hours, 0);
  const blocked = mine.filter((entry) => /\bblock/i.test(entry.status)).length;
  const openBlockers = data.escalations.filter((item) => item.sourceEntryId && ids.has(item.sourceEntryId) && item.status !== "resolved").length;
  const projects = [
    ...new Set(
      [...data.hourlyEntries.map((entry) => entry.project), ...data.statusUpdates.map((row) => row.project), ...data.projects.map((project) => project.name)]
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));

  return (
    <>
      <PageHeader eyebrow="Workspace" title="Daily status report" lede="Each entry is added to Task management under its project." />
      <section className="stats">
        <Stat label="Your entries" value={String(mine.length)} href="#hourly-tracker" />
        <Stat label="Hours this week" value={hoursLabel(weekHours)} />
        <Stat label="Blocked" value={String(blocked)} note="Blocked entries need blocker remarks" />
        <Stat label="Open blockers" value={String(openBlockers)} note="Raised on Escalations from your entries" />
      </section>
      <section className="card" id="dsr-intake">
        <div className="card-head">
          <h2>DSR Intake</h2>
          <span className="muted">
            Saved entries appear in <Link href="/delivery">Task management</Link> and below
          </span>
        </div>
        <DsrIntakeForm projects={projects} resource={user.fullName} today={todayIso()} />
      </section>
      <HourlyTracker
        entries={mine}
        editable
        tools={false}
        title="Your DSR entries"
        subtitle={mine.length ? `${mine.length} ${mine.length === 1 ? "entry" : "entries"} · ${hoursLabel(mine.reduce((sum, entry) => sum + entry.hours, 0))} logged` : "Entries you add above"}
        empty="You have not added a DSR entry yet."
      />
    </>
  );
}
