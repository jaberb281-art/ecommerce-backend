// ============================================================================
// Payments controller
// ----------------------------------------------------------------------------
//   POST /api/payments/tap/charge   — auth: user, creates a charge for own order
//   POST /api/payments/tap/webhook  — public, Tap server-to-server (signed)
//   POST /api/payments/tap/refund   — auth: admin, full or partial refund
//   GET  /api/payments/order/:id    — auth: user, current payment status
// ============================================================================

import {
    Controller,
    Post,
    Get,
    Body,
    Headers,
    Param,
    UseGuards,
    Request,
    Req,
    HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { PaymentsService } from './payments.service';
import { CreateChargeDto } from './dto/create-charge.dto';
import { CreateRefundDto } from './dto/create-refund.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('payments')
@Controller('payments/tap')
export class PaymentsController {
    constructor(private readonly payments: PaymentsService) { }

    // ─── Create charge ──────────────────────────────────────────────────────
    @Post('charge')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Create a Tap charge for an existing PENDING order' })
    async createCharge(
        @Request() req: any,
        @Body() dto: CreateChargeDto,
    ) {
        return this.payments.createCharge({
            userId: req.user.id,
            orderId: dto.orderId,
            method: dto.method,
        });
    }

    // ─── Webhook ────────────────────────────────────────────────────────────
    // Public — secured via HMAC signature in `verifyTapSignature`.
    // Requires the raw body (see main.ts raw-body capture).
    @Post('webhook')
    @Public()
    @HttpCode(200)
    @ApiOperation({ summary: 'Tap webhook receiver (HMAC verified)' })
    @ApiHeader({ name: 'hashstring', description: 'Tap HMAC-SHA256 signature' })
    async webhook(
        @Req() req: any,
        @Headers('hashstring') signature?: string,
    ) {
        // `req.rawBody` is set by the raw-body capture middleware in main.ts.
        // `req.body` has already been parsed to JSON by Nest's pipeline.
        const rawBody: string =
            (req.rawBody && Buffer.isBuffer(req.rawBody)
                ? req.rawBody.toString('utf8')
                : (req.rawBody as string)) ?? JSON.stringify(req.body ?? {});

        return this.payments.handleWebhook({
            rawBody,
            signatureHeader: signature,
            payload: req.body,
        });
    }

    // ─── Refund (admin only) ────────────────────────────────────────────────
    @Post('refund')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Issue a full or partial refund (admin)' })
    @ApiHeader({
        name: 'x-idempotency-key',
        description: 'Optional unique key to prevent duplicate refunds on retry',
        required: false,
    })
    async refund(
        @Request() req: any,
        @Body() dto: CreateRefundDto,
        @Headers('x-idempotency-key') idempotencyKey?: string,
    ) {
        return this.payments.createRefund({
            orderId: dto.orderId,
            amount: dto.amount,
            reason: dto.reason,
            adminUserId: req.user.id,
            idempotencyKey,
        });
    }

    // ─── Status lookup (used by storefront polling) ─────────────────────────
    @Get('order/:orderId')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get current payment status for one of my orders' })
    async getForOrder(
        @Request() req: any,
        @Param('orderId') orderId: string,
    ) {
        return this.payments.getPaymentForOrder(req.user.id, orderId);
    }
}
