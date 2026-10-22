import Link from "next/link";
import { saveRateAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/common/forms";
import { Badge, Denied, Meter, PageHeader } from "@/components/common/ui";
import { can } from "@/lib/access";
import { showCommercials } from "@/lib/commercial";
import { todayIso } from "@/lib/dates";
import { fxLabel } from "@/lib/fx";
import { hoursLabel, money, prettyStamp } from "@/lib/format";
import { projectOf, requirePage } from "@/lib/page";

export default async function BillingPage() {
  const { user, data, allowed } = await requirePage(["billing.features", "billing.rates"]);
  if (!allowed) return <Denied title="Billing" />;

  return (
    <>
      <PageHeader eyebrow="Commercial" title="Billing" />
      <div className="cards">
        {data.features.map((feature) => {
          const project = projectOf(data, feature.projectId);
          const logged = data.timesheets.filter((entry) => entry.featureId === feature.id);
          const hours = logged.reduce((sum, entry) => sum + entry.hours, 0);
          const billable = logged.filter((entry) => entry.billable).reduce((sum, entry) => sum + entry.hours, 0);
          const progress = feature.budgetHours > 0 ? Math.round((hours / feature.budgetHours) * 100) : 0;
          return (
            <article key={feature.id} className="feature">
              <div className="card-head">
                <h3>{feature.name}</h3>
                <Badge value={feature.billingType} />
              </div>
              <p className="muted">{project?.name} · {feature.description}</p>
              <Meter value={progress} />
              <p>{hoursLabel(billable)} billable · {hoursLabel(hours - billable)} non-billable</p>
              <strong>{feature.billingType === "fixed" ? money(feature.fixedAmount, data.currency) : `${money(feature.hourlyRate, data.currency)} / hour`}</strong>
              <Link href={`/projects/${feature.projectId}`}>Open project</Link>
            </article>
          );
        })}
      </div>
      {showCommercials && data.fxRates.length ? (
        <section className="card">
          <h2>Market rates on record</h2>
          <p className="muted">Rates recorded when the organization currency changes.</p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>From</th><th>To</th><th>Rate</th><th>Source</th><th>Recorded</th></tr></thead>
              <tbody>
                {data.fxRates.map((row) => (
                  <tr key={row.id}>
                    <td>{row.from}</td>
                    <td>{row.to}</td>
                    <td>{fxLabel(row.from, row.rate, row.to)}</td>
                    <td>{row.source}</td>
                    <td>{prettyStamp(row.recordedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      {can(user, "billing.rates") ? (
        <section className="card">
          <h2>Hourly rates</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Label</th><th>Scope</th><th>Applies to</th><th>From</th><th className="num">Rate</th></tr></thead>
              <tbody>
                {data.rates.map((rate) => (
                  <tr key={rate.id}>
                    <td>{rate.label}</td>
                    <td><Badge value={rate.scope} /></td>
                    <td>{rate.targetId || "Studio"}</td>
                    <td>{rate.effectiveFrom}</td>
                    <td className="num">{money(rate.hourlyRate, data.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ActionForm action={saveRateAction} className="form-grid">
            <label className="field"><span>Label</span><input name="label" required placeholder="Studio default" /></label>
            <label className="field">
              <span>Scope</span>
              <select name="scope" defaultValue="company">
                <option value="company">Company</option>
                <option value="role">Role</option>
                <option value="user">Person</option>
                <option value="project">Project</option>
                <option value="feature">Feature</option>
              </select>
            </label>
            <label className="field"><span>Target id</span><input name="targetId" placeholder="Leave blank for the organization default" /></label>
            <label className="field"><span>Hourly rate</span><input type="number" name="hourlyRate" min="0" required /></label>
            <label className="field"><span>Currency</span><input name="currency" defaultValue={data.currency} readOnly /></label>
            <label className="field"><span>Effective from</span><input type="date" name="effectiveFrom" defaultValue={todayIso()} /></label>
            <Submit>Save rate</Submit>
          </ActionForm>
        </section>
      ) : null}
    </>
  );
}
