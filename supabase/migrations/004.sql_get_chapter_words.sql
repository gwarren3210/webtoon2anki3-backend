create or replace function public.get_chapter_words(
  chapter_number text,
  series_slug text,
  user_id uuid
)
returns table (
  korean text,
  english text,
  "importanceScore" numeric,
  "createdAt" timestamp with time zone,
  due timestamp with time zone,
  stability numeric,
  difficulty numeric,
  elapsed_days numeric,
  scheduled_days numeric,
  reps integer,
  lapses integer,
  state text,
  last_review timestamp with time zone,
  learning_steps integer
)
language sql
security invoker
as $$
  select
    w.word as korean,
    w.definition as english,
    cw.importance_score as "importanceScore",
    cw.created_at as "createdAt",
    f.due,
    f.stability,
    f.difficulty,
    f.elapsed_days,
    f.scheduled_days,
    f.reps,
    f.lapses,
    f.state,
    f.last_review,
    f.learning_steps
  from chapters c
  join series s on c.series_id = s.id
  join chapter_words cw on cw.chapter_id = c.id
  join words w on cw.word_id = w.id
  left join fsrs_progress f on f.vocabulary_id = w.id and f.user_id = user_id
  where c.chapter_number = chapter_number
    and s.slug = series_slug
  order by cw.importance_score desc;
$$;
