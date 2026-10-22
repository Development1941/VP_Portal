import { paymentStatusAction, savePaymentAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/common/forms";
import { Badge, Denied, PageHeader } from "@/components/common/ui";
import { can } from "@/lib/access";
import { money, prettyDate, prettyStamp } from "@/lib/format";
import { clientOf, nameOf, projectOf, requirePage } from "@/lib/page";
import { dues, isOverdue } from "@/lib/reports";
import type { Payment } from "@/lib/types";

const STATUSES: Payment["status"][] = ["initiated", "processing", "completed", "failed", "cancelled"];

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ invoice?: string; client?: string; project?: string }> }) {
  const { user, data, allowed } = await requirePage(["payments.view"]);
  if (!allowed) return <Denied title="Payments" />;
  const query = await searchParams;
  const open = dues(data);
  const incoming = data.payments.filter((payment) => payment.direction === "incoming");
  const outgoing = data.payments.filter((payment) => payment.direction === "outgoing");

  return (
    <>
      <PageHeader eyebrow="Commercial" title="Payments" />
      <section className="card">
        <h2>Pending dues</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Invoice</th><th>Client</th><th>Due</th><th className="num">Balance</th></tr></thead>
            <tbody>
              {open.map((row) => (
                <tr key={row.invoice.id}>
                  <td><a href={`/invoices/${row.invoice.id}`}>{row.invoice.number}</a></td>
                  <td>{clientOf(data, row.invoice.clientId)?.company}</td>
                  <td>{prettyDate(row.invoice.dueDate)} {isOverdue(row.invoice.dueDate, row.amount) ? <Badge value="overdue" /> : null}</td>
                  <td className="num">{money(row.amount, data.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!open.length ? <p className="empty">No open balances.</p> : null}
      </section>
      <div className="split">
        <PaymentTable title="Client receipts" rows={incoming} data={data} manage={can(user, "payments.manage")} />
        <PaymentTable title="Team payouts" rows={outgoing} data={data} manage={can(user, "payments.manage")} />
      </div>
      {can(user, "payments.manage") ? (
        <section className="card">
          <h2>Initiate a payment</h2>
          <ActionForm action={savePaymentAction} className="form-grid pay-form">
            <div className="wide actions">
              <label className="check"><input type="radio" name="direction" value="incoming" defaultChecked /><span>Incoming receipt</span></label>
              <label className="check"><input type="radio" name="direction" value="outgoing" /><span>Outgoing payout</span></label>
            </div>
            <label className="field when-incoming">
              <span>Client</span>
              <select name="clientId" defaultValue={query.client || data.clients[0]?.id}>
                {data.clients.map((client) => <option key={client.id} value={client.id}>{client.company}</option>)}
              </select>
            </label>
            <label className="field when-outgoing">
              <span>Team member</span>
              <select name="userId" defaultValue="">
                <option value="">Choose</option>
                {data.users.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Invoice</span>
              <select name="invoiceId" defaultValue={query.invoice || ""}>
                <option value="">None</option>
                {data.invoices.filter((invoice) => invoice.status !== "void").map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.number}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Project</span>
              <select name="projectId" defaultValue={query.project || ""}>
                <option value="">None</option>
                {data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>
            <label className="field"><span>Amount ({data.currency})</span><input type="number" name="amount" min="1" step="0.01" required /></label>
            <input type="hidden" name="currency" value={data.currency} />
            <label className="field"><span>Method</span><input name="method" defaultValue="Bank transfer" /></label>
            <label className="field"><span>Reference</span><input name="reference" placeholder="Optional, generated if blank" /></label>
            <label className="field wide"><span>Notes</span><input name="notes" /></label>
            <Submit>Initiate payment</Submit>
          </ActionForm>
        </section>
      ) : null}
    </>
  );
}

function PaymentTable({
  title,
  rows,
  data,
  manage,
}: {
  title: string;
  rows: Payment[];
  data: Awaited<ReturnType<typeof requirePage>>["data"];
  manage: boolean;
}) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <div className="list">
        {rows.map((payment) => (
          <div key={payment.id} className="quiet-row">
            <div>
              <strong>{money(payment.amount, data.currency)}</strong>
              <div className="muted">
                {payment.reference} · {payment.direction === "incoming" ? clientOf(data, payment.clientId)?.company : nameOf(data, payment.userId)}
                {payment.projectId ? ` · ${projectOf(data, payment.projectId)?.name}` : ""} · {prettyStamp(payment.createdAt)}
              </div>
            </div>
            {manage ? (
              <ActionForm action={paymentStatusAction} className="actions">
                <input type="hidden" name="id" value={payment.id} />
                <select name="status" defaultValue={payment.status} aria-label={`Status for ${payment.reference}`}>
                  {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <Submit variant="small">Update</Submit>
              </ActionForm>
            ) : <Badge value={payment.status} />}
          </div>
        ))}
        {!rows.length ? <p className="empty">No payments recorded.</p> : null}
      </div>
    </section>
  );
}
