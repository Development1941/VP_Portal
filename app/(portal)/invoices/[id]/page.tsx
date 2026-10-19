import Link from "next/link";
import { invoiceStatusAction } from "@/app/actions";
import { ActionForm, PrintButton, Submit } from "@/components/common/forms";
import { Badge, PageHeader } from "@/components/common/ui";
import { can } from "@/lib/access";
import { money, prettyDate } from "@/lib/format";
import { amountPaid, invoiceFigures } from "@/lib/metrics";
import { clientOf, projectOf, requirePage } from "@/lib/page";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, data, allowed } = await requirePage(["invoices.view"]);
  if (!allowed) return <PageHeader eyebrow="Invoice" title="Invoices are limited to commercial roles." />;
  const invoice = data.invoices.find((item) => item.id === id);
  if (!invoice) return <PageHeader eyebrow="Invoice" title="That invoice is not available." />;
  const lines = data.lines.filter((line) => line.invoiceId === invoice.id);
  const figures = invoiceFigures(invoice, data.lines);
  const paid = amountPaid(invoice.id, data.payments);
  const client = clientOf(data, invoice.clientId);
  const project = projectOf(data, invoice.projectId);
  const receipts = data.payments.filter((payment) => payment.invoiceId === invoice.id);

  return (
    <>
      <div className="page-head no-print">
        <div>
          <p className="eyebrow">Invoice</p>
          <h1>{invoice.number}</h1>
        </div>
        <div className="actions">
          <Badge value={invoice.status} />
          <PrintButton />
          <Link className="btn ghost" href="/invoices">All invoices</Link>
        </div>
      </div>
      <article className="sheet invoice-sheet">
        <div className="card-head">
          <div>
            <p className="eyebrow">Embee studio</p>
            <h2>{client?.company}</h2>
            <p className="muted">{client?.address}</p>
            <p className="muted">{client?.billingEmail} · {client?.taxId}</p>
          </div>
          <div>
            <p>Issued {prettyDate(invoice.issueDate)}</p>
            <p>Due {prettyDate(invoice.dueDate)}</p>
            <p>{project?.name}</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Feature</th><th className="num">Hours</th><th className="num">Rate</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <td>{line.description}</td>
                  <td className="num">{line.hours || "—"}</td>
                  <td className="num">{line.rate ? money(line.rate) : "—"}</td>
                  <td className="num">{money(line.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="totals">
          <div><span>Subtotal</span><strong>{money(figures.subtotal)}</strong></div>
          <div><span>Tax {invoice.taxRate}%</span><strong>{money(figures.tax)}</strong></div>
          <div><span>Total</span><strong>{money(figures.total)}</strong></div>
          <div><span>Received</span><strong>{money(paid)}</strong></div>
          <div><span>Balance</span><strong>{money(Math.max(0, figures.total - paid))}</strong></div>
        </div>
        {invoice.notes ? <p>{invoice.notes}</p> : null}
      </article>
      {receipts.length ? (
        <section className="card no-print">
          <h2>Receipts</h2>
          {receipts.map((payment) => (
            <div key={payment.id} className="quiet-row">
              <span>{payment.reference} · {payment.method}</span>
              <span>{money(payment.amount)} <Badge value={payment.status} /></span>
            </div>
          ))}
        </section>
      ) : null}
      {can(user, "invoices.manage") ? (
        <section className="card no-print">
          <h2>Issue or void</h2>
          <div className="actions">
            {invoice.status === "draft" ? (
              <ActionForm action={invoiceStatusAction}>
                <input type="hidden" name="id" value={invoice.id} />
                <input type="hidden" name="status" value="sent" />
                <Submit>Mark sent</Submit>
              </ActionForm>
            ) : null}
            {invoice.status !== "void" && invoice.status !== "paid" ? (
              <ActionForm action={invoiceStatusAction}>
                <input type="hidden" name="id" value={invoice.id} />
                <input type="hidden" name="status" value="void" />
                <Submit variant="danger">Void invoice</Submit>
              </ActionForm>
            ) : null}
            <Link className="btn ghost" href={`/payments?invoice=${invoice.id}&client=${invoice.clientId}&project=${invoice.projectId}`}>
              Record a receipt
            </Link>
          </div>
        </section>
      ) : null}
    </>
  );
}
