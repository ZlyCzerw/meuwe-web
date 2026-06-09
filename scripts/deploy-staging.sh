#!/bin/bash
set -e

# Staging Supabase project ref (not a secret — it's a project ID)
STAGING_REF="ujzmivdgibnnncmoqoyb"

echo "==> Linking to staging..."
supabase link --project-ref "$STAGING_REF"

echo "==> Pushing migrations to staging..."
supabase db push --linked

echo "==> Deploying edge functions to staging..."
supabase functions deploy push-new-message --project-ref "$STAGING_REF"
supabase functions deploy push-new-event --project-ref "$STAGING_REF"
supabase functions deploy push-event-start --project-ref "$STAGING_REF"
supabase functions deploy push-event-updated --project-ref "$STAGING_REF"

echo "==> Relinking to production..."
supabase link --project-ref bcfhsbnbvsuxsiwmeway

echo "==> Done. Staging is up to date."
