// ============================================================================
// Tap Payments REST client
// ----------------------------------------------------------------------------
// Thin, typed wrapper around the Tap API. Uses native fetch (Node 18+).
// All money values are sent as numbers (Tap is NOT minor-units like Stripe).
// BHD has 3 decimals — we round at the boundary to avoid float drift.
// ============================================================================

import { Logger, InternalServerErrorException } from '@nestjs/common';

// ── Types ──────────────────────────────────────────────────────────────────

export type TapSourceId =
    | 'src_card'         // Cards (Visa / Mastercard) via hosted page
    | 'src_apple_pay'    // Apple Pay via hosted page
    | 'src_bh.benefit'   // BenefitPay (Bahrain only, BHD only)
    | 'src_all';         // Let Tap show all enabled methods on hosted page

export interface TapCustomer {
    first_name: string;
    last_name?: string;
    email: string;
    phone?: { country_code: string; number: string };
}

export interface CreateChargeInput {
    amount: number;
    currency: 'BHD';
    customer: TapCustomer;
    sourceId: TapSourceId;
    orderId: string;             // your internal order id (echoed back as reference.order)
    paymentId: string;           // your internal payment id (echoed back as reference.transaction)
    description?: string;
    redirectUrl: string;         // where Tap sends the user after the hosted page
    webhookUrl: string;          // where Tap POSTs the lifecycle event
}

export interface TapChargeResponse {
    id: string;                  // "chg_..."
    object: 'charge';
    status:
    | 'INITIATED'
    | 'IN_PROGRESS'
    | 'ABANDONED'
    | 'CANCELLED'
    | 'FAILED'
    | 'DECLINED'
    | 'RESTRICTED'
    | 'CAPTURED'
    | 'AUTHORIZED'
    | 'VOID'
    | 'TIMEDOUT'
    | 'UNKNOWN';
    amount: number;
    currency: string;
    transaction?: { url?: string; reference?: string };
    reference?: { transaction?: string; order?: string; gateway?: string };
    response?: { code?: string; message?: string };
    source?: { id?: string; payment_method?: string };
    receipt?: { id?: string };
}

export interface CreateRefundInput {
    chargeId: string;
    amount: number;
    currency: 'BHD';
    reason?: string;
    reference: string;           // your internal refund id
}

export interface TapRefundResponse {
    id: string;                  // "re_..."
    object: 'refund';
    status: 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'PENDING';
    amount: number;
    currency: string;
    charge_id: string;
    reason?: string;
    response?: { code?: string; message?: string };
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Round to BHD's 3 decimals using integer math to avoid binary float drift.
 * 1.2345 → 1.235, 0.1 + 0.2 → 0.300 (not 0.30000000000000004).
 */
export function roundBhd(amount: number): number {
    return Math.round(amount * 1000) / 1000;
}

// ── Client ─────────────────────────────────────────────────────────────────

export class TapClient {
    private readonly logger = new Logger(TapClient.name);
    private readonly base: string;
    private readonly secretKey: string;

    constructor(opts: { secretKey: string; apiBase?: string }) {
        if (!opts.secretKey) {
            throw new Error('[TapClient] secretKey is required');
        }
        this.secretKey = opts.secretKey;
        this.base = (opts.apiBase ?? 'https://api.tap.company/v2').replace(/\/+$/, '');
    }

    // -- Charges --

    async createCharge(input: CreateChargeInput): Promise<TapChargeResponse> {
        const body = {
            amount: roundBhd(input.amount),
            currency: input.currency,
            threeDSecure: true,
            save_card: false,
            description: input.description ?? `Order ${input.orderId}`,
            statement_descriptor: 'SHBASH',
            reference: {
                transaction: input.paymentId,
                order: input.orderId,
            },
            customer: input.customer,
            source: { id: input.sourceId },
            post: { url: input.webhookUrl },        // server-to-server webhook
            redirect: { url: input.redirectUrl },   // browser redirect after hosted page
        };

        return this.request<TapChargeResponse>('POST', '/charges', body);
    }

    async retrieveCharge(chargeId: string): Promise<TapChargeResponse> {
        return this.request<TapChargeResponse>('GET', `/charges/${chargeId}`);
    }

    // -- Refunds --

