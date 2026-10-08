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
API="https://api.supabase.com/v1"

api_get() { curl -sS -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" -H "Content-Type: application/json" "$@"; }
api_json() { curl -sS -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" -H "Content-Type: application/json" "$@"; }

echo "Listing organizations…"
ORGS_JSON=$(api_get "$API/organizations")
ORG_ID=$(printf '%s' "$ORGS_JSON" | python3 -c '
import json,sys
arr=json.load(sys.stdin)
arr=arr if isinstance(arr,list) else []
for o in arr:
  if o.get("name")=="Mom.OS":
    print(o["id"]); raise SystemExit
print(arr[0]["id"] if arr else "")
')

if [[ -z "$ORG_ID" ]]; then
  echo "No org — creating Mom.OS…"
  ORG_JSON=$(api_json -X POST "$API/organizations" -d '{"name":"Mom.OS"}')
  ORG_ID=$(printf '%s' "$ORG_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("id",""))')
fi
echo "Org id: ${ORG_ID:0:8}…"

PROJECTS_JSON=$(api_get "$API/projects")
PROJECT_REF=$(printf '%s' "$PROJECTS_JSON" | python3 -c '
import json,sys
arr=json.load(sys.stdin)
arr=arr if isinstance(arr,list) else []
for p in arr:
  if p.get("name")=="momos":
    print(p.get("id") or ""); break
')

DB_PASS=$(python3 -c 'import secrets,string; a=string.ascii_letters+string.digits; print("Mo"+"".join(secrets.choice(a) for _ in range(24))+"!9")')

if [[ -z "$PROJECT_REF" ]]; then
  echo "Creating project momos in us-east-1…"
  CREATE_BODY=$(ORG_ID="$ORG_ID" DB_PASS="$DB_PASS" python3 -c 'import json,os; print(json.dumps({"name":"momos","organization_id":os.environ["ORG_ID"],"db_pass":os.environ["DB_PASS"],"region":"us-east-1"}))')
  CREATE_JSON=$(api_json -X POST "$API/projects" -d "$CREATE_BODY")
  PROJECT_REF=$(printf '%s' "$CREATE_JSON" | python3 -c '
import json,sys
d=json.load(sys.stdin)
ref=d.get("id") or ""
if not ref:
  # print safe error fields only
  safe={k:d[k] for k in d if "pass" not in k.lower() and "secret" not in k.lower() and "key" not in k.lower()}
  print("", file=sys.stderr)
  print(json.dumps(safe)[:1000], file=sys.stderr)
  sys.exit(1)
print(ref)
') || {
    echo "API create failed; trying CLI…"
    CREATE_OUT=$(supabase projects create momos --org-id "$ORG_ID" --db-password "$DB_PASS" --region us-east-1 --output json)
    PROJECT_REF=$(printf '%s' "$CREATE_OUT" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("id") or d.get("ref") or "")')
  }
  echo "Created project ${PROJECT_REF:0:8}…"
else
  echo "Project momos exists (${PROJECT_REF:0:8}…)."
  if [[ -f "$SECRETS_FILE" ]]; then
    set -a; # shellcheck disable=SC1090
    source "$SECRETS_FILE"; set +a
    DB_PASS="${SUPABASE_DB_PASSWORD:-$DB_PASS}"
  fi
fi

echo "Waiting for project healthy…"
for i in $(seq 1 90); do
  ST=$(api_get "$API/projects/$PROJECT_REF" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("status") or "")' 2>/dev/null || true)
  echo "  [$i] status=${ST:-unknown}"
  [[ "$ST" == "ACTIVE_HEALTHY" || "$ST" == "ACTIVE" ]] && break
  sleep 5
done

URL="https://${PROJECT_REF}.supabase.co"

echo "Linking + pushing DB…"
supabase link --project-ref "$PROJECT_REF" --password "$DB_PASS" --yes 2>&1 | tail -30 || true
supabase db push --linked --yes 2>&1 | tee /tmp/momos-db-push.log | tail -50

echo "Fetching API keys…"
KEYS_JSON=$(api_get "$API/projects/$PROJECT_REF/api-keys")
ANON=$(printf '%s' "$KEYS_JSON" | python3 -c '
import json,sys
arr=json.load(sys.stdin)
arr=arr if isinstance(arr,list) else []
for k in arr:
  name=(k.get("name") or k.get("id") or "").lower()
  if name in ("anon","anonymous"):
    print(k.get("api_key") or k.get("key") or ""); break
')
SERVICE=$(printf '%s' "$KEYS_JSON" | python3 -c '
import json,sys
arr=json.load(sys.stdin)
arr=arr if isinstance(arr,list) else []
for k in arr:
  name=(k.get("name") or k.get("id") or "").lower()
  if "service" in name:
    print(k.get("api_key") or k.get("key") or ""); break
')

if [[ -z "$ANON" || -z "$SERVICE" ]]; then
  KEYS_JSON=$(supabase projects api-keys --project-ref "$PROJECT_REF" --output json)
  ANON=$(printf '%s' "$KEYS_JSON" | python3 -c 'import json,sys; arr=json.load(sys.stdin); arr=arr if isinstance(arr,list) else []; print(next((k.get("api_key") or k.get("key") or "") for k in arr if (k.get("name") or "").lower() in ("anon","anonymous")),"")')
  SERVICE=$(printf '%s' "$KEYS_JSON" | python3 -c 'import json,sys; arr=json.load(sys.stdin); arr=arr if isinstance(arr,list) else []; print(next((k.get("api_key") or k.get("key") or "") for k in arr if "service" in (k.get("name") or "").lower()),"")')
fi

umask 077
cat > "$SECRETS_FILE" <<EOSECRETS
SUPABASE_PROJECT_REF=$PROJECT_REF
SUPABASE_URL=$URL
SUPABASE_ANON_KEY=$ANON
SUPABASE_SERVICE_ROLE_KEY=$SERVICE
SUPABASE_DB_PASSWORD=$DB_PASS
EOSECRETS
chmod 600 "$SECRETS_FILE"

cat > "$ROOT/js/config.js" <<EOCFG
// Public Supabase client config (anon key is safe to ship; never put the service role here).
export const SUPABASE_URL = '$URL';
export const SUPABASE_ANON_KEY = '$ANON';
export const SITE_URL = 'https://jblanchard87.github.io/momos';
export const isSupabaseConfigured = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);
EOCFG

echo "Configuring auth URLs + OTP length…"
api_json -X PATCH "$API/projects/$PROJECT_REF/config/auth" -d '{
  "site_url": "https://jblanchard87.github.io/momos/",
  "uri_allow_list": "https://jblanchard87.github.io/momos/**,http://127.0.0.1:8765/**,http://localhost:8765/**,http://127.0.0.1:8767/**,http://localhost:8767/**",
  "external_email_enabled": true,
  "mailer_autoconfirm": false,
  "mailer_otp_length": 6
}' | python3 -c 'import sys,json
raw=sys.stdin.read()
try:
 d=json.loads(raw)
 print("auth ok otp_length=", d.get("mailer_otp_length"))
except Exception:
 print("auth response", raw[:300])
' || echo "Warning: auth PATCH issue"

echo "Applying OTP email templates (needs custom SMTP on free tier)…"
SUPABASE_PROJECT_REF="$PROJECT_REF" bash "$ROOT/scripts/apply-auth-email-templates.sh" || echo "Warning: email templates not applied (configure custom SMTP, then re-run apply-auth-email-templates.sh)"

echo "Deploying ics + pair functions…"
supabase functions deploy ics --project-ref "$PROJECT_REF" --yes 2>&1 | tee /tmp/momos-fn-deploy.log | tail -40
supabase functions deploy pair --project-ref "$PROJECT_REF" --yes 2>&1 | tee /tmp/momos-pair-deploy.log | tail -40

echo "Function secrets: SUPABASE_* are platform-injected; skipping custom set."

echo "Provision complete."
echo "  Project: $PROJECT_REF"
echo "  Region: us-east-1"
echo "  URL: $URL"
echo "  Secrets: $SECRETS_FILE"
echo "  Anon key length: ${#ANON}"
echo "  Service key length: ${#SERVICE}"
