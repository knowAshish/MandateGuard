import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CantonLedgerClient } from './client.js';

describe('CantonLedgerClient', () => {
  it('instantiates correctly and handles unreachable endpoints safely', async () => {
    // Port 19876 is intentionally not running
    const client = new CantonLedgerClient({
      baseUrl: 'http://127.0.0.1:19876',
      timeoutMs: 1000,
    });

    const health = await client.checkHealth();
    assert.strictEqual(health.connected, false);
    assert.ok(health.error !== undefined);
  });

  it('fails gracefully on submitAndWait when ledger is unreachable', async () => {
    const client = new CantonLedgerClient({
      baseUrl: 'http://127.0.0.1:19876',
      timeoutMs: 1000,
    });

    const response = await client.submitAndWait({
      actAs: ['Alice'],
      commands: [
        {
          commandType: 'create',
          templateId: 'MandateGuard.Transfer:TransferRequest',
          payload: {},
        },
      ],
    });

    assert.strictEqual(response.status, 'ERROR');
    assert.ok(response.errorMessage !== undefined);
  });
});
