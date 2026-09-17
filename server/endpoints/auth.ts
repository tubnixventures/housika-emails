import { Context } from 'hono';
import { signToken, verifyToken, extractToken, TokenPayload } from '../utils/jwt.js';
import { revokeUserTokens } from '../utils/cosmos.js';

export const PRESET_USERS: Record<string, Omit<TokenPayload, 'iat' | 'exp'>> = {
  company: {
    accountId: 'acc_company_100',
    name: 'Housika Enterprises',
    email: 'company@housika.co.ke',
    role: 'company',
    level: 100,
    domain: 'housika.co.ke',
    assignedMailboxes: ['company', 'all', 'broadcast', 'ceo', 'admin', 'payments', 'help']
  },
  ceo: {
    accountId: 'acc_ceo_001',
    name: 'Housika CEO',
    email: 'ceo@housika.co.ke',
    role: 'ceo',
    level: 90,
    domain: 'housika.co.ke',
    assignedMailboxes: ['ceo', 'payments', 'help', 'admin']
  },
  manager: {
    accountId: 'acc_mgr_001',
    name: 'Collins Juma',
    email: 'collinsjuma@housika.co.ke',
    role: 'manager',
    level: 85,
    domain: 'housika.co.ke',
    assignedMailboxes: ['help', 'payments', 'collinsjuma@housika.co.ke']
  },
  customercare: {
    accountId: 'acc_agent_movin',
    name: 'Movin Juma',
    email: 'movinjuma@housika.co.ke',
    role: 'customercare',
    level: 75,
    domain: 'housika.co.ke',
    assignedMailboxes: ['help', 'payments', 'movinjuma@housika.co.ke']
  },
  unauthorized: {
    accountId: 'acc_intern_50',
    name: 'Junior Intern',
    email: 'intern@housika.co.ke',
    role: 'employee',
    level: 50, // Below 70 - must be rejected by security policy!
    domain: 'housika.co.ke',
    assignedMailboxes: []
  }
};

/**
 * Issue authentication JWT token
 * Sets HttpOnly cookie for web and returns JSON token for header
 */
export async function handleIssueToken(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}));
    const presetKey = body.preset as string;

    let payload: Omit<TokenPayload, 'iat' | 'exp'>;

    if (presetKey && PRESET_USERS[presetKey]) {
      payload = PRESET_USERS[presetKey];
    } else {
      payload = {
        accountId: body.accountId || `acc_${Date.now()}`,
        name: body.name || 'Housika Staff',
        email: body.email || 'staff@housika.co.ke',
        role: body.role || 'customercare',
        level: typeof body.level === 'number' ? body.level : 75,
        domain: body.domain || 'housika.co.ke',
        assignedMailboxes: body.assignedMailboxes || []
      };
    }

    if (payload.level < 70) {
      return c.json({
        error: 'Security Policy Violation: Access levels below 70 cannot be issued authentication tokens.',
        requestedLevel: payload.level,
        minimumAllowed: 70
      }, 403);
    }

    const token = signToken(payload);

    // Set cookie for browser web client
    c.header('Set-Cookie', `token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);

    return c.json({
      success: true,
      token,
      tokenType: 'Bearer',
      bearerToken: `Bearer ${token}`,
      user: payload,
      cookieSet: true,
      instructions: 'Bearer token format: Send header "Authorization: Bearer <token>" with all API requests.'
    });
  } catch (error: any) {
    return c.json({
      success: false,
      statusCode: 400,
      error: { code: 'TOKEN_ISSUANCE_FAILED', message: error.message || 'Token issuance failed.' }
    }, 400);
  }
}

/**
 * Current user session info
 */
export async function handleGetMe(c: Context) {
  const token = extractToken(c.req.raw.headers);
  if (!token) {
    return c.json({
      authenticated: false,
      user: null,
      statusCode: 401,
      error: { code: 'UNAUTHENTICATED', message: 'No authentication token provided.' }
    }, 401);
  }

  try {
    const user = verifyToken(token);
    return c.json({
      authenticated: true,
      user
    });
  } catch (err: any) {
    return c.json({
      authenticated: false,
      statusCode: 403,
      error: { code: 'TOKEN_INVALID', message: err.message || 'Token invalid or expired.' }
    }, 403);
  }
}

/**
 * Revoke User Tokens & Invalidate Sessions
 * (Requires Level 85+ Manager or Self Account Revocation)
 */
export async function handleRevokeSession(c: Context) {
  const token = extractToken(c.req.raw.headers);
  if (!token) {
    return c.json({
      success: false,
      statusCode: 401,
      error: { code: 'AUTH_REQUIRED', message: 'Authentication required' }
    }, 401);
  }

  try {
    const caller = verifyToken(token);
    const body = await c.req.json().catch(() => ({}));
    const targetAccountId = body.accountId || caller.accountId;

    // Only self or Manager (>= 85) can revoke another user's sessions
    if (targetAccountId !== caller.accountId && caller.level < 85) {
      return c.json({
        success: false,
        statusCode: 403,
        error: {
          code: 'INSUFFICIENT_REVOKE_PERMISSION',
          message: 'Insufficient permissions: Manager (level >= 85) required to revoke other users.'
        }
      }, 403);
    }

    revokeUserTokens(targetAccountId);

    return c.json({
      success: true,
      revokedAccountId: targetAccountId,
      message: `All active sessions for account ${targetAccountId} have been revoked.`
    });
  } catch (err: any) {
    return c.json({
      success: false,
      statusCode: 403,
      error: { code: 'REVOKE_FAILED', message: err.message }
    }, 403);
  }
}

/**
 * Logout and clear authentication cookie
 */
export async function handleLogout(c: Context) {
  const token = extractToken(c.req.raw.headers);
  if (token) {
    try {
      const user = verifyToken(token);
      revokeUserTokens(user.accountId);
    } catch {
      // ignore invalid token on logout
    }
  }

  c.header('Set-Cookie', 'token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  return c.json({ success: true, message: 'Logged out successfully. Cookie cleared.' });
}
