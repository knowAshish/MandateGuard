#!/usr/bin/env bash
set -euo pipefail

# MandateGuard Canton DevNet DAR Deployment Script
# Uploads the compiled Daml package (mandateguard-0.1.0.dar) to the authorized Canton participant node.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DAR_PATH="${PROJECT_ROOT}/daml/main/.daml/dist/mandateguard-0.1.0.dar"

PARTICIPANT_URL="${CANTON_LEDGER_BASE_URL:-http://127.0.0.1:7575}"
TOKEN="${CANTON_LEDGER_TOKEN:-}"

echo "=========================================================="
echo "MandateGuard: Deploying Daml Package to Canton Participant"
echo "=========================================================="
echo "Target Participant: ${PARTICIPANT_URL}"
echo "DAR File:           ${DAR_PATH}"

if [ ! -f "${DAR_PATH}" ]; then
  echo "Error: DAR file not found at ${DAR_PATH}."
  echo "Building DAR now via 'dpm build'..."
  cd "${PROJECT_ROOT}/daml/main"
  dpm build
fi

echo "Verifying participant connectivity..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${PARTICIPANT_URL}/livez" || echo "000")

if [ "${HTTP_STATUS}" != "200" ]; then
  echo "Error: Unable to connect to Canton participant at ${PARTICIPANT_URL} (HTTP ${HTTP_STATUS})."
  echo "Please verify that the participant node is running and accessible."
  exit 1
fi

echo "Uploading package to participant Ledger API..."
AUTH_HEADER=""
if [ -n "${TOKEN}" ]; then
  AUTH_HEADER="Authorization: Bearer ${TOKEN}"
fi

UPLOAD_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Content-Type: application/octet-stream" \
  ${AUTH_HEADER:+-H "${AUTH_HEADER}"} \
  --data-binary @"${DAR_PATH}" \
  "${PARTICIPANT_URL}/v2/packages")

HTTP_CODE=$(echo "${UPLOAD_RESPONSE}" | tail -n 1)
BODY=$(echo "${UPLOAD_RESPONSE}" | sed '$d')

if [ "${HTTP_CODE}" = "200" ] || [ "${HTTP_CODE}" = "204" ]; then
  echo "Package uploaded successfully!"
  echo "Response: ${BODY}"
else
  echo "Upload returned HTTP ${HTTP_CODE}: ${BODY}"
fi

echo "Deployment complete."
