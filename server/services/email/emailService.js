import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';

let transporter = null;

if (env.smtp.host && env.smtp.user && env.smtp.pass) {
  try {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465, // true for 465, false for other ports
      auth: {
        user: env.smtp.user,
        pass: env.smtp.pass,
      },
    });
    console.log(`[EMAIL] Nodemailer transporter initialized for host: ${env.smtp.host}`);
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to create SMTP transporter: ${error.message}`);
  }
} else {
  console.log('[EMAIL] Running in mock/logging email mode (SMTP settings missing in env)');
}

class EmailService {
  async sendEmail({ to, subject, html, text }) {
    const from = env.smtp.from || 'noreply@resolveai.com';
    
    if (transporter) {
      try {
        const info = await transporter.sendMail({
          from,
          to,
          subject,
          text,
          html,
        });
        console.log(`[EMAIL] Email sent successfully to ${to}. Message ID: ${info.messageId}`);
        return true;
      } catch (error) {
        console.error(`[EMAIL ERROR] Failed to send email to ${to}: ${error.message}`);
        this.logMockEmail(to, subject, html || text);
        return false;
      }
    } else {
      this.logMockEmail(to, subject, html || text);
      return true;
    }
  }

  logMockEmail(to, subject, content) {
    console.log('==================== MOCK EMAIL NOTIFICATION ====================');
    console.log(`TO      : ${to}`);
    console.log(`FROM    : ${env.smtp.from || 'noreply@resolveai.com'}`);
    console.log(`SUBJECT : ${subject}`);
    console.log('--------------------------- CONTENT -----------------------------');
    console.log(content.replace(/<[^>]*>/g, '\n').replace(/\n\s*\n/g, '\n').trim());
    console.log('=================================================================');
  }

  async sendRefundEmail(customerEmail, customerName, orderId, refundAmount, transactionId) {
    return this.sendEmail({
      to: customerEmail,
      subject: `Refund Processed for Order #${orderId}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2>Hello ${customerName},</h2>
          <p>We have processed a refund of <strong>₹${refundAmount}</strong> for your order <strong>#${orderId}</strong>.</p>
          <p>This refund has been credited back to your original payment method. The refund transaction ID is: <code>${transactionId}</code>.</p>
          <p>It may take 5-7 business days for the amount to reflect in your account depending on your bank.</p>
          <br>
          <p>Best regards,</p>
          <p><strong>ResolveAI Support</strong></p>
        </div>
      `,
      text: `Hello ${customerName},\n\nWe have processed a refund of ₹${refundAmount} for your order #${orderId}.\n\nRefund transaction ID: ${transactionId}.\n\nBest regards,\nResolveAI Support`
    });
  }

  async sendResolutionEmail(customerEmail, customerName, orderId, disputeCategory, message) {
    return this.sendEmail({
      to: customerEmail,
      subject: `Dispute Resolved - Order #${orderId}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2>Hello ${customerName},</h2>
          <p>Your dispute regarding <strong>${disputeCategory.replace('_', ' ')}</strong> for order <strong>#${orderId}</strong> has been resolved.</p>
          <p><strong>Resolution:</strong></p>
          <blockquote style="background: #f4f4f4; padding: 10px; border-left: 4px solid #007bff; margin: 15px 0;">
            ${message}
          </blockquote>
          <br>
          <p>Best regards,</p>
          <p><strong>ResolveAI Support</strong></p>
        </div>
      `,
      text: `Hello ${customerName},\n\nYour dispute regarding ${disputeCategory} for order #${orderId} has been resolved.\n\nResolution: ${message}\n\nBest regards,\nResolveAI Support`
    });
  }

  async sendHumanReviewEmail(customerEmail, customerName, orderId, disputeCategory) {
    return this.sendEmail({
      to: customerEmail,
      subject: `Dispute Received - Under Review - Order #${orderId}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2>Hello ${customerName},</h2>
          <p>We have received your dispute regarding <strong>${disputeCategory.replace('_', ' ')}</strong> for order <strong>#${orderId}</strong>.</p>
          <p>Due to the complexity of the request, it has been forwarded to our customer support team for manual review. A representative will contact you shortly.</p>
          <br>
          <p>Best regards,</p>
          <p><strong>ResolveAI Support</strong></p>
        </div>
      `,
      text: `Hello ${customerName},\n\nWe have received your dispute regarding ${disputeCategory} for order #${orderId}. Due to complexity, it has been forwarded for human review.\n\nBest regards,\nResolveAI Support`
    });
  }

  async sendAdditionalEvidenceEmail(customerEmail, customerName, orderId, requestMessage) {
    return this.sendEmail({
      to: customerEmail,
      subject: `Action Required: Additional Evidence Needed - Order #${orderId}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2>Hello ${customerName},</h2>
          <p>We are reviewing your dispute for order <strong>#${orderId}</strong>, and require additional information or evidence.</p>
          <p><strong>Message from Support:</strong></p>
          <blockquote style="background: #f4f4f4; padding: 10px; border-left: 4px solid #ffc107; margin: 15px 0;">
            ${requestMessage}
          </blockquote>
          <p>Please upload the requested evidence through your order page to proceed with resolution.</p>
          <br>
          <p>Best regards,</p>
          <p><strong>ResolveAI Support</strong></p>
        </div>
      `,
      text: `Hello ${customerName},\n\nAdditional evidence is needed for order #${orderId}.\n\nMessage: ${requestMessage}\n\nBest regards,\nResolveAI Support`
    });
  }
}

export const emailService = new EmailService();
export default emailService;
