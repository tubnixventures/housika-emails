import { Context } from 'hono';
import crypto from 'crypto';
import { extractToken, verifyToken } from '../utils/jwt.js';
import { uploadToR2, R2AttachmentMetadata } from '../utils/r2.js';
import { getEmailFromCosmos, saveEmailToCosmos, EmailDocument } from '../utils/cosmos.js';
import { authorizeMailboxAccess } from '../helpers/hierarchy.js';
import { analyzeEmailDeliverability } from '../helpers/spam.js';
import { checkOutboundRateLimit } from '../helpers/ratelimit.js';
import { resolveSenderPolicy } from '../helpers/sender-policy.js';

/**
 * POST /api/emails/reply
 * Dispatches an enterprise reply with thread referencing and staff attribution.
 * 
 * HTTP Status Codes:
 * - 201 Created: Reply dispatched, parent marked as replied, documents persisted.
 * - 400 Bad Request: Missing required parameters (parentEmailId, parentPk, bodyText).
 * - 401 Unauthorized: Missing or invalid Bearer authentication token.
 * - 403 Forbidden: Insufficient hierarchy permissions or sender spoofing attempt.
 * - 404 Not Found: Parent email record does not exist in the specified partition.
 * - 429 Too Many Requests: Tier rate limit exceeded.
 * - 500 Internal Server Error: Storage or database operation failure.
 */
