-- Keep the existing generic platform score rows untouched.  This contract is
-- scoped by mode, difficulty, and rules version, and a UUID submission id
-- makes a retry idempotent.
create table if not exists public.mamonokiri_score_submissions (
  submission_id uuid primary key,
  normalized_name text not null,
  display_name text not null,
  mode text not null check (mode in ('ten', 'twenty-five', 'fifty')),
  difficulty text not null check (difficulty in ('apprentice', 'standard', 'dark')),
  rules_version text not null check (
    rules_version ~ '^mamonokiri-score-v[0-9]+$'
  ),
  run_seed bigint not null check (run_seed >= 0 and run_seed <= 4294967295),
  score integer not null check (score >= 0 and score <= 100000000),
  clear_wave integer not null check (clear_wave >= 1 and clear_wave <= 50),
  client_version text not null default '',
  created_at timestamptz not null default clock_timestamp()
);

create table if not exists public.mamonokiri_score_totals (
  mode text not null check (mode in ('ten', 'twenty-five', 'fifty')),
  difficulty text not null check (difficulty in ('apprentice', 'standard', 'dark')),
  rules_version text not null check (
    rules_version ~ '^mamonokiri-score-v[0-9]+$'
  ),
  normalized_name text not null,
  display_name text not null,
  first_score integer not null check (first_score >= 0),
  best_score integer not null check (best_score >= 0),
  play_count integer not null check (play_count >= 1),
  first_score_at timestamptz not null,
  best_score_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (mode, difficulty, rules_version, normalized_name)
);

create index if not exists mamonokiri_score_totals_ranking_idx
  on public.mamonokiri_score_totals (
    mode,
    difficulty,
    rules_version,
    best_score desc,
    best_score_at,
    normalized_name
  );

alter table public.mamonokiri_score_submissions enable row level security;
alter table public.mamonokiri_score_totals enable row level security;

revoke all on table public.mamonokiri_score_submissions from anon, authenticated;
revoke all on table public.mamonokiri_score_totals from anon, authenticated;

