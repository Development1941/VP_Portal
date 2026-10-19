-- Embee VP Portal schema.
-- Run this once in the Supabase SQL editor, then create the first user under Authentication
-- and promote them:
--   update public.profiles
--   set role_id = (select id from public.roles where slug = 'director')
--   where email = 'you@studio.com';

create extension if not exists pgcrypto;

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  is_system boolean not null default false,
  locked boolean not null default false
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null,
  primary key (role_id, permission_key)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  title text not null default '',
  phone text not null default '',
  role_id uuid not null references public.roles(id),
  status text not null default 'active' check (status in ('active', 'invited', 'inactive')),
  hourly_cost numeric not null default 0
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text not null,
  email text not null default '',
  phone text not null default '',
  billing_email text not null default '',
  address text not null default '',
  tax_id text not null default '',
  currency text not null default 'INR',
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text not null default ''
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  name text not null,
  code text not null default '',
  description text not null default '',
  status text not null default 'planning' check (status in ('planning', 'active', 'on_hold', 'completed')),
  billing_model text not null default 'hourly' check (billing_model in ('hourly', 'fixed', 'retainer')),
  start_date date,
  end_date date,
  budget_amount numeric not null default 0,
  currency text not null default 'INR',
  owner_id uuid not null references public.profiles(id)
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'Contributor',
  bill_rate numeric not null default 0,
  primary key (project_id, user_id)
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text not null default '',
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'missed')),
  amount numeric not null default 0,
  planned_hours numeric not null default 0
);

create table if not exists public.features (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text not null default '',
  billing_type text not null default 'hourly' check (billing_type in ('hourly', 'fixed')),
  hourly_rate numeric not null default 0,
  fixed_amount numeric not null default 0,
  budget_hours numeric not null default 0,
  status text not null default 'planned' check (status in ('planned', 'active', 'done'))
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  milestone_id uuid references public.milestones(id) on delete set null,
  feature_id uuid references public.features(id) on delete set null,
  title text not null,
  description text not null default '',
  assignee_id uuid references public.profiles(id) on delete set null,
  status text not null default 'backlog' check (status in ('backlog', 'in_progress', 'review', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date date,
  estimated_hours numeric not null default 0
);

create table if not exists public.timesheets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  feature_id uuid references public.features(id) on delete set null,
  work_date date not null,
  hours numeric not null check (hours > 0 and hours <= 24),
  billable boolean not null default true,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  rejection_note text not null default '',
  invoice_id uuid
);

create table if not exists public.rates (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  scope text not null check (scope in ('company', 'role', 'user', 'project', 'feature')),
  target_id text not null default '',
  hourly_rate numeric not null default 0,
  currency text not null default 'INR',
  effective_from date
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  client_id uuid not null references public.clients(id),
  project_id uuid not null references public.projects(id),
  issue_date date not null,
  due_date date not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'partial', 'paid', 'void')),
  tax_rate numeric not null default 0,
  notes text not null default '',
  created_by uuid references public.profiles(id)
);

alter table public.timesheets
  drop constraint if exists timesheets_invoice_id_fkey;
alter table public.timesheets
  add constraint timesheets_invoice_id_fkey
  foreign key (invoice_id) references public.invoices(id) on delete set null;

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  feature_id uuid references public.features(id) on delete set null,
  description text not null default '',
  hours numeric not null default 0,
  rate numeric not null default 0,
  amount numeric not null default 0
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('incoming', 'outgoing')),
  client_id uuid references public.clients(id),
  user_id uuid references public.profiles(id),
  invoice_id uuid references public.invoices(id),
  project_id uuid references public.projects(id),
  amount numeric not null check (amount > 0),
  currency text not null default 'INR',
  method text not null default '',
  status text not null default 'initiated' check (status in ('draft', 'initiated', 'processing', 'completed', 'failed', 'cancelled')),
  reference text not null default '',
  notes text not null default '',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  paid_at date
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  href text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity text not null,
  entity_id text,
  summary text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists timesheets_project_idx on public.timesheets (project_id, work_date);
create index if not exists tasks_assignee_idx on public.tasks (assignee_id);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

