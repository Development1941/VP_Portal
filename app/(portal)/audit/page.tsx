import { Badge, Denied, PageHeader } from "@/components/common/ui";
import { prettyStamp } from "@/lib/format";
import { nameOf, requirePage } from "@/lib/page";
import { canSeeLeadershipSections } from "@/lib/tab-access";

export default async function AuditPage() {
  const { user, data, allowed } = await requirePage(["audit.view"]);
  if (!allowed || !canSeeLeadershipSections(user)) return <Denied title="Audit log" />;

  return (
    <>
      <PageHeader eyebrow="Administration" title="Audit log" />
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>When</th><th>Person</th><th>Action</th><th>Details</th></tr></thead>
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
