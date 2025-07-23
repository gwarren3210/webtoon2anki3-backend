create or replace function get_chapter_cards(
  p_user_id uuid,
  p_series_slug text,
  p_chapter_number text
)
returns table (
  id uuid,
  korean text,
  english text,
  pronunciation text,
  exampleSentence text,
  createdAt timestamptz,
  successRate float,
  importanceScore integer,
  card jsonb
)
language sql
as $$
  select
    w.id,
    w.word as korean,
    w.definition as english,
    null as pronunciation,
    null as exampleSentence,
    w.created_at as "createdAt",
    null::float as "successRate",
    cw.importance_score as "importanceScore",
    case
      when fp.id is not null then jsonb_build_object(
        'due', fp.due,
        'stability', fp.stability,
        'difficulty', fp.difficulty,
        'elapsed_days', fp.elapsed_days,
        'scheduled_days', fp.scheduled_days,
        'learning_steps', fp.learning_steps,
        'reps', fp.reps,
        'lapses', fp.lapses,
        'state', fp.state,
        'last_review', fp.last_review
      )
      else null
    end as card
  from series s
  join chapters c on c.series_id = s.id
  join chapter_words cw on cw.chapter_id = c.id
  join words w on w.id = cw.word_id
  left join fsrs_progress fp on fp.vocabulary_id = w.id and fp.user_id = p_user_id
  where s.slug = p_series_slug
    and c.chapter_number = p_chapter_number;
$$;
