import Link from "next/link";
import { activateProjectAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/common/forms";
import { Badge, Denied, Meter, PageHeader, Stat } from "@/components/common/ui";
import { canEditDelivery } from "@/lib/access";
import { ResourceAllocation } from "@/components/dashboard/resource-allocation";
import { showCommercials } from "@/lib/commercial";
import { addDays, startOfWeek } from "@/lib/dates";
import { hoursConsumed } from "@/lib/delivery";
import { hoursLabel, prettyDate } from "@/lib/format";
import { isResourceAllocation } from "@/lib/hourly-sheet";
import { nameOf, requireTab } from "@/lib/page";
import { canExportCsv } from "@/lib/tab-access";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function weekHref(week: string) {
  return `?week=${week}`;
}

export default async function UtilizationPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const query = await searchParams;
  const { user, data, allowed } = await requireTab("utilization");
  if (!allowed) return <Denied title="Resource management" />;
  const start = query.week && /^\d{4}-\d{2}-\d{2}$/.test(query.week) ? startOfWeek(new Date(`${query.week}T00:00:00`)) : startOfWeek();
  const days = [0, 1, 2, 3, 4].map((offset) => addDays(start, offset));
  const end = days[4];
  const plans = data.hourlyEntries.filter(isResourceAllocation);
  const logs = data.hourlyEntries.filter((entry) => !isResourceAllocation(entry));
  const daily = new Map<string, number[]>();
  const add = (name: string, day: string, hours: number) => {
    const index = days.indexOf(day);
    if (index < 0 || !name.trim()) return;
    const row = daily.get(name.trim()) ?? [0, 0, 0, 0, 0];
    row[index] += hours;
    daily.set(name.trim(), row);
  };
  for (const entry of logs) add(entry.resource || "Unassigned", entry.workDate, entry.hours);
  for (const entry of data.timesheets) add(data.users.find((person) => person.id === entry.userId)?.fullName || "", entry.workDate, entry.hours);
  const people = [...daily.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const weekTotal = people.reduce((sum, [, hours]) => sum + hours.reduce((a, b) => a + b, 0), 0);

  const projects = new Map<string, { budget: number; target: number; consumed: number }>();
  for (const row of plans) {
    const key = row.project.trim() || "No project";
    const item = projects.get(key) ?? { budget: 0, target: 0, consumed: 0 };
    item.budget += row.estimatedHours ?? 0;
    item.target += row.targetHours ?? 0;
    projects.set(key, item);
  }
  for (const row of logs) {
    const key = row.project.trim() || "No project";
    const item = projects.get(key);
    if (item) item.consumed += row.hours;
  }
  const finalised = data.projects.filter((project) => project.sowStage === "finalised" && !projects.has(project.name.trim()));
  const approved = plans.filter((row) => /approved/i.test(row.approval)).length;
  const ready = data.projects.filter((project) => project.sowStage === "finalised");

  return (
    <>
      <PageHeader eyebrow="Operations" title="Resource management" lede="Resource allocation, utilization, and project-wise monthly report">
        <a className="btn ghost" href={weekHref(addDays(start, -7))}>Previous week</a>
        <a className="btn ghost" href={weekHref(addDays(start, 7))}>Next week</a>
      </PageHeader>
      <section className="stats">
        <Stat label="Allocated tasks" value={String(plans.length)} />
        <Stat label="Estimated hours" value={hoursLabel(plans.reduce((sum, row) => sum + (row.estimatedHours ?? 0), 0))} />
        <Stat label="Hours this week" value={hoursLabel(weekTotal)} note={`${prettyDate(start)} to ${prettyDate(end)}`} />
        <Stat label="Client approved" value={String(approved)} note="Written back from the delivery checklist" />
      </section>
      <ResourceAllocation rows={data.hourlyEntries} editable allowExport={canExportCsv(user, "utilization")} />
      <section className="card">
        <div className="card-head">
          <h2>Weekly utilization</h2>
          <span className="muted">Week of {prettyDate(start)} · 40 hours is 100%</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Resource</th>
                {DAY_NAMES.map((day) => <th key={day}>{day}</th>)}
                <th>Total</th>
                <th>Utilization</th>
              </tr>
            </thead>
            <tbody>
              {people.map(([name, byDay]) => {
                const sum = byDay.reduce((total, hours) => total + hours, 0);
                const utilization = Math.round((sum / 40) * 100);
                return (
                  <tr key={name}>
                    <td><b>{name}</b></td>
                    {byDay.map((hours, index) => (
                      <td key={days[index]}><span className={`badge ${hours > 8 ? "warn" : hours >= 7 ? "ok" : ""}`}>{hours}h</span></td>
                    ))}
                    <td>{hoursLabel(sum)}</td>
                    <td><Meter value={Math.min(100, utilization)} tone={utilization > 100 ? "bad" : undefined} />{utilization}%</td>
                  </tr>
                );
              })}
              {!people.length ? <tr><td colSpan={8}>No hours were logged this week.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <h2>Hours against SOW</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Project</th><th>Budget</th><th>Target (Embee)</th><th>Consumed</th><th>Balance</th>{showCommercials ? <th>Payment</th> : null}</tr>
            </thead>
            <tbody>
              {[...projects.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, item]) => {
                const ratio = item.budget > 0 ? Math.round((item.consumed / item.budget) * 100) : 0;
                return (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>{hoursLabel(item.budget)}</td>
                    <td>{hoursLabel(item.target)}</td>
                    <td><Meter value={Math.min(100, ratio)} tone={ratio > 90 ? "warn" : undefined} />{hoursLabel(item.consumed)}</td>
                    <td>{hoursLabel(item.budget - item.consumed)}</td>
                    {showCommercials ? <td>—</td> : null}
                  </tr>
                );
              })}
              {finalised.map((project) => {
                const consumed = hoursConsumed(project.id, data.timesheets, data.tasks);
                const ratio = project.estimatedHours > 0 ? Math.round((consumed / project.estimatedHours) * 100) : 0;
                return (
                  <tr key={project.id}>
                    <td>{project.name}</td>
                    <td>{hoursLabel(project.estimatedHours)}</td>
                    <td>—</td>
                    <td><Meter value={Math.min(100, ratio)} tone={ratio > 90 ? "warn" : undefined} />{hoursLabel(consumed)}</td>
                    <td>{hoursLabel(project.estimatedHours - consumed)}</td>
                    {showCommercials ? <td><Badge value={project.paymentStatus} /></td> : null}
                  </tr>
                );
              })}
              {!projects.size && !finalised.length ? <tr><td colSpan={6}>No allocation has been recorded yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      {ready.length ? (
        <section className="card">
          <div className="card-head">
            <h2>Project activation</h2>
            <span className="muted">Finalised SOWs ready to be staffed</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Project</th><th>Project owner</th><th>Budget hrs</th><th>Allocated</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {ready.map((project) => {
                  const allocated = data.tasks.filter((task) => task.projectId === project.id).reduce((sum, task) => sum + task.estimatedHours, 0);
                  const width = project.estimatedHours > 0 ? Math.min(100, Math.round((allocated / project.estimatedHours) * 100)) : 0;
                  return (
                    <tr key={project.id}>
                      <td><b>{project.name}</b></td>
                      <td>{nameOf(data, project.ownerId)}</td>
                      <td>{hoursLabel(project.estimatedHours)}</td>
                      <td><Meter value={width} />{hoursLabel(allocated)}</td>
                      <td><Badge value={project.activated ? project.deliveryStatus : "pending"} /></td>
                      <td>
                        {project.activated ? (
                          <Link href="/delivery">Open task management</Link>
                        ) : canEditDelivery(user, project) || user.permissions.includes("tasks.manage") ? (
                          <ActionForm action={activateProjectAction} className="inline-form">
                            <input type="hidden" name="projectId" value={project.id} />
                            <Submit>Activate</Submit>
                          </ActionForm>
                        ) : (
                          <span className="muted">Waiting for activation</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
