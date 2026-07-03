-- Optional singular «product word» for a group, used only to auto-assign a
-- product to its group by name when the group name itself doesn't match (RU
-- plural quirks): group «Бруски» + match_word «брусок» → product «Брусок…».
-- Nullable, no backfill needed.
alter table groups add column match_word text;
