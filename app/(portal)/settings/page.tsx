import { resetDemoAction, saveGrantsAction, saveRoleAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/common/forms";
import { Badge, Denied, PageHeader } from "@/components/common/ui";
import { isSupabaseConfigured } from "@/lib/env";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePage } from "@/lib/page";

export default async function SettingsPage() {
  const { data, allowed } = await requirePage(["settings.manage"]);
  if (!allowed) return <Denied title="Settings" />;
  const modules = [...new Set(PERMISSIONS.map((item) => item.module))];

  return (
    <>
      <PageHeader eyebrow="Administration" title="Settings" />
      <section className="card">
        <h2>Add a role</h2>
        <ActionForm action={saveRoleAction} className="form-grid">
          <label className="field"><span>Name</span><input name="name" required placeholder="Client" /></label>
          <label className="field"><span>Slug</span><input name="slug" placeholder="client" /></label>
          <label className="field wide"><span>Description</span><input name="description" placeholder="Role description" /></label>
          <Submit>Create role</Submit>
        </ActionForm>
      </section>
      {data.roles.map((role) => {
        const granted = new Set(data.grants.filter((grant) => grant.roleId === role.id).map((grant) => grant.permission));
        return (
          <section key={role.id} className="card">
            <div className="card-head">
              <div>
                <h2>{role.name}</h2>
                <p className="muted">{role.description}</p>
              </div>
              <Badge value={role.locked ? "locked" : role.isSystem ? "system" : "custom"} />
            </div>
            {role.locked ? (
              <p>This role has full access. Its permissions cannot be changed.</p>
            ) : (
              <>
                <ActionForm action={saveRoleAction} className="form-grid">
                  <input type="hidden" name="id" value={role.id} />
                  <label className="field"><span>Name</span><input name="name" defaultValue={role.name} /></label>
                  <label className="field wide"><span>Description</span><input name="description" defaultValue={role.description} /></label>
                  <Submit variant="ghost">Rename</Submit>
                </ActionForm>
                <ActionForm action={saveGrantsAction}>
                  <input type="hidden" name="roleId" value={role.id} />
                  <div className="stack">
                    {modules.map((module) => (
                      <div key={module}>
                        <h3>{module}</h3>
                        <div className="checks">
                          {PERMISSIONS.filter((item) => item.module === module).map((item) => (
                            <label key={item.key} className="check">
                              <input type="checkbox" name="permission" value={item.key} defaultChecked={granted.has(item.key)} />
                              <span>{item.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Submit>Save permissions</Submit>
                </ActionForm>
              </>
            )}
          </section>
        );
      })}
      {!isSupabaseConfigured() ? (
        <section className="card">
          <h2>Sample data</h2>
          <p className="muted">Restore the original sample workspace.</p>
          <form action={resetDemoAction}>
            <button className="btn danger">Reset sample data</button>
          </form>
        </section>
      ) : null}
    </>
  );
}
