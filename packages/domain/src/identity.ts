import { RoleType, RoleAssignmentData, MandateRef } from './types.js';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  institutionId: string;
  roles: RoleType[];
  cantonPartyId: string;
}

export interface UserPartyMapping {
  userId: string;
  cantonPartyId: string;
  institutionPartyId: string;
  assignedRoles: RoleType[];
  mandateScopes: MandateRef[];
  active: boolean;
}

/**
 * Validates separation of duties and role-based permissions.
 */
export class IdentityGuard {
  /**
   * Enforces self-approval prevention rule.
   * A request initiator can never approve their own transfer request
   * when independent authorization is required.
   */
  static canApprove(
    approverParty: string,
    initiatorParty: string,
    disallowSelfApproval: boolean
  ): { allowed: boolean; reason?: string } {
    if (disallowSelfApproval && approverParty === initiatorParty) {
      return {
        allowed: false,
        reason: 'Self-approval is not permitted: initiator cannot approve their own request',
      };
    }
    return { allowed: true };
  }

  /**
   * Verifies that the user holds the required logical role for the requested operation.
   */
  static hasRole(user: AuthenticatedUser, requiredRole: RoleType): boolean {
    return user.roles.includes(requiredRole);
  }

  /**
   * Verifies that a party assignment covers the target mandate scope.
   */
  static isScopeAuthorized(
    assignment: RoleAssignmentData,
    targetMandate: MandateRef
  ): boolean {
    if (assignment.revoked) return false;
    if (assignment.expiresAt && new Date(assignment.expiresAt) <= new Date()) {
      return false;
    }
    return assignment.assignedScope.some(
      (m) =>
        m.institution === targetMandate.institution &&
        m.mandateId === targetMandate.mandateId
    );
  }
}
