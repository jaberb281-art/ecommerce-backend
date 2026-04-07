import {
    Injectable,
    Logger,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PointTxType } from '@prisma/client';

// ─── Configuration ────────────────────────────────────────────────────────────
// Tweak these numbers without touching any logic.

const POINTS_CONFIG = {
    // How many points per 1 BD spent (e.g. 1 BD → 10 pts)
    POINTS_PER_BD: 10,

    // How many points a user needs to redeem for 1 BD off
    POINTS_PER_BD_REDEMPTION: 100,

    // Minimum points required to redeem anything
    MIN_REDEMPTION_POINTS: 100,

    // Maximum points redeemable in a single order (prevents abuse)
    MAX_REDEMPTION_POINTS: 5000,

    // Bonus points for order count milestones
    ORDER_MILESTONES: {
        1: 50,    // First order ever → 50 bonus points
        5: 100,   // 5th order → 100 bonus points
        10: 250,  // 10th order → 250 bonus points
        25: 500,  // 25th order → 500 bonus points
        50: 1000, // 50th order → 1000 bonus points
    } as Record<number, number>,

    // Points for linking social accounts
    SOCIAL_CONNECT_POINTS: 25,
} as const;

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class PointsService {
    private readonly logger = new Logger(PointsService.name);

    constructor(private prisma: PrismaService) { }

    // ─── Read ─────────────────────────────────────────────────────────────────

    /**
     * Get a user's current point balance and recent transaction history.
     */
    async getBalance(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, pointsBalance: true },
        });

        if (!user) throw new NotFoundException('User not found');

        const transactions = await this.prisma.pointTransaction.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 30,
        });

        return {
            balance: user.pointsBalance,
            transactions,
            config: {
                pointsPerBD: POINTS_CONFIG.POINTS_PER_BD,
                pointsPerBDRedemption: POINTS_CONFIG.POINTS_PER_BD_REDEMPTION,
                minRedemption: POINTS_CONFIG.MIN_REDEMPTION_POINTS,
            },
        };
    }

    // ─── Award: Purchase ──────────────────────────────────────────────────────

    /**
     * Award points for a completed order.
     * Called inside the checkout transaction in OrdersService.
     *
     * @param tx   - The Prisma transaction client (keeps everything atomic)
     * @param userId
     * @param orderId
     * @param totalBD  - The final order total in Bahraini Dinar
     */
    async awardPurchasePoints(
        tx: any,
        userId: string,
        orderId: string,
        totalBD: number,
    ) {
        // 1. NEW: Check if points were already awarded for this specific order
        const existingTx = await tx.pointTransaction.findFirst({
            where: { orderId, type: PointTxType.PURCHASE }
        });

        if (existingTx) {
            this.logger.warn(`Points already awarded for order ${orderId}. Skipping.`);
            return existingTx;
        }

        const pointsEarned = Math.floor(totalBD * POINTS_CONFIG.POINTS_PER_BD);
        if (pointsEarned <= 0) return null;

        // 2. Proceed with awarding
        const [transaction] = await Promise.all([
            tx.pointTransaction.create({
                data: {
                    userId,
                    orderId,
                    points: pointsEarned,
                    type: PointTxType.PURCHASE,
                    description: `Earned ${pointsEarned} pts for BD ${totalBD.toFixed(3)} order`,
                },
            }),
            tx.user.update({
                where: { id: userId },
                data: { pointsBalance: { increment: pointsEarned } },
            }),
        ]);

        this.logger.log(`Points: +${pointsEarned} (PURCHASE) → user ${userId} / order ${orderId}`);
        return transaction;
    }
    // ─── Award: Order Milestone ────────────────────────────────────────────────

    /**
     * Check if this order puts the user at a milestone and award bonus if so.
     * Called after checkout — uses a separate transaction to avoid blocking.
     */
    async checkAndAwardMilestone(userId: string, orderId: string) {
        // Count completed (non-cancelled) orders for this user
        const orderCount = await this.prisma.order.count({
            where: {
                userId,
                status: { not: 'CANCELLED' },
            },
        });

        const bonusPoints = POINTS_CONFIG.ORDER_MILESTONES[orderCount];
        if (!bonusPoints) return null;

        const description = `🎉 Milestone bonus: order #${orderCount}! +${bonusPoints} pts`;

        const [transaction] = await Promise.all([
            this.prisma.pointTransaction.create({
                data: {
                    userId,
                    orderId,
                    points: bonusPoints,
                    type: PointTxType.ORDER_MILESTONE,
                    description,
                },
            }),
            this.prisma.user.update({
                where: { id: userId },
                data: { pointsBalance: { increment: bonusPoints } },
            }),
            // Fire a notification so the user sees it in their feed
            this.prisma.notification.create({
                data: {
                    userId,
                    title: `Order milestone reached! 🎉`,
                    message: description,
                    type: 'GENERAL',
                },
            }),
        ]);

        this.logger.log(
            `Points: +${bonusPoints} (ORDER_MILESTONE #${orderCount}) → user ${userId}`,
        );

        return transaction;
    }

    // ─── Award: Social Connect ────────────────────────────────────────────────

    /**
     * Award points when a user links a social media account.
     * Call this from your social linking endpoint.
     * Idempotent — uses a description check to prevent double-awarding.
     */
    async awardSocialConnect(userId: string, platform: 'instagram' | 'tiktok' | 'twitter') {
        const description = `Linked ${platform} account`;

        // Check if already awarded for this platform
        const alreadyAwarded = await this.prisma.pointTransaction.findFirst({
            where: { userId, type: PointTxType.SOCIAL_CONNECT, description },
        });

        if (alreadyAwarded) {
            this.logger.log(`Points: social connect already awarded for ${platform} → user ${userId}`);
            return null;
        }

        const points = POINTS_CONFIG.SOCIAL_CONNECT_POINTS;

        const [transaction] = await Promise.all([
            this.prisma.pointTransaction.create({
                data: {
                    userId,
                    points,
                    type: PointTxType.SOCIAL_CONNECT,
                    description,
                },
            }),
            this.prisma.user.update({
                where: { id: userId },
                data: { pointsBalance: { increment: points } },
            }),
            this.prisma.notification.create({
                data: {
                    userId,
                    title: `+${points} points for linking ${platform}! 🎉`,
                    message: `You earned ${points} points for connecting your ${platform} account.`,
                    type: 'GENERAL',
                },
            }),
        ]);

        this.logger.log(`Points: +${points} (SOCIAL_CONNECT:${platform}) → user ${userId}`);
        return transaction;
    }

    // ─── Award: Manual (Admin) ────────────────────────────────────────────────

    /**
     * Admin can manually grant or deduct points with a reason.
     */
    async awardManual(userId: string, points: number, description: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        if (points === 0) throw new BadRequestException('Points cannot be zero');

        // Guard against going negative
        if (points < 0 && user.pointsBalance + points < 0) {
            throw new BadRequestException(
                `Cannot deduct ${Math.abs(points)} pts — balance is only ${user.pointsBalance}`,
            );
        }

        const [transaction] = await Promise.all([
            this.prisma.pointTransaction.create({
                data: {
                    userId,
                    points,
                    type: PointTxType.MANUAL,
                    description,
                },
            }),
            this.prisma.user.update({
                where: { id: userId },
                data: { pointsBalance: { increment: points } },
            }),
        ]);

        this.logger.log(
            `Points: ${points > 0 ? '+' : ''}${points} (MANUAL) → user ${userId} — "${description}"`,
        );
        return transaction;
    }

    // ─── Redemption ───────────────────────────────────────────────────────────

    /**
     * Redeem points for a coupon code.
     *
     * Rules:
     * - Minimum 100 points per redemption
     * - Maximum 5000 points per redemption
     * - 100 points = BD 1.00 discount (FIXED coupon, single-use)
     * - Deducts from balance atomically; creates a real coupon in the DB
     */
    async redeemPoints(userId: string, pointsToRedeem: number) {
        // ── Validate amount ──
        if (pointsToRedeem < POINTS_CONFIG.MIN_REDEMPTION_POINTS) {
            throw new BadRequestException(
                `Minimum redemption is ${POINTS_CONFIG.MIN_REDEMPTION_POINTS} points`,
            );
        }
        if (pointsToRedeem > POINTS_CONFIG.MAX_REDEMPTION_POINTS) {
            throw new BadRequestException(
                `Maximum redemption is ${POINTS_CONFIG.MAX_REDEMPTION_POINTS} points per order`,
            );
        }
        // Round to nearest 100 (clean denominations)
        if (pointsToRedeem % 100 !== 0) {
            throw new BadRequestException('Points must be redeemed in multiples of 100');
        }

        const discountBD =
            pointsToRedeem / POINTS_CONFIG.POINTS_PER_BD_REDEMPTION;

        return this.prisma.$transaction(async (tx) => {
            // ── Lock the user row and check balance ──
            const user = await tx.user.findUnique({
                where: { id: userId },
                select: { id: true, pointsBalance: true },
            });

            if (!user) throw new NotFoundException('User not found');

            if (user.pointsBalance < pointsToRedeem) {
                throw new BadRequestException(
                    `Insufficient points — you have ${user.pointsBalance}, need ${pointsToRedeem}`,
                );
            }

            // ── Generate a unique coupon code ──
            const code = `PTS-${userId.slice(0, 6).toUpperCase()}-${Date.now()}`;

            // ── Create the single-use coupon ──
            const coupon = await tx.coupon.create({
                data: {
                    code,
                    discountType: 'FIXED',
                    discountValue: discountBD,
                    maxUses: 1,
                    isActive: true,
                    // Expires in 30 days
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                },
            });

            // ── Deduct points and log the transaction ──
            await Promise.all([
                tx.user.update({
                    where: { id: userId },
                    data: { pointsBalance: { decrement: pointsToRedeem } },
                }),
                tx.pointTransaction.create({
                    data: {
                        userId,
                        points: -pointsToRedeem,
                        type: PointTxType.REDEMPTION,
                        description: `Redeemed ${pointsToRedeem} pts → coupon ${code} (BD ${discountBD.toFixed(3)} off)`,
                    },
                }),
                tx.notification.create({
                    data: {
                        userId,
                        title: `Coupon created! 🎟️`,
                        message: `Your ${pointsToRedeem} points became coupon code ${code} — BD ${discountBD.toFixed(3)} off your next order!`,
                        type: 'GENERAL',
                    },
                }),
            ]);

            this.logger.log(
                `Points: -${pointsToRedeem} (REDEMPTION) → user ${userId} → coupon ${code}`,
            );

            return {
                couponCode: code,
                discountBD,
                pointsSpent: pointsToRedeem,
                couponExpiresAt: coupon.expiresAt,
                remainingBalance: user.pointsBalance - pointsToRedeem,
            };
        });
    }
}