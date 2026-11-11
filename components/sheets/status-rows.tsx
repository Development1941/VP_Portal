"use client";

import { deleteStatusEntryAction, saveStatusEntryAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/common/forms";
import { EditRow } from "@/components/dashboard/row-edit";
import { PROJECT_STATUS_OPTIONS } from "@/lib/pmd-flow";
import type { StatusUpdate } from "@/lib/types";

export function StatusForm({ row, onDone }: { row: StatusUpdate; onDone: () => void }) {
  const statuses = PROJECT_STATUS_OPTIONS.includes(row.status) || !row.status ? PROJECT_STATUS_OPTIONS : [row.status, ...PROJECT_STATUS_OPTIONS];
  return (
    <>
      <ActionForm action={saveStatusEntryAction} className="edit-modal-form" onDone={onDone}>
        <input type="hidden" name="id" value={row.id ?? ""} />
        <input type="hidden" name="statusDate" value={row.statusDate} />
        <label className="field">
          <span>S.no</span>
          <input name="sheetNo" type="number" min="0" defaultValue={row.sheetNo || ""} placeholder="Matches the project or the next number" />
        </label>
        <label className="field">
          <span>Project</span>
          <input name="project" required defaultValue={row.project} />
        </label>
        <label className="field">
          <span>Item</span>
          <input name="subItem" defaultValue={row.subItem} />
        </label>
        <label className="field">
          <span>Status</span>
          <select name="status" defaultValue={row.status}>
            {statuses.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Task / Remarks</span>
          <textarea name="remarks" rows={4} defaultValue={row.remarks} />
        </label>
        <label className="field">
          <span>Company</span>
          <input name="company" defaultValue={row.company ?? ""} />
        </label>
        <Submit>{row.id ? "Save row" : "Add entry"}</Submit>
      </ActionForm>
      {row.id ? (
        <ActionForm action={deleteStatusEntryAction} onDone={onDone}>
          <input type="hidden" name="id" value={row.id} />
          <Submit variant="ghost">Remove</Submit>
        </ActionForm>
      ) : null}
    </>
  );
}

export function StatusEditRow({ row, lead, span, tone, extras }: { row: StatusUpdate; lead: boolean; span: number; tone: string; extras: string[] }) {
  return (
    <EditRow label={`Edit ${row.project}`} title={row.project} form={(close) => <StatusForm row={row} onDone={close} />}>
      {lead ? (
        <>
          <td className="num project-cell" rowSpan={span}>
            {row.sheetNo || "—"}
          </td>
          <td className="project-cell" rowSpan={span}>
            {row.project}
          </td>
        </>
      ) : null}
      <td>{row.subItem || "—"}</td>
      <td>
        <span className={`badge ${tone}`}>{row.status || "—"}</span>
      </td>
      <td className="remarks">{row.remarks || "—"}</td>
      {extras.map((column) => (
        <td key={column}>{row.fields?.[column] || "—"}</td>
      ))}
    </EditRow>
  );
}
