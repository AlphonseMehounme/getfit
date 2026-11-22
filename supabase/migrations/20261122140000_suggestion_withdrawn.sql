-- P3-10 / D80: an accepted suggestion is withdrawn when pain is reported later in the same review.
-- RLS is unchanged (owner-only).
alter table public.weekly_reviews
  drop constraint weekly_reviews_suggestion_decision,
  add constraint weekly_reviews_suggestion_decision
    check (suggestion_decision in ('accepted', 'declined', 'withdrawn'));
