import { createHash, randomUUID } from 'node:crypto';
import { EvidenceRef } from '@mandateguard/domain';

export type AuditActionType =
  | 'RequestCreated'
  | 'ApprovalSubmitted'
  | 'CommandSubmitted'
  | 'CommandConfirmed'
  | 'TransactionRejected'
  | 'OutcomeUnknown'
  | 'AssetTransferConfirmed'
  | 'HoldEnacted'
  | 'HoldReleased'
  | 'PolicyProposed'
  | 'PolicyActivated'
  | 'SecurityAlert';

export interface AuditRecord {
  auditId: string;
  actionType: AuditActionType;
  correlationId: string;
  requestRef?: string;
  actorUserId?: string;
  actorPartyId: string;
  institutionPartyId: string;
  payloadHash: string;
  timestamp: string;
  ledgerUpdateId?: string;
  assetContractRef?: string;
  details: Record<string, unknown>;
}

export interface SecurityAlert {
  alertId: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  eventType: string;
  description: string;
  targetRef: string;
  actor: string;
  timestamp: string;
}

export class AuditService {
  /**
   * Generates a deterministic SHA-256 hash of a payload object.
   */
  static hashPayload(payload: unknown): string {
    const jsonStr = JSON.stringify(payload, Object.keys(payload as object).sort());
    return createHash('sha256').update(jsonStr).digest('hex');
  }

  /**
   * Builds an immutable EvidenceRef with cryptographic SHA-256 digest.
   */
  static createEvidenceRef(evidenceType: string, payload: unknown): EvidenceRef {
    const hash = this.hashPayload(payload);
    return {
      evidenceId: `EVD-${randomUUID().slice(0, 8)}`,
      hash: `sha256:${hash}`,
      evidenceType,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create an audit record with verified cryptographic payload hash.
   */
  static createAuditRecord(params: {
    actionType: AuditActionType;
    correlationId: string;
    requestRef?: string;
    actorUserId?: string;
    actorPartyId: string;
    institutionPartyId: string;
    ledgerUpdateId?: string;
    assetContractRef?: string;
    details: Record<string, unknown>;
  }): AuditRecord {
    const payloadHash = this.hashPayload(params.details);
    return {
      auditId: `AUD-${randomUUID()}`,
      actionType: params.actionType,
      correlationId: params.correlationId,
      requestRef: params.requestRef,
      actorUserId: params.actorUserId,
      actorPartyId: params.actorPartyId,
      institutionPartyId: params.institutionPartyId,
      payloadHash,
      timestamp: new Date().toISOString(),
      ledgerUpdateId: params.ledgerUpdateId,
      assetContractRef: params.assetContractRef,
      details: params.details,
    };
  }
}

/**
 * Real-time security event analyzer for detecting suspicious behavior.
 */
export class SecurityEventDetector {
  private failedAttempts = new Map<string, { count: number; lastTime: number }>();
  private alerts: SecurityAlert[] = [];

  recordAttempt(actor: string, targetRef: string, eventType: string, isFailure: boolean): SecurityAlert | null {
    if (!isFailure) return null;

    const now = Date.now();
    const entry = this.failedAttempts.get(actor) || { count: 0, lastTime: now };

    // Reset window after 15 minutes
    if (now - entry.lastTime > 15 * 60 * 1000) {
      entry.count = 1;
    } else {
      entry.count++;
    }
    entry.lastTime = now;
    this.failedAttempts.set(actor, entry);

    if (entry.count >= 3) {
      const alert: SecurityAlert = {
        alertId: `ALT-${randomUUID().slice(0, 8)}`,
        severity: entry.count >= 5 ? 'Critical' : 'High',
        eventType,
        description: `Actor "${actor}" triggered ${entry.count} consecutive rejected operations within 15 minutes.`,
        targetRef,
        actor,
        timestamp: new Date().toISOString(),
      };
      this.alerts.push(alert);
      return alert;
    }

    return null;
  }

  getAlerts(): SecurityAlert[] {
    return [...this.alerts];
  }
}
