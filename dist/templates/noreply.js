// src/templates/noreply.ts
export function noreplyTemplate(recipientName, otp, link, linkLabel = "Activate Account") {
    return `
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px;font-family:Arial,Helvetica,sans-serif;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:6px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr style="background:#e67e22;">
            <td style="padding:20px;text-align:center;color:#ffffff;font-size:22px;font-weight:bold;">
              Housika Security Notification
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding:30px;font-size:16px;color:#333;">
              <p style="margin:0 0 15px;">Hello ${recipientName},</p>
              ${otp
        ? `<p style="margin:0 0 15px;">Use the following One-Time Password (OTP):</p>
                     <p style="font-size:24px;font-weight:bold;color:#004aad;text-align:center;margin:20px 0;">${otp}</p>`
        : ""}
              ${link
        ? `<p style="margin:0 0 15px;">Or click the button below:</p>
                     <p style="text-align:center;margin:20px 0;">
                       <a href="${link}" style="background:#004aad;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:4px;font-weight:bold;">
                         ${linkLabel}
                       </a>
                     </p>`
        : ""}
              <p style="margin:0;">This code or link will expire in 10 minutes for your security.</p>
            </td>
          </tr>
          
          <!-- Divider -->
          <tr>
            <td style="padding:0 30px;">
              <hr style="border:none;border-top:1px solid #e0e0e0;margin:20px 0;" />
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding:15px;font-size:12px;color:#777;text-align:center;background:#fafafa;">
              &copy; ${new Date().getFullYear()} Housika Properties. All rights reserved.<br/>
              Sent from <strong>noreply@housika.co.ke</strong>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  `;
}
