// src/controllers/upgradeAccountController.ts
import { sendMail } from "../utils/zeptomail.js";
import { upgradeAccountTemplate } from "../templates/upgrade.js";

export async function sendUpgradeAccountNotification(
  to: string,
  recipientName: string,
  currentRole: string,
  newRole: string
) {
  const html = upgradeAccountTemplate(recipientName, currentRole, newRole);
  return sendMail(to, "Your Account Has Been Upgraded", html, "upgrade-account@housika.co.ke");
}
