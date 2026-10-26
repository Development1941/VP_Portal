import Link from "next/link";
import { Badge, PageHeader, Stat } from "@/components/common/ui";
import { ResourceAllocation } from "@/components/dashboard/resource-allocation";
import { HourlyEditRow, SowEditRow } from "@/components/dashboard/row-edit";
import { SheetUpload } from "@/components/dashboard/sheet-upload";
import { uploadHourlyTrackerAction, uploadSowSheetAction, uploadStatusSheetAction } from "@/app/actions";
import { ProjectHealthList } from "@/components/projects/health-list";
import { can } from "@/lib/access";
import { addDays, startOfWeek, todayIso } from "@/lib/dates";
import { hoursLabel, money, prettyDate } from "@/lib/format";
import { nameOf, projectOf, requirePage } from "@/lib/page";
import { dues, isOverdue, projectEconomics } from "@/lib/reports";
import { showCommercials } from "@/lib/commercial";
import { canPublishStatus, extraStatusColumns, groupStatus, latestStatus, statusIsSettled, statusNeedsAttention, statusTone } from "@/lib/status-board";
import { canUseHourlyTracker, isResourceAllocation } from "@/lib/hourly-sheet";
import { sowAttentionNote, sowNeedsAttention } from "@/lib/sow-board";
import type { HourlyEntry } from "@/lib/types";

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
  const statusAttention = board.rows.filter((row) => statusNeedsAttention(row.status));
  const trackHours = canUseHourlyTracker(user);
  const myHours = data.hourlyEntries.filter((entry) => !isResourceAllocation(entry));
  const hourProjects = hourGroups(myHours);
  const weekHourly = myHours.filter((entry) => entry.workDate >= weekStart && entry.workDate <= weekEnd).reduce((sum, entry) => sum + entry.hours, 0);
  const loggedHours = weekHours || weekHourly;
  const openItems = board.rows.filter((row) => row.status.trim() && !statusIsSettled(row.status)).length;
  const sheetProjects = new Set(board.rows.map((row) => row.project).filter(Boolean)).size;
  const attentionCount = statusAttention.length + sowAttention.length;

  return (
    <>
      <PageHeader eyebrow="Workspace" title="Dashboard" />
      <section className="card" id="needs-attention">
        <div className="card-head">
          <h2>Needs attention</h2>
        </div>
        <div className="list">
          {statusAttention.map((row) => (
            <Link key={`${row.sheetNo}-${row.project}-${row.subItem}`} href="#project-status">
              <span className="attention-item">
                <strong>
                  {row.project}
                  {row.subItem ? ` · ${row.subItem}` : ""}
                  {row.company ? ` · ${row.company}` : ""}
                </strong>
                <span className="attention-cause">{row.remarks.trim() || (row.status.toLowerCase().includes("pending") ? "Pending" : "Not started")}</span>
              </span>
              <Badge value={row.status.toLowerCase().includes("pending") ? "pending" : "not_started"} />
            </Link>
          ))}
          {sowAttention.map((row) => (
            <Link key={row.id} href="#sow-status">
              <span className="attention-item">
                <strong>
                  {row.project}
                  {row.company ? ` · ${row.company}` : ""}
                  {row.sprint ? ` · ${row.sprint}` : ""}
                </strong>
                <span className="attention-cause">{row.changeRequest.trim() || sowAttentionNote(row)}</span>
              </span>
              <Badge value="addendum" />
            </Link>
          ))}
          {mine.filter((entry) => entry.status === "rejected").map((entry) => (
            <Link key={entry.id} href="/timesheets">
              <span className="attention-item">
                <strong>Returned timesheet · {projectOf(data, entry.projectId)?.name}</strong>
                <span className="attention-cause">{entry.rejectionNote.trim() || "Returned for correction"}</span>
              </span>
              <Badge value="rejected" />
            </Link>
          ))}
          {approvals.slice(0, 4).map((entry) => (
            <Link key={entry.id} href="/timesheets">
              <span className="attention-item">
                <strong>{nameOf(data, entry.userId)} · {hoursLabel(entry.hours)} on {projectOf(data, entry.projectId)?.name}</strong>
                <span className="attention-cause">Submitted and waiting for approval</span>
              </span>
              <Badge value="submitted" />
            </Link>
          ))}
          {showCommercials
            ? openDues.slice(0, 4).map((row) => (
              <Link key={row.invoice.id} href={`/invoices/${row.invoice.id}`}>
                <span className="attention-item">
                  <strong>{row.invoice.number} · {money(row.amount, data.currency)}</strong>
                  <span className="attention-cause">{isOverdue(row.invoice.dueDate, row.amount) ? `Overdue since ${prettyDate(row.invoice.dueDate)}` : `Due ${prettyDate(row.invoice.dueDate)}`}</span>
                </span>
                <Badge value={isOverdue(row.invoice.dueDate, row.amount) ? "overdue" : row.invoice.status} />
              </Link>
            ))
            : null}
          {milestones.slice(0, 4).map((item) => (
            <Link key={item.id} href={`/projects/${item.projectId}`}>
              <span className="attention-item">
                <strong>{item.name}</strong>
                <span className="attention-cause">Due {prettyDate(item.dueDate)}</span>
              </span>
              <Badge value={item.status} />
            </Link>
          ))}
          {!statusAttention.length && !sowAttention.length && !returned && !approvals.length && !(showCommercials && openDues.length) && !milestones.length ? <p className="empty">No items require attention.</p> : null}
        </div>
      </section>
      <section className="stats">
        {myTasks.length ? (
          <Stat label="My open tasks" value={String(myTasks.length)} href="/work" detail="Tasks assigned to you that are not done yet." />
        ) : (
          <Stat label="Open items" value={String(openItems)} href="#project-status" detail={`${openItems} rows on the ${board.date ? prettyDate(board.date) : "latest"} status sheet are still underway. Delivered and completed rows are left out.`} />
        )}
        {loggedHours ? (
          <Stat label="My hours" value={hoursLabel(loggedHours)} href={trackHours ? "#hourly-tracker" : "/timesheets"} detail="Hours logged this week on your own timesheet." />
        ) : (
          <Stat label="Needs attention" value={String(attentionCount)} href="#needs-attention" detail={`${statusAttention.length} status rows are Pending or Not started. ${sowAttention.length} SOW rows need an addendum.`} />
        )}
        {can(user, "timesheets.approve") && approvals.length ? (
          <Stat label="Approvals" value={String(approvals.length)} href="/timesheets" detail="Timesheets that were submitted and are waiting for approval." />
        ) : waiting ? (
          <Stat label="Waiting on approval" value={String(waiting)} href="/timesheets" detail={returned ? `${waiting} submitted logs are waiting. ${returned} were returned.` : "Submitted logs waiting for approval."} />
        ) : (
          <Stat label="SOW" value={String(sowStatus.length)} href="#sow-status" detail={`${sowStatus.length} statements of work are on the SOW status list. ${sowBids.length} more rows are open bids under that list.`} />
        )}
        {showCommercials && financial ? (
          <Stat label="Pending dues" value={money(dueTotal, data.currency)} href="/invoices" detail={`${openDues.length} open invoice${openDues.length === 1 ? "" : "s"} still have an amount due.`} />
        ) : (
          <Stat label="Projects" value={String(data.projects.length || sheetProjects)} href={data.projects.length ? "/projects" : "#project-status"} detail={data.projects.length ? "Projects currently visible in the project register." : `${sheetProjects} distinct projects are named on the latest status sheet.`} />
        )}
      </section>
      {showCommercials && can(user, "reports.financial") ? (
        <section className="stats">
          <Stat label="Billable this month" value={hoursLabel(monthBillable)} />
          <Stat label="Active projects" value={String(data.projects.filter((project) => project.status === "active").length)} />
          <Stat label="Payouts in progress" value={money(payouts.reduce((sum, payment) => sum + payment.amount, 0), data.currency)} note={`${payouts.length} not yet completed`} />
          <Stat label="Unbilled work" value={money(data.projects.reduce((sum, project) => sum + projectEconomics(project, data).unbilled, 0), data.currency)} note="Approved and not invoiced" />
        </section>
      ) : null}
      <section className="card status-board" id="project-status">
        <div className="card-head">
          <div>
            <h2>Project status</h2>
            <span className="muted">Projects and their items{board.date ? ` · ${prettyDate(board.date)}` : ""}</span>
          </div>
          {publishStatus ? (
            <SheetUpload
              action={uploadStatusSheetAction}
              button="Upload sheet"
              title="Upload project status"
              hint="Use an Excel or CSV file. Uploading replaces the current status history."
              field="sheet"
            />
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
            <SheetUpload
              action={uploadSowSheetAction}
              button="Upload SOW"
              title="Upload SOW"
              hint="Use an Excel or CSV file. Uploading replaces the SOW rows in that file."
              field="sow"
            />
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
                  {publishStatus ? <th>Edit</th> : null}
                </tr>
              </thead>
              <tbody>
                {sowStatus.map((row) =>
                  publishStatus ? (
                    <SowEditRow key={row.id} row={row} />
                  ) : (
                    <tr key={row.id}>
                      <td className="num">{row.sheetNo || "—"}</td>
                      <td>{row.project}</td>
                      <td>{row.sprint || "—"}</td>
                      <td>{sowLink(row.link)}</td>
                      <td>{row.signature ? <span className={`badge ${row.signature.toLowerCase() === "signed" ? "ok" : "warn"}`}>{row.signature}</span> : "—"}</td>
                      <td className="num">{row.signedOn || "—"}</td>
                      <td className="remarks">{row.changeRequest || "—"}</td>
                    </tr>
                  ),
                )}
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
                    {publishStatus ? <th>Edit</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {sowBids.map((row) =>
                    publishStatus ? (
                      <SowEditRow key={row.id} row={row} />
                    ) : (
                      <tr key={row.id}>
                        <td className="num">{row.sheetNo || "—"}</td>
                        <td>{row.project}</td>
                        <td>{sowLink(row.link)}</td>
                      </tr>
                    ),
                  )}
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
      {trackHours ? <ResourceAllocation rows={data.hourlyEntries} editable linked /> : null}
      {trackHours ? (
        <section className="card status-board" id="hourly-tracker">
          <div className="card-head">
            <div>
              <h2>Hourly tracker</h2>
              <span className="muted">Your role · {user.roleName}</span>
            </div>
            <SheetUpload
              action={uploadHourlyTrackerAction}
              button="Upload CSV"
              title="Upload hourly tracker"
              hint="Use the daily utilization CSV. It reads S.no, Project, Sprint, Resource, Task, Date, Hours Spent, Status, and Company."
              field="sheet"
            />
          </div>
          {hourProjects.length ? (
            <div className="hour-projects">
              {hourProjects.map((group) => (
                <details key={group.name} className="hour-project">
                  <summary>
                    <span className="hour-project-name">{group.name}</span>
                    <span className="muted">{hoursLabel(group.hours)} · {group.rows.length} {group.rows.length === 1 ? "entry" : "entries"}</span>
                  </summary>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>S.no</th>
                          <th>Project</th>
                          <th>Sprint</th>
                          <th>Resource</th>
                          <th>Task</th>
                          <th>Date</th>
                          <th className="num">Hours Spent</th>
                          <th>Status</th>
                          <th>Company</th>
                          <th>Edit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((row) => (
                          <HourlyEditRow key={row.id} row={row} plan={false} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <p className="empty">No hours uploaded for your role yet.</p>
          )}
        </section>
      ) : null}
    </>
  );
}

function hourGroups(rows: HourlyEntry[]) {
  const groups = new Map<string, HourlyEntry[]>();
  for (const row of rows) {
    const name = row.project.trim() || "No project";
    const list = groups.get(name) ?? [];
    list.push(row);
    groups.set(name, list);
  }
  return [...groups.entries()]
    .map(([name, items]) => ({
      name,
      hours: items.reduce((sum, row) => sum + row.hours, 0),
      rows: items.sort((a, b) => a.sheetNo - b.sheetNo || a.workDate.localeCompare(b.workDate)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
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

