-- Escalation resolution stamps from master.
alter table public.escalations add column if not exists resolved_at timestamptz;
alter table public.escalations add column if not exists resolved_by uuid references public.profiles(id) on delete set null;
update public.escalations set resolved_at = updated_at, resolved_by = updated_by where status = 'resolved' and resolved_at is null;
notify pgrst, 'reload schema';
