import sgMail from '@sendgrid/mail';
import { getAuthDomain } from '../utils/appConfig';

if (!process.env.SENDGRID_API_KEY) {
  console.warn("WARNING: SENDGRID_API_KEY environment variable is not set. Email functionality will not work.");
} else {
  // Set API key for the entire SendGrid client
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log("SendGrid API key configured");
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
}

export class EmailService {
  private readonly from: string;
  private readonly domain: string = getAuthDomain();

  constructor() {
    // Always use the specified sender email address
    this.from = 'dev@dcxtransform.com';
    
    console.log(`Email service initialized with sender: ${this.from}`);
  }

  async sendEmail(params: EmailParams): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      console.error('SendGrid API key not set. Email not sent.');
      return false;
    }

    try {
      // Create message using v3 API format
      const msg = {
        to: params.to,
        from: this.from, // Use the class property instead of params.from
        subject: params.subject,
        text: params.text || '',
        html: params.html || '',
      };
      
      // Send email using v3 API
      await sgMail.send(msg);
      console.log(`Email sent successfully to ${params.to}`);
      return true;
    } catch (error) {
      // More detailed error logging
      console.error('SendGrid email error:');
      if (error.response) {
        console.error(error.response.body);
      } else {
        console.error(error);
      }
      return false;
    }
  }

  async sendInvitation(email: string, firstName: string, lastName: string, inviteToken: string): Promise<boolean> {
    const inviteUrl = `${this.domain}/invite/${inviteToken}`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #4f46e5; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">ADLink</h1>
        </div>
        <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
          <h2>You've been invited to join ADLink</h2>
          <p>Hello ${firstName} ${lastName},</p>
          <p>You have been invited to join ADLink, a robust URL shortening and QR code generation platform.</p>
          <p>To accept this invitation, please click the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Accept Invitation</a>
          </div>
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p><a href="${inviteUrl}">${inviteUrl}</a></p>
          <p>This invitation will expire in 7 days.</p>
          <p>Thank you,</p>
          <p>The ADLink Team</p>
        </div>
      </div>
    `;

    const textContent = 
      `You've been invited to join ADLink\n\n` +
      `Hello ${firstName} ${lastName},\n\n` +
      `You have been invited to join ADLink, a robust URL shortening and QR code generation platform.\n\n` +
      `To accept this invitation, please visit this link: ${inviteUrl}\n\n` +
      `This invitation will expire in 7 days.\n\n` +
      `Thank you,\n` +
      `The ADLink Team`;
    
    return this.sendEmail({
      to: email,
      from: this.from,
      subject: 'Invitation to join ADLink',
      text: textContent,
      html: htmlContent
    });
  }
}

// Create and export a singleton instance
export const emailService = new EmailService();