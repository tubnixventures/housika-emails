import { Context } from 'hono';
import { extractToken, verifyToken } from '../utils/jwt.js';
import { listEmailsFromCosmos, queryCrossPartitionCosmos, queryBySenderMaterializedView } from '../utils/cosmos.js';
import { authorizeMailboxAccess } from '../helpers/hierarchy.js';
import { normalizePartitionKey } from '../helpers/partitioning.js';

export async function handleListEmails(c: Context) {
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

    const senderFilter = c.req.query('sender');
    const isGlobalAudit = c.req.query('global') === 'true';

    // 1. Materialized View Query: Search by sender across mailboxes with Cosmos Change Feed index (2.8 RU instead of 42+ RU scan!)
    if (senderFilter) {
      if (user.level < 80) {
        return c.json({
          success: false,
          statusCode: 403,
          error: {
            code: 'INSUFFICIENT_LEVEL',
            message: 'Access Denied: Materialized multi-department sender searches require Manager level (>= 80).'
          }
        }, 403);
      }

      const result = await queryBySenderMaterializedView(senderFilter);
      return c.json({
        success: true,
        data: result.items,
        meta: {
          queryType: 'Materialized Secondary Index (Cosmos GSI Pattern)',
          sender: senderFilter,
          ruCharged: result.ruCharged,
          total: result.items.length,
          advantage: 'Single-partition RU consumption (2.8 RU) compared to 40+ RU cross-partition scan'
        }
      });
    }

    const queryPk = c.req.query('pk') || c.req.query('mailbox') || user.email;
    const normalizedPk = normalizePartitionKey(queryPk);
    const status = c.req.query('status') || 'inbox';
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50', 10)));
    const continuationToken = c.req.query('continuationToken');

    // Global cross-partition search: Only level 90+ (CEO)
    if (isGlobalAudit) {
      if (user.level < 90) {
        return c.json({
          success: false,
          statusCode: 403,
          error: {
            code: 'CROSS_PARTITION_FORBIDDEN',
            message: 'Access Denied: Cross-partition global search is restricted strictly to Level 90+ (CEO).'
          }
        }, 403);
      }

      const domain = c.req.query('domain');
      const result = await queryCrossPartitionCosmos({ domain, status, limit });
      return c.json({
        success: true,
        data: result.items,
        meta: {
          partitionKey: 'CROSS_PARTITION_SCAN',
          queryType: 'Cross-Partition Fan-Out',
          ruCharged: result.ruCharged,
          warning: 'Avoid cross-partition scans in high-throughput flows; prefer single-partition PK queries or Change Feed materialized views.',
          total: result.items.length
        }
      });
    }

    // Standard Single-Partition Mailbox Query:
    // Check hierarchy permissions
    const authCheck = authorizeMailboxAccess(user, normalizedPk);
    if (!authCheck.allowed) {
      return c.json({
        success: false,
        statusCode: authCheck.statusCode || 403,
        error: {
          code: 'INSUFFICIENT_HIERARCHY_LEVEL',
          message: authCheck.reason || 'Forbidden: Insufficient hierarchy permissions for target mailbox.'
        },
        meta: {
          userLevel: user.level,
          targetMailbox: normalizedPk
        }
      }, authCheck.statusCode as any || 403);
    }

    const result = await listEmailsFromCosmos({
      pk: normalizedPk,
      status,
      limit,
      continuationToken
    });

    return c.json({
      success: true,
      data: result.items,
      meta: {
        partitionKey: normalizedPk,
        queryType: 'Single-Partition Query (Optimal)',
        ruCharged: result.ruCharged,
        count: result.items.length,
        statusFilter: status,
        continuationToken: result.continuationToken
      }
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Internal server error while listing emails.' }, 500);
  }
}
