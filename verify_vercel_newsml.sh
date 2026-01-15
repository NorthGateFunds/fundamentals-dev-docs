#!/usr/bin/env bash
set -euo pipefail
URL="https://fundamentals-dev-docs.vercel.app/integrators/distribution-formats/newsml/index.html"
echo "Checking: $URL"
curl -sS "$URL" | grep -n "DEPLOY_MARK" || true
if curl -sS "$URL" | grep -q 'assets/app.js'; then
  echo "FAIL: app.js referenced"
  exit 1
fi
echo "OK: no app.js"
