import nodemailer, { Transporter } from 'nodemailer';
import { logger } from '../lib/logger';
import { env } from '../config/env';

export interface EmailDispatchResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface IEmailService {
  sendOtpEmail(toEmail: string, otp: string): Promise<EmailDispatchResult>;
  sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<EmailDispatchResult>;
  setSimulateFailure(value: boolean): void;
}

class InMemoryEmailSink {
  private otps = new Map<string, string>();
  private resetLinks = new Map<string, string>();

  recordOtp(email: string, otp: string) {
    this.otps.set(email.toLowerCase(), otp);
  }

  getLastOtp(email: string): string | undefined {
    return this.otps.get(email.toLowerCase());
  }

  recordResetLink(email: string, link: string) {
    this.resetLinks.set(email.toLowerCase(), link);
  }

  getLastResetLink(email: string): string | undefined {
    return this.resetLinks.get(email.toLowerCase());
  }

  clear() {
    this.otps.clear();
    this.resetLinks.clear();
  }
}

export const devEmailSink = new InMemoryEmailSink();

export class ConsoleEmailService implements IEmailService {
  private shouldSimulateFailure = false;

  setSimulateFailure(value: boolean) {
    this.shouldSimulateFailure = value;
  }

  async sendOtpEmail(toEmail: string, otp: string): Promise<EmailDispatchResult> {
    devEmailSink.recordOtp(toEmail, otp);

    if (this.shouldSimulateFailure) {
      logger.warn(`[EmailService] Simulated email delivery failure to ${toEmail}`);
      return { success: false, error: 'Simulated email provider network failure' };
    }

    if (process.env.NODE_ENV !== 'test') {
      console.log('\n======================================================');
      console.log(`✉️  [DEV EMAIL SINK] Dispatched OTP for ${toEmail}`);
      console.log(`👉  VERIFICATION CODE: [ ${otp} ]`);
      console.log('======================================================\n');
      logger.info(`[Email Service] Dispatched OTP verification email to ${toEmail}`);
    }

    return { success: true, messageId: `mock-msg-${Date.now()}` };
  }

  async sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<EmailDispatchResult> {
    devEmailSink.recordResetLink(toEmail, resetUrl);

    if (this.shouldSimulateFailure) {
      return { success: false, error: 'Simulated email provider network failure' };
    }

    if (process.env.NODE_ENV !== 'test') {
      console.log('\n======================================================');
      console.log(`✉️  [DEV EMAIL SINK] Password Reset Link for ${toEmail}`);
      console.log(`👉  RESET URL: ${resetUrl}`);
      console.log('======================================================\n');
      logger.info(`[Email Service] Dispatched password reset email to ${toEmail}`);
    }

    return { success: true, messageId: `mock-reset-${Date.now()}` };
  }
}

export class SmtpEmailService implements IEmailService {
  private transporter: Transporter | null = null;

  setSimulateFailure(_value: boolean) {}

  private getTransporter(): Transporter {
    if (!this.transporter) {
      const host = env.EMAIL_SMTP_HOST || 'smtp.gmail.com';
      const port = env.EMAIL_SMTP_PORT ? Number(env.EMAIL_SMTP_PORT) : 587;
      const user = env.EMAIL_SMTP_USER;
      const pass = env.EMAIL_SMTP_PASS;

      logger.info(`[Email Service] Initializing SMTP transport via ${host}:${port} as ${user}`);

      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    }
    return this.transporter;
  }

