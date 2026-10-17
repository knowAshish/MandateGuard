import { MandateGuardApiServer } from './server.js';

const PORT = parseInt(process.env.PORT || '4000', 10);
const LEDGER_URL = process.env.CANTON_LEDGER_URL || 'http://127.0.0.1:7575';
const OPERATOR_PARTY = process.env.CANTON_OPERATOR_PARTY || 'Operator';
const INSTITUTION_PARTY = process.env.CANTON_INSTITUTION_PARTY || 'InstitutionA';

const server = new MandateGuardApiServer({
  port: PORT,
  ledgerBaseUrl: LEDGER_URL,
  operatorParty: OPERATOR_PARTY,
  institutionParty: INSTITUTION_PARTY,
});

server.start().then(() => {
  console.log(`[MandateGuard API] Server listening on http://localhost:${PORT}`);
  console.log(`[MandateGuard API] Connected Ledger endpoint: ${LEDGER_URL}`);
  console.log(`[MandateGuard API] Operator: ${OPERATOR_PARTY}, Institution: ${INSTITUTION_PARTY}`);
}).catch((err) => {
  console.error('[MandateGuard API] Failed to start server:', err);
  process.exit(1);
});