insert into public.roles (name, slug, description, is_system, locked)
values
  ('Director', 'director', 'Super admin with every client, project, rate, invoice, payout, and setting.', true, true),
  ('Project Owner', 'project_owner', 'Runs assigned projects, tasks, milestones, approvals, and budgets.', true, false),
  ('Team Member', 'team_member', 'Shared role for developers, designers, QA, and other delivery staff.', true, false),
  ('Finance', 'finance', 'Optional commercial role for invoices, payouts, rates, and profitability.', false, false),
  ('Scrum Master', 'scrum_master', 'SM. Uploads sprints and milestones for the project owner and project manager.', true, false)
on conflict (slug) do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
join (values
  ('project_owner', 'dashboard.view'),
  ('project_owner', 'clients.view'),
  ('project_owner', 'projects.view'),
  ('project_owner', 'projects.manage'),
  ('project_owner', 'tasks.view'),
  ('project_owner', 'tasks.manage'),
  ('project_owner', 'timesheets.submit'),
  ('project_owner', 'timesheets.view_all'),
  ('project_owner', 'timesheets.approve'),
  ('project_owner', 'billing.features'),
  ('project_owner', 'reports.project'),
  ('project_owner', 'team.view'),
  ('project_owner', 'notifications.view'),
  ('team_member', 'dashboard.view'),
  ('team_member', 'projects.view'),
  ('team_member', 'tasks.view'),
  ('team_member', 'timesheets.submit'),
  ('team_member', 'notifications.view'),
  ('finance', 'dashboard.view'),
  ('finance', 'clients.view'),
  ('finance', 'projects.view'),
  ('finance', 'projects.view_all'),
  ('finance', 'timesheets.view_all'),
  ('finance', 'billing.features'),
  ('finance', 'billing.rates'),
  ('finance', 'invoices.view'),
  ('finance', 'invoices.manage'),
  ('finance', 'payments.view'),
  ('finance', 'payments.manage'),
  ('finance', 'reports.project'),
  ('finance', 'reports.financial'),
  ('finance', 'team.view'),
  ('finance', 'notifications.view'),
  ('finance', 'audit.view'),
  ('scrum_master', 'dashboard.view'),
  ('scrum_master', 'projects.view'),
  ('scrum_master', 'milestones.manage'),
  ('scrum_master', 'notifications.view')
) as p(slug, key) on p.slug = r.slug
on conflict do nothing;

-- Older databases used a uuid for audit targets and left a few columns nullable.
-- Audit targets are stored as text so non-uuid ids remain valid.
alter table public.audit_logs
  alter column entity_id type text using entity_id::text;

alter table public.invoices
  alter column due_date set not null;

update public.profiles
set role_id = (select id from public.roles where slug = 'team_member')
where role_id is null;

alter table public.profiles
  alter column role_id set not null;

alter table public.projects
  alter column owner_id set not null;

alter table public.milestones add column if not exists planned_hours numeric not null default 0;

alter table public.profiles drop constraint if exists profiles_email_key;
drop index if exists public.profiles_email_key;
create unique index profiles_email_key on public.profiles (email);

drop function if exists public.has_permission(text) cascade;
create or replace function public.has_permission(permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid()
      and p.status = 'active'
      and (
        r.locked
        or exists (
          select 1 from public.role_permissions rp
          where rp.role_id = r.id
            and rp.permission_key = has_permission.permission_key
        )
      )
  );
$$;

