import { Context } from 'hono';
import { extractToken, verifyToken } from '../utils/jwt.js';
import { getEmailFromCosmos, saveEmailToCosmos } from '../utils/cosmos.js';
import { getR2PresignedUrl } from '../utils/r2.js';
import { authorizeMailboxAccess } from '../helpers/hierarchy.js';
import { normalizePartitionKey } from '../helpers/partitioning.js';

export async function handleGetEmail(c: Context) {
  try {
    const rawToken = extractToken(c.req.raw.headers);
    if (!rawToken) {
      return c.json({
        success: false,
        statusCode: 401,
        error: { code: 'AUTH_REQUIRED', message: 'Unauthorized: Missing authentication token in Cookie or Authorization header.' }
      }, 401);
    }

    let user;
    try {
      user = verifyToken(rawToken);
    } catch (err: any) {
      return c.json({
        success: false,
        statusCode: 403,
        error: { code: 'TOKEN_INVALID', message: err.message || 'Invalid token.' }
      }, 403);
    }

    const id = c.req.query('id') || c.req.param('id');
    const targetPk = c.req.query('pk') || c.req.query('mailbox') || user.email;

    if (!id) {
      return c.json({
        success: false,
        statusCode: 400,
        error: { code: 'MISSING_PARAM', message: 'Missing required parameter "id".' }
      }, 400);
    }

    const normalizedPk = normalizePartitionKey(targetPk);

    // Fetch from Cosmos DB using single-partition point read
    const { email, ruCharged } = await getEmailFromCosmos(id, normalizedPk);
    if (!email) {
      return c.json({
        success: false,
        statusCode: 404,
        error: { code: 'EMAIL_NOT_FOUND', message: `Email document with id "${id}" and partition key "${normalizedPk}" not found.` },
        meta: { ruCharged }
      }, 404);
    }

    // Hierarchy & Ownership Check:
    // User must own the email or have hierarchy strictly above the receiver (unless level 100)
    const authCheck = authorizeMailboxAccess(user, email.pk, email.receiverLevel);
    if (!authCheck.allowed) {
      return c.json({
        success: false,
        statusCode: authCheck.statusCode || 403,
        error: {
          code: 'HIERARCHY_FORBIDDEN',
          message: authCheck.reason || 'Forbidden: Insufficient hierarchy permissions to read this email.'
        },
        meta: {
          userLevel: user.level,
          emailReceiverLevel: email.receiverLevel,
          mailbox: email.pk
        }
      }, authCheck.statusCode as any || 403);
    }

    // Generate fresh R2 presigned URLs for attachments
    const enrichedAttachments = await Promise.all(
      (email.attachments || []).map(async (att) => ({
        ...att,
        downloadUrl: await getR2PresignedUrl(att.key, 3600)
      }))
    );

    // If unread, mark as read in Cosmos DB
    if (!email.isRead) {
      email.isRead = true;
      email.updatedAt = new Date().toISOString();
      await saveEmailToCosmos(email);
    }

    return c.json({
      success: true,
      data: {
        ...email,
        attachments: enrichedAttachments
      },
      meta: {
        partitionKey: email.pk,
        queryType: 'Single-Partition Point Read (1.0 RU)',
        ruCharged
      }
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to retrieve email.' }, 500);
  }
}
