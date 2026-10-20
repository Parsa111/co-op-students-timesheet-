-- 1. Create the timesheet_entries table
create table if not exists timesheet_entries (
  id text primary key,
  name text not null,
  date text not null,
  time_in text not null,
  time_out text not null,
  total_hours numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable Row Level Security (RLS)
-- 1b. Auto-calculate total_hours from time_in/time_out on insert or update
create or replace function calculate_total_hours()
returns trigger as $$
declare
  in_min integer;
  out_min integer;
  net integer;
begin
  in_min := (split_part(new.time_in, ':', 1)::integer) * 60
            + split_part(new.time_in, ':', 2)::integer;
  out_min := (split_part(new.time_out, ':', 1)::integer) * 60
             + split_part(new.time_out, ':', 2)::integer;
  if out_min < in_min then
    out_min := out_min + 1440;
  end if;
  net := greatest(0, out_min - in_min);
  new.total_hours := round((net::numeric) / 60.0, 2);
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_timesheet_total_hours on timesheet_entries;
create trigger trg_timesheet_total_hours
before insert or update of time_in, time_out
on timesheet_entries
for each row execute function calculate_total_hours();

alter table timesheet_entries enable row level security;

-- 3. Allow read, insert, update, and delete for all users
drop policy if exists "Allow public read on timesheet_entries" on timesheet_entries;
create policy "Allow public read on timesheet_entries" 
  on timesheet_entries for select using (true);

drop policy if exists "Allow public insert on timesheet_entries" on timesheet_entries;
create policy "Allow public insert on timesheet_entries" 
  on timesheet_entries for insert with check (true);

drop policy if exists "Allow public update on timesheet_entries" on timesheet_entries;
create policy "Allow public update on timesheet_entries" 
  on timesheet_entries for update using (true);

drop policy if exists "Allow public delete on timesheet_entries" on timesheet_entries;
create policy "Allow public delete on timesheet_entries" 
  on timesheet_entries for delete using (true);
