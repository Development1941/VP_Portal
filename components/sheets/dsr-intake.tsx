"use client";

import { useState } from "react";
import { saveHourlyEntryAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/common/forms";
import { DSR_STATUS_OPTIONS } from "@/lib/pmd-flow";

export function DsrIntakeForm({ projects, resource, today }: { projects: string[]; resource: string; today: string }) {
  const [status, setStatus] = useState("In Progress");
  const [round, setRound] = useState(0);
  const blocked = /\bblock/i.test(status);

  return (
    <ActionForm
      key={round}
      action={saveHourlyEntryAction}
      className="form-grid"
      onDone={() => {
        setStatus("In Progress");
        setRound((value) => value + 1);
      }}
    >
      <input type="hidden" name="id" value="" />
      <input type="hidden" name="estStart" value="" />
      <input type="hidden" name="estEnd" value="" />
      <input type="hidden" name="estimatedHours" value="" />
      <input type="hidden" name="targetHours" value="" />
      <input type="hidden" name="actualStart" value="" />
      <input type="hidden" name="actualEnd" value="" />
      <input type="hidden" name="actualHours" value="" />
      <input type="hidden" name="approval" value="" />
      <label className="field">
        <span>S.no</span>
        <input name="sheetNo" type="number" min="0" placeholder="Optional" />
      </label>
      <label className="field">
        <span>Project</span>
        <input name="project" required list="dsr-projects" placeholder="Project name" />
        <datalist id="dsr-projects">
          {projects.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>
      <label className="field">
        <span>Sprint</span>
        <input name="sprint" placeholder="Sprint 1" />
      </label>
      <label className="field">
        <span>Resource</span>
        <input name="resource" required defaultValue={resource} />
      </label>
      <label className="field wide">
        <span>Task</span>
        <textarea name="task" rows={2} required placeholder="What did you work on?" />
      </label>
      <label className="field">
        <span>Date</span>
        <input name="workDate" type="date" required defaultValue={today} max={today} />
      </label>
      <label className="field">
        <span>Hours Spent</span>
        <input name="hours" type="number" min="0" max="24" step="0.1" required />
      </label>
      <label className="field">
        <span>Status</span>
        <select name="status" value={status} onChange={(event) => setStatus(event.target.value)}>
          {DSR_STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Company</span>
        <input name="company" placeholder="Optional" />
      </label>
      <label className="field wide">
        <span>Blocker{blocked ? " (required)" : ""}</span>
        <textarea
          name="blocker"
          rows={2}
          required={blocked}
          placeholder={blocked ? "Describe what is blocking this task. It goes to Escalations." : "Optional remarks"}
        />
      </label>
      <div className="actions wide">
        <Submit>Add DSR entry</Submit>
      </div>
    </ActionForm>
  );
}
