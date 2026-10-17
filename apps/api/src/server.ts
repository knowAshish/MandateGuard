import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import {
  TransferRequestData,
  PolicyVersionData,
  BeneficiaryMandateData,
  InstitutionalMandateData,
  EmergencyHoldData,
  IncidentCaseData,
  Quantity,
  Money,
  DomainValidator,
  AuthenticatedUser,
} from '@mandateguard/domain';
import { CantonLedgerClient } from '@mandateguard/ledger-client';
import { PolicyEngine } from '@mandateguard/policy-engine';
import { AuditService, SecurityEventDetector } from '@mandateguard/audit';
import { ProjectionStore } from '@mandateguard/projections';

export interface ServerConfig {
  port: number;
  ledgerBaseUrl: string;
  ledgerToken?: string;
  ledgerTimeoutMs?: number;
  operatorParty: string;
  institutionParty: string;
}

export class MandateGuardApiServer {
  private server = createServer(this.handleRequest.bind(this));
  private ledger: CantonLedgerClient;
  private projectionStore = new ProjectionStore();
  private securityDetector = new SecurityEventDetector();
  private config: ServerConfig;

  // Mock authenticated directory for role resolution (server-side, never trusting browser)
  private userDirectory: Map<string, AuthenticatedUser> = new Map([
    [
      'user_initiator',
      {
        userId: 'usr_init_1',
        email: 'initiator@institution.com',
        institutionId: 'InstA',
        roles: ['TransactionInitiator'],
        cantonPartyId: 'Initiator',
      },
    ],
    [
      'user_approver1',
      {
        userId: 'usr_app_1',
        email: 'approver1@institution.com',
        institutionId: 'InstA',
        roles: ['TransactionApprover'],
        cantonPartyId: 'Approver1',
      },
    ],
    [
      'user_approver2',
      {
        userId: 'usr_app_2',
        email: 'approver2@institution.com',
        institutionId: 'InstA',
        roles: ['TransactionApprover'],
        cantonPartyId: 'Approver2',
      },
    ],
    [
      'user_secops',
      {
        userId: 'usr_sec_1',
        email: 'secops@institution.com',
        institutionId: 'InstA',
        roles: ['SecurityOperator'],
        cantonPartyId: 'SecOps',
      },
    ],
    [
      'user_treasury',
      {
        userId: 'usr_tr_1',
        email: 'treasury@institution.com',
        institutionId: 'InstA',
        roles: ['TreasuryController', 'PolicyAdministrator'],
        cantonPartyId: 'TreasuryCtrl',
      },
    ],
  ]);

  constructor(config: ServerConfig) {
    this.config = config;
    this.ledger = new CantonLedgerClient({
      baseUrl: config.ledgerBaseUrl,
      token: config.ledgerToken,
      timeoutMs: config.ledgerTimeoutMs || 30000,
    });
  }

  getProjectionStore(): ProjectionStore {
    return this.projectionStore;
  }

  getLedgerClient(): CantonLedgerClient {
    return this.ledger;
  }

