-- The student's own plan for each course: a grade goal and the course level
-- used for weighted GPA. Nothing here
-- comes from Schoology, so it lives beside the synced course and goes with it.

create table public.course_plans (
  course_id uuid primary key references public.courses (id) on delete cascade,
  user_id text not null,
  goal_percent numeric(5, 2) check (goal_percent between 0 and 150),
  -- Null means Klar's guess from the course name.
  level text check (level in ('standard', 'honors', 'ap')),
  updated_at timestamptz not null default now()
);

alter table public.course_plans enable row level security;
create policy "own rows: select" on public.course_plans for select to klar_student using (user_id = (select klar.current_user_id()));
create policy "own rows: insert" on public.course_plans for insert to klar_student with check (user_id = (select klar.current_user_id()));
create policy "own rows: update" on public.course_plans for update to klar_student using (user_id = (select klar.current_user_id())) with check (user_id = (select klar.current_user_id()));
create policy "own rows: delete" on public.course_plans for delete to klar_student using (user_id = (select klar.current_user_id()));
create policy "plans belong to own course" on public.course_plans as restrictive for insert to klar_student
  with check (exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select klar.current_user_id())));
create policy "plans stay on own course" on public.course_plans as restrictive for update to klar_student
  with check (exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select klar.current_user_id())));

grant select, insert, update, delete on public.course_plans to klar_student;

-- Deleting grade data removes courses, and plans cascade with them.
