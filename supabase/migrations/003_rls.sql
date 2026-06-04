-- Helper: check if current user is an active admin
create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from user_profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  )
$$;

-- Enable RLS on all tables
alter table materials enable row level security;
alter table products enable row level security;
alter table shelves enable row level security;
alter table cells enable row level security;
alter table user_profiles enable row level security;
alter table sessions enable row level security;
alter table stock_entries enable row level security;
alter table orders enable row level security;
alter table order_lines enable row level security;
alter table checklist_entries enable row level security;
alter table audit_log enable row level security;

-- materials: read authenticated, write admin
create policy "materials_select" on materials for select to authenticated using (true);
create policy "materials_insert" on materials for insert to authenticated with check (is_admin());
create policy "materials_update" on materials for update to authenticated using (is_admin());
create policy "materials_delete" on materials for delete to authenticated using (is_admin());

-- products: same
create policy "products_select" on products for select to authenticated using (true);
create policy "products_insert" on products for insert to authenticated with check (is_admin());
create policy "products_update" on products for update to authenticated using (is_admin());
create policy "products_delete" on products for delete to authenticated using (is_admin());

-- shelves: same
create policy "shelves_select" on shelves for select to authenticated using (true);
create policy "shelves_insert" on shelves for insert to authenticated with check (is_admin());
create policy "shelves_update" on shelves for update to authenticated using (is_admin());
create policy "shelves_delete" on shelves for delete to authenticated using (is_admin());

-- cells: same
create policy "cells_select" on cells for select to authenticated using (true);
create policy "cells_insert" on cells for insert to authenticated with check (is_admin());
create policy "cells_update" on cells for update to authenticated using (is_admin());
create policy "cells_delete" on cells for delete to authenticated using (is_admin());

-- user_profiles: read by any authenticated; insert/update/delete via service role (Edge Functions) only
create policy "user_profiles_select" on user_profiles for select to authenticated using (true);

-- sessions: own + admin
create policy "sessions_select" on sessions for select to authenticated
  using (user_id = auth.uid() or is_admin());
create policy "sessions_insert" on sessions for insert to authenticated
  with check (user_id = auth.uid());
create policy "sessions_update" on sessions for update to authenticated
  using (user_id = auth.uid() or is_admin());

-- stock_entries: own + admin
create policy "stock_entries_select" on stock_entries for select to authenticated
  using (user_id = auth.uid() or is_admin());
create policy "stock_entries_insert" on stock_entries for insert to authenticated
  with check (user_id = auth.uid());

-- orders: via session ownership
create policy "orders_select" on orders for select to authenticated
  using (
    exists (
      select 1 from sessions
      where sessions.id = orders.session_id
        and (sessions.user_id = auth.uid() or is_admin())
    )
  );
create policy "orders_insert" on orders for insert to authenticated
  with check (
    exists (
      select 1 from sessions
      where sessions.id = session_id
        and sessions.user_id = auth.uid()
    )
  );
create policy "orders_update" on orders for update to authenticated
  using (
    exists (
      select 1 from sessions
      where sessions.id = orders.session_id
        and sessions.user_id = auth.uid()
    )
  );

-- order_lines: via orders → sessions
create policy "order_lines_select" on order_lines for select to authenticated
  using (
    exists (
      select 1 from orders
      join sessions on sessions.id = orders.session_id
      where orders.id = order_lines.order_id
        and (sessions.user_id = auth.uid() or is_admin())
    )
  );
create policy "order_lines_insert" on order_lines for insert to authenticated
  with check (
    exists (
      select 1 from orders
      join sessions on sessions.id = orders.session_id
      where orders.id = order_id
        and sessions.user_id = auth.uid()
    )
  );
create policy "order_lines_update" on order_lines for update to authenticated
  using (
    exists (
      select 1 from orders
      join sessions on sessions.id = orders.session_id
      where orders.id = order_lines.order_id
        and sessions.user_id = auth.uid()
    )
  );
create policy "order_lines_delete" on order_lines for delete to authenticated
  using (
    exists (
      select 1 from orders
      join sessions on sessions.id = orders.session_id
      where orders.id = order_lines.order_id
        and sessions.user_id = auth.uid()
    )
  );

-- checklist_entries: via order_lines → orders → sessions
create policy "checklist_entries_select" on checklist_entries for select to authenticated
  using (
    exists (
      select 1 from order_lines
      join orders on orders.id = order_lines.order_id
      join sessions on sessions.id = orders.session_id
      where order_lines.id = checklist_entries.order_line_id
        and (sessions.user_id = auth.uid() or is_admin())
    )
  );
create policy "checklist_entries_insert" on checklist_entries for insert to authenticated
  with check (
    exists (
      select 1 from order_lines
      join orders on orders.id = order_lines.order_id
      join sessions on sessions.id = orders.session_id
      where order_lines.id = order_line_id
        and sessions.user_id = auth.uid()
    )
  );
create policy "checklist_entries_update" on checklist_entries for update to authenticated
  using (
    exists (
      select 1 from order_lines
      join orders on orders.id = order_lines.order_id
      join sessions on sessions.id = orders.session_id
      where order_lines.id = checklist_entries.order_line_id
        and sessions.user_id = auth.uid()
    )
  );

-- audit_log: admin read only, no direct write
create policy "audit_log_select" on audit_log for select to authenticated using (is_admin());
