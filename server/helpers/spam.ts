/**
 * Professional Spam & Deliverability Heuristics Engine
 * 
 * Ensures authentic business emails from employees, customers, and partners
 * are routed reliably to 'inbox', while detecting spam, phishing, and spoofing.
 */

export interface SpamAnalysisResult {
  isSpam: boolean;
  spamScore: number; // 0 (pristine clean) to 100 (confirmed spam)
  status: 'inbox' | 'spam';
  reasons: string[];
  spfResult: 'pass' | 'fail' | 'softfail' | 'neutral' | 'none';
  dkimResult: 'pass' | 'fail' | 'none';
  dmarcResult: 'pass' | 'fail' | 'none';
}

// Common phishing/spam triggers
const SPAM_KEYWORDS = [
  'wire funds immediately',
  'urgent payment required',
  'account suspended click here',
  'claim your lottery prize',
  'nigerian prince',
  'crypto double investment',
  'verify your bank password',
  'free viagra',
  'act now or account deleted',
  'million dollars transfer',
  'bitcoin deposit confirmed'
];

const TRUSTED_DOMAINS = new Set([
  'housika.co.ke',
  'housika.com',
  'housika.app'
]);

/**
 * Analyzes an inbound or outbound email for spam indicators, authentication, and deliverability.
 */
export function analyzeEmailDeliverability(params: {
  sender: string;
  receiver: string;
  subject: string;
  bodyText: string;
  rawHeaders?: Record<string, string>;
  spf?: string;
  dkim?: string;
  dmarc?: string;
  isInternalAuth?: boolean;
}): SpamAnalysisResult {
  const reasons: string[] = [];
  let score = 0;

  const senderEmail = (params.sender || '').toLowerCase().trim();
  const [, senderDomain] = senderEmail.split('@');
  const subject = (params.subject || '').toLowerCase();
  const body = (params.bodyText || '').toLowerCase();

  // 1. Internal authenticated communications always pass to inbox with 0 spam score
  if (params.isInternalAuth && senderDomain && TRUSTED_DOMAINS.has(senderDomain)) {
    return {
      isSpam: false,
      spamScore: 0,
      status: 'inbox',
      reasons: ['Authenticated internal corporate sender.'],
      spfResult: 'pass',
      dkimResult: 'pass',
      dmarcResult: 'pass'
    };
  }

  // 2. SPF, DKIM, DMARC evaluation (from Cloudflare Email Routing headers or params)
  const spfResult = (params.spf || params.rawHeaders?.['received-spf']?.toLowerCase().includes('pass') ? 'pass' : 'none') as any;
  const dkimResult = (params.dkim || params.rawHeaders?.['dkim-signature'] ? 'pass' : 'none') as any;
  const dmarcResult = (params.dmarc || 'pass') as any;

  if (spfResult === 'fail') {
    score += 45;
    reasons.push('SPF validation failed (possible sender spoofing).');
  } else if (spfResult === 'softfail') {
    score += 15;
    reasons.push('SPF softfail detected.');
  }

  if (dkimResult === 'fail') {
    score += 40;
    reasons.push('DKIM cryptographic signature check failed.');
  }

  // 3. Keyword / Phishing heuristics
  for (const keyword of SPAM_KEYWORDS) {
    if (subject.includes(keyword)) {
      score += 35;
      reasons.push(`High-risk spam keyword in subject: "${keyword}"`);
    } else if (body.includes(keyword)) {
      score += 20;
      reasons.push(`High-risk spam phrase in body: "${keyword}"`);
    }
  }

  // 4. Excessive capitalization / shouty subjects
  if (params.subject && params.subject.length > 8) {
    const uppercaseChars = params.subject.replace(/[^A-Z]/g, '').length;
    const ratio = uppercaseChars / params.subject.length;
    if (ratio > 0.6) {
      score += 15;
      reasons.push('Excessive uppercase capitalization in subject line.');
    }
  }

  // 5. Empty or suspicious body
  if (!params.bodyText || params.bodyText.trim().length === 0) {
    score += 10;
    reasons.push('Empty email body.');
  }

  // Clamp score between 0 and 100
  score = Math.min(100, Math.max(0, score));

  const isSpam = score >= 50;
  const status: 'inbox' | 'spam' = isSpam ? 'spam' : 'inbox';

  if (!isSpam && reasons.length === 0) {
    reasons.push('Passed all authentication and heuristic deliverability checks.');
  }

  return {
    isSpam,
    spamScore: score,
    status,
    reasons,
    spfResult,
    dkimResult,
    dmarcResult
  };
}
