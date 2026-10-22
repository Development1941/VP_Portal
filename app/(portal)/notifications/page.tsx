import { markReadAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/common/forms";
import { Denied, Empty, PageHeader } from "@/components/common/ui";
import { prettyStamp } from "@/lib/format";
import { requirePage } from "@/lib/page";

export default async function NotificationsPage() {
  const { data, allowed } = await requirePage(["notifications.view"]);
  if (!allowed) return <Denied title="Notifications" />;
  const unread = data.notifications.filter((item) => !item.read).length;

  return (
    <>
      <PageHeader eyebrow="Account" title="Notifications">
        {unread ? (
          <ActionForm action={markReadAction}>
            <input type="hidden" name="id" value="all" />
            <Submit variant="ghost">Mark all read</Submit>
          </ActionForm>
        ) : null}
      </PageHeader>
      <section className="card">
        {!data.notifications.length ? <Empty>No notifications.</Empty> : null}
        <div className="list">
          {data.notifications.map((note) => (
            <div key={note.id} className="quiet-row">
              <div>
                <strong>{note.title}</strong>
                <div className="muted">{note.body}</div>
                <div className="muted">{prettyStamp(note.createdAt)}{note.read ? "" : " · unread"}</div>
              </div>
              <div className="actions">
                {note.href ? <a className="btn ghost small" href={note.href}>Open</a> : null}
                {!note.read ? (
                  <ActionForm action={markReadAction}>
                    <input type="hidden" name="id" value={note.id} />
                    <Submit variant="small ghost">Read</Submit>
                  </ActionForm>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
