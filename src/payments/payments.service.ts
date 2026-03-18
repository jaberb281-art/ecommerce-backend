// import Stripe from 'stripe';
// import { Injectable } from '@nestjs/common';

// @Injectable()
// export class PaymentsService {
//     private stripe: Stripe;

//     constructor() {
//         this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
//             apiVersion: '2023-10-16', // Use the latest version
//         });
//     }

//     async createPaymentIntent(amount: number, currency: string = 'usd') {
//         return await this.stripe.paymentIntents.create({
//             amount: amount * 100, // Stripe uses cents ($1.00 = 100)
//             currency,
//             automatic_payment_methods: { enabled: true },
//         });
//     }
// }