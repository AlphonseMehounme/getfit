# 0004 — Translation tables for week and session content

- **Status:** Accepted
- **Date:** 2026-11-16
- **Related:** PRD §6.3, §6.4, §7, §11; ADR 0003; D15, D24

## Context

PRD §11 gives exercises and programmes their own translation tables, but has no place for localised text about
programme weeks ("Week 3 of 8 · Installation", the week's focus) or session templates (title, "why this session
exists", the guidance for recovery and rest days, D24). `programme_weeks.focus_key` and
`template_exercises.note_key` exist, but nothing says where their text lives. ADR 0003 puts seeded content in the
database, not in the UI message catalogues.

## Decision

Two more content tables are added in the P1-02 migration, following the same pattern as the PRD's translation tables
(one row per locale, `primary key (parent_id, locale)`, read-only to users):

- `programme_week_translations (programme_week_id, locale, label, focus)`
- `session_template_translations (session_template_id, locale, title, purpose, guidance jsonb[])`

`focus_key` stays as the stable, language-neutral identifier of a week's focus (used by tests and analytics).
`template_exercises.note_key` is kept as the PRD specifies; P1-11 decides whether any exercise-level note is needed,
and if so adds its text the same way, through a migration.

## Consequences

- Every programme text a screen shows comes from the database in the resolved locale, as exercise text does.
- The schema is a superset of PRD §11. No behaviour changes, so no D-number is needed.
- The seed (P1-11) must provide both locales for these tables; P1-11's tests check that they're complete.
