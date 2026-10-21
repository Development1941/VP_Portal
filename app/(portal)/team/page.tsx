import { saveStaffAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/common/forms";
import { Badge, Denied, PageHeader } from "@/components/common/ui";
import { can } from "@/lib/access";
import { showCommercials } from "@/lib/commercial";
import { money } from "@/lib/format";
import { requirePage } from "@/lib/page";

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { user, data, allowed } = await requirePage(["team.view", "team.manage"]);
  if (!allowed) return <Denied title="Team" />;
  const query = await searchParams;
  const editing = data.users.find((person) => person.id === query.edit);
  const manage = can(user, "team.manage");
  const showCost = showCommercials && (manage || can(user, "reports.financial"));

  return (
    <>
      <PageHeader eyebrow="Administration" title="Team" lede="One directory for developers, designers, QA, and anyone else. The role on each person decides what they can open." />
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Role</th><th>Title</th><th>Status</th>{showCost ? <th className="num">Hourly cost</th> : null}<th></th></tr>
            </thead>
            <tbody>
              {data.users.map((person) => (
                <tr key={person.id}>
                  <td><strong>{person.fullName}</strong><div className="muted">{person.email}</div></td>
                  <td>{person.roleName}</td>
                  <td>{person.title}</td>
                  <td><Badge value={person.status} /></td>
                  {showCost ? <td className="num">{person.hourlyCost ? money(person.hourlyCost, data.currency) : "—"}</td> : null}
                  <td>{manage ? <a href={`?edit=${person.id}`}>Edit</a> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {manage ? (
        <section className="card">
          <h2>{editing ? `Edit ${editing.fullName}` : "Add a team member"}</h2>
          <ActionForm action={saveStaffAction} className="form-grid">
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            <label className="field"><span>Full name</span><input name="fullName" defaultValue={editing?.fullName} required /></label>
            <label className="field"><span>Email</span><input type="email" name="email" defaultValue={editing?.email} required /></label>
            <label className="field"><span>Title</span><input name="title" defaultValue={editing?.title} placeholder="Developer, Designer, QA" /></label>
            <label className="field"><span>Phone</span><input name="phone" defaultValue={editing?.phone} /></label>
            <label className="field">
              <span>Role</span>
              <select name="roleId" defaultValue={editing?.roleId || data.roles.find((role) => role.slug === "developer")?.id}>
                {data.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Status</span>
              <select name="status" defaultValue={editing?.status || "active"}>
                <option value="active">Active</option>
                <option value="invited">Invited</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            {showCost ? <label className="field"><span>Internal hourly cost ({data.currency})</span><input type="number" name="hourlyCost" min="0" defaultValue={editing?.hourlyCost ?? 0} /></label> : <input type="hidden" name="hourlyCost" value={editing?.hourlyCost ?? 0} />}
            <label className="field"><span>{editing ? "New password" : "Password"}</span><input type="password" name="password" placeholder={editing ? "Leave blank to keep" : "At least 6 characters"} autoComplete="new-password" /></label>
            <Submit>{editing ? "Save member" : "Add member"}</Submit>
          </ActionForm>
        </section>
      ) : null}
    </>
  );
}
