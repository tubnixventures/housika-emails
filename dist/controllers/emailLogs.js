// src/controllers/emailLogs.ts
import { db } from "../utils/bunnydb.js";
import { verifyToken } from "../utils/jwt.js";
import { getSession } from "../utils/redis.js";
export async function listEmailLogs(token, options = {}) {
    const payload = verifyToken(token);
    // Session check
    const session = await getSession(payload.userId);
    if (!session) {
        throw new Error("Session expired or invalid");
    }
    // Only allow admins to read audit logs
    if (payload.role !== "admin") {
        throw new Error("Forbidden: Admins only");
    }
    const page = Math.max(1, options.page ?? 1);
    const perPage = Math.min(100, Math.max(1, options.perPage ?? 20));
    const offset = (page - 1) * perPage;
    const whereClauses = [];
    const params = [];
    if (options.senderRole) {
        whereClauses.push("sender_role = ?");
        params.push(options.senderRole);
    }
    if (options.recipientEmail) {
        whereClauses.push("recipient_email = ?");
        params.push(options.recipientEmail);
    }
    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
    // Total count for pagination
    const countRow = await db.execute(`SELECT COUNT(*) AS count FROM email_logs ${whereSql};`, params);
    const total = Number(countRow.rows?.[0]?.count ?? 0);
    const listParams = [...params, perPage, offset];
    const rows = await db.execute(`SELECT id, sender_role, sender_email, recipient_email, subject, body, sent_at, created_at
     FROM email_logs
     ${whereSql}
     ORDER BY sent_at DESC
     LIMIT ? OFFSET ?;`, listParams);
    return {
        total,
        page,
        perPage,
        results: (rows.rows ?? []),
    };
}
