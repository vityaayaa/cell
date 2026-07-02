-- Аудит переезжает на клиент.
--
-- Почему: клиент пишет ЧЕЛОВЕКОЧИТАЕМЫЕ события (product_created,
-- material_updated, session_started и т.п.) с осмысленными old_value/new_value —
-- ровно то, что умеет красиво показывать экран истории (AuditPage,
-- formatAuditEvent). Серверные триггеры аудита писали СУХИЕ INSERT/UPDATE/DELETE
-- с дампами строк, которые экран показать по-человечески не может, и дублировали
-- клиентскую запись. Поэтому: 1) разрешаем клиенту вставлять в audit_log
-- (только от своего имени); 2) убираем серверные триггеры и функцию-писатель.

-- 1) INSERT-политика: любой authenticated может вставить запись аудита, но
--    только с actor_id = auth.uid() (нельзя писать от чужого имени).
create policy "audit_log_insert" on audit_log for insert to authenticated
  with check (actor_id = auth.uid());

-- 2) Убираем серверные триггеры аудита (см. 004_triggers.sql:73-95).
drop trigger if exists materials_audit on materials;
drop trigger if exists products_audit on products;
drop trigger if exists cells_audit on cells;
drop trigger if exists sessions_audit on sessions;
drop trigger if exists orders_audit on orders;
drop trigger if exists checklist_entries_audit on checklist_entries;

-- Функция-писатель больше не нужна. cascade на случай, если какой-то триггер
-- остался незадропленным.
drop function if exists write_audit_log() cascade;
