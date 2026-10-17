# MandateGuard Security Model & Threat Analysis

## 1. Threat Matrix & Trust Boundaries

MandateGuard operates under an institutional adversarial threat model where neither individual human operators nor off-chain client software are unconditionally trusted.

```
+---------------------------------------------------------------------------------------+
|  UNTRUSTED ZONE: Browser Client                                                       |
|  - May be infected by client-side malware or malicious extensions                     |
|  - Browser-supplied headers (e.g. X-User-Id) are authenticated server-side            |
|  - Browser NEVER holds Canton signing keys or credentials                             |
+---------------------------------------------------------------------------------------+
                                        | (Authenticated Session)
                                        v
+---------------------------------------------------------------------------------------+
|  SEMI-TRUSTED ZONE: Backend API Gateway & PostgreSQL                                  |
|  - Enforces idempotency, request deduplication, and schema validation                 |
|  - Evaluates pre-flight policy rules and rate limits                                  |
|  - Projections in PostgreSQL are non-authoritative read models                        |
|  - CANNOT forge Daml transactions or bypass multi-party signature rules               |
+---------------------------------------------------------------------------------------+
                                        | (Canton JSON Ledger API v2)
                                        v
+---------------------------------------------------------------------------------------+
|  TRUSTED BOUNDARY: Canton Network & Daml Contract Execution Engine                    |
|  - Cryptographically enforces Daml signatories, observers, and choice controllers    |
|  - Rejects transactions failing preconditions (e.g. self-approval, limits, holds)     |
|  - Provides final, immutable settlement and multi-party non-repudiation               |
+---------------------------------------------------------------------------------------+
```

---

## 2. Threat Analysis & Mitigations

| Threat Vector | Attack Scenario | MandateGuard Defense Mechanism |
| :--- | :--- | :--- |
| **Self-Approval Collusion** | An initiator creates a fraudulent transfer and attempts to sign off on their own approval. | **Dual-Layer Defense:**<br>1. *Daml Invariant:* Precondition `assertMsg "Initiator cannot approve own request" (approver /= initiator)` in choice `ApproveTransfer`.<br>2. *Backend Policy:* `PolicyEngine` rejects self-approval and logs a high-severity security alert. |
| **Replay / Duplicate Submission** | Attacker intercepts a network packet and replays an identical transfer request. | **Idempotent Command Guard:** Every command requires a unique `X-Deduplication-Key`. Duplicate keys within the submission window return HTTP 409 Conflict without ledger re-execution. |
| **Emergency Hold Race** | Rogue insider submits transfer during a security incident. | **Atomic Precondition:** Daml contract choice verifies whether an active `EmergencyHold` exists for the mandate scope. If a hold is active, execution is strictly denied. |
| **Policy Tampering** | Attacker modifies policy limit directly in the PostgreSQL database. | **Authoritative State Invariant:** Projections in PostgreSQL are read-only caches. At execution time, the Canton ledger checks the active `PolicyVersion` contract on-chain, nullifying database tampering. |
| **Floating-Point Drift Exploitation** | Precision truncation exploit where fractional pennies accumulate or escape balance limits. | **Zero-Float Math:** Pure 64-bit integer sub-unit representation (`BigInt`). Precision overflow is rejected at input parsing. |
| **Stale / Revoked Authority** | An approver whose role was revoked attempts to exercise an outstanding approval choice. | **Contract Key / Role Invalidation:** Daml choice verifies active `RoleAssignment` status on-ledger. Revoked assignments fail precondition validation. |
| **Audit Log Tampering** | Rogue DBA attempts to rewrite audit trail logs. | **Cryptographic SHA-256 Evidence Digests:** All events compute deterministic SHA-256 payload digests (`EvidenceRef`). Discrepancies between logged hashes and contract payloads are immediately flagged. |

---

## 3. Analysis of Asset Transfer Bypass

> [!IMPORTANT]
> **Boundary of Protection Notice:**
> MandateGuard protects assets whose holding contracts explicitly delegate authorization to MandateGuard templates.

1. **Protected Assets:** When an asset holding contract (such as `MandateGuard.Asset:TestAssetHolding`) defines its transfer choice as:
   ```daml
   choice AuthorizedTransfer : ContractId TestAssetHolding
     with
       authorizationId : ContractId TransferRequest
     controller operator, owner
   ```
   The asset **cannot move** without presenting a confirmed, fully-approved `TransferRequest` contract. Bypass is mathematically and contractually impossible.

2. **Unprotected / External Assets:** If an asset is held in an external Daml template that does not require a `TransferRequest` reference or whose controller does not include the MandateGuard operator, MandateGuard does **not** claim to prevent direct ledger exercises on that external contract.
