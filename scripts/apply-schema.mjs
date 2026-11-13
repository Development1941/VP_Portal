import fs from "fs";
import { Client } from "pg";

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

const databaseUrl = env.DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Missing DATABASE_URL in .env");
  process.exit(1);
}

const file = process.argv[2] || "supabase/pmd-migration.sql";
const sql = fs.readFileSync(file, "utf8");

const client = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  const before = await client.query(`
    select
      to_regclass('public.checklist_items') as checklist_items,
      exists(
        select 1 from information_schema.columns
        where table_schema='public' and table_name='hourly_entries' and column_name='blocker'
      ) as hourly_blocker,
      exists(
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname='public' and p.proname='pmd_can_edit'
      ) as pmd_can_edit
  `);
  console.log("before", before.rows[0]);

  await client.query(sql);
  console.log(`Applied ${file}`);

  const after = await client.query(`
    select
      to_regclass('public.checklist_items') as checklist_items,
      exists(
        select 1 from information_schema.columns
        where table_schema='public' and table_name='hourly_entries' and column_name='blocker'
      ) as hourly_blocker,
      exists(
        select 1 from information_schema.columns
        where table_schema='public' and table_name='escalations' and column_name='source_entry_id'
      ) as escalation_source,
      exists(
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname='public' and p.proname='pmd_can_edit'
      ) as pmd_can_edit,
      exists(
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname='public' and p.proname='portal_bundle'
      ) as portal_bundle
  `);
  console.log("after", after.rows[0]);
} finally {
  await client.end();
}
