// src/controllers/inquiryController.ts
import { sendMail } from "../utils/zeptomail.js";
import { inquiryTemplate } from "../templates/inquiry.js";
export async function sendInquiryAutoReply(to, recipientName, inquirySubject) {
    const html = inquiryTemplate(recipientName, inquirySubject);
    return sendMail(to, "Your Inquiry Has Been Received", html, "inquiry@housika.co.ke");
}
