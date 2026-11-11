import { test } from "node:test";
import assert from "node:assert/strict";
import { PortalError } from "./form.ts";
import {
  appendByKey,
  applyApprovalWriteBack,
  assertBlockerRemarks,
  deriveChecklist,
  dsrStatusForEscalation,
  hourlyDedupeKey,
  isTaskComplete,
  syncBlockerEscalation,
  toCsv,
} from "./pmd-flow.ts";
import type { Escalation, HourlyEntry } from "./types.ts";

function entry(overrides: Partial<HourlyEntry>): HourlyEntry {
  return {
    id: "h1",
    userId: "u1",
    roleName: "Developer",
    sheetNo: 1,
    project: "Atlas",
    sprint: "Sprint 1",
    resource: "Yuvraj",
    task: "Build login",
    workDate: "2026-11-02",
    hours: 4,
    status: "In Progress",
    company: "EMbee",
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
    ...overrides,
  };
}

const plan = (overrides: Partial<HourlyEntry> = {}) => entry({ id: "p1", estStart: "2026-11-01", estimatedHours: 8, hours: 0, workDate: "", ...overrides });

let counter = 0;
const context = () => ({ actorId: "u1", actorName: "Yuvraj", now: "2026-11-10T10:00:00.000Z", projectId: "", makeId: () => `esc_${(counter += 1)}` });

test("blocked rows need blocker remarks", () => {
  assert.throws(() => assertBlockerRemarks({ status: "Blocked", blocker: " " }), PortalError);
  assert.doesNotThrow(() => assertBlockerRemarks({ status: "Blocked", blocker: "Waiting on API keys" }));
  assert.doesNotThrow(() => assertBlockerRemarks({ status: "In Progress" }));
});

test("a blocked DSR row creates one escalation and later saves update it", () => {
  const list: Escalation[] = [];
  const first = syncBlockerEscalation(list, entry({ status: "Blocked", blocker: "Waiting on API keys" }), context());
  assert.equal(first.action, "created");
  assert.equal(list.length, 1);
  assert.equal(list[0].sourceEntryId, "h1");
  assert.equal(list[0].type, "blocker");
  assert.match(list[0].description, /Waiting on API keys/);
  const again = syncBlockerEscalation(list, entry({ status: "Blocked", blocker: "Still waiting" }), context());
  assert.equal(again.action, "updated");
  assert.equal(list.length, 1);
  assert.equal(list[0].id, first.item?.id);
  assert.match(list[0].description, /Still waiting/);
});

test("unblocking resolves the linked escalation and re-blocking reopens the same one", () => {
  const list: Escalation[] = [];
  const created = syncBlockerEscalation(list, entry({ status: "Blocked", blocker: "No access" }), context());
  const resolved = syncBlockerEscalation(list, entry({ status: "In Progress", blocker: "No access" }), context());
  assert.equal(resolved.action, "resolved");
  assert.equal(list[0].status, "resolved");
  assert.equal(list[0].resolutionNote, "Unblocked on the hourly tracker.");
  const reopened = syncBlockerEscalation(list, entry({ status: "Blocked", blocker: "No access again" }), context());
  assert.equal(reopened.action, "reopened");
  assert.equal(list.length, 1);
  assert.equal(list[0].id, created.item?.id);
  assert.equal(list[0].status, "open");
});

test("escalation status maps back onto the DSR row", () => {
  assert.equal(dsrStatusForEscalation({ status: "resolved" }, "Blocked"), "In Progress");
  assert.equal(dsrStatusForEscalation({ status: "resolved" }, "Completed"), "Completed");
  assert.equal(dsrStatusForEscalation({ status: "open" }, "In Progress"), "Blocked");
});

test("checklist waits until logged hours cover the plan and nothing is blocked", () => {
  assert.equal(isTaskComplete([plan()], [entry({ hours: 4 })]), false);
  assert.equal(isTaskComplete([plan()], [entry({ hours: 4 }), entry({ id: "h2", hours: 4, status: "Blocked", blocker: "x" })]), false);
  assert.equal(isTaskComplete([plan()], [entry({ hours: 4 }), entry({ id: "h2", hours: 4, workDate: "2026-11-03" })]), true);
  assert.equal(isTaskComplete([plan()], [entry({ hours: 2, status: "Completed" })]), true);
  assert.equal(isTaskComplete([plan()], []), false);
});

test("deriveChecklist adds a completed task once", () => {
  const rows = [plan({ approval: "" }), entry({ hours: 4 }), entry({ id: "h2", hours: 4, workDate: "2026-11-03" })];
  const created = deriveChecklist(rows, [], "2026-11-10T10:00:00.000Z");
  assert.equal(created.length, 1);
  assert.equal(created[0].project, "Atlas");
  assert.equal(created[0].task, "Build login");
  assert.equal(created[0].completedOn, "2026-11-03");
  assert.equal(created[0].source, "auto");
  assert.equal(deriveChecklist(rows, created, "2026-11-10T10:00:00.000Z").length, 0);
  assert.equal(deriveChecklist([plan(), entry({ hours: 4 })], [], "2026-11-10T10:00:00.000Z").length, 0);
});

test("client approval writes back only to the matching allocation row", () => {
  const allocation = plan();
  const other = plan({ id: "p2", task: "Build reports" });
  const log = entry({});
  const changed = applyApprovalWriteBack([allocation, other, log], { project: " atlas ", task: "build  LOGIN", clientApproval: "Approved" });
  assert.equal(changed, 1);
  assert.equal(allocation.approval, "Approved");
  assert.equal(other.approval, "");
  assert.equal(log.approval, "");
});

test("appendByKey keeps existing rows and skips duplicates", () => {
  const result = appendByKey([{ name: "Atlas" }], [{ name: "Atlas" }, { name: "New" }], (row) => row.name);
  assert.deepEqual(result.rows.map((row) => row.name), ["Atlas", "New"]);
  assert.equal(result.skipped, 1);
  assert.equal(result.added.length, 1);
});

test("hourlyDedupeKey is stable and separates plans from logs", () => {
  const first = entry({});
  assert.equal(hourlyDedupeKey(first), hourlyDedupeKey({ ...first, project: " ATLAS " }));
  assert.notEqual(hourlyDedupeKey(first), hourlyDedupeKey({ ...first, hours: 5 }));
  assert.notEqual(hourlyDedupeKey(first), hourlyDedupeKey(plan()));
});

test("toCsv quotes cells that need it", () => {
  const csv = toCsv(["Task", "Notes"], [["Login, SSO", 'Said "ok"']]);
  assert.equal(csv, '\uFEFFTask,Notes\r\n"Login, SSO","Said ""ok"""\r\n');
});
