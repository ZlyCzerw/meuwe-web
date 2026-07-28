import { createClient } from 'npm:@supabase/supabase-js@2'

// Account deletion, App Store guideline 5.1.1(v).
//
// Unlike the push functions in this folder, this one is called BY THE USER from
// the app, so it authenticates with the caller's JWT instead of a shared webhook
// secret, and it needs CORS for the browser.
//
// Order is load-bearing:
//   1. archive + strip the account inside one database transaction,
//   2. only then delete the auth user.
// The other way round cannot work: event_messages.author_id has no ON DELETE
// rule, so a cascade from auth.users to profiles would hit that constraint and
// fail halfway.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  if (!jwt) return json({ error: 'unauthorized' }, 401)

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // The account is derived from the token, never from the request body: nobody
  // gets to delete somebody else's account by posting an id.
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
  const user = userData?.user
  if (userErr || !user) {
    console.error('[delete-account] token rejected:', userErr)
    return json({ error: 'unauthorized' }, 401)
  }

  // Identities disappear with the auth user, so whatever is needed later has to
  // be read now. More than one is possible (Google and Apple on one account);
  // both lists are kept in the same order rather than silently dropping one.
  const identities = user.identities ?? []
  const providers = identities.length
    ? identities.map(i => i.provider).join(',')
    : (user.app_metadata?.provider as string | undefined) ?? null
  const providerUids = identities.length
    ? identities.map(i => i.id).join(',')
    : null

  console.log(`[delete-account] user=${user.id} providers=${providers}`)

  const { error: rpcErr } = await admin.rpc('archive_and_anonymize_user', {
    p_user: user.id,
    p_email: user.email ?? null,
    p_provider: providers,
    p_provider_uid: providerUids,
    p_signed_up_at: user.created_at ?? null,
  })
  if (rpcErr) {
    // Nothing was committed — the account is untouched and the caller is told so.
    console.error('[delete-account] archive_and_anonymize_user failed:', rpcErr)
    return json({ error: 'archive_failed', detail: rpcErr.message }, 500)
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(user.id)
  if (delErr) {
    // The data is already stripped but the login still exists. This must never
    // be reported as success: the user would keep a sign-in that leads to an
    // empty, broken account.
    console.error('[delete-account] auth user deletion failed AFTER archiving:', user.id, delErr)
    return json({ error: 'auth_delete_failed', detail: delErr.message }, 500)
  }

  console.log(`[delete-account] done user=${user.id}`)
  return json({ ok: true })
})
