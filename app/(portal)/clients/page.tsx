import { Pencil } from "lucide-react";
import { saveClientAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/common/forms";
import { Badge, Denied, PageHeader } from "@/components/common/ui";
import { can } from "@/lib/access";
import { requirePage } from "@/lib/page";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { user, data, allowed } = await requirePage(["clients.view"]);
  if (!allowed) return <Denied title="Clients" />;
  const query = await searchParams;
  const editing = data.clients.find((client) => client.id === query.edit);

  return (
    <>
      <PageHeader eyebrow="Delivery" title="Clients" />
      <div className="table-wrap card">
        <table>
          <thead>
            <tr><th>Company</th><th>Contact</th><th>Billing</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {data.clients.map((client) => (
              <tr key={client.id}>
                <td>
                  <strong>{client.company}</strong>
                  <div className="muted">{client.address}</div>
                </td>
                <td>{client.name}<div className="muted">{client.email}</div></td>
                <td>{client.billingEmail}<div className="muted">{client.taxId}</div></td>
                <td><Badge value={client.status} /></td>
                <td>{can(user, "clients.manage") ? <a className="edit-ico" href={`?edit=${client.id}`} aria-label={`Edit ${client.company}`}><Pencil strokeWidth={1.75} aria-hidden /></a> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {can(user, "clients.manage") ? (
        <section className="card">
          <h2>{editing ? `Edit ${editing.company}` : "New client"}</h2>
          <ActionForm action={saveClientAction} className="form-grid">
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            <label className="field"><span>Contact name</span><input name="name" defaultValue={editing?.name} required /></label>
            <label className="field"><span>Company</span><input name="company" defaultValue={editing?.company} required /></label>
            <label className="field"><span>Email</span><input name="email" type="email" defaultValue={editing?.email} /></label>
            <label className="field"><span>Phone</span><input name="phone" defaultValue={editing?.phone} /></label>
            <label className="field"><span>Billing email</span><input name="billingEmail" defaultValue={editing?.billingEmail} /></label>
            <label className="field"><span>Tax id</span><input name="taxId" defaultValue={editing?.taxId} /></label>
            <label className="field"><span>Currency</span><input name="currency" defaultValue={data.currency} readOnly /></label>
            <label className="field">
              <span>Status</span>
              <select name="status" defaultValue={editing?.status || "active"}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="field wide"><span>Address</span><input name="address" defaultValue={editing?.address} /></label>
            <label className="field wide"><span>Notes</span><textarea name="notes" defaultValue={editing?.notes} /></label>
            <Submit>{editing ? "Save client" : "Add client"}</Submit>
          </ActionForm>
        </section>
      ) : null}
    </>
  );
}
