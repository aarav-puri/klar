-- Notifications were removed: Klar only syncs when the student asks, so
-- alerts about changes they just pulled in themselves added nothing.

-- Replace the delete helpers first so they never reference a dropped table.
create or replace function public.delete_my_grade_data() returns void
language sql security invoker set search_path = '' as $$
  delete from public.grade_snapshots where user_id = (select klar.current_user_id());
  delete from public.sync_runs where user_id = (select klar.current_user_id());
  delete from public.courses where user_id = (select klar.current_user_id());
  delete from public.schoology_connections where user_id = (select klar.current_user_id());
$$;

create or replace function public.delete_my_account_data() returns void
language sql security invoker set search_path = '' as $$
  select public.delete_my_grade_data();
  delete from public.user_settings where user_id = (select klar.current_user_id());
  delete from public.profiles where id = (select klar.current_user_id());
$$;

drop table if exists public.notifications;
drop table if exists public.notification_preferences;
alter table public.user_settings drop column if exists browser_notifications;
