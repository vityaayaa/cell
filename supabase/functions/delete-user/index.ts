import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401)

    const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (callerError || !callerData.user) return json({ error: 'Invalid token' }, 401)

    const { data: callerProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('role, is_active')
      .eq('id', callerData.user.id)
      .single()

    if (!callerProfile || callerProfile.role !== 'admin' || !callerProfile.is_active) {
      return json({ error: 'Only active admins can delete users' }, 403)
    }

    const { userId } = await req.json()
    if (!userId) return json({ error: 'userId is required' }, 400)

    if (userId === callerData.user.id) {
      return json({ ok: false, reason: 'self' })
    }

    // Full delete: remove everything tied to this user so the account can be
    // erased regardless of history. Service role bypasses RLS.
    // Deleting the user's sessions cascades their orders → order_lines →
    // checklist_entries and stock_entries.
    await supabaseAdmin.from('sessions').delete().eq('user_id', userId)
    await supabaseAdmin.from('stock_entries').delete().eq('user_id', userId)
    // Detach remaining references that would otherwise block the profile cascade.
    await supabaseAdmin.from('checklist_entries').update({ user_id: null }).eq('user_id', userId)
    await supabaseAdmin.from('audit_log').update({ actor_id: null }).eq('actor_id', userId)
    await supabaseAdmin.from('user_profiles').update({ created_by: null }).eq('created_by', userId)

    // Hard delete the auth user — cascades the user_profiles row.
    const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (delError) throw delError

    return json({ ok: true })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