create or replace function public.mamonokiri_submit_score_v1(
  p_submission_id uuid,
  p_display_name text,
  p_mode text,
  p_difficulty text,
  p_rules_version text,
  p_run_seed bigint,
  p_score integer,
  p_clear_wave integer,
  p_client_version text default ''
)
returns table (
  accepted boolean,
  duplicate boolean,
  best_score integer,
  play_count integer
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_display_name text := pg_catalog.btrim(coalesce(p_display_name, ''));
  v_normalized_name text;
  v_existing public.mamonokiri_score_submissions%rowtype;
  v_total public.mamonokiri_score_totals%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_submission_id is null then
    raise exception 'submission id is required';
  end if;
  if v_display_name = '' then
    raise exception 'name is empty';
  end if;
  if pg_catalog.char_length(v_display_name) > 20 then
    raise exception 'name is too long';
  end if;
  if v_display_name ~ '[[:cntrl:]]' then
    raise exception 'name contains a control character';
  end if;
  if p_mode not in ('ten', 'twenty-five', 'fifty') then
    raise exception 'mode is invalid';
  end if;
  if p_difficulty not in ('apprentice', 'standard', 'dark') then
    raise exception 'difficulty is invalid';
  end if;
  if p_rules_version is null
     or p_rules_version !~ '^mamonokiri-score-v[0-9]+$'
  then
    raise exception 'rules version is invalid';
  end if;
  if p_run_seed is null or p_run_seed < 0 or p_run_seed > 4294967295 then
    raise exception 'run seed is invalid';
  end if;
  if p_score is null or p_score < 0 or p_score > 100000000 then
    raise exception 'score is invalid';
  end if;
  if p_clear_wave is null
     or p_clear_wave < 1
     or (p_mode = 'ten' and p_clear_wave > 10)
     or (p_mode = 'twenty-five' and p_clear_wave > 25)
     or (p_mode = 'fifty' and p_clear_wave > 50)
  then
    raise exception 'clear wave is invalid';
  end if;

  v_normalized_name := v_display_name;

  select *
  into v_existing
  from public.mamonokiri_score_submissions
  where submission_id = p_submission_id
  for update;

  if found then
    if v_existing.normalized_name is distinct from v_normalized_name
       or v_existing.display_name is distinct from v_display_name
       or v_existing.mode is distinct from p_mode
       or v_existing.difficulty is distinct from p_difficulty
       or v_existing.rules_version is distinct from p_rules_version
       or v_existing.run_seed is distinct from p_run_seed
       or v_existing.score is distinct from p_score
       or v_existing.clear_wave is distinct from p_clear_wave
       or v_existing.client_version is distinct from coalesce(p_client_version, '')
    then
      raise exception 'submission id already contains another result';
    end if;

    select *
    into v_total
    from public.mamonokiri_score_totals
    where mode = v_existing.mode
      and difficulty = v_existing.difficulty
      and rules_version = v_existing.rules_version
      and normalized_name = v_existing.normalized_name;
    return query select true, true, v_total.best_score, v_total.play_count;
    return;
  end if;

  insert into public.mamonokiri_score_submissions (
    submission_id,
    normalized_name,
    display_name,
    mode,
    difficulty,
    rules_version,
    run_seed,
    score,
    clear_wave,
    client_version,
    created_at
  )
  values (
    p_submission_id,
    v_normalized_name,
    v_display_name,
    p_mode,
    p_difficulty,
    p_rules_version,
    p_run_seed,
    p_score,
    p_clear_wave,
    coalesce(p_client_version, ''),
    v_now
  );

  insert into public.mamonokiri_score_totals (
    mode,
    difficulty,
    rules_version,
    normalized_name,
    display_name,
    first_score,
    best_score,
    play_count,
    first_score_at,
    best_score_at,
    updated_at
  )
  values (
    p_mode,
    p_difficulty,
    p_rules_version,
    v_normalized_name,
    v_display_name,
    p_score,
    p_score,
    1,
    v_now,
    v_now,
    v_now
  )
  on conflict (mode, difficulty, rules_version, normalized_name) do update
  set display_name = excluded.display_name,
      best_score = greatest(
        public.mamonokiri_score_totals.best_score,
        excluded.best_score
      ),
      play_count = public.mamonokiri_score_totals.play_count + 1,
      best_score_at = case
        when excluded.best_score > public.mamonokiri_score_totals.best_score
          then excluded.best_score_at
        else public.mamonokiri_score_totals.best_score_at
      end,
      updated_at = excluded.updated_at;

  select *
  into v_total
  from public.mamonokiri_score_totals
  where mode = p_mode
    and difficulty = p_difficulty
    and rules_version = p_rules_version
    and normalized_name = v_normalized_name;
  return query select true, false, v_total.best_score, v_total.play_count;
end;
$function$;

create or replace function public.mamonokiri_get_score_ranking_v1(
  p_mode text,
  p_difficulty text,
  p_rules_version text,
  p_limit integer default 10
)
returns table (
  rank_no bigint,
  display_name text,
  best_score integer,
  play_count integer,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path to ''
as $function$
  with ranked as (
    select
      rank() over (
        order by best_score desc, best_score_at asc, normalized_name asc
      ) as rank_no,
      display_name,
      best_score,
      play_count,
      updated_at
    from public.mamonokiri_score_totals
    where mode = p_mode
      and difficulty = p_difficulty
      and rules_version = p_rules_version
  )
  select rank_no, display_name, best_score, play_count, updated_at
  from ranked
  order by rank_no asc, updated_at asc, display_name asc
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
$function$;

revoke all on function public.mamonokiri_submit_score_v1(
  uuid, text, text, text, text, bigint, integer, integer, text
) from public;
grant execute on function public.mamonokiri_submit_score_v1(
  uuid, text, text, text, text, bigint, integer, integer, text
) to anon, authenticated;

revoke all on function public.mamonokiri_get_score_ranking_v1(
  text, text, text, integer
) from public;
grant execute on function public.mamonokiri_get_score_ranking_v1(
  text, text, text, integer
) to anon, authenticated;
