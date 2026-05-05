// ============================================================================
// Payments service — Tap integration
// ----------------------------------------------------------------------------
// Owns the business logic for charge creation, webhook processing, and refunds.
// HTTP concerns live in the controller; provider concerns live in tap.client.ts.
// ============================================================================

import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    ConflictException,
    UnauthorizedException,
    InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
    TapClient,
    TapSourceId,
    TapChargeResponse,
    roundBhd,
    verifyTapSignature,
} from './tap.client';
import { CheckoutPaymentMethod } from './dto/create-charge.dto';

// ── Local enums (mirror Prisma but avoid import order issues if `prisma generate`
//    hasn't been re-run after applying the SQL migration). Cast to any at the
//    Prisma boundary to keep TypeScript happy until the client is regenerated.
export enum LocalPaymentMethodType {
    CARD = 'CARD',
    APPLE_PAY = 'APPLE_PAY',
    BENEFIT_PAY = 'BENEFIT_PAY',
    CASH = 'CASH',
}

export enum LocalPaymentStatus {
    INITIATED = 'INITIATED',
    AUTHORIZED = 'AUTHORIZED',
    CAPTURED = 'CAPTURED',
    FAILED = 'FAILED',
    REFUNDED = 'REFUNDED',
    PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
}

// ── Mapping helpers ────────────────────────────────────────────────────────

const METHOD_TO_TAP_SOURCE: Record<CheckoutPaymentMethod, TapSourceId> = {
    [CheckoutPaymentMethod.CARD]: 'src_card',
    [CheckoutPaymentMethod.APPLE_PAY]: 'src_apple_pay',
    [CheckoutPaymentMethod.BENEFIT_PAY]: 'src_bh.benefit',
};

const METHOD_TO_DB_TYPE: Record<CheckoutPaymentMethod, LocalPaymentMethodType> = {
    [CheckoutPaymentMethod.CARD]: LocalPaymentMethodType.CARD,
    [CheckoutPaymentMethod.APPLE_PAY]: LocalPaymentMethodType.APPLE_PAY,
    [CheckoutPaymentMethod.BENEFIT_PAY]: LocalPaymentMethodType.BENEFIT_PAY,
};

