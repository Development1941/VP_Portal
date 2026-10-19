import { Badge, Denied, PageHeader } from "@/components/common/ui";
import { prettyStamp } from "@/lib/format";
import { nameOf, requirePage } from "@/lib/page";

export default async function AuditPage() {
  const { data, allowed } = await requirePage(["audit.view"]);
  if (!allowed) return <Denied title="Audit log" />;

  return (
    <>
      <PageHeader eyebrow="Administration" title="Audit log" lede="Who changed a client, a rate, a timesheet decision, an invoice, or a payment." />
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>When</th><th>Person</th><th>Action</th><th>What happened</th></tr></thead>
            <tbody>
              {data.audit.map((entry) => (
                <tr key={entry.id}>
                  <td>{prettyStamp(entry.createdAt)}</td>
                  <td>{nameOf(data, entry.actorId)}</td>
                  <td><Badge value={entry.action} /></td>
                  <td>{entry.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