  async sendOtpEmail(toEmail: string, otp: string): Promise<EmailDispatchResult> {
    try {
      const transporter = this.getTransporter();
      const from = env.EMAIL_FROM || env.EMAIL_SMTP_USER || 'no-reply@messinsight.local';

      logger.info(`[Email Service] Sending live verification email to ${toEmail} from ${from}...`);

      const info = await transporter.sendMail({
        from: `"MessInsight Portal" <${from}>`,
        to: toEmail,
        subject: `[MessInsight] Your Verification Code: ${otp}`,
        text: `Your MessInsight verification code is: ${otp}. This code expires in 10 minutes.`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #0f172a; font-size: 24px; font-weight: 800; margin: 0;">Mess<span style="color: #2563eb;">Insight</span></h1>
              <p style="color: #64748b; font-size: 14px; margin-top: 4px;">National Institute of Technology Patna</p>
            </div>
            
            <h2 style="color: #1e293b; font-size: 18px; margin-bottom: 12px;">Verify your institute email</h2>
            <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
              Thank you for registering on MessInsight. Use the following 6-digit code to complete your account verification:
            </p>

            <div style="background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
              <span style="font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1e40af;">${otp}</span>
            </div>

            <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0;">
              ⏳ This verification code expires in <strong>10 minutes</strong>.<br />
              If you did not request this registration, you can safely ignore this email.
            </p>

            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
              © MessInsight • Automated notification, please do not reply.
            </p>
          </div>
        `,
      });

      console.log(`[Email Service] Live verification email successfully delivered to ${toEmail} (ID: ${info.messageId})`);
      logger.info(`[Email Service] Sent live verification email to ${toEmail} (${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Email Service] SMTP Delivery Error to ${toEmail}:`, errorMsg);
      logger.error(`[Email Service] Failed to send email to ${toEmail}`, undefined, undefined, err as Error);
      return { success: false, error: errorMsg };
    }
  }

  async sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<EmailDispatchResult> {
    try {
      const transporter = this.getTransporter();
      const from = env.EMAIL_FROM || env.EMAIL_SMTP_USER || 'no-reply@messinsight.local';
      const fullUrl = `${env.NEXT_PUBLIC_APP_URL}${resetUrl}`;

      const info = await transporter.sendMail({
        from: `"MessInsight Portal" <${from}>`,
        to: toEmail,
        subject: `[MessInsight] Reset Your Password`,
        text: `Reset your MessInsight password by opening this link: ${fullUrl}. This link expires in 1 hour.`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #0f172a; font-size: 24px; font-weight: 800; margin: 0;">Mess<span style="color: #2563eb;">Insight</span></h1>
            </div>
            
            <h2 style="color: #1e293b; font-size: 18px; margin-bottom: 12px;">Password Reset Request</h2>
            <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
              We received a request to reset your password. Click the button below to set a new password:
            </p>

            <div style="text-align: center; margin: 28px 0;">
              <a href="${fullUrl}" style="background: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">
                Reset Password
              </a>
            </div>

            <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0;">
              This link expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.
            </p>
          </div>
        `,
      });

      logger.info(`[Email Service] Sent live password reset email to ${toEmail} (${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Email Service] SMTP Delivery Error to ${toEmail}:`, errorMsg);
      logger.error(`[Email Service] Failed to send password reset to ${toEmail}`, undefined, undefined, err as Error);
      return { success: false, error: errorMsg };
    }
  }
}

/**
 * Delegating email service that dynamically selects SMTP when credentials
 * exist in the environment, or falls back to console sink in development/test.
 */
class DelegatingEmailService implements IEmailService {
  private consoleService = new ConsoleEmailService();
  private smtpService = new SmtpEmailService();

  setSimulateFailure(value: boolean) {
    this.consoleService.setSimulateFailure(value);
  }

  private getActiveService(): IEmailService {
    const hasSmtpCredentials = Boolean(env.EMAIL_SMTP_USER && env.EMAIL_SMTP_PASS);
    const isSmtpProvider = env.EMAIL_PROVIDER === 'smtp' || hasSmtpCredentials;

    if (isSmtpProvider && hasSmtpCredentials) {
      return this.smtpService;
    }
    return this.consoleService;
  }

  async sendOtpEmail(toEmail: string, otp: string): Promise<EmailDispatchResult> {
    return this.getActiveService().sendOtpEmail(toEmail, otp);
  }

  async sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<EmailDispatchResult> {
    return this.getActiveService().sendPasswordResetEmail(toEmail, resetUrl);
  }
}

export const emailService: IEmailService = new DelegatingEmailService();
