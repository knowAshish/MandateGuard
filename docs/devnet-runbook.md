# MandateGuard Canton DevNet Deployment & Operations Runbook

## 1. Prerequisites & Environment Setup

Verify that the local toolchain meets the minimum supported versions:

| Tool | Verified Version | Purpose |
| :--- | :--- | :--- |
| **DPM (Daml Package Manager)** | `1.0.22` | Compiles Daml source code into `.dar` archives and executes Daml Script tests. |
| **Canton Runtime** | `v3.6.1` (SDK `3.6.0` / `3.6.2`) | Canton participant node execution and JSON Ledger API v2 engine. |
| **Node.js** | `>= 20.0.0` (Verified: `v24.4.1`) | Backend API and frontend build environment. |
| **Java / OpenJDK** | `>= 17` (Verified: `25.0.3`) | JVM runtime required by DPM and Canton. |

---

## 2. Configuration & Credentials

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Configure participant connection settings in `.env`:
   ```bash
   # Base URL for Canton DevNet Participant Node HTTP Ledger API v2
   CANTON_LEDGER_BASE_URL=https://participant.devnet.canton.network

   # Bearer token if participant authentication is enabled
   CANTON_LEDGER_TOKEN=eyJhbGciOi...

   # Participant Parties
   OPERATOR_PARTY=Operator::1220a1b2c3d4...
   INSTITUTION_PARTY=InstitutionalTreasury::1220e5f6g7h8...
   ```

---

## 3. Step-by-Step Deployment Procedure

### Step 1: Compile Daml Smart Contracts
```bash
cd daml/main
dpm build
```
Output artifact: `daml/main/.daml/dist/mandateguard-0.1.0.dar`

### Step 2: Run Authoritative Contract Tests
```bash
cd ../test
dpm test
```
Verify that all 18 test scenarios pass with 100% template and choice coverage.

### Step 3: Upload Package to Canton DevNet Participant
Execute the deployment script:
```bash
./infra/scripts/deploy-dar.sh
```
Or manually upload via `curl` to the JSON Ledger API v2:
```bash
curl -X POST \
  -H "Content-Type: application/octet-stream" \
  -H "Authorization: Bearer ${CANTON_LEDGER_TOKEN}" \
  --data-binary @daml/main/.daml/dist/mandateguard-0.1.0.dar \
  "${CANTON_LEDGER_BASE_URL}/v2/packages"
```

### Step 4: Verify Participant Connectivity & Status
Run the automated verification script:
```bash
./infra/scripts/verify-devnet.sh
```

### Step 5: Start Backend and Frontend Control Plane
```bash
# Terminal 1: Start API Gateway
npm --workspace=@mandateguard/api run dev

# Terminal 2: Start Operations Console
npm --workspace=@mandateguard/web run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 4. Handling DevNet Resets & Re-onboarding

Canton DevNet periodically resets (typically on scheduled release maintenance windows). When a reset occurs:

1. **Party Re-allocation:** Party IDs in Canton include cryptographic fingerprints that change upon domain re-genesis. Re-allocate or query the new party IDs from your participant node:
   ```bash
   curl "${CANTON_LEDGER_BASE_URL}/v2/parties"
   ```
2. **Re-upload DAR Package:** Re-run `./infra/scripts/deploy-dar.sh`.
3. **Reset Local Projections:** Since previous contract IDs were archived on the prior network epoch, flush the local projection store to re-align with the clean ledger state:
   ```bash
   # Call the reconciliation endpoint
   curl -X POST http://localhost:4000/api/reconcile
   ```

---

## 5. Diagnostic Guide: Common Errors & Troubleshooting

| Symptom | Root Cause | Remediation |
| :--- | :--- | :--- |
| **HTTP 502 with `ECONNREFUSED`** | Canton participant node is offline or `CANTON_LEDGER_BASE_URL` is misconfigured. | Verify participant process status or start local sandbox via `docker compose -f infra/docker-compose.yml up`. |
| **HTTP 401 Unauthorized** | Ledger API requires a JWT bearer token, but none was supplied or token expired. | Refresh OAuth2 session and set `CANTON_LEDGER_TOKEN` in `.env`. |
| **HTTP 403 Forbidden on Initiation** | Authenticated user lacks `TransactionInitiator` role. | Switch active user role to an authorized initiator in the top navbar. |
| **HTTP 400 Self-Approval Blocked** | Initiating party attempted to approve their own request. | Switch active user role to an independent `TransactionApprover` (e.g. Approver 1 or Approver 2). |
| **HTTP 409 Conflict** | Replay of a command with an already submitted `X-Deduplication-Key`. | Generate a new deduplication key or allow previous submission to finalize. |
