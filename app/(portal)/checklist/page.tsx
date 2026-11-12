import { uploadChecklistAction } from "@/app/actions";
import { Denied, PageHeader, Stat } from "@/components/common/ui";
import { SheetUpload } from "@/components/dashboard/sheet-upload";
import { AddChecklistEntry, ExportCsv } from "@/components/sheets/add-entry";
import { ChecklistTable } from "@/components/sheets/checklist-table";
import { prettyDate } from "@/lib/format";
import { requireTab } from "@/lib/page";
import { canExportCsv } from "@/lib/tab-access";
import type { ChecklistItem } from "@/lib/types";

function byProject(rows: ChecklistItem[]) {
  const groups = new Map<string, ChecklistItem[]>();
  for (const row of rows) {
    const name = row.project.trim() || "No project";
    groups.set(name, [...(groups.get(name) ?? []), row]);
  }
  return [...groups.entries()]
    .map(([name, items]) => ({
      name,
      items: items.sort((a, b) => (b.completedOn || "").localeCompare(a.completedOn || "") || a.sheetNo - b.sheetNo),
      approved: items.filter((row) => /approved/i.test(row.clientApproval)).length,
      latest: items.map((row) => row.completedOn).filter(Boolean).sort().pop() ?? "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default async function ChecklistPage() {
  const { user, data, allowed } = await requireTab("deliveryChecklist");
  if (!allowed) return <Denied title="Project delivery checklist" />;
  const rows = data.checklistItems;
  const groups = byProject(rows);
  const approved = rows.filter((row) => /approved/i.test(row.clientApproval)).length;
  const pending = rows.filter((row) => !/approved|reject/i.test(row.clientApproval)).length;
  const exportable = canExportCsv(user, "deliveryChecklist");

  return (
    <>
      <PageHeader eyebrow="Operations" title="Project delivery checklist" lede="Every task completed in Task management is listed here, project by project" />
      <section className="stats">
        <Stat label="Delivered tasks" value={String(rows.length)} />
        <Stat label="Projects" value={String(groups.length)} />
        <Stat label="Client approved" value={String(approved)} />
        <Stat label="Awaiting approval" value={String(pending)} />
      </section>
      <section className="card status-board" id="checklist">
        <div className="card-head">
          <div>
            <h2>Checklist by project</h2>
            <span className="muted">Client approval is written back to the Approval column in Resource management</span>
          </div>
          <div className="sheet-actions">
            <AddChecklistEntry />
            <SheetUpload
              action={uploadChecklistAction}
              button="Upload checklist"
              title="Upload delivery checklist"
              hint="Use a CSV or Excel file with S.no, Project, Date of completion, Sprint, Task, Resource, Status, and Client Approval. A file from Export Excel or Export CSV can be uploaded back as is. Matching tasks are updated and new ones are added."
              field="sheet"
            />
            {exportable ? <ExportCsv kind="checklist" /> : null}
            {exportable ? <ExportCsv kind="checklist" format="xlsx" /> : null}
          </div>
        </div>
        {groups.length ? (
          <div className="hour-projects">
            {groups.map((group) => (
              <details key={group.name} className="hour-project" open>
                <summary>
                  <span className="hour-project-name">{group.name}</span>
                  <span className="muted">
                    {group.items.length} {group.items.length === 1 ? "task" : "tasks"} · {group.approved} approved
                    {group.latest ? ` · last completed ${prettyDate(group.latest)}` : ""}
                  </span>
                </summary>
                <ChecklistTable rows={group.items} editable />
              </details>
            ))}
          </div>
        ) : (
          <p className="empty">No task has been completed yet. Tasks appear here when they are marked Completed in Task management or their logged hours cover the plan.</p>
        )}
      </section>
    </>
  );
}
