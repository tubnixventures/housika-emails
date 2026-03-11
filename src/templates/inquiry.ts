// src/templates/inquiry.ts
export function inquiryTemplate(recipientName: string, inquirySubject: string) {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px;font-family:Arial,Helvetica,sans-serif;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:6px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr style="background:#3498db;">
            <td style="padding:20px;text-align:center;color:#ffffff;font-size:22px;font-weight:bold;">
              Inquiry Received
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding:30px;font-size:16px;color:#333;">
              <p style="margin:0 0 15px;">Hello ${recipientName},</p>
              <p style="margin:0 0 15px;">We have received your inquiry regarding:</p>
              <p style="margin:0 0 15px;font-style:italic;color:#555;">${inquirySubject}</p>
              <p style="margin:0 0 15px;">Our team is currently reviewing your message and will get back to you as soon as possible.</p>
              <p style="margin:0;">Thank you for reaching out to Housika Properties. We appreciate your patience.</p>
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
              Sent from <strong>inquiry@housika.co.ke</strong>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  `;
}
