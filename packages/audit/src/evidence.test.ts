import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AuditService, SecurityEventDetector } from './evidence.js';

describe('AuditService', () => {
  it('generates consistent SHA-256 hashes for equivalent payloads regardless of key order', () => {
    const payload1 = { requestRef: 'REQ-1', amount: 1000, recipient: 'Alice' };
    const payload2 = { recipient: 'Alice', amount: 1000, requestRef: 'REQ-1' };

    const hash1 = AuditService.hashPayload(payload1);
    const hash2 = AuditService.hashPayload(payload2);
    assert.strictEqual(hash1, hash2);
    assert.strictEqual(hash1.length, 64);
  });

  it('builds valid EvidenceRef structures with sha256 prefix', () => {
    const ev = AuditService.createEvidenceRef('approval', { decision: 'Approve' });
    assert.ok(ev.evidenceId.startsWith('EVD-'));
    assert.ok(ev.hash.startsWith('sha256:'));
    assert.strictEqual(ev.evidenceType, 'approval');
  });
});

describe('SecurityEventDetector', () => {
  it('triggers alert on 3 consecutive rejected actions', () => {
    const detector = new SecurityEventDetector();
    assert.strictEqual(detector.recordAttempt('Alice', 'REQ-1', 'SelfApprovalAttempt', true), null);
    assert.strictEqual(detector.recordAttempt('Alice', 'REQ-2', 'SelfApprovalAttempt', true), null);
    const alert = detector.recordAttempt('Alice', 'REQ-3', 'SelfApprovalAttempt', true);

    assert.ok(alert !== null);
    assert.strictEqual(alert.severity, 'High');
    assert.ok(alert.description.includes('3 consecutive rejected operations'));
  });
});
