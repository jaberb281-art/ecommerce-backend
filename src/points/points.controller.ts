import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    UseGuards,
    Request,
} from '@nestjs/common';
import { PointsService } from './points.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { AdjustPointsDto } from './dto/adjust-points.dto';

@ApiTags('points')
@Controller('points')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PointsController {
    constructor(private readonly pointsService: PointsService) { }

    // ── GET /points/me ─────────────────────────────────────────────────────
    // Customer: get own balance + transaction history

    @Get('me')
    @ApiOperation({ summary: 'Get my points balance and transaction history' })
    async getMyBalance(@Request() req) {
        return this.pointsService.getBalance(req.user.id);
    }

    // ── POST /points/redeem ─────────────────────────────────────────────────
    // Customer: redeem points for a coupon code

    @Post('redeem')
    @ApiOperation({ summary: 'Redeem points for a discount coupon (100 pts = BD 1.00)' })
    @ApiBody({
        schema: {
            type: 'object',
            required: ['points'],
            properties: {
                points: {
                    type: 'number',
                    example: 500,
                    description: 'Must be a multiple of 100. Min 100, max 5000.',
                },
            },
        },
    })
    async redeemPoints(@Request() req, @Body('points') points: number) {
        return this.pointsService.redeemPoints(req.user.id, points);
    }

    // ── POST /points/social-connect ─────────────────────────────────────────
    // Customer: award points for linking a social account

    @Post('social-connect')
    @ApiOperation({ summary: 'Award 25 points for linking a social account (idempotent)' })
    @ApiBody({
        schema: {
            type: 'object',
            required: ['platform'],
            properties: {
                platform: {
                    type: 'string',
                    enum: ['instagram', 'tiktok', 'twitter'],
                },
            },
        },
    })
    async socialConnect(
        @Request() req,
        @Body('platform') platform: 'instagram' | 'tiktok' | 'twitter',
    ) {
        return this.pointsService.awardSocialConnect(req.user.id, platform);
    }

    // ── GET /points/user/:userId  (Admin) ───────────────────────────────────

    @Get('user/:userId')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: "Get any user's points balance (Admin only)" })
    async getUserBalance(@Param('userId') userId: string) {
        return this.pointsService.getBalance(userId);
    }

    // ── POST /points/user/:userId/adjust  (Admin) ───────────────────────────

    @Post('user/:userId/adjust')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Manually grant or deduct points (Admin only)' })
    @ApiBody({
        schema: {
            type: 'object',
            required: ['points', 'description'],
            properties: {
                points: {
                    type: 'number',
                    example: 100,
                    description: 'Positive to grant, negative to deduct.',
                },
                description: {
                    type: 'string',
                    example: 'Apology for delayed order',
                },
            },
        },
    })
    async adjustPoints(
        @Param('userId') userId: string,
        @Body() dto: AdjustPointsDto,
    ) {
        return this.pointsService.awardManual(userId, dto.points, dto.description);
    }
}