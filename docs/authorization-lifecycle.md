# MandateGuard Transaction Authorization Lifecycle

## 1. State Machine Overview

The lifecycle of an institutional transfer request is governed by a strict, deterministic state machine enforced by Daml smart contracts. A transfer request is **not** an executed transfer; an approval is **not** a confirmed settlement.

```mermaid
stateDiagram-v2
    [*] --> Pending : createTransferRequest()\n[Initiator]

    Pending --> AwaitingApproval : submitFirstApproval()\n[Approver 1 (Non-Initiator)]
    Pending --> Rejected : reject()\n[Approver 1]
    Pending --> Expired : expiresAt deadline passed

    AwaitingApproval --> Approved : submitSecondApproval()\n[Approver 2 (Threshold Reached)]
    AwaitingApproval --> Rejected : reject()\n[Approver 2]
    AwaitingApproval --> Expired : expiresAt deadline passed

    Approved --> Executing : triggerExecution()\n[Operator / Treasury]

    Executing --> Confirmed : confirmExecution(updateId, evidenceRef)\n[Canton Ledger Atomicity]
    Executing --> Rejected : executionFailure()

    Confirmed --> [*]
    Rejected --> [*]
    Expired --> [*]
```

---

## 2. End-to-End Transaction Flow

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
    participant Proj as PostgreSQL Projections
    participant Audit as Cryptographic Audit Store

    %% Step 1: Initiation
    Initiator->>Console: Enter transfer: $1,500.00 TEST-USD to Apex Custody
    Console->>API: POST /api/transfers<br/>Headers: X-User-Id: user_initiator, X-Deduplication-Key: UUID
    API->>API: Validate schema & exact integer sub-unit ($1500.00 = 150000n)
    API->>Policy: Pre-flight check (Limits, Mandate, Whitelist)
    Policy-->>API: Pre-flight OK (Requires 2 Approvals)
    API->>Canton: POST /v2/commands/submit-and-wait<br/>Create MandateGuard.Transfer:TransferRequest
    Canton->>Daml: Instantiate TransferRequest contract (#req-101)
    Daml-->>Canton: Contract Committed (State = Pending)
    Canton-->>API: 200 OK {updateId: "TX-DEVNET-01", contractId: "#req-101"}
    API->>Proj: Record created event & update idempotency cache
    API->>Audit: Record AuditRecord(action="RequestCreated", hash=SHA256)
    API-->>Console: 201 Created {requestRef: "REQ-01", contractId: "#req-101"}

    %% Step 2: Self-Approval Attempt (Blocked)
    Note over Initiator,API: Initiator attempts to approve their own request
    Initiator->>Console: Click "Approve Mandate"
    Console->>API: POST /api/transfers/REQ-01/approve (X-User-Id: user_initiator)
    API-->>Console: 403 Forbidden: Self-approval is strictly prohibited

    %% Step 3: First Independent Approval
    Approver1->>Console: Review transfer REQ-01 in Approval Queue
    Approver1->>Console: Input compliance reason & Click "Approve Mandate"
    Console->>API: POST /api/transfers/REQ-01/approve<br/>Headers: X-User-Id: user_approver1
    API->>Canton: Exercise choice ApproveTransfer(approver="Approver1")
    Canton->>Daml: Verify preconditions: approver /= initiator && no emergency hold
    Daml-->>Canton: State updated to AwaitingApproval (1/2 Approvals)
    Canton-->>API: 200 OK
    API->>Audit: Record EvidenceRef(type="approval", approver="Approver1")
    API-->>Console: 200 OK (1 of 2 Approvals Collected)

    %% Step 4: Second Independent Approval
    Approver2->>Console: Review transfer REQ-01 & Click "Approve Mandate"
    Console->>API: POST /api/transfers/REQ-01/approve<br/>Headers: X-User-Id: user_approver2
    API->>Canton: Exercise choice ApproveTransfer(approver="Approver2")
    Canton->>Daml: Verify distinct approver & threshold reached
    Daml-->>Canton: State transitions to Approved
    Canton-->>API: 200 OK
    API->>Audit: Record EvidenceRef(type="approval", approver="Approver2")
    API-->>Console: 200 OK (State = Approved, Ready to Execute)

    %% Step 5: On-Ledger Asset Transfer Execution
    Note over Console,Daml: Operator triggers execution on Canton Ledger
    Console->>API: POST /api/transfers/REQ-01/execute
    API->>Canton: Exercise choice AuthorizedTransfer on TestAssetHolding
    Note over Daml: Atomic Consumption:<br/>Asset holding consumes approved TransferRequest on-ledger
    Daml-->>Canton: Transfer Confirmed, New Holding Created for Recipient
    Canton-->>API: 200 OK {executionUpdateId: "TX-CONFIRMED-99"}
    API->>Proj: Transition state to Confirmed in projection store
    API->>Audit: Record AuditRecord(action="AssetTransferConfirmed", updateId="TX-CONFIRMED-99")
    API-->>Console: 200 OK {status: "Confirmed", updateId: "TX-CONFIRMED-99"}
```

---

## 3. Discrepancy Reconciliation & Self-Healing

In production financial networks, network partitions or transient crashes can cause the read-model projection store (e.g. PostgreSQL) to become out of sync with the true Active Contract Set (ACS) on the Canton ledger.

```mermaid
flowchart LR
    subgraph Canton["Canton DevNet Participant"]
        ACS["Active Contract Set (ACS)\nAuthoritative Ground Truth"]
    end

    subgraph API["MandateGuard API Worker"]
        Scanner["ACS Scanner\n(POST /v2/state/active-contracts)"]
        Differ["Two-Way State Differ"]
        Healer["Auto-Healer"]
    end

    subgraph Proj["PostgreSQL Projections"]
        LocalCache["Cached Transfer Requests\nNon-authoritative Read Model"]
    end

    subgraph Audit["Audit Trail"]
        DiscrepancyLog["Discrepancy Alarm & Log"]
    end

    ACS -->|Stream Contracts| Scanner
    LocalCache --> Differ
    Scanner --> Differ
    Differ -->|Detect Drift| DiscrepancyLog
    Differ -->|Apply Delta| Healer
    Healer -->|Update Cache| LocalCache
```

1. **Periodic & Triggered Scans:** The backend worker queries `/v2/state/active-contracts` using template filters (`MandateGuard.Transfer:TransferRequest`).
2. **Two-Way Differ:** Compares contract IDs, states, approval counts, and quantities between the ledger payload and the local database.
3. **Self-Healing:** If an off-ledger database record is out of sync, the local store is automatically updated to reflect the ledger truth, and an audit warning is generated.
