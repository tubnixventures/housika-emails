// src/controllers/ceoController.ts
import { sendMail } from "../utils/zeptomail.js";
import { logEmailAudit } from "../utils/bunnydb.js";
import { ceoTemplate } from "../templates/ceo.js";
import { verifyToken } from "../utils/jwt.js";
import { getSession } from "../utils/redis.js";

/**
 * CEO-only message sender.
 * @param token - JWT token string (must include role claim).
 * @param to - Recipient email address.
 * @param recipientName - Recipient display name.
 * @param message - Message content from CEO.
 */
export async function sendCeoMessage(
  token: string,
  to: string,
  recipientName: string,
  message: string
) {
  // Verify JWT
  const payload = verifyToken<{ userId: string; role: string }>(token);

  // Check session in Redis
  const session = await getSession(payload.userId);
  if (!session) {
    throw new Error("Session expired or invalid");
  }

  // Enforce role
  if (payload.role !== "ceo") {
    throw new Error("Forbidden: CEO only");
  }

  // Build and send email
  const html = ceoTemplate(message, recipientName);
  const result = await sendMail(to, "Message from the CEO", html, "ceo@housika.co.ke");

  // Audit log (non-blocking for main flow)
  logEmailAudit({
    senderRole: "ceo",
    senderEmail: "ceo@housika.co.ke",
    recipientEmail: to,
    subject: "Message from the CEO",
    body: html,
  }).catch((err) => console.error("Failed to write email audit log:", err));

  return result;
}
