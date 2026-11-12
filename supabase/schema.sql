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

update public.roles
set name = 'Developer',
    slug = 'developer',
    description = 'Logs tasks and timesheets on assigned projects.'
where slug = 'team_member';

insert into public.roles (name, slug, description, is_system, locked)
values
  ('Director / Super admin', 'director', 'Super admin with every client, project, rate, invoice, payout, and setting.', true, true),
  ('Admin', 'admin', 'Administers the studio. The director stays the locked super admin.', true, false),
  ('Project Manager / PO', 'project_owner', 'Runs projects, intake, tasks, milestones, and approvals.', true, false),
  ('Developer', 'developer', 'Logs tasks and timesheets on assigned projects.', true, false),
  ('Finance', 'finance', 'Optional commercial role for invoices, payouts, rates, and profitability.', false, false),
  ('Scrum Master', 'scrum_master', 'SM. Uploads sprints and milestones for the project owner and project manager.', true, false),
  ('Project Manager', 'project_manager', 'Files a new project request and hands it to the SOW team.', true, false),
  ('Client', 'client', 'Submits a project request with the requirement documents.', true, false)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description;

update public.roles
set name = 'Director / Super admin'
where slug = 'director';

update public.roles
set name = 'Project Manager / PO',
    description = 'Runs projects, intake, tasks, milestones, and approvals.'
where slug = 'project_owner';

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
join (values
  ('project_owner', 'dashboard.view'),
  ('project_owner', 'clients.view'),
  ('project_owner', 'projects.view'),
  ('project_owner', 'projects.view_all'),
  ('project_owner', 'projects.manage'),
  ('project_owner', 'projects.intake'),
  ('project_owner', 'tasks.view'),
  ('project_owner', 'tasks.manage'),
  ('project_owner', 'timesheets.submit'),
  ('project_owner', 'timesheets.view_all'),
  ('project_owner', 'timesheets.approve'),
  ('project_owner', 'billing.features'),
  ('project_owner', 'reports.project'),
  ('project_owner', 'team.view'),
  ('project_owner', 'notifications.view'),
  ('admin', 'dashboard.view'),
  ('admin', 'clients.view'),
  ('admin', 'clients.manage'),
  ('admin', 'projects.view'),
  ('admin', 'projects.view_all'),
  ('admin', 'projects.manage'),
  ('admin', 'projects.intake'),
  ('admin', 'tasks.view'),
  ('admin', 'tasks.manage'),
  ('admin', 'milestones.manage'),
  ('admin', 'timesheets.submit'),
  ('admin', 'timesheets.view_all'),
  ('admin', 'timesheets.approve'),
  ('admin', 'billing.features'),
  ('admin', 'billing.rates'),
  ('admin', 'invoices.view'),
  ('admin', 'invoices.manage'),
  ('admin', 'payments.view'),
  ('admin', 'payments.manage'),
  ('admin', 'reports.project'),
  ('admin', 'reports.financial'),
  ('admin', 'team.view'),
  ('admin', 'team.manage'),
  ('admin', 'notifications.view'),
  ('admin', 'audit.view'),
  ('admin', 'settings.manage'),
  ('developer', 'dashboard.view'),
  ('developer', 'projects.view'),
  ('developer', 'tasks.view'),
  ('developer', 'timesheets.submit'),
  ('developer', 'notifications.view'),
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
  ('scrum_master', 'notifications.view'),
  ('project_manager', 'dashboard.view'),
  ('project_manager', 'clients.view'),
  ('project_manager', 'projects.view'),
  ('project_manager', 'projects.view_all'),
  ('project_manager', 'projects.intake'),
  ('project_manager', 'notifications.view'),
  ('client', 'dashboard.view'),
  ('client', 'clients.view'),
  ('client', 'projects.view'),
  ('client', 'projects.intake'),
  ('client', 'notifications.view')
) as p(slug, key) on p.slug = r.slug
on conflict do nothing;

-- Older databases used a uuid for audit targets and left a few columns nullable.
-- Audit targets are stored as text so non-uuid ids remain valid.
alter table public.audit_logs
  alter column entity_id type text using entity_id::text;

alter table public.invoices
  alter column due_date set not null;

