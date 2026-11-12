import Link from "next/link";
import { Badge, PageHeader, Stat } from "@/components/common/ui";
import { ResourceAllocation } from "@/components/dashboard/resource-allocation";
import { HourlyTracker } from "@/components/sheets/hourly-tracker";
import { SowStatusBoard } from "@/components/sheets/sow-board";
import { ProjectStatusBoard } from "@/components/sheets/status-board";
import { can } from "@/lib/access";
import { addDays, todayIso } from "@/lib/dates";
import { hoursLabel, money, prettyDate } from "@/lib/format";
import { nameOf, projectOf, requirePage } from "@/lib/page";
import { dues, isOverdue, projectEconomics } from "@/lib/reports";
import { showCommercials } from "@/lib/commercial";
import { isArchiveDate, latestStatus, statusAsOf, statusDates, statusIsSettled, statusNeedsAttention } from "@/lib/status-board";
import { sowAttentionNote, sowNeedsAttention } from "@/lib/sow-board";
import { isResourceAllocation } from "@/lib/hourly-sheet";
import { profileKeys } from "@/lib/tab-access";
import { ArchiveControl, ArchiveNotice } from "@/components/sheets/archive";
import type { Escalation, HourlyEntry } from "@/lib/types";

function openOn(item: Escalation, day: string) {
  if (item.createdAt.slice(0, 10) > day) return false;
  if (item.status !== "resolved") return true;
  const resolvedOn = item.resolvedAt || item.updatedAt;
  return Boolean(resolvedOn && resolvedOn.slice(0, 10) > day);
}

function activeOn(row: HourlyEntry, day: string) {
  if (!isResourceAllocation(row)) return row.workDate === day;
  const start = row.estStart || row.actualStart;
  const end = row.estEnd || row.actualEnd || start;
  return Boolean(start) && start <= day && (!end || end >= day);
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const query = await searchParams;
  const { user, data } = await requirePage(["dashboard.view"]);
  const archive = isArchiveDate(query.date) ? query.date : undefined;
  const live = !archive;
  const month = todayIso().slice(0, 7);
  const mine = live ? data.timesheets.filter((entry) => entry.userId === user.id) : [];
  const returned = mine.filter((entry) => entry.status === "rejected").length;
  const approvals = live ? data.timesheets.filter((entry) => entry.status === "submitted" && data.projects.some((project) => project.id === entry.projectId && (can(user, "projects.view_all") || project.ownerId === user.id))) : [];
  const openDues = live && (can(user, "payments.view") || can(user, "invoices.view")) ? dues(data) : [];
  const dueTotal = openDues.reduce((sum, row) => sum + row.amount, 0);
  const monthBillable = data.timesheets.filter((entry) => entry.billable && entry.workDate.startsWith(month)).reduce((sum, entry) => sum + entry.hours, 0);
  const payouts = data.payments.filter((payment) => payment.direction === "outgoing" && ["initiated", "processing"].includes(payment.status));
  const financial = can(user, "reports.financial") || can(user, "invoices.view");
  const milestones = live ? data.milestones.filter((item) => item.status !== "completed" && item.dueDate <= addDays(todayIso(), 14)) : [];
  const board = archive ? statusAsOf(data.statusUpdates, archive) : latestStatus(data.statusUpdates);
  const sowStatus = data.sowRecords.filter((row) => row.kind === "status");
  const sowBids = data.sowRecords.filter((row) => row.kind === "bid");
  const sowAttention = data.sowRecords.filter(sowNeedsAttention);
  const statusAttention = board.rows.filter((row) => statusNeedsAttention(row.status));
  const escalations = data.escalations.filter((item) => (archive ? openOn(item, archive) : item.status !== "resolved"));
  const hourlyEntries = archive ? data.hourlyEntries.filter((row) => activeOn(row, archive)) : data.hourlyEntries;
  const openItems = board.rows.filter((row) => row.status.trim() && !statusIsSettled(row.status)).length;
  const attentionCount = statusAttention.length + sowAttention.length + escalations.length;
  const trackers = profileKeys(user).some((key) => key === "PMD_ADMIN" || key === "HARSHIT" || key === "MANAV");
  const nothing =
    !statusAttention.length && !sowAttention.length && !escalations.length && !returned && !approvals.length && !(showCommercials && openDues.length) && !milestones.length;

  return (
    <>
      <PageHeader eyebrow="Workspace" title="Dashboard">
        <ArchiveControl path="/dashboard" dates={statusDates(data.statusUpdates)} selected={archive} />
      </PageHeader>
      {archive ? <ArchiveNotice selected={archive} shown={board.date} /> : null}
      <section className="stats">
        <Stat label="Open items" value={String(openItems)} href="#project-status" detail={`${openItems} rows on the ${board.date ? prettyDate(board.date) : "latest"} status sheet are still underway. Delivered and completed rows are left out.`} />
        <Stat label="Needs attention" value={String(attentionCount)} href="#needs-attention" detail={`${escalations.length} open escalations. ${statusAttention.length} status rows are Pending or Not started. ${sowAttention.length} SOW rows need an addendum.`} />
        <Stat label="SOW" value={String(sowStatus.length)} href="#sow-status" detail={`${sowStatus.length} statements of work are on the SOW status list. ${sowBids.length} more rows are open bids under that list.`} />
        <Stat label="Open escalations" value={String(escalations.length)} href="#needs-attention" detail={`${escalations.filter((item) => item.sourceEntryId).length} came from blocked hourly tracker rows.`} />
      </section>
      {live && showCommercials && (financial || can(user, "reports.financial")) ? (
        <section className="stats">
          {financial ? <Stat label="Pending dues" value={money(dueTotal, data.currency)} href="/invoices" detail={`${openDues.length} open invoice${openDues.length === 1 ? "" : "s"} still have an amount due.`} /> : null}
          {can(user, "reports.financial") ? (
            <>
              <Stat label="Billable this month" value={hoursLabel(monthBillable)} />
              <Stat label="Payouts in progress" value={money(payouts.reduce((sum, payment) => sum + payment.amount, 0), data.currency)} note={`${payouts.length} not yet completed`} />
              <Stat label="Unbilled work" value={money(data.projects.reduce((sum, project) => sum + projectEconomics(project, data).unbilled, 0), data.currency)} note="Approved and not invoiced" />
            </>
          ) : null}
        </section>
      ) : null}
      <section className="card" id="needs-attention">
        <div className="card-head">
          <h2>Needs attention</h2>
        </div>
        <div className="list">
          {escalations.map((item) => (
            <Link key={item.id} href="/escalations">
              <span className="attention-item">
                <strong>
                  {item.projectName || projectOf(data, item.projectId)?.name || "Project"}
                  {item.sourceEntryId ? " · Task management" : ""}
                </strong>
                <span className="attention-cause">{item.description}</span>
              </span>
              <Badge value={item.type === "blocker" ? "blocked" : item.status} />
            </Link>
          ))}
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
          {nothing ? <p className="empty">No items require attention.</p> : null}
        </div>
      </section>
      <ProjectStatusBoard updates={data.statusUpdates} editable={false} asOf={archive} />
      <SowStatusBoard records={data.sowRecords} editable={false} />
      {trackers ? <ResourceAllocation rows={hourlyEntries} editable={false} linked /> : null}
      {trackers ? <HourlyTracker entries={hourlyEntries} editable={false} subtitle={archive ? `Entries logged on ${prettyDate(archive)}` : undefined} /> : null}
    </>
  );
}
