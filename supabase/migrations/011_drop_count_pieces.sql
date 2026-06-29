-- Remove the per-product «учёт» toggle (count_pieces, added in 009).
-- Stock-entry mode is now fixed by type: unit & round = pieces, bulk = slider.
alter table products drop column if exists count_pieces;