update public.profiles
set role_id = (select id from public.roles where slug = 'developer')
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
        or exists (
          select 1
          from public.profiles pr
          join public.roles r on r.id = pr.role_id
          where pr.id = auth.uid()
            and pr.status = 'active'
            and r.slug in ('client', 'admin', 'director')
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
  select id into chosen from public.roles where slug = coalesce(new.raw_user_meta_data->>'role_slug', 'developer');
  if chosen is null then
    select id into chosen from public.roles where slug = 'developer';
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
  with check ((public.has_permission('projects.manage') or public.has_permission('projects.intake')) and (public.has_permission('projects.view_all') or owner_id = auth.uid()));
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update to authenticated
  using (public.has_permission('projects.manage') and public.visible_project(id) and (public.has_permission('projects.view_all') or owner_id = auth.uid()))
  with check (public.has_permission('projects.manage') and (public.has_permission('projects.view_all') or owner_id = auth.uid()));

drop policy if exists members_read on public.project_members;
create policy members_read on public.project_members for select to authenticated using (public.visible_project(project_id));
drop policy if exists members_write on public.project_members;
create policy members_write on public.project_members for all to authenticated
  using (public.has_permission('projects.manage') and public.visible_project(project_id) and (public.has_permission('projects.view_all') or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())))
  with check ((public.has_permission('projects.manage') or public.has_permission('projects.intake')) and (public.has_permission('projects.view_all') or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())));

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
alter table public.projects add column if not exists initiated_by uuid references public.clients(id) on delete set null;
alter table public.projects add column if not exists initiated_for text not null default '';
alter table public.projects add column if not exists initiated_from text not null default '';
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

create table if not exists public.fx_rates (
  id uuid primary key default gen_random_uuid(),
  from_currency text not null,
  to_currency text not null,
  rate numeric not null check (rate > 0),
  source text not null,
  recorded_at timestamptz not null default now()
);

alter table public.fx_rates enable row level security;

drop policy if exists fx_read on public.fx_rates;
create policy fx_read on public.fx_rates for select to authenticated using (true);

drop policy if exists fx_write on public.fx_rates;
create policy fx_write on public.fx_rates for insert to authenticated
  with check (public.has_permission('settings.manage'));

grant select, insert on public.fx_rates to authenticated;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

insert into public.organizations (name)
values ('EMBEE'), ('Hanu.AI')
on conflict (name) do nothing;

grant select, insert, update, delete on public.organizations to authenticated;

alter table public.organizations enable row level security;

drop policy if exists organizations_read on public.organizations;
create policy organizations_read on public.organizations for select to authenticated using (true);

drop policy if exists organizations_write on public.organizations;
create policy organizations_write on public.organizations for all to authenticated
  using (public.has_permission('settings.manage') or public.has_permission('clients.manage'))
  with check (public.has_permission('settings.manage') or public.has_permission('clients.manage'));

create table if not exists public.status_updates (
  id uuid primary key default gen_random_uuid(),
  sheet_no int not null,
  project_name text not null,
  sub_item text not null default '',
  status text not null default '',
  remarks text not null default '',
  status_date date not null,
  sheet_label text not null default '',
  company text not null default '',
  fields jsonb not null default '{}'::jsonb,
  unique (project_name, sub_item, status_date)
);

alter table public.status_updates add column if not exists sheet_label text not null default '';
alter table public.status_updates add column if not exists company text not null default '';
alter table public.status_updates add column if not exists fields jsonb not null default '{}'::jsonb;

update public.status_updates
set sheet_label = to_char(status_date, 'DD-MM-YYYY')
where sheet_label = '';

alter table public.status_updates enable row level security;

create or replace function public.status_row_visible(row_company text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          lower(p.email) in ('rakhee@embee.local', 'brian@embee.local')
          or lower(btrim(p.full_name)) in ('rakhee', 'brian')
        )
    ) then lower(btrim(coalesce(row_company, ''))) = 'assure'
    else true
  end;
$$;

create or replace function public.status_sheet_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and (
        lower(p.email) = 'owner@embee.local'
        or lower(p.full_name) like '%gsvk%'
      )
  );
$$;

drop policy if exists status_updates_read on public.status_updates;
create policy status_updates_read on public.status_updates for select to authenticated
  using (public.status_row_visible(company));

