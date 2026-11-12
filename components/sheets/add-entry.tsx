"use client";

import { useState } from "react";
import { Download, Plus } from "lucide-react";
import { HourlyForm, Modal, SowForm } from "@/components/dashboard/row-edit";
import { ChecklistForm } from "@/components/sheets/checklist-table";
import { StatusForm } from "@/components/sheets/status-rows";
import type { ChecklistItem, HourlyEntry, SowRecord, StatusUpdate } from "@/lib/types";

function AddEntry({ label, title, children }: { label: string; title: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn ghost" onClick={() => setOpen(true)}>
        <Plus strokeWidth={1.75} aria-hidden size={16} /> {label}
      </button>
      {open ? (
        <Modal label={title} title={title} onClose={() => setOpen(false)}>
          {children(() => setOpen(false))}
        </Modal>
      ) : null}
    </>
  );
}

const EMPTY_HOURLY: HourlyEntry = {
  id: "",
  userId: "",
  roleName: "",
  sheetNo: 0,
  project: "",
  sprint: "",
  resource: "",
  task: "",
  workDate: "",
  hours: 0,
  status: "",
  company: "",
  estStart: "",
  estEnd: "",
  estimatedHours: null,
  targetHours: null,
  actualStart: "",
  actualEnd: "",
  actualHours: null,
  approval: "",
  notes: "",
  blocker: "",
};

export function AddHourlyEntry({ plan }: { plan: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  const row = plan ? EMPTY_HOURLY : { ...EMPTY_HOURLY, workDate: today, status: "In Progress" };
  return (
    <AddEntry label={plan ? "Add allocation" : "Add entry"} title={plan ? "Add resource allocation" : "Add hourly entry"}>
      {(close) => <HourlyForm row={row} plan={plan} onDone={close} />}
    </AddEntry>
  );
}

export function AddSowEntry({ kind }: { kind: SowRecord["kind"] }) {
  const row: SowRecord = { id: "", kind, sheetNo: 0, project: "", sprint: "", link: "", signature: "", signedOn: "", changeRequest: "", company: "" };
  return (
    <AddEntry label={kind === "bid" ? "Add bid" : "Add SOW row"} title={kind === "bid" ? "Add SOW bid" : "Add SOW status row"}>
      {(close) => <SowForm row={row} onDone={close} />}
    </AddEntry>
  );
}

export function AddStatusEntry() {
  const row: StatusUpdate = { id: "", sheetNo: 0, project: "", subItem: "", status: "In Progress", remarks: "", statusDate: "", company: "" };
  return (
    <AddEntry label="Add entry" title="Add project status entry">
      {(close) => <StatusForm row={row} onDone={close} />}
    </AddEntry>
  );
}

export function AddChecklistEntry() {
  const row: ChecklistItem = { id: "", sheetNo: 0, project: "", sprint: "", task: "", resource: "", completedOn: new Date().toISOString().slice(0, 10), status: "Completed", clientApproval: "Pending", source: "manual" };
  return (
    <AddEntry label="Add entry" title="Add checklist entry">
      {(close) => <ChecklistForm row={row} onDone={close} />}
    </AddEntry>
  );
}

export function ExportCsv({ kind, format = "csv" }: { kind: "utilization" | "dsr" | "checklist"; format?: "csv" | "xlsx" }) {
  return (
    <a className="btn ghost" href={`/api/export?kind=${kind}${format === "xlsx" ? "&format=xlsx" : ""}`} download>
      <Download strokeWidth={1.75} aria-hidden size={16} /> {format === "xlsx" ? "Export Excel" : "Export CSV"}
    </a>
  );
}
