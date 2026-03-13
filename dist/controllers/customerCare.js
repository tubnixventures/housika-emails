// src/controllers/customerCareController.ts
import { sendMail } from "../utils/zeptomail.js";
import { logEmailAudit } from "../utils/bunnydb.js";
import { customerCareTemplate } from "../templates/customerCare.js";
import { verifyToken } from "../utils/jwt.js";
import { getSession } from "../utils/redis.js";
/**
 * Customer Care-only response sender.
 * @param token - JWT token string (must include role claim).
 * @param to - Recipient email address.
 * @param customerName - Customer's name.
 * @param issueSummary - Summary of the issue.
 * @param agentName - Name of the customer care agent.
 */
export async function sendCustomerCareResponse(token, to, customerName, issueSummary, agentName) {
    // Verify JWT
    const payload = verifyToken(token);
    // Check session in Redis
    const session = await getSession(payload.userId);
    if (!session) {
        throw new Error("Session expired or invalid");
    }
    // Enforce role
    if (payload.role !== "customer-care") {
        throw new Error("Forbidden: Customer Care only");
    }
    // Build and send email
    const html = customerCareTemplate(customerName, issueSummary, agentName);
    const result = await sendMail(to, "Customer Care Response", html, "customer-care@housika.co.ke");
    // Audit log (non-blocking for main flow)
    logEmailAudit({
        senderRole: "customer-care",
        senderEmail: "customer-care@housika.co.ke",
        recipientEmail: to,
        subject: "Customer Care Response",
        body: html,
    }).catch((err) => console.error("Failed to write email audit log:", err));
    return result;
}