create or replace function public.visible_project(project uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = project
      and (
        public.has_permission('projects.view_all')
        or p.owner_id = auth.uid()
        or exists (
          select 1 from public.project_members m
          where m.project_id = p.id and m.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.staff_costs()
returns table(id uuid, hourly_cost numeric)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
    case
      when public.has_permission('team.manage')
        or public.has_permission('reports.financial')
        or public.has_permission('payments.manage')
        or public.has_permission('reports.project')
      then p.hourly_cost else 0
    end
  from public.profiles p;
$$;

create or replace function public.add_notification(target uuid, title text, body text, href text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  insert into public.notifications (user_id, title, body, href)
  values (target, title, body, href);
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen uuid;
begin
  select id into chosen from public.roles where slug = coalesce(new.raw_user_meta_data->>'role_slug', 'team_member');
  if chosen is null then
    select id into chosen from public.roles where slug = 'team_member';
  end if;
  insert into public.profiles (id, full_name, email, title, role_id, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'title', ''),
    chosen,
    'active'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.protect_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id and new.role_id is distinct from old.role_id then
    raise exception 'You cannot change your own role.';
  end if;
  if auth.uid() = old.id and not public.has_permission('team.manage') then
    new.hourly_cost := old.hourly_cost;
    new.status := old.status;
    new.email := old.email;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile
  before update on public.profiles
  for each row execute function public.protect_profile();

create or replace function public.protect_locked_grants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_to_check uuid;
begin
  role_to_check := coalesce(new.role_id, old.role_id);
  if exists (select 1 from public.roles where id = role_to_check and locked) then
    raise exception 'Director permissions stay fully enabled.';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists protect_locked_grants on public.role_permissions;
create trigger protect_locked_grants
  before insert or update or delete on public.role_permissions
  for each row execute function public.protect_locked_grants();

grant usage on schema public to authenticated;

grant select, insert, update, delete on
  public.roles, public.role_permissions, public.profiles, public.clients, public.projects,
  public.project_members, public.milestones, public.features, public.tasks, public.timesheets,
  public.rates, public.invoices, public.invoice_lines, public.payments, public.notifications,
  public.audit_logs
to authenticated;

grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.visible_project(uuid) to authenticated;
grant execute on function public.staff_costs() to authenticated;
grant execute on function public.add_notification(uuid, text, text, text) to authenticated;

alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.milestones enable row level security;
alter table public.features enable row level security;
alter table public.tasks enable row level security;
alter table public.timesheets enable row level security;
alter table public.rates enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- Replace any previous policies so an old permissive rule cannot stay beside the new one.
do $$
declare
  item record;
begin
  for item in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.%I', item.policyname, item.tablename);
  end loop;
end $$;

drop policy if exists roles_read on public.roles;
create policy roles_read on public.roles for select to authenticated using (true);
drop policy if exists roles_write on public.roles;
create policy roles_write on public.roles for all to authenticated
  using (public.has_permission('settings.manage') and locked = false)
  with check (public.has_permission('settings.manage') and locked = false);

drop policy if exists grants_read on public.role_permissions;
create policy grants_read on public.role_permissions for select to authenticated
  using (role_id = (select role_id from public.profiles where id = auth.uid()) or public.has_permission('settings.manage'));
drop policy if exists grants_write on public.role_permissions;
create policy grants_write on public.role_permissions for all to authenticated
  using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_permission('team.manage'))
  with check (id = auth.uid() or public.has_permission('team.manage'));

drop policy if exists clients_read on public.clients;
create policy clients_read on public.clients for select to authenticated using (public.has_permission('clients.view'));
drop policy if exists clients_write on public.clients;
create policy clients_write on public.clients for all to authenticated
  using (public.has_permission('clients.manage'))
  with check (public.has_permission('clients.manage'));

drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects for select to authenticated using (public.visible_project(id));
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects for insert to authenticated
  with check (public.has_permission('projects.manage') and (public.has_permission('projects.view_all') or owner_id = auth.uid()));
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update to authenticated
  using (public.has_permission('projects.manage') and public.visible_project(id) and (public.has_permission('projects.view_all') or owner_id = auth.uid()))
  with check (public.has_permission('projects.manage') and (public.has_permission('projects.view_all') or owner_id = auth.uid()));

drop policy if exists members_read on public.project_members;
create policy members_read on public.project_members for select to authenticated using (public.visible_project(project_id));
drop policy if exists members_write on public.project_members;
create policy members_write on public.project_members for all to authenticated
  using (public.has_permission('projects.manage') and public.visible_project(project_id) and (public.has_permission('projects.view_all') or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())))
  with check (public.has_permission('projects.manage') and (public.has_permission('projects.view_all') or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())));

drop policy if exists milestones_read on public.milestones;
create policy milestones_read on public.milestones for select to authenticated
using (
  public.visible_project(project_id)
  and (
    public.has_permission('projects.view_all')
    or public.has_permission('milestones.manage')
    or exists (select 1 from public.projects p where p.id = milestones.project_id and p.owner_id = auth.uid())
    or exists (
      select 1 from public.project_members m
      where m.project_id = milestones.project_id
        and m.user_id = auth.uid()
        and m.member_role ~* '(\mowner\M|\mpm\M|project manager|\mmanager\M)'
    )
  )
);
drop policy if exists milestones_write on public.milestones;
create policy milestones_write on public.milestones for all to authenticated
  using (
    public.visible_project(project_id)
    and (
      public.has_permission('milestones.manage')
      or (
        public.has_permission('tasks.manage')
        and (
          public.has_permission('projects.view_all')
          or exists (select 1 from public.projects p where p.id = milestones.project_id and p.owner_id = auth.uid())
        )
      )
    )
  )
  with check (
    public.visible_project(project_id)
    and (
      public.has_permission('milestones.manage')
      or (
        public.has_permission('tasks.manage')
        and (
          public.has_permission('projects.view_all')
          or exists (select 1 from public.projects p where p.id = milestones.project_id and p.owner_id = auth.uid())
        )
      )
    )
  );

drop policy if exists features_read on public.features;
create policy features_read on public.features for select to authenticated using (public.visible_project(project_id));
drop policy if exists features_write on public.features;
create policy features_write on public.features for all to authenticated
  using (public.visible_project(project_id) and (public.has_permission('billing.features') or public.has_permission('tasks.manage')))
  with check (public.visible_project(project_id) and (public.has_permission('billing.features') or public.has_permission('tasks.manage')));

drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks for select to authenticated
  using (
    public.visible_project(project_id)
    and (
      assignee_id = auth.uid()
      or public.has_permission('tasks.view')
      or public.has_permission('tasks.manage')
      or public.has_permission('projects.view_all')
      or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
      or exists (
        select 1 from public.project_members m
        where m.project_id = project_id
          and m.user_id = auth.uid()
          and m.member_role ~* '(\mowner\M|\mpm\M|project manager|\mmanager\M)'
      )
    )
  );
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated
  with check (
    public.visible_project(project_id)
    and (
      public.has_permission('tasks.manage')
      or (assignee_id = auth.uid() and status = 'in_progress' and public.has_permission('tasks.view'))
    )
  );
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated
  using (public.visible_project(project_id) and (public.has_permission('tasks.manage') or assignee_id = auth.uid()))
  with check (public.visible_project(project_id));

drop policy if exists time_read on public.timesheets;
create policy time_read on public.timesheets for select to authenticated
  using (public.visible_project(project_id) and (user_id = auth.uid() or public.has_permission('timesheets.view_all') or public.has_permission('timesheets.approve')));
drop policy if exists time_insert on public.timesheets;
create policy time_insert on public.timesheets for insert to authenticated
  with check (user_id = auth.uid() and public.has_permission('timesheets.submit') and public.visible_project(project_id) and status = 'draft');
drop policy if exists time_update on public.timesheets;
create policy time_update on public.timesheets for update to authenticated
  using (
    public.visible_project(project_id) and (
      user_id = auth.uid()
      or public.has_permission('timesheets.approve')
      or public.has_permission('invoices.manage')
    )
  )
  with check (
    public.visible_project(project_id) and (
      (user_id = auth.uid() and status in ('draft', 'submitted', 'rejected'))
      or (public.has_permission('timesheets.approve') and user_id <> auth.uid())
      or public.has_permission('invoices.manage')
    )
  );
drop policy if exists time_delete on public.timesheets;
create policy time_delete on public.timesheets for delete to authenticated
  using (user_id = auth.uid() and status in ('draft', 'rejected'));

drop policy if exists rates_all on public.rates;
create policy rates_all on public.rates for all to authenticated
  using (public.has_permission('billing.rates'))
  with check (public.has_permission('billing.rates'));

drop policy if exists invoices_read on public.invoices;
create policy invoices_read on public.invoices for select to authenticated
  using (public.visible_project(project_id) and (public.has_permission('invoices.view') or public.has_permission('reports.financial')));
drop policy if exists invoices_write on public.invoices;
create policy invoices_write on public.invoices for all to authenticated
  using (public.has_permission('invoices.manage') and public.visible_project(project_id))
  with check (public.has_permission('invoices.manage') and public.visible_project(project_id));

drop policy if exists lines_read on public.invoice_lines;
create policy lines_read on public.invoice_lines for select to authenticated
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_id
      and public.visible_project(i.project_id)
      and (public.has_permission('invoices.view') or public.has_permission('reports.financial'))
  ));
