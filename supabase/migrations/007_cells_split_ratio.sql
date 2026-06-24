-- Visual divider position for the shelf builder (fraction of the first child,
-- 0..1; null = 0.5). Purely for the on-screen layout / "equalize"; capacity
-- still uses the real mm fields.
alter table cells add column if not exists split_ratio real;
