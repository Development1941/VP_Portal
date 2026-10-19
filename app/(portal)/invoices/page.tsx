import Link from "next/link";
import { createInvoiceAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/common/forms";
import { Badge, Denied, PageHeader } from "@/components/common/ui";
import { can } from "@/lib/access";
import { addDays, todayIso } from "@/lib/dates";
import { money, prettyDate } from "@/lib/format";
import { clientOf, projectOf, requirePage } from "@/lib/page";
import { invoiceFigures } from "@/lib/metrics";
import { dues } from "@/lib/reports";

export default async function InvoicesPage() {
  const { user, data, allowed } = await requirePage(["invoices.view"]);
  if (!allowed) return <Denied title="Invoices" />;
  const open = dues(data);

  return (
    <>
      <PageHeader eyebrow="Commercial" title="Invoices" lede="Draft an invoice from approved billable hours in a date range. Lines are grouped by feature." />
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Number</th><th>Client</th><th>Project</th><th>Due</th><th>Status</th><th className="num">Total</th></tr></thead>
            <tbody>
              {data.invoices.map((invoice) => {
                const figures = invoiceFigures(invoice, data.lines);
                return (
                  <tr key={invoice.id}>
                    <td><Link href={`/invoices/${invoice.id}`}><strong>{invoice.number}</strong></Link></td>
                    <td>{clientOf(data, invoice.clientId)?.company}</td>
                    <td>{projectOf(data, invoice.projectId)?.name}</td>
                    <td>{prettyDate(invoice.dueDate)}</td>
                    <td><Badge value={invoice.status} /></td>
                    <td className="num">{money(figures.total, data.currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {can(user, "invoices.manage") ? (
        <section className="card">
          <h2>Generate from approved time</h2>
          <p className="muted">{open.length === 1 ? "1 invoice still has a balance." : `${open.length} invoices still have a balance.`} New drafts only pick up approved billable hours that are not already on an invoice.</p>
          <ActionForm action={createInvoiceAction} className="form-grid">
            <label className="field">
              <span>Project</span>
              <select name="projectId" defaultValue={data.projects[0]?.id}>
                {data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>
            <label className="field"><span>Tax %</span><input type="number" name="taxRate" min="0" step="0.01" defaultValue="18" /></label>
            <label className="field"><span>From</span><input type="date" name="from" defaultValue={addDays(todayIso(), -30)} /></label>
            <label className="field"><span>To</span><input type="date" name="to" defaultValue={todayIso()} /></label>
            <label className="field wide"><span>Notes</span><input name="notes" placeholder="Shown on the invoice" /></label>
            <Submit>Create draft invoice</Submit>
          </ActionForm>
        </section>
      ) : null}
    </>
  );
}
