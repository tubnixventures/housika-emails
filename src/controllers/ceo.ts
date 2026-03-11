// src/controllers/ceoController.ts
import { sendMail } from "../utils/zeptomail.js";
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
  return sendMail(to, "Message from the CEO", html, "ceo@housika.co.ke");
}