drop policy if exists lines_write on public.invoice_lines;
create policy lines_write on public.invoice_lines for all to authenticated
  using (public.has_permission('invoices.manage'))
  with check (public.has_permission('invoices.manage'));

drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select to authenticated
  using (public.has_permission('payments.view') and (project_id is null or public.visible_project(project_id)));
drop policy if exists payments_write on public.payments;
create policy payments_write on public.payments for all to authenticated
  using (public.has_permission('payments.manage'))
  with check (public.has_permission('payments.manage'));

drop policy if exists notes_read on public.notifications;
create policy notes_read on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notes_update on public.notifications;
create policy notes_update on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs for select to authenticated using (public.has_permission('audit.view'));
drop policy if exists audit_insert on public.audit_logs;
create policy audit_insert on public.audit_logs for insert to authenticated with check (actor_id = auth.uid());

drop function if exists public.zoho_credentials();
drop table if exists public.integrations;
alter table public.clients drop column if exists zoho_contact_id;
alter table public.invoices drop column if exists zoho_invoice_id;

drop function if exists public.project_visible(uuid);
drop function if exists public.can_manage_project(uuid);
drop function if exists public.can_approve_project(uuid);

revoke all on all tables in schema public from anon;

-- Delivery control: intake, SOW finalisation, activation, escalations, and workstreams.
alter table public.projects add column if not exists estimated_hours numeric not null default 0;
alter table public.projects add column if not exists source text not null default 'requirement_document';
alter table public.projects add column if not exists sow_stage text not null default 'draft';
alter table public.projects add column if not exists delivery_status text not null default 'in_progress';
alter table public.projects add column if not exists billing_terms text not null default 'milestone';
alter table public.projects add column if not exists approval_status text not null default 'pending';
alter table public.projects add column if not exists renewal_date date;
alter table public.projects add column if not exists scope text not null default '';
alter table public.projects add column if not exists deliverables text not null default '';
alter table public.projects add column if not exists risks text not null default '';
alter table public.projects add column if not exists pending_actions text not null default '';
alter table public.projects add column if not exists delivery_owner_id uuid references public.profiles(id);
alter table public.projects add column if not exists invoicing_status text not null default 'Not invoiced';
alter table public.projects add column if not exists payment_status text not null default 'not_due';
alter table public.projects add column if not exists activated boolean not null default false;
alter table public.projects add column if not exists sow_file_name text not null default '';
alter table public.projects add column if not exists sow_file_path text not null default '';
alter table public.tasks add column if not exists start_date date;
alter table public.tasks add column if not exists actual_hours numeric not null default 0;

