-- ПРЕДУПРЕЖДЕНИЕ (на будущее): `add column group_id not null references ...`
-- БЕЗ default упадёт на НЕПУСТОЙ таблице products — существующим строкам нечем
-- заполнить обязательную колонку. Здесь это сработало только потому, что таблица
-- products была пуста на момент миграции. Для breaking-миграций на непустых
-- таблицах нужна data-migration стратегия: сначала добавить колонку nullable →
-- backfill значениями → только потом set not null. НЕ повторять этот паттерн
-- вслепую на живых данных.

-- Product groups (вид товара: Брусок, Наличник, Вагонка…). Like materials but
-- no colour. Assigning a product to a group is mandatory.
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table groups enable row level security;

create policy groups_select on groups for select to authenticated using (true);
create policy groups_insert on groups for insert to authenticated with check (is_admin());
create policy groups_update on groups for update to authenticated using (is_admin());
create policy groups_delete on groups for delete to authenticated using (is_admin());

create trigger groups_updated_at
  before update on groups
  for each row execute function set_updated_at();

-- products.group_id — mandatory. ON DELETE RESTRICT: the DB itself refuses to
-- drop a group that still has products, so it can never orphan a product.
alter table products
  add column group_id uuid not null references groups(id) on delete restrict;

create index products_group_id_idx on products(group_id);
