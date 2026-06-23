-- Allow deleting a cell (e.g. when recreating the shelf) to cascade-remove its
-- stock readings. Order/checklist history is unaffected (it doesn't reference cells).
alter table stock_entries drop constraint stock_entries_cell_id_fkey;
alter table stock_entries add constraint stock_entries_cell_id_fkey
  foreign key (cell_id) references cells(id) on delete cascade;