drop policy if exists status_updates_write on public.status_updates;
drop policy if exists status_updates_insert on public.status_updates;
drop policy if exists status_updates_update on public.status_updates;
drop policy if exists status_updates_delete on public.status_updates;
create policy status_updates_insert on public.status_updates for insert to authenticated
  with check (public.status_sheet_editor());
create policy status_updates_update on public.status_updates for update to authenticated
  using (public.status_sheet_editor())
  with check (public.status_sheet_editor());
create policy status_updates_delete on public.status_updates for delete to authenticated
  using (public.status_sheet_editor());

grant select, insert, update, delete on public.status_updates to authenticated;

create table if not exists public.sow_records (
  id text primary key,
  kind text not null default 'status' check (kind in ('status', 'bid')),
  sheet_no int not null default 0,
  project_name text not null default '',
  sprint text not null default '',
  link text not null default '',
  signature text not null default '',
  signed_on text not null default '',
  change_request text not null default '',
  company text not null default ''
);

alter table public.sow_records enable row level security;

drop policy if exists sow_records_read on public.sow_records;
create policy sow_records_read on public.sow_records for select to authenticated
  using (public.status_row_visible(company));

drop policy if exists sow_records_insert on public.sow_records;
drop policy if exists sow_records_update on public.sow_records;
drop policy if exists sow_records_delete on public.sow_records;
create policy sow_records_insert on public.sow_records for insert to authenticated
  with check (public.status_sheet_editor());
create policy sow_records_update on public.sow_records for update to authenticated
  using (public.status_sheet_editor())
  with check (public.status_sheet_editor());
create policy sow_records_delete on public.sow_records for delete to authenticated
  using (public.status_sheet_editor());

grant select, insert, update, delete on public.sow_records to authenticated;

alter table public.profiles add column if not exists company_scope text not null default '';
alter table public.profiles add column if not exists sheet_editor boolean not null default false;
alter table public.clients add column if not exists created_at timestamptz not null default now();
alter table public.features add column if not exists created_at timestamptz not null default now();
alter table public.invoices add column if not exists created_at timestamptz not null default now();
alter table public.milestones add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.projects add column if not exists created_at timestamptz not null default now();
alter table public.rates add column if not exists created_at timestamptz not null default now();
alter table public.roles add column if not exists created_at timestamptz not null default now();
alter table public.tasks add column if not exists created_at timestamptz not null default now();
alter table public.timesheets add column if not exists created_at timestamptz not null default now();

update public.profiles
set company_scope = 'assure'
where company_scope = ''
  and (
    lower(email) in ('rakhee@embee.local', 'brian@embee.local')
    or lower(btrim(full_name)) in ('rakhee', 'brian')
  );

update public.profiles
set sheet_editor = true
where lower(email) = 'owner@embee.local'
   or lower(full_name) like '%gsvk%';

create or replace function public.status_row_visible(row_company text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          lower(btrim(coalesce(p.company_scope, ''))) = 'assure'
          or lower(p.email) in ('rakhee@embee.local', 'brian@embee.local')
          or lower(btrim(p.full_name)) in ('rakhee', 'brian')
        )
    ) then lower(btrim(coalesce(row_company, ''))) = 'assure'
    else true
  end;
$$;

create or replace function public.status_sheet_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and (
        p.sheet_editor
        or lower(p.email) = 'owner@embee.local'
        or lower(p.full_name) like '%gsvk%'
      )
  );
$$;

insert into public.role_permissions (role_id, permission_key)
select r.id, 'projects.intake'
from public.roles r
where r.slug = 'project_owner'
on conflict do nothing;

create index if not exists status_updates_date_idx on public.status_updates (status_date desc, sheet_no);
create index if not exists sow_records_kind_idx on public.sow_records (kind, sheet_no);

insert into storage.buckets (id, name, public)
values ('project-docs', 'project-docs', false)
on conflict (id) do nothing;

alter table public.profiles add column if not exists about text not null default '';

