import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private readonly resendApiKey: string;
    private readonly fromEmail: string;
    private readonly frontendUrl: string;

    constructor(private configService: ConfigService) {
        this.resendApiKey = this.configService.get<string>('RESEND_API_KEY') ?? '';
        this.fromEmail = this.configService.get<string>('MAIL_FROM', 'Shbash <noreply@shbash.com>');
        this.frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    }

    private async sendEmail(to: string, subject: string, html: string) {
        try {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.resendApiKey}`,
                },
                body: JSON.stringify({
                    from: this.fromEmail,
                    to,
                    subject,
                    html,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                this.logger.error(`Resend API Error: ${JSON.stringify(error)}`);
                return false;
            }
            return true;
        } catch (err) {
            this.logger.error('Failed to send email via Resend', err);
            return false;
        }
    }

    async sendPasswordReset(user: any, token: string, expiresMinutes: number) {
        const resetLink = `${this.frontendUrl}/reset-password?token=${token}`;
        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2>Reset Your Password</h2>
                <p>Hello ${user.name || 'User'},</p>
                <p>You requested a password reset. Click the button below to continue:</p>
                <a href="${resetLink}" style="background: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
                <p>This link expires in ${expiresMinutes} minutes.</p>
            </div>
        `;
        return this.sendEmail(user.email, 'Password Reset Request', html);
    }

    async sendWelcomeEmail(user: any) {
        const html = `<h1>Welcome to Shbash, ${user.name}!</h1><p>We're glad to have you here.</p>`;
        return this.sendEmail(user.email, 'Welcome to Shbash! 🛍️', html);
    }

    async sendOrderConfirmation(user: any, order: any) {
        const html = `<h1>Order Confirmed!</h1><p>Order ID: #${order.id.slice(0, 8)}</p>`;
        return this.sendEmail(user.email, `Order Confirmation #${order.id.slice(0, 8)}`, html);
    }

    async sendBadgeEmail(user: any, badge: any) {
        const html = `<h1>Achievement Unlocked!</h1><p>You earned the ${badge.name} badge!</p>`;
        return this.sendEmail(user.email, 'New Achievement Unlocked! 🏅', html);
    }
}