export async function handleReplyEmail(c: Context) {
  try {
    const rawToken = extractToken(c.req.raw.headers);
    if (!rawToken) {
      return c.json({
        success: false,
        statusCode: 401,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Unauthorized: Bearer authentication required to dispatch replies.'
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
          message: err.message || 'Invalid or expired token.'
        }
      }, 401);
    }

    // Outbound rate limit check
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

    const body = await c.req.json().catch(() => null);
    if (!body) {
      return c.json({
        success: false,
        statusCode: 400,
        error: {
          code: 'INVALID_JSON_BODY',
          message: 'Malformed JSON payload.'
        }
      }, 400);
    }

    const {
      parentEmailId,
      parentPk,
      bodyText,
      bodyHtml,
      attachments = [],
      subject: customSubject,
      from: requestedFrom
    } = body;

    if (!parentEmailId || !parentPk || !bodyText) {
      return c.json({
        success: false,
        statusCode: 400,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Missing required fields: "parentEmailId", "parentPk", and "bodyText" are required.'
        }
      }, 400);
    }

    // 1. Fetch parent email from Cosmos DB
    const { email: parentEmail } = await getEmailFromCosmos(parentEmailId, parentPk);
    if (!parentEmail) {
      return c.json({
        success: false,
        statusCode: 404,
        error: {
          code: 'PARENT_EMAIL_NOT_FOUND',
          message: `Parent email ${parentEmailId} in partition ${parentPk} was not found.`
        }
      }, 404);
    }

    // 2. Authorize: agent must have permission to access the parent mailbox
    const authCheck = authorizeMailboxAccess(user, parentEmail.pk, parentEmail.receiverLevel);
    if (!authCheck.allowed) {
      return c.json({
        success: false,
        statusCode: authCheck.statusCode || 403,
        error: {
          code: 'MAILBOX_ACCESS_FORBIDDEN',
          message: authCheck.reason || 'Forbidden: You do not have permission to reply from this mailbox.'
        }
      }, (authCheck.statusCode || 403) as any);
    }

    // 3. Sender Policy Enforcement
    const senderPolicy = resolveSenderPolicy(user, requestedFrom, body.senderName);
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

    const replySender = senderPolicy.sender.senderEmail;
    const replyRecipient = parentEmail.sender;
    const replySubject = customSubject || (parentEmail.subject.toLowerCase().startsWith('re:') ? parentEmail.subject : `Re: ${parentEmail.subject}`);

    const replyId = `msg_rep_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const threadId = parentEmail.threadId || `th_${parentEmailId}`;
    const domain = parentEmail.domain || user.domain || 'housika.co.ke';
    const replyPk = parentEmail.pk;

    // 4. Upload reply attachments to R2
    const uploadedAttachments: R2AttachmentMetadata[] = [];
    for (const att of attachments) {
      if (!att.filename || !att.base64Content) continue;
      const fileBuffer = Buffer.from(att.base64Content, 'base64');
      const sanitizedFilename = att.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const r2Key = `emails/${domain}/${replyPk}/${replyId}/${sanitizedFilename}`;

      const r2Meta = await uploadToR2({
        key: r2Key,
        content: fileBuffer,
        contentType: att.contentType || 'application/octet-stream',
        filename: att.filename
      });
      uploadedAttachments.push(r2Meta);
    }

    // 5. Raw MIME generation and R2 storage
    const now = new Date();
    const rawMimeContent = [
      `From: "${senderPolicy.sender.senderName} (Housika Support)" <${replySender}>`,
      `To: <${replyRecipient}>`,
      `Subject: ${replySubject}`,
      `Date: ${now.toUTCString()}`,
      `In-Reply-To: <${parentEmail.id}@${domain}>`,
      `References: <${parentEmail.id}@${domain}>`,
      `Message-ID: <${replyId}@${domain}>`,
      `MIME-Version: 1.0`,
      `X-Mailer: Housika-Enterprise-Mail/3.0 (Cloudflare Workers Runtime)`,
      `X-Sender-Level: ${user.level}`,
      `X-Sender-Policy: ${senderPolicy.sender.policyNotes}`,
      `Content-Type: text/plain; charset=utf-8`,
      ``,
      bodyText,
      `\n\n--- Original Message ---`,
      `From: ${parentEmail.sender}`,
      `Date: ${parentEmail.createdAt}`,
      `Subject: ${parentEmail.subject}`,
      `\n${parentEmail.bodyText}`
    ].join('\r\n');

    const mimeR2Key = `emails/${domain}/${replyPk}/${replyId}/raw.eml`;
    await uploadToR2({
      key: mimeR2Key,
      content: rawMimeContent,
      contentType: 'message/rfc822',
      filename: 'raw.eml'
    });

    // 6. Deliverability analysis
    const spamReport = analyzeEmailDeliverability({
      sender: replySender,
      receiver: replyRecipient,
      subject: replySubject,
      bodyText,
      isInternalAuth: true
    });

    const nowIso = now.toISOString();

    // 7. Save reply document to Cosmos DB
    const replyDocument: EmailDocument = {
      id: replyId,
      pk: replyPk,
      domain,
      sender: replySender,
      senderName: `${user.name} (${user.role.toUpperCase()})`,
      receiver: replyRecipient,
      receiverName: parentEmail.senderName,
      subject: replySubject,
      textPreview: bodyText.slice(0, 300) + (bodyText.length > 300 ? '...' : ''),
      bodyText,
      bodyHtml: bodyHtml || `<p>${bodyText.replace(/\n/g, '<br/>')}</p>`,
      r2MimeKey: mimeR2Key,
      attachments: uploadedAttachments,
      threadId,
      inReplyTo: parentEmail.id,
      references: [...(parentEmail.references || []), parentEmail.id],
      status: 'sent',
      isRead: true,
      isStarred: false,
      spamScore: 0,
      spamReasons: ['Authenticated internal staff reply.'],
      spfResult: 'pass',
      dkimResult: 'pass',
      dmarcResult: 'pass',
      attribution: {
        agentId: user.accountId,
        agentName: user.name,
        agentEmail: user.email,
        agentLevel: user.level,
        action: 'replied',
        timestamp: nowIso
      },
      createdAt: nowIso,
      updatedAt: nowIso
    };

    const { email: savedReply, ruCharged: replyRu } = await saveEmailToCosmos(replyDocument);

    // 8. Update parent email's attribution record in Cosmos DB
    parentEmail.attribution = {
      agentId: user.accountId,
      agentName: user.name,
      agentEmail: user.email,
      agentLevel: user.level,
      action: 'replied',
      timestamp: nowIso
    };
    parentEmail.updatedAt = nowIso;
    const { ruCharged: parentRu } = await saveEmailToCosmos(parentEmail);

    c.header('X-Message-ID', replyId);
    c.header('X-Cosmos-RU', (replyRu + parentRu).toFixed(1));
    c.header('X-Sender-Resolved', replySender);

    return c.json({
      success: true,
      statusCode: 201,
      data: savedReply,
      meta: {
        message: 'Reply successfully dispatched and thread updated.',
        replyId,
        parentEmailId,
        senderResolved: replySender,
        senderPolicy: senderPolicy.sender,
        partitionKey: replyPk,
        r2MimeKey: mimeR2Key,
        attachmentsCount: uploadedAttachments.length,
        spamAnalysis: spamReport,
        totalRuCharged: Number((replyRu + parentRu).toFixed(1))
      }
    }, 201);
  } catch (error: any) {
    return c.json({
      success: false,
      statusCode: 500,
      error: {
        code: 'REPLY_DISPATCH_FAILURE',
        message: error.message || 'An error occurred while dispatching the reply.'
      }
    }, 500);
  }
}
