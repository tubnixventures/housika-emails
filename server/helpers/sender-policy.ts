import { TokenPayload } from '../utils/jwt.js';

export interface ResolvedSender {
  senderEmail: string;
  senderName: string;
  allowedChoiceUsed?: 'ceo@housika.co.ke' | 'name@housika.co.ke' | 'company@housika.co.ke' | 'token-name';
  policyNotes: string;
  level: number;
}

export interface SenderPolicyResult {
  allowed: boolean;
  sender?: ResolvedSender;
  statusCode?: number;
  errorCode?: string;
  reason?: string;
}

/**
 * Normalizes user token name into an RFC-compliant email local part.
 * Examples:
 * "Collins Juma" -> "collins.juma"
 * "Movin Juma" -> "movin.juma"
 * "Housika CEO" -> "housika.ceo"
 */
export function slugifyTokenName(name: string): string {
  if (!name) return 'staff';
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '') || 'staff';
}

/**
 * Enforces sender construction and authorization policy:
 * 
 * 1. Level 100 (Company / Enterprise System):
 *    - Strictly enforced to company@housika.co.ke
 *    - If from is passed and not company@housika.co.ke, reject with 403.
 *    - Defaults to company@housika.co.ke.
 * 
 * 2. Level 90 (CEO):
 *    - Has explicit choice: can send as 'ceo@housika.co.ke' OR '<name>@housika.co.ke'
 *      (where <name> is derived from token name or token email)
 *    - If from is passed and neither of those, reject with 403.
 *    - Defaults to ceo@housika.co.ke.
 * 
 * 3. Level 70–89 (Manager, Customer Care, Staff):
 *    - Sender MUST be constructed from token name + @housika.co.ke.
 *    - Non-CEO users cannot spoof arbitrary sender addresses.
 *    - If from is passed and does not match the token's name-derived address, reject with 403.
 *    - Defaults to <nameSlug>@housika.co.ke.
 */
export function resolveSenderPolicy(
  user: TokenPayload,
  requestedFrom?: string,
  requestedSenderName?: string
): SenderPolicyResult {
  const domain = 'housika.co.ke';
  const nameSlug = slugifyTokenName(user.name);
  const nameDerivedEmail = `${nameSlug}@${domain}`;
  const tokenEmail = (user.email || '').toLowerCase().trim();
  const requestedEmail = requestedFrom ? requestedFrom.toLowerCase().trim() : undefined;

  // Level 100: Company / Enterprise System
  if (user.level >= 100) {
    const companyEmail = `company@${domain}`;
    if (requestedEmail && requestedEmail !== companyEmail) {
      return {
        allowed: false,
        statusCode: 403,
        errorCode: 'SENDER_POLICY_VIOLATION',
        reason: `Access Denied: Level 100 corporate accounts are enforced to send as '${companyEmail}'. Provided: '${requestedEmail}'.`
      };
    }
    return {
      allowed: true,
      sender: {
        senderEmail: companyEmail,
        senderName: requestedSenderName || user.name || 'Housika Enterprises',
        allowedChoiceUsed: 'company@housika.co.ke',
        policyNotes: 'Level 100 corporate sender identity (company@housika.co.ke) enforced.',
        level: user.level
      }
    };
  }

  // Level 90: CEO
  if (user.level >= 90) {
    const ceoEmail = `ceo@${domain}`;
    const allowedCeoAddresses = new Set([
      ceoEmail,
      nameDerivedEmail,
      tokenEmail
    ].filter(Boolean));

    let selectedEmail = ceoEmail; // Default CEO choice
    let choiceUsed: 'ceo@housika.co.ke' | 'name@housika.co.ke' = 'ceo@housika.co.ke';

    if (requestedEmail) {
      if (!allowedCeoAddresses.has(requestedEmail)) {
        return {
          allowed: false,
          statusCode: 403,
          errorCode: 'CEO_SENDER_CHOICE_INVALID',
          reason: `Access Denied: CEO (Level 90) is restricted to choosing either '${ceoEmail}' or personal name address '${nameDerivedEmail}'. Provided: '${requestedEmail}'.`
        };
      }
      selectedEmail = requestedEmail;
      choiceUsed = requestedEmail === ceoEmail ? 'ceo@housika.co.ke' : 'name@housika.co.ke';
    }

    return {
      allowed: true,
      sender: {
        senderEmail: selectedEmail,
        senderName: requestedSenderName || user.name,
        allowedChoiceUsed: choiceUsed,
        policyNotes: `CEO verified choice: ${selectedEmail}`,
        level: user.level
      }
    };
  }

  // Standard Users: Level 70 - 89 (Managers, Customer Care)
  // Sender is strictly constructed from token name + @housika.co.ke
  const validUserEmails = new Set([nameDerivedEmail, tokenEmail].filter(Boolean));

  if (requestedEmail) {
    if (!validUserEmails.has(requestedEmail)) {
      return {
        allowed: false,
        statusCode: 403,
        errorCode: 'SENDER_SPOOF_FORBIDDEN',
        reason: `Access Denied: Sender address must be constructed from token name. You are authorized only as '${nameDerivedEmail}'. Attempted spoofing of '${requestedEmail}' is rejected.`
      };
    }
  }

  return {
    allowed: true,
    sender: {
      senderEmail: nameDerivedEmail,
      senderName: user.name,
      allowedChoiceUsed: 'token-name',
      policyNotes: `Constructed strictly from token name '${user.name}' + @${domain}`,
      level: user.level
    }
  };
}
