import { Context } from 'hono';
import crypto from 'crypto';
import { uploadToR2, R2AttachmentMetadata } from '../utils/r2.js';
import { saveEmailToCosmos, EmailDocument } from '../utils/cosmos.js';
import { resolvePartitionKey } from '../helpers/partitioning.js';
import { analyzeEmailDeliverability } from '../helpers/spam.js';

const WORKER_SECRET = process.env.CF_EMAIL_WORKER_SECRET || 'cf_webhook_secret_key_housika_2026';

/**
 * Cloudflare Email Ingestion Endpoint
 * 
 * Invoked by Cloudflare Email Routing Worker when an email is received for:
 * - ceo@housika.co.ke
 * - payments@housika.co.ke
 * - help@housika.co.ke
 * - collinsjuma@housika.co.ke
 * - movinjuma@housika.co.ke
 * - or any address on housika.co.ke, housika.com, housika.app
 */
export async function handleIngestEmail(c: Context) {
  try {
    // 1. Verify Cloudflare Worker secret using timing-safe comparison to prevent side-channel timing attacks
    const providedSecret = (c.req.header('X-CF-Worker-Secret') || c.req.header('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (providedSecret) {
      const expectedBuffer = Buffer.from(WORKER_SECRET);
      const providedBuffer = Buffer.from(providedSecret);

      const isValid = expectedBuffer.length === providedBuffer.length && 
        crypto.timingSafeEqual(expectedBuffer, providedBuffer);

      if (!isValid) {
        return c.json({
          success: false,
          statusCode: 401,
          error: { code: 'UNAUTHORIZED_WORKER', message: 'Unauthorized: Invalid Cloudflare Worker signature.' }
        }, 401);
      }
    }

    const body = await c.req.json();
    const {
      from,
      to,
      subject = '(No Subject)',
      text = '',
      html = '',
      rawMime,
      headers = {},
      spf,
      dkim,
      dmarc,
      attachments = []
    } = body;

    if (!from || !to) {
      return c.json({
        success: false,
        statusCode: 400,
        error: { code: 'INVALID_PAYLOAD', message: 'Missing required email fields: "from" and "to" are required.' }
      }, 400);
    }

    // 2. Resolve partition key based on recipient
    const { pk, domain } = resolvePartitionKey(to);

    const emailId = `msg_in_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const threadId = body.threadId || `th_in_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    // 3. Save raw MIME to Cloudflare R2 if provided
    let mimeR2Key: string | undefined;
    if (rawMime) {
      mimeR2Key = `emails/${domain}/${pk}/${emailId}/raw.eml`;
      await uploadToR2({
        key: mimeR2Key,
        content: rawMime,
        contentType: 'message/rfc822',
        filename: 'raw.eml'
      });
    }

    // 4. Save attachments to Cloudflare R2
    const uploadedAttachments: R2AttachmentMetadata[] = [];
    for (const att of attachments) {
      if (!att.filename || !att.base64Content) continue;
      const fileBuffer = Buffer.from(att.base64Content, 'base64');
      const r2Key = `emails/${domain}/${pk}/${emailId}/${att.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      const r2Meta = await uploadToR2({
        key: r2Key,
        content: fileBuffer,
        contentType: att.contentType || 'application/octet-stream',
        filename: att.filename
      });
      uploadedAttachments.push(r2Meta);
    }

    // 5. Run Spam & Deliverability Analysis
    const spamReport = analyzeEmailDeliverability({
      sender: from,
      receiver: to,
      subject,
      bodyText: text,
      rawHeaders: headers,
      spf,
      dkim,
      dmarc
    });

    // Determine receiver hierarchy level
    let receiverLevel = 75;
    if (pk === 'ceo' || to.toLowerCase().startsWith('ceo@')) receiverLevel = 90;
    else if (pk === 'admin') receiverLevel = 90;
    else if (pk === 'payments') receiverLevel = 80;

    const nowIso = new Date().toISOString();
    const emailDocument: EmailDocument = {
      id: emailId,
      pk,
      domain,
      sender: from,
      senderName: headers['from-name'] || from.split('@')[0],
      receiver: to,
      receiverName: to.split('@')[0],
      receiverLevel,
      subject,
      textPreview: text.slice(0, 300) + (text.length > 300 ? '...' : ''),
      bodyText: text,
      bodyHtml: html || `<p>${text.replace(/\n/g, '<br/>')}</p>`,
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
      createdAt: nowIso,
      updatedAt: nowIso
    };

    const { email: savedEmail, ruCharged } = await saveEmailToCosmos(emailDocument);

    return c.json({
      success: true,
      data: savedEmail,
      meta: {
        routedToPartition: pk,
        status: spamReport.status,
        spamScore: spamReport.spamScore,
        attachmentsSavedToR2: uploadedAttachments.length,
        ruCharged
      }
    }, 201);
  } catch (error: any) {
    return c.json({
      success: false,
      statusCode: 500,
      error: { code: 'INGESTION_FAILED', message: error.message || 'Ingestion failed.' }
    }, 500);
  }
}
