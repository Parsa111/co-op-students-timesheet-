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
