#!/usr/bin/env bash
# Provision Mom.OS Supabase project. Requires SUPABASE_ACCESS_TOKEN in env.
# Never echoes the token. Writes secrets to /workspace/planner-secrets/supabase.env
set -euo pipefail
PATH="/workspace/bin:$PATH"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SECRETS_DIR="/workspace/planner-secrets"
SECRETS_FILE="$SECRETS_DIR/supabase.env"
cd "$ROOT"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "SUPABASE_ACCESS_TOKEN is not set. Skipping provision."
  exit 2
fi

mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"

# Login (token via env — supabase CLI reads SUPABASE_ACCESS_TOKEN)
# Prefer non-interactive login
if ! supabase orgs list --output json >/dev/null 2>&1; then
  echo "$SUPABASE_ACCESS_TOKEN" | supabase login --token "$SUPABASE_ACCESS_TOKEN" >/dev/null
fi

ORGS_JSON=$(supabase orgs list --output json)
ORG_ID=$(python3 -c "import json,sys; d=json.load(sys.stdin); print((d[0]['id'] if isinstance(d,list) else d['id']) if d else '')" <<<"$ORGS_JSON")
if [[ -z "$ORG_ID" ]]; then
  # try alternate shape
  ORG_ID=$(python3 -c "import json,sys; d=json.load(sys.stdin); 
arr=d if isinstance(d,list) else d.get('organizations') or d.get('items') or []
print(arr[0].get('id') or arr[0].get('org_id') or '')" <<<"$ORGS_JSON")
fi
echo "Using org: ${ORG_ID:0:8}…"

# Reuse existing project named momos if present
PROJECTS=$(supabase projects list --output json)
PROJECT_REF=$(python3 -c "
import json,sys
d=json.load(sys.stdin)
arr=d if isinstance(d,list) else d.get('projects') or []
for p in arr:
  name=p.get('name') or p.get('project_name') or ''
  ref=p.get('id') or p.get('ref') or p.get('project_ref') or ''
  if name=='momos':
    print(ref); break
" <<<"$PROJECTS")

DB_PASS=$(python3 -c "import secrets,string; a=string.ascii_letters+string.digits; print('Mo'+''.join(secrets.choice(a) for _ in range(24))+'!9')")

if [[ -z "$PROJECT_REF" ]]; then
  echo "Creating project momos…"
  # region: east-us / us-east-1 naming varies by CLI
  CREATE_OUT=$(supabase projects create momos --org-id "$ORG_ID" --db-password "$DB_PASS" --region us-east-1 --output json 2>&1) || {
    # try alternate region slug
    CREATE_OUT=$(supabase projects create momos --org-id "$ORG_ID" --db-password "$DB_PASS" --region East US (N. Virginia) --output json 2>&1) || true
  }
  PROJECT_REF=$(python3 -c "import json,sys,re
raw=sys.stdin.read()
try:
  d=json.loads(raw)
  print(d.get('id') or d.get('ref') or d.get('project_ref') or '')
except Exception:
  m=re.search(r'[a-z]{20}', raw)
  print(m.group(0) if m else '')
" <<<"$CREATE_OUT")
  echo "Created project ref ${PROJECT_REF:0:8}…"
  # wait for project healthy
  for i in $(seq 1 60); do
    sleep 5
    STATUS=$(supabase projects list --output json | python3 -c "import json,sys; d=json.load(sys.stdin); arr=d if isinstance(d,list) else [];
print(next((p.get('status') or p.get('health') or '') for p in arr if (p.get('id') or p.get('ref'))==sys.argv[1]),'')" "$PROJECT_REF" 2>/dev/null || true)
    echo "  status: ${STATUS:-pending}"
    [[ "$STATUS" == "ACTIVE_HEALTHY" || "$STATUS" == "ACTIVE" ]] && break
  done
else
  echo "Project momos already exists (${PROJECT_REF:0:8}…)."
  # keep existing password unknown — generate new only if we create; load from secrets if present
  if [[ -f "$SECRETS_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$SECRETS_FILE"
    DB_PASS="${SUPABASE_DB_PASSWORD:-$DB_PASS}"
  fi
fi

supabase link --project-ref "$PROJECT_REF" --password "$DB_PASS" --yes >/dev/null 2>&1 || \
  supabase link --project-ref "$PROJECT_REF" --yes

echo "Pushing migrations…"
supabase db push --yes

echo "Deploying edge function ics…"
supabase functions deploy ics --project-ref "$PROJECT_REF" --yes

# API keys
KEYS=$(supabase projects api-keys --project-ref "$PROJECT_REF" --output json)
ANON=$(python3 -c "import json,sys; d=json.load(sys.stdin); arr=d if isinstance(d,list) else [];
print(next((k.get('api_key') or k.get('key') or '') for k in arr if (k.get('name') or k.get('id') or '').lower() in ('anon','anonymous')), '')" <<<"$KEYS")
SERVICE=$(python3 -c "import json,sys; d=json.load(sys.stdin); arr=d if isinstance(d,list) else [];
print(next((k.get('api_key') or k.get('key') or '') for k in arr if 'service' in (k.get('name') or k.get('id') or '').lower()), '')" <<<"$KEYS")
URL="https://${PROJECT_REF}.supabase.co"

# Write secrets (never print values)
umask 077
cat > "$SECRETS_FILE" << EOSECRETS
SUPABASE_PROJECT_REF=$PROJECT_REF
SUPABASE_URL=$URL
SUPABASE_ANON_KEY=$ANON
SUPABASE_SERVICE_ROLE_KEY=$SERVICE
SUPABASE_DB_PASSWORD=$DB_PASS
EOSECRETS
chmod 600 "$SECRETS_FILE"

# Public config for the app (anon only)
cat > "$ROOT/js/config.js" << EOCFG
// Public Supabase client config (anon key is safe to ship; never put the service role here).
export const SUPABASE_URL = '$URL';
export const SUPABASE_ANON_KEY = '$ANON';
export const SITE_URL = 'https://jblanchard87.github.io/momos';
export const isSupabaseConfigured = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);
EOCFG

# Auth URL config via management API
curl -sS -X PATCH "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"site_url":"https://jblanchard87.github.io/momos/","uri_allow_list":"https://jblanchard87.github.io/momos/**,http://127.0.0.1:8765/**,http://localhost:8765/**"}' \
  >/dev/null || echo "Warning: could not PATCH auth config (set Site URL in dashboard if needed)"

# Set function secrets
supabase secrets set --project-ref "$PROJECT_REF" \
  SUPABASE_URL="$URL" \
  SUPABASE_SERVICE_ROLE_KEY="$SERVICE" >/dev/null

echo "Provision complete."
echo "  Project: $PROJECT_REF"
echo "  URL: $URL"
echo "  Secrets: $SECRETS_FILE (chmod 600)"
echo "  App config: js/config.js (anon key only)"