alter table public.projects drop constraint if exists projects_source_check;
alter table public.projects add constraint projects_source_check check (source in ('requirement_document', 'proposal', 'meeting_transcript', 'email_thread'));
alter table public.projects drop constraint if exists projects_sow_stage_check;
alter table public.projects add constraint projects_sow_stage_check check (sow_stage in ('draft', 'finalised'));
alter table public.projects drop constraint if exists projects_delivery_status_check;
alter table public.projects add constraint projects_delivery_status_check check (delivery_status in ('in_progress', 'done', 'blocked'));
alter table public.projects drop constraint if exists projects_billing_terms_check;
alter table public.projects add constraint projects_billing_terms_check check (billing_terms in ('milestone', 'monthly_tm', 'fixed_fee'));
alter table public.projects drop constraint if exists projects_approval_status_check;
alter table public.projects add constraint projects_approval_status_check check (approval_status in ('signed', 'pending', 'rejected'));
alter table public.projects drop constraint if exists projects_payment_status_check;
alter table public.projects add constraint projects_payment_status_check check (payment_status in ('paid', 'partially_paid', 'overdue', 'not_due'));

update public.projects
set delivery_status = case status when 'completed' then 'done' when 'on_hold' then 'blocked' else delivery_status end
where status in ('completed', 'on_hold') and delivery_status = 'in_progress';

