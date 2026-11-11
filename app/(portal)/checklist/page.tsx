import { uploadChecklistAction } from "@/app/actions";
import { Denied, PageHeader, Stat } from "@/components/common/ui";
import { SheetUpload } from "@/components/dashboard/sheet-upload";
import { AddChecklistEntry, ExportCsv } from "@/components/sheets/add-entry";
import { ChecklistTable } from "@/components/sheets/checklist-table";
import { requireTab } from "@/lib/page";
import { canExportCsv } from "@/lib/tab-access";

export default async function ChecklistPage() {
  const { user, data, allowed } = await requireTab("deliveryChecklist");
  if (!allowed) return <Denied title="Project delivery checklist" />;
  const rows = data.checklistItems;
  const approved = rows.filter((row) => /approved/i.test(row.clientApproval)).length;
  const pending = rows.filter((row) => !/approved|reject/i.test(row.clientApproval)).length;

  return (
    <>
      <PageHeader eyebrow="Operations" title="Project delivery checklist" lede="Tasks are added when the hourly tracker covers the resource allocation plan" />
      <section className="stats">
        <Stat label="Delivered tasks" value={String(rows.length)} />
        <Stat label="Auto-generated" value={String(rows.filter((row) => row.source === "auto").length)} />
        <Stat label="Client approved" value={String(approved)} />
        <Stat label="Awaiting approval" value={String(pending)} />
      </section>
      <section className="card status-board" id="checklist">
        <div className="card-head">
          <div>
            <h2>Checklist</h2>
            <span className="muted">Client approval is written back to the Approval column in Resource management</span>
          </div>
          <div className="sheet-actions">
            <AddChecklistEntry />
            <SheetUpload
              action={uploadChecklistAction}
              button="Upload CSV"
              title="Upload delivery checklist"
              hint="Use an Excel or CSV file with Project, Task, Date of completion, Status, and Client Approval. Matching tasks are updated and new ones are appended."
              field="sheet"
            />
            {canExportCsv(user, "deliveryChecklist") ? <ExportCsv kind="checklist" /> : null}
          </div>
        </div>
        {rows.length ? <ChecklistTable rows={rows} editable /> : <p className="empty">No task has been completed yet. Rows appear here when logged hours cover the planned hours for a task.</p>}
      </section>
    </>
  );
}
