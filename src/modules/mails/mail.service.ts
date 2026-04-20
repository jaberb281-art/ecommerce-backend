import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private readonly resendApiKey: string;
    private readonly fromEmail: string;
    private readonly frontendUrl: string;

    constructor(private configService: ConfigService) {
        const resendApiKey = this.configService.get<string>('RESEND_API_KEY');
        if (!resendApiKey) {
            throw new Error('[MailService] RESEND_API_KEY is not set. Emails cannot be sent.');
        }
        this.resendApiKey = resendApiKey;
        this.fromEmail = this.configService.get<string>('MAIL_FROM', 'Shbash <noreply@shbash.com>');
        this.frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    }

    // Escapes user-controlled strings before inserting into HTML.
    // Prevents XSS in email clients that render arbitrary HTML.
    private escapeHtml(s: string): string {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    private async sendEmail(to: string, subject: string, html: string): Promise<void> {
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
            const body = await response.text().catch(() => '');
            throw new Error(`Resend API ${response.status}: ${body}`);
        }
    }

    async sendPasswordReset(user: any, token: string, expiresMinutes: number) {
        const resetLink = `${this.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
        const name = this.escapeHtml(user.name || 'User');
        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2>Reset Your Password</h2>
                <p>Hello ${name},</p>
                <p>You requested a password reset. Click the button below to continue:</p>
                <a href="${resetLink}" style="background: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
                <p>This link expires in ${expiresMinutes} minutes.</p>
            </div>
        `;
        await this.sendEmail(user.email, 'Password Reset Request', html);
    }

    async sendWelcomeEmail(user: any) {
        const name = this.escapeHtml(user.name || 'there');
        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1>Welcome to Shbash, ${name}!</h1>
                <p>We're glad to have you here.</p>
            </div>
        `;
        await this.sendEmail(user.email, 'Welcome to Shbash! 🛍️', html);
    }

    async sendOrderConfirmation(user: any, order: any) {
        const orderId = this.escapeHtml(order.id.slice(0, 8));
        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1>Order Confirmed!</h1>
                <p>Order ID: #${orderId}</p>
                <p>Thank you for your purchase. We'll notify you when it ships.</p>
            </div>
        `;
        await this.sendEmail(user.email, `Order Confirmation #${orderId}`, html);
    }

    async sendBadgeEmail(user: any, badge: any) {
        const name = this.escapeHtml(user.name || 'there');
        const badgeName = this.escapeHtml(badge.name);
        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1>Achievement Unlocked!</h1>
                <p>Hi ${name}, you earned the <strong>${badgeName}</strong> badge!</p>
            </div>
        `;
        await this.sendEmail(user.email, 'New Achievement Unlocked! 🏅', html);
    }
}