-- Retention для журнала аудита: держим только последний год.
--
-- Зачем: audit_log растёт вечно (запись на каждое действие). Год покрывает любой
-- практический спор «кто и когда менял», но не даёт таблице пухнуть годами.
-- На клиент и так грузятся только последние 500 записей (см. initialLoad) — это
-- про объём хранения на сервере, а не про скорость.

create extension if not exists pg_cron;

-- Функция-чистильщик: удаляет записи старше 1 года. SECURITY DEFINER, чтобы
-- работать в обход RLS (у audit_log нет DELETE-политики для клиента — и не надо).
create or replace function purge_old_audit_log()
returns void
language sql
security definer
set search_path = public
as $$
  delete from audit_log where created_at < now() - interval '1 year';
$$;

-- Ежедневно в 03:00 UTC. Идемпотентно: пересоздаём job, если уже есть.
select cron.unschedule('purge_old_audit_log')
  where exists (select 1 from cron.job where jobname = 'purge_old_audit_log');

select cron.schedule(
  'purge_old_audit_log',
  '0 3 * * *',
  $$select public.purge_old_audit_log()$$
);
