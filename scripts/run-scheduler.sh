#!/usr/bin/env bash
set -euo pipefail

if [ -z "${SCHEDULER_ENDPOINT:-}" ]; then
  echo "SCHEDULER_ENDPOINT is required"
  exit 1
fi

if [ -n "${CRON_SECRET:-}" ]; then
  curl -sS -X POST "$SCHEDULER_ENDPOINT" -H "x-cron-secret: $CRON_SECRET"
else
  curl -sS -X POST "$SCHEDULER_ENDPOINT"
fi