    async createRefund(input: CreateRefundInput): Promise<TapRefundResponse> {
        const body = {
            charge_id: input.chargeId,
            amount: roundBhd(input.amount),
            currency: input.currency,
            reason: input.reason ?? 'requested_by_customer',
            reference: { merchant: input.reference },
            post: {},
        };
        return this.request<TapRefundResponse>('POST', '/refunds', body);
    }

    // -- Internal --

    private async request<T>(
        method: 'GET' | 'POST',
        path: string,
        body?: unknown,
    ): Promise<T> {
        const url = `${this.base}${path}`;
        const init: RequestInit = {
            method,
            headers: {
                Authorization: `Bearer ${this.secretKey}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        };
        if (body !== undefined) {
            init.body = JSON.stringify(body);
        }

        // 15s timeout via AbortController — Tap occasionally hangs on cold connections.
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);
        init.signal = controller.signal;

        let res: Response;
        try {
            res = await fetch(url, init);
        } catch (err: any) {
            clearTimeout(timeout);
            this.logger.error(`Tap request network error: ${method} ${path} — ${err.message}`);
            throw new InternalServerErrorException({
                code: 'PAYMENT_PROVIDER_UNREACHABLE',
                message: 'Payment provider is temporarily unavailable. Please try again.',
            });
        }
        clearTimeout(timeout);

        const text = await res.text();
        let json: any = {};
        try {
            json = text ? JSON.parse(text) : {};
        } catch {
            // Non-JSON error response — keep raw for logs
        }

        if (!res.ok) {
            const errs = json?.errors ?? json?.error ?? [];
            const msg = Array.isArray(errs) && errs[0]?.description
                ? errs[0].description
                : json?.message ?? `Tap returned ${res.status}`;
            this.logger.error(
                `Tap ${method} ${path} failed (${res.status}): ${JSON.stringify(json).slice(0, 500)}`,
            );
            throw new InternalServerErrorException({
                code: 'PAYMENT_PROVIDER_ERROR',
                message: msg,
                providerStatus: res.status,
            });
        }

        return json as T;
    }
}

// ── Webhook signature verification ─────────────────────────────────────────

import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verify Tap's `hashstring` header against the raw request body.
 *
 * Tap signs webhook events using HMAC-SHA256 with your webhook secret.
 * Per Tap docs, the canonical signing payload is built from a fixed set of
 * fields concatenated as `key + value`, in this order:
 *
 *   x_id, x_amount, x_currency, x_gateway_reference,
 *   x_payment_reference, x_status, x_created
 *
 * Some Tap account types instead sign the raw JSON body. Both modes are
 * supported here — toggle with TAP_WEBHOOK_SIGNATURE_MODE in env.
 */
export function verifyTapSignature(opts: {
    rawBody: string;
    signatureHeader: string | undefined;
    secret: string;
    payload: any;
    mode: 'fields' | 'raw';
}): boolean {
    if (!opts.signatureHeader || !opts.secret) return false;

    let signingPayload: string;

    if (opts.mode === 'raw') {
        signingPayload = opts.rawBody;
    } else {
        // Field-mode signing string (Tap's standard webhook signing scheme)
        const p = opts.payload ?? {};
        const created = p.transaction?.created ?? p.created ?? '';
        const gatewayRef = p.reference?.gateway ?? '';
        const paymentRef = p.reference?.payment ?? p.reference?.transaction ?? '';
        signingPayload =
            `x_id${p.id ?? ''}` +
            `x_amount${Number(p.amount ?? 0).toFixed(3)}` +
            `x_currency${p.currency ?? ''}` +
            `x_gateway_reference${gatewayRef}` +
            `x_payment_reference${paymentRef}` +
            `x_status${p.status ?? ''}` +
            `x_created${created}`;
    }

    const expected = createHmac('sha256', opts.secret).update(signingPayload).digest('hex');
    const provided = opts.signatureHeader.trim().toLowerCase();

    // Constant-time compare; bail if lengths differ
    const expectedBuf = Buffer.from(expected, 'utf8');
    const providedBuf = Buffer.from(provided, 'utf8');
    if (expectedBuf.length !== providedBuf.length) return false;
    return timingSafeEqual(expectedBuf, providedBuf);
}
