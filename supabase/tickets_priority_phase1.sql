alter table public.tickets
add column if not exists is_priority boolean not null default false;
