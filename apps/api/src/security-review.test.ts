import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { createServer as createHttpServer, Server as HttpServer } from 'node:http';
import { MandateGuardApiServer } from './server.js';
import { Money, TransferRequestData, PolicyVersionData, MandateRef, AssetId } from '@mandateguard/domain';
import { PolicyEngine, PolicyEvaluationContext } from '@mandateguard/policy-engine';
import { AuditService, SecurityEventDetector } from '@mandateguard/audit';

describe('Milestone 7: MandateGuard Automated Security Review Suite', () => {
  const PORT = 4199;
  const LEDGER_PORT = 19999;
  const baseUrl = `http://127.0.0.1:${PORT}`;
  let server: MandateGuardApiServer;
  let mockLedger: HttpServer;

  const dummyContext = (): PolicyEvaluationContext => ({
    request: {
      operator: 'Operator',
      institution: 'InstA',
      initiator: 'Alice',
      requestRef: 'REQ-SEC-101',
      assetId: { assetCode: 'TEST-USD', issuerRef: 'Issuer' },
      beneficiary: { registryId: 'BEN-001', displayName: 'Approved Vendor' },
      quantity: Money.parse('500.00', 2),
      mandateRef: { institution: 'InstA', mandateId: 'MANDATE-001' },
      policyRef: { policyId: 'POL-001', version: 1 },
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      requiredApprovals: 2,
      currentApprovals: [],
      eligibleApprovers: ['Bob', 'Charlie'],
      state: 'Pending',
      evidenceRefs: [],
    },
    policy: {
      operator: 'Operator',
      institution: 'InstA',
      policyRef: { policyId: 'POL-001', version: 1 },
      applicableAssets: [{ assetCode: 'TEST-USD', issuerRef: 'Issuer' }],
      maxSingleTransfer: Money.parse('1000.00', 2),
      dailyRollingLimit: Money.parse('5000.00', 2),
      requiredApprovals: 2,
      disallowSelfApproval: true,
      effectiveFrom: new Date(Date.now() - 86400000).toISOString(),
      active: true,
      emergencyHoldRequired: false,
    },
    mandate: {
      operator: 'Operator',
      institution: 'InstA',
      mandateRef: { institution: 'InstA', mandateId: 'MANDATE-001' },
      authorizedAssets: [{ assetCode: 'TEST-USD', issuerRef: 'Issuer' }],
      permittedTransactionTypes: ['Transfer'],
      permittedBeneficiaryScope: ['ALL'],
      maxSingleTransfer: Money.parse('1000.00', 2),
      dailyLimit: Money.parse('5000.00', 2),
      requiredApprovals: 2,
      effectivePolicyRef: { policyId: 'POL-001', version: 1 },
      effectiveFrom: new Date(Date.now() - 86400000).toISOString(),
      revoked: false,
      governanceApprovers: ['Gov1'],
    },
    beneficiary: {
      operator: 'Operator',
      institution: 'InstA',
      beneficiary: { registryId: 'BEN-001', displayName: 'Approved Vendor' },
      permittedAssets: [{ assetCode: 'TEST-USD', issuerRef: 'Issuer' }],
      effectiveFrom: new Date(Date.now() - 86400000).toISOString(),
      revoked: false,
      version: 1,
      approvedBy: ['Gov1'],
    },
    activeHolds: [],
    existingApprovals: [],
    rollingWindowTransfers: [],
    evaluationTime: new Date(),
  });

  before(async () => {
    mockLedger = createHttpServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            updateId: `TX-SEC-${Date.now()}`,
            completionOffset: '500',
            transaction: {
              events: [{ createdEvent: { contractId: `#req-sec-${Date.now()}` } }],
            },
          })
        );
      });
    });

    await new Promise<void>((resolve) => mockLedger.listen(LEDGER_PORT, resolve));

    server = new MandateGuardApiServer({
      port: PORT,
      ledgerBaseUrl: `http://127.0.0.1:${LEDGER_PORT}`,
      ledgerTimeoutMs: 1000,
      operatorParty: 'Operator',
      institutionParty: 'InstA',
    });
    await server.start();
  });

  after(async () => {
    await server.stop();
    await new Promise<void>((resolve) => mockLedger.close(() => resolve()));
  });

  it('[SEC-01] Strict Self-Approval Rejection: Initiator is barred from approving own transfer', async () => {
    // 1. Create request as user_initiator
    const createRes = await fetch(`${baseUrl}/api/transfers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': 'user_initiator',
        'X-Deduplication-Key': 'SEC-DEDUP-01',
      },
      body: JSON.stringify({
        amount: '1500.00',
        precision: 2,
        requestRef: 'REQ-SEC-SELF-APPROVE',
      }),
    });
    assert.strictEqual(createRes.status, 201);

    // 2. Attempt approval as user_initiator -> Must be rejected (403 or 400)
    const approveRes = await fetch(`${baseUrl}/api/transfers/REQ-SEC-SELF-APPROVE/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': 'user_initiator',
      },
      body: JSON.stringify({
        decision: 'Approve',
        reason: 'Attempting illicit self approval',
      }),
    });

    assert.strictEqual(approveRes.status, 403);
  });

  it('[SEC-02] Separation of Duties: Approver cannot initiate transfers', async () => {
    const res = await fetch(`${baseUrl}/api/transfers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': 'user_approver1', // Unauthorized to initiate
        'X-Deduplication-Key': 'SEC-DEDUP-02',
      },
      body: JSON.stringify({
        amount: '100.00',
        precision: 2,
        requestRef: 'REQ-ILLEGAL-INITIATION',
      }),
    });

    assert.strictEqual(res.status, 403);
    const json = (await res.json()) as any;
    assert.ok(json.error.includes('TransactionInitiator'));
  });

  it('[SEC-03] Replay Attack Prevention: Duplicate deduplication key is strictly rejected (409)', async () => {
    const res = await fetch(`${baseUrl}/api/transfers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': 'user_initiator',
        'X-Deduplication-Key': 'SEC-DEDUP-01', // Replaying SEC-DEDUP-01
      },
      body: JSON.stringify({
        amount: '1500.00',
        precision: 2,
        requestRef: 'REQ-SEC-REPLAY',
      }),
    });

    assert.strictEqual(res.status, 409);
    const json = (await res.json()) as any;
    assert.ok(json.error.includes('Duplicate submission rejected'));
  });

  it('[SEC-04] Policy Limit Guard: Single transfer limit violation is denied by PolicyEngine', () => {
    const ctx = dummyContext();
    ctx.request.quantity = Money.parse('150000.00', 2); // $150,000 exceeds $1,000 maxSingleTransfer

    const result = PolicyEngine.evaluate(ctx);
    assert.strictEqual(result.outcome, 'Denied');
    assert.ok(result.reasonCodes.includes('LimitExceeded'));
  });

  it('[SEC-05] Emergency Hold Containment: Active hold blocks transaction authorization', () => {
    const ctx = dummyContext();
    ctx.activeHolds = [
      {
        operator: 'Operator',
        institution: 'InstA',
        holdInitiator: 'SecOps',
        holdId: 'HOLD-CRITICAL-01',
        scope: 'Global',
        scopeRef: { institution: 'InstA', mandateId: 'MANDATE-001' },
        reason: 'Suspected key leak',
        effectiveFrom: new Date().toISOString(),
        requiredApprovals: 2,
        approvals: ['SecOps', 'Approver1'],
        eligibleApprovers: ['SecOps', 'Approver1'],
        state: 'HoldActive',
        releaseConditions: 'Audit required',
      },
    ];

    const result = PolicyEngine.evaluate(ctx);
    assert.strictEqual(result.outcome, 'Denied');
    assert.ok(result.reasonCodes.includes('HoldActive'));
  });

  it('[SEC-06] Integer Monetary Guard: Float parsing and precision overflow are rejected', () => {
    // 3 decimal places when precision is 2 -> Must throw
    assert.throws(() => {
      Money.parse('100.555', 2);
    }, /exceeds permitted precision/);

    // Exact sub-unit representation
    const m = Money.parse('250.75', 2);
    assert.strictEqual(m.amount, 25075n);
    assert.strictEqual(Money.format(m), '250.75');
  });

  it('[SEC-07] Cryptographic Tampering Detection: Digest verification catches altered audit records', () => {
    const originalPayload = { requestRef: 'REQ-123', amount: '50000', approver: 'Approver1' };
    const evidenceRef = AuditService.createEvidenceRef('approval', originalPayload);

    // Evidence ref prefix check
    assert.ok(evidenceRef.hash.startsWith('sha256:'));

    // Hash of original matches
    const originalHash = AuditService.hashPayload(originalPayload);
    assert.strictEqual(evidenceRef.hash, `sha256:${originalHash}`);

    // If an attacker tampers with amount from 50000 to 500000:
    const tamperedPayload = { requestRef: 'REQ-123', amount: '500000', approver: 'Approver1' };
    const tamperedHash = AuditService.hashPayload(tamperedPayload);
    assert.notStrictEqual(originalHash, tamperedHash);
  });

  it('[SEC-08] Anomaly Detector: Triggers alert on 3 consecutive rejected operations', () => {
    const detector = new SecurityEventDetector();

    const a1 = detector.recordAttempt('AttackerParty', 'REQ-1', 'SelfApprovalAttempt', true);
    assert.strictEqual(a1, null);

    const a2 = detector.recordAttempt('AttackerParty', 'REQ-2', 'SelfApprovalAttempt', true);
    assert.strictEqual(a2, null);

    // 3rd consecutive rejection triggers alarm
    const a3 = detector.recordAttempt('AttackerParty', 'REQ-3', 'SelfApprovalAttempt', true);
    assert.notStrictEqual(a3, null);
    assert.strictEqual(a3?.severity, 'High');
    assert.strictEqual(a3?.actor, 'AttackerParty');
  });
});
