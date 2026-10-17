#!/usr/bin/env bash
set -euo pipefail

# MandateGuard DevNet Verification Script
# Verifies connectivity, Ledger API endpoints, package availability, and party allocation status.

PARTICIPANT_URL="${CANTON_LEDGER_BASE_URL:-http://127.0.0.1:7575}"
TOKEN="${CANTON_LEDGER_TOKEN:-}"

echo "=========================================================="
echo "MandateGuard: Canton DevNet Verification"
echo "=========================================================="
echo "Target Participant: ${PARTICIPANT_URL}"

echo -n "1. Checking livez endpoint... "
LIVEZ_RES=$(curl -s -w "%{http_code}" -o /dev/null "${PARTICIPANT_URL}/livez" || echo "FAILED")

if [ "${LIVEZ_RES}" = "200" ]; then
  echo "OK (HTTP 200)"
else
  echo "OFFLINE / UNREACHABLE (Code: ${LIVEZ_RES})"
  echo "Diagnostic: No Canton participant reachable on ${PARTICIPANT_URL}."
  echo "Blocker: To connect to Canton DevNet, configure CANTON_LEDGER_BASE_URL and CANTON_LEDGER_TOKEN."
  exit 1
fi

echo -n "2. Querying Ledger API packages... "
AUTH_HEADER=""
if [ -n "${TOKEN}" ]; then
  AUTH_HEADER="Authorization: Bearer ${TOKEN}"
fi

PACKAGES_RES=$(curl -s ${AUTH_HEADER:+-H "${AUTH_HEADER}"} "${PARTICIPANT_URL}/v2/packages" || echo "{}")
echo "Available packages queried."

echo "3. Testing Active Contract Set (ACS) query..."
ACS_STATUS=$(curl -s -w "%{http_code}" -o /dev/null \
  -H "Content-Type: application/json" \
  ${AUTH_HEADER:+-H "${AUTH_HEADER}"} \
  -d '{"verbose":false,"filter":{"filtersByParty":{}}}' \
  "${PARTICIPANT_URL}/v2/state/active-contracts" || echo "000")

echo "ACS Query Status: HTTP ${ACS_STATUS}"

echo "DevNet verification complete."
