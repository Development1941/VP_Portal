import Link from "next/link";
import { ActionForm, Submit } from "@/components/common/forms";
import { Badge, PageHeader, Stat } from "@/components/common/ui";
import { saveSowRecordAction, uploadSowSheetAction, uploadStatusSheetAction } from "@/app/actions";
import { ProjectHealthList } from "@/components/projects/health-list";
import { can } from "@/lib/access";
import { addDays, startOfWeek, todayIso } from "@/lib/dates";
import { hoursLabel, money, prettyDate } from "@/lib/format";
import { nameOf, projectOf, requirePage } from "@/lib/page";
import { dues, isOverdue, projectEconomics } from "@/lib/reports";
import { showCommercials } from "@/lib/commercial";
import { canPublishStatus, extraStatusColumns, groupStatus, latestStatus, statusTone } from "@/lib/status-board";
import { sowAttentionNote, sowNeedsAttention } from "@/lib/sow-board";
import type { SowRecord } from "@/lib/types";

export default async function DashboardPage() {
  const { user, data } = await requirePage(["dashboard.view"]);
  const weekStart = startOfWeek();
  const weekEnd = addDays(weekStart, 6);
  const month = todayIso().slice(0, 7);
  const mine = data.timesheets.filter((entry) => entry.userId === user.id);
  const weekHours = mine.filter((entry) => entry.workDate >= weekStart && entry.workDate <= weekEnd).reduce((sum, entry) => sum + entry.hours, 0);
  const myTasks = data.tasks.filter((task) => task.assigneeId === user.id && task.status !== "done");
  const waiting = mine.filter((entry) => entry.status === "submitted").length;
  const returned = mine.filter((entry) => entry.status === "rejected").length;
  const approvals = data.timesheets.filter((entry) => entry.status === "submitted" && data.projects.some((project) => project.id === entry.projectId && (can(user, "projects.view_all") || project.ownerId === user.id)));
  const openDues = can(user, "payments.view") || can(user, "invoices.view") ? dues(data) : [];
  const dueTotal = openDues.reduce((sum, row) => sum + row.amount, 0);
  const monthBillable = data.timesheets.filter((entry) => entry.billable && entry.workDate.startsWith(month)).reduce((sum, entry) => sum + entry.hours, 0);
  const payouts = data.payments.filter((payment) => payment.direction === "outgoing" && ["initiated", "processing"].includes(payment.status));
  const financial = can(user, "reports.financial") || can(user, "invoices.view");
  const milestones = data.milestones.filter((item) => item.status !== "completed" && item.dueDate <= addDays(todayIso(), 14));
  const board = latestStatus(data.statusUpdates);
  const groups = groupStatus(board.rows);
  const extras = extraStatusColumns(board.rows);
  const publishStatus = canPublishStatus(user);
  const sowStatus = data.sowRecords.filter((row) => row.kind === "status");
  const sowBids = data.sowRecords.filter((row) => row.kind === "bid");
  const sowAttention = data.sowRecords.filter(sowNeedsAttention);

  return (
    <>
      <PageHeader eyebrow="Workspace" title="Dashboard" />
      <section className="stats">
        <Stat label="My open tasks" value={String(myTasks.length)} note="Assigned to you" />
        <Stat label="My hours" value={hoursLabel(weekHours)} note="Logged this week" />
        {can(user, "timesheets.approve") ? <Stat label="Approvals" value={String(approvals.length)} note="Submitted and waiting" /> : <Stat label="Waiting on approval" value={String(waiting)} note={returned ? `${returned} returned` : "Submitted logs"} />}
        {showCommercials && financial ? <Stat label="Pending dues" value={money(dueTotal, data.currency)} note={`${openDues.length} open invoice${openDues.length === 1 ? "" : "s"}`} /> : <Stat label="Projects" value={String(data.projects.length)} note="Currently visible" />}
      </section>
      {showCommercials && can(user, "reports.financial") ? (
        <section className="stats">
          <Stat label="Billable this month" value={hoursLabel(monthBillable)} />
          <Stat label="Active projects" value={String(data.projects.filter((project) => project.status === "active").length)} />
          <Stat label="Payouts in progress" value={money(payouts.reduce((sum, payment) => sum + payment.amount, 0), data.currency)} note={`${payouts.length} not yet completed`} />
          <Stat label="Unbilled work" value={money(data.projects.reduce((sum, project) => sum + projectEconomics(project, data).unbilled, 0), data.currency)} note="Approved and not invoiced" />
        </section>
      ) : null}
      <section className="card status-board">
        <div className="card-head">
          <div>
            <h2>Project status</h2>
            <span className="muted">Projects and their items{board.date ? ` · ${prettyDate(board.date)}` : ""}</span>
          </div>
          {publishStatus ? (
            <ActionForm action={uploadStatusSheetAction} className="status-upload">
              <label className="file-field">
                Excel or CSV
                <input type="file" name="sheet" accept=".csv,.xlsx,.xls" required />
              </label>
              <Submit>Upload sheet</Submit>
            </ActionForm>
          ) : null}
        </div>
        {groups.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>S.no</th>
                  <th>Project</th>
                  <th>Item</th>
                  <th>Status</th>
                  <th>Task / Remarks</th>
                  <th>Company</th>
                  <th>Date</th>
                  <th>Sheet</th>
                  {extras.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((group) =>
                  group.items.map((row, index) => (
                    <tr key={`${group.key}-${row.subItem}-${index}`}>
                      {index === 0 ? (
                        <>
                          <td className="num project-cell" rowSpan={group.items.length}>
                            {group.sheetNo || "—"}
                          </td>
                          <td className="project-cell" rowSpan={group.items.length}>
                            {group.project}
                          </td>
                        </>
                      ) : null}
                      <td>{row.subItem || "—"}</td>
                      <td>
                        <span className={`badge ${statusTone(row.status)}`}>{row.status || "—"}</span>
                      </td>
                      <td className="remarks">{row.remarks || "—"}</td>
                      <td>{row.company || "—"}</td>
                      <td className="num">{prettyDate(row.statusDate)}</td>
                      <td className="num">{row.sheetLabel || "—"}</td>
                      {extras.map((column) => (
                        <td key={column}>{row.fields?.[column] || "—"}</td>
                      ))}
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">No project status has been recorded.</p>
        )}
      </section>
      <section className="card status-board" id="sow-status">
        <div className="card-head">
          <div>
            <h2>SOW status</h2>
            <span className="muted">Signed statements of work, open bids, and addenda</span>
          </div>
          {publishStatus ? (
            <ActionForm action={uploadSowSheetAction} className="status-upload">
              <label className="file-field">
                Excel or CSV
                <input type="file" name="sow" accept=".csv,.xlsx,.xls" required />
              </label>
              <Submit>Upload SOW</Submit>
            </ActionForm>
          ) : null}
        </div>
        {sowStatus.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>S.no</th>
                  <th>Project</th>
                  <th>Sprint</th>
                  <th>Link</th>
                  <th>Signed</th>
                  <th>Signed on</th>
                  <th>CR / Addendum</th>
                  <th>Company</th>
                  {publishStatus ? <th>Edit</th> : null}
                </tr>
              </thead>
              <tbody>
                {sowStatus.map((row) => (
                  <tr key={row.id}>
                    <td className="num">{row.sheetNo || "—"}</td>
                    <td>{row.project}</td>
                    <td>{row.sprint || "—"}</td>
                    <td>{sowLink(row.link)}</td>
                    <td>{row.signature ? <span className={`badge ${row.signature.toLowerCase() === "signed" ? "ok" : "warn"}`}>{row.signature}</span> : "—"}</td>
                    <td className="num">{row.signedOn || "—"}</td>
                    <td className="remarks">{row.changeRequest || "—"}</td>
                    <td>{row.company || "—"}</td>
                    {publishStatus ? (
                      <td>
                        <SowEdit row={row} />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">No SOW status has been recorded.</p>
        )}
        {sowBids.length ? (
          <>
            <div className="card-head sow-bids-head">
              <h3>SOW bids</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>S.no</th>
                    <th>Project</th>
                    <th>Reference link</th>
                    <th>Company</th>
                    {publishStatus ? <th>Edit</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {sowBids.map((row) => (
                    <tr key={row.id}>
                      <td className="num">{row.sheetNo || "—"}</td>
                      <td>{row.project}</td>
                      <td>{sowLink(row.link)}</td>
                      <td>{row.company || "—"}</td>
                      {publishStatus ? (
                        <td>
                          <SowEdit row={row} />
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>
      {user.roleSlug === "director" ? (
        <section className="card">
          <div className="card-head">
            <h2>Project health</h2>
            <Link href="/health">Full list</Link>
          </div>
          <ProjectHealthList projects={data.projects} milestones={data.milestones} timesheets={data.timesheets} />
        </section>
      ) : null}
      <div className="split">
        <section className="card">
          <div className="card-head">
            <h2>Needs attention</h2>
          </div>
          <div className="list">
            {sowAttention.map((row) => (
              <Link key={row.id} href="#sow-status">
                <span>
                  {row.project}
                  {row.company ? ` · ${row.company}` : ""} · {sowAttentionNote(row)}
                </span>
                <Badge value={row.changeRequest.trim() ? "addendum" : "pending"} />
              </Link>
            ))}
            {returned ? (
              <Link href="/timesheets">
                <span>Returned timesheets</span>
                <Badge value="rejected" />
              </Link>
            ) : null}
            {approvals.slice(0, 4).map((entry) => (
              <Link key={entry.id} href="/timesheets">
                <span>
                  {nameOf(data, entry.userId)} · {hoursLabel(entry.hours)} on {projectOf(data, entry.projectId)?.name}
                </span>
                <Badge value="submitted" />
              </Link>
            ))}
            {showCommercials
              ? openDues.slice(0, 4).map((row) => (
                <Link key={row.invoice.id} href={`/invoices/${row.invoice.id}`}>
                  <span>
                    {row.invoice.number} · {money(row.amount, data.currency)}
                  </span>
                  <Badge value={isOverdue(row.invoice.dueDate, row.amount) ? "overdue" : row.invoice.status} />
                </Link>
              ))
              : null}
            {milestones.slice(0, 4).map((item) => (
              <Link key={item.id} href={`/projects/${item.projectId}`}>
                <span>
                  {item.name} · due {prettyDate(item.dueDate)}
                </span>
                <Badge value={item.status} />
              </Link>
            ))}
            {!sowAttention.length && !returned && !approvals.length && !(showCommercials && openDues.length) && !milestones.length ? <p className="empty">No items require attention.</p> : null}
          </div>
        </section>
        <section className="card">
          <div className="card-head">
            <h2>Notifications</h2>
            <Link href="/notifications">All</Link>
          </div>
          <div className="list">
            {data.notifications.slice(0, 5).map((note) => (
              <Link key={note.id} href={note.href || "/notifications"}>
                <span>
                  <strong>{note.title}</strong>
                  <br />
                  <span className="muted">{note.body}</span>
                </span>
              </Link>
            ))}
            {!data.notifications.length ? <p className="empty">No notifications yet.</p> : null}
          </div>
        </section>
      </div>
    </>
  );
}

function sowLink(value: string) {
  if (!value) return "—";
  if (/^https?:\/\//i.test(value)) {
    return (
      <a href={value} target="_blank" rel="noreferrer">
        {value}
      </a>
    );
  }
  return value;
}

function SowEdit({ row }: { row: SowRecord }) {
  return (
    <details className="sow-edit">
      <summary>Edit</summary>
      <ActionForm action={saveSowRecordAction} className="sow-edit-form">
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="sheetNo" value={row.sheetNo} />
        <input type="hidden" name="project" value={row.project} />
        <input type="hidden" name="company" value={row.company} />
        <label className="field">
          <span>Sprint</span>
          <input name="sprint" defaultValue={row.sprint} />
        </label>
        <label className="field">
          <span>Link</span>
          <input name="link" defaultValue={row.link} />
        </label>
        <label className="field">
          <span>Signed</span>
          <select name="signature" defaultValue={row.signature}>
            <option value="">Not set</option>
            <option>Signed</option>
            <option>Unsigned</option>
          </select>
        </label>
        <label className="field">
          <span>Signed on</span>
          <input name="signedOn" defaultValue={row.signedOn} />
        </label>
        <label className="field">
          <span>CR / Addendum</span>
          <textarea name="changeRequest" rows={3} defaultValue={row.changeRequest} />
        </label>
        <Submit>Save row</Submit>
      </ActionForm>
    </details>
  );
}
