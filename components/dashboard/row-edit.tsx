"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil } from "lucide-react";
import { deleteHourlyEntryAction, saveHourlyEntryAction, saveSowRecordAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/common/forms";
import { prettyDate } from "@/lib/format";
import type { HourlyEntry, SowRecord } from "@/lib/types";

export function SowEditRow({ row }: { row: SowRecord }) {
  return (
    <EditRow label={`Edit ${row.project}`} title={row.project} form={(close) => <SowForm row={row} onDone={close} />}>
      <td className="num">{row.sheetNo || "—"}</td>
      <td>{row.project}</td>
      {row.kind === "bid" ? (
        <>
          <td>{sowLink(row.link)}</td>
          <td>{row.company || "—"}</td>
        </>
      ) : (
        <>
          <td>{row.sprint || "—"}</td>
          <td>{sowLink(row.link)}</td>
          <td>{row.signature ? <span className={`badge ${row.signature.toLowerCase() === "signed" ? "ok" : "warn"}`}>{row.signature}</span> : "—"}</td>
          <td className="num">{row.signedOn || "—"}</td>
          <td className="remarks">{row.changeRequest || "—"}</td>
        </>
      )}
    </EditRow>
  );
}

export function HourlyEditRow({ row, plan }: { row: HourlyEntry; plan: boolean }) {
  const title = row.project.trim() || "Hourly entry";
  return (
    <EditRow label={`Edit ${title}`} title={title} form={(close) => <HourlyForm row={row} plan={plan} onDone={close} />}>
      <td className="num">{row.sheetNo || "—"}</td>
      <td>{row.project || "—"}</td>
      <td>{row.sprint || "—"}</td>
      <td>{row.resource || "—"}</td>
      <td className="remarks">{row.task || row.notes || "—"}</td>
      {plan ? (
        <>
          <td>{prettyDate(row.estStart)}</td>
          <td>{prettyDate(row.estEnd)}</td>
          <td className="num">{sheetHours(row.estimatedHours)}</td>
          <td className="num">{sheetHours(row.targetHours)}</td>
          <td>{prettyDate(row.actualStart)}</td>
          <td>{prettyDate(row.actualEnd)}</td>
          <td className="num">{sheetHours(row.actualHours)}</td>
          <td>{row.status || "—"}</td>
          <td>{row.approval || "—"}</td>
        </>
      ) : (
        <>
          <td>{prettyDate(row.workDate)}</td>
          <td className="num">{sheetHours(row.hours)}</td>
          <td>{row.status || "—"}</td>
          <td>{row.company || "—"}</td>
        </>
      )}
    </EditRow>
  );
}

function sheetHours(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-IN", { maximumFractionDigits: 1 });
}

function EditRow({
  label,
  title,
  form,
  children,
}: {
  label: string;
  title: string;
  form: (close: () => void) => React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function openFromRow(event: React.MouseEvent<HTMLTableRowElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, select, textarea, label")) return;
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  return (
    <tr className="edit-row" onClick={openFromRow}>
      {children}
      <td>
        <button type="button" className="edit-ico" aria-label={label} onClick={() => setOpen(true)}>
          <Pencil strokeWidth={1.75} aria-hidden />
        </button>
        {open
          ? createPortal(
              <div className="edit-modal" role="presentation" onClick={close}>
                <div
                  className="edit-modal-card"
                  role="dialog"
                  aria-modal="true"
                  aria-label={label}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="edit-modal-head">
                    <h3>{title}</h3>
                    <button type="button" className="btn ghost" onClick={close}>
                      Close
                    </button>
                  </div>
                  {form(close)}
                </div>
              </div>,
              document.body,
            )
          : null}
      </td>
    </tr>
  );
}

function SowForm({ row, onDone }: { row: SowRecord; onDone: () => void }) {
  return (
    <ActionForm action={saveSowRecordAction} className="edit-modal-form" onDone={onDone}>
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
  );
}

function HourlyForm({ row, plan, onDone }: { row: HourlyEntry; plan: boolean; onDone: () => void }) {
  return (
    <>
      <ActionForm action={saveHourlyEntryAction} className="edit-modal-form" onDone={onDone}>
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="sheetNo" value={row.sheetNo || ""} />
        <label className="field">
          <span>Project</span>
          <input name="project" defaultValue={row.project} />
        </label>
        <label className="field">
          <span>Sprint</span>
          <input name="sprint" defaultValue={row.sprint} />
        </label>
        <label className="field">
          <span>Resource</span>
          <input name="resource" defaultValue={row.resource} />
        </label>
        <label className="field">
          <span>Task</span>
          <textarea name="task" rows={3} defaultValue={row.task || row.notes} />
        </label>
        {plan ? (
          <>
            <label className="field"><span>EST Start Date</span><input type="date" name="estStart" defaultValue={row.estStart} /></label>
            <label className="field"><span>EST End Date</span><input type="date" name="estEnd" defaultValue={row.estEnd} /></label>
            <label className="field"><span>Estimated Hours</span><input name="estimatedHours" type="number" min="0" step="0.1" defaultValue={row.estimatedHours ?? ""} /></label>
            <label className="field"><span>Target hours embee</span><input name="targetHours" type="number" min="0" step="0.1" defaultValue={row.targetHours ?? ""} /></label>
            <label className="field"><span>Actual Start Date</span><input type="date" name="actualStart" defaultValue={row.actualStart} /></label>
            <label className="field"><span>Actual End Date</span><input type="date" name="actualEnd" defaultValue={row.actualEnd} /></label>
            <label className="field"><span>Actual Hours</span><input name="actualHours" type="number" min="0" max="24" step="0.1" defaultValue={row.actualHours ?? ""} /></label>
            <input type="hidden" name="workDate" value={row.workDate} />
            <input type="hidden" name="hours" value={row.hours} />
            <input type="hidden" name="company" value={row.company} />
          </>
        ) : (
          <>
            <label className="field"><span>Date</span><input type="date" name="workDate" defaultValue={row.workDate} /></label>
            <label className="field"><span>Hours Spent</span><input name="hours" type="number" min="0" max="24" step="0.1" defaultValue={row.hours} /></label>
            <label className="field"><span>Company</span><input name="company" defaultValue={row.company} /></label>
            <input type="hidden" name="estStart" value={row.estStart} />
            <input type="hidden" name="estEnd" value={row.estEnd} />
            <input type="hidden" name="estimatedHours" value={row.estimatedHours ?? ""} />
            <input type="hidden" name="targetHours" value={row.targetHours ?? ""} />
            <input type="hidden" name="actualStart" value={row.actualStart} />
            <input type="hidden" name="actualEnd" value={row.actualEnd} />
            <input type="hidden" name="actualHours" value={row.actualHours ?? ""} />
          </>
        )}
        <label className="field">
          <span>Status</span>
          <input name="status" defaultValue={row.status} />
        </label>
        {plan ? (
          <label className="field"><span>Approval</span><input name="approval" defaultValue={row.approval} /></label>
        ) : (
          <input type="hidden" name="approval" value={row.approval} />
        )}
        <Submit>Save</Submit>
      </ActionForm>
      <ActionForm action={deleteHourlyEntryAction} onDone={onDone}>
        <input type="hidden" name="id" value={row.id} />
        <Submit variant="ghost">Remove</Submit>
      </ActionForm>
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
