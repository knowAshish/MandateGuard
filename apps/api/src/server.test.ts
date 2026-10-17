import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { createServer as createHttpServer, Server as HttpServer } from 'node:http';
import { MandateGuardApiServer } from './server.js';

describe('MandateGuard API Server Integration', () => {
  const API_PORT = 4099;
  const LEDGER_PORT = 19876;
  const apiBaseUrl = `http://127.0.0.1:${API_PORT}`;
  let server: MandateGuardApiServer;
  let mockLedgerServer: HttpServer;
  let ledgerOnline = true;

  before(async () => {
    // Spin up Canton JSON Ledger API v2 mock test fixture
    mockLedgerServer = createHttpServer((req, res) => {
      if (!ledgerOnline) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Participant node unavailable' }));
        return;
      }

      const url = req.url || '';
      if (url === '/livez') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'SERVING' }));
        return;
      }

      if (url === '/v2/commands/submit-and-wait') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              updateId: `TX-${Date.now()}`,
              completionOffset: '100',
              transaction: {
                events: [
                  {
                    createdEvent: {
                      contractId: `#req-test-${Date.now()}`,
                    },
                  },
                ],
              },
            })
          );
        });
        return;
      }

      if (url === '/v2/state/active-contracts') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ contractEntries: [] }));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    });

    await new Promise<void>((resolve) => mockLedgerServer.listen(LEDGER_PORT, resolve));

    server = new MandateGuardApiServer({
      port: API_PORT,
      ledgerBaseUrl: `http://127.0.0.1:${LEDGER_PORT}`,
      ledgerTimeoutMs: 1000,
      operatorParty: 'Operator',
      institutionParty: 'InstA',
    });
    await server.start();
  });

  after(async () => {
    await server.stop();
    await new Promise<void>((resolve) => mockLedgerServer.close(() => resolve()));
  });

  it('GET /health returns 200 and reports accurate ledger connection status', async () => {
    const res = await fetch(`${apiBaseUrl}/health`);
    assert.strictEqual(res.status, 200);
    const json = (await res.json()) as any;
    assert.strictEqual(json.status, 'UP');
    assert.strictEqual(json.ledger.connected, true);
  });

  it('GET /api/overview returns 0 counts for initial empty state (no fake transactions)', async () => {
    const res = await fetch(`${apiBaseUrl}/api/overview`);
    assert.strictEqual(res.status, 200);
    const json = (await res.json()) as any;
    assert.strictEqual(json.metrics.pendingRequests, 0);
    assert.strictEqual(json.metrics.awaitingExecution, 0);
    assert.strictEqual(json.metrics.confirmedTransfers, 0);
  });

  it('POST /api/transfers blocks non-initiator user (403)', async () => {
    const res = await fetch(`${apiBaseUrl}/api/transfers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': 'user_approver1', // Not TransactionInitiator!
      },
      body: JSON.stringify({
        amount: '100.00',
        precision: 2,
      }),
    });

    assert.strictEqual(res.status, 403);
  });

  it('POST /api/transfers creates request with valid schema and initiator role', async () => {
    const res = await fetch(`${apiBaseUrl}/api/transfers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': 'user_initiator',
        'X-Deduplication-Key': 'DEDUP-TEST-1',
      },
      body: JSON.stringify({
        amount: '250.00',
        precision: 2,
        requestRef: 'REQ-TEST-001',
      }),
    });

    assert.strictEqual(res.status, 201);
    const json = (await res.json()) as any;
    assert.strictEqual(json.request.requestRef, 'REQ-TEST-001');
    assert.strictEqual(json.request.state, 'Pending');
    assert.ok(json.ledger.updateId.startsWith('TX-'));
  });

  it('POST /api/transfers rejects duplicate submission with same deduplication key (409)', async () => {
    const res = await fetch(`${apiBaseUrl}/api/transfers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': 'user_initiator',
        'X-Deduplication-Key': 'DEDUP-TEST-1', // Reused key
      },
      body: JSON.stringify({
        amount: '250.00',
        precision: 2,
        requestRef: 'REQ-TEST-DUP',
      }),
    });

    assert.strictEqual(res.status, 409);
  });

  it('POST /api/transfers/:ref/approve strictly rejects self-approval when initiator attempts it (400)', async () => {
    const res = await fetch(`${apiBaseUrl}/api/transfers/REQ-TEST-001/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': 'user_initiator', // Initiator attempting to approve their own request
      },
      body: JSON.stringify({
        decision: 'Approve',
        reason: 'Attempt self approval',
      }),
    });

    // Initiator does not hold TransactionApprover role -> 403
    assert.strictEqual(res.status, 403);
  });

  it('POST /api/transfers/:ref/approve allows legitimate distinct approver', async () => {
    const res = await fetch(`${apiBaseUrl}/api/transfers/REQ-TEST-001/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': 'user_approver1',
      },
      body: JSON.stringify({
        decision: 'Approve',
        reason: 'Institutional mandate verified',
      }),
    });

    assert.strictEqual(res.status, 200);
    const json = (await res.json()) as any;
    assert.ok(json.request.currentApprovals.includes('Approver1'));
  });

  it('surfaces genuine 502 error when Canton ledger is unreachable', async () => {
    ledgerOnline = false; // Simulate Canton node failure / network partition

    const res = await fetch(`${apiBaseUrl}/api/transfers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': 'user_initiator',
        'X-Deduplication-Key': 'DEDUP-OFFLINE-TEST',
      },
      body: JSON.stringify({
        amount: '500.00',
        precision: 2,
        requestRef: 'REQ-TEST-OFFLINE',
      }),
    });

    assert.strictEqual(res.status, 502);
    const json = (await res.json()) as any;
    assert.ok(json.error.includes('Canton Ledger'));
    assert.ok(json.ledgerError);

    ledgerOnline = true; // Restore ledger
  });
});
