# MandateGuard Threat Model & Attack Surface Analysis

## 1. Scope & Objective

This document formalizes the threat model for **MandateGuard**, an institutional digital-asset mandate firewall deployed on the **Canton Network**. It systematically assesses attack vectors, threat actors, security assumptions, and verification evidence according to the STRIDE threat methodology.

---

## 2. Threat Actors & Capabilities

| Threat Actor | Description | Capabilities | Access Level |
| :--- | :--- | :--- | :--- |
| **Malicious Insider (Initiator)** | An authenticated employee authorized to create transfer requests. | Can craft valid JSON payloads, submit high-volume requests, attempt to self-approve. | Possesses valid client session with `TransactionInitiator` role. |
| **Compromised Approver** | An approver whose device or credentials have been compromised. | Can approve pending requests, submit approval decisions with arbitrary reason codes. | Possesses valid client session with `TransactionApprover` role. |
| **Rogue Systems Administrator / DBA** | An operator with direct physical or SSH access to the backend host or PostgreSQL DB. | Can alter database records, modify cached projections, truncate audit tables. | Full database write access, no Canton participant private keys. |
| **Network Man-in-the-Middle (MitM)** | An attacker on the local network intercepting HTTP traffic between frontend and API. | Can inspect payloads, attempt replay attacks, alter transit values. | Network eavesdropping and packet injection. |
| **Untrusted Counterparty** | A compromised or fraudulent recipient attempting to claim unauthorized assets. | Can attempt direct asset transfers, claim unauthorized beneficiary status. | Controls external Canton party, no institutional internal role. |

---

## 3. STRIDE Threat Analysis Matrix

```mermaid
flowchart TD
    subgraph Threats["STRIDE Threat Vectors"]
        S["Spoofing Identity<br/>(Forging Canton Party)"]
        T["Tampering with State<br/>(Database Injection)"]
        R["Repudiation<br/>(Denying Authorization)"]
        I["Information Disclosure<br/>(Contract Snooping)"]
        D["Denial of Service<br/>(Replay / Flooding)"]
        E["Elevation of Privilege<br/>(Self-Approval Collusion)"]
    end

    subgraph Defense["MandateGuard Authoritative Controls"]
        Daml["Daml Smart Contract Preconditions"]
        Audit["SHA-256 Cryptographic Evidence Chain"]
        Dedup["Durable Idempotency Store"]
        Visibility["Dynamic Stakeholder & Observer Scoping"]
        RBAC["Server-Side Party & Role Mapping"]
    end

    S --> RBAC
    T --> Daml
    R --> Audit
    I --> Visibility
    D --> Dedup
    E --> Daml
```

### 3.1 Spoofing (Identity Spoofing)
- **Attack:** An attacker injects `X-User-Id: user_treasury` into browser headers to impersonate a Treasury Controller.
- **Mitigation:** The API server resolves logical roles server-side and checks session credentials. More crucially, the underlying Canton Ledger API enforces party authorization cryptographically: an unauthorized party cannot sign a transaction or exercise choices on contracts where they are not the controller.

### 3.2 Tampering (Data Tampering)
- **Attack:** An attacker with database access alters the `state` column of a `TransferRequest` in PostgreSQL from `Pending` to `Approved`.
- **Mitigation:** Projections in PostgreSQL are non-authoritative read-models. At execution time, the choice `ConfirmExecution` or `AuthorizedTransfer` must be exercised directly against the authoritative Daml contract on the Canton participant. If the Daml contract is not in the `Approved` state, Canton rejects the transaction.

### 3.3 Repudiation (Disputing Transactions)
- **Attack:** An approver claims they never approved a fraudulent $50,000 transfer.
- **Mitigation:** Every approval creates an immutable `ApprovalRecord` contract on-ledger and a deterministic SHA-256 `EvidenceRef` digest capturing the approver party, decision, reason memo, and exact timestamp.

### 3.4 Information Disclosure (Contract Visibility Breach)
- **Attack:** An unassociated institution or observer monitors transactions between Institution A and Vendor B.
- **Mitigation:** Daml contract privacy restricts contract visibility strictly to signatories and explicitly declared observers (`observer initiator :: (currentApprovals ++ eligibleApprovers)`). Outside parties cannot view or query contracts on Canton.

### 3.5 Denial of Service (Replay Attacks & Flooding)
- **Attack:** An attacker captures a valid transfer request and replays it 1,000 times to drain institutional balances.
- **Mitigation:** MandateGuard requires an `X-Deduplication-Key` header on all mutation endpoints. Replay attempts within the submission deduplication window return HTTP 409 Conflict without invoking the ledger.

### 3.6 Elevation of Privilege (Self-Approval Collusion)
- **Attack:** An initiator creates a $500,000 transfer to an accomplice and immediately signs off on the approval.
- **Mitigation:** Enforced at both application and contract boundaries. In `MandateGuard.Transfer:ApproveTransfer`:
  ```daml
  assertMsg "Initiator cannot approve own request" (approver /= initiator)
  ```
  The Canton ledger rejects the transaction with an interpretation error if `approver == initiator`.

---

## 4. Emergency Containment Circuit Analysis

MandateGuard implements an atomic emergency containment breaker:

```mermaid
sequenceDiagram
    autonumber
    participant SecOps as Security Operator
    participant API as MandateGuard API
    participant Canton as Canton Participant
    participant Attacker as Insider / Attacker

    SecOps->>API: POST /api/holds {scope: "Global", reason: "Compromised key"}
    API->>Canton: create EmergencyHold(scope="Global", state="HoldRequested")
    Canton-->>API: Hold Contract Created (#hold-101)

    Note over Attacker,Canton: Attacker attempts to approve or execute transfer
    Attacker->>API: POST /api/transfers/:id/approve
    API->>Canton: exercise ApproveTransfer()
    Note over Canton: Atomic Precondition Check:<br/>Active EmergencyHold exists for mandate scope
    Canton-->>API: REJECTED: Daml Error (EmergencyHoldActive)
    API-->>Attacker: HTTP 502 / 400 (Containment Active)
```

The containment hold is verified in real-time on-ledger and blocks any pending or in-flight transfer execution atomically.
