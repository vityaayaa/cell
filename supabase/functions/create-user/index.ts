import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Verify caller is authenticated admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )

    if (callerError || !callerData.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data: callerProfile, error: profileCheckError } = await supabaseAdmin
      .from('user_profiles')
      .select('role, is_active')
      .eq('id', callerData.user.id)
      .single()

    if (profileCheckError || !callerProfile || callerProfile.role !== 'admin' || !callerProfile.is_active) {
      return new Response(
        JSON.stringify({ error: 'Only active admins can create users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { name, email, role } = await req.json()

    if (!name || !email || !role) {
      return new Response(
        JSON.stringify({ error: 'name, email, and role are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (role !== 'admin' && role !== 'employee') {
      return new Response(
        JSON.stringify({ error: 'role must be admin or employee' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Invite user (sends email with magic link to set password)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
    )

    if (authError) throw authError

    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        name,
        role,
        is_active: true,
        created_by: callerData.user.id,
      })

    if (profileError) throw profileError

    return new Response(
      JSON.stringify({ user_id: authData.user.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