// ============================================================================

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);
    private readonly tap: TapClient;
    private readonly storefrontUrl: string;
    private readonly backendBaseUrl: string;
    private readonly webhookSecret: string;
    private readonly webhookSignatureMode: 'fields' | 'raw';

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) {
        const secret = this.config.get<string>('TAP_SECRET_KEY');
        if (!secret) throw new Error('[Payments] TAP_SECRET_KEY is required');

        this.tap = new TapClient({
            secretKey: secret,
            apiBase: this.config.get<string>('TAP_API_BASE') ?? 'https://api.tap.company/v2',
        });

        this.storefrontUrl = (this.config.get<string>('STOREFRONT_URL') ?? '').replace(/\/$/, '');
        this.backendBaseUrl = (this.config.get<string>('BACKEND_PUBLIC_URL') ?? '').replace(/\/$/, '');
        this.webhookSecret = this.config.get<string>('TAP_WEBHOOK_SECRET') ?? '';
        this.webhookSignatureMode =
            (this.config.get<string>('TAP_WEBHOOK_SIGNATURE_MODE') as 'fields' | 'raw') ?? 'fields';

        if (!this.storefrontUrl) {
            this.logger.warn('STOREFRONT_URL is not set — redirect URLs will be invalid');
        }
        if (!this.webhookSecret) {
            this.logger.warn('TAP_WEBHOOK_SECRET is not set — webhooks will be REJECTED');
        }
    }

    // =======================================================================
    // CREATE CHARGE — called after order has been created in PENDING state.
    // Idempotent: if there's already an INITIATED payment for this order,
    // return its existing transaction URL instead of creating a duplicate.
    // =======================================================================

    async createCharge(opts: {
        userId: string;
        orderId: string;
        method: CheckoutPaymentMethod;
    }): Promise<{ paymentId: string; transactionUrl: string; chargeId: string }> {
        const { userId, orderId, method } = opts;

        // ── Load order + verify ownership ──────────────────────────────────
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { user: { select: { id: true, name: true, email: true, phone: true } } },
        });

        if (!order) throw new NotFoundException('Order not found');
        if (order.userId !== userId) {
            throw new UnauthorizedException('You do not own this order');
        }
        if (order.status !== OrderStatus.PENDING) {
            throw new BadRequestException({
                code: 'ORDER_NOT_PAYABLE',
                message: `Order is in status ${order.status} and cannot be paid`,
            });
        }
        if (Number(order.total) <= 0) {
            throw new BadRequestException('Order total must be greater than zero');
        }

        // ── Idempotency: reuse pending payment if one exists ───────────────
        const existing = await (this.prisma as any).payment.findFirst({
            where: {
                orderId,
                status: LocalPaymentStatus.INITIATED,
                tapTransactionUrl: { not: null },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (existing && existing.method === METHOD_TO_DB_TYPE[method]) {
            this.logger.log(
                `Reusing existing INITIATED payment ${existing.id} for order ${orderId}`,
            );
            return {
                paymentId: existing.id,
                transactionUrl: existing.tapTransactionUrl!,
                chargeId: existing.tapChargeId ?? '',
            };
        }

        // ── Customer info ──────────────────────────────────────────────────
        const [firstName, ...rest] = (order.user.name ?? 'Customer').trim().split(/\s+/);
        const lastName = rest.join(' ') || firstName;
        const phone = order.user.phone
            ? this.parsePhone(order.user.phone)
            : undefined;

        // ── Reserve a payment row first so we have a stable id to reference ─
        const paymentRow = await (this.prisma as any).payment.create({
            data: {
                orderId,
                userId,
                amount: new Prisma.Decimal(roundBhd(Number(order.total))),
                currency: 'BHD',
                method: METHOD_TO_DB_TYPE[method],
                status: LocalPaymentStatus.INITIATED,
            },
        });

        // ── Call Tap ───────────────────────────────────────────────────────
        let charge: TapChargeResponse;
        try {
            charge = await this.tap.createCharge({
                amount: Number(order.total),
                currency: 'BHD',
                customer: {
                    first_name: firstName,
                    last_name: lastName,
                    email: order.user.email,
                    ...(phone ? { phone } : {}),
                },
                sourceId: METHOD_TO_TAP_SOURCE[method],
                orderId,
                paymentId: paymentRow.id,
                description: `Shbash order ${orderId}`,
                redirectUrl: `${this.storefrontUrl}/order-placed?orderId=${orderId}`,
                webhookUrl: `${this.backendBaseUrl}/api/payments/tap/webhook`,
            });
        } catch (err) {
            // Mark the row as failed so we don't get a stuck INITIATED record
            await (this.prisma as any).payment.update({
                where: { id: paymentRow.id },
                data: {
                    status: LocalPaymentStatus.FAILED,
                    failureReason: 'CHARGE_CREATION_FAILED',
                },
            });
            throw err;
        }

        const transactionUrl = charge.transaction?.url;
        if (!transactionUrl) {
            await (this.prisma as any).payment.update({
                where: { id: paymentRow.id },
                data: {
                    status: LocalPaymentStatus.FAILED,
                    failureReason: 'NO_TRANSACTION_URL',
                    rawResponse: charge as any,
                },
            });
            throw new InternalServerErrorException(
                'Tap did not return a transaction URL. Please try a different payment method.',
            );
        }

        // ── Persist Tap response ───────────────────────────────────────────
        await (this.prisma as any).payment.update({
            where: { id: paymentRow.id },
            data: {
                tapChargeId: charge.id,
                tapTransactionUrl: transactionUrl,
                tapReference: charge.reference?.gateway ?? null,
                rawResponse: charge as any,
            },
        });

        await this.prisma.order.update({
            where: { id: orderId },
            data: {
                currentPaymentId: paymentRow.id,
                paymentMethod: METHOD_TO_DB_TYPE[method] as any,
            } as any,
        });

        this.logger.log(
            `Charge ${charge.id} created for order ${orderId} (payment ${paymentRow.id}, method ${method})`,
        );

        return {
            paymentId: paymentRow.id,
            transactionUrl,
            chargeId: charge.id,
        };
    }

    // =======================================================================
    // WEBHOOK — server-to-server source of truth.
    // Idempotent via WebhookEvent unique index (provider, externalId, eventType).
    // =======================================================================

    async handleWebhook(opts: {
        rawBody: string;
        signatureHeader: string | undefined;
        payload: any;
    }) {
        const { rawBody, signatureHeader, payload } = opts;

        // -- 1. Verify signature ------------------------------------------------
        if (!this.webhookSecret) {
            this.logger.error('Rejecting webhook: TAP_WEBHOOK_SECRET not configured');
            throw new UnauthorizedException('Webhook secret not configured');
        }
        const ok = verifyTapSignature({
            rawBody,
            signatureHeader,
            secret: this.webhookSecret,
            payload,
            mode: this.webhookSignatureMode,
        });
        if (!ok) {
            this.logger.warn(
                `Webhook signature mismatch — header: ${signatureHeader?.slice(0, 12)}…`,
            );
            throw new UnauthorizedException('Invalid signature');
        }

        const externalId: string | undefined = payload?.id;
        const status: string | undefined = payload?.status;
        const objectType: string | undefined = payload?.object; // 'charge' | 'refund'

        if (!externalId || !status || !objectType) {
            throw new BadRequestException('Malformed webhook payload');
        }

        // -- 2. Dedupe via unique constraint -----------------------------------
        try {
            await (this.prisma as any).webhookEvent.create({
                data: {
                    provider: 'tap',
                    externalId,
                    eventType: status,
                    payload,
                },
            });
        } catch (err: any) {
            // Unique violation = already processed. Acknowledge with 200 so Tap stops retrying.
            if (err?.code === 'P2002') {
                this.logger.log(
                    `Webhook already processed: ${externalId}/${status} — skipping`,
                );
                return { received: true, duplicate: true };
            }
            throw err;
        }

        // -- 3. Route by object type -------------------------------------------
        if (objectType === 'charge') {
            await this.handleChargeEvent(payload);
        } else if (objectType === 'refund') {
            await this.handleRefundEvent(payload);
        } else {
            this.logger.warn(`Unhandled webhook object type: ${objectType}`);
        }

        return { received: true };
    }

    // -- Charge event ----------------------------------------------------------

    private async handleChargeEvent(payload: any) {
        const chargeId: string = payload.id;
        const status: string = payload.status;

        const payment = await (this.prisma as any).payment.findUnique({
            where: { tapChargeId: chargeId },
        });

        if (!payment) {
            this.logger.warn(`Webhook for unknown charge ${chargeId} — ignoring`);
            return;
        }

        // Verify amount matches what we expected (defence against tampered payloads
        // even though signature is already validated — belt and braces).
        const expected = roundBhd(Number(payment.amount));
        const actual = roundBhd(Number(payload.amount ?? 0));
        if (expected !== actual) {
            this.logger.error(
                `Amount mismatch on charge ${chargeId}: expected ${expected} got ${actual}`,
            );
            return;
        }

        // Map Tap status → our status
        let newStatus: LocalPaymentStatus;
        let orderTransition: OrderStatus | null = null;

        switch (status) {
            case 'CAPTURED':
                newStatus = LocalPaymentStatus.CAPTURED;
                orderTransition = OrderStatus.PROCESSING;
                break;
            case 'AUTHORIZED':
                newStatus = LocalPaymentStatus.AUTHORIZED;
                break;
            case 'FAILED':
            case 'DECLINED':
            case 'CANCELLED':
            case 'ABANDONED':
            case 'TIMEDOUT':
            case 'RESTRICTED':
                newStatus = LocalPaymentStatus.FAILED;
                break;
            default:
                this.logger.log(`Charge ${chargeId} status ${status} — no state change`);
                return;
        }

        await this.prisma.$transaction(async (tx) => {
            await (tx as any).payment.update({
                where: { id: payment.id },
                data: {
                    status: newStatus,
                    failureReason:
                        newStatus === LocalPaymentStatus.FAILED
                            ? payload?.response?.message ?? status
                            : null,
                    rawResponse: payload,
                },
            });

            if (orderTransition) {
                // Only transition if order is still PENDING — guards against
                // double webhooks racing with manual admin actions.
                const order = await tx.order.findUnique({ where: { id: payment.orderId } });
                if (order?.status === OrderStatus.PENDING) {
                    await tx.order.update({
                        where: { id: payment.orderId },
                        data: { status: orderTransition },
                    });
                    this.logger.log(
                        `Order ${payment.orderId} transitioned PENDING → ${orderTransition}`,
                    );
                }
            }
        });

        if (newStatus === LocalPaymentStatus.FAILED) {
            // Failed payments do NOT auto-cancel the order — the customer may retry.
            // A scheduled cleanup (recommended cron, see PAYMENTS.md) reaps stale
            // PENDING orders + releases their stock after, e.g., 30 minutes.
            this.logger.log(`Payment ${payment.id} marked FAILED (${status})`);
        }
    }

    // -- Refund event ----------------------------------------------------------

    private async handleRefundEvent(payload: any) {
        const refundId: string = payload.id;
        const refund = await (this.prisma as any).refund.findUnique({
            where: { tapRefundId: refundId },
        });

        if (!refund) {
            this.logger.warn(`Refund webhook for unknown refund ${refundId}`);
            return;
        }

        const status = payload.status;
        const succeeded = status === 'SUCCEEDED' || status === 'COMPLETED';

        await this.prisma.$transaction(async (tx) => {
            await (tx as any).refund.update({
                where: { id: refund.id },
                data: {
                    status: succeeded ? 'SUCCEEDED' : status === 'FAILED' ? 'FAILED' : 'PROCESSING',
                    rawResponse: payload,
                },
            });

            if (succeeded) {
                // Update payment + bump amountRefunded
                const refundAmount = new Prisma.Decimal(roundBhd(Number(payload.amount)));
                const payment = await (tx as any).payment.update({
                    where: { id: refund.paymentId },
                    data: { amountRefunded: { increment: refundAmount } },
                });

                const totalRefunded = roundBhd(Number(payment.amountRefunded));
                const total = roundBhd(Number(payment.amount));
                const newStatus =
                    totalRefunded >= total
                        ? LocalPaymentStatus.REFUNDED
                        : LocalPaymentStatus.PARTIALLY_REFUNDED;

                await (tx as any).payment.update({
                    where: { id: payment.id },
                    data: { status: newStatus },
                });

                this.logger.log(
                    `Refund ${refundId} succeeded: payment ${payment.id} → ${newStatus} (${totalRefunded}/${total})`,
                );
            }
        });
    }

    // =======================================================================
    // CREATE REFUND — admin-initiated.
    // =======================================================================

    async createRefund(opts: {
        orderId: string;
        amount?: number;
        reason?: string;
        adminUserId: string;
        idempotencyKey?: string;
    }) {
        const { orderId, amount, reason, idempotencyKey } = opts;

        // ── Idempotency check ──────────────────────────────────────────────
        if (idempotencyKey) {
            const existing = await (this.prisma as any).refund.findUnique({
                where: { idempotencyKey },
            });
            if (existing) {
                this.logger.log(`Idempotent refund replay: ${existing.id}`);
                return existing;
            }
        }

        // ── Find the captured payment for this order ───────────────────────
        const payment = await (this.prisma as any).payment.findFirst({
            where: {
                orderId,
                status: { in: [LocalPaymentStatus.CAPTURED, LocalPaymentStatus.PARTIALLY_REFUNDED] },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!payment) {
            throw new NotFoundException('No captured payment found for this order');
        }
        if (!payment.tapChargeId) {
            throw new BadRequestException('Payment has no Tap charge to refund against');
        }

        const total = roundBhd(Number(payment.amount));
        const alreadyRefunded = roundBhd(Number(payment.amountRefunded));
        const remaining = roundBhd(total - alreadyRefunded);

        const refundAmount = roundBhd(amount ?? remaining);

        if (refundAmount <= 0) {
            throw new BadRequestException('Refund amount must be greater than zero');
        }
        if (refundAmount > remaining + 0.0001) {
            throw new BadRequestException(
                `Refund amount ${refundAmount} exceeds remaining ${remaining}`,
            );
        }

        // ── Reserve a refund row ───────────────────────────────────────────
        const refundRow = await (this.prisma as any).refund.create({
            data: {
                paymentId: payment.id,
                amount: new Prisma.Decimal(refundAmount),
                currency: payment.currency,
                reason,
                status: 'PENDING',
                ...(idempotencyKey ? { idempotencyKey } : {}),
            },
        });

        // ── Call Tap ───────────────────────────────────────────────────────
        let providerRefund;
        try {
            providerRefund = await this.tap.createRefund({
                chargeId: payment.tapChargeId,
                amount: refundAmount,
                currency: 'BHD',
                reason,
                reference: refundRow.id,
            });
        } catch (err) {
            await (this.prisma as any).refund.update({
                where: { id: refundRow.id },
                data: { status: 'FAILED' },
            });
            throw err;
        }

        await (this.prisma as any).refund.update({
            where: { id: refundRow.id },
            data: {
                tapRefundId: providerRefund.id,
                rawResponse: providerRefund as any,
                // Tap normally returns SUCCEEDED synchronously for full refunds.
                // If we already got success, mirror it locally; otherwise wait for webhook.
                status:
                    providerRefund.status === 'SUCCEEDED'
                        ? 'SUCCEEDED'
                        : providerRefund.status === 'FAILED'
                            ? 'FAILED'
                            : 'PROCESSING',
            },
        });

        // If synchronous success, also bump payment + flip status.
        if (providerRefund.status === 'SUCCEEDED') {
            await this.prisma.$transaction(async (tx) => {
                const updated = await (tx as any).payment.update({
                    where: { id: payment.id },
                    data: { amountRefunded: { increment: new Prisma.Decimal(refundAmount) } },
                });
                const newRefunded = roundBhd(Number(updated.amountRefunded));
                const newStatus =
                    newRefunded >= total
                        ? LocalPaymentStatus.REFUNDED
                        : LocalPaymentStatus.PARTIALLY_REFUNDED;
                await (tx as any).payment.update({
                    where: { id: payment.id },
                    data: { status: newStatus },
                });
            });
        }

        this.logger.log(
            `Refund ${refundRow.id} (${refundAmount} ${payment.currency}) initiated for order ${orderId} by admin ${opts.adminUserId}`,
        );

        return await (this.prisma as any).refund.findUnique({ where: { id: refundRow.id } });
    }

    // =======================================================================
    // QUERY helpers — used by storefront polling / order detail
    // =======================================================================

    async getPaymentForOrder(userId: string, orderId: string) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
        });
        if (!order || order.userId !== userId) {
            throw new NotFoundException('Order not found');
        }
        const payment = await (this.prisma as any).payment.findFirst({
            where: { orderId },
            orderBy: { createdAt: 'desc' },
            include: { refunds: true },
        });
        return {
            order: {
                id: order.id,
                status: order.status,
                total: order.total,
            },
            payment,
        };
    }

    // =======================================================================
    // Internals
    // =======================================================================

    private parsePhone(raw: string): { country_code: string; number: string } | undefined {
        const cleaned = raw.replace(/[^\d+]/g, '');
        if (!cleaned) return undefined;
        // Bahrain default if no country code
        if (cleaned.startsWith('+973')) return { country_code: '973', number: cleaned.slice(4) };
        if (cleaned.startsWith('00973')) return { country_code: '973', number: cleaned.slice(5) };
        if (cleaned.startsWith('+')) {
            const m = cleaned.match(/^\+(\d{1,3})(\d+)$/);
            if (m) return { country_code: m[1], number: m[2] };
        }
        // Assume Bahrain if it's an 8-digit local number
        if (cleaned.length === 8) return { country_code: '973', number: cleaned };
        return undefined;
    }
}
