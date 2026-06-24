-- 008 — flat shelf model
-- Replace the binary BSP model (is_first_child + split_ratio) with an N-ary
-- equal-split model addressed by child_index. Old shelf data is incompatible
-- with the new layout, so all shelf-dependent tables are truncated.

alter table cells add column if not exists child_index integer;
alter table cells drop column if exists is_first_child;
alter table cells drop column if exists split_ratio;

truncate table cells, shelves, stock_entries, sessions, orders, order_lines, checklist_entries restart identity cascade;
