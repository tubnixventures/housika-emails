// src/controllers/noreplyController.ts
import { sendMail } from "../utils/zeptomail.js";
import { noreplyTemplate } from "../templates/noreply.js";

/**
 * Send OTP or activation/password reset link via noreply@housika.co.ke
 * - Accepts either OTP, link, or both
 * - Subject line adapts automatically
 */
export async function sendOtpOrLink(
  to: string,
  recipientName: string,
  otp?: string,
  link?: string,
  linkLabel: "Activate Account" | "Reset Password" = "Activate Account"
) {
  const html = noreplyTemplate(recipientName, otp, link, linkLabel);

  const subject = otp
    ? "Your One-Time Password (OTP)"
    : linkLabel === "Activate Account"
    ? "Activate Your Account"
    : "Password Reset Request";

  return sendMail(to, subject, html, "noreply@housika.co.ke");
}
