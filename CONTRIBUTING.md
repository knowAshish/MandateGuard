# Contributing to MandateGuard

Thank you for your interest in contributing to **MandateGuard**. As an institutional digital-asset firewall and transaction authorization control plane, this repository maintains rigorous standards of security, determinism, and test coverage.

---

## 1. Development Principles

1. **Daml Contractual Primacy:** Never implement authorization checks exclusively in JavaScript or TypeScript. All core security invariants (dual control, self-approval prevention, emergency hold blocking, and limit enforcement) must be enforced authoritative on-ledger in Daml contract preconditions.
2. **Zero-Float Math:** Never use JavaScript numbers or IEEE 754 floating-point arithmetic for monetary calculations. Always utilize `Money` integer sub-units (`bigint`) with explicit asset precision.
3. **No Synthetic Success:** Never fake Canton transaction hashes, contract IDs, or participant responses in production or integration code. When a node is offline or rejecting, surface genuine errors and HTTP 502 statuses.
4. **100% Test Coverage:** Any change to a Daml template or choice must be accompanied by comprehensive Daml Script test scenarios exercising both positive transitions and expected assertion failures (`submitMultiMustFail`).

---

## 2. Setting Up the Development Workspace

### Prerequisites
- **DPM (Daml Package Manager):** `1.0.22` (or Canton SDK `3.6.0` / `3.6.2`)
- **Node.js:** `>= 20.0.0` (Verified: `v24.4.1`)
- **Java OpenJDK:** `>= 17` (Verified: `25.0.3`)

### Initial Build Steps
```bash
# 1. Install npm dependencies
npm install

# 2. Compile Daml smart contracts
cd daml/main && dpm build && cd ../..

# 3. Generate TypeScript contract bindings
npm run codegen

# 4. Build all TypeScript packages, API, and Operations Console
npm run build
```

---

## 3. Running Test Suites

Before submitting any Pull Request, ensure that all test suites pass with zero warnings:

```bash
# 1. Run Daml Script Contract Tests
cd daml/test && dpm test && cd ../..

# 2. Run TypeScript Monorepo & Security Review Test Suites
npm test
```

---

## 4. Pull Request Workflow

1. Fork the repository and create your feature branch from `main`:
   ```bash
   git checkout -b feature/institutional-enhancement
   ```
2. Write clean, self-documenting code with descriptive commits.
3. Update relevant documentation in `docs/` and add test coverage.
4. Ensure `npm run build && npm test` passes locally.
5. Submit your PR with a thorough summary of architectural impact and test evidence.
