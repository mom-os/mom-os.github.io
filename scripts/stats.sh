#!/usr/bin/env bash
# Read-only Mom.OS analytics from Supabase (service role or management API).
# Usage: from repo root, with planner-secrets sourced, or:
#   SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_REF=ctwtzshjpoykquhyiwwt ./scripts/stats.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f /workspace/planner-secrets/supabase.env ]]; then
  # shellcheck disable=SC1091
  set -a; source /workspace/planner-secrets/supabase.env; set +a
fi
: "${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN}"
: "${SUPABASE_PROJECT_REF:=ctwtzshjpoykquhyiwwt}"

python3 - "$SUPABASE_PROJECT_REF" <<'PY'
import json, os, sys, urllib.request
from datetime import datetime, timezone, timedelta

ref = sys.argv[1]
token = os.environ["SUPABASE_ACCESS_TOKEN"]
CT = timezone(timedelta(hours=-5))
now = datetime.now(CT)
print(f"Mom.OS stats  ·  as of {now.strftime('%Y-%m-%d %I:%M %p CT')}")
print("=" * 52)

def q(sql):
  req = urllib.request.Request(
    f"https://api.supabase.com/v1/projects/{ref}/database/query",
    data=json.dumps({"query": sql}).encode(),
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    method="POST",
  )
  with urllib.request.urlopen(req) as r:
    return json.loads(r.read().decode())

# Today + last 7 days in America/Chicago
sql = """
with bounds as (
  select
    (timezone('America/Chicago', now()))::date as today_ct,
    (timezone('America/Chicago', now()))::date - 6 as week_start_ct
),
ev as (
  select
    e.*,
    (e.created_at at time zone 'America/Chicago')::date as day_ct
  from public.analytics_events e
)
select
  (select count(distinct visitor_id) from ev, bounds where day_ct = today_ct and name = 'page_view') as visitors_today,
  (select count(*) from ev, bounds where day_ct = today_ct and name = 'page_view') as page_views_today,
  (select count(distinct visitor_id) from ev, bounds where day_ct >= week_start_ct and name = 'page_view') as visitors_7d,
  (select count(*) from ev, bounds where day_ct >= week_start_ct and name = 'page_view') as page_views_7d;
"""
try:
  row = q(sql)[0]
except Exception as e:
  print("ERROR querying analytics_events:", e)
  print("Has the migration been applied?")
  sys.exit(1)

print(f"Visitors today (unique):     {row['visitors_today']}")
print(f"Page views today:            {row['page_views_today']}")
print(f"Visitors last 7 days:        {row['visitors_7d']}")
print(f"Page views last 7 days:      {row['page_views_7d']}")
print()

print("Top referrers (7d, page_view)")
refs = q("""
select coalesce(nullif(referrer_host,''), '(direct/unknown)') as host, count(distinct visitor_id) as visitors
from public.analytics_events
where name = 'page_view'
  and (created_at at time zone 'America/Chicago')::date >= (timezone('America/Chicago', now()))::date - 6
group by 1
order by visitors desc
limit 10;
""")
if not refs:
  print("  (none yet)")
else:
  for r in refs:
    print(f"  {r['visitors']:>4}  {r['host']}")
print()

print("Top utm_source (7d, page_view)")
utms = q("""
select coalesce(nullif(utm_source,''), '(none)') as utm, count(distinct visitor_id) as visitors
from public.analytics_events
where name = 'page_view'
  and (created_at at time zone 'America/Chicago')::date >= (timezone('America/Chicago', now()))::date - 6
group by 1
order by visitors desc
limit 10;
""")
for r in utms or []:
  print(f"  {r['visitors']:>4}  {r['utm']}")
print()

print("Funnel (7d, unique visitors)")
funnel = q("""
with bounds as (
  select (timezone('America/Chicago', now()))::date - 6 as week_start_ct
),
ev as (
  select visitor_id, name
  from public.analytics_events, bounds
  where (created_at at time zone 'America/Chicago')::date >= week_start_ct
)
select
  count(distinct visitor_id) filter (where name = 'page_view') as page_view,
  count(distinct visitor_id) filter (where name = 'start_free_click') as start_free_click,
  count(distinct visitor_id) filter (where name = 'signin_code_sent') as signin_code_sent,
  count(distinct visitor_id) filter (where name = 'signup_complete') as signup_complete,
  count(distinct visitor_id) filter (where name = 'pro_sheet_open') as pro_sheet_open,
  count(distinct visitor_id) filter (where name = 'checkout_start') as checkout_start,
  count(distinct visitor_id) filter (where name = 'install_click') as install_click
from ev;
""")
f = funnel[0]
for k in ['page_view','start_free_click','signin_code_sent','signup_complete','pro_sheet_open','checkout_start','install_click']:
  print(f"  {k:20}  {f.get(k) or 0}")
print()
print("Tip: open https://mom-os.github.io/?utm_source=fb_page (or fb_group, boudoir, personal)")
PY
