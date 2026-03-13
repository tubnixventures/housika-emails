// src/controllers/upgradeAccountController.ts
import { sendMail } from "../utils/zeptomail.js";
import { upgradeAccountTemplate } from "../templates/upgrade.js";
export async function sendUpgradeAccountNotification(to, recipientName, currentRole, newRole) {
    const html = upgradeAccountTemplate(recipientName, currentRole, newRole);
    return sendMail(to, "Your Account Has Been Upgraded", html, "upgrade-account@housika.co.ke");
}
