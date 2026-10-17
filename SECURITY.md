# MandateGuard Security Policy

## 1. Security Overview

MandateGuard is an institutional transaction authorization control plane designed for high-assurance digital-asset environments running on the Canton distributed ledger. The security of this codebase relies on cryptographic proofs, authoritative Daml contract preconditions, and strict separation of operational duties.

---

## 2. Supported Versions

Security updates are applied to the active release stream:

| Version | Supported | Maintenance Status |
| :--- | :--- | :--- |
| `0.1.x` (DevNet Release) | :white_check_mark: | Active Security Maintenance |
| `< 0.1.0` | :x: | Deprecated |

---

## 3. Reporting a Vulnerability

We appreciate the efforts of security researchers and practitioners in identifying potential vulnerabilities.

### Responsible Disclosure Process
1. **Do NOT report security vulnerabilities via public GitHub issues, discussions, or pull requests.**
2. Send a detailed vulnerability report via encrypted email to:
   **`security@mandateguard.network`** (or create a private GitHub Security Advisory).
3. Include the following details in your report:
   - Component affected (Daml contract template, API Gateway, Policy Engine, Ledger Client, or Projections).
   - Detailed step-by-step reproduction instructions or a minimal test script.
   - Attack vector, preconditions, and potential business impact (e.g., self-approval bypass, limit breach, containment race).
   - Any suggested mitigations or patches.

### Response Timelines
- **Initial Acknowledgment:** Within 48 hours of receipt.
- **Triage & Assessment:** Within 5 business days.
- **Patch Release & Advisory:** Coordinated release within 30 days depending on severity.

---

## 4. Threat Boundaries & Non-Vulnerabilities

The following scenarios are considered outside the threat boundary of MandateGuard:
- **Unsupported External Holding Contracts:** Asset contracts that do not require an authorized `TransferRequest` reference or whose choice controllers bypass the MandateGuard operator.
- **Client-Side Header Manipulation:** Altering `X-User-Id` in a browser session without possessing an authorized Canton party key. The backend resolves identities server-side and the Canton ledger rejects unauthorized choice controllers.
- **Network Partitioning on DevNet:** Standard Canton consensus delays resulting from participant offline status are handled gracefully via HTTP 502 Bad Gateway responses and do not constitute ledger state corruption.
