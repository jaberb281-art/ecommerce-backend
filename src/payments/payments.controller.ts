// import { Controller, Post, Body, UseGuards } from '@nestjs/common';
// import { PaymentsService } from './payments.service';

// @Controller('payments')
// export class PaymentsController {
//     constructor(private readonly paymentsService: PaymentsService) { }

//     @Post('create-intent')
//     async createIntent(@Body() data: { amount: number }) {
//         // This calls the Stripe logic we put in your service
//         const intent = await this.paymentsService.createPaymentIntent(data.amount);

//         // We return the client_secret so the frontend can show the credit card form
//         return {
//             clientSecret: intent.client_secret,
//         };
//     }
// }