create table if not exists public.hourly_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_name text not null default '',
  sheet_no integer not null default 0,
  project_name text not null default '',
  sprint text not null default '',
  resource_name text not null default '',
  task text not null default '',
  work_date date,
  hours numeric not null default 0,
  status text not null default '',
  company text not null default '',
  est_start date,
  est_end date,
  estimated_hours numeric,
  target_hours numeric,
  actual_start date,
  actual_end date,
  actual_hours numeric,
  approval text not null default '',
  notes text not null default ''
);

alter table public.hourly_entries add column if not exists sheet_no integer not null default 0;
alter table public.hourly_entries add column if not exists sprint text not null default '';
alter table public.hourly_entries add column if not exists resource_name text not null default '';
alter table public.hourly_entries add column if not exists task text not null default '';
alter table public.hourly_entries add column if not exists status text not null default '';
alter table public.hourly_entries add column if not exists company text not null default '';
alter table public.hourly_entries add column if not exists est_start date;
alter table public.hourly_entries add column if not exists est_end date;
alter table public.hourly_entries add column if not exists estimated_hours numeric;
alter table public.hourly_entries add column if not exists target_hours numeric;
alter table public.hourly_entries add column if not exists actual_start date;
alter table public.hourly_entries add column if not exists actual_end date;
alter table public.hourly_entries add column if not exists actual_hours numeric;
alter table public.hourly_entries add column if not exists approval text not null default '';
alter table public.hourly_entries alter column work_date drop not null;

alter table public.hourly_entries enable row level security;

drop policy if exists hourly_entries_read on public.hourly_entries;
create policy hourly_entries_read on public.hourly_entries for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_permission('timesheets.view_all')
    or public.has_permission('timesheets.approve')
    or public.has_permission('projects.view')
    or public.has_permission('projects.view_all')
    or public.has_permission('tasks.view')
    or public.has_permission('tasks.manage')
  );

drop policy if exists hourly_entries_insert on public.hourly_entries;
create policy hourly_entries_insert on public.hourly_entries for insert to authenticated
  with check (user_id = auth.uid() and public.has_permission('timesheets.submit'));

drop policy if exists hourly_entries_update on public.hourly_entries;
create policy hourly_entries_update on public.hourly_entries for update to authenticated
  using (user_id = auth.uid() and public.has_permission('timesheets.submit'))
  with check (user_id = auth.uid() and public.has_permission('timesheets.submit'));

drop policy if exists hourly_entries_delete on public.hourly_entries;
create policy hourly_entries_delete on public.hourly_entries for delete to authenticated
  using (user_id = auth.uid() and public.has_permission('timesheets.submit'));

grant select, insert, update, delete on public.hourly_entries to authenticated;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
join (values
  ('scrum_master', 'timesheets.submit'),
  ('project_manager', 'timesheets.submit'),
  ('finance', 'timesheets.submit'),
  ('admin', 'profile.edit'),
  ('project_owner', 'profile.edit'),
  ('developer', 'profile.edit'),
  ('finance', 'profile.edit'),
  ('scrum_master', 'profile.edit'),
  ('project_manager', 'profile.edit'),
  ('client', 'profile.edit')
) as p(slug, key) on p.slug = r.slug
on conflict do nothing;

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
  end if;
  if auth.uid() = old.id and not public.has_permission('profile.edit') and not public.has_permission('team.manage') then
    new.email := old.email;
    new.full_name := old.full_name;
    new.title := old.title;
    new.phone := old.phone;
    new.about := old.about;
  end if;
  return new;
end;
$$;

with ranked as (
  select id, row_number() over (
    partition by user_id, work_date
    order by (invoice_id is not null) desc, (status = 'approved') desc, id desc
  ) as n
  from public.timesheets
)
delete from public.timesheets where id in (select id from ranked where n > 1);

create unique index if not exists timesheets_user_day_key on public.timesheets (user_id, work_date);

create index if not exists hourly_entries_user_sheet_idx on public.hourly_entries (user_id, sheet_no);
create index if not exists hourly_entries_sheet_idx on public.hourly_entries (sheet_no);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists profiles_role_idx on public.profiles (role_id);

