-- Delivery Costs table
-- Tracks per-order delivery costs: runner pay, fuel estimate, time cost
-- Used for delivery P&L analysis and route optimization

create table if not exists public.delivery_costs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null,
  courier_id uuid references public.couriers(id) on delete set null,

  -- Cost components
  runner_pay numeric(10,2) not null default 0,
  fuel_estimate numeric(10,2) not null default 0,
  time_cost numeric(10,2) not null default 0,
  other_costs numeric(10,2) not null default 0,
  total_cost numeric(10,2) generated always as (runner_pay + fuel_estimate + time_cost + other_costs) stored,

  -- Revenue side (snapshot from order at time of recording)
  delivery_fee_collected numeric(10,2) not null default 0,
  tip_amount numeric(10,2) not null default 0,
  total_revenue numeric(10,2) generated always as (delivery_fee_collected + tip_amount) stored,

  -- Derived profitability (computed column)
  profit numeric(10,2) generated always as ((delivery_fee_collected + tip_amount) - (runner_pay + fuel_estimate + time_cost + other_costs)) stored,

  -- Context
  distance_miles numeric(8,2),
  delivery_time_minutes integer,
  delivery_zone text,
  delivery_borough text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_delivery_costs_tenant on public.delivery_costs(tenant_id);
create index if not exists idx_delivery_costs_order on public.delivery_costs(order_id);
create index if not exists idx_delivery_costs_courier on public.delivery_costs(courier_id);
create index if not exists idx_delivery_costs_created on public.delivery_costs(tenant_id, created_at desc);
create unique index if not exists idx_delivery_costs_tenant_order on public.delivery_costs(tenant_id, order_id);

-- RLS
alter table public.delivery_costs enable row level security;

create policy "Tenant isolation for delivery_costs"
  on public.delivery_costs
  for all
  using (tenant_id = auth.uid()::uuid OR tenant_id IN (
    SELECT ta.tenant_id FROM public.tenant_admins ta WHERE ta.user_id = auth.uid()
  ))
  with check (tenant_id = auth.uid()::uuid OR tenant_id IN (
    SELECT ta.tenant_id FROM public.tenant_admins ta WHERE ta.user_id = auth.uid()
  ));

-- Updated_at trigger
create or replace function public.update_delivery_costs_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger delivery_costs_updated_at
  before update on public.delivery_costs
  for each row
  execute function public.update_delivery_costs_updated_at();
