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

    // Hard delete the auth user — cascades the user_profiles row. If the user has
    // history (sessions / stock / checklist reference them), the FK blocks it.
    const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (delError) {
      const msg = (delError.message || '').toLowerCase()
      if (msg.includes('foreign key') || msg.includes('violates') || msg.includes('constraint')) {
        return json({ ok: false, reason: 'has_history' })
      }
      throw delError
    }

    return json({ ok: true })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
