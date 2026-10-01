import { getAuthDomain } from '../utils/appConfig';

// Resend email API
// https://resend.com/docs/api-reference/emails/send-email
const RESEND_API_URL = 'https://api.resend.com/emails';

if (!process.env.RESEND_API_KEY) {
  console.warn("WARNING: RESEND_API_KEY environment variable is not set. Email functionality will not work.");
} else {
  console.log("Resend API key configured");
}

interface EmailParams {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export class EmailService {
  private readonly from: string;
  private readonly fromName: string;
  private readonly domain: string = getAuthDomain();

  constructor() {
    // Must be on a domain verified in Resend (or onboarding@resend.dev for testing)
    this.from = process.env.EMAIL_FROM?.trim() || 'noreply@adlink.dcxtransform.com';
    this.fromName = process.env.EMAIL_FROM_NAME?.trim() || 'ADLink';

    console.log(`Email service initialized with sender: ${this.fromName} <${this.from}>`);
  }

  isConfigured(): boolean {
    return !!process.env.RESEND_API_KEY;
  }

  async sendEmail(params: EmailParams): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('Resend API key not set. Email not sent.');
      return false;
    }

    try {
      const response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: `${this.fromName} <${this.from}>`,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          text: params.text,
        }),
      });

      if (!response.ok) {
        console.error(`Resend email error (${response.status}):`, await response.text());
        return false;
      }

      const { id } = await response.json().catch(() => ({}));
      console.log(`Email sent successfully to ${params.to}${id ? ` (id: ${id})` : ''}`);
      return true;
    } catch (error) {
      console.error('Resend email error:', error);
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
      subject: 'Invitation to join ADLink',
      text: textContent,
      html: htmlContent
    });
  }
}

// Create and export a singleton instance
export const emailService = new EmailService();
