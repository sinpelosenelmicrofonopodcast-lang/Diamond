alter table public.profiles
  add column if not exists is_suspended boolean not null default false;

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  target_type text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_logs_created on public.admin_audit_logs(created_at desc);

alter table public.admin_audit_logs enable row level security;

create policy "admin audit logs admin only" on public.admin_audit_logs
  for select using (public.is_admin());
