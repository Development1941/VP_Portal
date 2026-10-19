import type { Milestone, Timesheet } from "@/lib/types";

export type HealthStatus = "healthy" | "watch" | "at_risk" | "unplanned";

export type ProjectHealth = {
  expectedHours: number;
  loggedHours: number;
  completion: number;
  status: HealthStatus;
};

const HOURS = /^\[hours:(\d+(?:\.\d+)?)\]\s?/;

export function packHours(hours: number, description: string) {
  const note = description.replace(HOURS, "").trim();
  if (!(hours > 0)) return note;
  return note ? `[hours:${hours}] ${note}` : `[hours:${hours}]`;
}

export function unpackHours(description: string) {
  const match = HOURS.exec(description);
  if (!match) return { hours: 0, description };
  return { hours: Number(match[1]), description: description.slice(match[0].length) };
}

export function projectHealth(milestones: Milestone[], timesheets: Timesheet[]): ProjectHealth {
  const expectedHours = milestones.reduce((sum, item) => sum + item.plannedHours, 0);
  const loggedHours = timesheets.filter((item) => item.status !== "rejected").reduce((sum, item) => sum + item.hours, 0);
  const completion = milestones.length ? Math.round((milestones.filter((item) => item.status === "completed").length / milestones.length) * 100) : 0;
  if (expectedHours <= 0) return { expectedHours, loggedHours, completion, status: "unplanned" };
  const burn = loggedHours / expectedHours;
  const ahead = burn - completion / 100;
  const status: HealthStatus = burn > 1.15 || ahead > 0.25 ? "at_risk" : burn > 1 || ahead > 0.1 ? "watch" : "healthy";
  return { expectedHours, loggedHours, completion, status };
}
