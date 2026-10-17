/**
 * MandateGuard Domain Types
 * Authoritative TypeScript representations of Daml domain models.
 * Non-floating-point monetary amounts using integer sub-units.
 */

export interface AssetId {
  assetCode: string;
  issuerRef: string;
}

export interface Quantity {
  /** Value in integer sub-units (e.g. cents, satoshis, wei). Never float. */
  amount: bigint;
  /** Decimal precision (e.g. 2 for USD cents, 8 for BTC, 18 for ETH). */
  precision: number;
}

export interface MandateRef {
  institution: string;
  mandateId: string;
}

export interface PolicyRef {
  policyId: string;
  version: number;
}

export interface BeneficiaryId {
  registryId: string;
  displayName: string;
}

export interface EvidenceRef {
  evidenceId: string;
  hash: string;
  evidenceType: string;
  timestamp: string; // ISO-8601
}

export type RoleType =
  | 'TransactionInitiator'
  | 'TransactionApprover'
  | 'TreasuryController'
  | 'SecurityOperator'
  | 'PolicyAdministrator'
  | 'Auditor'
  | 'PlatformAdministrator';

export type RequestState =
  | 'Pending'
  | 'AwaitingApproval'
  | 'Approved'
  | 'Executing'
  | 'Confirmed'
  | 'Rejected'
  | 'Expired'
  | 'OnHold';

export type ApprovalDecision = 'Approve' | 'Reject';

export type HoldState =
  | 'HoldRequested'
  | 'HoldActive'
  | 'HoldReleased'
  | 'HoldExpired';

export type ChangeState =
  | 'Proposed'
  | 'UnderReview'
  | 'ChangeApproved'
  | 'ChangeRejected'
  | 'Activated'
  | 'ChangeExpired';

export type IncidentState =
  | 'IncidentOpen'
  | 'IncidentInvestigating'
  | 'IncidentContained'
  | 'IncidentResolved'
  | 'IncidentClosed';

export type AuthorizationOutcome = 'Authorized' | 'Denied' | 'NeedsApproval';

export type ReasonCode =
  | 'LimitExceeded'
  | 'InvalidBeneficiary'
  | 'Expired'
  | 'Revoked'
  | 'HoldActive'
  | 'SelfApprovalNotPermitted'
  | 'InsufficientApprovals'
  | 'PolicyMismatch'
  | 'DuplicateRequest'
  | 'ApprovedSuccessfully';

export type ExecutionOutcome =
  | 'ExecutionSuccess'
  | 'ExecutionFailed'
  | 'ExecutionUnknown';

export interface LimitCheckResult {
  limitName: string;
  limitAmount: Quantity;
  currentValue: Quantity;
  passed: boolean;
}

// Contract-aligned representations
export interface InstitutionalMandateData {
  operator: string;
  institution: string;
  mandateRef: MandateRef;
  authorizedAssets: AssetId[];
  permittedTransactionTypes: string[];
  permittedBeneficiaryScope: string[];
  maxSingleTransfer: Quantity;
  dailyLimit: Quantity;
  requiredApprovals: number;
  effectivePolicyRef: PolicyRef;
  effectiveFrom: string;
  expiresAt?: string;
  revoked: boolean;
  governanceApprovers: string[];
}

export interface RoleAssignmentData {
  operator: string;
  institution: string;
  assignee: string;
  roleType: RoleType;
  assignedScope: MandateRef[];
  version: number;
  effectiveFrom: string;
  expiresAt?: string;
  revoked: boolean;
  revokedAt?: string;
}

export interface BeneficiaryMandateData {
  operator: string;
  institution: string;
  beneficiary: BeneficiaryId;
  permittedAssets: AssetId[];
  maxTransferAmount?: Quantity;
  effectiveFrom: string;
  expiresAt?: string;
  revoked: boolean;
  version: number;
  approvedBy: string[];
}

export interface PolicyVersionData {
  operator: string;
  institution: string;
  policyRef: PolicyRef;
  applicableAssets: AssetId[];
  maxSingleTransfer: Quantity;
  dailyRollingLimit: Quantity;
  requiredApprovals: number;
  disallowSelfApproval: boolean;
  effectiveFrom: string;
  expiresAt?: string;
  active: boolean;
  supersededBy?: PolicyRef;
  emergencyHoldRequired: boolean;
}

export interface TransferRequestData {
  contractId?: string;
  operator: string;
  institution: string;
  initiator: string;
  requestRef: string;
  assetId: AssetId;
  assetContractRef?: string;
  beneficiary: BeneficiaryId;
  quantity: Quantity;
  mandateRef: MandateRef;
  policyRef: PolicyRef;
  createdAt: string;
  expiresAt: string;
  requiredApprovals: number;
  currentApprovals: string[];
  eligibleApprovers: string[];
  state: RequestState;
  evidenceRefs: EvidenceRef[];
  executionOutcome?: string;
  executionUpdateId?: string;
}

export interface ApprovalRecordData {
  contractId?: string;
  operator: string;
  institution: string;
  requestRef: string;
  approver: string;
  decision: ApprovalDecision;
  approvedQuantity: Quantity;
  approvedBeneficiary: BeneficiaryId;
  approvedAssetId: AssetId;
  policyRef: PolicyRef;
  reason: string;
  approvalTime: string;
  evidenceRef: EvidenceRef;
}

export interface EmergencyHoldData {
  contractId?: string;
  operator: string;
  institution: string;
  holdInitiator: string;
  holdId: string;
  scope: string;
  scopeRef: MandateRef;
  reason: string;
  effectiveFrom: string;
  expiresAt?: string;
  requiredApprovals: number;
  approvals: string[];
  eligibleApprovers: string[];
  state: HoldState;
  releaseConditions: string;
  releasedBy?: string;
  releaseReason?: string;
}

export interface IncidentCaseData {
  contractId?: string;
  operator: string;
  institution: string;
  securityOperator: string;
  incidentId: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  description: string;
  relatedRequests: string[];
  relatedHolds: string[];
  evidenceRefs: EvidenceRef[];
  responseActions: string[];
  state: IncidentState;
  openedAt: string;
  resolvedAt?: string;
  resolution?: string;
}

export interface ExecutionReceiptData {
  contractId?: string;
  operator: string;
  institution: string;
  requestRef: string;
  updateId: string;
  assetContractRef: string;
  assetId: AssetId;
  beneficiary: BeneficiaryId;
  quantity: Quantity;
  outcome: ExecutionOutcome;
  evidenceRef: EvidenceRef;
  confirmedAt: string;
  policyRef: PolicyRef;
}
