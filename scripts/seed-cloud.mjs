import fs from "fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);

const headers = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const base = env.NEXT_PUBLIC_SUPABASE_URL;

async function rest(path, options = {}) {
  const response = await fetch(`${base}/rest/v1/${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${path} ${response.status} ${text}`);
  return body;
}

const existing = await rest("clients?select=id");
if (existing.length) {
  console.log("clients already present, skipping seed");
  process.exit(0);
}

const profiles = await rest("profiles?select=id,email");
const id = Object.fromEntries(profiles.map((profile) => [profile.email, profile.id]));
const director = id["director@embee.local"];
const owner = id["owner@embee.local"];
const member = id["ishaan@embee.local"];

function iso(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

await rest("profiles?id=eq." + owner, { method: "PATCH", body: JSON.stringify({ hourly_cost: 1800 }) });
await rest("profiles?id=eq." + member, { method: "PATCH", body: JSON.stringify({ hourly_cost: 900 }) });

const [client] = await rest("clients", {
  method: "POST",
  body: JSON.stringify({
    name: "Noble",
    company: "Noble",
    email: "meera@northwind.example",
    phone: "+91 80 4001 2200",
    billing_email: "accounts@northwind.example",
    address: "12 Residency Road, Bengaluru",
    tax_id: "29AABCU9603R1ZM",
    currency: "INR",
    status: "active",
    notes: "Product studio. Prefers feature-wise invoices with GST.",
  }),
});

const [project] = await rest("projects", {
  method: "POST",
  body: JSON.stringify({
    client_id: client.id,
    name: "Noble",
    code: "NOBLE",
    description: "Noble.",
    status: "active",
    billing_model: "hourly",
    start_date: iso(-50),
    end_date: iso(40),
    budget_amount: 1800000,
    currency: "INR",
    owner_id: owner,
  }),
});

await rest("project_members", {
  method: "POST",
  body: JSON.stringify([
    { project_id: project.id, user_id: owner, member_role: "PO/PM", bill_rate: 3500 },
    { project_id: project.id, user_id: member, member_role: "Developer", bill_rate: 2800 },
    { project_id: project.id, user_id: director, member_role: "Sponsor", bill_rate: 0 },
  ]),
});

const [milestone] = await rest("milestones", {
  method: "POST",
  body: JSON.stringify({
    project_id: project.id,
    name: "Sprint 1",
    description: "[hours:80] Planning",
    due_date: iso(12),
    status: "pending",
    amount: 0,
  }),
});

await rest("milestones", {
  method: "POST",
  body: JSON.stringify({
    project_id: project.id,
    name: "Sprint 2",
    description: "[hours:60] Build",
    due_date: iso(26),
    status: "pending",
    amount: 0,
  }),
});

const [feature] = await rest("features", {
  method: "POST",
  body: JSON.stringify({
    project_id: project.id,
    name: "Timesheet workspace",
    description: "Daily logs, billable flags, and approvals.",
    billing_type: "hourly",
    hourly_rate: 3000,
    fixed_amount: 0,
    budget_hours: 60,
    status: "active",
  }),
});

const [task] = await rest("tasks", {
  method: "POST",
  body: JSON.stringify({
    project_id: project.id,
    milestone_id: milestone.id,
    feature_id: feature.id,
    title: "Weekly timesheet grid",
    description: "Let members log billable and non-billable hours.",
    assignee_id: member,
    status: "in_progress",
    priority: "high",
    due_date: iso(5),
    estimated_hours: 12,
  }),
});

await rest("timesheets", {
  method: "POST",
  body: JSON.stringify([
    {
      user_id: member,
      project_id: project.id,
      task_id: task.id,
      feature_id: feature.id,
      work_date: iso(-2),
      hours: 6,
      billable: true,
      description: "Week grid and draft saving.",
      status: "approved",
      approved_by: owner,
      approved_at: new Date().toISOString(),
    },
    {
      user_id: member,
      project_id: project.id,
      task_id: task.id,
      feature_id: feature.id,
      work_date: iso(-1),
      hours: 4,
      billable: true,
      description: "Approval queue wiring.",
      status: "submitted",
      approved_by: null,
      approved_at: null,
    },
  ]),
});

await rest("rates", {
  method: "POST",
  body: JSON.stringify([
    { label: "Studio default", scope: "company", target_id: "", hourly_rate: 2500, currency: "INR", effective_from: iso(-90) },
    { label: "Project owner", scope: "role", target_id: "22222222-2222-4222-8222-222222222222", hourly_rate: 3500, currency: "INR", effective_from: iso(-90) },
  ]),
});

await rest("notifications", {
  method: "POST",
  body: JSON.stringify([
    { user_id: owner, title: "Timesheet waiting", body: "Bhuvin Singla submitted 4h on Noble.", href: "/timesheets" },
    { user_id: director, title: "Studio is ready", body: "Noble is on the desk.", href: "/dashboard" },
    { user_id: member, title: "Task assigned", body: "Weekly timesheet grid is assigned to you.", href: "/work" },
  ]),
});

console.log("seeded", project.id);
