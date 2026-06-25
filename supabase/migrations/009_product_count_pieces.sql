-- Per-product «учёт» mode for round & bulk products.
-- false (default) = slider mode (fill meter); true = поштучно (count buttons).
-- Only meaningful for type 'round' and 'bulk'; 'unit' is always counted in pieces.
alter table products add column if not exists count_pieces boolean not null default false;
