import { Context } from 'hono';
import crypto from 'crypto';
import { extractToken, verifyToken } from '../utils/jwt.js';
import { uploadToR2, R2AttachmentMetadata } from '../utils/r2.js';
import { saveEmailToCosmos, EmailDocument } from '../utils/cosmos.js';
import { resolvePartitionKey } from '../helpers/partitioning.js';
import { analyzeEmailDeliverability } from '../helpers/spam.js';
import { checkOutboundRateLimit } from '../helpers/ratelimit.js';
import { resolveSenderPolicy } from '../helpers/sender-policy.js';

// Simple in-memory idempotency cache for backend microservices retrying requests
const idempotencyStore = new Map<string, { response: any; timestamp: number }>();

// RFC 5322 basic email format validation
const RFC5322_EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Cloudflare Email Routing 25MB message cap
const MAX_MESSAGE_BYTES = 25 * 1024 * 1024;

/**
 * POST /api/emails/send
 * Enterprise email dispatch endpoint designed for direct API consumption and Worker bindings.
 * 
 * HTTP Status Codes:
 * - 201 Created: Email validated, persisted to Cosmos DB, archived in R2, and queued.
 * - 400 Bad Request: Missing fields, invalid RFC 5322 recipient syntax.
 * - 401 Unauthorized: Missing or invalid Bearer authentication token.
 * - 403 Forbidden: Sender address policy violation (spoofing prevention / unauthorized sender).
 * - 413 Payload Too Large: Total message or attachment payload exceeds Cloudflare 25MB limit.
 * - 429 Too Many Requests: Account tier outbound hourly rate limit exceeded.
 * - 500 Internal Server Error: Downstream Azure Cosmos DB or Cloudflare R2 failure.
 */