  private async parseBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        if (!body) return resolve({});
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('Invalid JSON payload'));
        }
      });
      req.on('error', reject);
    });
  }

  private sendJson(
    res: ServerResponse,
    status: number,
    data: unknown,
    correlationId: string
  ): void {
    if (res.headersSent) {
      return;
    }
    try {
      const jsonStr = JSON.stringify(data, (_, v) =>
        typeof v === 'bigint' ? v.toString() : v
      );
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'X-Correlation-ID': correlationId,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id, X-Deduplication-Key',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
      });
      res.end(jsonStr);
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId });
        res.end(JSON.stringify({ error: 'Serialization error', details: (err as Error).message }));
      }
    }
  }

  private resolveUser(req: IncomingMessage): AuthenticatedUser {
    const userHeader = (req.headers['x-user-id'] as string) || 'user_initiator';
    return (
      this.userDirectory.get(userHeader) || {
        userId: 'anonymous',
        email: 'guest@institution.com',
        institutionId: this.config.institutionParty,
        roles: [],
        cantonPartyId: 'Anonymous',
      }
    );
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const correlationId = (req.headers['x-correlation-id'] as string) || `CORR-${randomUUID()}`;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id, X-Deduplication-Key',
      });
      res.end();
      return;
    }

    const user = this.resolveUser(req);
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    try {
      // 1. Health & Readiness
      if (req.method === 'GET' && (pathname === '/health' || pathname === '/ready')) {
        const ledgerHealth = await this.ledger.checkHealth();
        return this.sendJson(
          res,
          200,
          {
            status: 'UP',
            ledger: ledgerHealth,
            timestamp: new Date().toISOString(),
          },
          correlationId
        );
      }

      // 2. Identity Info (/api/me)
      if (req.method === 'GET' && pathname === '/api/me') {
        return this.sendJson(res, 200, { user }, correlationId);
      }

      // 3. Security Overview Metrics
      if (req.method === 'GET' && pathname === '/api/overview') {
        const requests = this.projectionStore.getTransferRequests();
        const holds = this.projectionStore.getActiveHolds();
        const policies = this.projectionStore.getPolicies();
        const incidents = this.projectionStore.getIncidents();
        const ledgerHealth = await this.ledger.checkHealth();

        const pending = requests.filter((r) => r.state === 'Pending' || r.state === 'AwaitingApproval').length;
        const approved = requests.filter((r) => r.state === 'Approved').length;
        const confirmed = requests.filter((r) => r.state === 'Confirmed').length;
        const rejected = requests.filter((r) => r.state === 'Rejected').length;

        return this.sendJson(
          res,
          200,
          {
            metrics: {
              pendingRequests: pending,
              awaitingExecution: approved,
              confirmedTransfers: confirmed,
              rejectedTransfers: rejected,
              activeHolds: holds.length,
              activePolicies: policies.filter((p) => p.active).length,
              securityIncidents: incidents.filter((i) => i.state !== 'IncidentClosed').length,
              reconciliationDiscrepancies: this.projectionStore.getDiscrepancies().length,
            },
            ledgerHealth,
          },
          correlationId
        );
      }

      // 4. Transfer Requests
      if (req.method === 'GET' && pathname === '/api/transfers') {
        const requests = this.projectionStore.getTransferRequests();
        return this.sendJson(res, 200, { requests }, correlationId);
      }

      if (req.method === 'POST' && pathname === '/api/transfers') {
        // Enforce Initiator Role
        if (!user.roles.includes('TransactionInitiator')) {
          this.securityDetector.recordAttempt(user.cantonPartyId, 'TransferCreate', 'UnauthorizedInitiation', true);
          return this.sendJson(res, 403, { error: 'User does not possess TransactionInitiator role.' }, correlationId);
        }

        const dedupKey = (req.headers['x-deduplication-key'] as string) || `DEDUP-${randomUUID()}`;
        const canSubmit = this.projectionStore.recordSubmission(randomUUID(), dedupKey);
        if (!canSubmit) {
          return this.sendJson(res, 409, { error: 'Duplicate submission rejected by idempotency guard.' }, correlationId);
        }

        const body = await this.parseBody(req);
        const quantity = Money.parse(body.amount, body.precision || 2);

        const requestRef = body.requestRef || `REQ-${Date.now().toString(36).toUpperCase()}`;
        const transferReq: TransferRequestData = {
          operator: this.config.operatorParty,
          institution: user.institutionId,
          initiator: user.cantonPartyId,
          requestRef,
          assetId: body.assetId || { assetCode: 'TEST-USD', issuerRef: 'MandateGuard' },
          beneficiary: body.beneficiary || { registryId: 'BEN-DEFAULT', displayName: 'Default Vendor' },
          quantity,
          mandateRef: body.mandateRef || { institution: user.institutionId, mandateId: 'MANDATE-PRIMARY' },
          policyRef: body.policyRef || { policyId: 'POLICY-PRIMARY', version: 1 },
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + (body.validityHours || 24) * 3600000).toISOString(),
          requiredApprovals: body.requiredApprovals || 2,
          currentApprovals: [],
          eligibleApprovers: body.eligibleApprovers || ['Approver1', 'Approver2'],
          state: 'Pending',
          evidenceRefs: [],
        };

        const validation = DomainValidator.validateTransferRequest(transferReq);
        if (!validation.valid) {
          this.projectionStore.updateCommandStatus(dedupKey, 'Failed', undefined, validation.errors.join(', '));
          return this.sendJson(res, 400, { errors: validation.errors }, correlationId);
        }

        // Submit to Ledger
        const subRes = await this.ledger.submitAndWait({
          actAs: [this.config.operatorParty, user.institutionId],
          commands: [
            {
              commandType: 'create',
              templateId: 'MandateGuard.Transfer:TransferRequest',
              payload: {
                operator: transferReq.operator,
                institution: transferReq.institution,
                initiator: transferReq.initiator,
                requestRef: transferReq.requestRef,
                assetId: transferReq.assetId,
                assetContractRef: null,
                beneficiary: transferReq.beneficiary,
                quantity: { amount: transferReq.quantity.amount.toString(), precision: transferReq.quantity.precision },
                mandateRef: transferReq.mandateRef,
                policyRef: transferReq.policyRef,
                createdAt: transferReq.createdAt,
                expiresAt: transferReq.expiresAt,
                requiredApprovals: transferReq.requiredApprovals,
                currentApprovals: [],
                eligibleApprovers: transferReq.eligibleApprovers,
                state: 'Pending',
                evidenceRefs: [],
                executionOutcome: null,
                executionUpdateId: null,
              },
            },
          ],
        });

        if (subRes.status === 'ERROR') {
          this.projectionStore.updateCommandStatus(dedupKey, 'Failed', undefined, subRes.errorMessage);
          return this.sendJson(
            res,
            502,
            {
              error: 'Canton Ledger submission failed or participant unreachable',
              ledgerError: subRes.errorMessage,
              correlationId,
            },
            correlationId
          );
        }

        const contractId = subRes.contractId || `#req:${randomUUID().slice(0, 8)}`;
        this.projectionStore.applyCreatedEvent({
          eventId: randomUUID(),
          offset: subRes.completionOffset,
          updateId: subRes.updateId,
          eventType: 'Created',
          templateId: 'MandateGuard.Transfer:TransferRequest',
          contractId,
          recordTime: new Date().toISOString(),
          data: transferReq,
        });

        this.projectionStore.recordAudit(
          AuditService.createAuditRecord({
            actionType: 'RequestCreated',
            correlationId,
            requestRef,
            actorUserId: user.userId,
            actorPartyId: user.cantonPartyId,
            institutionPartyId: user.institutionId,
            ledgerUpdateId: subRes.updateId,
            details: { requestRef, quantity: Money.format(quantity), initiator: user.cantonPartyId },
          })
        );

        this.projectionStore.updateCommandStatus(dedupKey, 'Confirmed', subRes.updateId);
        return this.sendJson(res, 201, { request: { ...transferReq, contractId }, ledger: subRes }, correlationId);
      }

      // 5. Transfer Approvals
      if (req.method === 'POST' && pathname.match(/^\/api\/transfers\/[^/]+\/approve$/)) {
        if (!user.roles.includes('TransactionApprover')) {
          this.securityDetector.recordAttempt(user.cantonPartyId, pathname, 'UnauthorizedApproval', true);
          return this.sendJson(res, 403, { error: 'User does not hold TransactionApprover role.' }, correlationId);
        }

        const requestRef = pathname.split('/')[3];
        const existing = this.projectionStore.getTransferRequestByRef(requestRef);
        if (!existing) {
          return this.sendJson(res, 404, { error: `Transfer request "${requestRef}" not found.` }, correlationId);
        }

        const body = await this.parseBody(req);
        const decision = body.decision === 'Reject' ? 'Reject' : 'Approve';

        // Enforce self-approval prevention rule
        if (decision === 'Approve' && existing.initiator === user.cantonPartyId) {
          const alert = this.securityDetector.recordAttempt(user.cantonPartyId, requestRef, 'SelfApprovalAttempt', true);
          this.projectionStore.recordAudit(
            AuditService.createAuditRecord({
              actionType: 'SecurityAlert',
              correlationId,
              requestRef,
              actorUserId: user.userId,
              actorPartyId: user.cantonPartyId,
              institutionPartyId: user.institutionId,
              details: { error: 'Self-approval rejected', initiator: existing.initiator },
            })
          );
          return this.sendJson(
            res,
            400,
            { error: 'Self-approval is strictly disallowed: initiator cannot approve their own transfer request.', alert },
            correlationId
          );
        }

        // Exercise Choice on Daml contract
        const evidenceRef = AuditService.createEvidenceRef('approval', {
          requestRef,
          approver: user.cantonPartyId,
          decision,
          reason: body.reason || 'Approved via control console',
        });

        const subRes = await this.ledger.submitAndWait({
          actAs: [user.cantonPartyId],
          commands: [
            {
              commandType: 'exercise',
              templateId: 'MandateGuard.Transfer:TransferRequest',
              contractId: existing.contractId || '#mock',
              choice: 'ApproveTransfer',
              argument: {
                approver: user.cantonPartyId,
                decision,
                reason: body.reason || 'Approved via control console',
                approvalTime: new Date().toISOString(),
                approvalPolicyRef: existing.policyRef,
                evidenceRef,
              },
            },
          ],
        });

        if (subRes.status === 'ERROR') {
          return this.sendJson(
            res,
            502,
            {
              error: 'Canton Ledger choice execution failed or participant unreachable',
              ledgerError: subRes.errorMessage,
              correlationId,
            },
            correlationId
          );
        }

        // Update local projection
        const newApprovals = decision === 'Approve' ? [...existing.currentApprovals, user.cantonPartyId] : existing.currentApprovals;
        const newState = decision === 'Reject' ? 'Rejected' : newApprovals.length >= existing.requiredApprovals ? 'Approved' : 'AwaitingApproval';

        existing.currentApprovals = newApprovals;
        existing.state = newState;
        existing.evidenceRefs.push(evidenceRef);

        this.projectionStore.recordAudit(
          AuditService.createAuditRecord({
            actionType: decision === 'Approve' ? 'ApprovalSubmitted' : 'TransactionRejected',
            correlationId,
            requestRef,
            actorUserId: user.userId,
            actorPartyId: user.cantonPartyId,
            institutionPartyId: user.institutionId,
            ledgerUpdateId: subRes.updateId,
            details: { requestRef, approver: user.cantonPartyId, decision, newState },
          })
        );

        return this.sendJson(res, 200, { request: existing, ledger: subRes }, correlationId);
      }

      // 6. Transfer Execution
      if (req.method === 'POST' && pathname.match(/^\/api\/transfers\/[^/]+\/execute$/)) {
        const requestRef = pathname.split('/')[3];
        const existing = this.projectionStore.getTransferRequestByRef(requestRef);
        if (!existing) {
          return this.sendJson(res, 404, { error: 'Request not found.' }, correlationId);
        }

        if (existing.state !== 'Approved') {
          return this.sendJson(res, 400, { error: `Request must be in "Approved" state to execute. Current state: "${existing.state}"` }, correlationId);
        }

        existing.state = 'Executing';

        // Submit Execute command to Canton Ledger
        const subRes = await this.ledger.submitAndWait({
          actAs: [this.config.operatorParty],
          commands: [
            {
              commandType: 'exercise',
              templateId: 'MandateGuard.Transfer:TransferRequest',
              contractId: existing.contractId,
              choice: 'ConfirmExecution',
              argument: {
                updateId: `TX-CONFIRMED-${Date.now()}`,
                assetContractId: `ASSET-HOLDING-${existing.assetId.assetCode}`,
                outcome: 'ExecutionSuccess',
                evidenceRef: AuditService.createEvidenceRef('execution_confirmed', { requestRef }),
                confirmTime: new Date().toISOString(),
              },
            },
          ],
        });

        if (subRes.status === 'ERROR') {
          return this.sendJson(
            res,
            502,
            {
              error: 'Canton Ledger execution confirmation failed or participant unreachable',
              ledgerError: subRes.errorMessage,
              correlationId,
            },
            correlationId
          );
        }

        existing.state = 'Confirmed';
        existing.executionOutcome = 'ExecutionSuccess';
        existing.executionUpdateId = subRes.updateId || `TX-${randomUUID().slice(0, 8)}`;

        this.projectionStore.recordAudit(
          AuditService.createAuditRecord({
            actionType: 'AssetTransferConfirmed',
            correlationId,
            requestRef,
            actorPartyId: this.config.operatorParty,
            institutionPartyId: user.institutionId,
            ledgerUpdateId: existing.executionUpdateId,
            details: { requestRef, outcome: 'ExecutionSuccess', updateId: existing.executionUpdateId },
          })
        );

        return this.sendJson(res, 200, { request: existing, ledger: subRes }, correlationId);
      }

      // 7. Emergency Holds
      if (req.method === 'GET' && pathname === '/api/holds') {
        const holds = this.projectionStore.getActiveHolds();
        return this.sendJson(res, 200, { holds }, correlationId);
      }

      if (req.method === 'POST' && pathname === '/api/holds') {
        if (!user.roles.includes('SecurityOperator')) {
          return this.sendJson(res, 403, { error: 'Only SecurityOperator can enact emergency holds.' }, correlationId);
        }
        const body = await this.parseBody(req);
        const holdId = `HOLD-${Date.now().toString(36).toUpperCase()}`;

        const hold: EmergencyHoldData = {
          operator: this.config.operatorParty,
          institution: user.institutionId,
          holdInitiator: user.cantonPartyId,
          holdId,
          scope: body.scope || 'Global',
          scopeRef: body.scopeRef || { institution: user.institutionId, mandateId: 'MANDATE-PRIMARY' },
          reason: body.reason || 'Emergency containment requested',
          effectiveFrom: new Date().toISOString(),
          requiredApprovals: 2,
          approvals: [user.cantonPartyId],
          eligibleApprovers: ['SecOps', 'Approver1'],
          state: 'HoldRequested',
          releaseConditions: body.releaseConditions || 'Security audit complete',
        };

        const subRes = await this.ledger.submitAndWait({
          actAs: [this.config.operatorParty, user.institutionId],
          commands: [
            {
              commandType: 'create',
              templateId: 'MandateGuard.Emergency:EmergencyHold',
              payload: hold as any,
            },
          ],
        });

        if (subRes.status === 'ERROR') {
          return this.sendJson(
            res,
            502,
            {
              error: 'Canton Ledger emergency hold submission failed or participant unreachable',
              ledgerError: subRes.errorMessage,
              correlationId,
            },
            correlationId
          );
        }

        this.projectionStore.applyCreatedEvent({
          eventId: randomUUID(),
          offset: subRes.completionOffset,
          updateId: subRes.updateId,
          eventType: 'Created',
          templateId: 'MandateGuard.Emergency:EmergencyHold',
          contractId: subRes.contractId || `#hold:${holdId}`,
          recordTime: new Date().toISOString(),
          data: hold,
        });

        this.projectionStore.recordAudit(
          AuditService.createAuditRecord({
            actionType: 'HoldEnacted',
            correlationId,
            actorUserId: user.userId,
            actorPartyId: user.cantonPartyId,
            institutionPartyId: user.institutionId,
            ledgerUpdateId: subRes.updateId,
            details: { holdId, scope: hold.scope, reason: hold.reason },
          })
        );

        return this.sendJson(res, 201, { hold, ledger: subRes }, correlationId);
      }

      // 8. Security Incidents
      if (req.method === 'GET' && pathname === '/api/incidents') {
        const incidents = this.projectionStore.getIncidents();
        return this.sendJson(res, 200, { incidents }, correlationId);
      }

      if (req.method === 'POST' && pathname === '/api/incidents') {
        const body = await this.parseBody(req);
        const incidentId = `INC-${Date.now().toString(36).toUpperCase()}`;
        const incident: IncidentCaseData = {
          operator: this.config.operatorParty,
          institution: user.institutionId,
          securityOperator: user.cantonPartyId,
          incidentId,
          severity: body.severity || 'High',
          description: body.description || 'Security anomaly',
          relatedRequests: body.relatedRequests || [],
          relatedHolds: body.relatedHolds || [],
          evidenceRefs: [],
          responseActions: ['Investigation initialized'],
          state: 'IncidentOpen',
          openedAt: new Date().toISOString(),
        };

        this.projectionStore.applyCreatedEvent({
          eventId: randomUUID(),
          offset: '0',
          updateId: `INC-TX-${randomUUID().slice(0, 6)}`,
          eventType: 'Created',
          templateId: 'MandateGuard.Emergency:IncidentCase',
          contractId: `#inc:${incidentId}`,
          recordTime: new Date().toISOString(),
          data: incident,
        });

        return this.sendJson(res, 201, { incident }, correlationId);
      }

      // 9. Transaction Evidence Explorer
      if (req.method === 'GET' && pathname === '/api/evidence') {
        const auditLogs = this.projectionStore.getAuditLogs();
        const alerts = this.securityDetector.getAlerts();
        return this.sendJson(res, 200, { auditLogs, alerts }, correlationId);
      }

      // 10. Manual / Triggered Ledger Reconciliation
      if (req.method === 'POST' && pathname === '/api/reconcile') {
        // Query authoritative contracts on Ledger API
        const activeContracts = await this.ledger.queryActiveContracts(
          'MandateGuard.Transfer:TransferRequest',
          this.config.operatorParty
        );
        const discrepancies = this.projectionStore.reconcileACS(activeContracts);
        return this.sendJson(res, 200, { reconciledCount: activeContracts.length, discrepancies }, correlationId);
      }

      // Fallback 404
      return this.sendJson(res, 404, { error: `Endpoint "${pathname}" not found.` }, correlationId);
    } catch (err) {
      return this.sendJson(res, 500, { error: (err as Error).message }, correlationId);
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.config.port, () => {
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}
