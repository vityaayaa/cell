-- Optional short name shown to employees on the working screens (shelf, sweep,
-- order, checklist) instead of the full «name + dimensions». Nullable: when
-- empty the app falls back to the full auto name. The catalog always shows the
-- full name. Safe to add as nullable — no backfill needed.
alter table products add column display_name text;
