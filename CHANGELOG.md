# Changelog

All notable changes to MandateGuard will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-10-17

### Added
- **Daml Smart Contract Architecture (`mandateguard-0.1.0.dar`):**
  - `MandateGuard.Types`: Core shared types, integer quantities, and domain references.
  - `MandateGuard.Identity`: Institutional mandates, role assignments, and approved beneficiaries.
  - `MandateGuard.Policy`: Multi-version mandate policies with threshold rules and proposal workflows.
  - `MandateGuard.Transfer`: Dual-control transfer requests, multi-party approvals, and confirmed execution receipts.
  - `MandateGuard.Emergency`: Emergency hold containment circuits with dual-key release controls and incident cases.
  - `MandateGuard.Asset`: Protected asset holding (`TestAssetHolding`) requiring atomic `TransferRequest` consumption for asset movement.
- **Contract Test Suite:**
  - 18 comprehensive Daml Script test scenarios in `daml/test/daml/Test.daml` verifying 100% of templates and choices.
- **TypeScript Domain & Policy Engine:**
  - `@mandateguard/domain`: Zero-float monetary mathematics (`Money`) supporting arbitrary asset precisions.
  - `@mandateguard/policy-engine`: Deterministic evaluation of transfer thresholds, rolling daily volumes, and self-approval prevention.
  - `@mandateguard/audit`: Deterministic SHA-256 payload hashing (`EvidenceRef`) and real-time security event anomaly detector.
  - `@mandateguard/projections`: Durable command idempotency store and Active Contract Set (ACS) discrepancy auto-healing.
  - `@mandateguard/ledger-client`: Canton JSON Ledger API v2 client with `/livez` health probes, command submissions, and active contract queries.
- **Backend API Gateway (`apps/api`):**
  - Node.js REST server enforcing separation of duties, role resolution, and durable command deduplication.
  - 16 integration and security review tests passing cleanly.
- **Enterprise Operations Console (`apps/web`):**
  - Institutional dark-mode console with 8 dedicated control screens:
    1. Security Overview
    2. Transfer Request Workbench
    3. Dual-Control Approval Console
    4. Policy Governance Administration
    5. Approved Beneficiary Registry
    6. Emergency Response & Containment Console
    7. Transaction Evidence Explorer
    8. System Health & Canton Participant Telemetry
- **DevNet Infrastructure & Operations:**
  - Docker Compose configuration for PostgreSQL projections.
  - Canton participant node configuration (`canton-devnet.conf`).
  - Automated deployment and connectivity verification scripts (`deploy-dar.sh`, `verify-devnet.sh`, `start-all.sh`).
  - Comprehensive documentation in `docs/`: Architecture, Security Model, Threat Model, Authorization Lifecycle, DevNet Runbook, and Verification Evidence.
