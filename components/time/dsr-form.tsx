"use client";

import { useState } from "react";
import { saveTimesheetAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/common/forms";

export function DsrForm({
  projects,
  tasks,
  defaultProject,
  defaultDate,
}: {
  projects: { id: string; name: string }[];
  tasks: { id: string; projectId: string; title: string }[];
  defaultProject: string;
  defaultDate: string;
}) {
  const [projectId, setProjectId] = useState(defaultProject);
  const projectTasks = tasks.filter((task) => task.projectId === projectId);

  return (
    <ActionForm action={saveTimesheetAction} className="form-grid">
      <label className="field">
        <span>Date</span>
        <input type="date" name="workDate" defaultValue={defaultDate} required />
      </label>
      <label className="field">
        <span>Hours</span>
        <input name="hours" type="number" min="0.25" max="24" step="0.25" defaultValue="1" required />
      </label>
      <label className="field">
        <span>Project</span>
        <select name="projectId" required value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field wide">
        <span>Task on this project</span>
        <select name="taskId" key={projectId} defaultValue="">
          <option value="">No specific task</option>
          {projectTasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
        </select>
      </label>
      <label className="field wide">
        <span>Work completed</span>
        <input name="description" placeholder="Summary of work completed" required />
      </label>
      <label className="check">
        <input type="checkbox" name="billable" defaultChecked />
        <span>Billable to the client</span>
      </label>
      <div className="actions">
        <Submit>Save DSR</Submit>
      </div>
    </ActionForm>
  );
}
