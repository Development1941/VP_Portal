import { test } from "node:test";
import assert from "node:assert/strict";
import { PortalError } from "./form.ts";
import { assertCanEdit, assertCanExport, assertHourlyWrite, canEditTab, canExportCsv, canSeeLeadershipSections, canWriteHourlyRow, TAB_KEYS, type TabKey, type TabUser } from "./tab-access.ts";

const accounts: Record<string, TabUser> = {
  admin: { email: "owner@embee.local", fullName: "GSVK SAI", roleSlug: "admin", sheetEditor: true },
  harshit: { email: "director@embee.local", fullName: "Harshit Bansal", roleSlug: "director" },
  manav: { email: "manav@embee.local", fullName: "Manav Singal", roleSlug: "project_owner" },
  kaushik: { email: "sm@embee.local", fullName: "Kaushik", roleSlug: "scrum_master" },
  yuvraj: { email: "yuvraj@embee.local", fullName: "Yuvraj", roleSlug: "developer" },
  rakhee: { email: "rakhee@embee.local", fullName: "Rakhee", roleSlug: "client" },
  brian: { email: "brian@embee.local", fullName: "Brian", roleSlug: "client" },
  developer: { email: "ishaan@embee.local", fullName: "Bhuvin Singla", roleSlug: "developer" },
};

const expected: Record<TabKey, string[]> = {
  dashboard: [],
  myWork: ["kaushik", "yuvraj", "developer"],
  dsrIntake: ["kaushik", "yuvraj", "developer"],
  projectIntake: ["admin"],
  sowManagement: ["admin", "rakhee"],
  utilization: ["admin", "harshit", "manav"],
  dsrHourlyTracker: ["admin", "harshit", "manav"],
  escalations: ["admin", "manav", "kaushik", "yuvraj", "harshit", "rakhee", "developer"],
  deliveryChecklist: ["admin", "rakhee"],
};

test("every profile gets exactly the tabs the PDF lists", () => {
  for (const tab of TAB_KEYS) {
    for (const [name, user] of Object.entries(accounts)) {
      const allowed = expected[tab].includes(name);
      assert.equal(canEditTab(user, tab), allowed, `${name} on ${tab}`);
      if (allowed) assert.doesNotThrow(() => assertCanEdit(user, tab));
      else assert.throws(() => assertCanEdit(user, tab), PortalError);
    }
  }
});

test("the dashboard is read-only for everyone", () => {
  for (const user of Object.values(accounts)) assert.equal(canEditTab(user, "dashboard"), false);
});

test("director does not inherit PMD admin tabs", () => {
  assert.equal(canEditTab(accounts.harshit, "projectIntake"), false);
  assert.equal(canEditTab(accounts.harshit, "deliveryChecklist"), false);
});

test("developers write only their own DSR rows", () => {
  const yuvraj = { ...accounts.yuvraj, id: "usr_yuvraj" };
  const manav = { ...accounts.manav, id: "usr_manav" };
  const rakhee = { ...accounts.rakhee, id: "usr_rakhee" };
  assert.equal(canWriteHourlyRow(yuvraj, { plan: false }), true);
  assert.equal(canWriteHourlyRow(yuvraj, { plan: false, ownerId: "usr_yuvraj" }), true);
  assert.equal(canWriteHourlyRow(yuvraj, { plan: false, ownerId: "usr_kaushik" }), false);
  assert.equal(canWriteHourlyRow(yuvraj, { plan: true }), false);
  assert.equal(canWriteHourlyRow(manav, { plan: false, ownerId: "usr_yuvraj" }), true);
  assert.equal(canWriteHourlyRow(rakhee, { plan: false }), false);
  assert.throws(() => assertHourlyWrite(yuvraj, { plan: false, ownerId: "usr_kaushik" }), PortalError);
});

test("only Harshit and GSVK SAI see the Delivery and Administration sections", () => {
  for (const [name, user] of Object.entries(accounts)) {
    assert.equal(canSeeLeadershipSections(user), name === "admin" || name === "harshit", name);
  }
});

test("CSV export follows its own map", () => {
  assert.equal(canExportCsv(accounts.admin, "utilization"), true);
  assert.equal(canExportCsv(accounts.harshit, "utilization"), true);
  assert.equal(canExportCsv(accounts.manav, "utilization"), false);
  assert.equal(canExportCsv(accounts.admin, "dsrHourlyTracker"), true);
  assert.equal(canExportCsv(accounts.manav, "dsrHourlyTracker"), false);
  assert.equal(canExportCsv(accounts.kaushik, "dsrHourlyTracker"), false);
  assert.equal(canExportCsv(accounts.rakhee, "deliveryChecklist"), true);
  assert.equal(canExportCsv(accounts.harshit, "deliveryChecklist"), false);
  assert.throws(() => assertCanExport(accounts.manav, "utilization"), PortalError);
});
