// src/controllers/bookingsEmailController.ts
import { sendMail } from "../utils/zeptomail.js";
import { bookingTemplate } from "../templates/bookings.js";
export async function sendBookingEmail(req) {
    const { to, recipientName, propertyName, roomNumber, receiptNumber, amount, currency, startAt, endsAt, } = req.body;
    const html = bookingTemplate(recipientName, propertyName, roomNumber, receiptNumber, amount, currency, new Date(startAt), new Date(endsAt));
    return sendMail(to, "Booking Confirmation", html, "bookings@housika.co.ke");
}
