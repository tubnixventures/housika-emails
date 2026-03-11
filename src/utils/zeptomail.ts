// src/utils/mailer.ts
import { SendMailClient } from "zeptomail";
import dotenv from "dotenv";

dotenv.config();

const url = "https://api.zeptomail.com/v1.1/email";
const token = process.env.ZEPTO_TOKEN!; // store your Zepto API key in .env

const client = new SendMailClient({ url, token });

/**
 * Generic mail sender
 * Controllers must provide:
 *  - recipient email
 *  - subject line
 *  - full HTML template
 *  - sub-address (e.g. ceo@housika.co.ke)
 */
export async function sendMail(
  to: string,
  subject: string,
  html: string,
  fromAddress: string
) {
  return client.sendMail({
    from: {
      address: fromAddress, // controller decides sub-address
      name: "Housika Team",
    },
    to: [
      {
        email_address: {
          address: to,
          name: to.split("@")[0], // fallback name
        },
      },
    ],
    subject,
    htmlbody: html,
  });
}
