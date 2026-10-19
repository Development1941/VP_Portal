import { Denied, Meter, PageHeader } from "@/components/common/ui";
import { Badge } from "@/components/common/ui";
import { addDays, startOfWeek } from "@/lib/dates";
import { hoursConsumed } from "@/lib/delivery";
import { hoursLabel, money, prettyDate } from "@/lib/format";
import { entryValue, resolveBillRate } from "@/lib/metrics";
import { requirePage } from "@/lib/page";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export default async function UtilizationPage() {
  const { data, allowed } = await requirePage(["timesheets.view_all", "billing.features", "reports.project", "reports.financial"]);
  if (!allowed) return <Denied title="Billing and utilization" />;
  const start = startOfWeek();
  const days = [0, 1, 2, 3, 4].map((offset) => addDays(start, offset));
  const end = days[4];
  const weekEntries = data.timesheets.filter((entry) => entry.workDate >= start && entry.workDate <= end);
  const people = data.users.filter((person) => weekEntries.some((entry) => entry.userId === person.id) || data.members.some((member) => member.userId === person.id));
  let total = 0;
  const finalised = data.projects.filter((project) => project.sowStage === "finalised");

  return (
    <>
      <PageHeader eyebrow="Delivery control" title="Resource billing and hourly utilization" lede={`Week of ${prettyDate(start)}. Billable hours against an 8 hour day.`} />
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Resource</th>
                {DAY_NAMES.map((day) => <th key={day}>{day}</th>)}
                <th>Total</th>
                <th>Utilization</th>
                <th>Rate</th>
                <th>Billable</th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => {
                const mine = weekEntries.filter((entry) => entry.userId === person.id);
                const byDay = days.map((day) => mine.filter((entry) => entry.workDate === day).reduce((sum, entry) => sum + entry.hours, 0));
                const sum = byDay.reduce((totalHours, hours) => totalHours + hours, 0);
                const utilization = Math.round((sum / 40) * 100);
                const billable = mine.filter((entry) => entry.billable).reduce((amount, entry) => amount + entryValue(entry, data.features, data.members, data.rates, data.users), 0);
                total += billable;
                const rates = [...new Set(mine.map((entry) => resolveBillRate(entry, data.features, data.members, data.rates, data.users)).filter((rate) => rate > 0))];
                return (
                  <tr key={person.id}>
                    <td><b>{person.fullName}</b><br /><span className="muted">{person.title || person.roleName}</span></td>
                    {byDay.map((hours, index) => (
                      <td key={days[index]}><span className={`badge ${hours > 8 ? "warn" : hours >= 7 ? "ok" : ""}`}>{hours}h</span></td>
                    ))}
                    <td>{hoursLabel(sum)}</td>
                    <td><Meter value={Math.min(100, utilization)} tone={utilization > 100 ? "bad" : undefined} />{utilization}%</td>
                    <td>{rates.length === 1 ? `${money(rates[0], data.currency)}/h` : rates.length > 1 ? "Mixed" : "—"}</td>
                    <td>{money(billable, data.currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="total-line"><b>Weekly billable total: {money(total, data.currency)}</b></p>
      </section>
      <section className="card">
        <h2>Hours against SOW</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Project</th><th>Budget</th><th>Consumed</th><th>Balance</th><th>Invoicing</th><th>Payment</th></tr>
            </thead>
            <tbody>
              {finalised.map((project) => {
                const consumed = hoursConsumed(project.id, data.timesheets, data.tasks);
                const ratio = project.estimatedHours > 0 ? Math.round((consumed / project.estimatedHours) * 100) : 0;
                return (
                  <tr key={project.id}>
                    <td>{project.name}</td>
                    <td>{hoursLabel(project.estimatedHours)}</td>
                    <td><Meter value={Math.min(100, ratio)} tone={ratio > 90 ? "warn" : undefined} />{hoursLabel(consumed)}</td>
                    <td>{hoursLabel(project.estimatedHours - consumed)}</td>
                    <td>{project.invoicingStatus}</td>
                    <td><Badge value={project.paymentStatus} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
