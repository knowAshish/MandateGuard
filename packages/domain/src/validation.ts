import {
  TransferRequestData,
  PolicyVersionData,
  BeneficiaryMandateData,
  EmergencyHoldData,
  Quantity,
} from './types.js';
import { Money } from './money.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class DomainValidator {
  static validateTransferRequest(
    req: Partial<TransferRequestData>
  ): ValidationResult {
    const errors: string[] = [];

    if (!req.requestRef?.trim()) errors.push('requestRef is required');
    if (!req.initiator?.trim()) errors.push('initiator party is required');
    if (!req.institution?.trim()) errors.push('institution party is required');
    if (!req.operator?.trim()) errors.push('operator party is required');
    if (!req.assetId?.assetCode?.trim()) errors.push('assetId.assetCode is required');
    if (!req.assetId?.issuerRef?.trim()) errors.push('assetId.issuerRef is required');
    if (!req.beneficiary?.registryId?.trim()) errors.push('beneficiary.registryId is required');

    if (!req.quantity) {
      errors.push('quantity is required');
    } else {
      if (!Money.isPositive(req.quantity)) {
        errors.push('quantity.amount must be positive');
      }
      if (req.quantity.precision < 0 || req.quantity.precision > 18) {
        errors.push('quantity.precision must be between 0 and 18');
      }
    }

    if (!req.mandateRef?.mandateId?.trim()) errors.push('mandateRef.mandateId is required');
    if (!req.policyRef?.policyId?.trim()) errors.push('policyRef.policyId is required');
    if (typeof req.requiredApprovals !== 'number' || req.requiredApprovals < 1) {
      errors.push('requiredApprovals must be an integer >= 1');
    }

    return { valid: errors.length === 0, errors };
  }

  static validatePolicy(policy: Partial<PolicyVersionData>): ValidationResult {
    const errors: string[] = [];

    if (!policy.policyRef?.policyId?.trim()) errors.push('policyRef.policyId is required');
    if (!policy.policyRef?.version || policy.policyRef.version < 1) {
      errors.push('policyRef.version must be >= 1');
    }
    if (!policy.institution?.trim()) errors.push('institution party is required');
    if (typeof policy.requiredApprovals !== 'number' || policy.requiredApprovals < 1) {
      errors.push('requiredApprovals must be an integer >= 1');
    }
    if (!policy.maxSingleTransfer || !Money.isPositive(policy.maxSingleTransfer)) {
      errors.push('maxSingleTransfer must be positive');
    }
    if (!policy.dailyRollingLimit || !Money.isPositive(policy.dailyRollingLimit)) {
      errors.push('dailyRollingLimit must be positive');
    }

    return { valid: errors.length === 0, errors };
  }

  static validateBeneficiary(
    ben: Partial<BeneficiaryMandateData>
  ): ValidationResult {
    const errors: string[] = [];

    if (!ben.beneficiary?.registryId?.trim()) {
      errors.push('beneficiary.registryId is required');
    }
    if (!ben.beneficiary?.displayName?.trim()) {
      errors.push('beneficiary.displayName is required');
    }
    if (!ben.permittedAssets || ben.permittedAssets.length === 0) {
      errors.push('permittedAssets must include at least one asset');
    }

    return { valid: errors.length === 0, errors };
  }

  static validateEmergencyHold(
    hold: Partial<EmergencyHoldData>
  ): ValidationResult {
    const errors: string[] = [];

    if (!hold.holdId?.trim()) errors.push('holdId is required');
    if (!hold.scope?.trim()) errors.push('scope is required');
    if (!hold.reason?.trim()) errors.push('reason is required');
    if (!hold.holdInitiator?.trim()) errors.push('holdInitiator is required');
    if (typeof hold.requiredApprovals !== 'number' || hold.requiredApprovals < 1) {
      errors.push('requiredApprovals must be >= 1');
    }

    return { valid: errors.length === 0, errors };
  }
}
