import { TokenPayload } from '../utils/jwt.js';
import { resolvePartitionKey } from './partitioning.js';

export const SUPPORTED_DOMAINS = [
  'housika.co.ke',
  'housika.com',
  'housika.app'
];

export interface AuthorizationCheckResult {
  allowed: boolean;
  reason?: string;
  statusCode: number;
}

/**
 * Validates if the requesting user has authorization to read/manage emails for a target mailbox/pk
 * 
 * Rules:
 * 1. Hierarchy Level must be >= 70 (strictly enforced).
 * 2. Level 90+ (CEO / Executive): Access to all mailboxes across all domains.
 * 3. Domain boundaries: Non-CEO users can only access their primary domain unless assigned.
 * 4. Owner access: A user can always access their own personal mailbox (e.g. collinsjuma@housika.co.ke).
 * 5. Department mailboxes ('help', 'payments', 'ceo', etc.):
 *    - CEO (level >= 90) has access to all.
 *    - Managers (level 80-89) have access to their department queues.
 *    - Customer Care (level 70-79) have access ONLY if the department is in their assignedMailboxes.
 * 6. Individual mailboxes:
 *    - User must be the owner, or have a strictly HIGHER hierarchy level than the target mailbox owner.
 */
export function authorizeMailboxAccess(
  user: TokenPayload,
  targetPkOrEmail: string,
  targetOwnerLevel?: number
): AuthorizationCheckResult {
  // Rule 1: Minimum level >= 70
  if (user.level < 70) {
    return {
      allowed: false,
      reason: 'Security Policy: Access level below 70 is not authorized.',
      statusCode: 403
    };
  }

  // Rule 2: CEO (Level >= 90) has global access across all mailboxes and domains
  if (user.level >= 90) {
    return { allowed: true, statusCode: 200 };
  }

  const { pk, mailboxType, departmentName, domain, normalizedEmail } = resolvePartitionKey(targetPkOrEmail);

  // Rule 3: Check domain boundary (unless level >= 90)
  if (user.domain && domain && user.domain.toLowerCase() !== domain.toLowerCase()) {
    return {
      allowed: false,
      reason: `Access Denied: Domain mismatch (${user.domain} cannot access ${domain}). Level 90+ required for cross-domain access.`,
      statusCode: 403
    };
  }

  // Rule 4: Direct ownership of individual mailbox
  if (user.email.toLowerCase() === normalizedEmail || user.accountId === targetPkOrEmail) {
    return { allowed: true, statusCode: 200 };
  }

  // Rule 5: Departmental mailboxes ('help', 'payments', 'ceo', etc.)
  if (mailboxType === 'department') {
    // CEO mailbox is restricted to CEO (level >= 90)
    if (departmentName === 'ceo' && user.level < 90) {
      return {
        allowed: false,
        reason: 'Restricted Mailbox: Access to CEO mailbox requires Level 90+.',
        statusCode: 403
      };
    }

    // Executives / CEO (90+) have access to all operational department queues
    if (user.level >= 90) {
      return { allowed: true, statusCode: 200 };
    }

    // Managers (80-89) have access to department queues
    if (user.level >= 80) {
      return { allowed: true, statusCode: 200 };
    }

    // Customer Care (70-79) must have the department explicitly in assignedMailboxes
    if (user.level >= 70) {
      const assigned = (user.assignedMailboxes || []).map(m => m.toLowerCase());
      if (departmentName && (assigned.includes(departmentName) || assigned.includes(pk))) {
        return { allowed: true, statusCode: 200 };
      }
      return {
        allowed: false,
        reason: `Access Denied: Customer care agent not assigned to department mailbox '${departmentName || pk}'.`,
        statusCode: 403
      };
    }
  }

  // Rule 6: Individual mailbox of another person
  if (mailboxType === 'individual') {
    // If target owner level is known, user must be strictly higher
    if (typeof targetOwnerLevel === 'number') {
      if (user.level <= targetOwnerLevel) {
        return {
          allowed: false,
          reason: `Access Denied: Your hierarchy level (${user.level}) must be higher than target mailbox level (${targetOwnerLevel}).`,
          statusCode: 403
        };
      }
      return { allowed: true, statusCode: 200 };
    }

    // Default hierarchy checks if level is not explicitly known:
    // Customer care (70-79) cannot access other staff's personal mailboxes
    if (user.level < 80) {
      return {
        allowed: false,
        reason: 'Access Denied: Agents cannot view other employees’ personal mailboxes.',
        statusCode: 403
      };
    }

    // Managers (80-89) can view customer care mailboxes (70-79)
    if (user.level >= 80) {
      return { allowed: true, statusCode: 200 };
    }
  }

  return {
    allowed: false,
    reason: 'Access Denied: Insufficient hierarchy permissions.',
    statusCode: 403
  };
}
