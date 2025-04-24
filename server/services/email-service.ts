import { MailService } from '@sendgrid/mail';
import { getAuthDomain } from '../utils/appConfig';

if (!process.env.SENDGRID_API_KEY) {
  console.warn("WARNING: SENDGRID_API_KEY environment variable is not set. Email functionality will not work.");
}

const mailService = new MailService();
if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
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
    // Initialize with environment variables or default value
    // For SendGrid, this should be a verified sender email address
    if (process.env.EMAIL_FROM && typeof process.env.EMAIL_FROM === 'string') {
      this.from = process.env.EMAIL_FROM;
    } else {
      // Default email - use a gmail address or your verified sender as fallback
      // Note: You should set up a proper verified sender in SendGrid
      console.warn("Warning: EMAIL_FROM not set. Using default sender email address.");
      this.from = 'noreply@adlink.dcxtransform.com';
    }
    
    console.log(`Email service initialized with sender: ${this.from}`);
  }

  async sendEmail(params: EmailParams): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      console.error('SendGrid API key not set. Email not sent.');
      return false;
    }

    try {
      await mailService.send({
        to: params.to,
        from: params.from,
        subject: params.subject,
        text: params.text || '',
        html: params.html || '',
      });
      return true;
    } catch (error) {
      console.error('SendGrid email error:', error);
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