import { Context } from 'hono';
import { extractToken, verifyToken } from '../utils/jwt.js';
import { getEmailFromCosmos, deleteEmailFromCosmos } from '../utils/cosmos.js';
import { deleteFromR2 } from '../utils/r2.js';
import { authorizeMailboxAccess } from '../helpers/hierarchy.js';
import { normalizePartitionKey } from '../helpers/partitioning.js';

export async function handleDeleteEmail(c: Context) {
  try {
    const rawToken = extractToken(c.req.raw.headers);
    if (!rawToken) {
      return c.json({
        success: false,
        statusCode: 401,
        error: { code: 'AUTH_REQUIRED', message: 'Unauthorized: Authentication required.' }
      }, 401);
    }

    let user;
    try {
      user = verifyToken(rawToken);
    } catch (err: any) {
      return c.json({
        success: false,
        statusCode: 403,
        error: { code: 'TOKEN_INVALID', message: err.message || 'Invalid or expired token.' }
      }, 403);
    }

    // Safely parse JSON body once if provided
    const body = (c.req.raw.headers.get('content-type')?.includes('application/json'))
      ? await c.req.json().catch(() => ({}))
      : {};

    const id = c.req.query('id') || body.id;
    const targetPk = c.req.query('pk') || body.pk || user.email;
    const permanent = c.req.query('permanent') === 'true' || body.permanent === true;

    if (!id) {
      return c.json({
        success: false,
        statusCode: 400,
        error: { code: 'INVALID_PARAMETER', message: 'Missing required parameter "id".' }
      }, 400);
    }

    const normalizedPk = normalizePartitionKey(targetPk);

    // 1. Fetch email document to check permissions
    const { email } = await getEmailFromCosmos(id, normalizedPk);
    if (!email) {
      return c.json({
        success: false,
        statusCode: 404,
        error: { code: 'EMAIL_NOT_FOUND', message: `Email ${id} in partition ${normalizedPk} not found.` }
      }, 404);
    }

    // 2. Hierarchy authorization check
    const authCheck = authorizeMailboxAccess(user, email.pk, email.receiverLevel);
    if (!authCheck.allowed) {
      return c.json({
        success: false,
        statusCode: authCheck.statusCode || 403,
        error: {
          code: 'HIERARCHY_FORBIDDEN',
          message: authCheck.reason || 'Forbidden: Insufficient hierarchy level to delete this email.'
        }
      }, authCheck.statusCode as any || 403);
    }

    // 3. Permanent delete restriction (requires Level >= 85)
    if (permanent && user.level < 85) {
      return c.json({
        success: false,
        statusCode: 403,
        error: {
          code: 'INSUFFICIENT_PURGE_PERMISSION',
          message: 'Forbidden: Permanent purge requires Manager level (85+) or CEO (100). Please soft-delete to trash.'
        }
      }, 403);
    }

    // 4. Perform Cosmos DB delete
    const { success, ruCharged } = await deleteEmailFromCosmos(id, normalizedPk, !permanent);

    // 5. If permanent purge, clean up R2 objects
    if (permanent && email.attachments) {
      for (const att of email.attachments) {
        if (att.key) await deleteFromR2(att.key);
      }
      if (email.r2MimeKey) {
        await deleteFromR2(email.r2MimeKey);
      }
    }

    return c.json({
      success: true,
      statusCode: 200,
      message: permanent ? `Email ${id} permanently purged.` : `Email ${id} moved to trash (soft-delete).`,
      meta: {
        id,
        partitionKey: normalizedPk,
        action: permanent ? 'purged' : 'moved_to_trash',
        ruCharged
      }
    });
  } catch (error: any) {
    return c.json({
      success: false,
      statusCode: 500,
      error: { code: 'DELETE_FAILED', message: error.message || 'Failed to delete email.' }
    }, 500);
  }
}
