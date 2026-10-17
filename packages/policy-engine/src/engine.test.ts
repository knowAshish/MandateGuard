import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PolicyEngine, PolicyEvaluationContext } from './engine.js';
import { Money } from '@mandateguard/domain';

const dummyContext = (): PolicyEvaluationContext => ({
  request: {
    operator: 'Operator',
    institution: 'InstA',
    initiator: 'Alice',
    requestRef: 'REQ-101',
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

describe('PolicyEngine', () => {
  it('returns NeedsApproval when approvals are pending', () => {
    const ctx = dummyContext();
    const result = PolicyEngine.evaluate(ctx);
    assert.strictEqual(result.outcome, 'NeedsApproval');
    assert.strictEqual(result.completedApprovalCount, 0);
  });

  it('rejects self-approval when disallowSelfApproval is true', () => {
    const ctx = dummyContext();
    ctx.existingApprovals = [
      {
        operator: 'Operator',
        institution: 'InstA',
        requestRef: 'REQ-101',
        approver: 'Alice', // Initiator!
        decision: 'Approve',
        approvedQuantity: Money.parse('500.00', 2),
        approvedBeneficiary: ctx.request.beneficiary,
        approvedAssetId: ctx.request.assetId,
        policyRef: ctx.policy.policyRef,
        reason: 'Self approval',
        approvalTime: new Date().toISOString(),
        evidenceRef: { evidenceId: '1', hash: 'h', evidenceType: 'app', timestamp: '' },
      },
      {
        operator: 'Operator',
        institution: 'InstA',
        requestRef: 'REQ-101',
        approver: 'Bob',
        decision: 'Approve',
        approvedQuantity: Money.parse('500.00', 2),
        approvedBeneficiary: ctx.request.beneficiary,
        approvedAssetId: ctx.request.assetId,
        policyRef: ctx.policy.policyRef,
        reason: 'Independent approval',
        approvalTime: new Date().toISOString(),
        evidenceRef: { evidenceId: '2', hash: 'h', evidenceType: 'app', timestamp: '' },
      },
    ];

    const result = PolicyEngine.evaluate(ctx);
    assert.strictEqual(result.outcome, 'NeedsApproval');
    assert.strictEqual(result.completedApprovalCount, 1); // Alice was ignored
  });

  it('authorizes when two independent approvals are present', () => {
    const ctx = dummyContext();
    ctx.existingApprovals = [
      {
        operator: 'Operator',
        institution: 'InstA',
        requestRef: 'REQ-101',
        approver: 'Bob',
        decision: 'Approve',
        approvedQuantity: Money.parse('500.00', 2),
        approvedBeneficiary: ctx.request.beneficiary,
        approvedAssetId: ctx.request.assetId,
        policyRef: ctx.policy.policyRef,
        reason: 'Ok',
        approvalTime: new Date().toISOString(),
        evidenceRef: { evidenceId: '1', hash: 'h', evidenceType: 'app', timestamp: '' },
      },
      {
        operator: 'Operator',
        institution: 'InstA',
        requestRef: 'REQ-101',
        approver: 'Charlie',
        decision: 'Approve',
        approvedQuantity: Money.parse('500.00', 2),
        approvedBeneficiary: ctx.request.beneficiary,
        approvedAssetId: ctx.request.assetId,
        policyRef: ctx.policy.policyRef,
        reason: 'Ok',
        approvalTime: new Date().toISOString(),
        evidenceRef: { evidenceId: '2', hash: 'h', evidenceType: 'app', timestamp: '' },
      },
    ];

    const result = PolicyEngine.evaluate(ctx);
    assert.strictEqual(result.outcome, 'Authorized');
    assert.strictEqual(result.completedApprovalCount, 2);
  });

  it('denies when single transfer limit is exceeded', () => {
    const ctx = dummyContext();
    ctx.request.quantity = Money.parse('1500.00', 2); // Exceeds 1000.00
    const result = PolicyEngine.evaluate(ctx);
    assert.strictEqual(result.outcome, 'Denied');
    assert.ok(result.reasonCodes.includes('LimitExceeded'));
  });

  it('denies when active emergency hold applies to the mandate', () => {
    const ctx = dummyContext();
    ctx.activeHolds = [
      {
        operator: 'Operator',
        institution: 'InstA',
        holdInitiator: 'SecOps',
        holdId: 'HOLD-99',
        scope: 'Mandate:MANDATE-001',
        scopeRef: ctx.mandate.mandateRef,
        reason: 'Compromised key',
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
});