update public.projects p
set estimated_hours = coalesce((select sum(t.estimated_hours) from public.tasks t where t.project_id = p.id), 0)
where p.estimated_hours = 0
  and exists (select 1 from public.tasks t where t.project_id = p.id);

update public.projects
set sow_stage = 'finalised', activated = true
where status = 'active' and sow_stage = 'draft' and activated = false;

create table if not exists public.escalations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null check (type in ('blocker', 'concern', 'dependency')),
  description text not null default '',
  owner_name text not null default '',
  due_date date,
  status text not null default 'open' check (status in ('open', 'in_review', 'resolved')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null check (kind in ('requirement', 'sow')),
  file_name text not null,
  storage_path text not null default '',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.workstreams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  owner_name text not null default '',
  target_date date,
  status text not null default 'in_progress' check (status in ('in_progress', 'blocked', 'done'))
);

insert into public.workstreams (name, owner_name, target_date, status)
values
  ('Project intake', 'Intake desk', '2026-10-14', 'in_progress'),
  ('SOW management', 'Admin desk', '2026-10-18', 'in_progress'),
  ('Resource allocation', 'Project owner', '2026-10-20', 'in_progress'),
  ('Delivery & tasks', 'Delivery owner', '2026-10-25', 'blocked'),
  ('Billing & utilization', 'Finance ops', '2026-10-28', 'in_progress'),
  ('Escalations & blockers', 'VP office', '2026-10-15', 'done')
on conflict (name) do nothing;

grant select, insert, update, delete on public.escalations, public.project_files, public.workstreams to authenticated;

alter table public.escalations enable row level security;
alter table public.project_files enable row level security;
alter table public.workstreams enable row level security;

drop policy if exists escalations_read on public.escalations;
create policy escalations_read on public.escalations for select to authenticated
  using (public.visible_project(project_id));
drop policy if exists escalations_insert on public.escalations;
create policy escalations_insert on public.escalations for insert to authenticated
  with check (public.visible_project(project_id) and created_by = auth.uid());
drop policy if exists escalations_update on public.escalations;
create policy escalations_update on public.escalations for update to authenticated
  using (
    public.visible_project(project_id)
    and (
      public.has_permission('projects.manage')
      or public.has_permission('projects.view_all')
      or public.has_permission('tasks.manage')
    )
  );

drop policy if exists files_read on public.project_files;
create policy files_read on public.project_files for select to authenticated
  using (public.visible_project(project_id));
drop policy if exists files_write on public.project_files;
create policy files_write on public.project_files for insert to authenticated
  with check (
    public.visible_project(project_id)
    and (public.has_permission('projects.manage') or public.has_permission('tasks.manage'))
  );

drop policy if exists workstreams_read on public.workstreams;
create policy workstreams_read on public.workstreams for select to authenticated
  using (public.has_permission('dashboard.view') or public.has_permission('projects.view') or public.has_permission('projects.view_all'));
drop policy if exists workstreams_write on public.workstreams;
create policy workstreams_write on public.workstreams for update to authenticated
  using (public.has_permission('projects.manage') or public.has_permission('projects.view_all'));

create table if not exists public.studio_settings (
  id int primary key default 1 check (id = 1),
  currency text not null default 'INR' check (currency in ('INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD'))
);

insert into public.studio_settings (id, currency)
values (1, 'INR')
on conflict (id) do nothing;

alter table public.studio_settings enable row level security;

drop policy if exists studio_read on public.studio_settings;
create policy studio_read on public.studio_settings for select to authenticated using (true);

drop policy if exists studio_write on public.studio_settings;
create policy studio_write on public.studio_settings for update to authenticated
  using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

grant select, update on public.studio_settings to authenticated;

notify pgrst, 'reload schema';
