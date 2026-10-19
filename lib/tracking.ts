import { todayIso } from "@/lib/dates";
import type { Milestone, Task, Timesheet } from "@/lib/types";

export function isOverdue(dueDate: string, finished: boolean) {
  return Boolean(dueDate) && !finished && dueDate < todayIso();
}

export function loggedHours(timesheets: Timesheet[], taskId = "") {
  return timesheets
    .filter((entry) => entry.status !== "rejected" && (!taskId || entry.taskId === taskId))
    .reduce((sum, entry) => sum + entry.hours, 0);
}

export function openTasks(tasks: Task[]) {
  return tasks.filter((task) => task.status !== "done");
}

export function lateTasks(tasks: Task[]) {
  return openTasks(tasks).filter((task) => isOverdue(task.dueDate, false));
}

export function lateMilestones(milestones: Milestone[]) {
  return milestones.filter((item) => isOverdue(item.dueDate, item.status === "completed"));
}
