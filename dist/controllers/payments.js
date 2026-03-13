// src/controllers/paymentsEmailController.ts
import { sendMail } from "../utils/zeptomail.js";
import { paymentTemplate } from "../templates/payments.js";
/**
 * Acknowledge payment receipt via email
 */
export async function sendPaymentEmail(req) {
    const { to, recipientName, amount, currency, gateway, reference, status, } = req;
    const html = paymentTemplate(recipientName, amount, currency, gateway, reference, status);
    return sendMail(to, "Payment Acknowledgment", html, "payments@housika.co.ke");
}
