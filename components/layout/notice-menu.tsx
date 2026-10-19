import Link from "next/link";
import { Bell } from "lucide-react";
import { markReadAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/common/forms";
import { prettyStamp } from "@/lib/format";
import { Menu } from "@/components/layout/menu";
import type { Notification } from "@/lib/types";

export function NoticeMenu({ notes }: { notes: Notification[] }) {
  const unread = notes.filter((note) => !note.read).length;
  const shown = notes.slice(0, 6);
  return (
    <Menu className="account-menu">
      <summary className="bell" aria-label={unread > 0 ? `${unread} unread notifications` : "Notifications"}>
        <Bell />
        {unread > 0 ? <span className="bell-dot">{unread}</span> : null}
      </summary>
      <div className="account-drop notice-drop">
        <div className="account-id">
          <strong>Notifications</strong>
          <small>{unread > 0 ? `${unread} unread` : "Caught up"}</small>
        </div>
        {!shown.length ? <p className="notice-empty">You are caught up.</p> : null}
        {shown.map((note) => (
          <div key={note.id} className={note.read ? "notice-item" : "notice-item unread"}>
            <strong>{note.title}</strong>
            <small>{note.body}</small>
            <small>{prettyStamp(note.createdAt)}</small>
            <div className="notice-actions">
              {note.href ? <Link href={note.href}>Open</Link> : null}
              {!note.read ? (
                <ActionForm action={markReadAction}>
                  <input type="hidden" name="id" value={note.id} />
                  <Submit variant="small ghost">Mark read</Submit>
                </ActionForm>
              ) : null}
            </div>
          </div>
        ))}
        <div className="notice-foot">
          {unread > 0 ? (
            <ActionForm action={markReadAction}>
              <input type="hidden" name="id" value="all" />
              <Submit variant="small ghost">Mark all read</Submit>
            </ActionForm>
          ) : null}
          <Link href="/notifications">See all</Link>
        </div>
      </div>
    </Menu>
  );
}
