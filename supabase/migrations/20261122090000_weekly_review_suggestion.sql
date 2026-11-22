-- P3-08 · the weekly review stores its suggestion and its weight (D75, D77).
-- RLS is unchanged: both tables are already owner-only (20261116072428_activity_tables.sql).

-- D77: a review points at its own weight measurement only, through (id, user_id).
alter table public.body_measurements
  add constraint body_measurements_id_user_key unique (id, user_id);

alter table public.weekly_reviews
  -- D75: the change offered at the end of the week (BR-19), or null.
  add column suggestion jsonb,
  -- D75: the user's answer; P3-10 writes it. A decision needs a suggestion.
  add column suggestion_decision text
    constraint weekly_reviews_suggestion_decision check (suggestion_decision in ('accepted', 'declined')),
  -- D77: the weight entered with the review, counted for the reviewed week.
  add column body_measurement_id uuid,
  add constraint weekly_reviews_decision_needs_suggestion
    check (suggestion_decision is null or suggestion is not null),
  add constraint weekly_reviews_body_measurement_fkey
    foreign key (body_measurement_id, user_id)
    references public.body_measurements (id, user_id)
    on delete set null (body_measurement_id),
  -- D64: one of the six recommendations.
  add constraint weekly_reviews_recommendation_key check (
    recommendation_key in (
      'reduce_or_rest', 'add_recovery_day', 'reduce_sets', 'keep_distance_stable', 'accept_progression', 'maintain'
    )
  );

create index weekly_reviews_body_measurement_idx on public.weekly_reviews (body_measurement_id);
