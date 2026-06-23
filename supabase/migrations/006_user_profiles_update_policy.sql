-- Admins can update profiles (e.g. block/unblock). Without this, client-side
-- updates were silently denied by RLS and reverted on the next sync.
-- Full deletion (removing the auth user + login) is done via the delete-user
-- Edge Function with the service role, which bypasses RLS.
create policy "user_profiles_update" on user_profiles for update to authenticated
  using (is_admin()) with check (is_admin());