-- PMD workspace: tab access mirrors lib/tab-access.ts (TAB_PERMISSIONS).
create or replace function public.pmd_can_edit(tab text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select
      lower(coalesce(p.email, '')) as email,
      lower(btrim(coalesce(p.full_name, ''))) as name,
      coalesce(r.slug, '') as slug,
      coalesce(p.sheet_editor, false) as editor
    from public.profiles p
    left join public.roles r on r.id = p.role_id
    where p.id = auth.uid() and p.status = 'active'
  ),
  keys as (
    select
      (slug = 'admin' or editor or email = 'owner@embee.local' or name like '%gsvk%') as pmd_admin,
      (email = 'director@embee.local' or name like '%harshit%') as harshit,
      (email = 'manav@embee.local' or name like '%manav%' or name like '%maanav%') as manav,
      (email = 'sm@embee.local' or name like '%kaushik%') as kaushik,
      (email = 'yuvraj@embee.local' or name like '%yuvraj%') as yuvraj,
      (email = 'rakhee@embee.local' or name = 'rakhee' or name like 'rakhee %') as rakhee,
      (slug = 'developer' or email = 'ishaan@embee.local' or name like '%bhuvin%') as developer
    from me
  )
  select coalesce((
    select case tab
      when 'myWork' then developer or kaushik or yuvraj
      when 'dsrIntake' then developer or kaushik or yuvraj
      when 'projectIntake' then pmd_admin
      when 'sowManagement' then pmd_admin or rakhee
      when 'utilization' then pmd_admin or harshit or manav
      when 'dsrHourlyTracker' then pmd_admin or harshit or manav
      when 'escalations' then pmd_admin or manav or kaushik or yuvraj or harshit or rakhee or developer
      when 'deliveryChecklist' then pmd_admin or rakhee
      else false
    end
    from keys
  ), false);
$$;

grant execute on function public.pmd_can_edit(text) to authenticated;

alter table public.status_updates add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.status_updates add column if not exists created_at timestamptz not null default now();
alter table public.status_updates add column if not exists updated_by uuid references public.profiles(id) on delete set null;
alter table public.status_updates add column if not exists updated_at timestamptz not null default now();

alter table public.sow_records add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.sow_records add column if not exists created_at timestamptz not null default now();
alter table public.sow_records add column if not exists updated_by uuid references public.profiles(id) on delete set null;
alter table public.sow_records add column if not exists updated_at timestamptz not null default now();

alter table public.hourly_entries add column if not exists blocker text not null default '';
alter table public.hourly_entries add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.hourly_entries add column if not exists created_at timestamptz not null default now();
alter table public.hourly_entries add column if not exists updated_by uuid references public.profiles(id) on delete set null;
alter table public.hourly_entries add column if not exists updated_at timestamptz not null default now();

alter table public.escalations alter column project_id drop not null;
alter table public.escalations add column if not exists project_name text not null default '';
alter table public.escalations add column if not exists source_entry_id uuid references public.hourly_entries(id) on delete set null;
alter table public.escalations add column if not exists resolution_note text not null default '';
alter table public.escalations add column if not exists updated_by uuid references public.profiles(id) on delete set null;
alter table public.escalations add column if not exists updated_at timestamptz not null default now();
alter table public.escalations add column if not exists resolved_at timestamptz;
alter table public.escalations add column if not exists resolved_by uuid references public.profiles(id) on delete set null;
update public.escalations set resolved_at = updated_at, resolved_by = updated_by where status = 'resolved' and resolved_at is null;
create unique index if not exists escalations_source_entry_key on public.escalations (source_entry_id) where source_entry_id is not null;

