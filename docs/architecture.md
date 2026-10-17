# MandateGuard Architecture & Technical Specification

## 1. Executive Summary

**MandateGuard** is an institutional digital-asset mandate firewall and transaction authorization control plane built specifically for the **Canton Network** (Canton DevNet / Canton v3.6.1 runtime).

In institutional finance, digital asset custody workflows cannot rely solely on off-chain application checks or UI validations. MandateGuard enforces **authoritative contractual authorization in Daml**, ensuring that no asset transfer can proceed on the Canton ledger without multi-signature cryptographic approval from distinct authorized parties.

```
+-----------------------------------------------------------------------------------+
|                           MANDATEGUARD CONTROL PLANE                              |
+-----------------------------------------------------------------------------------+
|  [Institutional Operations Console] (React + TypeScript + Vite)                  |
|  - Security Overview        - Transfer Workbench      - Approval Console          |
|  - Policy Administration    - Beneficiary Registry    - Emergency Response        |
|  - Transaction Evidence     - System Health Telemetry                             |
+-----------------------------------------------------------------------------------+
                                        | (HTTP / JSON REST)
                                        v
+-----------------------------------------------------------------------------------+
|  [Backend API Gateway] (Node.js + TypeScript)                                     |
|  - Server-Side Role & Party Resolution (X-User-Id -> Canton Party ID)             |
|  - Schema Validation & Idempotent Submission Guard (X-Deduplication-Key)          |
|  - Event Stream Processor & Read-Model Projections (PostgreSQL)                   |
|  - Real-Time ACS Reconciliation Worker (Auto-Heal Cache Drift)                    |
|  - Cryptographic Evidence Generator (SHA-256 Payload Hashing)                     |
+-----------------------------------------------------------------------------------+
                                        | (Canton JSON Ledger API v2)
                                        v
+-----------------------------------------------------------------------------------+
|  [Canton DevNet Participant Node] (v3.6.1)                                        |
|  - /v2/commands/submit-and-wait                                                   |
|  - /v2/state/active-contracts                                                     |
|  - /livez                                                                         |
+-----------------------------------------------------------------------------------+
                                        | (Daml Execution Layer)
                                        v
+-----------------------------------------------------------------------------------+
|  [Authoritative Daml Smart Contracts] (mandateguard-0.1.0.dar)                    |
|  - MandateGuard.Identity:    InstitutionalMandate, RoleAssignment                 |
|  - MandateGuard.Policy:      PolicyVersion, PolicyChangeRequest                   |
|  - MandateGuard.Transfer:    TransferRequest, AuthorizationDecision               |
|  - MandateGuard.Emergency:   EmergencyHold, ContainmentApproval, IncidentCase     |
|  - MandateGuard.Asset:       TestAssetHolding, AuthorizedAssetTransfer            |
+-----------------------------------------------------------------------------------+
```

---

## 2. Monorepo Organization

The project is structured as an isolated, modular TypeScript monorepo under `/mandateguard`:

| Directory | Role & Responsibilities |
| :--- | :--- |
| `daml/main/` | Authoritative Daml 2.x smart contracts, templates, multi-party choices, and invariants. |
| `daml/test/` | Daml Script test suite (18 comprehensive test scenarios covering 100% of templates & choices). |
| `packages/domain/` | Pure TypeScript domain types, integer sub-unit monetary math (`Money`), and validation rules. |
| `packages/policy-engine/` | Deterministic policy evaluation engine (single limit, rolling daily volume, self-approval prevention). |
| `packages/ledger-client/` | Robust Canton JSON Ledger API v2 client (`submitAndWait`, `queryActiveContracts`, `checkHealth`). |
| `packages/audit/` | Deterministic SHA-256 payload hashing, `EvidenceRef` builder, and anomaly event detector. |
| `packages/projections/` | In-memory & durable event store, idempotent command cache, and Active Contract Set (ACS) reconciler. |
| `packages/daml-ledger/` | Auto-generated TypeScript bindings compiled directly from `mandateguard-0.1.0.dar`. |
| `apps/api/` | Secure Node.js server exposing institutional REST endpoints, RBAC enforcement, and ledger coordination. |
| `apps/web/` | Institutional dark-mode React operations console with 8 dedicated control screens. |
| `infra/` | Docker Compose, Canton topology configuration, and automated deployment scripts. |
| `docs/` | Architectural specifications, security analysis, DevNet runbooks, and verification reports. |

---

## 3. Core Architectural Invariants

### 3.1 Strict Integer Sub-Unit Monetary Math
Floating-point arithmetic (`0.1 + 0.2 = 0.30000000000000004`) is strictly prohibited across the entire codebase. All amounts are represented as 64-bit integer sub-units (`bigint`) with explicit asset precision:
- `$100.00` USD (precision 2) is parsed and stored as `10000n` cents.
- Any attempt to parse strings exceeding the configured precision (e.g., `100.555` with precision 2) throws an immediate validation exception.

### 3.2 Dual-Control & Separation of Duties
MandateGuard separates operational authority into distinct logical roles:
1. **Transaction Initiator (`TransactionInitiator`):** Can create transfer requests within an authorized mandate. **Strictly barred from approving their own requests** in both backend policy logic and Daml contract preconditions.
2. **Transaction Approver (`TransactionApprover`):** Authorized to review pending requests, evaluate risk indicators, and supply auditable approval or rejection reasons.
3. **Security Operator (`SecurityOperator`):** Authorized to declare emergency containment holds and manage incident cases.
4. **Treasury Controller (`TreasuryController`):** Authorized to propose mandate policy revisions and manage whitelisted counterparty beneficiaries.

### 3.3 Authoritative Contract Visibility & Multi-Party Observers
In Daml, a party cannot view a contract or exercise choices upon it unless they are a signatory or observer. MandateGuard's contract templates dynamically register eligible approvers as observers:
```daml
observer initiator :: (currentApprovals ++ eligibleApprovers)
```
This ensures approvers can discover and act upon pending requests without granting global visibility to unauthorized parties.

### 3.4 Atomic Asset Transfer Enforcement
MandateGuard does not claim to protect assets whose transfer path bypasses its enforcement mechanism. In `MandateGuard.Asset:AuthorizedAssetTransfer`, transfer execution requires:
```daml
choice AuthorizedTransfer : ContractId TestAssetHolding
  with
    authorizationId : ContractId TransferRequest
    transferAmount : Quantity
  controller operator, owner
```
The asset transfer choice directly consumes the approved `TransferRequest` on-ledger, guaranteeing atomic verification of the authorization state at the moment of asset movement.
