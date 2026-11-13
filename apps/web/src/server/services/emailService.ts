import { logger } from '../lib/logger';

export interface EmailDispatchResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface IEmailService {
  sendOtpEmail(toEmail: string, otp: string): Promise<EmailDispatchResult>;
  sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<EmailDispatchResult>;
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

export const emailService: ConsoleEmailService = new ConsoleEmailService();

