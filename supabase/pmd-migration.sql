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
