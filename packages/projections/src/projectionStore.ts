import {
  TransferRequestData,
  ApprovalRecordData,
  PolicyVersionData,
  BeneficiaryMandateData,
  InstitutionalMandateData,
  EmergencyHoldData,
  IncidentCaseData,
  ExecutionReceiptData,
  ExecutionOutcome,
} from '@mandateguard/domain';
import { AuditRecord } from '@mandateguard/audit';

export type CommandSubmissionStatus =
  | 'Submitted'
  | 'Confirmed'
  | 'Failed'
  | 'TimedOut'
  | 'Unknown';

export interface CommandIdempotencyRecord {
  commandId: string;
  deduplicationKey: string;
  submissionTime: string;
  status: CommandSubmissionStatus;
  ledgerUpdateId?: string;
  errorMessage?: string;
  resultPayload?: unknown;
}

export interface LedgerEvent<T = unknown> {
  eventId: string;
  offset: string;
  updateId: string;
  eventType: 'Created' | 'Archived' | 'Exercised';
  templateId: string;
  contractId: string;
  recordTime: string;
  data: T;
}

export interface ReconciliationDiscrepancy {
  discrepancyId: string;
  contractId: string;
  templateType: string;
  issue: 'MissingInProjection' | 'StaleStatus' | 'UnexpectedContract' | 'PayloadMismatch';
  details: string;
  detectedAt: string;
}

/**
 * High-performance, idempotent projection store and read-model reconciler.
 * Keeps non-authoritative read models synchronized with authoritative Canton Ledger API state.
 */
export class ProjectionStore {
  // Idempotency records
  private idempotency = new Map<string, CommandIdempotencyRecord>();
  // Active contracts by contract ID
  private transferRequests = new Map<string, TransferRequestData>();
  private approvals = new Map<string, ApprovalRecordData>();
  private policies = new Map<string, PolicyVersionData>();
  private beneficiaries = new Map<string, BeneficiaryMandateData>();
  private mandates = new Map<string, InstitutionalMandateData>();
  private emergencyHolds = new Map<string, EmergencyHoldData>();
  private incidents = new Map<string, IncidentCaseData>();
  private executionReceipts = new Map<string, ExecutionReceiptData>();
  private auditLogs: AuditRecord[] = [];

  // Ledger stream offset tracking
  private lastProcessedOffset = '0';
  private discrepancies: ReconciliationDiscrepancy[] = [];

  // ================= IDEMPOTENCY =================
  recordSubmission(commandId: string, deduplicationKey: string): boolean {
    const existing = this.idempotency.get(deduplicationKey);
    if (existing && (existing.status === 'Submitted' || existing.status === 'Confirmed')) {
      return false; // Duplicate submission!
    }
    this.idempotency.set(deduplicationKey, {
      commandId,
      deduplicationKey,
      submissionTime: new Date().toISOString(),
      status: 'Submitted',
    });
    return true;
  }

  updateCommandStatus(
    deduplicationKey: string,
    status: CommandSubmissionStatus,
    ledgerUpdateId?: string,
    errorMessage?: string,
    resultPayload?: unknown
  ): void {
    const entry = this.idempotency.get(deduplicationKey);
    if (entry) {
      entry.status = status;
      if (ledgerUpdateId) entry.ledgerUpdateId = ledgerUpdateId;
      if (errorMessage) entry.errorMessage = errorMessage;
      if (resultPayload) entry.resultPayload = resultPayload;
    }
  }

  getCommandRecord(deduplicationKey: string): CommandIdempotencyRecord | undefined {
    return this.idempotency.get(deduplicationKey);
  }

  // ================= EVENT CONSUMPTION =================
  applyCreatedEvent(event: LedgerEvent): void {
    const { templateId, contractId, data, offset } = event;
    this.lastProcessedOffset = offset;

    if (templateId.includes('TransferRequest')) {
      const tr = data as TransferRequestData;
      this.transferRequests.set(contractId, { ...tr, contractId });
    } else if (templateId.includes('ApprovalRecord')) {
      const ar = data as ApprovalRecordData;
      this.approvals.set(contractId, { ...ar, contractId });
    } else if (templateId.includes('PolicyVersion')) {
      const pv = data as PolicyVersionData;
      this.policies.set(contractId, pv);
    } else if (templateId.includes('BeneficiaryMandate')) {
      const bm = data as BeneficiaryMandateData;
      this.beneficiaries.set(contractId, bm);
    } else if (templateId.includes('InstitutionalMandate')) {
      const im = data as InstitutionalMandateData;
      this.mandates.set(contractId, im);
    } else if (templateId.includes('EmergencyHold')) {
      const eh = data as EmergencyHoldData;
      this.emergencyHolds.set(contractId, { ...eh, contractId });
    } else if (templateId.includes('IncidentCase')) {
      const ic = data as IncidentCaseData;
      this.incidents.set(contractId, { ...ic, contractId });
    } else if (templateId.includes('ExecutionReceipt')) {
      const er = data as ExecutionReceiptData;
      this.executionReceipts.set(contractId, { ...er, contractId });
    }
  }

