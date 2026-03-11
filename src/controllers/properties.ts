// src/controllers/propertiesEmailController.ts
import { sendMail } from "../utils/zeptomail.js";
import { propertyTemplate } from "../templates/properties.js";

export async function sendPropertyEmail(req: any) {
  const {
    to,
    recipientName,
    propertyName,
    location,
    unitsAvailable,
    receiptNumber,
    amount,
    currency,
  } = req.body;

  const html = propertyTemplate(
    recipientName,
    propertyName,
    location,
    unitsAvailable,
    receiptNumber,
    amount,
    currency
  );

  return sendMail(to, "Property Creation Confirmation", html, "properties@housika.co.ke");
}
