import Link from "next/link";
import { Badge, PageHeader, Stat } from "@/components/common/ui";
import { ProjectHealthList } from "@/components/projects/health-list";
import { can } from "@/lib/access";
import { addDays, startOfWeek, todayIso } from "@/lib/dates";
import { hoursLabel, money, prettyDate } from "@/lib/format";
import { nameOf, projectOf, requirePage } from "@/lib/page";
import { dues, isOverdue, projectEconomics } from "@/lib/reports";

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

  return (
    <>
      <PageHeader eyebrow="Studio desk" title={`${user.fullName.split(" ")[0]}'s week`} lede={`${user.roleName}. ${prettyDate(weekStart)} – ${prettyDate(weekEnd)}. What needs a decision is collected here.`} />
      <section className="stats">
        <Stat label="My open tasks" value={String(myTasks.length)} note="Assigned to you" />
        <Stat label="My hours" value={hoursLabel(weekHours)} note="Logged this week" />
        {can(user, "timesheets.approve") ? <Stat label="Approvals" value={String(approvals.length)} note="Submitted and waiting" /> : <Stat label="Waiting on approval" value={String(waiting)} note={returned ? `${returned} returned` : "Submitted logs"} />}
        {financial ? <Stat label="Pending dues" value={money(dueTotal, data.currency)} note={`${openDues.length} open invoice${openDues.length === 1 ? "" : "s"}`} /> : <Stat label="Projects" value={String(data.projects.length)} note="Visible to your role" />}
      </section>
      {can(user, "reports.financial") ? (
        <section className="stats">
          <Stat label="Billable this month" value={hoursLabel(monthBillable)} />
          <Stat label="Active projects" value={String(data.projects.filter((project) => project.status === "active").length)} />
          <Stat label="Payouts in flight" value={money(payouts.reduce((sum, payment) => sum + payment.amount, 0), data.currency)} note={`${payouts.length} not yet completed`} />
          <Stat label="Unbilled work" value={money(data.projects.reduce((sum, project) => sum + projectEconomics(project, data).unbilled, 0), data.currency)} note="Approved and not invoiced" />
        </section>
      ) : null}
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
            {openDues.slice(0, 4).map((row) => (
              <Link key={row.invoice.id} href={`/invoices/${row.invoice.id}`}>
                <span>
                  {row.invoice.number} · {money(row.amount, data.currency)}
                </span>
                <Badge value={isOverdue(row.invoice.dueDate, row.amount) ? "overdue" : row.invoice.status} />
              </Link>
            ))}
            {milestones.slice(0, 4).map((item) => (
              <Link key={item.id} href={`/projects/${item.projectId}`}>
                <span>
                  {item.name} · due {prettyDate(item.dueDate)}
                </span>
                <Badge value={item.status} />
              </Link>
            ))}
            {!returned && !approvals.length && !openDues.length && !milestones.length ? <p className="empty">Nothing is waiting on you.</p> : null}
          </div>
        </section>
        <section className="card">
          <div className="card-head">
            <h2>Latest notes</h2>
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