  applyArchivedEvent(event: LedgerEvent): void {
    const { contractId, offset } = event;
    this.lastProcessedOffset = offset;

    this.transferRequests.delete(contractId);
    this.emergencyHolds.delete(contractId);
    this.incidents.delete(contractId);
  }

  recordAudit(record: AuditRecord): void {
    this.auditLogs.unshift(record);
    if (this.auditLogs.length > 1000) {
      this.auditLogs.pop();
    }
  }

  // ================= QUERIES =================
  getTransferRequests(): TransferRequestData[] {
    return Array.from(this.transferRequests.values());
  }

  getTransferRequestByRef(ref: string): TransferRequestData | undefined {
    return Array.from(this.transferRequests.values()).find((r) => r.requestRef === ref);
  }

  getApprovalsForRequest(requestRef: string): ApprovalRecordData[] {
    return Array.from(this.approvals.values()).filter((a) => a.requestRef === requestRef);
  }

  getActiveHolds(): EmergencyHoldData[] {
    return Array.from(this.emergencyHolds.values()).filter(
      (h) => h.state === 'HoldActive' || h.state === 'HoldRequested'
    );
  }

  getPolicies(): PolicyVersionData[] {
    return Array.from(this.policies.values());
  }

  getBeneficiaries(): BeneficiaryMandateData[] {
    return Array.from(this.beneficiaries.values());
  }

  getIncidents(): IncidentCaseData[] {
    return Array.from(this.incidents.values());
  }

  getReceipts(): ExecutionReceiptData[] {
    return Array.from(this.executionReceipts.values());
  }

  getAuditLogs(): AuditRecord[] {
    return [...this.auditLogs];
  }

  getLastOffset(): string {
    return this.lastProcessedOffset;
  }

  // ================= RECONCILIATION =================
  /**
   * Reconciles projection state against the authoritative Active Contract Set (ACS).
   * Identifies discrepancies between local projections and Canton ledger truth.
   */
  reconcileACS(authoritativeContracts: { contractId: string; templateId: string; payload: unknown }[]): ReconciliationDiscrepancy[] {
    const discovered: ReconciliationDiscrepancy[] = [];
    const authCids = new Set(authoritativeContracts.map((c) => c.contractId));

    // 1. Check for local projected contracts that no longer exist on ledger
    for (const [cid, req] of this.transferRequests.entries()) {
      if (!authCids.has(cid)) {
        discovered.push({
          discrepancyId: `DISC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          contractId: cid,
          templateType: 'TransferRequest',
          issue: 'StaleStatus',
          details: `Contract ${cid} for request ${req.requestRef} projected as active but archived on ledger.`,
          detectedAt: new Date().toISOString(),
        });
        // Auto-heal
        this.transferRequests.delete(cid);
      }
    }

    // 2. Check for ledger contracts missing from local projection
    for (const ac of authoritativeContracts) {
      if (ac.templateId.includes('TransferRequest') && !this.transferRequests.has(ac.contractId)) {
        discovered.push({
          discrepancyId: `DISC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          contractId: ac.contractId,
          templateType: 'TransferRequest',
          issue: 'MissingInProjection',
          details: `Ledger contract ${ac.contractId} was missing from projection. Re-indexed.`,
          detectedAt: new Date().toISOString(),
        });
        // Auto-heal
        this.transferRequests.set(ac.contractId, {
          ...(ac.payload as TransferRequestData),
          contractId: ac.contractId,
        });
      }
    }

    this.discrepancies.push(...discovered);
    return discovered;
  }

  getDiscrepancies(): ReconciliationDiscrepancy[] {
    return [...this.discrepancies];
  }
}
