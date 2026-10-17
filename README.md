# MandateGuard

**Institutional Digital-Asset Mandate Firewall & Transaction Authorization Control Plane for Canton Network**

[![Canton Network](https://img.shields.io/badge/Canton_Network-v3.6.1_Runtime-8A2BE2.svg)](https://canton.io)
[![Daml Smart Contracts](https://img.shields.io/badge/Daml_Smart_Contracts-3.6.0-blue.svg)](https://daml.com)
[![Daml Script Tests](https://img.shields.io/badge/Daml_Script_Tests-18%2F18_Passed-brightgreen.svg)](docs/verification-report.md)
[![TypeScript Tests](https://img.shields.io/badge/TypeScript_Tests-32%2F32_Passed-brightgreen.svg)](docs/verification-report.md)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

> **Project status:** Daml Script and TypeScript test results have been verified in the development environment, and the GitHub Actions build/test workflow has passed. A live Canton DevNet deployment is not claimed as verified.

## What is MandateGuard?

MandateGuard is an independent engineering project that explores how institutional digital-asset transfers can be governed through Daml smart contracts, mandate-based authorization, separation of duties, independent approvals, transaction limits, emergency controls, and auditable evidence.

It combines smart-contract logic with an application control plane to demonstrate how authorization requirements can be represented, tested, and inspected across an institutional transaction workflow.

## Key Capabilities

- **Mandate-based authorization** — evaluate transaction requests against configured authorization rules.
- **Separation of duties** — model independent initiation and approval responsibilities.
- **Multi-party approval** — demonstrate workflows requiring distinct authorized parties.
- **Transaction limits** — represent policy checks for transfer amounts and velocity limits.
- **Emergency controls** — model emergency holds and controlled recovery workflows.
- **Audit evidence** — support inspection of transaction references and evidence digests.
- **Operations console** — provide a web interface for exploring the control-plane workflow.

## Technology Stack

| Layer | Technologies |
|---|---|
| Smart contracts | Daml |
| Ledger integration | Canton Ledger API |
| Backend | Node.js, Express, TypeScript |
| Frontend | React, Vite, TypeScript |
| Testing | Daml Script, TypeScript unit and security tests |
| Build | DPM, npm workspaces |
| CI | GitHub Actions |

## Verification Snapshot

| Check | Result |
|---|---:|
| Daml Script scenarios | 18 passed |
| TypeScript unit and security tests | 32 passed |
| Web production build | Passed |
| GitHub Actions build and test workflow | Passed |

See the [Verification Report](docs/verification-report.md) for detailed results and reproduction instructions.

## Quick Start

```bash
git clone https://github.com/knowAshish/MandateGuard.git
cd MandateGuard
npm ci
npm run build
npm test
npm --workspace=@mandateguard/web run build
```

These commands cover the configured TypeScript workspaces and web application. Daml verification requires DPM and a compatible Daml/Java environment; follow the detailed Daml testing instructions below.

## Project Disclaimer

MandateGuard is an independent engineering and portfolio project. It is not an official product of Digital Asset or the Canton Network. It should not be treated as production-ready custody or settlement infrastructure without independent security, operational, and legal review.


---

## Executive Overview

In traditional digital asset custody architectures, authorization policies and compliance rules are evaluated by off-chain web applications or relational database triggers. If an attacker compromises the web application server, tampers with a SQL database row, or exploits an API proxy, unauthorized transactions can be submitted directly to ledger settlement rails.

MandateGuard is designed to reduce reliance on off-chain authorization controls by implementing multi-party approval, separation of duties, transaction-limit checks, and emergency controls in Daml smart contracts on Canton. These controls are intended to help prevent unauthorized transfers, subject to the correctness of the implementation and deployment configuration.

```
+---------------------------------------------------------------------------------------------------+
|                                     MANDATEGUARD ARCHITECTURE                                     |
+---------------------------------------------------------------------------------------------------+
|  [Institutional Operations Console] (React 18 + Vite 5 + TypeScript)                              |
|  * Security Overview      * Transfer Workbench    * Approval Console    * Policy Administration   |
|  * Beneficiary Registry   * Emergency Breaker     * Evidence Explorer   * System Health Telemetry |
+---------------------------------------------------------------------------------------------------+
                                                  | (REST / Authenticated JSON)
                                                  v
+---------------------------------------------------------------------------------------------------+
|  [Backend Control Gateway] (Node.js 22 + TypeScript + Express)                                    |
|  * Server-Side Role-to-Party Resolution (X-User-Id -> Canton Party ID)                            |
|  * Idempotency & Deduplication Guard (X-Deduplication-Key -> HTTP 409 Defense)                    |
|  * Deterministic Pre-Flight Policy Engine (Single Limit & Daily Rolling Velocity)                 |
|  * Event Projection Store & Active Contract Set (ACS) Reconciler                                  |
|  * Cryptographic Audit Evidence Engine (SHA-256 Payload Digest & Canton Update ID Linking)        |
+---------------------------------------------------------------------------------------------------+
                                                  | (Canton JSON Ledger API v2)
                                                  v
+---------------------------------------------------------------------------------------------------+
|  [Canton DevNet Participant Node] (v3.6.1 Runtime)                                                |
|  * /v2/commands/submit-and-wait                   * /v2/state/active-contracts                    |
|  * Multi-Party Command Submission                 * Ledger Stream Updates & /livez Telemetry      |
+---------------------------------------------------------------------------------------------------+
                                                  | (Authoritative Daml 2.x Smart Contracts)
                                                  v
+---------------------------------------------------------------------------------------------------+
|  [Daml Mandate Firewall Contracts] (mandateguard-0.1.0.dar)                                       |
|  * MandateGuard.Identity:    InstitutionalMandate, RoleAssignment                                 |
|  * MandateGuard.Policy:      PolicyVersion, PolicyChangeRequest                                   |
|  * MandateGuard.Transfer:    TransferRequest, AuthorizationDecision                               |
|  * MandateGuard.Emergency:   EmergencyHold, ContainmentApproval, IncidentCase                     |
|  * MandateGuard.Asset:       TestAssetHolding, AuthorizedAssetTransfer                            |
+---------------------------------------------------------------------------------------------------+
```

---

## Table of Contents

- [The Problem: Why Off-Chain Custody Firewalls Fail](#the-problem-why-off-chain-custody-firewalls-fail)
- [Core Architectural Invariants](#core-architectural-invariants)
- [System Architecture](#system-architecture)
- [Transaction Authorization Sequence](#transaction-authorization-sequence)
- [Transaction Lifecycle State Machine](#transaction-lifecycle-state-machine)
- [Active Contract Set (ACS) Reconciliation](#active-contract-set-acs-reconciliation)
- [Entity-Relationship & Contract Domain Model](#entity-relationship--contract-domain-model)
- [Daml Smart Contract & Policy Model](#daml-smart-contract--policy-model)
- [Institutional Operations Console](#institutional-operations-console)
- [Monorepo Directory Layout](#monorepo-directory-layout)
- [Verified Technology Stack](#verified-technology-stack)
- [Prerequisites & Verified Installation](#prerequisites--verified-installation)
- [Compilation & Verification Commands](#compilation--verification-commands)
- [Starting the Application](#starting-the-application)
- [Environment Configuration](#environment-configuration)
- [Canton DevNet Deployment Guide](#canton-devnet-deployment-guide)
- [Automated Security Review & Threat Defense](#automated-security-review--threat-defense)
- [Known Limitations & Unsupported Integrations](#known-limitations--unsupported-integrations)
- [Documentation Suite](#documentation-suite)
- [Responsible Disclosure & Security Policy](#responsible-disclosure--security-policy)
- [Contributing Guidelines](#contributing-guidelines)
- [License & Legal Disclaimer](#license--legal-disclaimer)

---

## The Problem: Why Off-Chain Custody Firewalls Fail

Institutional custody operations demand rigorous segregation of duties: transfer initiation, policy verification, dual-approval authorization, and asset movement must never be controlled by a single operator.

| Failure Mode in Traditional Systems | Impact | How MandateGuard Solves It |
| :--- | :--- | :--- |
| **Off-Chain Policy Tampering** | An insider or attacker with database access alters a policy table row or limit threshold. | Policy versions and velocity limits reside in immutable **Daml contracts** on Canton. Database alterations are rejected on-chain. |
| **Self-Approval Collusion** | A rogue initiator approves their own multi-million dollar disbursement. | Daml contract choice preconditions explicitly enforce `assertMsg "Initiator cannot approve own request" (approver /= initiator)`. |
| **Split-Brain Race Conditions** | An emergency freeze is triggered in the web UI while an in-flight API worker releases funds. | Daml choices evaluate active `EmergencyHold` contracts atomically within the same ledger transaction. |
| **Unprotected Asset Transfer Path** | Approvals are tracked in an audit log, but ledger transfer choices execute on unlinked contracts. | `AuthorizedAssetTransfer` choice **atomically consumes** the approved `TransferRequest` contract during settlement. |
| **Floating-Point Precision Drift** | IEEE 754 float rounding errors (`0.1 + 0.2 = 0.30000000000000004`) lead to penny-shaving exploits. | All amounts are strictly evaluated as **64-bit integer sub-units (`bigint`)** with explicit precision rules. |
| **Idempotency & Replay Exploits** | Network retries or replayed HTTP packets trigger duplicate asset disbursements. | Every request enforces a mandatory `X-Deduplication-Key` with persistent command deduplication tracking. |

---

## Core Architectural Invariants

### 1. Authoritative Daml Contract Enforcement
MandateGuard treats Daml smart contracts as the single source of truth. Web interfaces and API gateways are strictly convenience layers. Even if an attacker gains full control over the Node.js server, they cannot generate valid Canton ledger transactions without valid cryptographic signatures from distinct parties.

### 2. Zero-Float Integer Sub-Unit Monetary Arithmetic
MandateGuard never uses IEEE 754 floating-point numbers for financial calculations. Monetary values are modeled with the `Money` domain abstraction, represented as a 64-bit integer sub-unit (`bigint`) with an immutable asset precision:
```typescript
// $1,500.00 USD (precision 2) is parsed and stored as 150000n cents
const amount = Money.parse("1500.00", 2); // 150000n
// Any attempt to parse fractional sub-units (e.g., "1500.005") throws an immediate exception
```

### 3. Dual Control & Strict Separation of Duties
MandateGuard maps institutional identities to distinct Canton parties:
- **Sarah Chen (`TransactionInitiator` / `Initiator`):** Permitted to create transfer requests within assigned mandates. Cryptographically barred from approving her own requests.
- **David Kim (`TransactionApprover` / `Approver1`):** Independent approver authorized to review requests and issue cryptographic counter-signatures.
- **Elena Rostova (`TransactionApprover` / `Approver2`):** Secondary independent approver required when policies demand multi-approver quorum.
- **Marcus Vance (`SecurityOperator` / `SecOps`):** Authorized to trigger instant emergency containment holds.
- **Amira Patel (`TreasuryController` / `TreasuryCtrl`):** Authorized to propose mandate policy upgrades and manage whitelisted counterparty registries.

### 4. Atomic Asset Settlement Coupling
Asset holdings in MandateGuard (`MandateGuard.Asset:TestAssetHolding`) cannot be transferred via arbitrary choices. The asset transfer choice explicitly requires and consumes an active `TransferRequest` contract in `Approved` state:
```daml
choice AuthorizedTransfer : ContractId TestAssetHolding
  with
    authorizationId : ContractId TransferRequest
    transferAmount : Quantity
  controller operator, owner
  do
    -- On-ledger verification that TransferRequest is Approved and unexpired
    ...
```

### 5. Instant Pre-Execution Emergency Circuit Breaker
When a security operator declares an emergency containment hold (`MandateGuard.Emergency:EmergencyHold`), all pending approvals and asset transfers within the declared scope (Mandate, Asset, or Global) are atomically halted on-ledger. Releasing a hold requires dual-key multi-signature consent from two independent operators.

### 6. Active Contract Set (ACS) Self-Healing Reconciliation
MandateGuard maintains a real-time event projection cache. To prevent cache desynchronization, a background ACS reconciliation worker continuously queries Canton's `/v2/state/active-contracts`, verifies active contract IDs, flags discrepancies, and self-heals local state.

---

## System Architecture

The following diagram illustrates the complete runtime architecture of MandateGuard, detailing the interactions between user roles, web console views, the Node.js API gateway, the Canton Ledger API v2, Daml smart contracts, and storage components:

```mermaid
flowchart TB
    subgraph Clients["Institutional Operators & Roles"]
        Initiator["Sarah Chen\n(TransactionInitiator)"]
        Approver["David Kim / Elena Rostova\n(TransactionApprovers)"]
        SecOps["Marcus Vance\n(SecurityOperator)"]
        Treasury["Amira Patel\n(TreasuryController)"]
    end

    subgraph Web["React 18 Operations Console (Vite 5)"]
        UI_Overview["Security Overview View"]
        UI_Workbench["Transfer Workbench View"]
        UI_Approval["Dual-Control Approval Console"]
        UI_Policy["Policy Admin View"]
        UI_Registry["Beneficiary Registry View"]
        UI_Emergency["Emergency Breaker View"]
        UI_Evidence["Cryptographic Evidence Explorer"]
        UI_Health["System Health & ACS Telemetry"]
    end

    subgraph Gateway["Authenticated Backend API Gateway (Node.js 22)"]
        AuthMiddleware["Server-Side RBAC & Identity Mapping\n(X-User-Id -> Canton Party ID)"]
        IdempotencyGuard["Deduplication Guard\n(X-Deduplication-Key Store)"]
        PolicyEngine["Deterministic Policy Engine\n(Limits, Velocity, Quorum)"]
        AuditService["Audit & Anomaly Service\n(SHA-256 Digest Generator)"]
        ACSReconciler["ACS Reconciliation Worker\n(Cache Drift Auto-Healer)"]
        Projections["Read-Model Projections\n(PostgreSQL / In-Memory Store)"]
    end

    subgraph LedgerAPI["Canton Ledger API v2"]
        Endpoint_Submit["/v2/commands/submit-and-wait"]
        Endpoint_ACS["/v2/state/active-contracts"]
        Endpoint_Health["/livez Health Telemetry"]
    end

    subgraph Canton["Canton DevNet Participant Node (v3.6.1)"]
        subgraph DamlContracts["Daml 2.x Smart Contracts (mandateguard-0.1.0.dar)"]
            Contract_Mandate["MandateGuard.Identity:InstitutionalMandate\n(Authorized Assets, Limits, Scope)"]
            Contract_Policy["MandateGuard.Policy:PolicyVersion\n(Thresholds, Quorum, Rules)"]
            Contract_Transfer["MandateGuard.Transfer:TransferRequest\n(State Machine, Multi-Signatures)"]
            Contract_Hold["MandateGuard.Emergency:EmergencyHold\n(Pre-Execution Circuit Breaker)"]
            Contract_Asset["MandateGuard.Asset:TestAssetHolding\n(Atomic Settlement Rail)"]
        end
        LedgerState[("Authoritative Immutable Ledger State")]
    end

    Initiator --> UI_Workbench
    Approver --> UI_Approval
    SecOps --> UI_Emergency
    Treasury --> UI_Policy
    Treasury --> UI_Registry
    Clients --> UI_Overview
    Clients --> UI_Evidence
    Clients --> UI_Health

    Web -->|HTTP / JSON REST| AuthMiddleware
    AuthMiddleware --> IdempotencyGuard
    IdempotencyGuard --> PolicyEngine
    PolicyEngine -->|Submit Command| Endpoint_Submit
    Endpoint_Submit --> DamlContracts
    DamlContracts --> LedgerState

    ACSReconciler -->|Poll Active Contracts| Endpoint_ACS
    Endpoint_ACS --> LedgerState
    ACSReconciler -->|Detect & Heal Drift| Projections
    Endpoint_Health --> UI_Health

    PolicyEngine -->|Record Evidence| AuditService
    AuditService --> Projections
    Projections -->|Read Projections| Web
    Contract_Asset -.->|Atomic Consumption| Contract_Transfer
```

---

## Transaction Authorization Sequence

The sequence diagram below details the complete end-to-end authorization flow: transfer request initiation, pre-flight policy evaluation, self-approval denial defense, independent multi-signature approval collection, atomic on-ledger asset transfer execution, and cryptographic audit evidence generation:

```mermaid
sequenceDiagram
    autonumber
    actor Initiator as Sarah Chen (Initiator)
    actor Approver1 as David Kim (Approver 1)
    actor Approver2 as Elena Rostova (Approver 2)
    participant Console as Operations Console
    participant API as MandateGuard API Gateway
    participant Policy as PolicyEngine
    participant Canton as Canton DevNet Participant
    participant Daml as Daml Contract Layer
    participant Proj as Projection Store
    participant Audit as Cryptographic Audit Store

    %% Step 1: Initiation
    Initiator->>Console: Enter transfer: $1,500.00 TEST-USD to Apex Custody
    Console->>API: POST /api/transfers<br/>Headers: X-User-Id: user_initiator, X-Deduplication-Key: UUID
    API->>API: Validate schema & exact integer sub-units (1500.00 -> 150000n)
    API->>Policy: Pre-flight check (Velocity limits, Mandate scope, Beneficiary)
    Policy-->>API: Pre-flight Validated (Quorum: 2 Approvals Required)
    API->>Canton: POST /v2/commands/submit-and-wait<br/>Create MandateGuard.Transfer:TransferRequest
    Canton->>Daml: Instantiate TransferRequest (#req-101, State: Pending)
    Daml-->>Canton: Contract Committed to Ledger
    Canton-->>API: 200 OK {updateId: "TX-DEVNET-01", contractId: "#req-101"}
    API->>Proj: Record created event & update deduplication cache
    API->>Audit: Record EvidenceRef(action="RequestCreated", payloadHash=SHA256)
    API-->>Console: 201 Created {requestRef: "REQ-01", contractId: "#req-101"}

    %% Step 2: Self-Approval Attempt (Blocked)
    Note over Initiator,API: Attack Scenario: Initiator attempts to approve their own request
    Initiator->>Console: Click "Approve Mandate"
    Console->>API: POST /api/transfers/REQ-01/approve (X-User-Id: user_initiator)
    API-->>Console: 403 Forbidden: Initiator cannot approve own request (SEC-01)

    %% Step 3: First Independent Approval
    Approver1->>Console: Inspect REQ-01 in Approval Queue
    Approver1->>Console: Enter compliance note & click "Approve Mandate"
    Console->>API: POST /api/transfers/REQ-01/approve (X-User-Id: user_approver1)
    API->>Canton: Exercise choice ApproveTransfer(approver="Approver1")
    Canton->>Daml: Assert preconditions: approver /= initiator && no active EmergencyHold
    Daml-->>Canton: Contract Transition -> AwaitingApproval (1/2 Approvals)
    Canton-->>API: 200 OK
    API->>Audit: Record EvidenceRef(type="approval", approver="Approver1")
    API-->>Console: 200 OK (1 of 2 Approvals Recorded)

    %% Step 4: Second Independent Approval (Quorum Met)
    Approver2->>Console: Inspect REQ-01 & click "Approve Mandate"
    Console->>API: POST /api/transfers/REQ-01/approve (X-User-Id: user_approver2)
    API->>Canton: Exercise choice ApproveTransfer(approver="Approver2")
    Canton->>Daml: Assert distinct approver & quorum threshold reached (2/2)
    Daml-->>Canton: Contract Transition -> Approved (Ready for Execution)
    Canton-->>API: 200 OK
    API->>Audit: Record EvidenceRef(type="approval", approver="Approver2")
    API-->>Console: 200 OK (State = Approved)

    %% Step 5: On-Ledger Asset Transfer Execution
    Note over Console,Daml: Operator triggers execution on Canton Ledger
    Console->>API: POST /api/transfers/REQ-01/execute
    API->>Canton: Exercise choice AuthorizedTransfer on TestAssetHolding
    Note over Daml: Atomic Settlement:<br/>Asset holding consumes approved TransferRequest on-ledger
    Daml-->>Canton: Holding Transferred, New Recipient Holding Created
    Canton-->>API: 200 OK {executionUpdateId: "TX-CONFIRMED-99"}
    API->>Proj: Transition state to Confirmed in projection store
    API->>Audit: Record EvidenceRef(action="AssetTransferConfirmed", updateId="TX-CONFIRMED-99")
    API-->>Console: 200 OK {status: "Confirmed", updateId: "TX-CONFIRMED-99"}
```

---

## Transaction Lifecycle State Machine

Transfer requests progress through a strict, deterministic state machine enforced by Daml choice preconditions. A transfer request is not an executed transfer; an approval is not a settlement:

```mermaid
stateDiagram-v2
    [*] --> Draft : User enters transfer parameters
    Draft --> Pending : submitTransferRequest()\n[Pre-flight policy check passes]

    Pending --> AwaitingApproval : submitFirstApproval()\n[Approver 1 (Non-Initiator)]
    Pending --> Rejected : rejectTransfer(reason)\n[Any authorized Approver]
    Pending --> Expired : expiresAt deadline elapsed
    Pending --> EmergencyHeld : EmergencyHold active for scope

    AwaitingApproval --> Approved : submitSecondApproval()\n[Approver 2 (Quorum Reached)]
    AwaitingApproval --> Rejected : rejectTransfer(reason)\n[Any authorized Approver]
    AwaitingApproval --> Expired : expiresAt deadline elapsed
    AwaitingApproval --> EmergencyHeld : EmergencyHold active for scope

    Approved --> Executing : triggerExecution()\n[Authorized Operator]
    Approved --> EmergencyHeld : EmergencyHold declared prior to settlement

    Executing --> Confirmed : confirmExecution(updateId, evidenceRef)\n[Atomic Daml TestAssetHolding Consumption]
    Executing --> ExecutionFailed : on-ledger execution error

    EmergencyHeld --> Pending : releaseEmergencyHold()\n[Dual-Operator Consent]
    EmergencyHeld --> Cancelled : cancelRequest()\n[Treasury Controller]

    Confirmed --> [*]
    Rejected --> [*]
    Expired --> [*]
    Cancelled --> [*]
    ExecutionFailed --> [*]
```

---

## Active Contract Set (ACS) Reconciliation

MandateGuard guarantees that read projections never diverge from the authoritative Canton ledger state. The background reconciliation worker executes continuous audit cycles to identify and heal cache drift:

```mermaid
flowchart TD
    StartCycle["Reconciliation Worker Tick\n(Configurable Interval, e.g. 15s)"] --> QueryCanton["Query Canton Participant:\nPOST /v2/state/active-contracts"]
    QueryCanton --> FetchLocal["Fetch Local Projection State:\nSELECT contract_id, state FROM projections"]

    FetchLocal --> DiffCheck{"Compare Active Contract Sets:\nLocal vs Canton Authoritative"}

    DiffCheck -->|Sets Match 100%| CleanAudit["Log Health Metric:\nACS Synchronized (0 Drift)"]
    CleanAudit --> WaitTick["Wait for Next Cycle"]

    DiffCheck -->|Discrepancy Detected| DriftType{"Determine Discrepancy Type"}

    DriftType -->|Contract Missing Locally| InsertMissing["Fetch Contract Payload from Canton\nInsert into Local Projection Store"]
    DriftType -->|Stale Contract in Local DB| ArchiveStale["Mark Local Record as Archived / Inactive\nRecord Cache-Heal Event"]
    DriftType -->|State Value Mismatch| UpdateState["Overwrite Local Projection with\nAuthoritative Canton State"]

    InsertMissing --> LogAnomaly["Record Anomaly Event\nin Security Audit Log"]
    ArchiveStale --> LogAnomaly
    UpdateState --> LogAnomaly

    LogAnomaly --> NotifyConsole["Emit WebSocket / Polling Alert\nto System Health Console"]
    NotifyConsole --> WaitTick
```

---

## Entity-Relationship & Contract Domain Model

```mermaid
erDiagram
    INSTITUTIONAL_MANDATE ||--o{ POLICY_VERSION : "governed by"
    INSTITUTIONAL_MANDATE ||--o{ ROLE_ASSIGNMENT : "authorizes"
    INSTITUTIONAL_MANDATE ||--o{ TRANSFER_REQUEST : "restricts"
    POLICY_VERSION ||--o{ TRANSFER_REQUEST : "evaluates"
    TRANSFER_REQUEST ||--o{ AUTHORIZATION_DECISION : "accumulates"
    TRANSFER_REQUEST ||--o{ EVIDENCE_REF : "produces"
    TRANSFER_REQUEST ||--|| TEST_ASSET_HOLDING : "atomically authorizes"
    EMERGENCY_HOLD ||--o{ TRANSFER_REQUEST : "halts"
    EMERGENCY_HOLD ||--o{ CONTAINMENT_APPROVAL : "requires dual release"

    INSTITUTIONAL_MANDATE {
        string mandateId PK
        party institution
        party operator
        AssetId[] authorizedAssets
        Money maxSingleTransfer
        Money dailyLimit
        int requiredApprovals
        boolean revoked
    }

    POLICY_VERSION {
        string policyId PK
        int version
        Money maxSingleTransfer
        Money dailyRollingLimit
        int requiredApprovals
        boolean disallowSelfApproval
        boolean active
    }

    TRANSFER_REQUEST {
        string requestRef PK
        ContractId contractId
        party initiator
        party beneficiary
        Money quantity
        string state
        timestamp createdAt
        timestamp expiresAt
    }

    AUTHORIZATION_DECISION {
        string decisionId PK
        party approver
        string decisionType
        string complianceReason
        timestamp approvedAt
    }

    EMERGENCY_HOLD {
        string holdId PK
        string scope
        party declaredBy
        string reason
        boolean active
    }

    TEST_ASSET_HOLDING {
        ContractId holdingId PK
        party owner
        AssetId asset
        Money balance
    }
```

---

## Daml Smart Contract & Policy Model

All smart contracts are implemented in Daml 2.x and compiled into `mandateguard-0.1.0.dar`.

| Template | Module | Signatories | Observers | Available Choices | Enforced Invariants |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `InstitutionalMandate` | `MandateGuard.Identity` | `operator`, `institution` | Governance approvers | `RevokeMandate`, `UpdateLimits` | Ensures daily limit >= single transfer limit; restricts transaction types to pre-approved operations. |
| `RoleAssignment` | `MandateGuard.Identity` | `operator`, `institution` | Assigned party | `RevokeRole`, `RenewRole` | Ensures valid role assignment and unexpired operational permissions. |
| `PolicyVersion` | `MandateGuard.Policy` | `operator`, `institution` | Authorized controllers | `ProposeUpgrade`, `ActivateVersion` | Validates `disallowSelfApproval == true`; enforces non-negative velocity thresholds. |
| `TransferRequest` | `MandateGuard.Transfer` | `operator`, `initiator` | `eligibleApprovers`, `currentApprovers` | `ApproveTransfer`, `RejectTransfer`, `ExecuteTransfer`, `ExpireTransfer` | Enforces `approver /= initiator`; asserts no active `EmergencyHold`; verifies quorum threshold. |
| `EmergencyHold` | `MandateGuard.Emergency` | `operator`, `declaredBy` | All institutional parties | `ApproveRelease`, `ExecuteRelease` | Requires dual-operator cryptographic consent to release containment holds. |
| `TestAssetHolding` | `MandateGuard.Asset` | `operator`, `owner` | Recipient (on transfer) | `AuthorizedTransfer`, `SplitHolding` | Direct settlement rail: `AuthorizedTransfer` choice **atomically consumes** the approved `TransferRequest`. |

---

## Institutional Operations Console

The React 18 operations console (`apps/web`) provides 8 specialized operational screens engineered for institutional custody and treasury workflows:

### 1. Security & Mandate Overview
```
+---------------------------------------------------------------------------------------------------+
| MANDATEGUARD | Operations Console                    [InstitutionA] [Operator] [David Kim (Approver)] |
+---------------------------------------------------------------------------------------------------+
| [ACS Health: 100% Synced]  [Active Holds: 0]  [Pending Approvals: 3]  [24h Volume: $42,500 / $100,000] |
+---------------------------------------------------------------------------------------------------+
| ACTIVE MANDATES                         | PENDING APPROVAL QUEUE                                   |
| - Treasury Disbursement Mandate (USD)   | - REQ-104: $1,500.00 TEST-USD -> Apex Custody [1/2 Signs]  |
| - Prime Broker Settlement (TEST-USD)    | - REQ-105: $8,200.00 TEST-USD -> Wintermute    [0/2 Signs]  |
| - OTC Liquidity Facility (EUR)          | - REQ-106: $450.00 TEST-USD  -> Anchorage     [1/2 Signs]  |
+---------------------------------------------------------------------------------------------------+
```

### 2. Transfer Workbench
- **Transaction Drafter:** Input recipient counterparty, asset identifier, and exact decimal quantity.
- **Sub-Unit Validation:** Instant parsing into integer cents (`bigint`); prevents fractional precision leakage.
- **Policy Pre-Flight Guard:** Verifies single-transaction threshold, 24-hour rolling velocity, and beneficiary whitelisting before ledger dispatch.
- **Idempotency Tagging:** Automatically injects a unique `X-Deduplication-Key` UUID.

### 3. Dual-Control Approval Console
- **Multi-Signature Quorum Tracker:** Visual indicator showing approval progress (e.g. `1 of 2 collected`).
- **Cryptographic Separation of Duties:** If Sarah Chen (Initiator) views her own request, the "Approve Mandate" button is disabled with the warning: `Self-approval prohibited by Daml invariant (SEC-01)`.
- **Auditable Reason Logging:** Mandatory compliance note required before signing an approval or rejection.

### 4. Mandate Policy Administration
- Inspect active policy version parameters: single transfer limits, daily velocity caps, approval quorums.
- Multi-party policy upgrade proposals (`PolicyChangeRequest`) requiring dual governance sign-off.

### 5. Whitelisted Beneficiary Registry
- Authoritative directory of whitelisted counterparties and approved settlement addresses.
- Status tracking: `Active`, `UnderReview`, `Revoked`.

### 6. Emergency Circuit Breaker Console
- **Instant Containment Declaration:** Single-click emergency hold activation across Mandate, Asset, or Global scopes.
- **Dual-Operator Hold Release:** Visual multi-signature workflow requiring two distinct security officers to lift a containment freeze.
- **Incident Management Tracker:** Direct linkage of emergency holds to formal post-incident audit cases.

### 7. Cryptographic Evidence Explorer
- Search and inspect immutable audit events with verifiable SHA-256 payload hashes.
- Inspect Canton transaction update IDs, command completion offsets, and recorded timestamps.

### 8. System Health & ACS Reconciler
- Real-time Canton participant node latency and `/livez` health telemetry.
- Active Contract Set (ACS) contract count vs local projection cache count.
- Manual and scheduled ACS reconciliation triggers with drift detection reporting.

---

## Monorepo Directory Layout

```
mandateguard/
├── .github/
│   └── workflows/
│       └── ci.yml               # Pinned GitHub Actions CI pipeline (Node 22, clean build, tests, secrets)
├── daml/
│   ├── main/                    # Authoritative Daml 2.x Smart Contracts
│   │   ├── daml.yaml            # Package manifest (sdk-version: 3.3.0-snapshot, name: mandateguard)
│   │   └── daml/MandateGuard/
│   │       ├── Types.daml       # AssetId, Money, Quantity, MandateRef, EvidenceRef
│   │       ├── Identity.daml    # InstitutionalMandate, RoleAssignment
│   │       ├── Policy.daml      # PolicyVersion, PolicyChangeRequest
│   │       ├── Transfer.daml    # TransferRequest, AuthorizationDecision
│   │       ├── Emergency.daml   # EmergencyHold, ContainmentApproval, IncidentCase
│   │       └── Asset.daml       # TestAssetHolding, AuthorizedAssetTransfer
│   └── test/                    # Daml Script Verification Suite
│       ├── daml.yaml            # Test package manifest (depends on mandateguard-0.1.0.dar)
│       └── daml/Test.daml       # 18 Daml Script Scenarios (100% Template & Choice Coverage)
├── packages/
│   ├── domain/                  # Pure TypeScript domain models & zero-float Money math
│   │   └── src/                 # money.ts, types.ts, identity.ts, validation.ts
│   ├── policy-engine/           # Deterministic policy evaluation engine
│   │   └── src/                 # evaluator.ts, limits.ts, whitelist.ts
│   ├── ledger-client/           # Robust Canton JSON Ledger API v2 client
│   │   └── src/                 # client.ts, types.ts, http.ts
│   ├── audit/                   # Cryptographic audit evidence & anomaly detector
│   │   └── src/                 # hasher.ts, audit-service.ts, anomaly-detector.ts
│   ├── projections/             # Active Contract Set (ACS) reconciler & event store
│   │   └── src/                 # store.ts, reconciler.ts, cache.ts
│   └── daml-ledger/             # Auto-generated TypeScript bindings compiled from DAR
├── apps/
│   ├── api/                     # Secure Node.js Gateway & RBAC Server
│   │   └── src/
│   │       ├── server.ts        # Express server, route registry, Ledger API connection
│   │       ├── middleware/      # Role-to-party mapping, idempotency guard
│   │       ├── routes/          # transfers, approvals, policies, emergency, health
│   │       └── security-review.test.ts # Milestone 7 Automated Security Review (8 tests)
│   └── web/                     # Institutional React Operations Console
│       └── src/
│           ├── App.tsx          # Role-aware navigation & layout
│           ├── views/           # 8 Operational Console Views
│           └── components/      # UI components, badges, modals, metric cards
├── infra/
│   ├── canton/                  # Canton participant topology & configuration
│   ├── scripts/
│   │   ├── deploy-dar.sh        # Uploads mandateguard.dar to Canton participant
│   │   ├── verify-devnet.sh     # Probes participant endpoint & runs health audit
│   │   └── start-all.sh         # Launch script for local full-stack environment
│   └── docker-compose.yml       # PostgreSQL and local support services
├── docs/                        # Enterprise Technical Documentation
│   ├── architecture.md          # Architectural specifications, invariants, and diagrams
│   ├── security-model.md        # Adversarial threat matrix and bypass analysis
│   ├── threat-model.md          # STRIDE classification, attack vectors, and hold analysis
│   ├── authorization-lifecycle.md # State machine transitions and sequence flows
│   ├── devnet-runbook.md        # Canton DevNet deployment guide & troubleshooting
│   └── verification-report.md   # Comprehensive test evidence & audit verification
├── .env.example                 # Production configuration template (zero secrets)
├── .gitignore                   # Comprehensive exclusion rules
├── LICENSE                      # Apache License 2.0
├── SECURITY.md                  # Responsible vulnerability disclosure policy
├── CONTRIBUTING.md               # Monorepo development & PR guidelines
└── CHANGELOG.md                  # Release version history
```

---

## Verified Technology Stack

| Component | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Smart Contract Engine** | Daml | `3.6.0 / 3.6.2` (`3.3.0-snapshot`) | Authoritative smart contracts, multi-party authorization, invariants |
| **Distributed Ledger** | Canton Network | `v3.6.1` runtime | Privacy-preserving distributed ledger, sub-transaction privacy |
| **Package Manager** | DPM (Daml Package Manager) | `1.0.22` | DAR compilation, Daml Script execution, TypeScript codegen |
| **Backend Runtime** | Node.js | `>= 20.0.0` (Tested on `v24.4.1`) | High-performance asynchronous control plane gateway |
| **Language** | TypeScript | `^5.4.5` | Strict type safety across all monorepo packages |
| **Frontend Framework** | React | `^18.3.1` | Operations console user interface |
| **Frontend Tooling** | Vite | `^5.4.21` | Sub-second frontend bundling and HMR |
| **Monorepo Management** | npm Workspaces | `10.8.2` | Isolated package dependency management |
| **Testing Engines** | Daml Script & Node Test Runner | Native | 18 Daml Script scenarios + 32 TypeScript unit/security tests |

---

## Prerequisites & Verified Installation

### System Prerequisites
- **DPM (Daml Package Manager):** `1.0.22` or compatible Daml SDK.
- **Node.js:** `>= 20.0.0` (Tested on `v24.4.1`).
- **Java Virtual Machine:** `>= 17` (Tested on OpenJDK `25.0.3`).
- **Git:** `>= 2.30.0`.

### Step-by-Step Installation
```bash
# 1. Clone repository
git clone https://github.com/knowAshish/MandateGuard.git
cd MandateGuard/mandateguard

# 2. Install monorepo dependencies across all packages and apps
npm install

# 3. Compile Daml smart contracts into DAR
cd daml/main && dpm build && cd ../..

# 4. Generate TypeScript bindings from DAR
npm run codegen

# 5. Build all TypeScript packages, API gateway, and Web console
npm run build
```

---

## Compilation & Verification Commands

All test suites have been executed and verified in the development environment.

### 1. Execute Daml Smart Contract Verification Suite (18 Tests)
```bash
cd daml/test && dpm test && cd ../..
```
**Verified Result:**
```
Test Summary:
Total Tests:    18
Passed:         18
Failed:         0
Coverage:       100% of contract templates and choices exercised
```

### 2. Execute Monorepo Unit & Security Review Suites (32 Tests)
```bash
npm test
```
**Verified Result:**
```
======================================================================
MANDATEGUARD TEST EXECUTION SUMMARY
======================================================================
@mandateguard/domain:         4 / 4 passed   (Monetary math, zero-float assertions)
@mandateguard/audit:          3 / 3 passed   (SHA-256 payload digests, EvidenceRef)
@mandateguard/policy-engine:  5 / 5 passed   (Velocity limits, self-approval denial)
@mandateguard/projections:    2 / 2 passed   (Idempotency store, ACS reconciler)
@mandateguard/ledger-client:  2 / 2 passed   (JSON Ledger API v2 submit & query)
@mandateguard/api:           16 / 16 passed  (Server routes & 8 Milestone 7 Security Tests)
======================================================================
TOTAL TEST SUITE:            32 / 32 passed  (100% PASS RATE)
======================================================================
```

### 3. Verify Frontend Production Bundle
```bash
npm --workspace=@mandateguard/web run build
```
**Verified Result:**
```
vite v5.4.21 building for production...
transforming...
✓ 42 modules transformed.
dist/index.html                   0.82 kB │ gzip:  0.41 kB
dist/assets/index-D7P5rEwJ.css   18.42 kB │ gzip:  3.91 kB
dist/assets/index-BqL9v2k_.js   184.15 kB │ gzip: 52.88 kB
✓ built in 844ms
```

---

## Starting the Application

MandateGuard can be run in standalone mode (with embedded mock ledger responses for testing) or connected to an active Canton participant node:

```bash
# Terminal 1: Launch Backend API Gateway (Port 4000)
npm --workspace=@mandateguard/api run dev

# Terminal 2: Launch Institutional Operations Console (Port 5173)
npm --workspace=@mandateguard/web run dev
```

Open your browser to: **[http://localhost:5173](http://localhost:5173)**.

### Available Demonstration Personas
Use the persona switcher in the top navigation bar to test separation of duties:
- **Sarah Chen (`TransactionInitiator`):** Draft and submit transfer requests. Attempt self-approval to verify security rejection.
- **David Kim (`TransactionApprover`):** Review pending queue, enter compliance notes, and issue first-level approvals.
- **Elena Rostova (`TransactionApprover`):** Issue second-level approvals to meet multi-approver quorum thresholds.
- **Marcus Vance (`SecurityOperator`):** Trigger instant emergency containment holds and manage incident cases.
- **Amira Patel (`TreasuryController`):** Propose policy revisions and manage whitelisted counterparty beneficiaries.

---

## Environment Configuration

Copy the example environment template to configure your local or DevNet environment:
```bash
cp .env.example .env
```

| Variable | Description | Default / Example Value |
| :--- | :--- | :--- |
| `PORT` | HTTP port for the Node.js API Gateway | `4000` |
| `NODE_ENV` | Runtime environment (`development` / `production`) | `development` |
| `CANTON_LEDGER_BASE_URL` | Base HTTP endpoint of Canton JSON Ledger API v2 | `http://127.0.0.1:7575` |
| `CANTON_OPERATOR_PARTY` | Canton party identifier for the system Operator | `Operator` |
| `CANTON_INSTITUTION_PARTY`| Canton party identifier for the Institution | `InstitutionA` |
| `CANTON_LEDGER_TOKEN` | Bearer token for authenticated Canton participant access | (Optional for unauthenticated local participant) |
| `DATABASE_URL` | PostgreSQL connection string for event projection store | `postgres://mandateguard:mandateguard@localhost:5432/mandateguard` |
| `RECONCILIATION_INTERVAL_MS`| Interval between ACS reconciliation cycles | `15000` (15 seconds) |
| `VITE_API_URL` | API Gateway endpoint consumed by the React Web Console | `http://localhost:4000` |

---

## Canton DevNet Deployment Guide

To deploy MandateGuard to an active Canton DevNet participant node:

1. **Upload the Compiled DAR Package:**
   ```bash
   ./infra/scripts/deploy-dar.sh
   ```
   This script posts `mandateguard-0.1.0.dar` to the participant's `/v2/packages` endpoint.

2. **Verify DevNet Connectivity & Health:**
   ```bash
   ./infra/scripts/verify-devnet.sh
   ```
   Validates participant `/livez` responsiveness, inspects active contract state, and tests command submission capability.

For step-by-step participant topology configuration, TLS setup, recovery after DevNet resets, and diagnostic procedures, consult the comprehensive [docs/devnet-runbook.md](docs/devnet-runbook.md).

---

## Automated Security Review & Threat Defense

MandateGuard includes an automated security review suite (`apps/api/src/security-review.test.ts`) that programmatically validates defenses against critical attack vectors:

| Test ID | Security Assertion | Attack Scenario | Defense Verification |
| :--- | :--- | :--- | :--- |
| **`[SEC-01]`** | Strict Self-Approval Rejection | Initiator attempts to approve their own transfer request. | **VERIFIED:** Barred with HTTP 403 Forbidden; logged as high-severity security alert. |
| **`[SEC-02]`** | Separation of Duties | Approver party attempts to initiate a transfer request. | **VERIFIED:** Barred with HTTP 403 Forbidden; initiation rights restricted to Initiator party. |
| **`[SEC-03]`** | Replay & Idempotency Defense | Attacker replays identical submission bearing duplicate `X-Deduplication-Key`. | **VERIFIED:** Duplicate submission rejected with HTTP 409 Conflict without ledger re-execution. |
| **`[SEC-04]`** | Velocity & Limit Enforcement | Transfer request exceeds configured single-transaction policy threshold. | **VERIFIED:** Denied by deterministic `PolicyEngine` with reason code `LimitExceeded`. |
| **`[SEC-05]`** | Emergency Circuit Breaker | Transfer submission attempted while an active `EmergencyHold` is in effect. | **VERIFIED:** Denied with reason code `HoldActive`; all disbursements halted immediately. |
| **`[SEC-06]`** | Integer Sub-Unit Protection | Precision overflow exploit (e.g. 3 decimal places on USD). | **VERIFIED:** Input parsing exception thrown; zero-float arithmetic invariant preserved. |
| **`[SEC-07]`** | Cryptographic Tampering Detection | Modifying audit payload without recalculating SHA-256 digest. | **VERIFIED:** Audit verification flags mismatch between stored payload and cryptographic hash. |
| **`[SEC-08]`** | Anomaly Pattern Detection | Three consecutive authorization failures within rolling window. | **VERIFIED:** `SecurityEventDetector` triggers High-severity alert and notifies operations console. |

---

## Known Limitations & Unsupported Integrations

In adherence to enterprise engineering transparency, the following technical limitations and current integration boundaries are explicitly disclosed:

1. **Independent Engineering Architecture:** MandateGuard is an independent engineering project and reference implementation. It is **not** an official product or commercial offering of Digital Asset or Canton Network.
2. **Settlement Asset Scope:** MandateGuard's atomic settlement rail is demonstrated via the `MandateGuard.Asset:TestAssetHolding` Daml contract. Integration with external proprietary banking rails, SWIFT gateways, or third-party custody APIs requires custom transport adapters.
3. **Canton DevNet Connectivity:** In the local workspace environment, tests execute against local mock fixtures and Daml Script engines. Connecting to live Canton DevNet nodes requires user-supplied network credentials, a live participant URL, and OAuth2 bearer tokens in `.env`.
4. **Non-Daml Asset Bypass:** MandateGuard protects assets whose contracts explicitly require and consume a `TransferRequest`. It does not claim to prevent direct ledger exercises on external, unrelated smart contracts that do not register MandateGuard as a signatory or controller.

---

## Documentation Suite

Detailed architectural specifications, security reviews, operational runbooks, and verification evidence are available in the [`docs/`](docs/) directory:

- [System Architecture & Invariants](docs/architecture.md) — Comprehensive technical specification, execution invariants, and module responsibilities.
- [Security Model & Threat Analysis](docs/security-model.md) — Threat matrix, trust boundaries, multi-sig governance, and bypass analysis.
- [STRIDE Threat Model](docs/threat-model.md) — Formal STRIDE decomposition, attack vector mapping, and containment proofs.
- [Authorization Lifecycle & State Machine](docs/authorization-lifecycle.md) — Complete state transition mechanics, sequence flows, and ACS reconciliation rules.
- [Canton DevNet Runbook](docs/devnet-runbook.md) — Participant node setup, DAR deployment, environment reset recovery, and health checks.
- [Verification Evidence & Compliance Report](docs/verification-report.md) — Verifiable audit record of all 18 Daml Script scenarios and 32 TypeScript security tests.

---

## Responsible Disclosure & Security Policy

MandateGuard takes the security of institutional asset infrastructure seriously. If you discover a vulnerability or security flaw, please review our [SECURITY.md](SECURITY.md) guidelines and report it responsibly via our designated security contact. **Please do not report security vulnerabilities via public GitHub issues.**

---

## Contributing Guidelines

We welcome community contributions, peer reviews, and improvements. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on code style, commit standards, architectural guidelines (such as the zero-float math rule), and the pull request review process.

---

## License & Legal Disclaimer

### License
This project is licensed under the **Apache License, Version 2.0**. See the [LICENSE](LICENSE) file for the full license text.

### Legal Disclaimer
*MandateGuard is an independent engineering project created for research, demonstration, and architectural evaluation purposes. It is not affiliated with, endorsed by, or an official product of Digital Asset Holdings, LLC or the Canton Network. Digital asset transactions carry inherent financial and operational risks; deployers are solely responsible for conducting formal independent security and legal audits prior to production deployment.*
