/**
 * Cosmos DB Partition Key Resolver
 * 
 * Partition Strategy for container 'emails':
 * - System / Departmental Shared Mailboxes: PK is the mailbox short name ('help', 'payments', 'ceo', 'support', 'billing', 'admin')
 * - Individual Staff / Manager / Customer Care Mailboxes: PK is their full email address (e.g. 'collinsjuma@housika.co.ke', 'movinjuma@housika.co.ke')
 * 
 * This guarantees all queries for an inbox (such as listing or fetching emails for a user or department)
 * are single-partition operations with predictable 1-2 RU cost, avoiding costly cross-partition fan-outs!
 */

export const DEPARTMENT_MAILBOXES = new Set([
  'help',
  'payments',
  'ceo',
  'support',
  'billing',
  'admin',
  'info',
  'contact',
  'sales',
  'inquiries',
  'legal',
  'hr'
]);

export interface PartitionResolution {
  pk: string;
  mailboxType: 'department' | 'individual';
  departmentName?: string;
  domain: string;
  normalizedEmail: string;
}

/**
 * Resolves the Cosmos DB Partition Key (pk) for an email address
 * @param email Full email address (e.g. "payments@housika.co.ke" or "collinsjuma@housika.co.ke")
 */
export function resolvePartitionKey(email: string): PartitionResolution {
  const normalized = email.trim().toLowerCase();
  const [localPart, domain = 'housika.co.ke'] = normalized.split('@');

  if (DEPARTMENT_MAILBOXES.has(localPart)) {
    return {
      pk: localPart, // e.g. "help", "payments", "ceo"
      mailboxType: 'department',
      departmentName: localPart,
      domain,
      normalizedEmail: normalized
    };
  }

  return {
    pk: normalized, // e.g. "collinsjuma@housika.co.ke"
    mailboxType: 'individual',
    domain,
    normalizedEmail: normalized
  };
}

/**
 * Normalizes partition key input from user/query (handles both raw pk like "payments" or full email)
 */
export function normalizePartitionKey(target: string): string {
  const trimmed = target.trim().toLowerCase();
  if (DEPARTMENT_MAILBOXES.has(trimmed)) {
    return trimmed;
  }
  if (trimmed.includes('@')) {
    return resolvePartitionKey(trimmed).pk;
  }
  return trimmed;
}
