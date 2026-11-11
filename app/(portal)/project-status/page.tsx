import { Denied, PageHeader, Stat } from "@/components/common/ui";
import { ArchiveControl, ArchiveNotice } from "@/components/sheets/archive";
import { ProjectStatusBoard } from "@/components/sheets/status-board";
import { prettyDate } from "@/lib/format";
import { requireTab } from "@/lib/page";
import { isArchiveDate, latestStatus, statusAsOf, statusDates, statusIsSettled, statusNeedsAttention } from "@/lib/status-board";

export default async function ProjectManagementPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const query = await searchParams;
  const { data, allowed } = await requireTab("projectIntake");
  if (!allowed) return <Denied title="Project management" />;
  const archive = isArchiveDate(query.date) ? query.date : undefined;
  const board = archive ? statusAsOf(data.statusUpdates, archive) : latestStatus(data.statusUpdates);
  const projects = new Set(board.rows.map((row) => row.project)).size;
  const open = board.rows.filter((row) => row.status.trim() && !statusIsSettled(row.status)).length;
  const attention = board.rows.filter((row) => statusNeedsAttention(row.status) || /\bblock/i.test(row.status)).length;
  const sheetLabel = board.date ? prettyDate(board.date) : "the selected sheet";

  return (
    <>
      <PageHeader eyebrow="Operations" title="Project management" lede={board.date ? `Status sheet of ${prettyDate(board.date)}` : undefined}>
        <ArchiveControl path="/project-status" dates={statusDates(data.statusUpdates)} selected={archive} />
      </PageHeader>
      {archive ? <ArchiveNotice selected={archive} shown={board.date} /> : null}
      <section className="stats">
        <Stat label="Projects" value={String(projects)} detail={`${projects} distinct projects are on ${sheetLabel}.`} />
        <Stat label="Items" value={String(board.rows.length)} detail={`${board.rows.length} items are listed across those projects.`} />
        <Stat label="Still open" value={String(open)} detail={`${open} items are not yet completed, delivered, or closed.`} />
        <Stat label="Needs attention" value={String(attention)} detail={`${attention} items are Pending, Not started, or Blocked.`} />
      </section>
      <ProjectStatusBoard updates={data.statusUpdates} editable={!archive} asOf={archive} />
    </>
  );
}