create table if not exists public.checklist_items (
  id text primary key,
  sheet_no integer not null default 0,
  project_name text not null default '',
  sprint text not null default '',
  task text not null default '',
  resource_name text not null default '',
  completed_on date,
  status text not null default 'Completed',
  client_approval text not null default '',
  source text not null default 'auto' check (source in ('auto', 'manual', 'upload')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.checklist_items enable row level security;
grant select, insert, update, delete on public.checklist_items to authenticated;

drop policy if exists checklist_read on public.checklist_items;
create policy checklist_read on public.checklist_items for select to authenticated using (true);
drop policy if exists checklist_write on public.checklist_items;
create policy checklist_write on public.checklist_items for all to authenticated
  using (public.pmd_can_edit('deliveryChecklist'))
  with check (public.pmd_can_edit('deliveryChecklist'));
drop policy if exists checklist_auto on public.checklist_items;
create policy checklist_auto on public.checklist_items for insert to authenticated
  with check (source = 'auto');

drop policy if exists status_updates_insert on public.status_updates;
drop policy if exists status_updates_update on public.status_updates;
drop policy if exists status_updates_delete on public.status_updates;
create policy status_updates_insert on public.status_updates for insert to authenticated
  with check (public.pmd_can_edit('projectIntake'));
create policy status_updates_update on public.status_updates for update to authenticated
  using (public.pmd_can_edit('projectIntake'))
  with check (public.pmd_can_edit('projectIntake'));
create policy status_updates_delete on public.status_updates for delete to authenticated
  using (public.pmd_can_edit('projectIntake'));

drop policy if exists sow_records_insert on public.sow_records;
drop policy if exists sow_records_update on public.sow_records;
drop policy if exists sow_records_delete on public.sow_records;
create policy sow_records_insert on public.sow_records for insert to authenticated
  with check (public.pmd_can_edit('sowManagement'));
create policy sow_records_update on public.sow_records for update to authenticated
  using (public.pmd_can_edit('sowManagement'))
  with check (public.pmd_can_edit('sowManagement'));
create policy sow_records_delete on public.sow_records for delete to authenticated
  using (public.pmd_can_edit('sowManagement'));

drop policy if exists projects_pmd_sow on public.projects;
create policy projects_pmd_sow on public.projects for update to authenticated
  using (public.pmd_can_edit('sowManagement'))
  with check (public.pmd_can_edit('sowManagement'));

drop policy if exists hourly_entries_read on public.hourly_entries;
create policy hourly_entries_read on public.hourly_entries for select to authenticated
  using (public.status_row_visible(company));
drop policy if exists hourly_entries_insert on public.hourly_entries;
create policy hourly_entries_insert on public.hourly_entries for insert to authenticated
  with check (
    user_id = auth.uid()
    and case
      when estimated_hours is not null or target_hours is not null or est_start is not null then public.pmd_can_edit('utilization')
      else public.pmd_can_edit('dsrHourlyTracker') or public.pmd_can_edit('dsrIntake')
    end
  );
drop policy if exists hourly_entries_update on public.hourly_entries;
create policy hourly_entries_update on public.hourly_entries for update to authenticated
  using (
    case
      when estimated_hours is not null or target_hours is not null or est_start is not null then public.pmd_can_edit('utilization')
      else public.pmd_can_edit('dsrHourlyTracker') or (public.pmd_can_edit('dsrIntake') and user_id = auth.uid())
    end
  )
  with check (
    case
      when estimated_hours is not null or target_hours is not null or est_start is not null then public.pmd_can_edit('utilization')
      else public.pmd_can_edit('dsrHourlyTracker') or (public.pmd_can_edit('dsrIntake') and user_id = auth.uid())
    end
  );
drop policy if exists hourly_entries_delete on public.hourly_entries;
create policy hourly_entries_delete on public.hourly_entries for delete to authenticated
  using (
    case
      when estimated_hours is not null or target_hours is not null or est_start is not null then public.pmd_can_edit('utilization')
      else public.pmd_can_edit('dsrHourlyTracker') or (public.pmd_can_edit('dsrIntake') and user_id = auth.uid())
    end
  );

drop policy if exists escalations_read on public.escalations;
create policy escalations_read on public.escalations for select to authenticated using (true);
drop policy if exists escalations_insert on public.escalations;
create policy escalations_insert on public.escalations for insert to authenticated
  with check (created_by = auth.uid() and (public.pmd_can_edit('escalations') or public.pmd_can_edit('dsrHourlyTracker') or public.pmd_can_edit('dsrIntake')));
drop policy if exists escalations_update on public.escalations;
create policy escalations_update on public.escalations for update to authenticated
  using (public.pmd_can_edit('escalations') or public.pmd_can_edit('dsrHourlyTracker') or public.pmd_can_edit('dsrIntake'))
  with check (public.pmd_can_edit('escalations') or public.pmd_can_edit('dsrHourlyTracker') or public.pmd_can_edit('dsrIntake'));

drop policy if exists workstreams_write on public.workstreams;
create policy workstreams_write on public.workstreams for update to authenticated
  using (public.pmd_can_edit('escalations'))
  with check (public.pmd_can_edit('escalations'));

create or replace function public.apply_checklist_approval(p_project text, p_task text, p_approval text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer := 0;
begin
  if not public.pmd_can_edit('deliveryChecklist') then
    raise exception 'You cannot update client approval.';
  end if;
  update public.hourly_entries
  set approval = coalesce(p_approval, ''), updated_by = auth.uid(), updated_at = now()
  where (estimated_hours is not null or target_hours is not null or est_start is not null)
    and lower(regexp_replace(btrim(project_name), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(p_project), '\s+', ' ', 'g'))
    and lower(regexp_replace(btrim(task), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(p_task), '\s+', ' ', 'g'))
    and approval is distinct from coalesce(p_approval, '');
  get diagnostics changed = row_count;
  return changed;
end;
$$;

grant execute on function public.apply_checklist_approval(text, text, text) to authenticated;

create or replace function public.sync_escalation_source(p_escalation uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.pmd_can_edit('escalations') then
    raise exception 'You cannot update that escalation.';
  end if;
  update public.hourly_entries h
  set status = p_status, updated_by = auth.uid(), updated_at = now()
  from public.escalations e
  where e.id = p_escalation and h.id = e.source_entry_id;
end;
$$;

grant execute on function public.sync_escalation_source(uuid, text) to authenticated;

create or replace function public.pmd_activity()
returns table (id uuid, actor_id uuid, action text, entity text, summary text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.actor_id, a.action, a.entity, a.summary, a.created_at
  from public.audit_logs a
  where auth.uid() is not null
    and a.action ~ '^(status\.|sow\.|hourly\.|allocation\.|escalation\.|checklist\.|project\.intake)'
  order by a.created_at desc
  limit 8;
$$;

grant execute on function public.pmd_activity() to authenticated;

create or replace function public.portal_bundle(
  p_grants boolean,
  p_rates boolean,
  p_money boolean,
  p_payments boolean,
  p_audit boolean,
  p_costs boolean
) returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'roles', coalesce((select jsonb_agg(to_jsonb(t) order by t.name) from public.roles t), '[]'::jsonb),
    'grants', case when p_grants then coalesce((select jsonb_agg(jsonb_build_object('role_id', g.role_id, 'permission_key', g.permission_key)) from public.role_permissions g), '[]'::jsonb) else '[]'::jsonb end,
    'profiles', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email, 'title', p.title, 'phone', p.phone, 'role_id', p.role_id, 'status', p.status)) from public.profiles p), '[]'::jsonb),
    'clients', coalesce((select jsonb_agg(to_jsonb(t) order by t.company) from public.clients t), '[]'::jsonb),
    'projects', coalesce((select jsonb_agg(to_jsonb(t) order by t.name) from public.projects t), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(jsonb_build_object('project_id', m.project_id, 'user_id', m.user_id, 'member_role', m.member_role, 'bill_rate', m.bill_rate)) from public.project_members m), '[]'::jsonb),
    'milestones', coalesce((select jsonb_agg(to_jsonb(t)) from public.milestones t), '[]'::jsonb),
    'features', coalesce((select jsonb_agg(to_jsonb(t)) from public.features t), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(to_jsonb(t)) from public.tasks t), '[]'::jsonb),
    'timesheets', coalesce((select jsonb_agg(to_jsonb(t)) from public.timesheets t), '[]'::jsonb),
    'rates', case when p_rates then coalesce((select jsonb_agg(to_jsonb(t)) from public.rates t), '[]'::jsonb) else '[]'::jsonb end,
    'invoices', case when p_money then coalesce((select jsonb_agg(to_jsonb(t) order by t.issue_date desc) from public.invoices t), '[]'::jsonb) else '[]'::jsonb end,
    'lines', case when p_money then coalesce((select jsonb_agg(to_jsonb(t)) from public.invoice_lines t), '[]'::jsonb) else '[]'::jsonb end,
    'payments', case when p_payments then coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc) from public.payments t), '[]'::jsonb) else '[]'::jsonb end,
    'notifications', coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from (select * from public.notifications where user_id = auth.uid() order by created_at desc limit 40) n), '[]'::jsonb),
    'audit', case when p_audit then coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (select id, actor_id, action, entity, entity_id, summary, created_at from public.audit_logs order by created_at desc limit 80) a), '[]'::jsonb) else '[]'::jsonb end,
    'costs', case when p_costs then coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'hourly_cost', c.hourly_cost)) from public.staff_costs() c), '[]'::jsonb) else '[]'::jsonb end,
    'escalations', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc) from public.escalations t), '[]'::jsonb),
    'files', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc) from public.project_files t), '[]'::jsonb),
    'workstreams', coalesce((select jsonb_agg(to_jsonb(t) order by t.name) from public.workstreams t), '[]'::jsonb),
    'studio', (select to_jsonb(s) from public.studio_settings s where s.id = 1),
    'fx', coalesce((select jsonb_agg(to_jsonb(f) order by f.recorded_at desc) from (select id, from_currency, to_currency, rate, source, recorded_at from public.fx_rates order by recorded_at desc limit 20) f), '[]'::jsonb),
    'status', coalesce((select jsonb_agg(to_jsonb(s) order by s.status_date desc, s.sheet_no) from public.status_updates s), '[]'::jsonb),
    'sow', coalesce((select jsonb_agg(to_jsonb(s) order by s.sheet_no) from public.sow_records s), '[]'::jsonb),
    'hourly', coalesce((select jsonb_agg(to_jsonb(h) order by h.sheet_no) from public.hourly_entries h), '[]'::jsonb),
    'checklist', coalesce((select jsonb_agg(to_jsonb(c) order by c.sheet_no) from public.checklist_items c), '[]'::jsonb),
    'activity', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'action', a.action, 'entity', a.entity, 'summary', a.summary, 'actor_name', coalesce(p.full_name, 'System'), 'created_at', a.created_at) order by a.created_at desc) from (select * from public.pmd_activity()) a left join public.profiles p on p.id = a.actor_id), '[]'::jsonb)
  );
