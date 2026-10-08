#!/usr/bin/env bash
# Apply Mom.OS OTP email templates via Management API.
# Free-tier projects (created after 2026-06-01) require custom SMTP before templates can be edited.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN}"
: "${SUPABASE_PROJECT_REF:?Set SUPABASE_PROJECT_REF}"
API="https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/config/auth"
MAGIC=$(cat "$ROOT/supabase/email-templates/magic_link.html")
CONFIRM=$(cat "$ROOT/supabase/email-templates/confirmation.html")
python3 - "$API" "$MAGIC" "$CONFIRM" <<'PY'
import json, os, sys, urllib.request, urllib.error
api, magic, confirm = sys.argv[1], sys.argv[2], sys.argv[3]
token = os.environ["SUPABASE_ACCESS_TOKEN"]
payload = {
  "mailer_otp_length": 6,
  "mailer_subjects_magic_link": "Your Mom.OS sign-in code",
  "mailer_templates_magic_link_content": magic,
  "mailer_subjects_confirmation": "Your Mom.OS sign-in code",
  "mailer_templates_confirmation_content": confirm,
}
req = urllib.request.Request(api, data=json.dumps(payload).encode(),
  headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, method="PATCH")
try:
  with urllib.request.urlopen(req) as r:
    d = json.loads(r.read().decode())
  print("templates ok; otp_length=", d.get("mailer_otp_length"))
  print("magic subject:", d.get("mailer_subjects_magic_link"))
  print("has Token in magic:", "{{ .Token }}" in (d.get("mailer_templates_magic_link_content") or ""))
except urllib.error.HTTPError as e:
  body = e.read().decode()
  print("FAIL", e.code, body[:500], file=sys.stderr)
  if "free tier" in body.lower() or "custom SMTP" in body.lower():
    print("HINT: Configure custom SMTP (Resend/Postmark/etc.) on this project, then re-run this script.", file=sys.stderr)
  sys.exit(1)
PY
