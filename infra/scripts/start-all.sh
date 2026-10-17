#!/usr/bin/env bash
set -euo pipefail

# MandateGuard Full Stack Launcher
# Starts the MandateGuard API backend and React Operations Console

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "=========================================================="
echo "MandateGuard: Launching Full Stack Control Plane"
echo "=========================================================="

cd "${PROJECT_ROOT}"

echo "Building all packages..."
npm run build

echo "Starting MandateGuard API Server on port 4000..."
npm --workspace=@mandateguard/api run dev &
API_PID=$!

echo "Starting MandateGuard Operations Console on port 5173..."
npm --workspace=@mandateguard/web run dev &
WEB_PID=$!

trap "kill ${API_PID} ${WEB_PID} 2>/dev/null || true" EXIT

echo "Both services running:"
echo "- API:     http://localhost:4000"
echo "- Console: http://localhost:5173"
echo "Press Ctrl+C to terminate."

wait
