-- Materials
create table materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null,
  is_custom boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Products
create type product_type as enum ('unit', 'round', 'bulk');

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type product_type not null,
  material_id uuid not null references materials(id),
  pack_size integer not null check (pack_size > 0),
  width_mm integer,
  height_mm integer,
  length_mm integer,
  diameter_mm integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Shelves
create table shelves (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rows_count integer not null check (rows_count > 0),
  cols_count integer not null check (cols_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cells (BSP tree nodes)
create type split_direction_enum as enum ('H', 'V');

create table cells (
  id uuid primary key default gen_random_uuid(),
  shelf_id uuid not null references shelves(id) on delete cascade,
  parent_id uuid references cells(id) on delete cascade,
  split_direction split_direction_enum,
  is_first_child boolean,
  row_index integer,
  col_index integer,
  width_mm integer,
  height_mm integer,
  computed_width_mm integer not null,
  computed_height_mm integer not null,
  product_id uuid references products(id) on delete set null,
  capacity_override integer,
  rotation_allowed boolean not null default true,
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cells_shelf_id_idx on cells(shelf_id);
create index cells_parent_id_idx on cells(parent_id);
