-- Generic updated_at trigger function
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger materials_updated_at
  before update on materials
  for each row execute function set_updated_at();

create trigger products_updated_at
  before update on products
  for each row execute function set_updated_at();

create trigger shelves_updated_at
  before update on shelves
  for each row execute function set_updated_at();

create trigger cells_updated_at
  before update on cells
  for each row execute function set_updated_at();

create trigger user_profiles_updated_at
  before update on user_profiles
  for each row execute function set_updated_at();

create trigger sessions_updated_at
  before update on sessions
  for each row execute function set_updated_at();

create trigger orders_updated_at
  before update on orders
  for each row execute function set_updated_at();

create trigger order_lines_updated_at
  before update on order_lines
  for each row execute function set_updated_at();

create trigger checklist_entries_updated_at
  before update on checklist_entries
  for each row execute function set_updated_at();

-- Audit log writer (called from application-level triggers below)
create or replace function write_audit_log()
returns trigger
language plpgsql
security definer
as $$
begin
  if (TG_OP = 'DELETE') then
    insert into audit_log (actor_id, event_type, entity_type, entity_id, old_value, new_value)
    values (auth.uid(), 'DELETE', TG_TABLE_NAME, old.id, row_to_json(old)::jsonb, null);
    return old;
  elsif (TG_OP = 'UPDATE') then
    insert into audit_log (actor_id, event_type, entity_type, entity_id, old_value, new_value)
    values (auth.uid(), 'UPDATE', TG_TABLE_NAME, new.id, row_to_json(old)::jsonb, row_to_json(new)::jsonb);
    return new;
  elsif (TG_OP = 'INSERT') then
    insert into audit_log (actor_id, event_type, entity_type, entity_id, old_value, new_value)
    values (auth.uid(), 'INSERT', TG_TABLE_NAME, new.id, null, row_to_json(new)::jsonb);
    return new;
  end if;
  return null;
end;
$$;

-- Audit triggers on high-value tables
create trigger materials_audit
  after insert or update or delete on materials
  for each row execute function write_audit_log();

create trigger products_audit
  after insert or update or delete on products
  for each row execute function write_audit_log();

create trigger cells_audit
  after insert or update or delete on cells
  for each row execute function write_audit_log();

create trigger sessions_audit
  after insert or update or delete on sessions
  for each row execute function write_audit_log();

create trigger orders_audit
  after insert or update or delete on orders
  for each row execute function write_audit_log();

create trigger checklist_entries_audit
  after insert or update or delete on checklist_entries
  for each row execute function write_audit_log();