export async function handleSendEmail(c: Context) {
  try {
    // 1. Authentication & Bearer Token Verification
    const rawToken = extractToken(c.req.raw.headers);
    if (!rawToken) {
      return c.json({
        success: false,
        statusCode: 401,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Missing or invalid authentication token. Provide standard header: "Authorization: Bearer <token>".'
        }
      }, 401);
    }

    let user;
    try {
      user = verifyToken(rawToken);
    } catch (err: any) {
      return c.json({
        success: false,
        statusCode: 401,
        error: {
          code: 'TOKEN_INVALID',
          message: err.message || 'The provided Bearer token is invalid or expired.'
        }
      }, 401);
    }

    // 2. Idempotency Key Handling (RFC 7240 / Cloudflare Worker API best practices)
    const idempotencyKey = c.req.header('x-idempotency-key') || c.req.header('idempotency-key');
    if (idempotencyKey && idempotencyStore.has(idempotencyKey)) {
      const cached = idempotencyStore.get(idempotencyKey)!;
      // Valid for 10 minutes
      if (Date.now() - cached.timestamp < 10 * 60 * 1000) {
        c.header('X-Idempotent-Replay', 'true');
        return c.json(cached.response, 201);
      }
      idempotencyStore.delete(idempotencyKey);
    }

    // 3. Outbound Rate Limiting (Domain Reputation Shield)
    const rateCheck = checkOutboundRateLimit(user.accountId, user.level);
    if (!rateCheck.allowed) {
      c.header('Retry-After', rateCheck.resetSeconds.toString());
      return c.json({
        success: false,
        statusCode: 429,
        error: {
          code: 'OUTBOUND_RATE_LIMIT_EXCEEDED',
          message: `Outbound rate limit exceeded. Max ${rateCheck.limit} emails/hour permitted for account tier ${user.level}.`,
          retryAfterSeconds: rateCheck.resetSeconds,
          currentTierLimit: rateCheck.limit
        }
      }, 429);
    }

    // 4. Parse & Validate Payload
    const body = await c.req.json().catch(() => null);
    if (!body) {
      return c.json({
        success: false,
        statusCode: 400,
        error: {
          code: 'INVALID_JSON_BODY',
          message: 'Malformed request: A valid JSON payload is required.'
        }
      }, 400);
    }

    const {
      to,
      from,
      subject,
      bodyText,
      bodyHtml,
      cc = [],
      bcc = [],
      attachments = [],
      threadId: customThreadId
    } = body;

    // Required fields check
    if (!to || !subject || !bodyText) {
      return c.json({
        success: false,
        statusCode: 400,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Validation failure: "to", "subject", and "bodyText" are mandatory fields.'
        }
      }, 400);
    }

    // Recipient RFC 5322 format check
    const cleanTo = to.trim().toLowerCase();
    if (!RFC5322_EMAIL_REGEX.test(cleanTo)) {
      return c.json({
        success: false,
        statusCode: 400,
        error: {
          code: 'INVALID_RECIPIENT_ADDRESS',
          message: `Recipient address "${cleanTo}" does not comply with RFC 5322 email syntax.`
        }
      }, 400);
    }

    // Check 25MB message limit
    const approximateSize = Buffer.byteLength(bodyText, 'utf8') + 
      attachments.reduce((acc: number, att: any) => acc + (att.base64Content ? Math.ceil(att.base64Content.length * 0.75) : 0), 0);
    if (approximateSize > MAX_MESSAGE_BYTES) {
      return c.json({
        success: false,
        statusCode: 413,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: `Total message size (${Math.round(approximateSize / 1024 / 1024)}MB) exceeds Cloudflare Email Routing limit of 25MB.`
        }
      }, 413);
    }

    // 5. Sender Policy Enforcement (Token-Derived Identity & Hierarchy Rules)
    const senderPolicy = resolveSenderPolicy(user, from, body.senderName);
    if (!senderPolicy.allowed || !senderPolicy.sender) {
      return c.json({
        success: false,
        statusCode: senderPolicy.statusCode || 403,
        error: {
          code: senderPolicy.errorCode || 'SENDER_POLICY_VIOLATION',
          message: senderPolicy.reason || 'Sender address violates hierarchy policy.'
        }
      }, (senderPolicy.statusCode || 403) as any);
    }

    const senderEmail = senderPolicy.sender.senderEmail;
    const senderName = senderPolicy.sender.senderName;

    // 6. Resolve Partition Key from recipient
    const partitionInfo = resolvePartitionKey(cleanTo);
    const domain = partitionInfo.domain;
    const pk = partitionInfo.pk;

    const emailId = `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const threadId = customThreadId || `th_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    // 7. Deliverability & Spam Heuristic Analysis
    const spamReport = analyzeEmailDeliverability({
      sender: senderEmail,
      receiver: cleanTo,
      subject,
      bodyText,
      isInternalAuth: true
    });

    // 8. Upload file attachments to Cloudflare R2 (Egress-Free)
    const uploadedAttachments: R2AttachmentMetadata[] = [];
    for (const att of attachments) {
      if (!att.filename || !att.base64Content) continue;
      const fileBuffer = Buffer.from(att.base64Content, 'base64');
      const sanitizedFilename = att.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const r2Key = `emails/${domain}/${pk}/${emailId}/${sanitizedFilename}`;

      const r2Meta = await uploadToR2({
        key: r2Key,
        content: fileBuffer,
        contentType: att.contentType || 'application/octet-stream',
        filename: att.filename
      });
      uploadedAttachments.push(r2Meta);
    }

    // 9. Generate standard RFC 5322 MIME format email & store in R2
    const now = new Date();
    const rawMimeContent = [
      `From: "${senderName}" <${senderEmail}>`,
      `To: <${cleanTo}>`,
      cc && cc.length > 0 ? `Cc: ${cc.join(', ')}` : '',
      `Subject: ${subject}`,
      `Date: ${now.toUTCString()}`,
      `Message-ID: <${emailId}@housika.co.ke>`,
      `Return-Path: <${senderEmail}>`,
      `MIME-Version: 1.0`,
      `X-Mailer: Housika-Enterprise-Mail/3.0 (Cloudflare Workers Runtime)`,
      `X-Sender-Level: ${user.level}`,
      `X-Sender-Policy: ${senderPolicy.sender.policyNotes}`,
      `Content-Type: text/plain; charset=utf-8`,
      ``,
      bodyText
    ].filter(Boolean).join('\r\n');

    const mimeR2Key = `emails/${domain}/${pk}/${emailId}/raw.eml`;
    await uploadToR2({
      key: mimeR2Key,
      content: rawMimeContent,
      contentType: 'message/rfc822',
      filename: 'raw.eml'
    });

    // 10. Incur Recipient Hierarchy Level
    let receiverLevel = 75;
    if (pk === 'company' || cleanTo.startsWith('company@')) receiverLevel = 100;
    else if (pk === 'ceo' || cleanTo.startsWith('ceo@')) receiverLevel = 90;
    else if (pk === 'admin') receiverLevel = 90;
    else if (pk === 'payments') receiverLevel = 80;
    else if (body.receiverLevel) receiverLevel = body.receiverLevel;

    // 11. Build Cosmos DB Document with Guaranteed createdAt & updatedAt
    const nowIso = now.toISOString();
    const emailDocument: EmailDocument = {
      id: emailId,
      pk,
      domain,
      sender: senderEmail,
      senderName,
      receiver: cleanTo,
      receiverName: cleanTo.split('@')[0],
      receiverLevel,
      cc,
      bcc,
      subject,
      textPreview: bodyText.slice(0, 300) + (bodyText.length > 300 ? '...' : ''),
      bodyText,
      bodyHtml: bodyHtml || `<p>${bodyText.replace(/\n/g, '<br/>')}</p>`,
      r2MimeKey: mimeR2Key,
      attachments: uploadedAttachments,
      threadId,
      status: spamReport.status,
      isRead: false,
      isStarred: false,
      spamScore: spamReport.spamScore,
      spamReasons: spamReport.reasons,
      spfResult: spamReport.spfResult,
      dkimResult: spamReport.dkimResult,
      dmarcResult: spamReport.dmarcResult,
      attribution: {
        agentId: user.accountId,
        agentName: user.name,
        agentEmail: user.email,
        agentLevel: user.level,
        action: 'sent',
        timestamp: nowIso
      },
      createdAt: nowIso,
      updatedAt: nowIso
    };

    const { email: savedEmail, ruCharged } = await saveEmailToCosmos(emailDocument);

    const responsePayload = {
      success: true,
      statusCode: 201,
      data: savedEmail,
      meta: {
        message: spamReport.isSpam ? 'Email flagged as spam by heuristic filters.' : 'Email successfully dispatched and archived.',
        messageId: emailId,
        senderResolved: senderEmail,
        senderPolicy: senderPolicy.sender,
        partitionKey: pk,
        r2MimeKey: mimeR2Key,
        attachmentsCount: uploadedAttachments.length,
        spamAnalysis: spamReport,
        ruCharged
      }
    };

    // Cache for idempotency if key was provided
    if (idempotencyKey) {
      idempotencyStore.set(idempotencyKey, {
        response: responsePayload,
        timestamp: Date.now()
      });
    }

    c.header('X-Message-ID', emailId);
    c.header('X-Cosmos-RU', ruCharged.toString());
    c.header('X-Sender-Resolved', senderEmail);

    return c.json(responsePayload, 201);
  } catch (error: any) {
    return c.json({
      success: false,
      statusCode: 500,
      error: {
        code: 'INTERNAL_DISPATCH_FAILURE',
        message: error.message || 'An error occurred during email dispatch processing.'
      }
    }, 500);
  }
}
