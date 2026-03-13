// src/controllers/admin.ts
import { sendMail } from "../utils/zeptomail.js";
import { logEmailAudit } from "../utils/bunnydb.js";
import { adminTemplate } from "../templates/admin.js";
import { verifyToken } from "../utils/jwt.js";
import { getSession } from "../utils/redis.js";

/**
 * Admin-only notification sender.
 * @param token - JWT token string (must include role claim).
 * @param to - Recipient email address.
 * @param recipientName - Recipient display name.
 * @param taskDetails - Details of the task to include in template.
 */
export async function sendAdminNotification(
  token: string,
  to: string,
  recipientName: string,
  taskDetails: string
) {
  // Verify JWT
  const payload = verifyToken<{ userId: string; role: string }>(token);

  // Check session in Redis
  const session = await getSession(payload.userId);
  if (!session) {
    throw new Error("Session expired or invalid");
  }

  // Enforce role
  if (payload.role !== "admin") {
    throw new Error("Forbidden: Admins only");
  }

  // Build and send email
  const html = adminTemplate(taskDetails, recipientName);
  const result = await sendMail(to, "Admin Notification", html, "admin@housika.co.ke");

  // Audit log (non-blocking for main flow)
  logEmailAudit({
    senderRole: "admin",
    senderEmail: "admin@housika.co.ke",
    recipientEmail: to,
    subject: "Admin Notification",
    body: html,
  }).catch((err) => console.error("Failed to write email audit log:", err));

  return result;
}
