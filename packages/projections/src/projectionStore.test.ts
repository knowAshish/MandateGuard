import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ProjectionStore } from './projectionStore.js';
import { Money } from '@mandateguard/domain';

describe('ProjectionStore', () => {
  it('deduplicates concurrent command submissions', () => {
    const store = new ProjectionStore();
    const ok1 = store.recordSubmission('CMD-1', 'DEDUP-KEY-100');
    assert.strictEqual(ok1, true);

    // Duplicate submission with same deduplication key
    const ok2 = store.recordSubmission('CMD-2', 'DEDUP-KEY-100');
    assert.strictEqual(ok2, false);
  });

  it('applies events and reconciles discrepancies against authoritative ledger ACS', () => {
    const store = new ProjectionStore();

    store.applyCreatedEvent({
      eventId: 'EV-1',
      offset: '10',
      updateId: 'TX-1',
      eventType: 'Created',
      templateId: 'MandateGuard.Transfer:TransferRequest',
      contractId: '#1:0',
      recordTime: new Date().toISOString(),
      data: {
        requestRef: 'REQ-1',
        initiator: 'Alice',
        quantity: Money.parse('100.00', 2),
      },
    });

    assert.strictEqual(store.getTransferRequests().length, 1);
    assert.strictEqual(store.getTransferRequests()[0].requestRef, 'REQ-1');

    // Simulate ACS reconciliation where #1:0 was archived on ledger and #2:0 was created
    const discrepancies = store.reconcileACS([
      {
        contractId: '#2:0',
        templateId: 'MandateGuard.Transfer:TransferRequest',
        payload: {
          requestRef: 'REQ-2',
          initiator: 'Bob',
          quantity: Money.parse('200.00', 2),
        },
      },
    ]);

    assert.strictEqual(discrepancies.length, 2);
    // #1:0 was auto-healed (deleted) and #2:0 was auto-healed (added)
    const current = store.getTransferRequests();
    assert.strictEqual(current.length, 1);
    assert.strictEqual(current[0].contractId, '#2:0');
  });
});
