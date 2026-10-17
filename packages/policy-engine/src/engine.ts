import {
  TransferRequestData,
  PolicyVersionData,
  BeneficiaryMandateData,
  InstitutionalMandateData,
  EmergencyHoldData,
  ApprovalRecordData,
  AuthorizationOutcome,
  ReasonCode,
  LimitCheckResult,
  Quantity,
  Money,
} from '@mandateguard/domain';

export interface PolicyEvaluationContext {
  request: TransferRequestData;
  policy: PolicyVersionData;
  mandate: InstitutionalMandateData;
  beneficiary: BeneficiaryMandateData;
  activeHolds: EmergencyHoldData[];
  existingApprovals: ApprovalRecordData[];
  rollingWindowTransfers: { quantity: Quantity; confirmedAt: string }[];
  evaluationTime: Date;
}

export interface EvaluationResult {
  outcome: AuthorizationOutcome;
  reasonCodes: ReasonCode[];
  rejectionReasons: string[];
  limitChecks: LimitCheckResult[];
  beneficiaryCheck: boolean;
  expirationCheck: boolean;
  holdCheck: boolean;
  revocationCheck: boolean;
  requiredApprovalCount: number;
  completedApprovalCount: number;
  evaluationTimestamp: string;
}

export class PolicyEngine {
  /**
   * Deterministically evaluate a transfer request against institutional mandates,
   * policy limits, beneficiary controls, and active containment holds.
   */
  static evaluate(context: PolicyEvaluationContext): EvaluationResult {
    const {
      request,
      policy,
      mandate,
      beneficiary,
      activeHolds,
      existingApprovals,
      rollingWindowTransfers,
      evaluationTime,
    } = context;

    const reasonCodes: ReasonCode[] = [];
    const rejectionReasons: string[] = [];
    const limitChecks: LimitCheckResult[] = [];

    // 1. Mandate Revocation Check
    let revocationCheck = true;
    if (mandate.revoked) {
      revocationCheck = false;
      reasonCodes.push('Revoked');
      rejectionReasons.push(`Mandate ${mandate.mandateRef.mandateId} has been revoked.`);
    }

    if (beneficiary.revoked) {
      revocationCheck = false;
      reasonCodes.push('Revoked');
      rejectionReasons.push(`Beneficiary ${beneficiary.beneficiary.registryId} has been revoked.`);
    }

    // 2. Policy Consistency & Expiration Check
    let expirationCheck = true;
    const reqExpires = new Date(request.expiresAt);
    if (evaluationTime >= reqExpires) {
      expirationCheck = false;
      reasonCodes.push('Expired');
      rejectionReasons.push(`Transfer request ${request.requestRef} expired at ${request.expiresAt}.`);
    }

    if (!policy.active) {
      expirationCheck = false;
      reasonCodes.push('PolicyMismatch');
      rejectionReasons.push(`Policy ${policy.policyRef.policyId} v${policy.policyRef.version} is not active.`);
    }

    if (policy.expiresAt && evaluationTime >= new Date(policy.expiresAt)) {
      expirationCheck = false;
      reasonCodes.push('Expired');
      rejectionReasons.push(`Policy ${policy.policyRef.policyId} expired at ${policy.expiresAt}.`);
    }

    // 3. Asset & Beneficiary Eligibility Check
    let beneficiaryCheck = true;
    const assetAllowed = beneficiary.permittedAssets.some(
      (a) =>
        a.assetCode === request.assetId.assetCode &&
        a.issuerRef === request.assetId.issuerRef
    );
    if (!assetAllowed) {
      beneficiaryCheck = false;
      reasonCodes.push('InvalidBeneficiary');
      rejectionReasons.push(
        `Asset ${request.assetId.assetCode} is not permitted for beneficiary ${beneficiary.beneficiary.registryId}.`
      );
    }

    // 4. Emergency Hold Check
    let holdCheck = true;
    const matchingHold = activeHolds.find(
      (h) =>
        (h.state === 'HoldActive' || h.state === 'HoldRequested') &&
        (h.scope === `Mandate:${request.mandateRef.mandateId}` ||
         h.scope === `Asset:${request.assetId.assetCode}` ||
         h.scope === `Beneficiary:${request.beneficiary.registryId}` ||
         h.scope === 'Global')
    );

    if (matchingHold) {
      holdCheck = false;
      reasonCodes.push('HoldActive');
      rejectionReasons.push(
        `Emergency hold ${matchingHold.holdId} active on scope "${matchingHold.scope}". Reason: ${matchingHold.reason}`
      );
    }

    // 5. Single Transfer Limit Check
    const singleLimitPassed =
      Money.compare(request.quantity, policy.maxSingleTransfer) <= 0;
    limitChecks.push({
      limitName: 'MaxSingleTransfer',
      limitAmount: policy.maxSingleTransfer,
      currentValue: request.quantity,
      passed: singleLimitPassed,
    });
    if (!singleLimitPassed) {
      reasonCodes.push('LimitExceeded');
      rejectionReasons.push(
        `Transfer quantity ${Money.format(request.quantity)} exceeds max single transfer limit of ${Money.format(policy.maxSingleTransfer)}.`
      );
    }

    // 6. Beneficiary Per-Transfer Limit Check (if set)
    if (beneficiary.maxTransferAmount) {
      const benLimitPassed =
        Money.compare(request.quantity, beneficiary.maxTransferAmount) <= 0;
      limitChecks.push({
        limitName: 'BeneficiaryMaxTransfer',
        limitAmount: beneficiary.maxTransferAmount,
        currentValue: request.quantity,
        passed: benLimitPassed,
      });
      if (!benLimitPassed) {
        reasonCodes.push('LimitExceeded');
        rejectionReasons.push(
          `Transfer quantity exceeds beneficiary specific max transfer limit of ${Money.format(beneficiary.maxTransferAmount)}.`
        );
      }
    }

    // 7. Daily / Rolling Limit Check
    let rollingTotal = request.quantity;
    for (const t of rollingWindowTransfers) {
      rollingTotal = Money.add(rollingTotal, t.quantity);
    }

    const rollingLimitPassed =
      Money.compare(rollingTotal, policy.dailyRollingLimit) <= 0;
    limitChecks.push({
      limitName: 'DailyRollingLimit',
      limitAmount: policy.dailyRollingLimit,
      currentValue: rollingTotal,
      passed: rollingLimitPassed,
    });
    if (!rollingLimitPassed) {
      reasonCodes.push('LimitExceeded');
      rejectionReasons.push(
        `Transfer would cause rolling daily volume (${Money.format(rollingTotal)}) to exceed limit of ${Money.format(policy.dailyRollingLimit)}.`
      );
    }

    // 8. Approvals & Separation of Duties Check
    const validApprovals: ApprovalRecordData[] = [];
    for (const app of existingApprovals) {
      if (app.decision !== 'Approve') continue;

      // Separation of duties
      if (policy.disallowSelfApproval && app.approver === request.initiator) {
        reasonCodes.push('SelfApprovalNotPermitted');
        rejectionReasons.push(`Approver ${app.approver} is initiator: self-approval disallowed.`);
        continue;
      }

      // Term consistency
      if (
        Money.compare(app.approvedQuantity, request.quantity) !== 0 ||
        app.approvedBeneficiary.registryId !== request.beneficiary.registryId ||
        app.approvedAssetId.assetCode !== request.assetId.assetCode
      ) {
        reasonCodes.push('PolicyMismatch');
        rejectionReasons.push(`Approval ${app.requestRef} does not match current transaction terms.`);
        continue;
      }

      validApprovals.push(app);
    }

    const completedApprovalCount = validApprovals.length;
    const requiredApprovalCount = policy.requiredApprovals;

    // Determine final outcome
    let outcome: AuthorizationOutcome;

    if (
      !revocationCheck ||
      !expirationCheck ||
      !beneficiaryCheck ||
      !holdCheck ||
      !singleLimitPassed ||
      !rollingLimitPassed
    ) {
      outcome = 'Denied';
    } else if (completedApprovalCount >= requiredApprovalCount) {
      outcome = 'Authorized';
      reasonCodes.push('ApprovedSuccessfully');
    } else {
      outcome = 'NeedsApproval';
      reasonCodes.push('InsufficientApprovals');
    }

    return {
      outcome,
      reasonCodes,
      rejectionReasons,
      limitChecks,
      beneficiaryCheck,
      expirationCheck,
      holdCheck,
      revocationCheck,
      requiredApprovalCount,
      completedApprovalCount,
      evaluationTimestamp: evaluationTime.toISOString(),
    };
  }
}
