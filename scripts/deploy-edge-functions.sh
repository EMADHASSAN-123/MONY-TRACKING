#!/usr/bin/env bash
# نشر جميع Edge Functions — من جذر المشروع: bash scripts/deploy-edge-functions.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

for name in transactions expenses reports admin-users; do
  echo ""
  echo ">>> supabase functions deploy $name"
  supabase functions deploy "$name"
done

echo ""
echo "Done. All functions deployed."
