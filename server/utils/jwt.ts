import jwt from 'jsonwebtoken';
import { isTokenRevoked } from './cosmos.js';

export interface TokenPayload {
  accountId: string;
  name: string;
  email: string;
  role: 'company' | 'ceo' | 'manager' | 'admin' | 'customercare' | 'employee';
  level: number; // 70 to 100 allowed; below 70 strictly forbidden
  domain: string; // e.g. "housika.co.ke"
  assignedMailboxes?: string[]; // e.g. ["help", "payments", "collinsjuma@housika.co.ke"]
  iat?: number;
  exp?: number;
}

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-housika-jwt-key-2026-minimum-32-chars';

/**
 * Sign a JWT token for an authenticated user
 */
export function signToken(payload: Omit<TokenPayload, 'iat' | 'exp'>, expiresIn: any = '7d'): string {
  if (payload.level < 70) {
    throw new Error('Security Policy Violation: Level below 70 cannot be issued access tokens.');
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    if (typeof decoded.level !== 'number' || decoded.level < 70) {
      throw new Error('Access Denied: Token hierarchy level must be 70 or higher.');
    }
    if (decoded.accountId && isTokenRevoked(decoded.accountId, decoded.iat)) {
      throw new Error('Access Denied: Token has been revoked. Please re-authenticate.');
    }
    return decoded;
  } catch (err: any) {
    throw new Error(err.message || 'Invalid or expired token.');
  }
}

/**
 * Extract token from either Cookie or Authorization header
 * - Web clients pass cookie (e.g. "token=..." or "auth_token=...")
 * - Other clients (API, mobile, external) pass "Authorization: Bearer <token>"
 */
export function extractToken(headers: Headers | Record<string, string | string[] | undefined>): string | null {
  let authHeader: string | undefined;
  let cookieHeader: string | undefined;

  if (headers instanceof Headers) {
    authHeader = headers.get('authorization') || undefined;
    cookieHeader = headers.get('cookie') || undefined;
  } else {
    const auth = headers['authorization'] || headers['Authorization'];
    authHeader = Array.isArray(auth) ? auth[0] : auth;
    const cookie = headers['cookie'] || headers['Cookie'];
    cookieHeader = Array.isArray(cookie) ? cookie[0] : cookie;
  }

  // 1. Check Authorization Bearer header
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) return token;
  }

  // 2. Check Cookie header
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    for (const c of cookies) {
      if (c.startsWith('token=')) {
        return decodeURIComponent(c.substring(6));
      }
      if (c.startsWith('auth_token=')) {
        return decodeURIComponent(c.substring(11));
      }
    }
  }

  return null;
}
