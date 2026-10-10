-- Ask Klar daily message allowance. Counts live in the private schema so a
-- student can't read or reset them; the per-student role only gets the two
-- security-definer functions below, which act on klar.user_id alone.

create table private.assistant_usage (
  user_id text not null,
  day date not null,
  messages int not null default 0,
  primary key (user_id, day)
);

-- Uses one of today's messages. Returns false once the allowance is spent.
-- "Today" is the calendar day in Pacific time.
create function klar.take_assistant_message(daily_limit int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid text := klar.current_user_id();
  today date := (now() at time zone 'America/Los_Angeles')::date;
  used int;
begin
  if uid is null then return false; end if;
  delete from private.assistant_usage where user_id = uid and day < today;
  insert into private.assistant_usage as u (user_id, day, messages) values (uid, today, 1)
    on conflict (user_id, day) do update set messages = u.messages + 1
    where u.messages < daily_limit
    returning messages into used;
  return used is not null and used <= daily_limit;
end $$;

create function klar.forget_assistant_usage() returns void
language sql security definer set search_path = '' as $$
  delete from private.assistant_usage where user_id = (select klar.current_user_id());
$$;

revoke all on function klar.take_assistant_message(int) from public;
revoke all on function klar.forget_assistant_usage() from public;
grant execute on function klar.take_assistant_message(int) to klar_student;
grant execute on function klar.forget_assistant_usage() to klar_student;

-- Deleting an account also clears its Ask Klar counts.
create or replace function public.delete_my_account_data() returns void
language sql security invoker set search_path = '' as $$
  select public.delete_my_grade_data();
  select klar.forget_assistant_usage();
  delete from public.user_settings where user_id = (select klar.current_user_id());
  delete from public.profiles where id = (select klar.current_user_id());
$$;
