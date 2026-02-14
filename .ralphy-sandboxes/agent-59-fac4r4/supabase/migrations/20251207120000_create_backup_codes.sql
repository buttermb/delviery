-- Create table for user backup codes
create table if not exists public.user_backup_codes (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    code_hash text not null,
    used_at timestamptz,
    created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.user_backup_codes enable row level security;

-- Policies
create policy "Users can insert their own backup codes"
    on public.user_backup_codes for insert
    to authenticated
    with check (auth.uid() = user_id);

create policy "Users can view their own backup codes"
    on public.user_backup_codes for select
    to authenticated
    using (auth.uid() = user_id);

-- Index for faster lookups
create index if not exists idx_backup_codes_user_id on public.user_backup_codes(user_id);
create index if not exists idx_backup_codes_hash on public.user_backup_codes(code_hash);
