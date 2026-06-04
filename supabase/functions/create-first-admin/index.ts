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

    const { data: existingProfiles, error: profilesError } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .limit(1)

    if (profilesError) throw profilesError

    const alreadyExists = !!(existingProfiles && existingProfiles.length > 0)

    // Parse body gracefully — check-only calls send {} with no fields
    const body = await req.json().catch(() => ({}))
    const { name, email, password } = body as Record<string, string>

    // Check-only call: missing credentials → just return existence flag
    if (!name || !email || !password) {
      return new Response(
        JSON.stringify({ alreadyExists }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Create call but admin already exists
    if (alreadyExists) {
      return new Response(
        JSON.stringify({ alreadyExists: true, error: 'Admin already exists. Use create-user instead.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) throw authError

    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        name,
        role: 'admin',
        is_active: true,
        created_by: null,
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
