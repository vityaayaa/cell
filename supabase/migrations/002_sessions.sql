-- User profiles (extends auth.users)
create type user_role as enum ('admin', 'employee');

create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role user_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references user_profiles(id),
  updated_at timestamptz not null default now()
);

-- Sessions
create type session_status as enum ('sweeping', 'ordering', 'fulfilling', 'completed', 'abandoned');

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status session_status not null default 'sweeping',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sessions_user_id_idx on sessions(user_id);
create index sessions_status_idx on sessions(status);

-- Stock entries (no updated_at — append-only log)
create table stock_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  cell_id uuid not null references cells(id),
  user_id uuid not null references auth.users(id),
  value integer not null check (value >= 0),
  created_at timestamptz not null default now()
);

create index stock_entries_session_id_idx on stock_entries(session_id);
create index stock_entries_cell_id_idx on stock_entries(cell_id);

-- Orders
create table orders (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  updated_at timestamptz not null default now()
);

create index orders_session_id_idx on orders(session_id);

-- Order lines
create table order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity_packs integer not null check (quantity_packs >= 0),
  quantity_units integer not null check (quantity_units >= 0),
  deficit_units integer,
  is_manual boolean not null default false,
  is_boundary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index order_lines_order_id_idx on order_lines(order_id);

-- Checklist entries
create type checklist_status as enum ('pending', 'done', 'unavailable');

create table checklist_entries (
  id uuid primary key default gen_random_uuid(),
  order_line_id uuid not null references order_lines(id) on delete cascade,
  status checklist_status not null default 'pending',
  actual_packs integer,
  updated_at timestamptz not null default now(),
  user_id uuid references auth.users(id)
);

create index checklist_entries_order_line_id_idx on checklist_entries(order_line_id);

-- Audit log
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references user_profiles(id),
  event_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_actor_id_idx on audit_log(actor_id);
create index audit_log_entity_id_idx on audit_log(entity_id);
create index audit_log_created_at_idx on audit_log(created_at);
