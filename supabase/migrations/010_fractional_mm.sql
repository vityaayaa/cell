-- Allow fractional millimetres for product and cell dimensions (e.g. 12.5 mm).
-- Counts stay integer: capacity_override (pieces/packs) and pack_size (pieces).
-- integer → numeric widens the type; existing whole values are preserved.
alter table products
  alter column width_mm    type numeric using width_mm::numeric,
  alter column height_mm   type numeric using height_mm::numeric,
  alter column length_mm   type numeric using length_mm::numeric,
  alter column diameter_mm type numeric using diameter_mm::numeric;

alter table cells
  alter column width_mm           type numeric using width_mm::numeric,
  alter column height_mm          type numeric using height_mm::numeric,
  alter column computed_width_mm  type numeric using computed_width_mm::numeric,
  alter column computed_height_mm type numeric using computed_height_mm::numeric;
