create table if not exists public.business_specials (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  description text,
  discount_percent int check (discount_percent between 0 and 100),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_business_specials_active on public.business_specials(business_id, is_active);

alter table public.business_specials enable row level security;

create policy "business specials public read" on public.business_specials
  for select using (
    exists (select 1 from public.businesses b where b.id = business_specials.business_id and b.is_active = true)
  );

create policy "business specials manage" on public.business_specials
  for all using (public.owns_business(business_id) or public.is_business_staff(business_id) or public.is_admin())
  with check (public.owns_business(business_id) or public.is_business_staff(business_id) or public.is_admin());

create table if not exists public.business_time_blocks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_business_time_blocks_range on public.business_time_blocks(business_id, starts_at);

alter table public.business_time_blocks enable row level security;

create policy "business time blocks read" on public.business_time_blocks
  for select using (public.owns_business(business_id) or public.is_business_staff(business_id) or public.is_admin());

create policy "business time blocks manage" on public.business_time_blocks
  for all using (public.owns_business(business_id) or public.is_business_staff(business_id) or public.is_admin())
  with check (public.owns_business(business_id) or public.is_business_staff(business_id) or public.is_admin());
