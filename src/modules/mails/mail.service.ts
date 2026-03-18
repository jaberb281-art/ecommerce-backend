import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {
    constructor(private mailerService: MailerService) { }

    async sendWelcomeEmail(user: any) {
        await this.mailerService.sendMail({
            to: user.email,
            subject: 'Welcome to the Store! 🛍️',
            template: './welcome', // points to templates/welcome.ejs
            context: {
                name: user.name,
            },
        });
    }

    async sendOrderConfirmation(user: any, order: any) {
        await this.mailerService.sendMail({
            to: user.email,
            subject: `Order Confirmed! #${order.id.slice(0, 8)}`,
            template: './order-confirmation',
            context: {
                name: user.name,
                orderId: order.id.slice(0, 8),
                total: order.total,
            },
        });
    }
}