$$;

grant execute on function public.portal_bundle(boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;

create or replace function public.replace_resource_allocation(payload jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer := 0;
begin
  if auth.uid() is null
     or not (public.has_permission('timesheets.view_all') or public.has_permission('settings.manage')) then
    raise exception 'You cannot upload resource allocation.';
  end if;
  delete from public.hourly_entries
  where estimated_hours is not null
     or target_hours is not null
     or est_start is not null;
  insert into public.hourly_entries (
    user_id, role_name, sheet_no, project_name, sprint, resource_name, task,
    work_date, hours, status, company, est_start, est_end, estimated_hours,
    target_hours, actual_start, actual_end, actual_hours, approval, notes
  )
  select
    auth.uid(),
    coalesce(r.role_name, ''),
    coalesce(r.sheet_no, 0),
    coalesce(r.project_name, ''),
    coalesce(r.sprint, ''),
    coalesce(r.resource_name, ''),
    coalesce(r.task, ''),
    nullif(r.work_date, '')::date,
    least(24, greatest(0, coalesce(r.hours, 0))),
    coalesce(r.status, ''),
    coalesce(r.company, ''),
    nullif(r.est_start, '')::date,
    nullif(r.est_end, '')::date,
    r.estimated_hours,
    r.target_hours,
    nullif(r.actual_start, '')::date,
    nullif(r.actual_end, '')::date,
    r.actual_hours,
    coalesce(r.approval, ''),
    coalesce(r.notes, '')
  from jsonb_to_recordset(coalesce(payload, '[]'::jsonb)) as r(
    role_name text,
    sheet_no integer,
    project_name text,
    sprint text,
    resource_name text,
    task text,
    work_date text,
    hours numeric,
    status text,
    company text,
    est_start text,
    est_end text,
    estimated_hours numeric,
    target_hours numeric,
    actual_start text,
    actual_end text,
    actual_hours numeric,
    approval text,
    notes text
  );
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

grant execute on function public.replace_resource_allocation(jsonb) to authenticated;

-- Mirrors sowCompany() in lib/sow-board.ts so Assure-scoped clients can see status rows that were uploaded without a Company column.
update public.status_updates
set company = case
  when lower(project_name) ~ '(art information|finsoft|vp portal|ipo|finace|finance)' then 'EMbee'
  else 'Assure'
end
where btrim(company) = '';

notify pgrst, 'reload schema';
